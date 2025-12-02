/**
 * Service Initializer - Single Responsibility: Service creation and management
 * Handles initialization, configuration, and cleanup of all plugin services
 */

import { App } from 'obsidian';
import { logger } from '../services/logger';
import { ServiceContainer } from '../services/service-container';
import { ModalManager } from '../services/modal-manager';
import { UrlHandler, UrlDetectionResult } from '../services/url-handler';
import { YouTubePluginSettings } from '../types';

export interface ServiceDependencies {
    settings: YouTubePluginSettings;
    app: App;
    urlDetectionCallback: (result: UrlDetectionResult) => void;
}

export class ServiceInitializer {
    private serviceContainer?: ServiceContainer;
    private modalManager?: ModalManager;
    private urlHandler?: UrlHandler;

    constructor(private dependencies: ServiceDependencies) {}

    /**
     * Initialize all services
     */
    async initializeServices(): Promise<void> {
        try {
            logger.info('Initializing services', 'ServiceInitializer');

            this.serviceContainer = new ServiceContainer(
                this.dependencies.settings,
                this.dependencies.app
            );

            this.modalManager = new ModalManager();
            this.urlHandler = new UrlHandler(
                this.dependencies.app,
                this.dependencies.settings,
                this.dependencies.urlDetectionCallback
            );

            logger.info('All services initialized successfully', 'ServiceInitializer');
        } catch (error) {
            logger.error('Failed to initialize services', 'ServiceInitializer', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Get service container instance
     */
    getServiceContainer(): ServiceContainer | undefined {
        return this.serviceContainer;
    }

    /**
     * Get modal manager instance
     */
    getModalManager(): ModalManager | undefined {
        return this.modalManager;
    }

    /**
     * Get URL handler instance
     */
    getUrlHandler(): UrlHandler | undefined {
        return this.urlHandler;
    }

    /**
     * Update service settings
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.dependencies.settings = newSettings;

        // Update service container settings
        if (this.serviceContainer) {
            this.serviceContainer.updateSettings(newSettings);
        }

        // Update URL handler settings
        if (this.urlHandler) {
            this.urlHandler.updateSettings(newSettings);
        }

        logger.info('Service settings updated', 'ServiceInitializer');
    }

    /**
     * Clean up all services
     */
    async cleanup(): Promise<void> {
        logger.info('Cleaning up services', 'ServiceInitializer');

        try {
            this.urlHandler?.clear();
            this.modalManager?.clear();
            this.serviceContainer?.clearServices();

            // Clear references
            this.urlHandler = undefined;
            this.modalManager = undefined;
            this.serviceContainer = undefined;

            logger.info('Services cleaned up successfully', 'ServiceInitializer');
        } catch (error) {
            logger.error('Error during service cleanup', 'ServiceInitializer', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}