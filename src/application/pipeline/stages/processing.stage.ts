/**
 * Stage 4: Processing
 * AI-powered content generation with provider selection and fallback
 */

import { BaseStage } from '../stage';
import { PipelineContext, StageOutput } from '../types';

export interface ProcessingInput {
  videoData: Record<string, unknown>;
  transcript?: string;
  url: string;
  format?: string;
  customPrompt?: string;
  providerName?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProcessingOutput extends StageOutput {
  generatedContent: string;
  provider: string;
  model: string;
  metrics: {
    responseTime: number;
    tokenCount?: number;
  };
  fallbackChain: string[];
}

interface AIServiceInterface {
    process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<{
        content: string;
        provider: string;
        model: string;
    }>;
    processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[]
    ): Promise<{
        content: string;
        provider: string;
        model: string;
    }>;
}

interface PromptServiceInterface {
    createAnalysisPrompt(options: {
        videoData: Record<string, unknown>;
        videoUrl: string;
        format?: string;
        customPrompt?: string;
        transcript?: string;
    }): string;
}

export class ProcessingStage extends BaseStage {
    readonly name = 'processing';

    constructor(
    private aiService?: AIServiceInterface,
    private promptService?: PromptServiceInterface
    ) {
        super();
    }

    async execute(context: PipelineContext): Promise<ProcessingOutput> {
        const startTime = performance.now();
        const input = context.input as ProcessingInput;

        if (!this.aiService) {
            throw new Error('AI service not available');
        }

        // Create prompt
        const prompt = await this.createPrompt(input);

        // Set model parameters if provided
        if (input.maxTokens ?? input.temperature !== undefined) {
            this.setModelParameters(input.maxTokens, input.temperature);
        }

        // Process with AI
        let aiResponse;
        try {
            if (input.providerName) {
                // Use specific provider
                aiResponse = await this.aiService.processWith(
                    input.providerName,
                    prompt,
                    input.model,
                    undefined,
                    true // enable fallback
                );
            } else {
                // Use auto-selection
                aiResponse = await this.aiService.process(prompt);
            }
        } catch (error) {
            throw new Error(`AI processing failed: ${(error as Error).message}`);
        }

        const responseTime = performance.now() - startTime;

        return {
            generatedContent: aiResponse.content,
            provider: aiResponse.provider,
            model: aiResponse.model,
            metrics: {
                responseTime,
                tokenCount: aiResponse.content?.length || 0,
            },
            fallbackChain: aiResponse.fallbackChain || [],
        };
    }

    private async createPrompt(input: ProcessingInput): Promise<string> {
        if (!this.promptService) {
            throw new Error('Prompt service not available');
        }

        const format = input.format ?? 'detailed-guide';

        return this.promptService.createAnalysisPrompt({
            videoData: input.videoData,
            videoUrl: input.url,
            format,
            customPrompt: input.customPrompt,
            transcript: input.transcript,
        });
    }

    private setModelParameters(maxTokens?: number, temperature?: number): void {
        if (!this.aiService) return;

        // Set model parameters on providers if available
        const providers = (this.aiService).providers || [];
        for (const provider of providers) {
            if (maxTokens && provider.setMaxTokens) {
                provider.setMaxTokens(maxTokens);
            }
            if (temperature !== undefined && provider.setTemperature) {
                provider.setTemperature(temperature);
            }
        }
    }

    canExecute(context: PipelineContext): boolean {
        const input = context.input as ProcessingInput;
        return !!(input?.videoData && input.url);
    }

    getTimeout(): number {
        return 120000; // 2 minutes for AI processing
    }
}
