/**
 * Plugin Lifecycle Manager - Single Responsibility: Plugin lifecycle management
 * Handles plugin loading, unloading, and core initialization
 */

import { Notice, Plugin } from 'obsidian';
import { logger, LogLevel } from '../services/logger';
import { ErrorHandler } from '../services/error-handler';
import { ServiceContainer } from '../services/service-container';

export interface PluginLifecycleConfig {
    version: string;
    prefix: string;
}

export class PluginLifecycleManager {
    private isInitialized = false;
    private isUnloading = false;

    constructor(
        private plugin: Plugin,
        private config: PluginLifecycleConfig
    ) {}

    /**
     * Initialize the plugin lifecycle
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.warn('Plugin already initialized', 'PluginLifecycleManager');
            return;
        }

        try {
            this.setPluginVersion();
            await this.setupLogger();
            this.isInitialized = true;

            logger.info(`Plugin lifecycle initialized - v${this.config.version}`, 'PluginLifecycleManager');
        } catch (error) {
            logger.error('Failed to initialize plugin lifecycle', 'PluginLifecycleManager', {
                error: error instanceof Error ? error.message : String(error)
            });
            ErrorHandler.handle(error as Error, 'Plugin lifecycle initialization');
            throw error;
        }
    }

    /**
     * Clean up plugin lifecycle
     */
    async cleanup(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        this.isUnloading = true;
        logger.info('Starting plugin cleanup', 'PluginLifecycleManager');

        try {
            // Cleanup will be handled by specific managers
            this.isInitialized = false;
            logger.info('Plugin lifecycle cleaned up successfully', 'PluginLifecycleManager');
        } catch (error) {
            logger.error('Error during plugin cleanup', 'PluginLifecycleManager', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Check if plugin is currently unloading
     */
    isPluginUnloading(): boolean {
        return this.isUnloading;
    }

    /**
     * Check if plugin is initialized
     */
    isPluginInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Get plugin configuration
     */
    getConfig(): PluginLifecycleConfig {
        return { ...this.config };
    }

    private setPluginVersion(): void {
        this.plugin.manifest.version = this.config.version;
    }

    private async setupLogger(): Promise<void> {
        const isDev = process.env.NODE_ENV === 'development';
        logger.updateConfig({
            level: isDev ? LogLevel.DEBUG : LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            maxLogEntries: 1000
        });
    }
}