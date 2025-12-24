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

// Cache duration: 24 hours in milliseconds
const CACHE_DURATION = 24 * 60 * 60 * 1000;

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
    async fetchLatestModelsForProvider(providerName: string, bypassCache = false): Promise<string[]> {
        return await performanceTracker.measureOperation('ai-service', `fetch-models-${providerName}`, async () => {
            // Special handling for Ollama to query the actual running instance
            if (providerName === 'Ollama') {
                return this.fetchOllamaModels(bypassCache);
            }

            // Special handling for OpenRouter - use their API
            if (providerName === 'OpenRouter') {
                return this.fetchOpenRouterModels(bypassCache);
            }

            // Special handling for Hugging Face - use inference API models
            if (providerName === 'Hugging Face') {
                return this.fetchHuggingFaceModels(bypassCache);
            }

            // Special handling for Groq - use their API
            if (providerName === 'Groq') {
                return this.fetchGroqModels(bypassCache);
            }

            // For Gemini, return static options (API doesn't have a public model list endpoint)
            return PROVIDER_MODEL_OPTIONS[providerName]
                ? (PROVIDER_MODEL_OPTIONS[providerName] as any[]).map(m => typeof m === 'string' ? m : m.name)
                : [];
        }, {
            provider: providerName,
            operation: 'fetchLatestModelsForProvider'
        });
    }

    /**
     * Force refresh OpenRouter models, bypassing cache
     */
    async forceRefreshOpenRouterModels(): Promise<string[]> {
        try {
            logger.debug('Force fetching fresh OpenRouter models from API', 'AIService');
            const response = await this.httpClient.get('https://openrouter.ai/api/v1/models', {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.data && Array.isArray(data.data)) {
                    // Sort by context length and get top models
                    const models = data.data
                        .sort((a: any, b: any) => (b.context_length || 0) - (a.context_length || 0))
                        .slice(0, 50) // Top 50 models
                        .map((m: any) => m.id)
                        .filter((id: string) => id);

                    logger.debug(`Force fetched ${models.length} fresh models from OpenRouter`, 'AIService');
                    return models;
                }
            }
        } catch (error) {
            logger.warn('OpenRouter API error during force refresh', 'AIService');
        }

        // Fallback to cached models or static list
        const cachedModels = this.settings.modelOptionsCache?.['OpenRouter'];
        if (cachedModels && cachedModels.length > 0) {
            logger.debug(`Using cache of ${cachedModels.length} OpenRouter models as fallback`, 'AIService');
            return cachedModels;
        }

        return (PROVIDER_MODEL_OPTIONS['OpenRouter'] as any[]).map(m => typeof m === 'string' ? m : m.name);
    }

    /**
     * Fetch models from local Ollama instance with caching
     */
    private async fetchOllamaModels(bypassCache = false): Promise<string[]> {
        // Check if we have cached models that are still valid (shorter cache for local instance)
        const cacheKey = 'Ollama';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();
        const ollamaCacheDuration = 30 * 60 * 1000; // 30 minutes for local instance

        // If we have valid cached models and we're not bypassing cache, return them
        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < ollamaCacheDuration) {
            logger.debug(`Using ${cachedModels.length} cached Ollama models (${Math.round((now - cachedTimestamp) / 1000 / 60)} minutes old)`, 'AIService');
            return cachedModels;
        }

        // Otherwise, fetch fresh models from local Ollama instance
        try {
            logger.debug('Fetching fresh Ollama models from local instance', 'AIService');
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
                    logger.debug(`Fetched ${modelNames.length} fresh models from Ollama`, 'AIService');
                    return modelNames;
                }
            }
        } catch (error) {
            logger.warn('Ollama not accessible, using cached list or fallback', 'AIService');
        }

        // Fallback: return cached models if available (even if expired), or static list
        if (cachedModels && cachedModels.length > 0) {
            logger.debug(`Using expired cache of ${cachedModels.length} Ollama models as fallback`, 'AIService');
            return cachedModels;
        }

        return (PROVIDER_MODEL_OPTIONS['Ollama'] as any[]).map(m => typeof m === 'string' ? m : m.name);
    }

    /**
     * Fetch ALL models from OpenRouter API with caching
     * Includes ALL models - preview, beta, and stable releases
     * Only filters out truly deprecated models
     */
    private async fetchOpenRouterModels(bypassCache = false): Promise<string[]> {
        // Check if we have cached models that are still valid
        const cacheKey = 'OpenRouter';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();

        // If we have valid cached models and we're not bypassing cache, return them
        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            logger.debug(`Using ${cachedModels.length} cached OpenRouter models (${Math.round((now - cachedTimestamp) / 1000 / 60)} minutes old)`, 'AIService');
            return cachedModels;
        }

        // Otherwise, fetch ALL fresh models from API
        try {
            logger.debug('Fetching ALL OpenRouter models from API', 'AIService');
            const response = await this.httpClient.get('https://openrouter.ai/api/v1/models', {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.data && Array.isArray(data.data)) {
                    logger.debug(`OpenRouter API returned ${data.data.length} total models`, 'AIService');

                    // Get ALL models, only filter out explicitly deprecated ones
                    const models = data.data
                        .filter((m: any) => {
                            const id = m.id || '';
                            // Only filter out models explicitly marked as deprecated
                            if (id.includes('-deprecated') || id.includes('-legacy') || id.includes('-old')) {
                                return false;
                            }
                            // Keep models even if inactive (they might be temporarily unavailable)
                            // This ensures preview/beta models are included
                            return true;
                        })
                        .sort((a: any, b: any) => {
                            // Sort by context length (higher is better)
                            return (b.context_length || 0) - (a.context_length || 0);
                        })
                        .map((m: any) => m.id)
                        .filter((id: string) => id);

                    logger.debug(`After filtering: ${models.length} models from OpenRouter (including preview/beta)`, 'AIService');
                    return models;
                }
            } else {
                logger.warn(`OpenRouter API returned status ${response.status}: ${response.statusText}`, 'AIService');
            }
        } catch (error) {
            logger.warn('OpenRouter API error, using cached list or fallback', 'AIService');
        }

        // Fallback: return cached models if available (even if expired), or static list
        if (cachedModels && cachedModels.length > 0) {
            logger.debug(`Using expired cache of ${cachedModels.length} OpenRouter models as fallback`, 'AIService');
            return cachedModels;
        }

        return (PROVIDER_MODEL_OPTIONS['OpenRouter'] as any[]).map(m => typeof m === 'string' ? m : m.name);
    }

    /**
     * Fetch popular text generation models from Hugging Face with caching
     * Filters out deprecated/inactive models
     */
    private async fetchHuggingFaceModels(bypassCache = false): Promise<string[]> {
        // Check if we have cached models that are still valid
        const cacheKey = 'Hugging Face';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();

        // If we have valid cached models and we're not bypassing cache, return them
        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            logger.debug(`Using ${cachedModels.length} cached HuggingFace models (${Math.round((now - cachedTimestamp) / 1000 / 60)} minutes old)`, 'AIService');
            return cachedModels;
        }

        // Otherwise, fetch ALL fresh models from API
        try {
            logger.debug('Fetching ALL HuggingFace models from API', 'AIService');
            // Fetch more models to include all available models
            const response = await this.httpClient.get(
                'https://huggingface.co/api/models?pipeline_tag=text-generation&inference=warm&sort=downloads&limit=500',
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    logger.debug(`HuggingFace API returned ${data.length} total models`, 'AIService');

                    // Get ALL models, only filter out truly deprecated ones
                    const models = data
                        .filter((m: any) => {
                            const id = m.id || '';
                            // Only filter out explicitly deprecated models
                            if (m.disabled === true) return false;
                            if (m.private) return false;
                            if (id.includes('-legacy') || id.includes('-old') || id.includes('-deprecated')) return false;
                            // Include gated models (user may have access)
                            return true;
                        })
                        .map((m: any) => m.id);

                    logger.debug(`After filtering: ${models.length} models from HuggingFace (including preview/beta)`, 'AIService');
                    if (models.length > 0) return models;
                }
            } else {
                logger.warn(`HuggingFace API returned status ${response.status}: ${response.statusText}`, 'AIService');
            }
        } catch (error) {
            logger.warn('HuggingFace API error, using cached list or fallback', 'AIService');
        }

        // Fallback: return cached models if available (even if expired), or static list
        if (cachedModels && cachedModels.length > 0) {
            logger.debug(`Using expired cache of ${cachedModels.length} HuggingFace models as fallback`, 'AIService');
            return cachedModels;
        }

        // Return curated list of models known to work with inference API (prioritizing multimodal)
        return [
            // Multimodal models first
            'Qwen/Qwen2-VL-7B-Instruct',
            'Qwen/Qwen2-VL-2B-Instruct',
            'meta-llama/Llama-3.2-11B-Vision-Instruct',
            'meta-llama/Llama-3.2-90B-Vision-Instruct',
            'microsoft/Phi-3.5-vision-instruct',
            'llava-hf/llava-1.5-7b',
            'llava-hf/llava-1.5-13b',
            // Text models
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
     * Fetch ALL models from Groq API with caching
     * Includes ALL models - preview, beta, and stable releases
     */
    private async fetchGroqModels(bypassCache = false): Promise<string[]> {
        // Check if we have cached models that are still valid
        const cacheKey = 'Groq';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();

        // If we have valid cached models and we're not bypassing cache, return them
        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            logger.debug(`Using ${cachedModels.length} cached Groq models (${Math.round((now - cachedTimestamp) / 1000 / 60)} minutes old)`, 'AIService');
            return cachedModels;
        }

        // Otherwise, fetch ALL fresh models from Groq API
        try {
            logger.debug('Fetching ALL Groq models from API', 'AIService');

            // Prepare headers with API key if available
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.settings.groqApiKey) {
                headers['Authorization'] = `Bearer ${this.settings.groqApiKey}`;
                logger.debug('Using Groq API key for authentication', 'AIService');
            } else {
                logger.warn('No Groq API key found - models fetch may fail', 'AIService');
            }

            const response = await this.httpClient.get('https://api.groq.com/openai/v1/models', {
                headers
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.data && Array.isArray(data.data)) {
                    logger.debug(`Groq API returned ${data.data.length} total models`, 'AIService');

                    // Get ALL models, only filter out explicitly deprecated ones
                    const models = data.data
                        .filter((m: any) => {
                            const id = m.id || m.name || '';
                            // Only filter out models explicitly marked as deprecated
                            if (id.includes('-deprecated') || id.includes('-legacy') || id.includes('-old')) {
                                logger.debug(`Filtering out deprecated model: ${id}`, 'AIService');
                                return false;
                            }
                            // Keep all other models including preview/beta
                            // Groq may have models marked as inactive but they could be temporarily unavailable
                            return true;
                        })
                        .map((m: any) => m.id || m.name)
                        .filter((id: string) => id);

                    logger.debug(`After filtering: ${models.length} models from Groq (including preview/beta)`, 'AIService');
                    logger.debug(`Groq models: ${JSON.stringify(models)}`, 'AIService');
                    return models;
                }
            } else {
                logger.warn(`Groq API returned status ${response.status}: ${response.statusText}`, 'AIService');
            }
        } catch (error) {
            logger.warn('Groq API error, using cached list or fallback', 'AIService');
        }

        // Fallback: return cached models if available (even if expired), or static list
        if (cachedModels && cachedModels.length > 0) {
            logger.debug(`Using expired cache of ${cachedModels.length} Groq models as fallback`, 'AIService');
            return cachedModels;
        }

        return (PROVIDER_MODEL_OPTIONS['Groq'] as any[]).map(m => typeof m === 'string' ? m : m.name);
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

                // Try primary model first
                try {
                    const content = await this.processWithProvider(provider, prompt, images);

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
                    }
                } catch (modelError) {
                    const err = modelError as Error;
                    logger.warn(`Primary model ${provider.model} failed for ${provider.name}`, 'AIService', {
                        error: err.message
                    });

                    // Try fallback models if available
                    const fallbackContent = await this.tryFallbackModels(provider, prompt, images);
                    if (fallbackContent) {
                        return fallbackContent;
                    }

                    // If fallback models also failed, continue to next provider
                    throw err;
                }
            } catch (error) {
                lastError = error as Error;
                logger.warn(`${provider.name} failed with all models`, 'AIService', {
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
     * Process with a specific provider and current model
     */
    private async processWithProvider(provider: AIProvider, prompt: string, images?: (string | ArrayBuffer)[]): Promise<string> {
        if (images && images.length > 0 && provider.processWithImage) {
            return await RetryService.withRetry(
                () => provider.processWithImage!(prompt, images),
                `${provider.name}-process-multimodal`,
                2, // 2 attempts per model
                2000 // 2 second base delay
            );
        } else {
            return await RetryService.withRetry(
                () => provider.process(prompt),
                `${provider.name}-process`,
                2, // 2 attempts per model
                2000 // 2 second base delay
            );
        }
    }

    /**
     * Try fallback models for a provider when primary model fails
     */
    private async tryFallbackModels(provider: AIProvider, prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse | null> {
        const availableModels = this.getProviderModels(provider.name);
        const fallbackModels = availableModels.filter(m => m !== provider.model);

        if (fallbackModels.length === 0) {
            logger.info(`No fallback models available for ${provider.name}`, 'AIService');
            return null;
        }

        logger.info(`Trying ${fallbackModels.length} fallback models for ${provider.name}`, 'AIService');

        // Try up to 3 fallback models
        const modelsToTry = fallbackModels.slice(0, 3);

        for (const fallbackModel of modelsToTry) {
            try {
                logger.info(`Trying fallback model ${fallbackModel} for ${provider.name}`, 'AIService');

                // Temporarily set the fallback model if supported
                const originalModel = provider.model;
                if (typeof (provider as any).setModel === 'function') {
                    (provider as any).setModel(fallbackModel);
                }

                const content = await this.processWithProvider(provider, prompt, images);

                if (content && content.trim().length > 0) {
                    logger.info(`Fallback to ${fallbackModel} succeeded for ${provider.name}`, 'AIService', {
                        contentLength: content.length
                    });

                    return {
                        content,
                        provider: provider.name,
                        model: fallbackModel
                    };
                }
            } catch (fallbackError) {
                logger.warn(`Fallback model ${fallbackModel} failed for ${provider.name}`, 'AIService', {
                    error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                });
            } finally {
                // Restore original model
                if (typeof (provider as any).setModel === 'function') {
                    (provider as any).setModel(provider.model);
                }
            }
        }

        logger.warn(`All fallback models failed for ${provider.name}`, 'AIService');
        return null;
    }

    /**
     * Process prompt with parallel provider racing for maximum speed
     */
    private async processParallel(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        const providerPromises = this.providers.map(async (provider) => {
            try {
                // Try primary model first
                try {
                    const content = await this.processWithProvider(provider, prompt, images);

                    if (content && content.trim().length > 0) {
                        return {
                            content,
                            provider: provider.name,
                            model: provider.model,
                            success: true,
                            responseTime: Date.now()
                        };
                    }
                } catch (primaryError) {
                    // If primary model fails, try fallback models in parallel
                    const fallbackResponse = await this.tryFallbackModels(provider, prompt, images);
                    if (fallbackResponse) {
                        return {
                            content: fallbackResponse.content,
                            provider: fallbackResponse.provider,
                            model: fallbackResponse.model,
                            success: true,
                            responseTime: Date.now()
                        };
                    }
                    throw primaryError;
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
     * Process prompt using a specific provider name with optional automatic fallback.
     * If enableFallback is true and the selected provider fails, tries other models first, then other providers.
     */
    async processWith(providerName: string, prompt: string, overrideModel?: string, images?: (string | ArrayBuffer)[], enableFallback: boolean = true): Promise<AIResponse> {
        const provider = this.providers.find(p => p.name === providerName);
        if (!provider) {
            throw new Error(`AI provider not found: ${providerName}`);
        }

        try {
            // If provider supports setModel, apply override
            const originalModel = provider.model;
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

            // If fallback is disabled, throw immediately
            if (!enableFallback) {
                throw new Error(MESSAGES.ERRORS.AI_PROCESSING(err.message));
            }

            // First try fallback models within the same provider
            if (overrideModel || !this.isQuotaOrRateLimitError(err)) {
                logger.info(`Primary model failed for ${providerName}, trying fallback models`, 'AIService', {
                    error: err.message
                });

                const fallbackResponse = await this.tryFallbackModels(provider, prompt, images);
                if (fallbackResponse) {
                    return fallbackResponse;
                }
            }

            // If model fallback failed or not applicable, try other providers
            if (this.isQuotaOrRateLimitError(err) || (!overrideModel && err)) {
                logger.warn(`${providerName} failed, trying fallback providers`, 'AIService', {
                    error: err.message
                });

                // Get other providers (excluding the failed one)
                const fallbackProviders = this.providers.filter(p => p.name !== providerName);

                if (fallbackProviders.length > 0) {
                    for (const fallbackProvider of fallbackProviders) {
                        try {
                            logger.info(`Trying fallback provider: ${fallbackProvider.name}`, 'AIService');

                            // First try primary model of fallback provider
                            const content = await this.processWithProvider(fallbackProvider, prompt, images);

                            if (content && content.trim().length > 0) {
                                logger.info(`Fallback to ${fallbackProvider.name} succeeded`, 'AIService');
                                return {
                                    content,
                                    provider: fallbackProvider.name,
                                    model: fallbackProvider.model
                                };
                            }

                            // If primary model fails, try fallback models for this provider
                            const modelFallbackResponse = await this.tryFallbackModels(fallbackProvider, prompt, images);
                            if (modelFallbackResponse) {
                                return modelFallbackResponse;
                            }
                        } catch (fallbackError) {
                            logger.warn(`Fallback provider ${fallbackProvider.name} also failed`, 'AIService', {
                                error: (fallbackError as Error).message
                            });
                            // Continue to next fallback provider
                        }
                    }
                }
            }

            // All fallbacks failed, throw original error with note about fallbacks
            throw new Error(`${err.message} (All fallback providers and models also failed)`);
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
