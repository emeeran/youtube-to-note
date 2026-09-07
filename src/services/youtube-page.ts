import { requestUrl } from 'obsidian';
import { logger } from './logger';

/**
 * Shared, proxy-free access to YouTube watch-page data.
 *
 * Obsidian's `requestUrl` runs in the desktop main process and is not subject
 * to browser CORS rules, so we can fetch `https://www.youtube.com/watch?v=…`
 * directly — no third-party CORS proxy required. We then parse the embedded
 * `ytInitialPlayerResponse` JSON via brace-balanced extraction (far more
 * robust than regex scraping of a shape YouTube changes frequently).
 */

export interface CaptionTrack {
    baseUrl: string;
    languageCode: string;
    name?: string;
    kind?: string;
}

export interface VideoPageDetails {
    description?: string;
    duration?: number;
    publishedAt?: string;
    title?: string;
    channelName?: string;
}

/** Hard ceiling for any single YouTube request so a hung one cannot stall a run. */
const YOUTUBE_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Thrown when a run's AbortSignal fired. Services let it propagate (it is never
 * classified as a network failure) and the pipeline turns it into a clean
 * "cancelled" result instead of an error notice.
 */
export class RequestAbortedError extends Error {
    constructor() {
        super('Request aborted');
        this.name = 'RequestAbortedError';
    }
}

/** Throws as soon as the run has been cancelled. A no-op without a signal. */
export function assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new RequestAbortedError();
}

/** Fetch the raw HTML of a YouTube watch page without any CORS proxy. */
export async function fetchYouTubePage(videoId: string, signal?: AbortSignal): Promise<string> {
    assertNotAborted(signal);
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await withTimeout(
        requestUrl({
            url,
            method: 'GET',
            headers: {
                // A normal browser UA avoids YouTube's "unsupported browser" shells.
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // Deliberately no Accept-Language: sending one biases YouTube's
                // caption track list (and default track order) toward that locale.
            },
        }),
        YOUTUBE_REQUEST_TIMEOUT_MS,
        signal,
    );
    assertNotAborted(signal);
    return response.text;
}

/** The assignment YouTube embeds the player response behind in watch-page HTML. */
const PLAYER_RESPONSE_MARKER = 'ytInitialPlayerResponse';

/** Index just past the string literal opening at `openIdx`, or the end of input. */
function skipStringLiteral(html: string, openIdx: number): number {
    const quote = html[openIdx];
    for (let i = openIdx + 1; i < html.length; i++) {
        const ch = html[i];
        if (ch === '\\') {
            i++;
        } else if (ch === quote) {
            return i + 1;
        }
    }
    return html.length;
}

/** Index just past a `//` comment starting at `start`, or the end of input. */
function skipLineComment(html: string, start: number): number {
    const end = html.indexOf('\n', start);
    return end === -1 ? html.length : end + 1;
}

/** Index just past a block comment starting at `start`, or the end of input. */
function skipBlockComment(html: string, start: number): number {
    const end = html.indexOf('*/', start + 2);
    return end === -1 ? html.length : end + 2;
}

/**
 * Index of the next code character at or after `i`, skipping over any string
 * literal or comment that starts there. Returns `i` unchanged when the
 * character at `i` is plain code.
 */
function skipStringOrComment(html: string, i: number): number {
    const ch = html[i];
    const next = html[i + 1];

    if (ch === '"' || ch === "'") return skipStringLiteral(html, i);
    if (ch === '/' && next === '/') return skipLineComment(html, i);
    if (ch === '/' && next === '*') return skipBlockComment(html, i);
    return i;
}

/**
 * Walk forward from `start` (an opening `{`) to its matching `}` and parse the
 * slice. String literals (double- and single-quoted, with escapes), `//` line
 * comments and block comments are skipped wholesale, so braces and quotes
 * inside any of them do not prematurely terminate the object. Regex literals
 * are deliberately NOT detected — disambiguating division from a regex is too
 * risky to get right on minified output.
 *
 * Returns the parsed object, or null when the JSON is unbalanced or invalid.
 */
function extractJsonObject(html: string, start: number): unknown {
    let depth = 0;

    let i = start;
    while (i < html.length) {
        const skipped = skipStringOrComment(html, i);
        if (skipped !== i) {
            i = skipped;
            continue;
        }

        const ch = html[i];
        if (ch === '{') {
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(html.slice(start, i + 1));
                } catch (error) {
                    logger.debug('Failed to parse ytInitialPlayerResponse JSON', 'YouTubePage', {
                        error: error instanceof Error ? error.message : String(error),
                    });
                    return null;
                }
            }
        }
        i++;
    }
    return null;
}

/**
 * Extract and parse the `ytInitialPlayerResponse` object from watch-page HTML.
 * Uses brace balancing that respects string literals and comments, so braces
 * inside strings or comments do not prematurely terminate the object. If the
 * first `ytInitialPlayerResponse =` occurrence yields no valid JSON, later
 * occurrences are tried before giving up.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePlayerResponse(html: string): any | null {
    let from = 0;
    for (;;) {
        const markerIdx = html.indexOf(PLAYER_RESPONSE_MARKER, from);
        if (markerIdx === -1) return null;

        const start = html.indexOf('{', markerIdx + PLAYER_RESPONSE_MARKER.length);
        if (start === -1) return null;

        const parsed = extractJsonObject(html, start);
        if (parsed !== null && typeof parsed === 'object') return parsed;

        // This occurrence was malformed — keep scanning subsequent ones.
        from = start + 1;
    }
}

/** Decode the common HTML/unicode entities YouTube embeds in JSON strings. */
export function decodeEntities(text: string): string {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
}

/** Extract caption tracks from a parsed player response. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractCaptionTracks(playerResponse: any): CaptionTrack[] {
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks)) return [];
    return tracks.map(
        (track: { baseUrl?: string; languageCode?: string; name?: { simpleText?: string }; kind?: string }) => ({
            baseUrl: typeof track.baseUrl === 'string' ? track.baseUrl : '',
            languageCode: typeof track.languageCode === 'string' ? track.languageCode : '',
            name: track.name?.simpleText,
            kind: track.kind,
        }),
    );
}

/** Extract supplementary metadata (description, duration, publish date) from a player response. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractVideoDetails(playerResponse: any): VideoPageDetails {
    const details: VideoPageDetails = {};

    const videoDetails = playerResponse?.videoDetails;
    const microformat = playerResponse?.microformat?.playerMicroformatRenderer;

    if (typeof videoDetails?.shortDescription === 'string') {
        details.description = decodeEntities(videoDetails.shortDescription);
    }
    if (typeof videoDetails?.lengthSeconds === 'string') {
        const seconds = parseInt(videoDetails.lengthSeconds, 10);
        if (!Number.isNaN(seconds)) details.duration = seconds;
    }
    if (typeof videoDetails?.title === 'string') {
        details.title = videoDetails.title;
    }
    if (typeof videoDetails?.author === 'string') {
        details.channelName = videoDetails.author;
    }
    if (typeof microformat?.publishDate === 'string') {
        details.publishedAt = microformat.publishDate.split('T')[0];
    }

    return details;
}

/** Pick the best caption track given an optional preferred language. */
export function selectCaptionTrack(tracks: CaptionTrack[], language?: string): CaptionTrack | undefined {
    if (tracks.length === 0) return undefined;

    // For a given language, prefer a manually-authored track over an auto-generated ("asr") one.
    const pickByLanguage = (lang: string): CaptionTrack | undefined => {
        const matches = tracks.filter(
            t => t.languageCode === lang || t.languageCode.startsWith(`${lang}-`) || t.languageCode.startsWith(lang),
        );
        if (matches.length === 0) return undefined;
        return matches.find(t => t.kind !== 'asr') ?? matches[0];
    };

    if (language) {
        const hit = pickByLanguage(language);
        if (hit) return hit;
    }

    // Default to English, then the first manual track, then the first track overall.
    return pickByLanguage('en') ?? tracks.find(t => t.kind !== 'asr') ?? tracks[0];
}

/** Only YouTube's timedtext host may be asked for caption payloads — a player
 * response is remote-controlled, so never fetch an arbitrary URL from it.
 * Real caption URLs are `…/api/timedtext?…` (the bare `/timedtext` legacy
 * shape is accepted too). */
const CAPTION_HOST_PATTERN = /^https:\/\/([^/]+\.)?youtube\.com\/(?:api\/)?timedtext/;

/** Fetch the raw caption payload (timedtext XML) for a caption track. */
export async function fetchCaptionContent(baseUrl: string, signal?: AbortSignal): Promise<string> {
    assertNotAborted(signal);
    if (!CAPTION_HOST_PATTERN.test(baseUrl)) {
        logger.warn('Refusing non-YouTube caption URL', 'YouTubePage', {
            host: new URL(baseUrl, 'https://www.youtube.com').hostname,
        });
        throw new Error('Caption track URL is not a YouTube timedtext endpoint');
    }
    // Fetch the baseUrl as-is. YouTube returns timedtext XML by default
    // (either <text start="" dur=""> or <t s="" d=""> elements); the parser
    // handles both shapes. Avoid forcing fmt=srv3/json3, which changes the
    // element structure and can silently yield an empty parse.
    const response = await withTimeout(requestUrl({ url: baseUrl, method: 'GET' }), YOUTUBE_REQUEST_TIMEOUT_MS, signal);
    assertNotAborted(signal);
    return response.text;
}

/**
 * Fetch the watch page and return its parsed player response, or null.
 * Centralizes the page fetch + parse so callers don't repeat themselves.
 */
export async function fetchPlayerResponse(
    videoId: string,
    signal?: AbortSignal,
): Promise<ReturnType<typeof parsePlayerResponse>> {
    const html = await fetchYouTubePage(videoId, signal);
    return parsePlayerResponse(html);
}

/**
 * Reject a promise after `ms` — or as soon as `signal` aborts — so a hung
 * request cannot stall the pipeline.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
        if (signal) {
            if (signal.aborted) {
                reject(new RequestAbortedError());
            } else {
                onAbort = () => reject(new RequestAbortedError());
                signal.addEventListener('abort', onAbort, { once: true });
            }
        }
    });
    // If the fetch wins the race, the deadline rejection must stay handled.
    deadline.catch(() => undefined);

    try {
        return await Promise.race([promise, deadline]);
    } finally {
        if (timer) clearTimeout(timer);
        if (onAbort) signal?.removeEventListener('abort', onAbort);
    }
}

/** YouTube's innertube player endpoint. */
const INNERTUBE_PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';

/**
 * ANDROID client context. This client still serves player responses (caption
 * tracks included) without credentials, and needs no API key — so none is sent.
 *
 * PINNED VERSION: YouTube eventually retires old client versions and the
 * age-restriction fallback silently degrades to `restricted`. When that day
 * comes, bump INNERTUBE_ANDROID_CLIENT_VERSION — the warn log in
 * fetchInnertubePlayerResponse makes the degradation visible in the console.
 */
const INNERTUBE_ANDROID_CLIENT_VERSION = '19.09.37';
const INNERTUBE_ANDROID_CONTEXT = {
    context: {
        client: {
            clientName: 'ANDROID',
            clientVersion: INNERTUBE_ANDROID_CLIENT_VERSION,
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
        },
    },
};

/**
 * Ask YouTube's innertube player API for a video's player response.
 *
 * This is the age-restriction fallback: the watch page hides `captions` behind
 * an age/sign-in gate, while the ANDROID innertube client frequently returns
 * them without credentials. Thrown on any non-2xx or transport failure, so the
 * caller can fall back to its original (restricted) result.
 */
export async function fetchInnertubePlayerResponse(videoId: string): Promise<unknown> {
    const response = await withTimeout(
        requestUrl({
            url: INNERTUBE_PLAYER_ENDPOINT,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
            },
            body: JSON.stringify({
                ...INNERTUBE_ANDROID_CONTEXT,
                videoId,
            }),
        }),
        YOUTUBE_REQUEST_TIMEOUT_MS,
    );

    const json = response.json as unknown;
    if (!json || typeof json !== 'object') {
        throw new Error('innertube response was not a JSON object');
    }
    return json;
}
