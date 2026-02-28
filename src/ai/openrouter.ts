import { BaseAIProvider } from './base';
import type { OpenAICompatibleResponse, OpenRouterErrorResponse, OpenAICompatibleRequestBody } from '../types/api-responses';

/**
 * OpenRouter API provider implementation
 * OpenRouter provides access to many models (OpenAI, Anthropic, Meta, etc.)
 * via a unified API endpoint
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Extract clean error message from OpenRouter API response
 */
function formatOpenRouterError(rawMessage: string): string {
    const retryMatch = rawMessage.match(/retry in ([\d.]+)/i) ?? rawMessage.match(/(\d+)\s*seconds?/i);
    const retryInfo = retryMatch?.[1] ? ` Retry in ${Math.ceil(parseFloat(retryMatch[1]))}s.` : '';

    if (rawMessage.toLowerCase().includes('rate limit')) {
        return `OpenRouter rate limit reached.${retryInfo}`;
    }

    if (rawMessage.toLowerCase().includes('insufficient') || rawMessage.toLowerCase().includes('credits')) {
        return 'OpenRouter credits exhausted. Add credits at openrouter.ai/credits';
    }

    if (rawMessage.toLowerCase().includes('quota')) {
        return `OpenRouter quota exceeded.${retryInfo}`;
    }

    return `OpenRouter API error.${retryInfo}`;
}

export class OpenRouterProvider extends BaseAIProvider {
    readonly name = 'OpenRouter';
    private siteUrl: string;
    private siteName: string;

    constructor(apiKey: string, model?: string, timeout?: number) {
        // Default to a capable free/cheap model
        super(apiKey, model ?? 'meta-llama/llama-3.1-8b-instruct:free', timeout);
        this.siteUrl = 'https://github.com/user/yt-clipper';
        this.siteName = 'YouTube Clipper Obsidian Plugin';
    }

    // eslint-disable-next-line complexity, max-lines-per-function
    async process(prompt: string): Promise<string> {
        try {
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error('OpenRouter API key is required. Get one at openrouter.ai/keys');
            }

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(this.createRequestBody(prompt)),
            });

            if (response.status === 401) {
                throw new Error('OpenRouter API key is invalid. Please check your key at openrouter.ai/keys');
            }

            if (response.status === 402) {
                throw new Error('OpenRouter credits exhausted. Add credits at openrouter.ai/credits');
            }

            if (response.status === 403) {
                throw new Error('OpenRouter access denied. Your key may not have access to this model.');
            }

            if (response.status === 429) {
                const errorData = (await this.safeJsonParse(response)) as OpenRouterErrorResponse;
                const errorMessage = errorData?.error?.message ?? '';
                throw new Error(formatOpenRouterError(errorMessage));
            }

            if (!response.ok) {
                await this.handleAPIError(response);
            }

            const data = await response.json();

            if (!this.validateResponse(data, ['choices', '0', 'message', 'content'])) {
                throw new Error('Invalid response format from OpenRouter API');
            }

            return this.extractContent(data);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`OpenRouter processing failed: ${error}`);
        }
    }

    protected createHeaders(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.siteUrl,
            'X-Title': this.siteName,
        };
    }

    protected createRequestBody(prompt: string): OpenAICompatibleRequestBody {
        return {
            model: this._model,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert content analyzer specializing in extracting practical value and creating actionable guides from video content. Focus on clarity, practicality, and immediate implementability.',
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
