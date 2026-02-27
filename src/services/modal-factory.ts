/**
 * Modal Factory Service
 * Handles creation and configuration of modals
 */

import { App } from 'obsidian';
import { YouTubeUrlModal, BatchVideoModal } from '../components/features/youtube';
import { OutputFormat, PerformanceMode, YouTubePluginSettings } from '../types';
import { ServiceContainer } from './service-container';
import { logger } from './logger';
import { ConflictPrevention } from '../conflict-prevention';
import { ErrorHandler } from './error-handler';

/** Process callback for URL modal */
export type ProcessCallback = (options: {
    url: string;
    format: OutputFormat;
    provider?: string;
    model?: string;
    performanceMode?: PerformanceMode;
    enableParallel?: boolean;
    preferMultimodal?: boolean;
    maxTokens?: number;
    temperature?: number;
    enableAutoFallback?: boolean;
}) => Promise<string>;

/** Batch process callback */
export type BatchProcessCallback = (
    urls: string[],
    format: OutputFormat,
    provider?: string,
    model?: string,
) => Promise<string[]>;

/** Open file callback */
export type OpenFileCallback = (filePath: string) => Promise<void>;

/** Modal factory options */
export interface ModalFactoryOptions {
    app: App;
    settings: YouTubePluginSettings;
    serviceContainer: ServiceContainer;
    onProcess: ProcessCallback;
    onOpenFile: OpenFileCallback;
    onOpenBatchModal?: () => void;
}

/**
 * Factory for creating modals with consistent configuration
 */
export class ModalFactory {
    private app: App;
    private settings: YouTubePluginSettings;
    private serviceContainer: ServiceContainer;

    constructor(
        app: App,
        settingsGetter: () => YouTubePluginSettings,
        serviceContainerGetter: () => ServiceContainer,
    ) {
        this.app = app;
        this.settings = settingsGetter();
        this.serviceContainer = serviceContainerGetter();
    }

    /**
     * Create YouTube URL modal
     */
    createYouTubeUrlModal(options: {
        onProcess: ProcessCallback;
        onOpenFile: OpenFileCallback;
        onOpenBatchModal?: () => void;
        initialUrl?: string;
        onPerformanceSettingsChange?: (
            performanceMode: PerformanceMode,
            enableParallel: boolean,
            preferMultimodal: boolean,
        ) => Promise<void>;
    }): YouTubeUrlModal {
        const settings = this.settings;
        const serviceContainer = this.serviceContainer;

        const aiService = serviceContainer.aiService;
        const providers = aiService ? aiService.getProviderNames() : [];
        const modelOptionsMap: Record<string, string[]> = settings.modelOptionsCache ?? {};

        return new YouTubeUrlModal(this.app, {
            onProcess: options.onProcess,
            onOpenFile: options.onOpenFile,
            ...(options.initialUrl && { initialUrl: options.initialUrl }),
            providers,
            defaultProvider: 'Google Gemini',
            defaultModel: 'gemini-2.0-flash',
            defaultMaxTokens: settings.defaultMaxTokens,
            defaultTemperature: settings.defaultTemperature,
            modelOptions: modelOptionsMap,
            fetchModels: async () => {
                return this.fetchModels(serviceContainer, settings, modelOptionsMap);
            },
            fetchModelsForProvider: async (provider: string, forceRefresh = false) => {
                return this.fetchModelsForProvider(serviceContainer, settings, provider, forceRefresh);
            },
            performanceMode: settings.performanceMode ?? 'balanced',
            enableParallelProcessing: settings.enableParallelProcessing ?? false,
            enableAutoFallback: settings.enableAutoFallback ?? true,
            preferMultimodal: settings.preferMultimodal ?? false,
            onPerformanceSettingsChange: options.onPerformanceSettingsChange,
            onOpenBatchModal: options.onOpenBatchModal,
        });
    }

    /**
     * Create batch video modal
     */
    createBatchVideoModal(options: {
        onProcess: BatchProcessCallback;
        onOpenFile: OpenFileCallback;
    }): BatchVideoModal {
        const settings = this.settings;

        const aiService = this.serviceContainer.aiService;
        const providers = aiService ? aiService.getProviderNames() : [];
        const modelOptionsMap: Record<string, string[]> = settings.modelOptionsCache ?? {};

        return new BatchVideoModal(this.app, {
            onProcess: options.onProcess,
            onOpenFile: options.onOpenFile,
            providers,
            defaultProvider: 'Google Gemini',
            defaultModel: 'gemini-2.0-flash',
            modelOptionsMap: modelOptionsMap,
        });
    }

    /**
     * Fetch all models
     */
    private async fetchModels(
        serviceContainer: ServiceContainer,
        settings: YouTubePluginSettings,
        fallbackMap: Record<string, string[]>,
    ): Promise<Record<string, string[]>> {
        try {
            const aiService = serviceContainer.aiService as {
                fetchLatestModels(): Promise<Record<string, string[]>>;
            };
            const map = await aiService.fetchLatestModels();

            // Update cache timestamps
            const now = Date.now();
            const timestamps: Record<string, number> = {};
            Object.keys(map).forEach(provider => {
                timestamps[provider] = now;
            });

            return map;
        } catch (error) {
            return fallbackMap;
        }
    }

    /**
     * Fetch models for specific provider
     */
    private async fetchModelsForProvider(
        serviceContainer: ServiceContainer,
        settings: YouTubePluginSettings,
        provider: string,
        forceRefresh: boolean,
    ): Promise<string[]> {
        try {
            const aiService = serviceContainer.aiService as {
                fetchLatestModelsForProvider(
                    providerName: string,
                    bypassCache: boolean,
                ): Promise<string[]>;
            };
            const models = await aiService.fetchLatestModelsForProvider(provider, forceRefresh);

            return models ?? [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Update settings reference
     */
    updateSettings(settings: YouTubePluginSettings): void {
        this.settings = settings;
    }

    /**
     * Update service container reference
     */
    updateServiceContainer(serviceContainer: ServiceContainer): void {
        this.serviceContainer = serviceContainer;
    }
}
