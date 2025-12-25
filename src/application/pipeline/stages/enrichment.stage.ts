/**
 * Stage 3: Enrichment
 * Fetches video metadata, transcript, and thumbnail
 */

import { BaseStage } from '../stage';
import { PipelineContext, StageOutput } from '../types';

export interface EnrichmentInput {
  videoId: string;
  url: string;
}

export interface EnrichmentOutput extends StageOutput {
  videoData: any;
  transcript?: string;
  thumbnail?: string;
  cacheStatus: 'hit' | 'miss' | 'partial';
}

export class EnrichmentStage extends BaseStage {
  readonly name = 'enrichment';

  private cache: Map<string, any> = new Map();
  private cacheTTL = 30 * 60 * 1000; // 30 minutes

  constructor(
    private videoService?: any,
    private transcriptService?: any
  ) {
    super();
  }

  async execute(context: PipelineContext): Promise<EnrichmentOutput> {
    const input = context.input as EnrichmentInput;

    let cacheStatus: 'hit' | 'miss' | 'partial' = 'miss';
    let videoData: any;
    let transcript: string | undefined;
    let thumbnail: string | undefined;

    // Check cache for video data
    const videoDataKey = `video:${input.videoId}`;
    const cachedVideoData = this.getFromCache(videoDataKey);

    if (cachedVideoData) {
      videoData = cachedVideoData;
      cacheStatus = 'hit';
    } else if (this.videoService) {
      // Fetch from service
      try {
        videoData = await this.videoService.getVideoData(input.videoId);
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
      transcript = cachedTranscript;
    } else if (this.transcriptService) {
      try {
        const transcriptData = await this.transcriptService.getTranscript(input.videoId);
        if (transcriptData?.fullText) {
          transcript = transcriptData.fullText;
          this.setToCache(transcriptKey, transcript);
        }
      } catch (error) {
        // Transcript is optional, don't fail
        console.warn('Failed to fetch transcript:', error);
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
      cacheStatus
    };
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.timestamp) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheTTL) {
        return cached.data;
      } else {
        this.cache.delete(key);
      }
    }
    return null;
  }

  private setToCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  canExecute(context: PipelineContext): boolean {
    const input = context.input as EnrichmentInput;
    return !!(input && input.videoId);
  }

  getTimeout(): number {
    return 30000; // 30 seconds
  }

  async cleanup(): Promise<void> {
    this.cache.clear();
  }
}
