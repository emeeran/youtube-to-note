/**
 * Provider Manager for AI services
 */

import { AIProvider, YouTubePluginSettings } from '../../types';

export class ProviderManager {
    private providers: AIProvider[] = [];

    constructor(private settings: YouTubePluginSettings) {}

    registerProvider(provider: AIProvider): void {
        this.providers.push(provider);
    }

    registerProviders(providers: AIProvider[]): void {
        this.providers.push(...providers);
    }

    getProvider(name: string): AIProvider | undefined {
        return this.providers.find(provider => provider.name === name);
    }

    getProviders(): AIProvider[] {
        return [...this.providers];
    }

    hasProviders(): boolean {
        return this.providers.length > 0;
    }

    getProviderNames(): string[] {
        return this.providers.map(provider => provider.name);
    }

    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = newSettings;
    }

    getMetrics(): {
        httpMetrics: Record<string, unknown>;
        modelFetchMetrics: Record<string, unknown>;
    } {
        return {
            httpMetrics: {},
            modelFetchMetrics: {},
        };
    }

    cleanup(): void {
        this.providers = [];
    }

    async fetchLatestModels(): Promise<Record<string, string[]>> {
        // Return empty object as default
        return {};
    }

    async fetchLatestModelsForProvider(providerName: string, bypassCache?: boolean): Promise<string[]> {
        // Return empty array as default
        return [];
    }
}