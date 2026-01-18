/* eslint-disable max-lines */
import { ConflictPrevention } from './conflict-prevention';
import { ErrorHandler } from './services/error-handler';
import { logger, LogLevel } from './services/logger';
import { MESSAGES } from './constants/index';
import { ModalManager } from './services/modal-manager';
import { OutputFormat, YouTubePluginSettings, PerformanceMode, AIResponse } from './types';
import { ServiceContainer } from './services/service-container';
import { UrlHandler, UrlDetectionResult } from './services/url-handler';
import { ValidationUtils } from './validation';
import { YouTubeSettingsTab } from './settings-tab';
import { YouTubeUrlModal, BatchVideoModal } from './components/features/youtube';
import { Notice, Plugin, TFile } from 'obsidian';

const PLUGIN_PREFIX = 'ytp';
const PLUGIN_VERSION = '1.3.5';

interface ProcessVideoOptions {
    url: string;
    format?: OutputFormat;
    providerName?: string;
    model?: string;
    customPrompt?: string;
    performanceMode?: PerformanceMode;
    enableParallel?: boolean;
    preferMultimodal?: boolean;
    maxTokens?: number;
    temperature?: number;
    enableAutoFallback?: boolean;
}

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

    async onload(): Promise<void> {
        // Set plugin version
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
        // Configure logger based on settings or environment
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
        this.modalManager = new ModalManager();
        this.urlHandler = new UrlHandler(this.app, this._settings, this.handleUrlDetection.bind(this));
    }

    private setupUrlHandling(): void {
        if (!this.urlHandler) return;

        const urlHandler = this.urlHandler;

        // Register file creation handler
        this.registerEvent(
            this.app.vault.on('create', file => {
                if (file instanceof TFile) {
                    void this.safeOperation(() => urlHandler.handleFileCreate(file), 'Handle file create');
                }
            }),
        );

        // Register active leaf change handler
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
        logger.debug('[YT-CLIPPER] safeShowUrlModal called', 'Plugin', {
            initialUrl,
            hasModalManager: !!this.modalManager,
            hasServiceContainer: !!this.serviceContainer,
            modalState: this.modalManager?.getState?.(),
        });

        if (!this.modalManager || !this.serviceContainer) {
            logger.error('[YT-CLIPPER] Cannot show modal - missing services', 'Plugin');
            return;
        }

        // Direct modal opening for reliability
        try {
            await this.openYouTubeUrlModal(initialUrl);
        } catch (error) {
            logger.error('[YT-CLIPPER] Failed to open modal:', 'Plugin', error);
        }
    }

    // eslint-disable-next-line max-lines-per-function
    private async openYouTubeUrlModal(initialUrl?: string): Promise<void> {
        logger.debug('[YT-CLIPPER] openYouTubeUrlModal called', 'Plugin', { initialUrl });
        if (this.isUnloading) {
            ConflictPrevention.log('Plugin is unloading, ignoring modal request');
            return;
        }

        // eslint-disable-next-line max-lines-per-function
        ConflictPrevention.safeOperation(async () => {
            if (!this.serviceContainer) return;

            const aiService = this.serviceContainer.aiService;
            const providers = aiService ? aiService.getProviderNames() : [];
            // Use cached models if available, modal will auto-fetch from API on open
            const modelOptionsMap: Record<string, string[]> = this._settings.modelOptionsCache ?? {};

            const modal = new YouTubeUrlModal(this.app, {
                onProcess: async (
                    url: string,
                    format: OutputFormat,
                    provider?: string,
                    model?: string,
                    customPrompt?: string,
                    performanceMode?: PerformanceMode,
                    enableParallel?: boolean,
                    preferMultimodal?: boolean,
                    maxTokens?: number,
                    temperature?: number,
                    enableAutoFallback?: boolean,
                ) => {
                    return this.processYouTubeVideo({
                        url,
                        format,
                        providerName: provider,
                        model,
                        customPrompt,
                        performanceMode,
                        enableParallel: enableParallel,
                        preferMultimodal,
                        maxTokens,
                        temperature,
                        enableAutoFallback,
                    });
                },
                onOpenFile: this.openFileByPath.bind(this),
                ...(initialUrl && { initialUrl }),
                providers,
                defaultProvider: 'Google Gemini', // Prefer Gemini as default provider
                defaultModel: 'gemini-2.0-flash', // Use free tier model
                defaultMaxTokens: this._settings.defaultMaxTokens,
                defaultTemperature: this._settings.defaultTemperature,
                modelOptions: modelOptionsMap,
                fetchModels: async () => {
                    try {
                        if (!this.serviceContainer) {
                            return modelOptionsMap;
                        }
                        const aiService = this.serviceContainer.aiService as {
                            fetchLatestModels(): Promise<Record<string, string[]>>;
                        };
                        const map = await aiService.fetchLatestModels();
                        this._settings.modelOptionsCache = map;

                        // Update timestamps for all providers
                        const now = Date.now();
                        const timestamps: Record<string, number> = {};
                        Object.keys(map).forEach(provider => {
                            timestamps[provider] = now;
                        });
                        this._settings.modelCacheTimestamps = timestamps;

                        await this.saveSettings();
                        return map;
                    } catch (error) {
                        return modelOptionsMap;
                    }
                },
                fetchModelsForProvider: async (provider: string, forceRefresh = false) => {
                    try {
                        if (!this.serviceContainer) {
                            return [];
                        }
                        const aiService = this.serviceContainer.aiService as {
                            fetchLatestModelsForProvider(providerName: string, bypassCache: boolean): Promise<string[]>;
                        };
                        const models = await aiService.fetchLatestModelsForProvider(provider, forceRefresh);
                        if (models && models.length > 0) {
                            // Update model cache
                            this._settings.modelOptionsCache = {
                                ...this._settings.modelOptionsCache,
                                [provider]: models,
                            };

                            // Update timestamp for provider (especially for OpenRouter)
                            this._settings.modelCacheTimestamps = {
                                ...this._settings.modelCacheTimestamps,
                                [provider]: Date.now(),
                            };

                            await this.saveSettings();
                        }
                        return models;
                    } catch (error) {
                        return [];
                    }
                },
                performanceMode: this._settings.performanceMode ?? 'balanced',
                enableParallelProcessing: this._settings.enableParallelProcessing ?? false,
                enableAutoFallback: this._settings.enableAutoFallback ?? true,
                preferMultimodal: this._settings.preferMultimodal ?? false,
                onPerformanceSettingsChange: async (
                    performanceMode: PerformanceMode,
                    enableParallel: boolean,
                    preferMultimodal: boolean,
                ) => {
                    this._settings.performanceMode = performanceMode;
                    this._settings.enableParallelProcessing = enableParallel;
                    this._settings.preferMultimodal = preferMultimodal;
                    await this.saveSettings();
                    this.serviceContainer = new ServiceContainer(this._settings, this.app);
                },
                onOpenBatchModal: this.openBatchModal.bind(this),
            });

            modal.open();
        }, 'YouTube URL Modal').catch(error => {
            ErrorHandler.handle(error as Error, 'Opening YouTube URL modal');
        });
    }

    private async openBatchModal(): Promise<void> {
        if (this.isUnloading || !this.serviceContainer) return;

        const aiService = this.serviceContainer.aiService;
        const providers = aiService ? aiService.getProviderNames() : [];
        const modelOptionsMap: Record<string, string[]> = this._settings.modelOptionsCache ?? {};

        const modal = new BatchVideoModal(this.app, {
            onProcess: async (urls: string[], format: OutputFormat, provider?: string, model?: string) => {
                // Process each URL and return array of file paths
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
            providers,
            defaultProvider: 'Google Gemini',
            defaultModel: 'gemini-2.0-flash',
            modelOptions: modelOptionsMap,
            defaultMaxTokens: this._settings.defaultMaxTokens,
            defaultTemperature: this._settings.defaultTemperature,
        });
        modal.open();
    }

    // eslint-disable-next-line max-lines-per-function
    private async processYouTubeVideo(options: ProcessVideoOptions): Promise<string> {
        const {
            url,
            format = 'detailed-guide',
            providerName,
            model,
            customPrompt,
            maxTokens,
            temperature,
            enableAutoFallback,
        } = options;
        if (this.isUnloading) {
            ConflictPrevention.log('Plugin is unloading, cancelling video processing');
            throw new Error('Plugin is shutting down');
        }

        // eslint-disable-next-line complexity, max-lines-per-function
        const result = await ConflictPrevention.safeOperation(async () => {
            new Notice(MESSAGES.PROCESSING);

            const validation = ValidationUtils.validateSettings(this._settings);
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
                promptToUse = this._settings.customPrompts?.[format];
            }

            // Fetch transcript to provide actual video content to AI
            let transcript: string | undefined;
            try {
                if (youtubeService.getTranscript) {
                    const transcriptData = await youtubeService.getTranscript(videoId);
                    if (transcriptData?.fullText) {
                        transcript = transcriptData.fullText;
                        logger.info('Transcript fetched successfully', 'Plugin', {
                            videoId,
                            transcriptLength: transcript.length,
                        });
                    } else {
                        logger.debug('No transcript available for this video', 'Plugin', { videoId });
                    }
                }
            } catch (error) {
                logger.debug('Could not fetch transcript, continuing without it', 'Plugin', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }

            const prompt = promptService.createAnalysisPrompt({
                videoData,
                videoUrl: url,
                format,
                customPrompt: promptToUse,
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

            // Set model parameters on providers if available
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

            let aiResponse: AIResponse;
            try {
                if (providerName) {
                    // Pass enableAutoFallback to control fallback behavior
                    const shouldFallback = enableAutoFallback ?? true;
                    aiResponse = await (
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
                    aiResponse = await aiService.process(prompt);
                }

                logger.aiService('AI Response received', {
                    provider: aiResponse.provider,
                    model: aiResponse.model,
                    contentLength: aiResponse.content?.length ?? 0,
                });
            } catch (error) {
                logger.error('AI Processing failed', 'Plugin', {
                    error: error instanceof Error ? error.message : String(error),
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
                url,
            );

            const filePath = await fileService.saveToFile(videoData.title, formattedContent, this._settings.outputPath);

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
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Settings update');
            throw error;
        }
    }

    private async loadSettings(): Promise<void> {
        const loadedData = await this.loadData();
        logger.debug('[YT-CLIPPER] Settings loaded from data.json:', 'Plugin', loadedData);
        this._settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
        logger.debug('[YT-CLIPPER] Final settings after merge:', 'Plugin', {
            hasGeminiKey: !!this._settings.geminiApiKey,
            geminiKeyLength: this._settings.geminiApiKey?.length,
            hasGroqKey: !!this._settings.groqApiKey,
            groqKeyLength: this._settings.groqApiKey?.length,
        });
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

    getServiceContainer(): ServiceContainer | undefined {
        return this.serviceContainer;
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
        return { ...this._settings };
    }

    // Public getter for settings (used by settings tab)
    get settings(): YouTubePluginSettings {
        return this._settings;
    }
}
