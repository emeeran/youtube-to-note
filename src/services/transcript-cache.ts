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
 * Layout (vault-relative — the form every adapter call takes):
 *   <configDir>/plugins/<pluginDir>/cache/transcripts/<videoId>.<lang>.json
 *   ...where <lang> is the requested language code, or "auto" when unspecified.
 *
 * File shape (an entry that does not match is treated as a miss and deleted):
 *   { "savedAt": 1735689600000, "language": "en", "transcript": TranscriptResult }
 *
 * The cache is bounded: at most TRANSCRIPT_CACHE_MAX_FILES entries are kept, the
 * oldest (by `savedAt`) pruned after each write.
 */

/** How long a persisted transcript stays fresh (7 days, matching the memory cache). */
export const TRANSCRIPT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

/** Upper bound on cached transcripts; the oldest entries are pruned after a write. */
export const TRANSCRIPT_CACHE_MAX_FILES = 200;

/** Fallback plugin folder, relative to the vault root, when manifest.dir is not supplied. */
const DEFAULT_PLUGIN_DIR = '.obsidian/plugins/youtube-to-note';

/** Cache subfolder inside the plugin directory. */
const CACHE_SUBDIR = 'cache/transcripts';

/** Only 11-char YouTube ids are ever written to disk (defense against path tricks). */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Leftover temp files: `<videoId>.<lang>.json.tmp-<stamp>-<rand>` today, plus
 * the plain `.json.tmp` suffix older versions wrote. Never matches a real entry.
 */
const TEMP_FILE_PATTERN = /\.tmp(?:-[0-9a-z]+)*$/i;

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

/** Guard for the persisted transcript payload — anything else is a cache miss. */
function isTranscriptShape(value: unknown): value is TranscriptResult {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<TranscriptResult>;
    return typeof candidate.fullText === 'string' && Array.isArray(candidate.segments);
}

export class TranscriptDiskCache {
    /** Cleared once per instance, so temp-file sweeping runs a single time. */
    private sweptTempFiles = false;

    constructor(
        private app: App,
        private pluginDir?: string,
    ) {}

    /**
     * Read a cached transcript. Returns null on miss, expiry, malformed content,
     * or any failure. `language` is the *requested* language (the key), not the
     * transcript's.
     */
    async get(videoId: string, language?: string): Promise<TranscriptResult | null> {
        const path = this.pathFor(videoId, language);
        if (!path) return null;

        try {
            const adapter = this.adapter;
            if (!adapter || !(await adapter.exists(path))) return null;

            const entry = this.parseEntry(await this.readFile(adapter, path));
            if (!entry) {
                logger.warn('Transcript cache: discarding malformed entry', 'TranscriptCache', { videoId, path });
                await this.remove(path);
                return null;
            }

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
            await this.sweepTempFiles(adapter);

            // Atomic-ish: write to a sibling temp file, then rename over the
            // target, so a crash mid-write never leaves a truncated entry. The
            // temp name is unique per write — two runs saving the same video at
            // once must not rename each other's half-written file.
            const tmp = this.tempPathFor(path);
            await adapter.write(tmp, JSON.stringify(entry));
            await adapter.rename(tmp, path);
            await this.pruneOldest(adapter);
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
            if (await adapter.exists(dir)) {
                await adapter.rmdir(dir, true);
                logger.info('Transcript cache: cleared', 'TranscriptCache', { dir });
            }
            // A partial delete (or a crash from an earlier run) can leave temp
            // files behind — sweep whatever is left.
            await this.sweepTempFiles(adapter);
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

    /**
     * Create every missing ancestor of the transcript cache directory. The
     * parents are derived from the same path the writes use, so the folder the
     * cache actually needs always exists (and no stray folder appears elsewhere
     * in the vault).
     */
    private async ensureDir(adapter: FileSystemAdapter): Promise<void> {
        const dir = this.cacheDir();
        if (!dir) return;

        const segments = toPath(dir).split('/').filter(Boolean);
        for (let depth = 0; depth < segments.length; depth++) {
            const path = segments.slice(0, depth + 1).join('/');
            if (!(await adapter.exists(path))) {
                await adapter.mkdir(path);
            }
        }
    }

    /** Delete `.tmp-*` leftovers from crashed writes. Once per instance, best-effort. */
    private async sweepTempFiles(adapter: FileSystemAdapter): Promise<void> {
        if (this.sweptTempFiles) return;
        this.sweptTempFiles = true;

        try {
            const dir = this.cacheDir();
            if (!dir || !(await adapter.exists(dir))) return;

            const { files } = await adapter.list(dir);
            const orphans = (files ?? []).filter(file => TEMP_FILE_PATTERN.test(file));
            for (const file of orphans) {
                logger.debug('Transcript cache: removing leftover temp file', 'TranscriptCache', { file });
                await this.remove(file);
            }
        } catch (error) {
            logger.debug('Transcript cache: temp file sweep failed', 'TranscriptCache', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Keep the cache bounded: once it holds more than `MAX_FILES` entries, the
     * oldest ones (by `savedAt`) are dropped. Best-effort and non-throwing.
     */
    private async pruneOldest(adapter: FileSystemAdapter): Promise<void> {
        try {
            const dir = this.cacheDir();
            if (!dir) return;

            const { files } = await adapter.list(dir);
            const entries = (files ?? []).filter(file => file.endsWith('.json'));
            const excess = entries.length - TRANSCRIPT_CACHE_MAX_FILES;
            if (excess <= 0) return;

            const byAge = await Promise.all(
                entries.map(async file => ({ file, savedAt: await this.savedAtOf(adapter, file) })),
            );
            byAge.sort((a, b) => a.savedAt - b.savedAt);

            for (const { file } of byAge.slice(0, excess)) {
                logger.debug('Transcript cache: pruning oldest entry', 'TranscriptCache', { file });
                await this.remove(file);
            }
        } catch (error) {
            logger.debug('Transcript cache: prune failed', 'TranscriptCache', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /** `savedAt` of a cached entry, or 0 (prune first) when it cannot be read. */
    private async savedAtOf(adapter: FileSystemAdapter, path: string): Promise<number> {
        const entry = this.parseEntry(await this.readFile(adapter, path));
        return entry?.savedAt ?? 0;
    }

    private async readFile(adapter: FileSystemAdapter, path: string): Promise<string | null> {
        try {
            return await adapter.read(path);
        } catch {
            return null;
        }
    }

    /** Null unless the JSON parses into the exact shape this cache writes. */
    private parseEntry(raw: string | null): CachedTranscript | null {
        if (!raw) return null;
        let entry: unknown;
        try {
            entry = JSON.parse(raw);
        } catch {
            return null;
        }
        const candidate = entry as Partial<CachedTranscript> | null | undefined;
        if (!candidate || typeof candidate !== 'object') return null;
        if (typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt)) return null;
        if (!isTranscriptShape(candidate.transcript)) return null;
        return candidate as CachedTranscript;
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

    /** Sibling temp file with a per-write suffix, so concurrent writes never collide. */
    private tempPathFor(path: string): string {
        const random = Math.random().toString(36).slice(2, 8);
        return `${path}.tmp-${Date.now().toString(36)}-${random}`;
    }

    /**
     * Vault-relative cache directory — the exact path every adapter call uses.
     * Adapter paths are relative to the vault root, so the filesystem base path
     * must not be baked in. Undefined when there is no filesystem (mobile/web).
     */
    private cacheDir(): string | undefined {
        if (!this.adapter) return undefined;
        return toPath(`${this.pluginPath()}/${CACHE_SUBDIR}`);
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
