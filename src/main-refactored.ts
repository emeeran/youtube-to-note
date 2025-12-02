/**
 * Refactored Main Plugin Class - Following Single Responsibility Principle
 * Now focuses solely on plugin coordination and orchestration
 */

import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { ConflictPrevention } from './conflict-prevention';
import { ErrorHandler } from './services/error-handler';
import { logger } from './services/logger';
import { MESSAGES } from './constants/index';
import { YouTubeSettingsTab } from './settings-tab';
import { YouTubePluginSettings, PerformanceMode, OutputFormat } from './types';

// New SRP-compliant core components
import { PluginLifecycleManager } from './core/plugin-lifecycle-manager';
import { ServiceInitializer } from './core/service-initializer';
import { UIComponentRegistry } from './core/ui-component-registry';
import { VideoProcessor } from './core/video-processor';
import { ModalCoordinator } from './core/modal-coordinator';
import { SettingsManager } from './core/settings-manager';
import { UrlHandler, UrlDetectionResult } from './services/url-handler';

const PLUGIN_PREFIX = 'ytp';
const PLUGIN_VERSION = '1.3.5';

const DEFAULT_SETTINGS: YouTubePluginSettings = {
    geminiApiKey: '',
    groqApiKey: '',
    ollamaApiKey: '',
    outputPath: 'YouTube/Processed Videos',
    useEnvironmentVariables: false,
    environmentPrefix: 'YTC',
    performanceMode: 'balanced',
    enableParallelProcessing: true,
    preferMultimodal: true,
    defaultMaxTokens: 4096,
    defaultTemperature: 0.5
};

export default class YoutubeClipperPlugin extends Plugin {
    // Core managers (each with single responsibility)
    private lifecycleManager?: PluginLifecycleManager;
    private serviceInitializer?: ServiceInitializer;
    private uiRegistry?: UIComponentRegistry;
    private videoProcessor?: VideoProcessor;
    private modalCoordinator?: ModalCoordinator;
    private settingsManager?: SettingsManager;

    // Legacy support
    private urlHandler?: UrlHandler;

    async onload(): Promise<void> {
        try {
            // Initialize core managers following SRP
            await this.initializeCoreManagers();

            // Initialize plugin lifecycle
            await this.lifecycleManager!.initialize();

            // Initialize services
            await this.serviceInitializer!.initializeServices();

            // Register UI components
            this.registerUIComponents();

            // Setup event handlers
            this.setupEventHandlers();

            logger.info('Plugin loaded successfully', 'YoutubeClipperPlugin');

        } catch (error) {
            logger.error('Failed to load plugin', 'YoutubeClipperPlugin', {
                error: error instanceof Error ? error.message : String(error)
            });
            ErrorHandler.handle(error as Error, 'Plugin initialization');
            new Notice('Failed to load YoutubeClipper Plugin. Check console for details.');
        }
    }

    onunload(): void {
        logger.info('Unloading YoutubeClipper Plugin', 'YoutubeClipperPlugin');

        try {
            // Cleanup in reverse order of initialization
            this.modalCoordinator?.cleanup();
            this.uiRegistry?.cleanup();
            this.serviceInitializer?.cleanup();
            this.lifecycleManager?.cleanup();
            ConflictPrevention.cleanupAllElements();

            logger.info('Plugin unloaded successfully', 'YoutubeClipperPlugin');
        } catch (error) {
            logger.error('Error during plugin unload', 'YoutubeClipperPlugin', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    async loadSettings(): Promise<void> {
        await this.settingsManager?.loadSettings();
    }

    async saveSettings(): Promise<void> {
        await this.settingsManager?.saveSettings();
    }

    /**
     * Get current settings
     */
    get settings(): YouTubePluginSettings {
        return this.settingsManager?.getSettings() || DEFAULT_SETTINGS;
    }

    /**
     * Show YouTube URL modal
     */
    async showYouTubeUrlModal(initialUrl?: string): Promise<void> {
        await this.modalCoordinator?.showModal({ initialUrl });
    }

    /**
     * Process YouTube video directly
     */
    async processYouTubeVideo(
        url: string,
        options: {
            format?: OutputFormat;
            providerName?: string;
            model?: string;
            customPrompt?: string;
            performanceMode?: PerformanceMode;
            enableParallel?: boolean;
            preferMultimodal?: boolean;
            maxTokens?: number;
            temperature?: number;
        } = {}
    ): Promise<string> {
        if (!this.videoProcessor) {
            throw new Error('Video processor not initialized');
        }

        const processingOptions = {
            url,
            outputPath: this.settings.outputPath,
            outputFormat: options.format || 'detailed-guide',
            customPrompt: options.customPrompt,
            maxTokens: options.maxTokens || this.settings.defaultMaxTokens,
            temperature: options.temperature || this.settings.defaultTemperature
        };

        const result = await this.videoProcessor.processVideo(processingOptions);

        if (!result.success || !result.filePath) {
            throw new Error(result.error || 'Processing failed');
        }

        return result.filePath;
    }

    private async initializeCoreManagers(): Promise<void> {
        // Initialize settings manager first
        this.settingsManager = new SettingsManager(this, {
            pluginKey: PLUGIN_PREFIX,
            defaultSettings: DEFAULT_SETTINGS
        });

        await this.loadSettings();

        // Initialize lifecycle manager
        this.lifecycleManager = new PluginLifecycleManager(this, {
            version: PLUGIN_VERSION,
            prefix: PLUGIN_PREFIX
        });

        // Initialize service initializer
        this.serviceInitializer = new ServiceInitializer({
            settings: this.settings,
            app: this.app,
            urlDetectionCallback: this.handleUrlDetection.bind(this)
        });

        // Initialize UI registry
        this.uiRegistry = new UIComponentRegistry(this.app, {
            addRibbonIcon: true,
            addCommands: true
        });

        // Initialize video processor (depends on services)
        const serviceContainer = this.serviceInitializer.getServiceContainer();
        if (serviceContainer) {
            this.videoProcessor = new VideoProcessor(
                this.app,
                serviceContainer,
                this.settings
            );
        }

        // Initialize modal coordinator
        this.modalCoordinator = new ModalCoordinator({
            app: this.app,
            settings: this.settings,
            serviceContainer,
            videoProcessor: this.videoProcessor
        });

        // Set up settings change listeners
        this.setupSettingsListeners();
    }

    private registerUIComponents(): void {
        if (!this.uiRegistry) return;

        // Customize UI registry behavior
        const originalHandleRibbonClick = this.uiRegistry['handleRibbonIconClick'].bind(this.uiRegistry);
        this.uiRegistry['handleRibbonIconClick'] = async () => {
            await this.showYouTubeUrlModal();
        };

        const originalHandleOpenCommand = this.uiRegistry['handleOpenCommand'].bind(this.uiRegistry);
        this.uiRegistry['handleOpenCommand'] = async () => {
            await this.showYouTubeUrlModal();
        };

        const originalHandleClipboardCommand = this.uiRegistry['handleClipboardCommand'].bind(this.uiRegistry);
        this.uiRegistry['handleClipboardCommand'] = async () => {
            await this.handleClipboardUrl();
        };

        this.uiRegistry.registerComponents();
    }

    private setupEventHandlers(): void {
        if (!this.serviceInitializer) return;

        this.urlHandler = this.serviceInitializer.getUrlHandler();
        if (!this.urlHandler) return;

        // Setup URL handling events
        this.registerEvent(this.app.vault.on('create', (file) => {
            if (file instanceof TFile) {
                this.uiRegistry?.safeOperation(
                    () => this.urlHandler!.handleFileCreate(file),
                    'Handle file create'
                );
            }
        }));

        this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
            this.uiRegistry?.safeOperation(
                () => this.urlHandler!.handleActiveLeafChange(),
                'Handle active leaf change'
            );
        }));

        // Setup protocol handler
        this.setupProtocolHandler();
    }

    private setupProtocolHandler(): void {
        try {
            // @ts-ignore - Obsidian protocol handler
            this.registerObsidianProtocolHandler?.('youtube-clipper', (params: Record<string, string>) => {
                this.urlHandler?.handleProtocol(params);
            });
        } catch (error) {
            logger.debug('Protocol handler not available', 'YoutubeClipperPlugin');
        }
    }

    private setupSettingsListeners(): void {
        if (!this.settingsManager) return;

        this.settingsManager.addSettingsChangeListener((newSettings) => {
            // Update service initializer with new settings
            this.serviceInitializer?.updateSettings(newSettings);

            // Update modal coordinator with new settings
            this.modalCoordinator?.updateSettings(newSettings);
        });
    }

    private async handleUrlDetection(result: UrlDetectionResult): Promise<void> {
        if (result.isVideoUrl && result.url) {
            await this.showYouTubeUrlModal(result.url);
        }
    }

    private async handleClipboardUrl(): Promise<void> {
        try {
            const text = await navigator.clipboard.readText();
            if (text && ValidationUtils.extractVideoId(text)) {
                await this.showYouTubeUrlModal(text);
            } else {
                new Notice(MESSAGES.ERRORS.NO_VALID_YOUTUBE_URL_IN_CLIPBOARD);
            }
        } catch (error) {
            logger.error('Failed to read clipboard', 'YoutubeClipperPlugin', {
                error: error instanceof Error ? error.message : String(error)
            });
            new Notice(MESSAGES.ERRORS.FAILED_TO_READ_CLIPBOARD);
        }
    }

    // Legacy support methods for backwards compatibility
    private async openFileByPath(filePath: string): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.openFileInNewTab(file);
            }
        } catch (error) {
            logger.error('Failed to open file by path', 'YoutubeClipperPlugin', {
                filePath,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async openFileInNewTab(file: TFile): Promise<void> {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.openFile(file);
    }

    settingsDisplay(): void {
        new YouTubeSettingsTab(this.app, this).display();
    }
}