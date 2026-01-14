/**
 * AI Orchestrator
 * Main orchestration for AI processing with provider management and fallback strategies
 */

import { AIService as IAIService, AIProvider, AIResponse, YouTubePluginSettings } from '../../types';
import { logger } from '../../services/logger';
import { MESSAGES } from '../../constants/messages';

/**
 * AI Orchestrator - Main facade for AI operations
 */
export class AIOrchestrator implements IAIService {
    constructor(private providers: AIProvider[], private settings: YouTubePluginSettings) {
        if (!providers || providers.length === 0) {
            throw new Error(MESSAGES.ERRORS.MISSING_API_KEYS);
        }
    }

    /**
     * Process prompt with automatic provider selection
     */
    async process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Valid prompt is required');
        }

        if (this.providers.length === 0) {
            throw new Error('No AI providers available');
        }

        // Use the first available provider
        const provider = this.providers[0];
        const content = await provider.process(prompt);
        return {
            content,
            provider: provider.name,
            model: provider.model || 'default',
        };
    }

    /**
     * Process with specific provider
     */
    async processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[],
        enableFallback: boolean = true,
    ): Promise<AIResponse> {
        if (!enableFallback) {
            const provider = this.providers.find(p => p.name === providerName);
            if (!provider) {
                throw new Error(`Provider ${providerName} not found`);
            }

            if (overrideModel && provider.setModel) {
                provider.setModel(overrideModel);
            }

            const content = await provider.process(prompt);
            return {
                content,
                provider: provider.name,
                model: provider.model || 'default',
            };
        }

        // Try the requested provider first
        const primaryProvider = this.providers.find(p => p.name === providerName);
        if (!primaryProvider) {
            throw new Error(`Provider ${providerName} not found`);
        }

        if (overrideModel && primaryProvider.setModel) {
            primaryProvider.setModel(overrideModel);
        }

        try {
            const content = await primaryProvider.process(prompt);
            return {
                content,
                provider: primaryProvider.name,
                model: primaryProvider.model || 'default',
            };
        } catch (error) {
            // If fallback is enabled, try other providers
            if (enableFallback) {
                // Try other available providers as fallback
                for (const fallbackProvider of this.providers) {
                    if (fallbackProvider.name !== providerName) {
                        try {
                            const content = await fallbackProvider.process(prompt);
                            return {
                                content,
                                provider: fallbackProvider.name,
                                model: fallbackProvider.model || 'default',
                            };
                        } catch (fallbackError) {
                            // Continue to next provider
                            continue;
                        }
                    }
                }
            }

            // If all attempts failed, throw the original error
            throw error;
        }
    }

    /**
     * Update settings
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = newSettings;
    }

    /**
     * Get provider models
     */
    getProviderModels(providerName: string): string[] {
        // Return empty array as default - providers should implement their own model listing
        return [];
    }

    /**
     * Fetch latest models for all providers
     */
    async fetchLatestModels(): Promise<Record<string, string[]>> {
        // Return empty object as default
        return {};
    }

    /**
     * Fetch latest models for specific provider
     */
    async fetchLatestModelsForProvider(providerName: string, bypassCache?: boolean): Promise<string[]> {
        // Return empty array as default
        return [];
    }

    /**
     * Check if providers are available
     */
    hasAvailableProviders(): boolean {
        return this.providers.length > 0;
    }

    /**
     * Get provider names
     */
    getProviderNames(): string[] {
        return this.providers.map(provider => provider.name);
    }

    /**
     * Add a provider
     */
    addProvider(provider: AIProvider): void {
        this.providers.push(provider);
    }

    /**
     * Remove a provider
     */
    removeProvider(providerName: string): boolean {
        const initialLength = this.providers.length;
        this.providers = this.providers.filter(provider => provider.name !== providerName);
        return this.providers.length < initialLength;
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): Record<string, unknown> {
        return {
            providerCount: this.providers.length,
        };
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        // Nothing to clean up by default
    }
}

// Export for backward compatibility
export { AIOrchestrator as AIService };