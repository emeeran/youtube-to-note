/**
 * Video Processor - Single Responsibility: Video processing logic
 * Handles video validation, processing, and file operations
 */

import { App, TFile, Notice } from 'obsidian';
import { logger } from '../services/logger';
import { MESSAGES } from '../constants';
import { ConflictPrevention } from '../conflict-prevention';
import { ValidationUtils } from '../lib/utils-consolidated';
import { OutputFormat } from '../types/types';

export interface VideoProcessingOptions {
    url: string;
    outputPath?: string;
    outputFormat?: OutputFormat;
    customPrompt?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface ProcessingResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
}

export class VideoProcessor {
    private activeOperations = new Map<string, AbortController>();

    constructor(
        private app: App,
        private serviceContainer: any, // ServiceContainer from services
        private settings: any // YouTubePluginSettings from types
    ) {}

    /**
     * Process a YouTube video
     */
    async processVideo(options: VideoProcessingOptions): Promise<ProcessingResult> {
        const operationId = this.generateOperationId(options.url);
        const abortController = new AbortController();
        this.activeOperations.set(operationId, abortController);

        try {
            logger.info('Starting video processing', 'VideoProcessor', {
                url: options.url,
                operationId
            });

            // Validate YouTube URL
            const videoId = ValidationUtils.extractVideoId(options.url);
            if (!videoId) {
                return {
                    success: false,
                    error: MESSAGES.ERRORS.INVALID_URL
                };
            }

            // Get AI service
            const aiService = this.serviceContainer?.get('aiService');
            if (!aiService) {
                return {
                    success: false,
                    error: 'AI service not available'
                };
            }

            // Process video with AI service
            const result = await this.processWithAI(aiService, options, abortController.signal);

            if (result.success && result.filePath) {
                await this.openFile(result.filePath);
                new Notice(MESSAGES.SUCCESS(result.fileName || 'Video'));
            }

            logger.info('Video processing completed', 'VideoProcessor', {
                operationId,
                success: result.success
            });

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Video processing failed', 'VideoProcessor', {
                error: errorMessage,
                operationId
            });

            new Notice(MESSAGES.ERRORS.AI_PROCESSING(errorMessage));
            return {
                success: false,
                error: errorMessage
            };
        } finally {
            this.activeOperations.delete(operationId);
        }
    }

    /**
     * Cancel an active operation
     */
    cancelOperation(operationId: string): boolean {
        const controller = this.activeOperations.get(operationId);
        if (controller) {
            controller.abort();
            this.activeOperations.delete(operationId);
            logger.info('Operation cancelled', 'VideoProcessor', { operationId });
            return true;
        }
        return false;
    }

    /**
     * Cancel all active operations
     */
    cancelAllOperations(): void {
        for (const [operationId, controller] of this.activeOperations) {
            controller.abort();
            logger.info('Operation cancelled', 'VideoProcessor', { operationId });
        }
        this.activeOperations.clear();
        logger.info('All operations cancelled', 'VideoProcessor');
    }

    /**
     * Get count of active operations
     */
    getActiveOperationCount(): number {
        return this.activeOperations.size;
    }

    private async processWithAI(
        aiService: any,
        options: VideoProcessingOptions,
        signal: AbortSignal
    ): Promise<ProcessingResult> {
        return await ConflictPrevention.safeOperation(async () => {
            const videoData = await aiService.processVideo(
                options.url,
                {
                    customPrompt: options.customPrompt,
                    maxTokens: options.maxTokens || this.settings.defaultMaxTokens,
                    temperature: options.temperature || this.settings.defaultTemperature,
                    outputPath: options.outputPath || this.settings.outputPath,
                    outputFormat: options.outputFormat || 'markdown',
                    signal
                }
            );

            return {
                success: true,
                filePath: videoData.filePath,
                fileName: videoData.fileName
            };
        }, 'Video processing');
    }

    private async openFile(filePath: string): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(file);
            }
        } catch (error) {
            logger.warn('Failed to open processed file', 'VideoProcessor', {
                filePath,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private generateOperationId(url: string): string {
        return `video_${Date.now()}_${url.slice(-10)}`;
    }
}