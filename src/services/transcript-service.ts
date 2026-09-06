import {
    CacheService,
    TranscriptFailureReason,
    TranscriptOutcome,
    TranscriptResult,
    TranscriptSegment,
    YouTubePluginSettings,
} from '../types';
import { logger } from './logger';
import {
    decodeEntities,
    extractCaptionTracks,
    fetchCaptionContent,
    fetchInnertubePlayerResponse,
    fetchPlayerResponse,
    selectCaptionTrack,
} from './youtube-page';
import { TranscriptDiskCache } from './transcript-cache';

/**
 * YouTube transcript extraction service.
 *
 * Fetches the watch page via Obsidian's CORS-free `requestUrl`, parses the
 * embedded `ytInitialPlayerResponse`, selects a caption track (honoring a
 * preferred language), then downloads and parses the timedtext payload.
 *
 * The primary entry point is {@link YouTubeTranscriptService.fetchTranscriptOutcome},
 * which reports *why* a transcript is unavailable (restricted / private /
 * unavailable / no-captions / network) instead of collapsing every failure to
 * null. {@link YouTubeTranscriptService.getTranscript} is kept as a thin legacy
 * wrapper for existing callers.
 */

/** Options a host (the service container) can wire in. All optional. */
export interface TranscriptServiceOptions {
    /** On-disk cache. Only consulted when settings.persistTranscriptCache is on. */
    diskCache?: TranscriptDiskCache;
    /** Live settings accessor, so the persist flag is read at call time. */
    getSettings?: () => YouTubePluginSettings | undefined;
}

/** Memory-bound ceiling: stop appending segments past this many characters. */
const MAX_TRANSCRIPT_CHARS = 150_000;

/** The slice of `playabilityStatus` we care about when classifying a failure. */
interface PlayabilityStatus {
    status?: string;
    reason?: string;
    /** Error-screen renderer keys (e.g. "playerAgeRestrictedRenderer") double as signals. */
    errorScreen?: Record<string, unknown>;
}

/** Age-gate wording (checked first, because the innertube fallback can bypass it). */
const AGE_GATE_PATTERNS = [
    /sign in to confirm your age/i,
    /age.restricted/i,
    /inappropriate for (some|certain) users/i,
];

/** Region-block wording — also 'restricted', since the cause is out of our hands. */
const REGION_PATTERNS = [/available in your country/i, /available in your region/i, /blocked .{0,40}in your country/i];

const PRIVATE_PATTERNS = [/this video is private/i, /\bprivate video\b/i];

const UNAVAILABLE_PATTERNS = [
    /video unavailable/i,
    /removed by the uploader/i,
    /no longer available/i,
    /has been (removed|deleted|terminated)/i,
    /does not exist/i,
    /\b404\b/,
];

/** Short, user-facing explanations per failure class. */
const FAILURE_MESSAGES: Record<TranscriptFailureReason, string> = {
    restricted: 'This video is age- or region-restricted, so its transcript is unavailable.',
    private: 'This video is private, so its transcript is unavailable.',
    unavailable: 'This video is unavailable — it may have been removed or never existed.',
    'no-captions': 'This video has no caption tracks to transcribe.',
    network: 'The transcript could not be downloaded (network error).',
    unknown: 'The transcript could not be fetched for an unrecognized reason.',
};

/** Ordered player-response signals; the first matching group wins. */
const PLAYABILITY_SIGNALS: Array<{ reason: TranscriptFailureReason; patterns: RegExp[] }> = [
    { reason: 'restricted', patterns: AGE_GATE_PATTERNS },
    { reason: 'restricted', patterns: REGION_PATTERNS },
    { reason: 'private', patterns: PRIVATE_PATTERNS },
    { reason: 'unavailable', patterns: UNAVAILABLE_PATTERNS },
];

/**
 * Map a player response's playability status to a failure reason.
 * Returns null when the video looks playable (or carries no signal at all).
 */
export function classifyPlayability(playerResponse: unknown): TranscriptFailureReason | null {
    const playability = (playerResponse as { playabilityStatus?: PlayabilityStatus } | null | undefined)
        ?.playabilityStatus;
    if (!playability) return null;

    const status = (playability.status ?? '').toUpperCase();
    if (status === 'OK') return null;

    // Renderer keys on the error screen (e.g. "playerAgeRestrictedRenderer")
    // carry as much signal as the human-readable reason, so match on both.
    const text = [playability.reason ?? '', ...Object.keys(playability.errorScreen ?? {})].join(' ');

    const signalled = PLAYABILITY_SIGNALS.find(signal => signal.patterns.some(pattern => pattern.test(text)));
    if (signalled) return signalled.reason;

    // Any other sign-in wall: we have no better remedy than the innertube
    // fallback, so treat it as restricted and let the caller retry there.
    if (status === 'LOGIN_REQUIRED') return 'restricted';
    if (status === 'ERROR' || status === 'UNPLAYABLE') return 'unavailable';

    return 'unknown';
}

/** Prefer YouTube's own wording, falling back to our canned explanation. */
function failureMessage(reason: TranscriptFailureReason, playerResponse: unknown, detail?: string): string {
    if (detail) return detail;
    const youtubeReason = (playerResponse as { playabilityStatus?: PlayabilityStatus } | null | undefined)
        ?.playabilityStatus?.reason;
    return typeof youtubeReason === 'string' && youtubeReason.trim() ? youtubeReason : FAILURE_MESSAGES[reason];
}

/** Extract a readable message from a thrown fetch error. */
function errorMessage(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.trim() || FAILURE_MESSAGES.network;
}

/** A transcript after the character ceiling has been applied. */
interface CappedTranscript {
    segments: TranscriptSegment[];
    fullText: string;
    truncated: boolean;
}

/**
 * Cap a transcript at {@link MAX_TRANSCRIPT_CHARS} so a pathological video
 * cannot balloon memory. This is a source-level ceiling, separate from the
 * prompt-budget trimming PromptService applies downstream.
 */
function capTranscript(segments: TranscriptSegment[]): CappedTranscript {
    const kept: TranscriptSegment[] = [];
    let length = 0;

    for (const segment of segments) {
        const next = length + segment.text.length + 1;
        if (kept.length > 0 && next > MAX_TRANSCRIPT_CHARS) break;
        kept.push(segment);
        length = next;
    }

    return {
        segments: kept,
        fullText: kept.map(segment => segment.text).join(' '),
        truncated: kept.length < segments.length,
    };
}

export class YouTubeTranscriptService {
    private readonly transcriptTTL = 1000 * 60 * 60 * 24 * 7; // 7 days

    constructor(
        private cache?: CacheService,
        private options?: TranscriptServiceOptions,
    ) {}

    /**
     * Typed transcript fetch. On success the transcript carries segments,
     * language, ASR flag and a truncation marker; on failure the reason is
     * machine-readable so the UI can explain restricted / private / no-captions.
     *
     * Lookup order: disk (opt-in) → memory → network.
     */
    async fetchTranscriptOutcome(videoId: string, language?: string): Promise<TranscriptOutcome> {
        if (!videoId) {
            throw new Error('Video ID is required');
        }

        const cacheKey = language ? `transcript-${videoId}-${language}` : `transcript-${videoId}`;

        const disk = this.activeDiskCache;
        if (disk) {
            const fromDisk = await disk.get(videoId, language);
            if (fromDisk) {
                this.cache?.set(cacheKey, fromDisk, this.transcriptTTL);
                return { ok: true, transcript: fromDisk };
            }
        }

        const cached = this.cache?.get<TranscriptResult>(cacheKey);
        if (cached) {
            return { ok: true, transcript: cached };
        }

        const outcome = await this.fetchTranscriptFromNetwork(videoId, language);

        if (outcome.ok) {
            this.cache?.set(cacheKey, outcome.transcript, this.transcriptTTL);
            if (disk) {
                await disk.set(videoId, language, outcome.transcript);
            }
        }

        return outcome;
    }

    /**
     * Legacy wrapper kept for existing callers/tests: returns the transcript or
     * null, discarding the typed failure reason. Prefer `fetchTranscriptOutcome`.
     */
    async getTranscript(videoId: string, language?: string): Promise<TranscriptResult | null> {
        const outcome = await this.fetchTranscriptOutcome(videoId, language);
        return outcome.ok ? outcome.transcript : null;
    }

    /**
     * Check if a transcript is available for a video.
     */
    async isTranscriptAvailable(videoId: string): Promise<boolean> {
        const transcript = await this.getTranscript(videoId);
        return transcript !== null && transcript.segments.length > 0;
    }

    /**
     * Disk cache handle, or undefined when the user has not opted in. The flag
     * is read at call time so toggling the setting needs no service rebuild.
     */
    private get activeDiskCache(): TranscriptDiskCache | undefined {
        const persist = this.options?.getSettings?.()?.persistTranscriptCache ?? false;
        if (!persist) return undefined;
        return this.options?.diskCache;
    }

    /** Fetch (and classify) a transcript straight from YouTube. */
    private async fetchTranscriptFromNetwork(videoId: string, language?: string): Promise<TranscriptOutcome> {
        let playerResponse: unknown;
        try {
            playerResponse = await fetchPlayerResponse(videoId);
        } catch (error) {
            logger.warn('Transcript: watch page fetch failed', 'Transcript', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
            return { ok: false, reason: 'network', message: errorMessage(error) };
        }

        if (!playerResponse) {
            logger.warn('Transcript: could not parse player response', 'Transcript', { videoId });
            return { ok: false, reason: 'unknown', message: FAILURE_MESSAGES.unknown };
        }

        let reason = classifyPlayability(playerResponse);
        if (reason === 'restricted') {
            playerResponse = await this.retryRestrictedViaInnertube(videoId, playerResponse);
            reason = classifyPlayability(playerResponse);
        }

        if (reason) {
            const message = failureMessage(reason, playerResponse);
            logger.info('Transcript: unavailable', 'Transcript', { videoId, reason });
            return { ok: false, reason, message };
        }

        return this.downloadCaptionTrack(videoId, playerResponse, language);
    }

    /** Pick the best track, download its timedtext payload, and parse it. */
    private async downloadCaptionTrack(
        videoId: string,
        playerResponse: unknown,
        language?: string,
    ): Promise<TranscriptOutcome> {
        const tracks = extractCaptionTracks(playerResponse);
        if (tracks.length === 0) {
            logger.info('Transcript: no caption tracks available', 'Transcript', { videoId });
            return { ok: false, reason: 'no-captions', message: FAILURE_MESSAGES['no-captions'] };
        }

        const track = selectCaptionTrack(tracks, language);
        if (!track?.baseUrl) {
            logger.warn('Transcript: no suitable caption track found', 'Transcript', {
                videoId,
                languages: tracks.map(t => t.languageCode),
            });
            return { ok: false, reason: 'no-captions', message: FAILURE_MESSAGES['no-captions'] };
        }

        let xml: string;
        try {
            xml = await fetchCaptionContent(track.baseUrl);
        } catch (error) {
            logger.warn('Transcript: caption download failed', 'Transcript', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
            return { ok: false, reason: 'network', message: errorMessage(error) };
        }

        const transcript = this.parseXMLTranscript(xml, track.languageCode || 'en', track.kind === 'asr');
        if (transcript.segments.length === 0) {
            logger.warn('Transcript: caption payload parsed but was empty', 'Transcript', { videoId });
            return { ok: false, reason: 'no-captions', message: 'Caption payload was empty.' };
        }

        if (transcript.truncated) {
            logger.warn('Transcript: capped at the character ceiling', 'Transcript', {
                videoId,
                limit: MAX_TRANSCRIPT_CHARS,
            });
        }

        logger.info('Transcript fetched', 'Transcript', {
            videoId,
            language: transcript.language,
            segments: transcript.segments.length,
            length: transcript.fullText.length,
            truncated: transcript.truncated === true,
        });
        return { ok: true, transcript };
    }

    /**
     * Age-restriction fallback.
     *
     * The watch page hides `captions` behind an age/sign-in gate. YouTube's
     * public innertube player endpoint, called with an ANDROID client context,
     * still serves a player response (caption tracks included) for many of
     * those videos without credentials — so we retry there exactly once, then
     * continue through the same timedtext fetch. No API key is needed for the
     * ANDROID client, so none is sent. Uses `requestUrl` (CORS-free), never
     * `fetch`. Returns the original response untouched when the endpoint fails,
     * which keeps the caller's 'restricted' outcome intact.
     */
    private async retryRestrictedViaInnertube(videoId: string, original: unknown): Promise<unknown> {
        const fallback = await this.requestInnertubePlayer(videoId);
        if (!fallback || typeof fallback !== 'object' || extractCaptionTracks(fallback).length === 0) {
            logger.debug('Transcript: innertube fallback returned no caption tracks', 'Transcript', { videoId });
            return original;
        }

        logger.info('Transcript: recovered caption tracks via innertube fallback', 'Transcript', { videoId });
        return fallback;
    }

    /** POST YouTube's innertube player API for this video; null on any failure. */
    private async requestInnertubePlayer(videoId: string): Promise<unknown> {
        try {
            return await fetchInnertubePlayerResponse(videoId);
        } catch (error) {
            logger.warn('Transcript: innertube fallback failed', 'Transcript', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Parse a timedtext XML payload into segments.
     * Handles both the default `<text start="" dur="">` shape and the
     * srv3 `<t s="" d="">` shape so we are robust to YouTube's format variance.
     */
    private parseXMLTranscript(xmlText: string, language: string, autoGenerated: boolean): TranscriptResult {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const textElements = xmlDoc.getElementsByTagName('text');
        const elements = textElements.length > 0 ? textElements : xmlDoc.getElementsByTagName('t');

        const segments: TranscriptSegment[] = [];

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!element) continue;
            const raw = element.textContent ?? '';
            const text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
            const start = parseFloat(element.getAttribute('start') ?? element.getAttribute('s') ?? '0');
            const duration = parseFloat(element.getAttribute('dur') ?? element.getAttribute('d') ?? '0');

            if (text) {
                segments.push({ text, start, duration });
            }
        }

        const capped = capTranscript(segments);
        return {
            fullText: capped.fullText,
            segments: capped.segments,
            language,
            isAutoGenerated: autoGenerated,
            truncated: capped.truncated,
        };
    }
}
