/**
 * AI Service - Unified AI processing service
 * Handles provider management, request processing, and fallback strategies
 */

import { AIProvider, AIRequestOptions, AIResponse, YouTubePluginSettings } from '../types';
import { PROVIDER_MODEL_OPTIONS } from '../ai/api';

export class AIService {
    private providerMap: Map<string, AIProvider> = new Map();
    private readonly modelCacheTTL = 1000 * 60 * 60; // 1 hour
    private modelCache = new Map<string, { models: string[]; ts: number }>();

    constructor(
        providers: AIProvider[],
        private settings: YouTubePluginSettings,
    ) {
        if (!providers || providers.length === 0) {
            throw new Error('At least one AI provider is required');
        }
        providers.forEach(p => this.providerMap.set(p.name, p));
    }

    /**
     * Process prompt with the first available provider
     */
    async process(prompt: string, _images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Valid prompt is required');
        }

        const provider = this.getFirstProvider();
        const content = await provider.process(prompt);
        return {
            content,
            provider: provider.name,
            model: provider.model || 'default',
        };
    }

    /**
     * Process with specific provider, with optional fallback
     */
    async processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[],
        enableFallback = true,
        options?: AIRequestOptions,
    ): Promise<AIResponse> {
        const provider = this.providerMap.get(providerName);
        if (!provider) {
            throw new Error(`Provider "${providerName}" not found`);
        }

        // Providers are shared singletons, so a model override must be restored
        // afterwards — otherwise it leaks into every later call and concurrent
        // runs clobber each other's model.
        const previousModel = provider.model;
        const applyModel = provider.setModel?.bind(provider);
        const modelWasOverridden = Boolean(overrideModel && applyModel);
        if (applyModel && overrideModel) {
            applyModel(overrideModel);
        }

        try {
            const content = await provider.process(prompt, options);
            return {
                content,
                provider: provider.name,
                model: provider.model || 'default',
            };
        } catch (error) {
            if (enableFallback) {
                // Try other providers as fallback
                for (const [name, fallbackProvider] of this.providerMap) {
                    if (name !== providerName) {
                        try {
                            const content = await fallbackProvider.process(prompt, options);
                            return {
                                content,
                                provider: fallbackProvider.name,
                                model: fallbackProvider.model || 'default',
                            };
                        } catch {
                            continue;
                        }
                    }
                }
            }
            throw error;
        } finally {
            if (applyModel && modelWasOverridden) {
                applyModel(previousModel);
            }
        }
    }

    /**
     * Get available provider names
     */
    getProviderNames(): string[] {
        return Array.from(this.providerMap.keys());
    }

    /**
     * Check if any providers are available
     */
    hasAvailableProviders(): boolean {
        return this.providerMap.size > 0;
    }

    /**
     * Get models for a specific provider from static options
     */
    getProviderModels(providerName: string): string[] {
        const models = PROVIDER_MODEL_OPTIONS[providerName] ?? [];
        return models.map(m => (typeof m === 'string' ? m : m.name));
    }

    /**
     * Fetch all available models for all providers (live where supported).
     */
    async fetchLatestModels(): Promise<Record<string, string[]>> {
        const result: Record<string, string[]> = {};
        await Promise.all(
            this.getProviderNames().map(async name => {
                result[name] = await this.fetchLatestModelsForProvider(name);
            }),
        );
        return result;
    }

    /**
     * Fetch models for a specific provider. Uses the provider's live `listModels`
     * when available (with a 1-hour in-memory cache, bypassable via `bypassCache`),
     * and falls back to the curated static list on error or for unsupported providers.
     */
    async fetchLatestModelsForProvider(providerName: string, bypassCache = false): Promise<string[]> {
        const provider = this.providerMap.get(providerName);
        const staticModels = this.getProviderModels(providerName);

        if (!provider || typeof provider.listModels !== 'function') {
            return staticModels;
        }

        if (!bypassCache) {
            const cached = this.modelCache.get(providerName);
            if (cached && Date.now() - cached.ts < this.modelCacheTTL) {
                return cached.models.length > 0 ? cached.models : staticModels;
            }
        }

        try {
            const live = await provider.listModels();
            const ordered = this.orderLiveModels(staticModels, live);
            const result = ordered.length > 0 ? ordered : staticModels;
            this.modelCache.set(providerName, { models: result, ts: Date.now() });
            return result;
        } catch {
            return staticModels;
        }
    }

    /**
     * Order live-fetched models so curated (known-good) models appear first in
     * their quality order, then any remaining live models alphabetically.
     */
    private orderLiveModels(curated: string[], live: string[]): string[] {
        const liveSet = new Set(live);
        const seen = new Set<string>();
        const ordered: string[] = [];

        for (const name of curated) {
            if (liveSet.has(name) && !seen.has(name)) {
                seen.add(name);
                ordered.push(name);
            }
        }
        const rest = live.filter(m => !seen.has(m)).sort((a, b) => a.localeCompare(b));
        return [...ordered, ...rest];
    }

    /**
     * Update settings
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = newSettings;
    }

    /**
     * Apply generation parameters (maxTokens / temperature) to every provider.
     */
    setModelParameters(params: { maxTokens?: number; temperature?: number }): void {
        for (const provider of this.providerMap.values()) {
            if (params.maxTokens !== undefined && provider.setMaxTokens) {
                provider.setMaxTokens(params.maxTokens);
            }
            if (params.temperature !== undefined && provider.setTemperature) {
                provider.setTemperature(params.temperature);
            }
        }
    }

    /**
     * Add a provider dynamically
     */
    addProvider(provider: AIProvider): void {
        this.providerMap.set(provider.name, provider);
    }

    /**
     * Remove a provider
     */
    removeProvider(providerName: string): boolean {
        return this.providerMap.delete(providerName);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): Record<string, unknown> {
        return {
            providerCount: this.providerMap.size,
            providers: this.getProviderNames(),
        };
    }

    /**
     * Cleanup when service is no longer needed
     */
    cleanup(): void {
        for (const provider of this.providerMap.values()) {
            if (typeof provider.cleanup === 'function') {
                try {
                    provider.cleanup();
                } catch {
                    // Ignore cleanup errors
                }
            }
        }
        this.providerMap.clear();
    }

    /**
     * Get the first available provider
     */
    private getFirstProvider(): AIProvider {
        const first = this.providerMap.values().next().value;
        if (!first) {
            throw new Error('No AI providers available');
        }
        return first;
    }
}
