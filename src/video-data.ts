import { API_ENDPOINTS } from './ai/api';
import { ErrorHandler } from './services/error-handler';
import { MESSAGES } from './constants/index';
import { ValidationUtils } from './validation';
import { TranscriptOutcome, VideoDataService, VideoData, CacheService, YouTubePluginSettings } from './types';
import { YouTubeTranscriptService } from './services/transcript-service';
import { TranscriptDiskCache } from './services/transcript-cache';
import {
    assertNotAborted,
    extractVideoDetails,
    fetchYouTubePage,
    parsePlayerResponse,
    RequestAbortedError,
} from './services/youtube-page';
import { logger } from './services/logger';

/**
 * YouTube video data extraction service
 */

export interface EnhancedVideoData extends VideoData {
    duration?: number;
    thumbnail?: string;
    channelName?: string;
    publishedAt?: string;
}

/**
 * Metadata as either source (oEmbed or the watch-page scrape) returns it.
 * Only `title` is guaranteed; {@link YouTubeVideoService.getVideoData} fills in
 * the placeholders for everything else.
 */
type VideoMetadata = {
    title: string;
    description?: string;
    duration?: number;
    thumbnail?: string;
    channelName?: string;
    publishedAt?: string;
};

/** Map a non-2xx oEmbed status to the error the user should see. */
function oembedStatusError(videoId: string, status: number): Error {
    if (status === 400) {
        return new Error(`Invalid YouTube video ID: ${videoId}. Please check the URL and try again.`);
    }
    if (status === 401) {
        // 401 from oEmbed usually means age-restricted or sign-in required.
        return new Error(`YouTube would not serve metadata for ${videoId} (age-restricted or sign-in required).`);
    }
    if (status === 404) {
        return new Error(
            `YouTube video not found: ${videoId}. The video may be private, deleted, or the ID is incorrect.`,
        );
    }
    if (status === 403) {
        return new Error(`Access denied to YouTube video: ${videoId}. The video may be private or restricted.`);
    }
    return new Error(MESSAGES.ERRORS.FETCH_VIDEO_DATA(status));
}

/** Optional wiring the service container supplies. */
export interface VideoServiceOptions {
    /** Live settings accessor so toggles (e.g. the disk cache) apply immediately. */
    getSettings?: () => YouTubePluginSettings | undefined;
    /** On-disk transcript cache; only consulted when settings.persistTranscriptCache is on. */
    diskCache?: TranscriptDiskCache;
}

export class YouTubeVideoService implements VideoDataService {
    private readonly metadataTTL = 1000 * 60 * 30; // 30 minutes
    public transcriptService: YouTubeTranscriptService;
    private diskCache?: TranscriptDiskCache;

    constructor(
        private cache?: CacheService,
        options: VideoServiceOptions = {},
    ) {
        this.diskCache = options.diskCache;
        this.transcriptService = new YouTubeTranscriptService(cache, {
            diskCache: this.diskCache,
            getSettings: options.getSettings,
        });
    }

    /**
     * Get transcript for a video (public method for external access)
     */
    async getTranscript(
        videoId: string,
        language?: string,
        signal?: AbortSignal,
    ): Promise<{ fullText: string } | null> {
        try {
            const transcript = await this.transcriptService.getTranscript(videoId, language, signal);
            return transcript ? { fullText: transcript.fullText } : null;
        } catch (error) {
            // A cancelled run unwinds as a cancellation, not as "no transcript".
            if (error instanceof RequestAbortedError) throw error;
            logger.debug('Transcript fetch failed', 'VideoData', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Typed transcript fetch: success carries segments + language, failure
     * carries a machine-readable reason (restricted / private / unavailable /
     * no-captions / network) so the UI can explain what happened.
     */
    async fetchTranscriptOutcome(videoId: string, language?: string, signal?: AbortSignal): Promise<TranscriptOutcome> {
        return this.transcriptService.fetchTranscriptOutcome(videoId, language, signal);
    }

    /**
     * Delete every persisted transcript. Intended for an explicit settings
     * action — not for plugin unload, which would defeat the cache's purpose.
     */
    async clearTranscriptCache(): Promise<void> {
        await this.diskCache?.clear();
    }

    /**
     * Extract video ID from YouTube URL
     */
    extractVideoId(url: string): string | null {
        return ValidationUtils.extractVideoId(url);
    }

    /**
     * Get video metadata and description
     *
     * Optional run `signal` — a cancelled run stops at the next network
     * boundary instead of finishing the fetch.
     */
    async getVideoData(videoId: string, signal?: AbortSignal): Promise<VideoData> {
        if (!videoId) {
            throw new Error('Video ID is required');
        }
        assertNotAborted(signal);

        const cacheKey = this.getCacheKey('video-data', videoId);
        const cached = this.cache?.get<VideoData>(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const metadata = await this.getVideoMetadata(videoId, signal);

            // Enhanced video data with optimization info
            const result: EnhancedVideoData = {
                title: metadata.title ?? 'Unknown Title',
                description: metadata.description ?? 'No description available',
                duration: metadata.duration,
                thumbnail: metadata.thumbnail,
                channelName: metadata.channelName,
                publishedAt: metadata.publishedAt,
            };

            // Cache a copy, never the handed-out object: the caller owns `result`
            // and is free to mutate it.
            this.cache?.set(cacheKey, { ...result }, this.metadataTTL);
            return result;
        } catch (error) {
            // A cancelled run unwinds as a cancellation, not as a friendly error.
            if (error instanceof RequestAbortedError) throw error;
            throw ErrorHandler.createUserFriendlyError(error as Error, 'fetch video data');
        }
    }

    /**
     * Video metadata: YouTube's oEmbed API, enriched by a watch-page scrape.
     *
     * oEmbed fails often enough (age gates return 401, private videos 403/404,
     * plain network hiccups) for it to be a single point of failure, so *every*
     * oEmbed failure falls back to the watch-page scrape. Only when both paths
     * fail is the run aborted — with the oEmbed error, which is the more
     * specific of the two.
     */
    // eslint-disable-next-line complexity
    private async getVideoMetadata(videoId: string, signal?: AbortSignal): Promise<VideoMetadata> {
        const cacheKey = this.getCacheKey('metadata', videoId);
        const cached = this.cache?.get<VideoMetadata>(cacheKey);
        if (cached) {
            return cached;
        }

        let oembedError: unknown;
        try {
            const metadata = await this.fetchOembedMetadata(videoId, signal);
            this.cache?.set(cacheKey, metadata, this.metadataTTL);
            return metadata;
        } catch (error) {
            if (error instanceof RequestAbortedError) throw error;
            oembedError = error;
            logger.warn('oEmbed metadata failed — falling back to the watch-page scrape', 'VideoData', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        try {
            const pageData = await this.scrapeAdditionalMetadata(videoId, signal);
            if (pageData.description ?? pageData.duration ?? pageData.publishedAt ?? pageData.title) {
                const metadata = {
                    title: pageData.title ?? `YouTube Video (${videoId})`,
                    description: pageData.description,
                    duration: pageData.duration,
                    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    channelName: pageData.channelName,
                    publishedAt: pageData.publishedAt,
                };
                this.cache?.set(cacheKey, metadata, this.metadataTTL);
                return metadata;
            }
            logger.warn('Watch-page scrape returned no usable metadata', 'VideoData', { videoId });
        } catch (error) {
            if (error instanceof RequestAbortedError) throw error;
            logger.warn('Metadata scrape failed', 'VideoData', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        // Both paths failed — surface the more descriptive of the two errors.
        throw oembedError instanceof Error ? oembedError : new Error(MESSAGES.ERRORS.NETWORK_ERROR);
    }

    /**
     * Fetch metadata from YouTube's oEmbed API, enriched with whatever the
     * watch-page scrape adds (description, duration, publish date).
     */
    private async fetchOembedMetadata(videoId: string, signal?: AbortSignal): Promise<VideoMetadata> {
        const oembedUrl = `${API_ENDPOINTS.YOUTUBE_OEMBED}?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

        try {
            const response = await this.fetchOembed(oembedUrl, signal);

            if (!response.ok) {
                throw oembedStatusError(videoId, response.status);
            }

            const data = await response.json();

            let enhancedData: {
                title: string;
                thumbnail?: string;
                author_name: string;
                description?: string;
                duration?: number;
                publishedAt?: string;
            } = {
                title: data.title || 'Unknown Title',
                thumbnail: data.thumbnail_url,
                author_name: data.author_name,
            };

            // Try to get duration and description from page scraping
            const pageData = await this.scrapeAdditionalMetadata(videoId, signal);
            enhancedData = { ...enhancedData, ...pageData };

            return {
                title: enhancedData.title,
                description: enhancedData.description,
                duration: enhancedData.duration,
                thumbnail: enhancedData.thumbnail,
                channelName: enhancedData.author_name,
                publishedAt: enhancedData.publishedAt,
            };
        } catch (error) {
            // A cancelled run is a cancellation, never a timeout or network error.
            if (signal?.aborted) throw new RequestAbortedError();

            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your internet connection and try again.');
            } else if (error instanceof TypeError) {
                throw new Error(MESSAGES.ERRORS.NETWORK_ERROR);
            } else if (error instanceof Error && error.message.includes('JSON')) {
                throw new Error('Failed to parse YouTube response. The service may be temporarily unavailable.');
            }
            throw error;
        }
    }

    /**
     * GET `oembedUrl` under a 15s timeout. A cancelled run aborts the request
     * too, not just the timer.
     */
    private async fetchOembed(oembedUrl: string, signal?: AbortSignal): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const onAbort = () => controller.abort();
        signal?.addEventListener('abort', onAbort, { once: true });

        try {
            return await fetch(oembedUrl, {
                headers: {
                    'User-Agent': 'Obsidian YoutubeClipper Plugin',
                },
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId); // Clear timeout if request completes
            signal?.removeEventListener('abort', onAbort);
        }
    }

    /**
     * Scrape additional metadata from YouTube page via the shared, proxy-free parser.
     *
     * Returns an empty object when the page cannot be fetched or parsed —
     * callers decide whether that is fatal. Abort errors are never swallowed.
     */
    private async scrapeAdditionalMetadata(
        videoId: string,
        signal?: AbortSignal,
    ): Promise<{
        title?: string;
        description?: string;
        duration?: number;
        channelName?: string;
        publishedAt?: string;
    }> {
        try {
            const html = await fetchYouTubePage(videoId, signal);
            const playerResponse = parsePlayerResponse(html);
            if (!playerResponse) return {};
            const details = extractVideoDetails(playerResponse);
            // Only the fields the page actually supplied: callers merge this over
            // other sources, and an explicit `undefined` would clobber them.
            const pageData: {
                title?: string;
                description?: string;
                duration?: number;
                channelName?: string;
                publishedAt?: string;
            } = {};
            if (details.title !== undefined) pageData.title = details.title;
            if (details.description !== undefined) pageData.description = details.description;
            if (details.duration !== undefined) pageData.duration = details.duration;
            if (details.channelName !== undefined) pageData.channelName = details.channelName;
            if (details.publishedAt !== undefined) pageData.publishedAt = details.publishedAt;
            return pageData;
        } catch (error) {
            if (error instanceof RequestAbortedError) throw error;
            logger.debug('Metadata scrape failed', 'VideoData', {
                videoId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {};
        }
    }

    private getCacheKey(namespace: string, videoId: string): string {
        return `youtube-video-service:${namespace}:${videoId}`;
    }
}
