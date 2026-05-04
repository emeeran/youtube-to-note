import { AI_MODELS } from '../constants/index';
import { OllamaProvider } from './ollama';

/**
 * Ollama Cloud AI provider implementation
 * Extends OllamaProvider with cloud-specific configuration
 * Cloud API: https://ollama.com/api/generate
 * Requires API key from https://ollama.com/settings
 */

export class OllamaCloudProvider extends OllamaProvider {
    readonly name = 'Ollama Cloud';

    constructor(apiKey: string, model?: string, timeout?: number) {
        // Force cloud endpoint for OllamaCloudProvider
        super(apiKey, model ?? AI_MODELS.OLLAMA_CLOUD, timeout, 'https://ollama.com');
    }
}
