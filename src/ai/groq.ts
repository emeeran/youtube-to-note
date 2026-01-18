import { API_ENDPOINTS, AI_MODELS } from '../constants/index';
import { BaseAIProvider } from './base';
import { MESSAGES } from '../constants/index';
import type { OpenAICompatibleRequestBody, OpenAICompatibleResponse } from '../types/api-responses';

/**
 * Groq AI provider implementation
 */

/**
 * Extract clean error message from verbose API response
 */
function formatGroqError(rawMessage: string): string {
    // Extract retry time if present
    const retryMatch = rawMessage.match(/retry in ([\d.]+)/i) ?? rawMessage.match(/(\d+)\s*seconds?/i);
    const retryInfo = retryMatch ? ` Retry in ${Math.ceil(parseFloat(retryMatch[1]))}s.` : '';

    if (rawMessage.toLowerCase().includes('tokens per minute')) {
        return `Groq token limit reached.${retryInfo} Try a shorter video or wait.`;
    }

    if (rawMessage.toLowerCase().includes('requests per')) {
        return `Groq request limit reached.${retryInfo}`;
    }

    if (rawMessage.toLowerCase().includes('quota')) {
        return `Groq quota exceeded.${retryInfo} Check your plan at console.groq.com`;
    }

    return `Groq API limit reached.${retryInfo}`;
}

export class GroqProvider extends BaseAIProvider {
    readonly name = 'Groq';

    constructor(apiKey: string, model?: string, timeout?: number) {
        super(apiKey, model ?? AI_MODELS.GROQ, timeout);
    }

    async process(prompt: string): Promise<string> {
        const response = await fetch(API_ENDPOINTS.GROQ, {
            method: 'POST',
            headers: this.createHeaders(),
            body: JSON.stringify(this.createRequestBody(prompt)),
        });

        // Handle specific Groq errors
        if (response.status === 401) {
            throw new Error('Groq API key is invalid or missing. Please check your key.');
        }

        if (response.status === 402) {
            throw new Error('Groq API requires a paid plan. Please check your billing settings.');
        }

        if (response.status === 404) {
            throw new Error(MESSAGES.ERRORS.GROQ_MODEL_NOT_FOUND);
        }

        if (response.status === 429) {
            let errorMessage = '';
            try {
                const errorData = await response.json() as { error?: { message?: string }; message?: string };
                errorMessage = errorData?.error?.message ?? errorData?.message ?? '';
            } catch {
                // Ignore JSON parse errors
            }
            throw new Error(formatGroqError(errorMessage));
        }

        if (!response.ok) {
            await this.handleAPIError(response);
        }

        const data = (await response.json()) as OpenAICompatibleResponse;

        if (!this.validateResponse(data as unknown as Record<string, unknown>, ['choices', '0', 'message'])) {
            throw new Error('Invalid response format from Groq API');
        }

        return this.extractContent(data as unknown as Record<string, unknown>);
    }

    protected createHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };
    }

    protected createRequestBody(prompt: string): any {
        return {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert content analyzer specializing in extracting practical value and creating actionable guides from video content. Focus on clarity, practicality, and immediate implementability. Even with limited information, provide maximum value through structured analysis and practical recommendations.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: this._temperature,
            max_tokens: this._maxTokens,
            stream: false,
        };
    }

    protected extractContent(response: Record<string, unknown>): string {
        const content = (response.choices as OpenAICompatibleResponse['choices'])[0]?.message?.content;
        return content ? content.trim() : '';
    }
}
