/**
 * Fallback Strategy
 * Handles fallback logic for models and providers
 */

import { logger } from '../../services/logger';
import { AIProvider, AIResponse } from '../../types';
import { RetryService } from '../../services/retry-service';
import { MESSAGES } from '../../constants/index';

export interface FallbackConfig {
  enableModelFallback: boolean;
  enableProviderFallback: boolean;
  maxFallbackAttempts: number;
}

export interface ProcessResult {
  success: boolean;
  content?: string;
  provider?: string;
  model?: string;
  error?: string;
}

/**
 * Fallback strategy for AI providers
 */
export class FallbackStrategy {
    constructor(
    private providerManager: any,
    private config: FallbackConfig = {
        enableModelFallback: true,
        enableProviderFallback: true,
        maxFallbackAttempts: 3,
    }
    ) {}

    /**
   * Execute with fallback logic
   */
    async executeWithFallback(
        primaryProviderName: string,
        prompt: string,
        processFn: (provider: AIProvider, model?: string) => Promise<string>,
        options?: {
      overrideModel?: string;
      images?: (string | ArrayBuffer)[];
      enableFallback?: boolean;
    }
    ): Promise<AIResponse> {
        const primaryProvider = this.providerManager.getProvider(primaryProviderName);
        if (!primaryProvider) {
            throw new Error(`AI provider not found: ${primaryProviderName}`);
        }

        const enableFallback = options?.enableFallback ?? true;

        try {
            // Try primary provider first
            const result = await this.tryProvider(primaryProvider, prompt, processFn, options);

            if (result.success) {
                return {
                    content: result.content!,
                    provider: result.provider!,
                    model: result.model!,
                };
            }

            throw new Error(result.error || 'Primary provider failed');
        } catch (error) {
            const err = error as Error;

            // If fallback is disabled, throw immediately
            if (!enableFallback) {
                throw new Error(MESSAGES.ERRORS.AI_PROCESSING(err.message));
            }

            // Try fallback strategies
            return await this.executeFallbackStrategies(
                primaryProvider,
                err,
                prompt,
                processFn,
                options
            );
        }
    }

    /**
   * Try a single provider
   */
    private async tryProvider(
        provider: AIProvider,
        prompt: string,
        processFn: (provider: AIProvider, model?: string) => Promise<string>,
        options?: {
      overrideModel?: string;
      images?: (string | ArrayBuffer)[];
    }
    ): Promise<ProcessResult> {
        try {
            const originalModel = provider.model;

            // Apply model override if specified
            if (options?.overrideModel && typeof (provider as any).setModel === 'function') {
                (provider as any).setModel(options.overrideModel);
            }

            const content = await processFn(provider, options?.overrideModel);

            // Restore original model
            if (options?.overrideModel && typeof (provider as any).setModel === 'function') {
                (provider as any).setModel(originalModel);
            }

            if (content && content.trim().length > 0) {
                return {
                    success: true,
                    content,
                    provider: provider.name,
                    model: provider.model,
                };
            }

            return {
                success: false,
                error: 'Empty response from AI provider',
            };
        } catch (error) {
            return {
                success: false,
                error: (error as Error).message,
            };
        }
    }

    /**
   * Execute fallback strategies
   */
    private async executeFallbackStrategies(
        failedProvider: AIProvider,
        primaryError: Error,
        prompt: string,
        processFn: (provider: AIProvider, model?: string) => Promise<string>,
        options?: {
      overrideModel?: string;
      images?: (string | ArrayBuffer)[];
    }
    ): Promise<AIResponse> {
    // Strategy 1: Try fallback models within the same provider
        if (this.config.enableModelFallback && !this.isQuotaError(primaryError)) {
            logger.info(`Primary model failed for ${failedProvider.name}, trying fallback models`, 'FallbackStrategy', {
                error: primaryError.message,
            });

            const modelFallback = await this.tryModelFallback(failedProvider, prompt, processFn, options);
            if (modelFallback) {
                return modelFallback;
            }
        }

        // Strategy 2: Try fallback providers
        if (this.config.enableProviderFallback) {
            logger.warn(`${failedProvider.name} failed, trying fallback providers`, 'FallbackStrategy', {
                error: primaryError.message,
            });

            const providerFallback = await this.tryProviderFallback(
                failedProvider,
                prompt,
                processFn,
                options
            );
            if (providerFallback) {
                return providerFallback;
            }
        }

        // All fallbacks failed
        throw new Error(`${primaryError.message} (All fallback providers and models also failed)`);
    }

    /**
   * Try fallback models for a provider
   */
    private async tryModelFallback(
        provider: AIProvider,
        prompt: string,
        processFn: (provider: AIProvider, model?: string) => Promise<string>,
        options?: {
      overrideModel?: string;
      images?: (string | ArrayBuffer)[];
    }
    ): Promise<AIResponse | null> {
        const availableModels = this.providerManager.getProviderModels(provider.name);
        const fallbackModels = availableModels.filter(m => m !== provider.model);

        if (fallbackModels.length === 0) {
            logger.info(`No fallback models available for ${provider.name}`, 'FallbackStrategy');
            return null;
        }

        logger.info(`Trying ${fallbackModels.length} fallback models for ${provider.name}`, 'FallbackStrategy');

        // Try up to maxFallbackAttempts
        const modelsToTry = fallbackModels.slice(0, this.config.maxFallbackAttempts);

        for (const fallbackModel of modelsToTry) {
            try {
                logger.info(`Trying fallback model ${fallbackModel} for ${provider.name}`, 'FallbackStrategy');

                const originalModel = provider.model;
                if (typeof (provider as any).setModel === 'function') {
                    (provider as any).setModel(fallbackModel);
                }

                const content = await processFn(provider, fallbackModel);

                if (content && content.trim().length > 0) {
                    logger.info(`Fallback to ${fallbackModel} succeeded for ${provider.name}`, 'FallbackStrategy', {
                        contentLength: content.length,
                    });

                    // Restore original model
                    if (typeof (provider as any).setModel === 'function') {
                        (provider as any).setModel(originalModel);
                    }

                    return {
                        content,
                        provider: provider.name,
                        model: fallbackModel,
                    };
                }
            } catch (fallbackError) {
                logger.warn(`Fallback model ${fallbackModel} failed for ${provider.name}`, 'FallbackStrategy', {
                    error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                });
            } finally {
                // Restore original model
                if (typeof (provider as any).setModel === 'function') {
                    (provider as any).setModel(provider.model);
                }
            }
        }

        logger.warn(`All fallback models failed for ${provider.name}`, 'FallbackStrategy');
        return null;
    }

    /**
   * Try fallback providers
   */
    private async tryProviderFallback(
        failedProvider: AIProvider,
        prompt: string,
        processFn: (provider: AIProvider, model?: string) => Promise<string>,
        options?: {
      overrideModel?: string;
      images?: (string | ArrayBuffer)[];
    }
    ): Promise<AIResponse | null> {
        const allProviders = this.providerManager.getProviders();
        const fallbackProviders = allProviders.filter(p => p.name !== failedProvider.name);

        if (fallbackProviders.length === 0) {
            logger.info('No fallback providers available', 'FallbackStrategy');
            return null;
        }

        for (const fallbackProvider of fallbackProviders) {
            try {
                logger.info(`Trying fallback provider: ${fallbackProvider.name}`, 'FallbackStrategy');

                // Try primary model of fallback provider
                const result = await this.tryProvider(fallbackProvider, prompt, processFn, options);

                if (result.success) {
                    logger.info(`Fallback to ${fallbackProvider.name} succeeded`, 'FallbackStrategy');
                    return {
                        content: result.content!,
                        provider: result.provider!,
                        model: result.model!,
                    };
                }

                // If primary model fails, try fallback models for this provider
                if (this.config.enableModelFallback) {
                    const modelFallback = await this.tryModelFallback(fallbackProvider, prompt, processFn, options);
                    if (modelFallback) {
                        return modelFallback;
                    }
                }
            } catch (fallbackError) {
                logger.warn(`Fallback provider ${fallbackProvider.name} also failed`, 'FallbackStrategy', {
                    error: (fallbackError as Error).message,
                });
            }
        }

        return null;
    }

    /**
   * Check if error is a quota/rate limit error
   */
    private isQuotaError(error: Error): boolean {
        const msg = error.message.toLowerCase();
        return msg.includes('quota') ||
           msg.includes('rate limit') ||
           msg.includes('limit reached') ||
           msg.includes('limit exceeded') ||
           msg.includes('429') ||
           msg.includes('too many requests') ||
           msg.includes('exhausted');
    }

    /**
   * Process with retry logic
   */
    async processWithRetry(
        provider: AIProvider,
        prompt: string,
        images?: (string | ArrayBuffer)[]
    ): Promise<string> {
        if (images && images.length > 0 && provider.processWithImage) {
            return await RetryService.withRetry(
                () => provider.processWithImage!(prompt, images),
                `${provider.name}-process-multimodal`,
                2,
                2000
            );
        } else {
            return await RetryService.withRetry(
                () => provider.process(prompt),
                `${provider.name}-process`,
                2,
                2000
            );
        }
    }

    /**
   * Update fallback configuration
   */
    updateConfig(config: Partial<FallbackConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
   * Get current configuration
   */
    getConfig(): FallbackConfig {
        return { ...this.config };
    }
}
