import { API_ENDPOINTS, AI_MODELS } from '../constants/index';
import { BaseAIProvider } from './base';
import { MESSAGES } from '../constants/index';
import type { AIRequestOptions } from '../types';
import type { OpenAICompatibleResponse } from '../types/api-responses';

/**
 * Groq AI provider implementation
 */

export class GroqProvider extends BaseAIProvider {
    readonly name = 'Groq';

    constructor(apiKey: string, model?: string, timeout?: number) {
        super(apiKey, model ?? AI_MODELS.GROQ, timeout);
    }

    async process(prompt: string, options?: AIRequestOptions): Promise<string> {
        const response = await this.fetchGeneration(
            API_ENDPOINTS.GROQ,
            {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(this.createRequestBody(prompt, options)),
            },
            options,
        );

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

    protected createRequestBody(prompt: string, options?: AIRequestOptions): any {
        return this.openAIChatBody(
            prompt,
            options,
            'You are an expert content analyzer specializing in extracting practical value and creating actionable guides from video content. Focus on clarity, practicality, and immediate implementability. Even with limited information, provide maximum value through structured analysis and practical recommendations.',
        );
    }

    /** Live-fetch available model ids from Groq's /models endpoint. */
    async listModels(): Promise<string[]> {
        return this.fetchModelIds(
            'https://api.groq.com/openai/v1/models',
            {
                method: 'GET',
                headers: this.createHeaders(),
            },
            'Groq models request failed',
            data => {
                const list = (data as { data?: Array<{ id?: string }> }).data ?? [];
                return list.map(m => m.id);
            },
        );
    }
}
