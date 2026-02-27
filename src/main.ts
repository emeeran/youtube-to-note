/* eslint-disable max-lines */
import { ConflictPrevention } from './conflict-prevention';
import { ErrorHandler } from './services/error-handler';
import { logger, LogLevel } from './services/logger';
import { ModalManager } from './services/modal-manager';
import { OutputFormat, YouTubePluginSettings, PerformanceMode } from './types';
import { ServiceContainer } from './services/service-container';
import { UrlHandler, UrlDetectionResult } from './services/url-handler';
import { ValidationUtils } from './validation';
import { YouTubeSettingsTab } from './settings-tab';
import { Notice, Plugin, TFile } from 'obsidian';
import { VideoProcessor, ProcessVideoOptions } from './services/video-processor';
import { ModalFactory } from './services/modal-factory';

const PLUGIN_PREFIX = 'ytp';
const PLUGIN_VERSION = '1.3.5';

const DEFAULT_SETTINGS: YouTubePluginSettings = {
    geminiApiKey: '',
    groqApiKey: '',
    ollamaApiKey: '',
    ollamaEndpoint: 'http://localhost:11434',
    huggingFaceApiKey: '',
    openRouterApiKey: '',
    outputPath: 'YouTube/Processed Videos',
    useEnvironmentVariables: false,
    environmentPrefix: 'YTC',
    performanceMode: 'balanced',
    enableParallelProcessing: true,
    enableAutoFallback: true,
    preferMultimodal: true,
    defaultMaxTokens: 4096,
    defaultTemperature: 0.5,
};

export default class YoutubeClipperPlugin extends Plugin {
    private _settings: YouTubePluginSettings = DEFAULT_SETTINGS;
    private serviceContainer?: ServiceContainer;
    private ribbonIcon?: HTMLElement | null;
    private isUnloading = false;
    private operationCount = 0;
    private urlHandler?: UrlHandler;
    private modalManager?: ModalManager;
    private videoProcessor?: VideoProcessor;
    private modalFactory?: ModalFactory;

    async onload(): Promise<void> {
        this.manifest.version = PLUGIN_VERSION;
        logger.info(`Initializing YoutubeClipper Plugin v${PLUGIN_VERSION}...`);

        try {
            await this.loadSettings();
            this.setupLogger();
            await this.initializeServices();
            this.registerUIComponents();
            this.setupUrlHandling();
            this.setupProtocolHandler();

            logger.plugin('Plugin loaded successfully');
        } catch (error) {
            logger.error('Failed to load plugin', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
            ErrorHandler.handle(error as Error, 'Plugin initialization');
            new Notice('Failed to load YoutubeClipper Plugin. Check console for details.');
        }
    }

    onunload(): void {
        logger.plugin('Unloading YoutubeClipper Plugin...');
        this.isUnloading = true;

        try {
            this.urlHandler?.clear();
            this.modalManager?.clear();
            this.serviceContainer?.clearServices();
            this.cleanupUIElements();
            ConflictPrevention.cleanupAllElements();

            logger.plugin('Plugin unloaded successfully');
        } catch (error) {
            logger.error('Error during plugin unload', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private setupLogger(): void {
        const isDev = process.env.NODE_ENV === 'development';
        logger.updateConfig({
            level: isDev ? LogLevel.DEBUG : LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            maxLogEntries: 1000,
        });
    }

    private async initializeServices(): Promise<void> {
        this.serviceContainer = new ServiceContainer(this._settings, this.app);
        await this.serviceContainer.initialize();
        this.modalManager = new ModalManager();
        this.urlHandler = new UrlHandler(this.app, this._settings, this.handleUrlDetection.bind(this));

        // Initialize extracted services
        this.videoProcessor = new VideoProcessor(
            () => this._settings,
            () => this.serviceContainer!,
            () => this.isUnloading,
        );

        this.modalFactory = new ModalFactory(
            this.app,
            () => this._settings,
            () => this.serviceContainer!,
        );
    }

    private setupUrlHandling(): void {
        if (!this.urlHandler) return;

        const urlHandler = this.urlHandler;

        this.registerEvent(
            this.app.vault.on('create', file => {
                if (file instanceof TFile) {
                    void this.safeOperation(() => urlHandler.handleFileCreate(file), 'Handle file create');
                }
            }),
        );

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                void this.safeOperation(() => urlHandler.handleActiveLeafChange(), 'Handle active leaf change');
            }),
        );
    }

    private setupProtocolHandler(): void {
        try {
            this.registerObsidianProtocolHandler('youtube-clipper', params => {
                logger.info('[YT-Clipper] Protocol received:', 'Plugin', params);
                this.urlHandler?.handleProtocol(params);
            });
            logger.info('[YT-Clipper] Protocol handler registered successfully', 'Plugin');
        } catch (error) {
            logger.error('[YT-Clipper] Protocol handler registration failed:', 'Plugin', error);
            logger.debug('Protocol handler not available', 'Plugin');
        }
    }

    private registerUIComponents(): void {
        this.ribbonIcon = this.addRibbonIcon('youtube', 'Process YouTube Video', () => {
            logger.info('[YT-CLIPPER] Ribbon icon clicked', 'Plugin');
            void this.safeShowUrlModal();
        });

        logger.plugin('Ribbon icon set successfully');

        this.addCommand({
            id: `${PLUGIN_PREFIX}-process-youtube-video`,
            name: 'Process YouTube Video',
            callback: () => {
                logger.info('[YT-CLIPPER] Process command triggered', 'Plugin');
                void this.safeShowUrlModal();
            },
        });

        this.addSettingTab(
            new YouTubeSettingsTab(this.app, {
                plugin: this,
                onSettingsChange: this.handleSettingsChange.bind(this),
            }),
        );

        this.addCommand({
            id: `${PLUGIN_PREFIX}-open-url-from-clipboard`,
            name: 'YouTube Clipper: Open URL Modal (from clipboard)',
            callback: async () => {
                await this.handleClipboardUrl();
            },
        });

        this.addCommand({
            id: `${PLUGIN_PREFIX}-batch-process`,
            name: 'YouTube Clipper: Batch Process Videos',
            callback: () => {
                void this.openBatchModal();
            },
        });
    }

    private cleanupUIElements(): void {
        if (this.ribbonIcon) {
            this.ribbonIcon.remove();
            this.ribbonIcon = null;
        }
    }

    private handleUrlDetection(result: UrlDetectionResult): void {
        logger.info('URL detected, opening modal', 'Plugin', {
            url: result.url,
            source: result.source,
            filePath: result.filePath,
        });
        void this.safeShowUrlModal(result.url);
    }

    private async handleClipboardUrl(): Promise<void> {
        try {
            if (!this.urlHandler) return;

            await this.urlHandler.handleClipboardUrl();

            // eslint-disable-next-line no-alert
            const manual = window.prompt('Paste YouTube URL to open in YouTube Clipper:');
            if (manual && ValidationUtils.isValidYouTubeUrl(manual.trim())) {
                void this.safeShowUrlModal(manual.trim());
            } else {
                new Notice('No valid YouTube URL provided.');
            }
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Open URL from clipboard');
        }
    }

    private async safeShowUrlModal(initialUrl?: string): Promise<void> {
        logger.debug('[YT-CLIPPER] safeShowUrlModal called', 'Plugin', {
            initialUrl,
            hasModalManager: !!this.modalManager,
            hasServiceContainer: !!this.serviceContainer,
        });

        if (!this.modalManager || !this.serviceContainer) {
            logger.error('[YT-CLIPPER] Cannot show modal - missing services', 'Plugin');
            return;
        }

        try {
            await this.openYouTubeUrlModal(initialUrl);
        } catch (error) {
            logger.error('[YT-CLIPPER] Failed to open modal:', 'Plugin', error);
        }
    }

    private async openYouTubeUrlModal(initialUrl?: string): Promise<void> {
        logger.debug('[YT-CLIPPER] openYouTubeUrlModal called', 'Plugin', { initialUrl });
        if (this.isUnloading) {
            ConflictPrevention.log('Plugin is unloading, ignoring modal request');
            return;
        }

        ConflictPrevention.safeOperation(async () => {
            if (!this.serviceContainer || !this.modalFactory) return;

            // Update factory with current references
            this.modalFactory.updateSettings(this._settings);
            this.modalFactory.updateServiceContainer(this.serviceContainer);

            const modal = this.modalFactory.createYouTubeUrlModal({
                onProcess: async (
                    url,
                    format,
                    provider,
                    model,
                    performanceMode,
                    enableParallel,
                    preferMultimodal,
                    maxTokens,
                    temperature,
                    enableAutoFallback,
                ) => {
                    return this.processYouTubeVideo({
                        url,
                        format,
                        providerName: provider,
                        model,
                        performanceMode,
                        enableParallel,
                        preferMultimodal,
                        maxTokens,
                        temperature,
                        enableAutoFallback,
                    });
                },
                onOpenFile: this.openFileByPath.bind(this),
                initialUrl,
                onPerformanceSettingsChange: async (performanceMode, enableParallel, preferMultimodal) => {
                    this._settings.performanceMode = performanceMode;
                    this._settings.enableParallelProcessing = enableParallel;
                    this._settings.preferMultimodal = preferMultimodal;
                    await this.saveSettings();
                    this.serviceContainer = new ServiceContainer(this._settings, this.app);
                    await this.serviceContainer.initialize();
                },
                onOpenBatchModal: this.openBatchModal.bind(this),
            });

            modal.open();
        }, 'YouTube URL Modal').catch(error => {
            ErrorHandler.handle(error as Error, 'Opening YouTube URL modal');
        });
    }

    private async openBatchModal(): Promise<void> {
        if (this.isUnloading || !this.serviceContainer || !this.modalFactory) return;

        this.modalFactory.updateSettings(this._settings);
        this.modalFactory.updateServiceContainer(this.serviceContainer);

        const modal = this.modalFactory.createBatchVideoModal({
            onProcess: async (urls, format, provider, model) => {
                const results: string[] = [];
                for (const url of urls) {
                    const filePath = await this.processYouTubeVideo({
                        url,
                        format,
                        providerName: provider,
                        model,
                    });
                    results.push(filePath);
                }
                return results;
            },
            onOpenFile: this.openFileByPath.bind(this),
        });

        modal.open();
    }

    private async processYouTubeVideo(options: ProcessVideoOptions): Promise<string> {
        if (!this.videoProcessor) {
            throw new Error('Video processor not initialized');
        }
        return this.videoProcessor.process(options);
    }

    private async openFileByPath(filePath: string): Promise<void> {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            const file = this.app.vault.getAbstractFileByPath(cleanPath);

            if (!file || !(file instanceof TFile)) {
                throw new Error(`File not found at path: ${cleanPath}`);
            }

            await this.openFileInNewTab(file);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Opening file by path');
            throw error;
        }
    }

    private async openFileInNewTab(file: TFile): Promise<void> {
        try {
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(file);
            this.app.workspace.setActiveLeaf(leaf);
            new Notice(`📂 Opened: ${file.name}`);
        } catch (error) {
            try {
                const currentLeaf = this.app.workspace.getLeaf(false);
                await currentLeaf.openFile(file);
                new Notice(`📂 Opened: ${file.name}`);
            } catch (fallbackError) {
                ErrorHandler.handle(fallbackError as Error, 'Opening file in current tab');
                new Notice(`Note saved as "${file.name}" but could not auto-open. Please open manually.`);
            }
        }
    }

    private async handleSettingsChange(newSettings: YouTubePluginSettings): Promise<void> {
        try {
            this._settings = { ...newSettings };
            await this.saveSettings();
            await this.serviceContainer?.updateSettings(this._settings);
            this.urlHandler?.updateSettings(this._settings);
            this.modalFactory?.updateSettings(this._settings);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Settings update');
            throw error;
        }
    }

    private async loadSettings(): Promise<void> {
        const loadedData = await this.loadData();
        logger.debug('[YT-CLIPPER] Settings loaded from data.json:', 'Plugin', loadedData);
        this._settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    }

    private async saveSettings(): Promise<void> {
        await this.saveData(this._settings);
    }

    private async safeOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T | null> {
        if (this.isUnloading) {
            logger.warn(`Attempted ${operationName} during plugin unload - skipping`, 'Plugin');
            return null;
        }

        const opId = ++this.operationCount;
        logger.info(`Starting operation ${opId}: ${operationName}`, 'Plugin');

        try {
            const result = await operation();
            logger.info(`Completed operation ${opId}: ${operationName}`, 'Plugin');
            return result;
        } catch (error) {
            logger.error(`Failed operation ${opId}: ${operationName}`, 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
            ErrorHandler.handle(error as Error, operationName);
            return null;
        }
    }

    // Public getters for external access
    getServiceContainer(): ServiceContainer | undefined {
        return this.serviceContainer;
    }

    getUrlHandler(): UrlHandler | undefined {
        return this.urlHandler;
    }

    getModalManager(): ModalManager | undefined {
        return this.modalManager;
    }

    getCurrentSettings(): YouTubePluginSettings {
        return { ...this._settings };
    }

    get settings(): YouTubePluginSettings {
        return this._settings;
    }
}
