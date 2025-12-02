import { API_ENDPOINTS, AI_MODELS } from './constants/index';
import { BaseAIProvider } from './base';
import { MESSAGES } from '../utils/messages';

/**
 * Groq AI provider implementation
 */


export class GroqProvider extends BaseAIProvider {
    readonly name = 'Groq';

    constructor(apiKey: string, model?: string, timeout?: number) {
        super(apiKey, model || AI_MODELS.GROQ, timeout);
    }

    async process(prompt: string): Promise<string> {
        const response = await fetch(API_ENDPOINTS.GROQ, {
            method: 'POST',
            headers: this.createHeaders(),
            body: JSON.stringify(this.createRequestBody(prompt))
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
            try {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || errorData.message || '';

                if (errorMessage.toLowerCase().includes('quota')) {
                    throw new Error(`Groq API quota exceeded: ${errorMessage}. Please check your plan and billing details.`);
                } else if (errorMessage.toLowerCase().includes('rate')) {
                    throw new Error(`Groq API rate limit exceeded: ${errorMessage}. Please wait a moment and try again.`);
                } else {
                    throw new Error('Groq API rate limit exceeded. Please wait and try again.');
                }
            } catch {
                throw new Error('Groq API rate limit exceeded. Please wait and try again.');
            }
        }

        if (!response.ok) {
            await this.handleAPIError(response);
        }

        const data = await response.json();
        
        if (!this.validateResponse(data, ['choices', '0', 'message'])) {
            throw new Error('Invalid response format from Groq API');
        }

        return this.extractContent(data);
    }

    protected createHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };
    }

    protected createRequestBody(prompt: string): any {
        return {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert content analyzer specializing in extracting practical value and creating actionable guides from video content. Focus on clarity, practicality, and immediate implementability. Even with limited information, provide maximum value through structured analysis and practical recommendations.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: this._maxTokens,
            temperature: this._temperature
        };
    }

    protected extractContent(response: any): string {
        const content = response.choices[0].message.content;
        return content ? content.trim() : '';
    }
}
