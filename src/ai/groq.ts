import { API_ENDPOINTS, AI_MODELS } from '../constants/index';
import { BaseAIProvider } from './base';
import { MESSAGES } from '../constants/index';
import type { OpenAICompatibleResponse } from '../types/api-responses';

/**
 * Groq AI provider implementation
 */

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

        if (response.status === 402) {
            throw new Error('Groq API requires a paid plan. Please check your billing settings.');
        }

        if (response.status === 404) {
            throw new Error(MESSAGES.ERRORS.GROQ_MODEL_NOT_FOUND);
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
            Authorization: `Bearer ${this.apiKey}`,
        };
    }

    protected createRequestBody(prompt: string): any {
        return {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert content analyzer specializing in extracting practical value and creating actionable guides from video content. Focus on clarity, practicality, and immediate implementability. Even with limited information, provide maximum value through structured analysis and practical recommendations.',
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

    /** Live-fetch available model ids from Groq's /models endpoint. */
    async listModels(): Promise<string[]> {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            method: 'GET',
            headers: this.createHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Groq models request failed: ${response.status}`);
        }
        const data = (await response.json()) as { data?: Array<{ id?: string }> };
        return (data.data ?? []).map(m => m.id).filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
}
