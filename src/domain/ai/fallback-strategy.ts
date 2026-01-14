/**
 * Fallback Strategy for AI processing
 */

import { AIProvider, AIResponse } from '../../types';
import { ProviderManager } from './provider-manager';

export interface FallbackConfig {
    enableModelFallback?: boolean;
    enableProviderFallback?: boolean;
    maxFallbackAttempts?: number;
}

export class FallbackStrategy {
    constructor(
        private providerManager: ProviderManager,
        private config: FallbackConfig = {}
    ) {}

    async executeWithFallback(
        providerName: string,
        prompt: string,
        processor: (provider: AIProvider, model: string) => Promise<AIResponse>,
        options: {
            overrideModel?: string;
            images?: (string | ArrayBuffer)[];
            enableFallback?: boolean;
        } = {}
    ): Promise<AIResponse> {
        const { enableFallback = true } = options;

        if (!enableFallback) {
            const provider = this.providerManager.getProvider(providerName);
            if (!provider) {
                throw new Error(`Provider ${providerName} not found`);
            }

            return await processor(provider, provider.model || '');
        }

        // Try the requested provider first
        const provider = this.providerManager.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }

        try {
            return await processor(provider, provider.model || '');
        } catch (error) {
            // If fallback is enabled, try other providers
            if (enableFallback) {
                // Try other available providers as fallback
                const allProviders = this.providerManager.getProviders();
                for (const fallbackProvider of allProviders) {
                    if (fallbackProvider.name !== providerName) {
                        try {
                            return await processor(fallbackProvider, fallbackProvider.model || '');
                        } catch (fallbackError) {
                            // Continue to next provider
                            continue;
                        }
                    }
                }
            }

            // If all providers failed, throw the original error
            throw error;
        }
    }

    async processWithRetry(
        provider: AIProvider,
        prompt: string,
        images?: (string | ArrayBuffer)[]
    ): Promise<AIResponse> {
        // Implement retry logic with exponential backoff
        const maxRetries = this.config.maxFallbackAttempts ?? 3;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const content = await provider.process(prompt);
                return {
                    content,
                    provider: provider.name,
                    model: provider.model || 'default',
                };
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error; // Last attempt, re-throw the error
                }

                // Wait before retry with exponential backoff
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, etc.
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error('Retry attempts exhausted');
    }

    updateConfig(config: FallbackConfig): void {
        this.config = { ...this.config, ...config };
    }
}