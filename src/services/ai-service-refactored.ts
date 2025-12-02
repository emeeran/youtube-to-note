/**
 * Refactored AI Service - Open/Closed Principle Implementation
 * Uses strategy pattern for extensible provider management
 * New providers can be added without modifying this service
 */

import { AIProviderStrategy, AIProcessingOptions, AIProcessingResult } from '../strategies/ai-provider-strategy';
import { AIProviderFactory, ProviderType } from '../strategies/provider-factory';
import { logger } from './logger';
import { RetryService } from './retry-service';
import { YouTubePluginSettings } from '../types';
import { MESSAGES } from '../constants/index';

export interface AIServiceConfig {
    providers: Array<{
        type: ProviderType;
        name?: string;
        apiKey: string;
        model?: string;
        customConfig?: Record<string, any>;
    }>;
    enableParallelProcessing?: boolean;
    defaultTimeout?: number;
}

export interface ProcessingOptions extends AIProcessingOptions {
    useParallel?: boolean;
    preferredProviders?: string[];
    fallbackEnabled?: boolean;
}

export class AIServiceRefactored {
    private providers: AIProviderStrategy[] = [];
    private settings: YouTubePluginSettings;
    private config: AIServiceConfig;
    private retryService: RetryService;

    constructor(config: AIServiceConfig, settings: YouTubePluginSettings) {
        this.config = {
            enableParallelProcessing: true,
            defaultTimeout: 30000,
            ...config
        };
        this.settings = settings;
        this.retryService = new RetryService();

        this.initializeProviders();
    }

    /**
     * Process content using AI providers
     * OCP: New processing strategies can be added without modifying this method
     */
    async process(options: ProcessingOptions): Promise<AIProcessingResult> {
        const processingOptions: ProcessingOptions = {
            ...options,
            useParallel: options.useParallel ?? this.config.enableParallelProcessing
        };

        if (processingOptions.useParallel && this.providers.length > 1) {
            return this.processParallel(processingOptions);
        } else {
            return this.processSequential(processingOptions);
        }
    }

    /**
     * Get available models from all providers
     */
    async getAvailableModels(): Promise<Record<string, string[]>> {
        const models: Record<string, string[]> = {};

        for (const provider of this.providers) {
            try {
                models[provider.getName()] = await provider.getAvailableModels();
            } catch (error) {
                logger.warn(`Failed to get models from ${provider.getName()}`, 'AIServiceRefactored', {
                    error: error instanceof Error ? error.message : String(error)
                });
                models[provider.getName()] = [];
            }
        }

        return models;
    }

    /**
     * Update settings and reconfigure providers
     */
    updateSettings(newSettings: YouTubePluginSettings): Promise<void> {
        this.settings = newSettings;
        return this.reinitializeProviders();
    }

    /**
     * Get current provider configurations
     */
    getProviderInfo(): Array<{ name: string; type: string; capabilities: any }> {
        return this.providers.map(provider => ({
            name: provider.getName(),
            type: provider.constructor.name,
            capabilities: provider.getCapabilities()
        }));
    }

    /**
     * Add a new provider at runtime
     * OCP: New providers can be added without modifying existing code
     */
    addProvider(type: ProviderType, config: any): void {
        try {
            const provider = AIProviderFactory.createProvider(type, config);
            this.providers.push(provider);
            logger.info(`Added provider: ${provider.getName()}`, 'AIServiceRefactored');
        } catch (error) {
            logger.error(`Failed to add provider: ${type}`, 'AIServiceRefactored', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Remove a provider
     */
    removeProvider(providerName: string): boolean {
        const initialLength = this.providers.length;
        this.providers = this.providers.filter(p => p.getName() !== providerName);
        const removed = this.providers.length < initialLength;

        if (removed) {
            logger.info(`Removed provider: ${providerName}`, 'AIServiceRefactored');
        }

        return removed;
    }

    private async processParallel(options: ProcessingOptions): Promise<AIProcessingResult> {
        const startTime = Date.now();

        // Create parallel processing tasks
        const tasks = this.providers.map(provider =>
            this.processWithProvider(provider, options).catch(error => ({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                provider: provider.getName()
            }))
        );

        try {
            // Race all providers - first successful response wins
            const result = await Promise.race(tasks);

            if (result.success) {
                logger.info(`Parallel processing succeeded with ${result.provider || 'unknown'}`, 'AIServiceRefactored', {
                    duration: Date.now() - startTime
                });
                return result;
            } else {
                throw new Error(result.error || 'Parallel processing failed');
            }

        } catch (error) {
            logger.error('Parallel processing failed', 'AIServiceRefactored', {
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime
            });

            // Fallback to sequential processing if enabled
            if (options.fallbackEnabled !== false) {
                logger.info('Falling back to sequential processing', 'AIServiceRefactored');
                return this.processSequential(options);
            }

            throw error;
        }
    }

    private async processSequential(options: ProcessingOptions): Promise<AIProcessingResult> {
        const startTime = Date.now();

        // Try each provider in sequence until one succeeds
        for (const provider of this.providers) {
            try {
                logger.info(`Attempting to process with ${provider.getName()}`, 'AIServiceRefactored');

                const result = await this.processWithProvider(provider, options);

                if (result.success) {
                    logger.info(`Sequential processing succeeded with ${provider.getName()}`, 'AIServiceRefactored', {
                        duration: Date.now() - startTime
                    });
                    return result;
                }

            } catch (error) {
                logger.warn(`${provider.getName()} failed in sequential processing`, 'AIServiceRefactored', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        throw new Error('All providers failed in sequential processing');
    }

    private async processWithProvider(provider: AIProviderStrategy, options: ProcessingOptions): Promise<AIProcessingResult> {
        // Apply retry logic with exponential backoff
        return this.retryService.executeWithRetry(
            async () => {
                const result = await provider.process(options);

                if (!result.success) {
                    throw new Error(result.error || 'Provider processing failed');
                }

                return result;
            },
            {
                maxRetries: 3,
                baseDelay: 1000,
                backoffFactor: 2,
                maxDelay: 10000,
                operationName: `${provider.getName()}-processing`
            }
        );
    }

    private initializeProviders(): void {
        this.providers = [];

        for (const providerConfig of this.config.providers) {
            try {
                const provider = AIProviderFactory.createFromSettings(providerConfig);
                this.providers.push(provider);
                logger.info(`Initialized provider: ${provider.getName()}`, 'AIServiceRefactored');
            } catch (error) {
                logger.error(`Failed to initialize provider`, 'AIServiceRefactored', {
                    type: providerConfig.type,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        if (this.providers.length === 0) {
            throw new Error(MESSAGES.ERRORS.MISSING_API_KEYS);
        }

        logger.info(`Initialized ${this.providers.length} providers`, 'AIServiceRefactored');
    }

    private async reinitializeProviders(): Promise<void> {
        try {
            await this.cleanup();
            this.initializeProviders();
            logger.info('Providers reinitialized with new settings', 'AIServiceRefactored');
        } catch (error) {
            logger.error('Failed to reinitialize providers', 'AIServiceRefactored', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private async cleanup(): Promise<void> {
        // Clear current providers
        this.providers = [];
        logger.debug('Cleaned up providers', 'AIServiceRefactored');
    }
}