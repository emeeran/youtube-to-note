import { AI_MODELS, API_ENDPOINTS } from '../constants/index';
import { BaseAIProvider } from './base';
import type { AIRequestOptions } from '../types';
import { sanitizeRemoteMessage } from './error-utils';

/**
 * Hugging Face provider implementation, speaking to HF's OpenAI-compatible
 * router (`/v1/chat/completions`). The older `api-inference` host is gone, and
 * the `/hf-inference/models/<id>` path it was replaced by no longer serves any
 * text-generation models — hf-inference hosts embeddings/classification only.
 * The router instead forwards each chat request to a partner provider that has
 * the model deployed server-side, so any model listed by `/v1/models` with a
 * live provider is usable.
 */

const HUGGINGFACE_MODELS_URL = 'https://router.huggingface.co/v1/models';

/**
 * Pull the human-readable message out of a router error body. The router
 * nests it (`{ error: { message, code } }`); some endpoints still return a
 * flat string (`{ error: "..." }`), so accept both.
 */
function extractRouterErrorMessage(errorData: unknown): string {
    const error = (errorData as { error?: unknown })?.error;
    if (typeof error === 'string') return error;
    const message = (error as { message?: unknown } | undefined)?.message;
    return typeof message === 'string' ? message : '';
}

/**
 * The router only serves models that at least one partner provider has
 * deployed — a model routed to a non-serverless endpoint (or one with no
 * live provider at all) fails with one of these markers rather than a 404.
 */
function isModelChoiceError(lower: string): boolean {
    return (
        lower.includes('not supported by provider') ||
        lower.includes('hf-inference') ||
        lower.includes('non-serverless') ||
        lower.includes('model_not_available') ||
        lower.includes('not available')
    );
}

/**
 * Extract clean error message from HuggingFace router response.
 * The body is server-controlled, so it is sanitized before it can reach a
 * user-facing notice.
 */
function formatHuggingFaceError(rawMessage: string): string {
    const message = sanitizeRemoteMessage(rawMessage);
    const lower = message.toLowerCase();
    const retryMatch = message.match(/retry in ([\d.]+)/i) ?? message.match(/(\d+)\s*seconds?/i);
    const retryInfo = retryMatch ? ` Retry in ${Math.ceil(parseFloat(retryMatch[1]!))}s.` : '';

    if (lower.includes('rate limit')) {
        return `Hugging Face rate limit reached.${retryInfo}`;
    }

    if (lower.includes('loading')) {
        return 'Model is loading. Wait ~20s and try again.';
    }

    if (lower.includes('paused')) {
        return 'Model endpoint is paused. Try a different model like Qwen/Qwen3.8-27B';
    }

    if (lower.includes('quota')) {
        return `Hugging Face quota exceeded.${retryInfo}`;
    }

    if (isModelChoiceError(lower)) {
        return (
            'This model is not available on the Hugging Face router. ' +
            'Pick another model in settings (refresh the model list) — e.g. Qwen/Qwen3.8-27B.'
        );
    }

    return message || 'Hugging Face API error';
}

type RouterModelEntry = {
    id?: string;
    providers?: Array<{ status?: string }>;
    architecture?: { output_modalities?: string[] };
};

export class HuggingFaceProvider extends BaseAIProvider {
    readonly name = 'Hugging Face';

    constructor(apiKey: string, model?: string, timeout?: number) {
        // Default to Qwen3.8-27B — verified live on the router end-to-end.
        super(apiKey, model ?? AI_MODELS.HUGGINGFACE, timeout);
    }

    /**
     * Live catalog from the router, filtered to models a partner provider
     * actually serves (`status: "live"`) with text output — listing includes
     * retired and non-chat entries that would just fail at request time.
     */
    async listModels(): Promise<string[]> {
        const response = await this.fetchWithTimeout(
            HUGGINGFACE_MODELS_URL,
            {
                method: 'GET',
                headers: this.createHeaders(),
            },
            'Hugging Face models request failed',
        );
        if (!response.ok) {
            throw new Error(`Hugging Face models request failed: ${response.status}`);
        }
        const data = (await response.json()) as { data?: RouterModelEntry[] };
        return (data.data ?? [])
            .filter(entry => {
                const live = (entry.providers ?? []).some(provider => provider.status === 'live');
                const outputs = entry.architecture?.output_modalities;
                const textOutput = !outputs || outputs.length === 0 || outputs.includes('text');
                return live && textOutput;
            })
            .map(entry => entry.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);
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

            // The shared helper applies this provider's timeout on top of any
            // caller-supplied signal, and labels a timeout with the provider name.
            const response = await this.fetchGeneration(
                API_ENDPOINTS.HUGGINGFACE,
                {
                    method: 'POST',
                    headers: this.createHeaders(),
                    body: JSON.stringify(this.createRequestBody(prompt, options)),
                },
                options,
            );

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
                const errorData = await this.safeJsonParse(response);
                throw new Error(formatHuggingFaceError(extractRouterErrorMessage(errorData)));
            }

            if (response.status === 403) {
                throw new Error('Hugging Face access denied. Accept model terms at huggingface.co');
            }

            if (response.status === 404) {
                throw new Error(`Model not found: ${this._model}. Check the model name at huggingface.co`);
            }

            if (response.status === 429) {
                const errorData = await this.safeJsonParse(response);
                throw new Error(formatHuggingFaceError(extractRouterErrorMessage(errorData)));
            }

            if (response.status === 503) {
                const errorData = await this.safeJsonParse(response);
                const estimatedTime = (errorData as { estimated_time?: number })?.estimated_time ?? 20;
                throw new Error(`Model is loading. Wait ${Math.ceil(estimatedTime)}s and try again.`);
            }

            if (!response.ok) {
                const errorData = await this.safeJsonParse(response);
                const errorMsg = sanitizeRemoteMessage(extractRouterErrorMessage(errorData) || response.statusText);
                throw new Error(`Hugging Face error (${response.status}): ${errorMsg}`);
            }

            const data = await response.json();
            return this.extractContent(data);
        } catch (error) {
            if (error instanceof Error) {
                // Only a caller cancellation reaches this branch as an abort —
                // `fetchGeneration` already labelled its own timeouts.
                if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                    throw new Error('Request cancelled.');
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

    protected createRequestBody(prompt: string, options?: AIRequestOptions): any {
        // OpenAI-compatible chat body — the router has no legacy
        // `inputs`/`parameters` pipeline endpoint anymore.
        return {
            model: this._model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: this.effectiveMaxTokens(options),
            temperature: this.effectiveTemperature(options),
        };
    }

    protected extractContent(response: Record<string, unknown>): string {
        const choices = response?.choices as Array<{ message?: { content?: unknown } }> | undefined;
        const content = choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim().length > 0) {
            return content.trim();
        }
        throw new Error('Invalid response format from Hugging Face API');
    }
}
