/**
 * Use Case: Detect URL
 * Handles URL detection from various sources
 */

import { IngestionStage } from '../pipeline/stages';

export interface UrlDetectionRequest {
  source: 'clipboard' | 'protocol' | 'file-monitor' | 'extension' | 'manual';
  rawInput: string;
  sourceFile?: string;
}

export interface UrlDetectionResponse {
  detected: boolean;
  url?: string;
  source?: string;
  metadata?: {
    timestamp: number;
    sourceFile?: string;
  };
  error?: string;
}

/**
 * Use case for detecting URLs from various sources
 */
export class DetectUrlUseCase {
    private ingestionStage: IngestionStage;

    constructor() {
        this.ingestionStage = new IngestionStage();
    }

    /**
   * Execute URL detection
   */
    async execute(request: UrlDetectionRequest): Promise<UrlDetectionResponse> {
        try {
            const result = await this.ingestionStage.execute({
                input: request,
                currentStage: 'ingestion',
                stageHistory: [],
                metadata: {
                    pipelineId: 'detection',
                    timestamp: Date.now(),
                    source: request.source,
                    startTime: performance.now(),
                },
            });

            if (result.url) {
                return {
                    detected: true,
                    url: result.url,
                    source: result.source,
                    metadata: result.metadata,
                };
            } else {
                return {
                    detected: false,
                    error: 'No valid URL detected',
                };
            }
        } catch (error) {
            return {
                detected: false,
                error: (error as Error).message,
            };
        }
    }
}
