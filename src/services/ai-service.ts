import { logger } from './logger';
import { RetryService } from './retry-service';
import { AIService as IAIService, AIProvider, AIResponse, YouTubePluginSettings } from '../types';
import { MESSAGES } from '../constants/index';
import { PERFORMANCE_PRESETS } from '../performance';
import { PROVIDER_MODEL_OPTIONS, PROVIDER_MODEL_LIST_URLS, PROVIDER_MODEL_REGEX } from '../ai/api';
import { OptimizedHttpClient } from '../utils/http-client';
import { performanceTracker } from './performance-tracker';

/**
 * AI service that manages multiple providers with parallel processing support
 */


export class AIService implements IAIService {
    private providers: AIProvider[] = [];
    private settings: YouTubePluginSettings;
    private httpClient: OptimizedHttpClient;

    constructor(providers: AIProvider[], settings: YouTubePluginSettings) {
        if (!providers || providers.length === 0) {
            throw new Error(MESSAGES.ERRORS.MISSING_API_KEYS);
        }
        this.providers = providers;
        this.settings = settings;

        // Initialize optimized HTTP client with performance settings
        const preset = PERFORMANCE_PRESETS[settings.performanceMode] || PERFORMANCE_PRESETS.balanced;
        this.httpClient = new OptimizedHttpClient({
            timeout: preset.timeouts.geminiTimeout,
            retries: 2,
            retryDelay: 1000,
            maxConcurrent: settings.enableParallelProcessing ? 5 : 3,
            keepAlive: true,
            enableMetrics: true
        });

        this.applyPerformanceSettings();
    }

    /**
     * Apply performance settings to providers
     */
    private applyPerformanceSettings(): void {
        const preset = PERFORMANCE_PRESETS[this.settings.performanceMode] || PERFORMANCE_PRESETS.balanced;
        const timeouts = this.settings.customTimeouts || preset!.timeouts;

        this.providers.forEach(provider => {
            if (provider.name === 'Google Gemini' && provider.setTimeout) {
                provider.setTimeout(timeouts.geminiTimeout);
            } else if (provider.name === 'Groq' && provider.setTimeout) {
                provider.setTimeout(timeouts.groqTimeout);
            }
        });
    }

    /**
     * Update settings and reapply performance configurations
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = newSettings;
        this.applyPerformanceSettings();
    }

    /**
     * Return available model options for a provider name (from constants mapping)
     */
    getProviderModels(providerName: string): string[] {
        const raw = PROVIDER_MODEL_OPTIONS[providerName] || [] as any[];
        // Support both legacy string arrays and the new object shape (ProviderModelEntry)
        return raw.map(r => typeof r === 'string' ? r : (r && r.name ? r.name : String(r)));
    }

    /**
     * Best-effort fetch of latest models for all providers by scraping known provider pages.
     * Returns a mapping providerName -> list of discovered models. Falls back to static mapping.
     * Special handling for Ollama to query the actual running instance.
     */
    async fetchLatestModels(): Promise<Record<string, string[]>> {
        const result: Record<string, string[]> = {};
        const providers = this.getProviderNames();

        for (const p of providers) {
            try {
                const models = await this.fetchLatestModelsForProvider(p);
                result[p] = models.length > 0 ? models :
                    (PROVIDER_MODEL_OPTIONS[p] ?
                        (PROVIDER_MODEL_OPTIONS[p] as any[]).map(m => typeof m === 'string' ? m : m.name) :
                        []);
            } catch (error) {
                logger.error(`Error fetching models for ${p}`, 'AIService', {
                    error: error instanceof Error ? error.message : String(error)
                });
                result[p] = PROVIDER_MODEL_OPTIONS[p] ?
                    (PROVIDER_MODEL_OPTIONS[p] as any[]).map(m => typeof m === 'string' ? m : m.name) :
                    [];
            }
        }
        return result;
    }

    /**
     * Fetch latest models for a single provider (best-effort scraping).
     * Special handling for Ollama to query the actual running instance.
     */
    async fetchLatestModelsForProvider(providerName: string): Promise<string[]> {
        return await performanceTracker.measureOperation('ai-service', `fetch-models-${providerName}`, async () => {
            // Special handling for Ollama to query the actual running instance
            if (providerName === 'Ollama') {
                return this.fetchOllamaModels();
            }

            // Special handling for OpenRouter - use their API
            if (providerName === 'OpenRouter') {
                return this.fetchOpenRouterModels();
            }

            // Special handling for Hugging Face - use inference API models
            if (providerName === 'Hugging Face') {
                return this.fetchHuggingFaceModels();
            }

            // For Gemini and Groq, return static options (their APIs don't have a model list endpoint)
            return PROVIDER_MODEL_OPTIONS[providerName] 
                ? (PROVIDER_MODEL_OPTIONS[providerName] as any[]).map(m => typeof m === 'string' ? m : m.name) 
                : [];
        }, {
            provider: providerName,
            operation: 'fetchLatestModelsForProvider'
        });
    }

    /**
     * Fetch models from local Ollama instance
     */
    private async fetchOllamaModels(): Promise<string[]> {
        try {
            const defaultOllamaEndpoint = 'http://localhost:11434';
            const response = await this.httpClient.get(`${defaultOllamaEndpoint}/api/tags`, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.models && Array.isArray(data.models)) {
                    const modelNames = data.models
                        .map((model: any) => model.name || model.id || '')
                        .filter((name: string) => name !== '');
                    logger.debug(`Fetched ${modelNames.length} models from Ollama`, 'AIService');
                    return modelNames;
                }
            }
        } catch (error) {
            logger.warn('Ollama not accessible, using static list', 'AIService');
        }
        return (PROVIDER_MODEL_OPTIONS['Ollama'] as any[]).map(m => typeof m === 'string' ? m : m.name);
    }

    /**
     * Fetch models from OpenRouter API
     */
    private async fetchOpenRouterModels(): Promise<string[]> {
        try {
            const response = await this.httpClient.get('https://openrouter.ai/api/v1/models', {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.data && Array.isArray(data.data)) {
                    // Sort by popularity and get model IDs
                    const models = data.data
                        .sort((a: any, b: any) => (b.context_length || 0) - (a.context_length || 0))
                        .slice(0, 50) // Top 50 models
                        .map((m: any) => m.id)
                        .filter((id: string) => id);
                    logger.debug(`Fetched ${models.length} models from OpenRouter`, 'AIService');
                    return models;
                }
            }
        } catch (error) {
            logger.warn('OpenRouter API error, using static list', 'AIService');
        }
        return (PROVIDER_MODEL_OPTIONS['OpenRouter'] as any[]).map(m => typeof m === 'string' ? m : m.name);
    }

    /**
     * Fetch popular text generation models from Hugging Face
     * Only returns models that work with the Inference API
     */
    private async fetchHuggingFaceModels(): Promise<string[]> {
        try {
            // Fetch text-generation models that are inference-enabled, sorted by downloads
            const response = await this.httpClient.get(
                'https://huggingface.co/api/models?pipeline_tag=text-generation&inference=warm&sort=downloads&limit=20',
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    const models = data
                        .filter((m: any) => m.id && !m.private && m.id.includes('/'))
                        .map((m: any) => m.id)
                        .slice(0, 15);
                    logger.debug(`Fetched ${models.length} HuggingFace models`, 'AIService');
                    if (models.length > 0) return models;
                }
            }
        } catch (error) {
            logger.warn('Hugging Face API error, using static list', 'AIService');
        }
        // Return curated list of models known to work with inference API
        return [
            'Qwen/Qwen3-8B',
            'Qwen/Qwen2.5-7B-Instruct',
            'Qwen/Qwen3-4B-Instruct-2507',
            'meta-llama/Llama-3.2-3B-Instruct',
            'meta-llama/Llama-3.2-1B-Instruct',
            'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
            'mistralai/Mistral-7B-Instruct-v0.2'
        ];
    }

    /**
     * Process prompt with fallback support (original sequential method)
     */
    async process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Valid prompt is required');
        }

        return await performanceTracker.measureOperation('ai-service', 'ai-process', async () => {
            // Use parallel processing if enabled
            if (this.settings.enableParallelProcessing) {
                return this.processParallel(prompt, images);
            }

            return this.processSequential(prompt, images);
        }, {
            promptLength: prompt.length,
            hasImages: images && images.length > 0,
            processingMode: this.settings.enableParallelProcessing ? 'parallel' : 'sequential'
        });
    }

    /**
     * Process prompt with sequential fallback (original method)
     */
    private async processSequential(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        let lastError: Error | null = null;

        // Try each provider in order
        for (const provider of this.providers) {
            try {
                logger.info(`Attempting to process with ${provider.name}`, 'AIService', {
                    model: provider.model
                });

                let content: string;
                // Use multimodal processing if images are provided and supported
                if (images && images.length > 0 && provider.processWithImage) {
                    content = await RetryService.withRetry(
                        () => provider.processWithImage!(prompt, images),
                        `${provider.name}-process-multimodal`,
                        2, // 2 attempts per provider
                        2000 // 2 second base delay
                    );
                } else {
                    content = await RetryService.withRetry(
                        () => provider.process(prompt),
                        `${provider.name}-process`,
                        2, // 2 attempts per provider
                        2000 // 2 second base delay
                    );
                }

                if (content && content.trim().length > 0) {
                    logger.info(`Successfully processed with ${provider.name}`, 'AIService', {
                        model: provider.model,
                        contentLength: content.length
                    });

                    return {
                        content,
                        provider: provider.name,
                        model: provider.model
                    };
                } else {
                    throw new Error('Empty response from AI provider');
                }
            } catch (error) {
                lastError = error as Error;
                logger.warn(`${provider.name} failed`, 'AIService', {
                    error: error instanceof Error ? error.message : String(error),
                    model: provider.model
                });

                // Continue to next provider unless this is the last one
                if (provider === this.providers[this.providers.length - 1]) {
                    break;
                }
            }
        }

        // All providers failed
        const errorMessage = lastError
            ? MESSAGES.ERRORS.AI_PROCESSING(lastError.message)
            : 'All AI providers failed to process the request';

        throw new Error(errorMessage);
    }

    /**
     * Process prompt with parallel provider racing for maximum speed
     */
    private async processParallel(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        
const providerPromises = this.providers.map(async (provider) => {
            try {
                let content: string;
                // Use multimodal processing if images are provided and supported
                if (images && images.length > 0 && provider.processWithImage) {
                    // For parallel mode, we'll call processWithImage directly with timeout
                    content = await provider.processWithImage!(prompt, images);
                } else {
                    // For text-only processing, use the provider's timeout method
                    content = await provider.process(prompt);
                }

                if (content && content.trim().length > 0) {
                    return {
                        content,
                        provider: provider.name,
                        model: provider.model,
                        success: true,
                        responseTime: Date.now()
                    };
                } else {
                    throw new Error('Empty response from AI provider');
                }
            } catch (error) {
                
return {
                    error: (error as Error).message,
                    provider: provider.name,
                    model: provider.model,
                    success: false,
                    responseTime: Date.now()
                };
            }
        });

        // Wait for first successful response or all to complete
        const results = await Promise.allSettled(providerPromises);

        // Find first successful response
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                return {
                    content: result.value.content ?? '',
                    provider: result.value.provider ?? '',
                    model: result.value.model ?? ''
                };
            }
        }

        // All providers failed - collect errors
        const errors = results
            .filter(r => r.status === 'fulfilled' && !r.value.success)
            .map(r => (r as any).value.error);

        const errorMessage = errors.length > 0
            ? MESSAGES.ERRORS.AI_PROCESSING(errors.join('; '))
            : 'All AI providers failed to process the request';

        throw new Error(errorMessage);
    }

    /**
     * Check if an error is a quota/rate limit that should trigger fallback
     */
    private isQuotaOrRateLimitError(error: Error): boolean {
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
     * Process prompt using a specific provider name with automatic fallback.
     * If the selected provider fails with quota/rate limit, tries other providers.
     */
    async processWith(providerName: string, prompt: string, overrideModel?: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        const provider = this.providers.find(p => p.name === providerName);
        if (!provider) {
            throw new Error(`AI provider not found: ${providerName}`);
        }

        try {
            // If provider supports setModel, apply override
            if (overrideModel && typeof (provider as any).setModel === 'function') {
                (provider as any).setModel(overrideModel);
            }

            let content: string;

            // Check if the provider supports multimodal processing and images are provided
            if (images && images.length > 0 && provider.processWithImage) {
                content = await provider.processWithImage!(prompt, images);
            } else {
                content = await provider.process(prompt);
            }

            if (content && content.trim().length > 0) {
                return { content, provider: provider.name, model: provider.model };
            }

            throw new Error('Empty response from AI provider');
        } catch (error) {
            const err = error as Error;
            
            // If quota/rate limit error, try fallback to other providers
            if (this.isQuotaOrRateLimitError(err)) {
                logger.warn(`${providerName} quota/rate limited, trying fallback providers`, 'AIService', {
                    error: err.message
                });

                // Get other providers (excluding the failed one)
                const fallbackProviders = this.providers.filter(p => p.name !== providerName);
                
                if (fallbackProviders.length > 0) {
                    for (const fallbackProvider of fallbackProviders) {
                        try {
                            logger.info(`Trying fallback provider: ${fallbackProvider.name}`, 'AIService');
                            
                            let content: string;
                            if (images && images.length > 0 && fallbackProvider.processWithImage) {
                                content = await fallbackProvider.processWithImage!(prompt, images);
                            } else {
                                content = await fallbackProvider.process(prompt);
                            }

                            if (content && content.trim().length > 0) {
                                logger.info(`Fallback to ${fallbackProvider.name} succeeded`, 'AIService');
                                return { 
                                    content, 
                                    provider: fallbackProvider.name, 
                                    model: fallbackProvider.model 
                                };
                            }
                        } catch (fallbackError) {
                            logger.warn(`Fallback provider ${fallbackProvider.name} also failed`, 'AIService', {
                                error: (fallbackError as Error).message
                            });
                            // Continue to next fallback provider
                        }
                    }
                }
                
                // All fallbacks failed, throw original error with note about fallbacks
                throw new Error(`${err.message} (All fallback providers also failed)`);
            }
            
            // Non-quota error, throw as-is
            throw new Error(MESSAGES.ERRORS.AI_PROCESSING(err.message));
        }
    }

    /**
     * Check if any providers are available
     */
    hasAvailableProviders(): boolean {
        return this.providers.length > 0;
    }

    /**
     * Get list of available provider names
     */
    getProviderNames(): string[] {
        return this.providers.map(p => p.name);
    }

    /**
     * Add a new provider
     */
    addProvider(provider: AIProvider): void {
        this.providers.push(provider);
    }

    /**
     * Remove a provider by name
     */
    removeProvider(providerName: string): boolean {
        const index = this.providers.findIndex(p => p.name === providerName);
        if (index !== -1) {
            this.providers.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get performance metrics for the AI service
     */
    getPerformanceMetrics(): {
        httpMetrics: any;
        aiProcessingMetrics: any;
        modelFetchMetrics: any;
    } {
        return {
            httpMetrics: this.httpClient.getMetrics(),
            aiProcessingMetrics: performanceTracker.getMetricsSummary('ai-service'),
            modelFetchMetrics: Object.fromEntries(
                this.providers.map(provider => [
                    `fetch-models-${provider.name}`,
                    performanceTracker.getMetricsSummary(`fetch-models-${provider.name}`)
                ])
            )
        };
    }

    /**
     * Cleanup method to be called when service is destroyed
     */
    cleanup(): void {
        this.httpClient?.cleanup();
    }
}
