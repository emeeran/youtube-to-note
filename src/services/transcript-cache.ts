import type { App, FileSystemAdapter, Vault } from 'obsidian';
import { logger } from './logger';
import type { TranscriptResult } from '../types';

/**
 * Optional on-disk cache for fetched transcripts.
 *
 * Transcripts live under the plugin folder (`<pluginDir>/cache/transcripts/`),
 * one JSON file per video+language, so an Obsidian reload does not re-fetch
 * YouTube. Everything here is best-effort: any read/write failure is logged and
 * degrades to "no cache" — the caller never sees an error from this service.
 *
 * Layout:
 *   <vault>/<configDir>/plugins/<pluginDir>/cache/transcripts/<videoId>.<lang>.json
 *   ...where <lang> is the requested language code, or "auto" when unspecified.
 *
 * File shape:
 *   { "savedAt": 1735689600000, "language": "en", "transcript": TranscriptResult }
 */

/** How long a persisted transcript stays fresh (7 days, matching the memory cache). */
export const TRANSCRIPT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** Fallback plugin folder, relative to the vault root, when manifest.dir is not supplied. */
const DEFAULT_PLUGIN_DIR = '.obsidian/plugins/youtube-to-note';

/** Cache subfolder inside the plugin directory. */
const CACHE_SUBDIR = 'cache/transcripts';

/** Only 11-char YouTube ids are ever written to disk (defense against path tricks). */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Collapse separators and edge slashes; segments are sanitized before use. */
function toPath(value: string): string {
    return value
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/^\/+|\/+$/g, '');
}

/** The JSON document persisted per transcript. */
export interface CachedTranscript {
    savedAt: number;
    language?: string;
    transcript: TranscriptResult;
}

export class TranscriptDiskCache {
    constructor(
        private app: App,
        private pluginDir?: string,
    ) {}

    /**
     * Read a cached transcript. Returns null on miss, expiry, or any failure.
     * `language` is the *requested* language (the key), not the transcript's.
     */
    async get(videoId: string, language?: string): Promise<TranscriptResult | null> {
        const path = this.pathFor(videoId, language);
        if (!path) return null;

        try {
            const adapter = this.adapter;
            if (!adapter || !(await adapter.exists(path))) return null;

            const entry = JSON.parse(await adapter.read(path)) as Partial<CachedTranscript> | null;
            if (!entry || typeof entry.savedAt !== 'number' || !entry.transcript) return null;

            if (Date.now() - entry.savedAt > TRANSCRIPT_CACHE_TTL_MS) {
                logger.debug('Transcript cache: entry expired', 'TranscriptCache', { videoId });
                await this.remove(path);
                return null;
            }
            return entry.transcript;
        } catch (error) {
            logger.warn('Transcript cache: read failed, ignoring cache', 'TranscriptCache', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /** Persist a transcript. Failures are logged and swallowed. */
    async set(videoId: string, language: string | undefined, transcript: TranscriptResult): Promise<void> {
        const path = this.pathFor(videoId, language);
        if (!path) return;

        const entry: CachedTranscript = {
            savedAt: Date.now(),
            language: transcript.language ?? language,
            transcript,
        };

        try {
            const adapter = this.adapter;
            if (!adapter) return;
            await this.ensureDir(adapter);

            // Atomic-ish: write to a sibling temp file, then rename over the
            // target, so a crash mid-write never leaves a truncated entry.
            const tmp = `${path}.tmp`;
            await adapter.write(tmp, JSON.stringify(entry));
            await adapter.rename(tmp, path);
        } catch (error) {
            logger.warn('Transcript cache: write failed, continuing without it', 'TranscriptCache', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Delete every persisted transcript. Meant to be invoked from an explicit
     * settings action — NOT from plugin unload, which would defeat the purpose
     * of surviving Obsidian reloads.
     */
    async clear(): Promise<void> {
        try {
            const adapter = this.adapter;
            const dir = this.cacheDir();
            if (!adapter || !dir) return;
            if (!(await adapter.exists(dir))) return;
            await adapter.rmdir(dir, true);
            logger.info('Transcript cache: cleared', 'TranscriptCache', { dir });
        } catch (error) {
            logger.warn('Transcript cache: clear failed', 'TranscriptCache', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async remove(path: string): Promise<void> {
        try {
            await this.adapter?.remove(path);
        } catch (error) {
            logger.debug('Transcript cache: could not remove stale entry', 'TranscriptCache', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /** Create <pluginDir>/cache and <pluginDir>/cache/transcripts if missing. */
    private async ensureDir(adapter: FileSystemAdapter): Promise<void> {
        const plugin = this.pluginPath();
        const parents = [plugin, `${plugin}/cache`];
        for (const dir of parents) {
            const normalized = toPath(dir);
            if (normalized && !(await adapter.exists(normalized))) {
                await adapter.mkdir(normalized);
            }
        }
    }

    private pathFor(videoId: string, language?: string): string | undefined {
        if (!VIDEO_ID_PATTERN.test(videoId)) {
            logger.warn('Transcript cache: refusing to use a malformed video id', 'TranscriptCache', { videoId });
            return undefined;
        }
        const dir = this.cacheDir();
        if (!dir) return undefined;

        const lang = this.sanitizeSegment(language ?? 'auto');
        return `${dir}/${videoId}.${lang}.json`;
    }

    private cacheDir(): string | undefined {
        const base = this.vaultRoot();
        if (!base) return undefined;
        return `${base}/${CACHE_SUBDIR}`;
    }

    /** Absolute vault root, or undefined when running without a filesystem (mobile/tests). */
    private vaultRoot(): string | undefined {
        const adapter = this.adapter;
        if (!adapter) return undefined;

        const configDir = (this.app.vault as Vault | undefined)?.configDir ?? '.obsidian';
        return toPath(`${adapter.getBasePath()}/${configDir}/plugins/${this.pluginPath()}`);
    }

    private pluginPath(): string {
        const raw = this.pluginDir ?? DEFAULT_PLUGIN_DIR;
        // Sanitize each path segment so a stray "../" in a configured id can
        // never escape the plugin folder.
        return raw
            .split('/')
            .map(segment => this.sanitizeSegment(segment))
            .join('/');
    }

    private get adapter(): FileSystemAdapter | undefined {
        const adapter = (this.app.vault as Vault | undefined)?.adapter;
        if (!adapter) return undefined;
        try {
            // Only a real filesystem adapter (desktop) has a base path; the
            // mobile/web adapters throw here, which we treat as "no cache".
            const basePath = (adapter as FileSystemAdapter).getBasePath();
            return typeof basePath === 'string' && basePath.length > 0 ? (adapter as FileSystemAdapter) : undefined;
        } catch (error) {
            logger.debug('Transcript cache: no filesystem adapter available', 'TranscriptCache', {
                error: error instanceof Error ? error.message : String(error),
            });
            return undefined;
        }
    }

    /** Strip anything that could escape the cache directory. */
    private sanitizeSegment(segment: string): string {
        const clean = segment.replace(/[^A-Za-z0-9_.-]/g, '-');
        return clean === '.' || clean === '..' ? 'unknown' : clean || 'unknown';
    }
}
