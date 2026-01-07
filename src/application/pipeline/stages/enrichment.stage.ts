/**
 * Stage 3: Enrichment
 * Fetches video metadata, transcript, and thumbnail
 */

import { BaseStage } from '../stage';
import { PipelineContext, EnrichmentOutput } from '../types';
import { VideoDataService, EnhancedVideoData } from '../../../types';
import { logger } from '../../../services/logger';

export interface EnrichmentInput {
  videoId: string;
  url: string;
}

export interface TranscriptService {
  getTranscript(videoId: string): Promise<{ fullText: string } | null>;
}

export class EnrichmentStage extends BaseStage {
    readonly name = 'enrichment';

    private cache: Map<string, { data: EnhancedVideoData | string; timestamp: number }> = new Map();
    private cacheTTL = 30 * 60 * 1000; // 30 minutes

    constructor(
    private videoService?: VideoDataService,
    private transcriptService?: TranscriptService
    ) {
        super();
    }

    // eslint-disable-next-line complexity
    async execute(context: PipelineContext): Promise<EnrichmentOutput> {
        const input = context.input as EnrichmentInput;

        let cacheStatus: 'hit' | 'miss' | 'partial' = 'miss';
        let videoData: EnhancedVideoData;
        let transcript: string | undefined;
        let thumbnail: string | undefined;

        // Check cache for video data
        const videoDataKey = `video:${input.videoId}`;
        const cachedVideoData = this.getFromCache(videoDataKey);

        if (cachedVideoData) {
            videoData = cachedVideoData as EnhancedVideoData;
            cacheStatus = 'hit';
        } else if (this.videoService) {
            // Fetch from service
            try {
                videoData = await this.videoService.getVideoData(input.videoId) as EnhancedVideoData;
                this.setToCache(videoDataKey, videoData);
            } catch (error) {
                throw new Error(`Failed to fetch video data: ${(error as Error).message}`);
            }
        } else {
            throw new Error('Video service not available');
        }

        // Fetch transcript (optional)
        const transcriptKey = `transcript:${input.videoId}`;
        const cachedTranscript = this.getFromCache(transcriptKey);

        if (cachedTranscript) {
            transcript = cachedTranscript as string;
            if (cacheStatus === 'hit') cacheStatus = 'hit';
        } else if (this.transcriptService) {
            try {
                const transcriptData = await this.transcriptService.getTranscript(input.videoId);
                if (transcriptData?.fullText) {
                    transcript = transcriptData.fullText;
                    this.setToCache(transcriptKey, transcript);
                    if (cacheStatus === 'miss') cacheStatus = 'partial';
                }
            } catch (error) {
                // Transcript is optional, don't fail
                logger.warn('Failed to fetch transcript:', 'EnrichmentStage', { error });
            }
        }

        // Generate thumbnail URL
        if (input.videoId) {
            thumbnail = `https://img.youtube.com/vi/${input.videoId}/maxresdefault.jpg`;
        }

        return {
            videoData,
            transcript,
            thumbnail,
            cacheStatus,
        };
    }

    private getFromCache(key: string): EnhancedVideoData | string | null {
        const cached = this.cache.get(key);
        if (cached?.timestamp) {
            const age = Date.now() - cached.timestamp;
            if (age < this.cacheTTL) {
                return cached.data;
            } else {
                this.cache.delete(key);
            }
        }
        return null;
    }

    private setToCache(key: string, data: EnhancedVideoData | string): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    canExecute(context: PipelineContext): boolean {
        const input = context.input as EnrichmentInput;
        return !!(input?.videoId);
    }

    getTimeout(): number {
        return 30000; // 30 seconds
    }

    async cleanup(): Promise<void> {
        this.cache.clear();
    }
}
