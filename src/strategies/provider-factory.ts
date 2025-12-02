/**
 * AI Provider Factory - Open/Closed Principle Implementation
 * Creates provider strategies without modifying existing code
 * New providers can be registered at runtime
 */

import { AIProviderStrategy, AIProviderConfig } from './ai-provider-strategy';
import { GeminiStrategy, GeminiConfig } from './gemini-strategy';
import { GroqStrategy, GroqConfig } from './groq-strategy';

export type ProviderType = 'gemini' | 'groq' | 'ollama' | 'custom';

export interface ProviderRegistration {
    type: ProviderType;
    name: string;
    strategyClass: new (config: AIProviderConfig) => AIProviderStrategy;
    defaultConfig?: Partial<AIProviderConfig>;
}

export class AIProviderFactory {
    private static registeredProviders = new Map<ProviderType, ProviderRegistration>();
    private static customStrategies = new Map<string, ProviderRegistration>();

    /**
     * Register built-in providers
     */
    static {
        // Register Gemini
        this.registerProvider({
            type: 'gemini',
            name: 'Google Gemini',
            strategyClass: GeminiStrategy,
            defaultConfig: {
                timeout: 30000,
                maxTokens: 8192,
                temperature: 0.5
            }
        });

        // Register Groq
        this.registerProvider({
            type: 'groq',
            name: 'Groq',
            strategyClass: GroqStrategy,
            defaultConfig: {
                timeout: 25000,
                maxTokens: 8192,
                temperature: 0.5
            }
        });
    }

    /**
     * Register a new provider type
     */
    static registerProvider(registration: ProviderRegistration): void {
        this.registeredProviders.set(registration.type, registration);
    }

    /**
     * Register a custom strategy instance
     */
    static registerCustomStrategy(name: string, registration: ProviderRegistration): void {
        this.customStrategies.set(name, registration);
    }

    /**
     * Create provider strategy from configuration
     */
    static createProvider(type: ProviderType, config: Partial<AIProviderConfig> = {}): AIProviderStrategy {
        const registration = this.registeredProviders.get(type);
        if (!registration) {
            throw new Error(`Unknown provider type: ${type}`);
        }

        // Merge with default configuration
        const finalConfig: AIProviderConfig = {
            ...registration.defaultConfig,
            ...config,
            name: config.name || registration.name
        };

        // Create strategy instance
        const strategy = new registration.strategyClass(finalConfig);

        // Validate configuration
        if (!strategy.validateConfig()) {
            throw new Error(`Invalid configuration for provider: ${registration.name}`);
        }

        return strategy;
    }

    /**
     * Create provider strategy from custom registration
     */
    static createCustomProvider(name: string, config: Partial<AIProviderConfig> = {}): AIProviderStrategy {
        const registration = this.customStrategies.get(name);
        if (!registration) {
            throw new Error(`Unknown custom provider: ${name}`);
        }

        // Merge with default configuration
        const finalConfig: AIProviderConfig = {
            ...registration.defaultConfig,
            ...config,
            name: config.name || registration.name
        };

        // Create strategy instance
        const strategy = new registration.strategyClass(finalConfig);

        // Validate configuration
        if (!strategy.validateConfig()) {
            throw new Error(`Invalid configuration for custom provider: ${registration.name}`);
        }

        return strategy;
    }

    /**
     * Create provider from settings
     */
    static createFromSettings(settings: {
        type?: ProviderType;
        name?: string;
        apiKey: string;
        model?: string;
        customConfig?: Partial<AIProviderConfig>;
    }): AIProviderStrategy {
        if (settings.name && this.customStrategies.has(settings.name)) {
            return this.createCustomProvider(settings.name, {
                apiKey: settings.apiKey,
                model: settings.model,
                ...settings.customConfig
            });
        }

        const type = settings.type || 'gemini';
        return this.createProvider(type, {
            apiKey: settings.apiKey,
            model: settings.model,
            ...settings.customConfig
        });
    }

    /**
     * Get all registered provider types
     */
    static getRegisteredTypes(): ProviderType[] {
        return Array.from(this.registeredProviders.keys());
    }

    /**
     * Get all registered providers
     */
    static getRegisteredProviders(): ProviderRegistration[] {
        return Array.from(this.registeredProviders.values());
    }

    /**
     * Get custom strategies
     */
    static getCustomStrategies(): ProviderRegistration[] {
        return Array.from(this.customStrategies.values());
    }

    /**
     * Check if provider type is registered
     */
    static isProviderRegistered(type: ProviderType): boolean {
        return this.registeredProviders.has(type);
    }

    /**
     * Check if custom strategy is registered
     */
    static isCustomStrategyRegistered(name: string): boolean {
        return this.customStrategies.has(name);
    }

    /**
     * Get provider information
     */
    static getProviderInfo(type: ProviderType): ProviderRegistration | undefined {
        return this.registeredProviders.get(type);
    }

    /**
     * Validate provider configuration without creating instance
     */
    static validateConfig(type: ProviderType, config: Partial<AIProviderConfig>): boolean {
        try {
            const strategy = this.createProvider(type, config);
            return strategy.validateConfig();
        } catch {
            return false;
        }
    }

    /**
     * Get available models for a provider type
     */
    static async getAvailableModels(type: ProviderType): Promise<string[]> {
        try {
            const strategy = this.createProvider(type);
            return await strategy.getAvailableModels();
        } catch {
            return [];
        }
    }
}