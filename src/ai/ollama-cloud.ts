import { BaseAIProvider } from './base';

/**
 * Ollama Cloud AI provider implementation
 * Cloud API: https://ollama.com/api/generate
 * Requires API key from https://ollama.com/settings
 */

export class OllamaCloudProvider extends BaseAIProvider {
    readonly name = 'Ollama Cloud';

    // Ollama Cloud API base URL
    private readonly apiBaseUrl: string;

    constructor(apiKey: string, model?: string, timeout?: number) {
        // Ollama Cloud requires an API key
        super(apiKey, model ?? 'deepseek-r1:32b', timeout);

        // Ollama Cloud always uses the official cloud endpoint
        this.apiBaseUrl = 'https://ollama.com/api';
    }

    /**
     * Get the full API URL for a given endpoint path
     */
    private getApiUrl(path: string): string {
        return `${this.apiBaseUrl}${path}`;
    }

    async process(prompt: string): Promise<string> {
        try {
            // Validate inputs
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            // Validate API key
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error('Ollama Cloud requires an API key. Please configure it in plugin settings (get it from https://ollama.com/settings)');
            }

            // Prepare the request body for Ollama Cloud
            const requestBody = {
                model: this._model,
                prompt,
                stream: false,
                options: {
                    temperature: this._temperature,
                    num_predict: this._maxTokens,
                },
            };

            // Make the request to Ollama Cloud API
            const response = await fetch(this.getApiUrl('/generate'), {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Ollama Cloud model not found: ${this._model}. Please check available models at https://ollama.com/library.`);
                }
                if (response.status === 401) {
                    throw new Error('Ollama Cloud authentication failed. Please check your API key in plugin settings (get it from https://ollama.com/settings)');
                }
                if (response.status === 403) {
                    throw new Error('Ollama Cloud access denied. Your API key may not have access to this model or the service.');
                }
                if (response.status === 429) {
                    throw new Error('Ollama Cloud rate limit exceeded. Please try again later or upgrade your plan.');
                }
                if (response.status === 500) {
                    const errorData = await this.safeJsonParse(response);
                    const errorMessage = errorData?.error || 'Ollama Cloud server error';
                    throw new Error(`Ollama Cloud error: ${errorMessage}`);
                }
                throw new Error(`Ollama Cloud API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response structure
            if (!this.validateResponse(data, ['response'])) {
                throw new Error('Invalid response format from Ollama Cloud API');
            }

            return this.extractContent(data);
        } catch (error) {
            if (error instanceof Error) {
                // Check if it's a network error
                if (error.message.includes('fetch') || error.message.includes('network') ||
                    error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
                    throw new Error('Ollama Cloud is unreachable. Please check your internet connection and https://ollama.com status.');
                }
                throw error;
            }
            throw new Error(`Ollama Cloud processing failed: ${error}`);
        }
    }

    /**
     * Process with image support for multimodal models
     */
    async processWithImage(prompt: string, images?: (string | ArrayBuffer)[]): Promise<string> {
        try {
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error('Ollama Cloud requires an API key. Please configure it in plugin settings (get it from https://ollama.com/settings)');
            }

            // Prepare the request body for Ollama Cloud chat endpoint (multimodal support)
            const messages = [
                { role: 'user', content: prompt },
            ];

            // If images are provided, add them to the request
            if (images && images.length > 0) {
                // Ollama Cloud expects images as base64 encoded strings
                const processedImages: string[] = [];

                for (const img of images) {
                    if (typeof img === 'string') {
                        // If it's already a base64 string or data URL, add it directly
                        processedImages.push(img);
                    } else if (img instanceof ArrayBuffer) {
                        // Convert ArrayBuffer to base64
                        const bytes = new Uint8Array(img);
                        let binary = '';
                        for (let i = 0; i < bytes.length; i++) {
                            binary += String.fromCharCode(bytes[i]!);
                        }
                        const base64 = btoa(binary);
                        processedImages.push(base64);
                    }
                }

                if (processedImages.length > 0) {
                    (messages[0] as any).images = processedImages;
                }
            }

            const requestBody = {
                model: this._model,
                messages,
                stream: false,
                options: {
                    temperature: this._temperature,
                    num_predict: this._maxTokens,
                },
            };

            // Make the request to Ollama Cloud API chat endpoint
            const response = await fetch(this.getApiUrl('/chat'), {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Ollama Cloud model not found: ${this._model}. Please check available models at https://ollama.com/library.`);
                }
                if (response.status === 401) {
                    throw new Error('Ollama Cloud authentication failed. Please check your API key in plugin settings (get it from https://ollama.com/settings)');
                }
                if (response.status === 403) {
                    throw new Error('Ollama Cloud access denied. Your API key may not have access to this model or the service.');
                }
                if (response.status === 429) {
                    throw new Error('Ollama Cloud rate limit exceeded. Please try again later or upgrade your plan.');
                }
                if (response.status === 500) {
                    const errorData = await this.safeJsonParse(response);
                    const errorMessage = errorData?.error || 'Ollama Cloud server error';
                    throw new Error(`Ollama Cloud error: ${errorMessage}`);
                }
                throw new Error(`Ollama Cloud API error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response structure for chat endpoint
            if (!this.validateResponse(data, ['message', 'content'])) {
                throw new Error('Invalid response format from Ollama Cloud API');
            }

            return this.extractContentFromChat(data);
        } catch (error) {
            if (error instanceof Error) {
                // Check if it's a network error
                if (error.message.includes('fetch') || error.message.includes('network') ||
                    error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
                    throw new Error('Ollama Cloud is unreachable. Please check your internet connection and https://ollama.com status.');
                }
                throw error;
            }
            throw new Error(`Ollama Cloud processing failed: ${error}`);
        }
    }

    /**
     * Check if Ollama Cloud server is accessible
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
     * Check if a specific model is available in Ollama Cloud
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

            const data = await response.json();
            if (!data?.models) {
                return false;
            }

            // Check if the model exists in the list (both name and id)
            return data.models.some((model: any) =>
                model.name === modelName ||
                model.name.startsWith(`${modelName}:`) ||
                (model.id?.includes(modelName))
            );
        } catch (error) {
            return false;
        }
    }

    protected createHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add Authorization header with API key (required for Ollama Cloud)
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    protected createRequestBody(_prompt: string): any {
        // Ollama Cloud uses the process() method instead, so this isn't used
        return {};
    }

    protected extractContent(response: any): string {
        if (response && typeof response === 'object' && 'response' in response) {
            return response.response.trim();
        }
        return '';
    }

    protected extractContentFromChat(response: any): string {
        if (response && typeof response === 'object' && response.message && 'content' in response.message) {
            return response.message.content.trim();
        }
        return '';
    }
}
