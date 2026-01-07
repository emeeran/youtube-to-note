/**
 * AI Service Adapter
 * Maintains backward compatibility while delegating to the new pipeline
 */

import { PipelineOrchestrator } from '../pipeline';
import {
    IngestionStage,
    ValidationStage,
    EnrichmentStage,
    ProcessingStage,
    PersistenceStage,
} from '../pipeline/stages';
import type { JsonObject } from '../../types/api-responses';

// Original interface from types.ts
interface AIResponse {
  content: string;
  provider: string;
  model: string;
}

// Service interfaces for type safety
interface AIServiceInterface {
    process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse>;
    processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[]
    ): Promise<AIResponse>;
    getProviderNames(): string[];
    getProviderModels(providerName: string): string[];
    fetchLatestModels(): Promise<Record<string, string[]>>;
    fetchLatestModelsForProvider(providerName: string): Promise<string[]>;
    hasAvailableProviders(): boolean;
    updateSettings(newSettings: unknown): void;
    getPerformanceMetrics(): JsonObject;
    cleanup?(): void;
}

interface VideoServiceInterface {
    extractVideoId(url: string): string | null;
    getVideoData(videoId: string): Promise<Record<string, unknown>>;
    getTranscript?(videoId: string): Promise<{ fullText: string } | null>;
    getPerformanceMetrics?(): JsonObject;
    cleanup?(): void;
}

interface TranscriptServiceInterface {
    getTranscript(videoId: string): Promise<{ fullText: string } | null>;
}

interface FileServiceInterface {
    saveToFile(title: string, content: string, outputPath: string): Promise<string>;
}

interface PromptServiceInterface {
    createAnalysisPrompt(options: {
        videoData: Record<string, unknown>;
        videoUrl: string;
        format?: string;
        customPrompt?: string;
        transcript?: string;
    }): string;
    processAIResponse(
        content: string,
        provider: string,
        model: string,
        format?: string,
        videoData?: Record<string, unknown>,
        videoUrl?: string
    ): string;
}

/**
 * Adapter class that mimics the original AIService interface
 * but delegates to the new pipeline architecture
 */
export class AIServiceAdapter {
    private pipeline: PipelineOrchestrator;

    constructor(
    private originalAIService: AIServiceInterface,
    private videoService?: VideoServiceInterface,
    private transcriptService?: TranscriptServiceInterface,
    private fileService?: FileServiceInterface,
    private promptService?: PromptServiceInterface
    ) {
    // Initialize pipeline with all 5 stages
        this.pipeline = new PipelineOrchestrator({
            continueOnError: false,
            maxRetries: 2,
            enableParallel: false,
        });

        // Register stages
        this.pipeline
            .registerStage(new IngestionStage())
            .registerStage(new ValidationStage())
            .registerStage(new EnrichmentStage(videoService, transcriptService))
            .registerStage(new ProcessingStage(originalAIService, promptService))
            .registerStage(new PersistenceStage(fileService));
    }

    /**
   * Main processing method - maintains original signature
   */
    async process(
        prompt: string,
        images?: (string | ArrayBuffer)[]
    ): Promise<AIResponse> {
    // This is a simplified adapter that uses the original AI service
    // for direct prompt processing (not the full pipeline)

        // For direct AI processing, use the original service
        const response = await this.originalAIService.process(prompt, images);

        return {
            content: response.content,
            provider: response.provider,
            model: response.model,
        };
    }

    /**
   * Process with specific provider - maintains original signature
   */
    async processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[],
        enableFallback: boolean = true
    ): Promise<AIResponse> {
        const response = await this.originalAIService.processWith(
            providerName,
            prompt,
            overrideModel,
            images,
            enableFallback
        );

        return {
            content: response.content,
            provider: response.provider,
            model: response.model,
        };
    }

    /**
   * Get provider names - maintains original signature
   */
    getProviderNames(): string[] {
        return this.originalAIService.getProviderNames();
    }

    /**
   * Get provider models - maintains original signature
   */
    getProviderModels(providerName: string): string[] {
        return this.originalAIService.getProviderModels(providerName);
    }

    /**
   * Fetch latest models - maintains original signature
   */
    async fetchLatestModels(): Promise<Record<string, string[]>> {
        return this.originalAIService.fetchLatestModels();
    }

    /**
   * Fetch models for specific provider - maintains original signature
   */
    async fetchLatestModelsForProvider(
        providerName: string,
        bypassCache?: boolean
    ): Promise<string[]> {
        return this.originalAIService.fetchLatestModelsForProvider(providerName, bypassCache);
    }

    /**
   * Check if providers are available - maintains original signature
   */
    hasAvailableProviders(): boolean {
        return this.originalAIService.hasAvailableProviders();
    }

    /**
   * Update settings - maintains original signature
   */
    updateSettings(newSettings: unknown): void {
        this.originalAIService.updateSettings(newSettings);
    }

    /**
   * Get performance metrics - maintains original signature
   */
    getPerformanceMetrics(): JsonObject {
        return this.originalAIService.getPerformanceMetrics();
    }

    /**
   * Cleanup - maintains original signature
   */
    cleanup(): void {
        this.originalAIService.cleanup();
        void this.pipeline.cleanup();
    }

    /**
   * New method: Process video through full pipeline
   * This is the new functionality that uses the 5-stage pipeline
   */
    // eslint-disable-next-line max-lines-per-function
    async processVideo(params: {
    url: string;
    source?: 'clipboard' | 'protocol' | 'file-monitor' | 'extension' | 'manual';
    format?: string;
    customPrompt?: string;
    providerName?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    outputPath?: string;
  }): Promise<{
    success: boolean;
    filePath?: string;
    content?: string;
    error?: string;
    metrics?: JsonObject;
  }> {
        try {
            const result = await this.pipeline.execute(
                {
                    source: params.source ?? 'manual',
                    rawInput: params.url,
                },
                {
                    source: params.source ?? 'manual',
                }
            );

            if (result.success) {
                // Extract file path from persistence stage output
                const persistenceStage = result.history.find(h => h.stage === 'persistence');
                const filePath = persistenceStage?.output?.filePath;

                // Extract generated content from processing stage
                const processingStage = result.history.find(h => h.stage === 'processing');
                const content = processingStage?.output?.generatedContent;

                return {
                    success: true,
                    filePath,
                    content,
                    metrics: result.metrics,
                };
            } else {
                const error = result.history.find(h => h.status === 'failed')?.error;
                return {
                    success: false,
                    error: error?.message || 'Pipeline execution failed',
                };
            }
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message,
            };
        }
    }
}
