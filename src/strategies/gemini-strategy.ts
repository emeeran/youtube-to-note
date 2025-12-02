/**
 * Gemini AI Provider Strategy - Concrete implementation
 * Handles Google Gemini API interactions
 */

import { AIProviderStrategy, AIProcessingOptions, AIProcessingResult, AIProviderCapabilities, AIProviderConfig } from './ai-provider-strategy';

export interface GeminiConfig extends AIProviderConfig {
    enableMultimodal?: boolean;
    maxOutputTokens?: number;
}

export class GeminiStrategy extends AIProviderStrategy {
    private readonly BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
    private readonly DEFAULT_MODEL = 'gemini-2.5-pro';
    private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

    constructor(config: GeminiConfig) {
        super({
            ...config,
            model: config.model || DEFAULT_MODEL,
            timeout: config.timeout || DEFAULT_TIMEOUT
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
            maxTokens: this.config.maxTokens || 8192
        };
    }

    async process(options: AIProcessingOptions): Promise<AIProcessingResult> {
        try {
            const validatedOptions = this.applyCapabilities(options);

            // Build request body based on available data
            const requestBody = this.buildRequestBody(validatedOptions);

            // Make API call
            const response = await this.makeAPICall(requestBody, validatedOptions.signal);

            // Extract and return content
            const content = this.extractContent(response);

            return this.createSuccess(content, {
                provider: 'gemini',
                model: this.config.model,
                processingTime: Date.now()
            });

        } catch (error) {
            return this.createError(error as Error, 'Gemini processing failed');
        }
    }

    async getAvailableModels(): Promise<string[]> {
        // In a real implementation, this would fetch from the Gemini API
        return [
            'gemini-2.5-pro',
            'gemini-2.5-pro-tts',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.0-pro',
            'gemini-2.0-flash'
        ];
    }

    validateConfig(): boolean {
        return !!(this.config.apiKey &&
                this.config.apiKey.startsWith('AIza') &&
                this.config.apiKey.length > 10);
    }

    private buildRequestBody(options: AIProcessingOptions): any {
        const body: any = {
            contents: [{
                parts: []
            }],
            generationConfig: {
                temperature: options.temperature || 0.5,
                maxOutputTokens: options.maxTokens || 4096,
            },
            safetySettings: this.getDefaultSafetySettings()
        };

        // Add content parts
        const parts = body.contents[0].parts;

        if (options.url) {
            parts.push({
                text: `Process this YouTube video: ${options.url}`
            });
        }

        if (options.transcript) {
            parts.push({
                text: `Transcript: ${options.transcript}`
            });
        }

        if (options.customPrompt) {
            parts.push({
                text: options.customPrompt
            });
        }

        // If no specific content provided, add a default prompt
        if (parts.length === 0) {
            parts.push({
                text: 'Please process this content.'
            });
        }

        return body;
    }

    private async makeAPICall(requestBody: any, signal?: AbortSignal): Promise<any> {
        const url = `${this.BASE_URL}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    private extractContent(response: any): string {
        try {
            const candidates = response?.candidates;
            if (!candidates || candidates.length === 0) {
                throw new Error('No response candidates received');
            }

            const content = candidates[0]?.content;
            if (!content?.parts || content.parts.length === 0) {
                throw new Error('No content parts in response');
            }

            return content.parts.map((part: any) => part.text).join('\n');
        } catch (error) {
            throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getDefaultSafetySettings(): any[] {
        return [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
        ];
    }
}