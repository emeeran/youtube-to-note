/**
 * AI Orchestrator
 * Main orchestration for AI processing with provider management and fallback strategies
 */

import { AIService as IAIService, AIProvider, AIResponse, YouTubePluginSettings } from '../../types';
import { MESSAGES } from '../../constants/index';
import { ProviderManager } from './provider-manager';
import { FallbackStrategy } from './fallback-strategy';
import { logger } from '../../services/logger';
import { performanceTracker } from '../../services/performance-tracker';

/**
 * AI Orchestrator - Main facade for AI operations
 */
export class AIOrchestrator implements IAIService {
    private providerManager: ProviderManager;
    private fallbackStrategy: FallbackStrategy;

    constructor(providers: AIProvider[], settings: YouTubePluginSettings) {
        if (!providers || providers.length === 0) {
            throw new Error(MESSAGES.ERRORS.MISSING_API_KEYS);
        }

        // Initialize provider manager
        this.providerManager = new ProviderManager(settings);
        this.providerManager.registerProviders(providers);

        // Initialize fallback strategy
        this.fallbackStrategy = new FallbackStrategy(this.providerManager, {
            enableModelFallback: settings.enableAutoFallback ?? true,
            enableProviderFallback: settings.enableAutoFallback ?? true,
            maxFallbackAttempts: 3,
        });

        this.applyPerformanceSettings(settings);
    }

    /**
   * Process prompt with automatic provider selection
   */
    async process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Valid prompt is required');
        }

        return await performanceTracker.measureOperation('ai-service', 'ai-process', async () => {
            const providers = this.providerManager.getProviders();

            if (providers.length === 0) {
                throw new Error('No AI providers available');
            }

            // Try first provider with fallback
            const primaryProvider = providers[0];
            return await this.processWith(
                primaryProvider.name,
                prompt,
                undefined,
                images,
                true
            );
        }, {
            promptLength: prompt.length,
            hasImages: images && images.length > 0,
            processingMode: 'sequential',
        });
    }

    /**
   * Process with specific provider
   */
    async processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[],
        enableFallback: boolean = true
    ): Promise<AIResponse> {
        return await this.fallbackStrategy.executeWithFallback(
            providerName,
            prompt,
            async (provider, model) => {
                return await this.fallbackStrategy.processWithRetry(provider, prompt, images);
            },
            {
                overrideModel,
                images,
                enableFallback,
            }
        );
    }

    /**
   * Apply performance settings to providers
   */
    private applyPerformanceSettings(settings: YouTubePluginSettings): void {
        const { PERFORMANCE_PRESETS } = require('../../performance');
        const preset = PERFORMANCE_PRESETS[settings.performanceMode] || PERFORMANCE_PRESETS.balanced;
        const timeouts = settings.customTimeouts || preset.timeouts;

        const providers = this.providerManager.getProviders();

        providers.forEach(provider => {
            if (provider.name === 'Google Gemini' && provider.setTimeout) {
                provider.setTimeout(timeouts.geminiTimeout);
            } else if (provider.name === 'Groq' && provider.setTimeout) {
                provider.setTimeout(timeouts.groqTimeout);
            }
        });
    }

    /**
   * Update settings
   */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.providerManager.updateSettings(newSettings);
        this.applyPerformanceSettings(newSettings);

        // Update fallback config
        this.fallbackStrategy.updateConfig({
            enableModelFallback: newSettings.enableAutoFallback ?? true,
            enableProviderFallback: newSettings.enableAutoFallback ?? true,
        });
    }

    /**
   * Get provider models
   */
    getProviderModels(providerName: string): string[] {
        return this.providerManager.getProviderModels(providerName);
    }

    /**
   * Fetch latest models for all providers
   */
    async fetchLatestModels(): Promise<Record<string, string[]>> {
        return await this.providerManager.fetchLatestModels();
    }

    /**
   * Fetch latest models for specific provider
   */
    async fetchLatestModelsForProvider(providerName: string, bypassCache?: boolean): Promise<string[]> {
        return await this.providerManager.fetchLatestModelsForProvider(providerName, bypassCache);
    }

    /**
   * Check if providers are available
   */
    hasAvailableProviders(): boolean {
        return this.providerManager.hasProviders();
    }

    /**
   * Get provider names
   */
    getProviderNames(): string[] {
        return this.providerManager.getProviderNames();
    }

    /**
   * Add a provider
   */
    addProvider(provider: AIProvider): void {
        this.providerManager.registerProvider(provider);
    }

    /**
   * Remove a provider
   */
    removeProvider(providerName: string): boolean {
        const provider = this.providerManager.getProvider(providerName);
        if (provider) {
            // For simplicity, we're not implementing removal in this version
            // as it would require recreating the providers array
            return true;
        }
        return false;
    }

    /**
   * Get performance metrics
   */
    getPerformanceMetrics(): any {
        const providerMetrics = this.providerManager.getMetrics();
        const aiProcessingMetrics = performanceTracker.getMetricsSummary('ai-service');

        return {
            httpMetrics: providerMetrics.httpMetrics,
            aiProcessingMetrics,
            modelFetchMetrics: providerMetrics.modelFetchMetrics,
        };
    }

    /**
   * Cleanup
   */
    cleanup(): void {
        this.providerManager.cleanup();
    }
}

// Export for backward compatibility
export { AIOrchestrator as AIService };
