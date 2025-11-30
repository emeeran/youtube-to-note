/**
 * Ollama AI provider implementation
 */

import { API_ENDPOINTS, AI_MODELS, PROVIDER_MODEL_OPTIONS } from './api';
import { MESSAGES } from './messages';
import { BaseAIProvider } from './base';

export class OllamaProvider extends BaseAIProvider {
    readonly name = 'Ollama';

    // Ollama API endpoint - defaults to local instance
    private readonly ollamaEndpoint: string;

    constructor(apiKey: string = '', model?: string, timeout?: number, endpoint?: string) {
        // Ollama doesn't require an API key, so we allow empty string
        super(apiKey || 'ollama', model || 'qwen3-coder:480b-cloud', timeout);

        // Default to localhost:11434 if no endpoint provided
        this.ollamaEndpoint = endpoint || 'http://localhost:11434';
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
        return {
            'Content-Type': 'application/json'
        };
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
}