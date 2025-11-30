import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { ConflictPrevention } from './conflict-prevention';
import { MESSAGES } from './messages';
import { ValidationUtils } from './validation';
import { ErrorHandler } from './services/error-handler';
import { logger, LogLevel } from './services/logger';
import { UrlHandler, UrlDetectionResult } from './services/url-handler';
import { ModalManager } from './services/modal-manager';
import { SaveConfirmationModal } from './save-confirmation-modal';
import { SimpleYouTubeModal } from './simple-youtube-modal'; // Temporary replacement
import { YouTubeSettingsTab } from './settings-tab';
import { ServiceContainer } from './services/service-container';
import { OutputFormat, YouTubePluginSettings, PerformanceMode } from './types/types';
import { PluginAPIManager, pluginAPI } from './plugin-api';
import { directEnhancer } from './direct-enhancer';

const PLUGIN_PREFIX = 'ytp';
const PLUGIN_VERSION = '1.3.5';

const DEFAULT_SETTINGS: YouTubePluginSettings = {
    geminiApiKey: '',
    groqApiKey: '',
    outputPath: 'YouTube/Processed Videos',
    useEnvironmentVariables: false,
    environmentPrefix: 'YTC',
    performanceMode: 'balanced',
    enableParallelProcessing: true,
    preferMultimodal: true,
    defaultMaxTokens: 4096, // Good balance for Gemini video processing
    defaultTemperature: 0.5  // Balanced creativity vs consistency
};

export default class YoutubeClipperPlugin extends Plugin {
    private settings: YouTubePluginSettings = DEFAULT_SETTINGS;
    private serviceContainer?: ServiceContainer;
    private ribbonIcon?: HTMLElement | null;
    private isUnloading = false;
    private operationCount = 0;
    private urlHandler?: UrlHandler;
    private modalManager?: ModalManager;
    private apiManager?: PluginAPIManager;

    constructor(app: App) {
        super(app);

        // Initialize direct UI enhancer immediately
        setTimeout(() => {
            directEnhancer.forceEnhancement();
        }, 1000);
    }

    async onload(): Promise<void> {
        logger.info(`Initializing YoutubeClipper Plugin v${PLUGIN_VERSION}...`);

        try {
            await this.loadSettings();
            this.setupLogger();
            await this.initializeUI();
            await this.initializeServices();
            this.registerUIComponents();
            this.setupUrlHandling();
            this.setupProtocolHandler();
            this.initializeAPI();

            logger.plugin('Plugin loaded successfully');
        } catch (error) {
            logger.error('Failed to load plugin', 'Plugin', {
                error: error instanceof Error ? error.message : String(error)
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
            this.apiManager?.cleanup();
            this.cleanupUI();

            // Clean up global API reference
            delete (globalThis as any).ytclipperAPI;

            logger.plugin('Plugin unloaded successfully');
        } catch (error) {
            logger.error('Error during plugin unload', 'Plugin', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private setupLogger(): void {
        // Configure logger based on settings or environment
        const isDev = process.env.NODE_ENV === 'development';
        logger.updateConfig({
            level: isDev ? LogLevel.DEBUG : LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            maxLogEntries: 1000
        });
    }

    private async initializeServices(): Promise<void> {
        this.serviceContainer = new ServiceContainer(this.settings, this.app);
        this.modalManager = new ModalManager();
        this.urlHandler = new UrlHandler(
            this.app,
            this.settings,
            this.handleUrlDetection.bind(this)
        );
    }

    private setupUrlHandling(): void {
        if (!this.urlHandler) return;

        // Register file creation handler
        this.registerEvent(this.app.vault.on('create', (file) => {
            if (file instanceof TFile) {
                this.safeOperation(() => this.urlHandler!.handleFileCreate(file), 'Handle file create');
            }
        }));

        // Register active leaf change handler
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
            this.safeOperation(() => this.urlHandler!.handleActiveLeafChange(), 'Handle active leaf change');
        }));
    }

    private setupProtocolHandler(): void {
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.registerObsidianProtocolHandler?.('youtube-clipper', (params: Record<string, string>) => {
                this.urlHandler?.handleProtocol(params);
            });
        } catch (error) {
            logger.debug('Protocol handler not available', 'Plugin');
        }
    }

    private registerUIComponents(): void {
        this.ribbonIcon = this.addRibbonIcon('film', 'Process YouTube Video', () => {
            void this.safeShowUrlModal();
        });

        logger.plugin('Ribbon icon set successfully');

        this.addCommand({
            id: `${PLUGIN_PREFIX}-process-youtube-video`,
            name: 'Process YouTube Video',
            callback: () => {
                void this.safeShowUrlModal();
            }
        });

        this.addSettingTab(new YouTubeSettingsTab(this.app, {
            plugin: this,
            onSettingsChange: this.handleSettingsChange.bind(this)
        }));

        this.addCommand({
            id: `${PLUGIN_PREFIX}-open-url-from-clipboard`,
            name: 'YouTube Clipper: Open URL Modal (from clipboard)',
            callback: async () => {
                await this.handleClipboardUrl();
            }
        });

        this.addCommand({
            id: `${PLUGIN_PREFIX}-force-enhance-ui`,
            name: 'YouTube Clipper: Force Enhanced UI',
            callback: () => {
                directEnhancer.forceEnhancement();
                new Notice('Enhanced UI applied');
            }
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
            filePath: result.filePath
        });
        void this.safeShowUrlModal(result.url);
    }

    private async handleClipboardUrl(): Promise<void> {
        try {
            if (!this.urlHandler) return;

            await this.urlHandler.handleClipboardUrl();

            // If no URL found in clipboard, prompt user
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
        if (!this.modalManager || !this.serviceContainer) return;

        await this.safeOperation(async () => {
            return this.modalManager!.openModal(
                initialUrl,
                () => this.openYouTubeUrlModal(initialUrl),
                () => {
                    logger.debug('Modal closed', 'Plugin', { url: initialUrl });
                }
            );
        }, 'Show URL Modal');
    }

    private async openYouTubeUrlModal(initialUrl?: string): Promise<void> {
        if (this.isUnloading) {
            ConflictPrevention.log('Plugin is unloading, ignoring modal request');
            return;
        }

        ConflictPrevention.safeOperation(async () => {
            if (!this.serviceContainer) return;

            const aiService = this.serviceContainer.aiService;
            const providers = aiService ? aiService.getProviderNames() : [];
            const modelOptionsMap: Record<string, string[]> = this.settings.modelOptionsCache || {};

            if (aiService && (!this.settings.modelOptionsCache || Object.keys(this.settings.modelOptionsCache).length === 0)) {
                for (const provider of providers) {
                    modelOptionsMap[provider] = aiService.getProviderModels(provider) || [];
                }
            }

            // Simple modal for testing enhanced UI
            const modal = new SimpleYouTubeModal(this.app, {
                onProcess: async (url: string) => {
                    // Basic processing using default settings
                    await this.processYouTubeVideo(
                        url,
                        'detailed-guide', // Default format
                        'gemini', // Default provider
                        'gemini-2.5-pro', // Default model
                        undefined, // No custom prompt
                        'balanced', // Default performance mode
                        false, // No parallel processing
                        false, // No multimodal preference
                        this.settings.defaultMaxTokens,
                        this.settings.defaultTemperature
                    );
                },
                ...(initialUrl && { initialUrl })
            });

            modal.open();
        }, 'YouTube URL Modal').catch((error) => {
            ErrorHandler.handle(error as Error, 'Opening YouTube URL modal');
        });
    }

    private async processYouTubeVideo(
        url: string,
        format: OutputFormat = 'detailed-guide',
        providerName?: string,
        model?: string,
        customPrompt?: string,
        performanceMode?: PerformanceMode,
        enableParallel?: boolean,
        preferMultimodal?: boolean,
        maxTokens?: number,
        temperature?: number
    ): Promise<string> {
        if (this.isUnloading) {
            ConflictPrevention.log('Plugin is unloading, cancelling video processing');
            throw new Error('Plugin is shutting down');
        }

        const result = await ConflictPrevention.safeOperation(async () => {
            new Notice(MESSAGES.PROCESSING);

            const validation = ValidationUtils.validateSettings(this.settings);
            if (!validation.isValid) {
                throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`);
            }

            if (!this.serviceContainer) throw new Error('Service container not initialized');

            const youtubeService = this.serviceContainer.videoService;
            const aiService = this.serviceContainer.aiService;
            const fileService = this.serviceContainer.fileService;
            const promptService = this.serviceContainer.promptService;

            const videoId = youtubeService.extractVideoId(url);
            if (!videoId) {
                throw new Error(MESSAGES.ERRORS.VIDEO_ID_EXTRACTION);
            }

            const videoData = await youtubeService.getVideoData(videoId);

            // Determine prompt to use
            let promptToUse: string | undefined;
            if (format === 'custom') {
                promptToUse = customPrompt;
            } else {
                promptToUse = this.settings.customPrompts?.[format];
            }

            const prompt = promptService.createAnalysisPrompt(videoData, url, format, promptToUse);

            logger.aiService('Processing video', {
                videoId,
                format,
                provider: providerName || 'Auto',
                model: model || 'Default',
                maxTokens: maxTokens || 2048,
                temperature: temperature || 0.7
            });

            // Set model parameters on providers if available
            const providers = (aiService as any).providers || [];
            for (const provider of providers) {
                if (maxTokens && provider.setMaxTokens) {
                    provider.setMaxTokens(maxTokens);
                }
                if (temperature !== undefined && provider.setTemperature) {
                    provider.setTemperature(temperature);
                }
            }

            let aiResponse;
            try {
                if (providerName) {
                    aiResponse = await (aiService as any).processWith(providerName, prompt, model);
                } else {
                    aiResponse = await aiService.process(prompt);
                }

                logger.aiService('AI Response received', {
                    provider: aiResponse.provider,
                    model: aiResponse.model,
                    contentLength: aiResponse.content?.length || 0
                });
            } catch (error) {
                logger.error('AI Processing failed', 'Plugin', {
                    error: error instanceof Error ? error.message : String(error)
                });

                // Use enhanced error handling for quota issues
                if (error instanceof Error) {
                    ErrorHandler.handleEnhanced(error, 'AI Processing');
                }
                throw error;
            }

            const formattedContent = promptService.processAIResponse(
                aiResponse.content,
                aiResponse.provider,
                aiResponse.model,
                format,
                videoData,
                url
            );

            const filePath = await fileService.saveToFile(
                videoData.title,
                formattedContent,
                this.settings.outputPath
            );

            new Notice(MESSAGES.SUCCESS(videoData.title));
            return filePath;
        }, 'YouTube Video Processing');

        if (!result) {
            throw new Error('Failed to process YouTube video');
        }

        return result;
    }

    private async openFileByPath(filePath: string): Promise<void> {
        try {
            await new Promise((resolve) => setTimeout(resolve, 300));
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
            const leaf = this.app.workspace.getLeaf('tab') as WorkspaceLeaf;
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

    private showPersistentSaveConfirmation(file: TFile): void {
        try {
            const modal = new SaveConfirmationModal(this.app, file, (shouldOpen) => {
                if (shouldOpen) {
                    void this.openFileInNewTab(file);
                }
            });
            modal.open();
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Showing save confirmation');
            new Notice(`File saved: ${file.name}. Click to open.`, 0).noticeEl.onclick = () => {
                void this.openFileInNewTab(file);
            };
        }
    }

    private async handleSettingsChange(newSettings: YouTubePluginSettings): Promise<void> {
        try {
            this.settings = { ...newSettings };
            await this.saveSettings();
            await this.serviceContainer?.updateSettings(this.settings);
            this.urlHandler?.updateSettings(this.settings);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Settings update');
            throw error;
        }
    }

      /**
     * Initialize enhanced UI system
     */
    private initializeUI(): void {
        logger.info('Initializing direct enhanced UI system...');

        try {
            // Direct enhancer starts automatically
            logger.info('Direct enhanced UI system initialized successfully');

            // Force enhancement after a short delay
            setTimeout(() => {
                directEnhancer.forceEnhancement();
            }, 500);

        } catch (error) {
            logger.error('Failed to initialize direct enhanced UI system', 'Plugin', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Continue without enhanced UI if it fails
        }
    }

    /**
     * Cleanup enhanced UI system
     */
    private cleanupUI(): void {
        try {
            directEnhancer.destroy();
            logger.plugin('Direct enhanced UI system cleaned up');
        } catch (error) {
            logger.error('Error during UI cleanup', 'Plugin', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

  private async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    private async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
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
                error: error instanceof Error ? error.message : String(error)
            });
            ErrorHandler.handle(error as Error, operationName);
            return null;
        }
    }

    getServiceContainer(): ServiceContainer | undefined {
        return this.serviceContainer;
    }

    // Expose UI enhancer for debugging and testing
    getUIEnhancer(): any {
        return directEnhancer;
    }

    // Expose services for testing and external access
    getUrlHandler(): UrlHandler | undefined {
        return this.urlHandler;
    }

    getModalManager(): ModalManager | undefined {
        return this.modalManager;
    }

    // Public method to get current settings
    getCurrentSettings(): YouTubePluginSettings {
        return { ...this.settings };
    }

    private initializeAPI(): void {
        this.apiManager = PluginAPIManager.getInstance(this, this.app);

        // Expose the API globally for third-party integrations
        (globalThis as any).ytclipperAPI = this.apiManager.getAPI();

        // Also make it available as a plugin property
        (this as any).api = this.apiManager.getAPI();

        // Expose UI enhancer globally for debugging
        (globalThis as any).ytclipperUI = {
            enhance: () => directEnhancer.forceEnhancement(),
            direct: directEnhancer
        };

        logger.plugin('Plugin API and UI enhancer initialized and exposed globally');
    }

    // Public method to get API manager
    getAPIManager(): PluginAPIManager | undefined {
        return this.apiManager;
    }
}