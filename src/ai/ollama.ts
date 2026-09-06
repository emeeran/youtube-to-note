import { AI_MODELS } from '../constants/index';
import { BaseAIProvider } from './base';
import type { AIRequestOptions } from '../types';
import type {
    OllamaGenerateRequestBody,
    OllamaChatRequestBody,
    OllamaModelsResponse,
    JsonObject,
} from '../types/api-responses';

/**
 * Ollama AI provider implementation
 * Supports both local Ollama instances and Ollama Cloud
 * Local API: http://localhost:11434/api/generate
 * Cloud API: https://ollama.com/api/generate
 */

export class OllamaProvider extends BaseAIProvider {
    readonly name: string = 'Ollama';

    private readonly apiBaseUrl: string;

    constructor(apiKey: string = '', model?: string, timeout?: number, endpoint?: string) {
        // Ollama doesn't typically require an API key for local, but required for cloud
        super(apiKey, model ?? AI_MODELS.OLLAMA_LOCAL, timeout);

        // Normalize endpoint to API base URL
        // Local: http://localhost:11434 -> http://localhost:11434/api
        // Cloud: https://ollama.com -> https://ollama.com/api
        if (endpoint) {
            if (endpoint.includes('ollama.com') || endpoint.includes('cloud')) {
                this.apiBaseUrl = 'https://ollama.com/api';
            } else if (endpoint.endsWith('/api')) {
                this.apiBaseUrl = endpoint;
            } else {
                this.apiBaseUrl = `${endpoint}/api`;
            }
        } else {
            this.apiBaseUrl = 'http://localhost:11434/api';
        }

        // Warn if the endpoint is plain HTTP on a non-loopback host: prompts
        // and any API key would traverse the network unencrypted.
        if (this.apiBaseUrl.startsWith('http://')) {
            const host = this.apiBaseUrl.replace(/^https?:\/\//, '').split('/')[0] ?? '';
            const isLoopback = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(host);
            if (!isLoopback) {
                // eslint-disable-next-line no-console
                console.warn(
                    `[YouTube-to-Note] Ollama endpoint "${this.apiBaseUrl}" is unencrypted HTTP on a ` +
                        'non-loopback host. Prompts and any API key will be sent in cleartext.',
                );
            }
        }
    }

    private getApiUrl(path: string): string {
        return `${this.apiBaseUrl}${path}`;
    }

    async process(prompt: string, options?: AIRequestOptions): Promise<string> {
        try {
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            const requestBody: OllamaGenerateRequestBody = {
                model: this._model,
                prompt,
                stream: false,
                options: { temperature: this._temperature, num_predict: this._maxTokens },
            };

            const response = await fetch(this.getApiUrl('/generate'), {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
                signal: this.requestSignal({ signal: options?.signal }),
            });

            await this.throwIfOllamaError(response);

            const data = await response.json();
            if (!this.validateResponse(data, ['response'])) {
                throw new Error('Invalid response format from Ollama API');
            }
            return this.extractContent(data);
        } catch (error) {
            throw this.asNetworkError(error);
        }
    }

    async processWithImage(
        prompt: string,
        images?: (string | ArrayBuffer)[],
        options?: AIRequestOptions,
    ): Promise<string> {
        try {
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            const messages = [{ role: 'user', content: prompt }];

            if (images && images.length > 0) {
                // Ollama expects images as base64 encoded strings
                const processedImages = this.processImages(images);
                if (processedImages.length > 0) {
                    (messages[0] as OllamaChatRequestBody['messages'][0] & { images?: string[] }).images =
                        processedImages;
                }
            }

            const requestBody: OllamaChatRequestBody = {
                model: this._model,
                messages,
                stream: false,
                options: { temperature: this._temperature, num_predict: this._maxTokens },
            };

            const response = await fetch(this.getApiUrl('/chat'), {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
                signal: this.requestSignal({ signal: options?.signal }),
            });

            await this.throwIfOllamaError(response);

            const data = await response.json();
            if (!this.validateResponse(data, ['message', 'content'])) {
                throw new Error('Invalid response format from Ollama API');
            }
            return this.extractContentFromChat(data);
        } catch (error) {
            throw this.asNetworkError(error);
        }
    }

    /**
     * Shared non-OK status handling for the /generate and /chat endpoints.
     * Throws a provider-specific Error; a no-op when the response is OK.
     */
    private async throwIfOllamaError(response: Response): Promise<void> {
        if (response.ok) return;
        if (response.status === 404) throw new Error(this.describeModelNotFound());
        if (response.status === 401) throw new Error(this.describeAuthFailure());
        if (response.status === 500) {
            const errorData = await this.safeJsonParse(response);
            const errorMessage = this.sanitizeRemoteMessage(errorData?.error) || 'Ollama server error';
            throw new Error(`Ollama error: ${errorMessage}`);
        }
        throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
    }

    private isCloudModel(): boolean {
        return this._model.includes('-cloud') || this._model.includes(':cloud');
    }

    private describeModelNotFound(): string {
        if (this.isCloudModel() && !this.apiBaseUrl.includes('ollama.com')) {
            return (
                `Cloud model "${this._model}" requires Ollama Cloud configuration. Either:\n` +
                '1. Switch to a local model (e.g., "llama3.2:latest")\n' +
                '2. Configure Ollama Cloud in settings with endpoint "https://ollama.com" and your API key'
            );
        }
        return (
            `Ollama model not found: ${this._model}. Please make sure the model is pulled ` +
            `in Ollama using 'ollama pull ${this._model}'.`
        );
    }

    private describeAuthFailure(): string {
        if (this.isCloudModel()) {
            return `Cloud model "${this._model}" requires authentication. Please configure your Ollama Cloud API key in plugin settings (get it from https://ollama.com/settings)`;
        }
        return 'Ollama authentication failed. Check if your Ollama instance requires authentication.';
    }

    /**
     * Classify a thrown error. Genuine network failures (Ollama not running)
     * become a clear, actionable message; everything else passes through.
     */
    private asNetworkError(error: unknown): Error {
        if (error instanceof Error) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                return new Error('Ollama request was cancelled or timed out.');
            }
            if (
                error.message.includes('fetch') ||
                error.message.includes('network') ||
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('ENOTFOUND')
            ) {
                return new Error(
                    'Ollama server is not running or unreachable. Please ensure Ollama is installed and running on your system.',
                );
            }
            return error;
        }
        return new Error(`Ollama processing failed: ${error}`);
    }

    private processImages(images: (string | ArrayBuffer)[]): string[] {
        const processedImages: string[] = [];
        for (const img of images) {
            if (typeof img === 'string') {
                processedImages.push(img);
            } else if (img instanceof ArrayBuffer) {
                processedImages.push(this.arrayBufferToBase64(img));
            }
        }
        return processedImages;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
    }

    /**
     * Live-fetch the names of models available on the configured Ollama instance
     * (local: models you have pulled; cloud: cloud catalog).
     */
    async listModels(): Promise<string[]> {
        const response = await this.fetchWithTimeout(
            this.getApiUrl('/tags'),
            {
                method: 'GET',
                headers: this.createHeaders(),
            },
            'Ollama models request failed',
        );
        if (!response.ok) {
            throw new Error(`Ollama models request failed: ${response.status}`);
        }
        const data = (await response.json()) as OllamaModelsResponse;
        return (data.models ?? [])
            .map(m => m.name)
            .filter((name): name is string => typeof name === 'string' && name.length > 0);
    }

    protected createHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return headers;
    }

    protected createRequestBody(_prompt: string): JsonObject {
        // Ollama uses process()/processWithImage() instead.
        return {
            model: this._model,
            prompt: _prompt,
            stream: false,
            options: { temperature: this._temperature, num_predict: this._maxTokens },
        };
    }

    protected extractContent(response: Record<string, unknown>): string {
        if (response && typeof response === 'object' && 'response' in response) {
            return String(response.response).trim();
        }
        return '';
    }

    protected extractContentFromChat(response: Record<string, unknown>): string {
        if (response && typeof response === 'object' && 'message' in response) {
            const message = response.message as Record<string, unknown>;
            if ('content' in message) {
                return String(message.content).trim();
            }
        }
        return '';
    }
}
