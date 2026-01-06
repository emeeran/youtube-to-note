/**
 * Plugin Lifecycle Management
 * Handles loading and unloading of the plugin
 */

import { Plugin } from 'obsidian';
import { ErrorHandler } from '../services/error-handler';
import { logger, LogLevel } from '../services/logger';
import { YouTubePluginSettings } from '../types';

export interface LifecycleDependencies {
  plugin: Plugin;
  settings: YouTubePluginSettings;
  onInitializeServices: () => Promise<void>;
  onRegisterUIComponents: () => void;
  onSetupUrlHandling: () => void;
  onSetupProtocolHandler: () => void;
}

export class PluginLifecycleManager {
    private isLoaded = false;
    private isUnloading = false;

    constructor(private dependencies: LifecycleDependencies) {}

    /**
   * Load the plugin
   */
    async load(version: string): Promise<void> {
        const { plugin } = this.dependencies;

        // Set plugin version
        plugin.manifest.version = version;
        logger.info(`Initializing YoutubeClipper Plugin v${version}...`);

        try {
            this.setupLogger();

            // Initialize core services
            await this.dependencies.onInitializeServices();

            // Register UI components
            this.dependencies.onRegisterUIComponents();

            // Setup event handlers
            this.dependencies.onSetupUrlHandling();
            this.dependencies.onSetupProtocolHandler();

            this.isLoaded = true;
            logger.plugin('Plugin loaded successfully');
        } catch (error) {
            logger.error('Failed to load plugin', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
            ErrorHandler.handle(error as Error, 'Plugin initialization');

            // Show user-facing error
            const { Notice } = require('obsidian');
            new Notice('Failed to load YoutubeClipper Plugin. Check console for details.');

            throw error;
        }
    }

    /**
   * Unload the plugin
   */
    async unload(): Promise<void> {
        logger.plugin('Unloading YoutubeClipper Plugin...');
        this.isUnloading = true;

        try {
            // The actual cleanup is handled by the plugin class
            // This is just for tracking state

            this.isLoaded = false;
            logger.plugin('Plugin unloaded successfully');
        } catch (error) {
            logger.error('Error during plugin unload', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
   * Setup logger configuration
   */
    private setupLogger(): void {
        const isDev = process.env.NODE_ENV === 'development';
        logger.updateConfig({
            level: isDev ? LogLevel.DEBUG : LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            maxLogEntries: 1000,
        });
    }

    /**
   * Check if plugin is loaded
   */
    getIsLoaded(): boolean {
        return this.isLoaded;
    }

    /**
   * Check if plugin is unloading
   */
    getIsUnloading(): boolean {
        return this.isUnloading;
    }
}
