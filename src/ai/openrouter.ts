import { AI_MODELS } from '../constants/index';
import { BaseAIProvider } from './base';
import type { AIRequestOptions } from '../types';
import { extractRetryTime } from './error-utils';

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
    const retryInfo = extractRetryTime(rawMessage);

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
        super(apiKey, model ?? AI_MODELS.OPENROUTER, timeout);
        this.siteUrl = 'https://github.com/user/yt-clipper';
        this.siteName = 'YouTube Clipper Obsidian Plugin';
    }

    // eslint-disable-next-line complexity, max-lines-per-function
    async process(prompt: string, options?: AIRequestOptions): Promise<string> {
        try {
            this.requireApiKey('OpenRouter API key is required. Get one at openrouter.ai/keys');

            const response = await this.fetchGeneration(
                OPENROUTER_API_URL,
                {
                    method: 'POST',
                    headers: this.createHeaders(),
                    body: JSON.stringify(this.createRequestBody(prompt, options)),
                },
                options,
            );

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
                const errorData = (await this.safeJsonParse(response)) as any;
                const errorMessage = errorData?.error?.message || '';
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

    protected createRequestBody(prompt: string, options?: AIRequestOptions): any {
        return this.openAIChatBody(
            prompt,
            options,
            'You are an expert content analyzer specializing in extracting practical value and creating actionable guides from video content. Focus on clarity, practicality, and immediate implementability.',
        );
    }

    /** Live-fetch available model ids from OpenRouter's /models endpoint. */
    async listModels(): Promise<string[]> {
        // The models list is public; include auth so private/free eligibility is reflected.
        return this.fetchModelIds(
            'https://openrouter.ai/api/v1/models',
            {
                method: 'GET',
                headers: { Authorization: `Bearer ${this.apiKey}` },
            },
            'OpenRouter models request failed',
            data => {
                const list = (data as { data?: Array<{ id?: string }> }).data ?? [];
                return list.map(m => m.id);
            },
        );
    }
}
