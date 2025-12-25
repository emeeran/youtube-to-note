/**
 * Use Case: Batch Process Videos
 * Handles processing multiple videos in sequence
 */

import { ProcessVideoUseCase, ProcessVideoRequest } from './process-video.usecase';

export interface BatchProcessRequest {
  videos: ProcessVideoRequest[];
  concurrency?: number;
  onProgress?: (completed: number, total: number, current: string) => void;
}

export interface BatchProcessResponse {
  success: boolean;
  results: Array<{
    url: string;
    success: boolean;
    filePath?: string;
    error?: string;
  }>;
  totalProcessed: number;
  totalFailed: number;
  totalTime: number;
}

/**
 * Use case for batch processing multiple videos
 */
export class BatchProcessUseCase {
  constructor(
    private processVideoUseCase: ProcessVideoUseCase
  ) {}

  /**
   * Execute batch processing
   */
  async execute(request: BatchProcessRequest): Promise<BatchProcessResponse> {
    const startTime = performance.now();
    const results: BatchProcessResponse['results'] = [];
    let completedCount = 0;

    const concurrency = request.concurrency || 3;
    const videos = request.videos;

    // Process videos with concurrency control
    for (let i = 0; i < videos.length; i += concurrency) {
      const batch = videos.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (video) => {
          const result = await this.processVideoUseCase.execute(video);

          completedCount++;

          if (request.onProgress) {
            request.onProgress(completedCount, videos.length, video.url);
          }

          return {
            url: video.url,
            success: result.success,
            filePath: result.filePath,
            error: result.error
          };
        })
      );

      results.push(...batchResults);
    }

    const totalTime = performance.now() - startTime;

    return {
      success: results.every(r => r.success),
      results,
      totalProcessed: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      totalTime
    };
  }
}
