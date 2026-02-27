/**
 * Video Processor Service
 * Handles the core video processing logic extracted from main.ts
 */

import { Notice } from 'obsidian';
import { ConflictPrevention } from '../conflict-prevention';
import { ErrorHandler } from './error-handler';
import { logger } from './logger';
import { MESSAGES } from '../constants/index';
import { ValidationUtils } from '../validation';
import { ServiceContainer } from './service-container';
import { OutputFormat, YouTubePluginSettings, AIResponse } from '../types';

/** Options for processing a video */
export interface ProcessVideoOptions {
    url: string;
    format?: OutputFormat;
    providerName?: string;
    model?: string;
    performanceMode?: string;
    enableParallel?: boolean;
    preferMultimodal?: boolean;
    maxTokens?: number;
    temperature?: number;
    enableAutoFallback?: boolean;
}

/** Video processor result */
export interface VideoProcessResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

/**
 * Handles YouTube video processing
 */
export class VideoProcessor {
    constructor(
        private getSettings: () => YouTubePluginSettings,
        private getServiceContainer: () => ServiceContainer | undefined,
        private isUnloading: () => boolean,
    ) {}

    /**
     * Process a YouTube video
     */
    async process(options: ProcessVideoOptions): Promise<string> {
        const {
            url,
            format = 'step-by-step-tutorial',
            providerName,
            model,
            maxTokens,
            temperature,
            enableAutoFallback,
        } = options;

        if (this.isUnloading()) {
            ConflictPrevention.log('Plugin is unloading, cancelling video processing');
            throw new Error('Plugin is shutting down');
        }

        const settings = this.getSettings();
        const serviceContainer = this.getServiceContainer();

        return ConflictPrevention.safeOperation(async () => {
            new Notice(MESSAGES.PROCESSING);

            const validation = ValidationUtils.validateSettings(settings);
            if (!validation.isValid) {
                throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`);
            }

            if (!serviceContainer) {
                throw new Error('Service container not initialized');
            }

            const result = await this.doProcess(options, settings, serviceContainer);
            return result;
        }, 'YouTube Video Processing');
    }

    /**
     * Internal processing logic
     */
    // eslint-disable-next-line max-lines-per-function
    private async doProcess(
        options: ProcessVideoOptions,
        settings: YouTubePluginSettings,
        serviceContainer: ServiceContainer,
    ): Promise<string> {
        const {
            url,
            format = 'step-by-step-tutorial',
            providerName,
            model,
            maxTokens,
            temperature,
            enableAutoFallback,
        } = options;

        const youtubeService = serviceContainer.videoService;
        const aiService = serviceContainer.aiService;
        const fileService = serviceContainer.fileService;
        const promptService = serviceContainer.promptService;

        const videoId = youtubeService.extractVideoId(url);
        if (!videoId) {
            throw new Error(MESSAGES.ERRORS.VIDEO_ID_EXTRACTION);
        }

        const videoData = await youtubeService.getVideoData(videoId);

        // Fetch transcript
        const transcript = await this.fetchTranscript(youtubeService, videoId);

        const prompt = promptService.createAnalysisPrompt({
            videoData,
            videoUrl: url,
            format,
            transcript,
        });

        logger.aiService('Processing video', {
            videoId,
            format,
            provider: providerName ?? 'Auto',
            model: model ?? 'Default',
            maxTokens: maxTokens ?? 2048,
            temperature: temperature ?? 0.7,
        });

        // Set model parameters on providers
        this.configureProviders(aiService, maxTokens, temperature);

        // Get AI response
        const aiResponse = await this.getAIResponse(
            aiService,
            prompt,
            providerName,
            model,
            enableAutoFallback,
        );

        const formattedContent = promptService.processAIResponse(
            aiResponse.content,
            aiResponse.provider,
            aiResponse.model,
            format,
            videoData,
            url,
        );

        const filePath = await fileService.saveToFile(videoData.title, formattedContent, settings.outputPath);

        new Notice(MESSAGES.SUCCESS(videoData.title));
        return filePath;
    }

    /**
     * Fetch video transcript
     */
    private async fetchTranscript(
        youtubeService: { extractVideoId(url: string): string | null; getVideoData(videoId: string): Promise<{ title: string }>; getTranscript?: (videoId: string) => Promise<{ fullText: string } | null> },
        videoId: string,
    ): Promise<string | undefined> {
        try {
            if (youtubeService.getTranscript) {
                const transcriptData = await youtubeService.getTranscript(videoId);
                if (transcriptData?.fullText) {
                    logger.info('Transcript fetched successfully', 'VideoProcessor', {
                        videoId,
                        transcriptLength: transcriptData.fullText.length,
                    });
                    return transcriptData.fullText;
                } else {
                    logger.debug('No transcript available for this video', 'VideoProcessor', { videoId });
                }
            }
        } catch (error) {
            logger.debug('Could not fetch transcript, continuing without it', 'VideoProcessor', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return undefined;
    }

    /**
     * Configure providers with model parameters
     */
    private configureProviders(
        aiService: unknown,
        maxTokens?: number,
        temperature?: number,
    ): void {
        const providers =
            (
                aiService as {
                    providers?: Array<{
                        setMaxTokens?(tokens: number): void;
                        setTemperature?(temp: number): void;
                    }>;
                }
            ).providers ?? [];

        for (const provider of providers) {
            if (maxTokens && provider.setMaxTokens) {
                provider.setMaxTokens(maxTokens);
            }
            if (temperature !== undefined && provider.setTemperature) {
                provider.setTemperature(temperature);
            }
        }
    }

    /**
     * Get AI response with proper error handling
     */
    private async getAIResponse(
        aiService: { process(prompt: string): Promise<AIResponse> },
        prompt: string,
        providerName?: string,
        model?: string,
        enableAutoFallback?: boolean,
    ): Promise<AIResponse> {
        try {
            if (providerName) {
                const shouldFallback = enableAutoFallback ?? true;
                return await (
                    aiService as {
                        processWith(
                            provider: string,
                            prompt: string,
                            model?: string,
                            images?: string[],
                            enableFallback?: boolean,
                        ): Promise<AIResponse>;
                    }
                ).processWith(providerName, prompt, model, undefined, shouldFallback);
            } else {
                return await aiService.process(prompt);
            }
        } catch (error) {
            logger.error('AI Processing failed', 'VideoProcessor', {
                error: error instanceof Error ? error.message : String(error),
            });

            if (error instanceof Error) {
                ErrorHandler.handleEnhanced(error, 'AI Processing');
            }
            throw error;
        }
    }
}
