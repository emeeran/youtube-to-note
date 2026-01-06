/**
 * Provider Manager
 * Manages AI provider registration, model fetching, and selection
 */

import { logger } from '../../services/logger';
import { AIProvider, YouTubePluginSettings } from '../../types';
import { PROVIDER_MODEL_OPTIONS } from '../../ai/api';
import { performanceTracker } from '../../services/performance-tracker';
import { OptimizedHttpClient } from '../../utils/http-client';
import { WebScraperService } from '../../services/web-scraper';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export class ProviderManager {
    private providers: AIProvider[] = [];
    private httpClient: OptimizedHttpClient;

    constructor(
    private settings: YouTubePluginSettings
    ) {
    // Initialize HTTP client
        const { PERFORMANCE_PRESETS } = require('../../performance');
        const preset = PERFORMANCE_PRESETS[settings.performanceMode] || PERFORMANCE_PRESETS.balanced;

        this.httpClient = new OptimizedHttpClient({
            timeout: preset.timeouts.geminiTimeout,
            retries: 2,
            retryDelay: 1000,
            maxConcurrent: settings.enableParallelProcessing ? 5 : 3,
            keepAlive: true,
            enableMetrics: true,
        });
    }

    /**
   * Register a provider
   */
    registerProvider(provider: AIProvider): void {
        this.providers.push(provider);
    }

    /**
   * Register multiple providers
   */
    registerProviders(providers: AIProvider[]): void {
        this.providers.push(...providers);
    }

    /**
   * Get all providers
   */
    getProviders(): AIProvider[] {
        return [...this.providers];
    }

    /**
   * Get provider by name
   */
    getProvider(name: string): AIProvider | undefined {
        return this.providers.find(p => p.name === name);
    }

    /**
   * Get provider names
   */
    getProviderNames(): string[] {
        return this.providers.map(p => p.name);
    }

    /**
   * Get available models for a provider
   */
    getProviderModels(providerName: string): string[] {
        const raw = PROVIDER_MODEL_OPTIONS[providerName] || [] as any[];
        return raw.map(r => typeof r === 'string' ? r : (r?.name ? r.name : String(r)));
    }

    /**
   * Fetch latest models for all providers
   */
    async fetchLatestModels(): Promise<Record<string, string[]>> {
        const result: Record<string, string[]> = {};
        const providers = this.getProviderNames();

        for (const p of providers) {
            try {
                const models = await this.fetchLatestModelsForProvider(p);
                result[p] = models.length > 0 ? models : this.getProviderModels(p);
            } catch (error) {
                logger.error(`Error fetching models for ${p}`, 'ProviderManager', {
                    error: error instanceof Error ? error.message : String(error),
                });
                result[p] = this.getProviderModels(p);
            }
        }

        return result;
    }

    /**
   * Fetch latest models for a specific provider
   */
    async fetchLatestModelsForProvider(providerName: string, bypassCache = false): Promise<string[]> {
        return await performanceTracker.measureOperation('ai-service', `fetch-models-${providerName}`, async () => {
            // Check cache first (unless bypassing)
            if (!bypassCache && WebScraperService.isCacheFresh(providerName)) {
                const cached = WebScraperService.getCachedModels().get(providerName);
                if (cached) {
                    logger.info(`Using cached models for ${providerName} (${WebScraperService.getCacheAge(providerName)})`, 'ProviderManager');
                    return cached.models;
                }
            }

            // Try to fetch from web/API for real-time data
            try {
                const webModels = await WebScraperService.fetchModelsFromWeb(providerName);
                if (webModels.length > 0) {
                    logger.info(`Fetched ${webModels.length} models from web for ${providerName}`, 'ProviderManager');
                    // Determine source based on provider
                    const source = (providerName === 'Ollama' || providerName === 'Ollama Cloud' ||
                                  providerName === 'OpenRouter') ? 'api' : 'web';
                    WebScraperService.saveCachedModels(providerName, webModels, source);
                    return webModels;
                }
            } catch (error) {
                logger.warn(`Web fetch failed for ${providerName}, falling back to API/static: ${error}`, 'ProviderManager');
            }

            // Fall back to provider-specific API methods
            if (providerName === 'Ollama') {
                return this.fetchOllamaModels(bypassCache);
            }
            if (providerName === 'Ollama Cloud') {
                return this.fetchOllamaCloudModels(bypassCache);
            }
            if (providerName === 'OpenRouter') {
                return this.fetchOpenRouterModels(bypassCache);
            }
            if (providerName === 'Hugging Face') {
                return this.fetchHuggingFaceModels(bypassCache);
            }
            if (providerName === 'Groq') {
                return this.fetchGroqModels(bypassCache);
            }
            if (providerName === 'Google Gemini') {
                return this.fetchGeminiModels(bypassCache);
            }

            // Final fallback to static options
            return this.getProviderModels(providerName);
        }, {
            provider: providerName,
            operation: 'fetchLatestModelsForProvider',
        });
    }

    /**
   * Fetch Ollama models
   */
    private async fetchOllamaModels(bypassCache = false): Promise<string[]> {
        const cacheKey = 'Ollama';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();
        const ollamaCacheDuration = 30 * 60 * 1000; // 30 minutes

        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < ollamaCacheDuration) {
            return cachedModels;
        }

        const userEndpoint = this.settings.ollamaEndpoint || 'http://localhost:11434';
        const isCloud = userEndpoint.includes('ollama.com') || userEndpoint.includes('cloud');
        const apiEndpoint = isCloud ? 'https://ollama.com/api' : userEndpoint;

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };

            if (isCloud && this.settings.ollamaApiKey) {
                headers['Authorization'] = `Bearer ${this.settings.ollamaApiKey}`;
            }

            const response = await fetch(`${apiEndpoint}/tags`, { method: 'GET', headers });

            if (response.ok) {
                const data = await response.json();
                if (data?.models && Array.isArray(data.models)) {
                    const modelNames = data.models
                        .map((model: any) => model.name || model.id || model.model || '')
                        .filter((name: string) => name !== '');
                    return modelNames;
                }
            }
        } catch (error) {
            logger.warn('Ollama fetch error', 'ProviderManager', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return cachedModels && cachedModels.length > 0 ? cachedModels : this.getProviderModels('Ollama');
    }

    /**
   * Fetch Ollama Cloud models
   */
    private async fetchOllamaCloudModels(bypassCache = false): Promise<string[]> {
        const cacheKey = 'Ollama Cloud';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();
        const ollamaCloudCacheDuration = 30 * 60 * 1000; // 30 minutes

        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < ollamaCloudCacheDuration) {
            return cachedModels;
        }

        // Ollama Cloud always uses the official cloud endpoint
        const apiEndpoint = 'https://ollama.com/api';

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };

            // Ollama Cloud requires API key
            if (this.settings.ollamaApiKey) {
                headers['Authorization'] = `Bearer ${this.settings.ollamaApiKey}`;
            } else {
                logger.warn('Ollama Cloud requires API key', 'ProviderManager');
                return this.getProviderModels('Ollama Cloud');
            }

            const response = await fetch(`${apiEndpoint}/tags`, { method: 'GET', headers });

            if (response.ok) {
                const data = await response.json();
                if (data?.models && Array.isArray(data.models)) {
                    const modelNames = data.models
                        .map((model: any) => model.name || model.id || model.model || '')
                        .filter((name: string) => name !== '');
                    return modelNames;
                }
            } else if (response.status === 401 || response.status === 403) {
                logger.warn('Ollama Cloud authentication failed', 'ProviderManager', {
                    status: response.status,
                });
            }
        } catch (error) {
            logger.warn('Ollama Cloud fetch error', 'ProviderManager', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return cachedModels && cachedModels.length > 0 ? cachedModels : this.getProviderModels('Ollama Cloud');
    }

    /**
   * Fetch OpenRouter models
   */
    private async fetchOpenRouterModels(bypassCache = false): Promise<string[]> {
        const cacheKey = 'OpenRouter';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();

        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            return cachedModels;
        }

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.settings.openRouterApiKey) {
                headers['Authorization'] = `Bearer ${this.settings.openRouterApiKey}`;
            }

            const response = await this.httpClient.get('https://openrouter.ai/api/v1/models', { headers });

            if (response.ok) {
                const data = await response.json();
                if (data?.data && Array.isArray(data.data)) {
                    const models = data.data
                        .filter((m: any) => {
                            const id = m.id || '';
                            return !id.includes('-deprecated') && !id.includes('-legacy') && !id.includes('-old');
                        })
                        .sort((a: any, b: any) => (b.context_length || 0) - (a.context_length || 0))
                        .map((m: any) => m.id)
                        .filter((id: string) => id);

                    return models;
                }
            }
        } catch (error) {
            logger.warn('OpenRouter API error', 'ProviderManager');
        }

        return cachedModels && cachedModels.length > 0 ? cachedModels : this.getProviderModels('OpenRouter');
    }

    /**
   * Fetch Hugging Face models
   */
    private async fetchHuggingFaceModels(bypassCache = false): Promise<string[]> {
        const cacheKey = 'Hugging Face';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();

        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            return cachedModels;
        }

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.settings.huggingFaceApiKey) {
                headers['Authorization'] = `Bearer ${this.settings.huggingFaceApiKey}`;
            }

            const response = await this.httpClient.get(
                'https://huggingface.co/api/models?pipeline_tag=text-generation&inference=warm&sort=downloads&limit=500',
                { headers }
            );

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    const models = data
                        .filter((m: any) => {
                            const id = m.id || '';
                            return !m.disabled && !m.private &&
                     !id.includes('-legacy') && !id.includes('-old') && !id.includes('-deprecated');
                        })
                        .map((m: any) => m.id);

                    if (models.length > 0) return models;
                }
            }
        } catch (error) {
            logger.warn('HuggingFace API error', 'ProviderManager');
        }

        return cachedModels && cachedModels.length > 0 ? cachedModels : this.getProviderModels('Hugging Face');
    }

    /**
   * Fetch Groq models
   */
    private async fetchGroqModels(bypassCache = false): Promise<string[]> {
        const cacheKey = 'Groq';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();

        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            return cachedModels;
        }

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.settings.groqApiKey) {
                headers['Authorization'] = `Bearer ${this.settings.groqApiKey}`;
            }

            const response = await this.httpClient.get('https://api.groq.com/openai/v1/models', { headers });

            if (response.ok) {
                const data = await response.json();
                if (data?.data && Array.isArray(data.data)) {
                    const models = data.data
                        .filter((m: any) => {
                            const id = m.id || m.name || '';
                            return !id.includes('-deprecated') && !id.includes('-legacy') && !id.includes('-old');
                        })
                        .map((m: any) => m.id || m.name)
                        .filter((id: string) => id);

                    return models;
                }
            }
        } catch (error) {
            logger.warn('Groq API error', 'ProviderManager');
        }

        return cachedModels && cachedModels.length > 0 ? cachedModels : this.getProviderModels('Groq');
    }

    /**
   * Fetch Google Gemini models
   */
    private async fetchGeminiModels(bypassCache = false): Promise<string[]> {
        const cacheKey = 'Google Gemini';
        const cachedModels = this.settings.modelOptionsCache?.[cacheKey];
        const cachedTimestamp = this.settings.modelCacheTimestamps?.[cacheKey];
        const now = Date.now();

        if (!bypassCache && cachedModels && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            return cachedModels;
        }

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.settings.geminiApiKey) {
                headers['x-goog-api-key'] = this.settings.geminiApiKey;
            }

            const response = await this.httpClient.get('https://generativelanguage.googleapis.com/v1beta/models', { headers });

            if (response.ok) {
                const data = await response.json();
                if (data?.models && Array.isArray(data.models)) {
                    const models = data.models
                        .filter((m: any) => {
                            const name = m.name || m.id || '';
                            return name.includes('gemini');
                        })
                        .map((m: any) => {
                            const name = m.name || m.id || '';
                            return name.replace('models/', '');
                        });

                    return models;
                }
            }
        } catch (error) {
            logger.warn('Gemini API error', 'ProviderManager', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return cachedModels && cachedModels.length > 0 ? cachedModels : this.getProviderModels('Google Gemini');
    }

    /**
   * Check if providers are available
   */
    hasProviders(): boolean {
        return this.providers.length > 0;
    }

    /**
   * Update settings
   */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = newSettings;
    }

    /**
   * Get performance metrics
   */
    getMetrics() {
        return {
            httpMetrics: this.httpClient.getMetrics(),
            modelFetchMetrics: Object.fromEntries(
                this.providers.map(provider => [
                    `fetch-models-${provider.name}`,
                    performanceTracker.getMetricsSummary(`fetch-models-${provider.name}`),
                ])
            ),
        };
    }

    /**
   * Cleanup
   */
    cleanup(): void {
        this.httpClient?.cleanup();
    }
}
