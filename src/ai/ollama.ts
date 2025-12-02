import { BaseAIProvider } from './base';

/**
 * Ollama AI provider implementation
 */


export class OllamaProvider extends BaseAIProvider {
    readonly name = 'Ollama';

    // Ollama API endpoint - defaults to local instance
    private readonly ollamaEndpoint: string;
    private readonly apiKey?: string;

    constructor(apiKey: string = '', model?: string, timeout?: number, endpoint?: string) {
        // Ollama doesn't typically require an API key, but we'll store it if provided
        super(apiKey, model || 'qwen3-coder:480b-cloud', timeout);

        // Default to localhost:11434 if no endpoint provided
        this.ollamaEndpoint = endpoint || 'http://localhost:11434';
        this.apiKey = apiKey || undefined;
    }

    async process(prompt: string): Promise<string> {
        try {
            // Validate inputs
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            // Prepare the request body for Ollama
            const requestBody = {
                model: this._model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: this._temperature,
                    num_predict: this._maxTokens
                }
            };

            // Make the request to Ollama API
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Ollama model not found: ${this._model}. Please make sure the model is pulled in Ollama using 'ollama pull ${this._model}'.`);
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
    async processWithImage(prompt: string, images?: (string | ArrayBuffer)[]): Promise<string> {
        try {
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            // Prepare the request body for Ollama chat endpoint (multimodal support)
            const messages = [
                { role: 'user', content: prompt }
            ];

            // If images are provided, add them to the request
            if (images && images.length > 0) {
                // Ollama expects images as base64 encoded strings
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
                            binary += String.fromCharCode(bytes[i]);
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
                messages: messages,
                stream: false,
                options: {
                    temperature: this._temperature,
                    num_predict: this._maxTokens
                }
            };

            // Make the request to Ollama API chat endpoint
            const response = await fetch(`${this.ollamaEndpoint}/api/chat`, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Ollama model not found: ${this._model}. Please make sure the model is pulled in Ollama using 'ollama pull ${this._model}'.`);
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
     * Check if Ollama server is accessible
     */
    async checkAvailability(): Promise<boolean> {
        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/tags`, {
                method: 'GET',
                headers: this.createHeaders()
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
            const response = await fetch(`${this.ollamaEndpoint}/api/tags`, {
                method: 'GET',
                headers: this.createHeaders()
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            if (!data || !data.models) {
                return false;
            }

            // Check if the model exists in the list (both name and id)
            return data.models.some((model: any) =>
                model.name === modelName ||
                model.name.startsWith(`${modelName}:`) ||
                (model.id && model.id.includes(modelName))
            );
        } catch (error) {
            return false;
        }
    }

    protected createHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // Add Authorization header if API key is provided
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    protected createRequestBody(prompt: string): any {
        // Ollama uses the process() method instead, so this isn't used
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