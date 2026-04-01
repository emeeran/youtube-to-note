/**
 * AI Service - Unified AI processing service
 * Handles provider management, request processing, and fallback strategies
 */

import { AIProvider, AIResponse, YouTubePluginSettings } from '../types';
import { PROVIDER_MODEL_OPTIONS, type ProviderModelEntry } from '../ai/api';

export class AIService {
    private providerMap: Map<string, AIProvider> = new Map();

    constructor(
        providers: AIProvider[],
        private settings: YouTubePluginSettings
    ) {
        if (!providers || providers.length === 0) {
            throw new Error('At least one AI provider is required');
        }
        providers.forEach(p => this.providerMap.set(p.name, p));
    }

    /**
     * Process prompt with the first available provider
     */
    async process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
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
        enableFallback = true
    ): Promise<AIResponse> {
        const provider = this.providerMap.get(providerName);
        if (!provider) {
            throw new Error(`Provider "${providerName}" not found`);
        }

        if (overrideModel && provider.setModel) {
            provider.setModel(overrideModel);
        }

        try {
            const content = await provider.process(prompt);
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
                            const content = await fallbackProvider.process(prompt);
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
        return models.map(m => typeof m === 'string' ? m : m.name);
    }

    /**
     * Fetch all available models for all providers
     */
    async fetchLatestModels(): Promise<Record<string, string[]>> {
        const result: Record<string, string[]> = {};
        for (const providerName of this.getProviderNames()) {
            result[providerName] = this.getProviderModels(providerName);
        }
        return result;
    }

    /**
     * Fetch models for a specific provider
     */
    async fetchLatestModelsForProvider(_providerName: string, _bypassCache?: boolean): Promise<string[]> {
        // Return static model list - dynamic fetching not implemented
        return this.getProviderModels(_providerName);
    }

    /**
     * Update settings
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = newSettings;
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
