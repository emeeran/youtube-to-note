/**
 * AI Provider Strategy Interface - Open/Closed Principle
 * Defines common interface for all AI provider strategies
 * New providers can be added without modifying existing code
 */

export interface AIProcessingOptions {
    url: string;
    transcript?: string;
    customPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    signal?: AbortSignal;
}

export interface AIProcessingResult {
    success: boolean;
    content?: string;
    model?: string;
    error?: string;
    metadata?: Record<string, any>;
}

export interface AIProviderCapabilities {
    supportsTranscriptProcessing: boolean;
    supportsCustomPrompts: boolean;
    supportsMaxTokens: boolean;
    supportsTemperature: boolean;
    supportsTimeout: boolean;
    supportsAbort: boolean;
    defaultTimeout: number;
    maxTokens?: number;
}

export interface AIProviderConfig {
    name: string;
    apiKey: string;
    model?: string;
    baseUrl?: string;
    timeout?: number;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Abstract base class for AI provider strategies
 * Implements the Strategy pattern for extensibility
 */
export abstract class AIProviderStrategy {
    protected config: AIProviderConfig;

    constructor(config: AIProviderConfig) {
        this.config = config;
    }

    /**
     * Get provider capabilities
     */
    abstract getCapabilities(): AIProviderCapabilities;

    /**
     * Process content using this provider
     */
    abstract process(options: AIProcessingOptions): Promise<AIProcessingResult>;

    /**
     * Get available models for this provider
     */
    abstract getAvailableModels(): Promise<string[]>;

    /**
     * Validate that the provider configuration is valid
     */
    abstract validateConfig(): boolean;

    /**
     * Update provider configuration
     */
    updateConfig(newConfig: Partial<AIProviderConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): AIProviderConfig {
        return { ...this.config };
    }

    /**
     * Get provider name
     */
    getName(): string {
        return this.config.name;
    }

    /**
     * Check if provider supports a specific capability
     */
    hasCapability(capability: keyof AIProviderCapabilities): boolean {
        return this.getCapabilities()[capability];
    }

    /**
     * Apply processing options with capability validation
     */
    protected applyCapabilities(options: AIProcessingOptions): AIProcessingOptions {
        const capabilities = this.getCapabilities();
        const result: AIProcessingOptions = { ...options };

        // Only apply options that are supported
        if (!capabilities.supportsCustomPrompts) {
            delete result.customPrompt;
        }
        if (!capabilities.supportsMaxTokens) {
            delete result.maxTokens;
        }
        if (!capabilities.supportsTemperature) {
            delete result.temperature;
        }
        if (!capabilities.supportsTimeout) {
            delete result.timeout;
        }
        if (!capabilities.supportsAbort) {
            delete result.signal;
        }

        return result;
    }

    /**
     * Create standard error response
     */
    protected createError(error: Error | string, context?: string): AIProcessingResult {
        const errorMessage = error instanceof Error ? error.message : error;
        return {
            success: false,
            error: context ? `${context}: ${errorMessage}` : errorMessage
        };
    }

    /**
     * Create successful response
     */
    protected createSuccess(content: string, metadata?: Record<string, any>): AIProcessingResult {
        return {
            success: true,
            content,
            model: this.config.model,
            metadata
        };
    }
}