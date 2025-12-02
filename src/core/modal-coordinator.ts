/**
 * Modal Coordinator - Single Responsibility: Modal management and coordination
 * Handles modal creation, configuration, and event coordination
 */

import { App, Notice } from 'obsidian';
import { logger } from '../services/logger';
import { YouTubeUrlModal } from '../components/features/youtube';
import { YouTubePluginSettings } from '../types/types';
import { VideoProcessingOptions } from './video-processor';

export interface ModalCoordinatorDependencies {
    app: App;
    settings: YouTubePluginSettings;
    serviceContainer: any;
    videoProcessor: any;
}

export interface ModalOptions {
    initialUrl?: string;
    autoProcess?: boolean;
}

export class ModalCoordinator {
    private activeModal?: YouTubeUrlModal;

    constructor(private dependencies: ModalCoordinatorDependencies) {}

    /**
     * Show YouTube URL modal
     */
    async showModal(options: ModalOptions = {}): Promise<void> {
        if (this.activeModal) {
            logger.warn('Modal already active', 'ModalCoordinator');
            return;
        }

        try {
            logger.info('Opening YouTube URL modal', 'ModalCoordinator', options);

            this.activeModal = new YouTubeUrlModal(
                this.dependencies.app,
                {
                    settings: this.dependencies.settings,
                    serviceContainer: this.dependencies.serviceContainer,
                    initialUrl: options.initialUrl,
                    onVideoProcess: async (processOptions: VideoProcessingOptions) => {
                        await this.handleVideoProcess(processOptions);
                    },
                    onModalClose: () => {
                        this.handleModalClose();
                    }
                }
            );

            this.activeModal.open();

            // Auto-process if requested
            if (options.autoProcess && options.initialUrl) {
                // Auto-process logic here
                logger.debug('Auto-processing video', 'ModalCoordinator', {
                    url: options.initialUrl
                });
            }

        } catch (error) {
            logger.error('Failed to open modal', 'ModalCoordinator', {
                error: error instanceof Error ? error.message : String(error)
            });
            this.activeModal = undefined;
            new Notice('Failed to open YouTube URL modal');
        }
    }

    /**
     * Close active modal
     */
    closeModal(): void {
        if (this.activeModal) {
            this.activeModal.close();
        }
    }

    /**
     * Check if modal is active
     */
    isModalActive(): boolean {
        return this.activeModal !== undefined;
    }

    /**
     * Update modal settings
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.dependencies.settings = newSettings;

        if (this.activeModal) {
            // Update active modal settings if it supports it
            logger.debug('Updated active modal settings', 'ModalCoordinator');
        }
    }

    /**
     * Handle video processing from modal
     */
    private async handleVideoProcess(options: VideoProcessingOptions): Promise<void> {
        try {
            const result = await this.dependencies.videoProcessor.processVideo(options);

            if (result.success) {
                new Notice(`Successfully processed: ${result.fileName}`);
            } else {
                new Notice(`Processing failed: ${result.error}`);
            }
        } catch (error) {
            logger.error('Video processing failed', 'ModalCoordinator', {
                error: error instanceof Error ? error.message : String(error)
            });
            new Notice('Video processing failed');
        }
    }

    /**
     * Handle modal close event
     */
    private handleModalClose(): void {
        logger.debug('Modal closed', 'ModalCoordinator');
        this.activeModal = undefined;
    }

    /**
     * Clean up modal coordinator
     */
    cleanup(): void {
        if (this.activeModal) {
            this.activeModal.close();
            this.activeModal = undefined;
        }

        logger.info('Modal coordinator cleaned up', 'ModalCoordinator');
    }
}