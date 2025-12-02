/**
 * Video Processor - Single Responsibility: Video processing logic
 * Handles video validation, processing, and file operations
 */

import { App, TFile, Notice } from 'obsidian';
import { logger } from '../services/logger';
import { MESSAGES } from '../constants/messages';
import { ConflictPrevention } from '../conflict-prevention';
import { ValidationUtils } from '../lib/utils-consolidated';
import { OutputFormat } from '../types';

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
            const aiService = this.serviceContainer?.aiService;
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
            // Get video service
            const videoService = this.serviceContainer?.videoService;
            if (!videoService) {
                throw new Error('Video service not available');
            }

            // Extract video ID and get video data
            const videoId = ValidationUtils.extractVideoId(options.url);
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }

            const videoData = await videoService.getVideoData(videoId);

            // Create prompt for AI analysis
            const prompt = options.customPrompt || `Analyze this YouTube video and provide a comprehensive summary including:
1. Main topics and key points
2. Important insights or takeaways
3. Practical applications or action items
4. Target audience and skill level

Video: ${videoData.title}
Description: ${videoData.description}

URL: ${options.url}`;

            // Process with AI service
            const aiResponse = await aiService.process(prompt);

            // Generate filename and content
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const sanitizedTitle = videoData.title.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50);
            const fileName = `${sanitizedTitle}-${timestamp}.md`;

            const outputPath = options.outputPath || this.settings.outputPath || 'YouTube/Processed Videos';
            const filePath = `${outputPath}/${fileName}`;

            // Create markdown content
            const content = `# ${videoData.title}

**Video URL:** ${options.url}
**Processed:** ${new Date().toLocaleString()}

## Summary

${aiResponse.content}

## Video Metadata

- **Duration:** ${videoData.duration || 'Unknown'}
- **Channel:** ${videoData.channelName || 'Unknown'}
- **Published:** ${videoData.publishedAt || 'Unknown'}

---

*Generated by YouTube Clipper Plugin*
`;

            // Save file using Obsidian file service
            const fileService = this.serviceContainer?.fileService;
            if (fileService) {
                await fileService.createFile(filePath, content);
            } else {
                // Fallback: create file directly
                await this.app.vault.create(filePath, content);
            }

            return {
                success: true,
                filePath,
                fileName
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