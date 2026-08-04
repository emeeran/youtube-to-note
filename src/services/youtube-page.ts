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

const PAGE_TIMEOUT_MS = 20000;
const CAPTION_TIMEOUT_MS = 20000;

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

/** Fetch the raw HTML of a YouTube watch page without any CORS proxy. */
export async function fetchYouTubePage(videoId: string): Promise<string> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
            // A normal browser UA avoids YouTube's "unsupported browser" shells.
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });
    return response.text;
}

/**
 * Extract and parse the `ytInitialPlayerResponse` object from watch-page HTML.
 * Uses brace balancing that respects string literals, so braces inside strings
 * or regex do not prematurely terminate the object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePlayerResponse(html: string): any | null {
    const marker = 'ytInitialPlayerResponse';
    const markerIdx = html.indexOf(marker);
    if (markerIdx === -1) return null;

    const start = html.indexOf('{', markerIdx);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < html.length; i++) {
        const ch = html[i];
        if (inString) {
            if (escape) {
                escape = false;
            } else if (ch === '\\') {
                escape = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
        } else if (ch === '{') {
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
    }
    return null;
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

/** Fetch the raw caption payload (timedtext XML) for a caption track. */
export async function fetchCaptionContent(baseUrl: string): Promise<string> {
    // Fetch the baseUrl as-is. YouTube returns timedtext XML by default
    // (either <text start="" dur=""> or <t s="" d=""> elements); the parser
    // handles both shapes. Avoid forcing fmt=srv3/json3, which changes the
    // element structure and can silently yield an empty parse.
    const response = await requestUrl({ url: baseUrl, method: 'GET' });
    return response.text;
}

/**
 * Fetch the watch page and return its parsed player response, or null.
 * Centralizes the page fetch + parse so callers don't repeat themselves.
 */
export async function fetchPlayerResponse(videoId: string): Promise<ReturnType<typeof parsePlayerResponse>> {
    const html = await fetchYouTubePage(videoId);
    return parsePlayerResponse(html);
}

export { PAGE_TIMEOUT_MS, CAPTION_TIMEOUT_MS };
