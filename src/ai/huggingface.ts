import { AI_MODELS } from '../constants/index';
import { BaseAIProvider } from './base';
import type { AIRequestOptions } from '../types';
import { sanitizeRemoteMessage } from './error-utils';

/**
 * Hugging Face Inference API provider implementation
 * Uses the new router endpoint (api-inference.huggingface.co is deprecated)
 */

const HUGGINGFACE_API_URL = 'https://router.huggingface.co/hf-inference/models';

/**
 * Extract clean error message from HuggingFace API response.
 * The body is server-controlled, so it is sanitized before it can reach a
 * user-facing notice.
 */
function formatHuggingFaceError(rawMessage: string): string {
    const message = sanitizeRemoteMessage(rawMessage);
    const retryMatch = message.match(/retry in ([\d.]+)/i) ?? message.match(/(\d+)\s*seconds?/i);
    const retryInfo = retryMatch ? ` Retry in ${Math.ceil(parseFloat(retryMatch[1]!))}s.` : '';

    if (message.toLowerCase().includes('rate limit')) {
        return `Hugging Face rate limit reached.${retryInfo}`;
    }

    if (message.toLowerCase().includes('loading')) {
        return 'Model is loading. Wait ~20s and try again.';
    }

    if (message.toLowerCase().includes('paused')) {
        return 'Model endpoint is paused. Try a different model like Qwen/Qwen3-8B';
    }

    if (message.toLowerCase().includes('quota')) {
        return `Hugging Face quota exceeded.${retryInfo}`;
    }

    return message || 'Hugging Face API error';
}

export class HuggingFaceProvider extends BaseAIProvider {
    readonly name = 'Hugging Face';

    constructor(apiKey: string, model?: string, timeout?: number) {
        // Default to Qwen3-8B which is reliable on HuggingFace inference
        super(apiKey, model ?? AI_MODELS.HUGGINGFACE, timeout);
    }

    // eslint-disable-next-line complexity, max-lines-per-function
    async process(prompt: string, options?: AIRequestOptions): Promise<string> {
        try {
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error('Hugging Face API key is required. Get one at huggingface.co/settings/tokens');
            }

            // Validate model name format
            if (!this._model?.includes('/')) {
                throw new Error(`Invalid model format: ${this._model}. Use format: owner/model-name`);
            }

            // Combine this provider's own timeout with any caller-supplied signal.
            const signal = this.requestSignal({ timeoutMs: this._timeout ?? 60000, signal: options?.signal });

            const response = await fetch(`${HUGGINGFACE_API_URL}/${this._model}`, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(this.createRequestBody(prompt)),
                signal,
            });

            // Check if response is HTML (error page) instead of JSON
            const contentType = response.headers.get('content-type') ?? '';
            if (contentType.includes('text/html')) {
                if (response.status === 401) {
                    throw new Error('Hugging Face API key is invalid or expired.');
                }
                throw new Error(`Hugging Face returned an error page (${response.status}). Check your API key.`);
            }

            if (response.status === 401) {
                throw new Error('Hugging Face API key is invalid. Please check your token.');
            }

            if (response.status === 400) {
                const errorData = (await this.safeJsonParse(response)) as any;
                const errorMessage = errorData?.error || '';
                throw new Error(formatHuggingFaceError(errorMessage));
            }

            if (response.status === 403) {
                throw new Error('Hugging Face access denied. Accept model terms at huggingface.co');
            }

            if (response.status === 404) {
                throw new Error(`Model not found: ${this._model}. Check the model name at huggingface.co`);
            }

            if (response.status === 429) {
                const errorData = (await this.safeJsonParse(response)) as any;
                const errorMessage = errorData?.error || '';
                throw new Error(formatHuggingFaceError(errorMessage));
            }

            if (response.status === 503) {
                const errorData = (await this.safeJsonParse(response)) as any;
                const estimatedTime = errorData?.estimated_time || 20;
                throw new Error(`Model is loading. Wait ${Math.ceil(estimatedTime)}s and try again.`);
            }

            if (!response.ok) {
                const errorData = (await this.safeJsonParse(response)) as any;
                const errorMsg = sanitizeRemoteMessage(errorData?.error || response.statusText);

                // Check for redirect message
                if (errorMsg.includes('router.huggingface.co')) {
                    throw new Error('HuggingFace API endpoint changed. Please update the plugin.');
                }

                throw new Error(`Hugging Face error (${response.status}): ${errorMsg}`);
            }

            const data = await response.json();
            return this.extractContent(data);
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                    if (options?.signal?.aborted) {
                        throw new Error('Request cancelled.');
                    }
                    throw new Error('Hugging Face request timed out. Try a smaller model.');
                }
                throw error;
            }
            throw new Error(`Hugging Face processing failed: ${error}`);
        }
    }

    protected createHeaders(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    protected createRequestBody(prompt: string): any {
        return {
            inputs: prompt,
            parameters: {
                max_new_tokens: this._maxTokens,
                temperature: this._temperature,
                do_sample: true,
            },
            options: {
                wait_for_model: true,
                use_cache: true,
            },
        };
    }

    protected extractContent(response: Record<string, unknown>): string {
        // HuggingFace returns an array of generated texts
        if (Array.isArray(response)) {
            const text = response[0]?.generated_text as string | undefined;
            return text ? text.trim() : '';
        }

        // Some models return a single object
        if (response?.generated_text) {
            return String(response.generated_text).trim();
        }

        throw new Error('Invalid response format from Hugging Face API');
    }
}
