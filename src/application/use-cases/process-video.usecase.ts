/**
 * Use Case: Process Video
 * Encapsulates the business logic for processing a YouTube video
 */

import { PipelineOrchestrator } from '../pipeline';
import {
    IngestionStage,
    ValidationStage,
    EnrichmentStage,
    ProcessingStage,
    PersistenceStage,
} from '../pipeline/stages';

export interface ProcessVideoRequest {
  url: string;
  source?: 'clipboard' | 'protocol' | 'file-monitor' | 'extension' | 'manual';
  format?: string;
  customPrompt?: string;
  providerName?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  outputPath?: string;
}

export interface ProcessVideoResponse {
  success: boolean;
  filePath?: string;
  content?: string;
  provider?: string;
  model?: string;
  error?: string;
  metrics?: {
    totalTime: number;
    stageTimes: Record<string, number>;
  };
}

/**
 * Use case class for processing videos
 * This provides a clean interface for the UI layer
 */
export class ProcessVideoUseCase {
    private pipeline: PipelineOrchestrator;

    constructor(
    private dependencies: {
      videoService?: any;
      transcriptService?: any;
      aiService?: any;
      fileService?: any;
      promptService?: any;
    }
    ) {
    // Initialize pipeline with all stages
        this.pipeline = new PipelineOrchestrator({
            continueOnError: false,
            maxRetries: 2,
        });

        // Register stages
        this.pipeline
            .registerStage(new IngestionStage())
            .registerStage(new ValidationStage())
            .registerStage(new EnrichmentStage(
                dependencies.videoService,
                dependencies.transcriptService
            ))
            .registerStage(new ProcessingStage(
                dependencies.aiService,
                dependencies.promptService
            ))
            .registerStage(new PersistenceStage(
                dependencies.fileService
            ));
    }

    /**
   * Execute the use case
   */
    async execute(request: ProcessVideoRequest): Promise<ProcessVideoResponse> {
        try {
            const result = await this.pipeline.execute(
                {
                    source: request.source || 'manual',
                    rawInput: request.url,
                    format: request.format,
                    customPrompt: request.customPrompt,
                    providerName: request.providerName,
                    model: request.model,
                    maxTokens: request.maxTokens,
                    temperature: request.temperature,
                    outputPath: request.outputPath,
                },
                {
                    source: request.source || 'manual',
                }
            );

            if (result.success) {
                // Extract results from stages
                const persistenceStage = result.history.find(h => h.stage === 'persistence');
                const processingStage = result.history.find(h => h.stage === 'processing');

                return {
                    success: true,
                    filePath: persistenceStage?.output?.filePath,
                    content: processingStage?.output?.generatedContent,
                    provider: processingStage?.output?.provider,
                    model: processingStage?.output?.model,
                    metrics: {
                        totalTime: result.metrics.totalTime,
                        stageTimes: result.metrics.stageTimes,
                    },
                };
            } else {
                const failedStage = result.history.find(h => h.status === 'failed');
                return {
                    success: false,
                    error: failedStage?.error?.message || 'Processing failed',
                };
            }
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message,
            };
        }
    }

    /**
   * Update pipeline configuration
   */
    updateDependencies(dependencies: Partial<typeof this.dependencies>): void {
        Object.assign(this.dependencies, dependencies);

        // Recreate pipeline with new dependencies
        this.pipeline.clearStages();
        this.pipeline
            .registerStage(new IngestionStage())
            .registerStage(new ValidationStage())
            .registerStage(new EnrichmentStage(
                this.dependencies.videoService,
                this.dependencies.transcriptService
            ))
            .registerStage(new ProcessingStage(
                this.dependencies.aiService,
                this.dependencies.promptService
            ))
            .registerStage(new PersistenceStage(
                this.dependencies.fileService
            ));
    }

    /**
   * Cleanup
   */
    async cleanup(): Promise<void> {
        await this.pipeline.cleanup();
    }
}
