import { BaseAIProvider } from './base';
import type { OllamaGenerateRequestBody, OllamaChatRequestBody, OllamaModelsResponse } from '../types/api-responses';

/**
 * Ollama AI provider implementation
 * Supports both local Ollama instances and Ollama Cloud
 * Local API: http://localhost:11434/api/generate
 * Cloud API: https://ollama.com/api/generate
 */

export class OllamaProvider extends BaseAIProvider {
    readonly name = 'Ollama';

    // Ollama API base URL
    private readonly apiBaseUrl: string;

    constructor(apiKey: string = '', model?: string, timeout?: number, endpoint?: string) {
        // Ollama doesn't typically require an API key for local, but required for cloud
        super(apiKey, model ?? 'llama3.2', timeout);

        // Normalize endpoint to API base URL
        // Local: http://localhost:11434 -> http://localhost:11434/api
        // Cloud: https://ollama.com -> https://ollama.com/api
        if (endpoint) {
            if (endpoint.includes('ollama.com') || endpoint.includes('cloud')) {
                // Cloud API - use https://ollama.com/api
                this.apiBaseUrl = 'https://ollama.com/api';
            } else if (endpoint.endsWith('/api')) {
                // Already has /api suffix
                this.apiBaseUrl = endpoint;
            } else {
                // Local instance - add /api suffix
                this.apiBaseUrl = `${endpoint}/api`;
            }
        } else {
            this.apiBaseUrl = 'http://localhost:11434/api';
        }
    }

    /**
     * Get the full API URL for a given endpoint path
     */
    private getApiUrl(path: string): string {
        return `${this.apiBaseUrl}${path}`;
    }

    // eslint-disable-next-line complexity, max-lines-per-function
    async process(prompt: string): Promise<string> {
        try {
            // Validate inputs
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            // Prepare the request body for Ollama
            const requestBody: OllamaGenerateRequestBody = {
                model: this._model,
                prompt,
                stream: false,
                options: {
                    temperature: this._temperature,
                    num_predict: this._maxTokens,
                },
            };

            // Make the request to Ollama API
            const response = await fetch(this.getApiUrl('/generate'), {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    const isCloudModel = this._model.includes('-cloud') || this._model.includes(':cloud');
                    if (isCloudModel && !this.apiBaseUrl.includes('ollama.com')) {
                        throw new Error(
                            `Cloud model "${this._model}" requires Ollama Cloud configuration. Either:\n` +
                            '1. Switch to a local model (e.g., "llama3.2:latest")\n' +
                            '2. Configure Ollama Cloud in settings with endpoint "https://ollama.com" and your API key'
                        );
                    }
                    throw new Error(
                        `Ollama model not found: ${this._model}. Please make sure the model is pulled ` +
                        `in Ollama using 'ollama pull ${this._model}'.`
                    );
                }
                if (response.status === 401) {
                    const isCloudModel = this._model.includes('-cloud') || this._model.includes(':cloud');
                    if (isCloudModel) {
                        throw new Error(`Cloud model "${this._model}" requires authentication. Please configure your Ollama Cloud API key in plugin settings (get it from https://ollama.com/settings)`);
                    }
                    throw new Error('Ollama authentication failed. Check if your Ollama instance requires authentication.');
                }
                if (response.status === 500) {
                    const errorData = await this.safeJsonParse(response);
                    const errorMessage = errorData?.error || 'Ollama server error';
                    throw new Error(`Ollama error: ${errorMessage}`);
                }
                throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response structure
            if (!this.validateResponse(data, ['response'])) {
                throw new Error('Invalid response format from Ollama API');
            }

            return this.extractContent(data);
        } catch (error) {
            if (error instanceof Error) {
                // Check if it's a network error (Ollama not running)
                if (error.message.includes('fetch') || error.message.includes('network') ||
                    error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
                    throw new Error('Ollama server is not running or unreachable. Please ensure Ollama is installed and running on your system.');
                }
                throw error;
            }
            throw new Error(`Ollama processing failed: ${error}`);
        }
    }

    /**
     * Process with image support for multimodal models
     * Note: This is prepared for potential image processing, though it would require special handling in browser
     */
    // eslint-disable-next-line complexity, max-lines-per-function
    async processWithImage(prompt: string, images?: (string | ArrayBuffer)[]): Promise<string> {
        try {
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            // Prepare the request body for Ollama chat endpoint (multimodal support)
            const messages = [
                { role: 'user', content: prompt },
            ];

            // If images are provided, add them to the request
            if (images && images.length > 0) {
                // Ollama expects images as base64 encoded strings
                const processedImages = this.processImages(images);
                if (processedImages.length > 0) {
                    (messages[0] as OllamaChatRequestBody['messages'][0] & { images?: string[] }).images = processedImages;
                }
            }

            const requestBody: OllamaChatRequestBody = {
                model: this._model,
                messages,
                stream: false,
                options: {
                    temperature: this._temperature,
                    num_predict: this._maxTokens,
                },
            };

            // Make the request to Ollama API chat endpoint
            const response = await fetch(this.getApiUrl('/chat'), {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    const isCloudModel = this._model.includes('-cloud') || this._model.includes(':cloud');
                    if (isCloudModel && !this.apiBaseUrl.includes('ollama.com')) {
                        throw new Error(
                            `Cloud model "${this._model}" requires Ollama Cloud configuration. Either:\n` +
                            '1. Switch to a local model (e.g., "llama3.2:latest")\n' +
                            '2. Configure Ollama Cloud in settings with endpoint "https://ollama.com" and your API key'
                        );
                    }
                    throw new Error(
                        `Ollama model not found: ${this._model}. Please make sure the model is pulled ` +
                        `in Ollama using 'ollama pull ${this._model}'.`
                    );
                }
                if (response.status === 401) {
                    const isCloudModel = this._model.includes('-cloud') || this._model.includes(':cloud');
                    if (isCloudModel) {
                        throw new Error(`Cloud model "${this._model}" requires authentication. Please configure your Ollama Cloud API key in plugin settings (get it from https://ollama.com/settings)`);
                    }
                    throw new Error('Ollama authentication failed. Check if your Ollama instance requires authentication.');
                }
                if (response.status === 500) {
                    const errorData = await this.safeJsonParse(response);
                    const errorMessage = errorData?.error || 'Ollama server error';
                    throw new Error(`Ollama error: ${errorMessage}`);
                }
                throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response structure for chat endpoint
            if (!this.validateResponse(data, ['message', 'content'])) {
                throw new Error('Invalid response format from Ollama API');
            }

            return this.extractContentFromChat(data);
        } catch (error) {
            if (error instanceof Error) {
                // Check if it's a network error (Ollama not running)
                if (error.message.includes('fetch') || error.message.includes('network') ||
                    error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
                    throw new Error('Ollama server is not running or unreachable. Please ensure Ollama is installed and running on your system.');
                }
                throw error;
            }
            throw new Error(`Ollama processing failed: ${error}`);
        }
    }

    /**
     * Process and convert images to base64 strings
     */
    private processImages(images: (string | ArrayBuffer)[]): string[] {
        const processedImages: string[] = [];

        for (const img of images) {
            if (typeof img === 'string') {
                // If it's already a base64 string or data URL, add it directly
                processedImages.push(img);
            } else if (img instanceof ArrayBuffer) {
                // Convert ArrayBuffer to base64
                processedImages.push(this.arrayBufferToBase64(img));
            }
        }

        return processedImages;
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
    }

    /**
     * Check if Ollama server is accessible
     */
    async checkAvailability(): Promise<boolean> {
        try {
            const response = await fetch(this.getApiUrl('/tags'), {
                method: 'GET',
                headers: this.createHeaders(),
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if a specific model is available in Ollama
     */
    async checkModelAvailability(modelName: string): Promise<boolean> {
        try {
            const response = await fetch(this.getApiUrl('/tags'), {
                method: 'GET',
                headers: this.createHeaders(),
            });

            if (!response.ok) {
                return false;
            }

            const data = (await response.json()) as OllamaModelsResponse;
            if (!data?.models) {
                return false;
            }

            // Check if the model exists in the list (both name and id)
            return data.models.some((model) =>
                model.name === modelName ||
                model.name.startsWith(`${modelName}:`) ||
                (model.id?.includes(modelName) ?? false)
            );
        } catch (error) {
            return false;
        }
    }

    protected createHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add Authorization header if API key is provided
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    protected createRequestBody(_prompt: string): OllamaGenerateRequestBody {
        // Ollama uses the process() method instead, so this isn't used
        return {
            model: this._model,
            prompt: _prompt,
            stream: false,
            options: {
                temperature: this._temperature,
                num_predict: this._maxTokens,
            },
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