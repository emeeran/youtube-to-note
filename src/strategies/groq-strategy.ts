/**
 * Groq AI Provider Strategy - Concrete implementation
 * Handles Groq API interactions
 */

import { AIProviderStrategy, AIProcessingOptions, AIProcessingResult, AIProviderCapabilities, AIProviderConfig } from './ai-provider-strategy';

export interface GroqConfig extends AIProviderConfig {
    baseUrl?: string;
}

export class GroqStrategy extends AIProviderStrategy {
    private readonly DEFAULT_MODEL = 'llama-3.3-70b-versatile';
    private readonly DEFAULT_TIMEOUT = 25000; // 25 seconds
    private readonly BASE_URL = 'https://api.groq.com/openai/v1';

    constructor(config: GroqConfig) {
        super({
            ...config,
            model: config.model || DEFAULT_MODEL,
            timeout: config.timeout || DEFAULT_TIMEOUT,
            baseUrl: config.baseUrl || BASE_URL
        });
    }

    getCapabilities(): AIProviderCapabilities {
        return {
            supportsTranscriptProcessing: true,
            supportsCustomPrompts: true,
            supportsMaxTokens: true,
            supportsTemperature: true,
            supportsTimeout: true,
            supportsAbort: true,
            defaultTimeout: this.DEFAULT_TIMEOUT,
            maxTokens: 8192 // Groq typically has higher token limits
        };
    }

    async process(options: AIProcessingOptions): Promise<AIProcessingResult> {
        try {
            const validatedOptions = this.applyCapabilities(options);

            // Build request body for OpenAI-compatible API
            const requestBody = this.buildRequestBody(validatedOptions);

            // Make API call
            const response = await this.makeAPICall(requestBody, validatedOptions.signal);

            // Extract and return content
            const content = this.extractContent(response);

            return this.createSuccess(content, {
                provider: 'groq',
                model: this.config.model,
                processingTime: Date.now()
            });

        } catch (error) {
            return this.createError(error as Error, 'Groq processing failed');
        }
    }

    async getAvailableModels(): Promise<string[]> {
        // In a real implementation, this would fetch from the Groq API
        return [
            'llama-3.3-70b-versatile',
            'llama-3.1-70b-versatile',
            'llama-3.1-8b-instant',
            'llama-guard-3-8b',
            'mixtral-8x7b-32768'
        ];
    }

    validateConfig(): boolean {
        return !!(this.config.apiKey &&
                this.config.apiKey.startsWith('gsk_') &&
                this.config.apiKey.length > 10);
    }

    private buildRequestBody(options: AIProcessingOptions): any {
        // Build the system message
        const systemMessage = this.buildSystemMessage(options);

        // Build the user message
        const userMessage = this.buildUserMessage(options);

        return {
            model: this.config.model,
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: userMessage }
            ],
            temperature: options.temperature || 0.5,
            max_tokens: options.maxTokens || 4096,
            stream: false
        };
    }

    private buildSystemMessage(options: AIProcessingOptions): string {
        let message = 'You are a helpful AI assistant that processes YouTube video content. ';

        if (options.transcript) {
            message += 'You will be provided with video transcripts to analyze and summarize. ';
        }

        if (options.customPrompt) {
            message += 'Follow the specific instructions provided by the user. ';
        }

        message += 'Provide clear, well-structured responses.';

        return message;
    }

    private buildUserMessage(options: AIProcessingOptions): string {
        let message = '';

        if (options.url) {
            message += `YouTube URL: ${options.url}\n\n`;
        }

        if (options.transcript) {
            message += `Video Transcript:\n${options.transcript}\n\n`;
        }

        if (options.customPrompt) {
            message += `Specific Instructions:\n${options.customPrompt}\n\n`;
        } else {
            message += 'Please analyze this YouTube video content and provide a comprehensive summary.';
        }

        return message.trim();
    }

    private async makeAPICall(requestBody: any, signal?: AbortSignal): Promise<any> {
        const url = `${this.config.baseUrl}/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        return await response.json();
    }

    private extractContent(response: any): string {
        try {
            const choices = response?.choices;
            if (!choices || choices.length === 0) {
                throw new Error('No response choices received');
            }

            const message = choices[0]?.message;
            if (!message?.content) {
                throw new Error('No message content in response');
            }

            return message.content;
        } catch (error) {
            throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}