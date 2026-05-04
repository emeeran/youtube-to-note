import { App } from 'obsidian';
import { AIPromptService } from './prompt-service';
import { AIService } from './ai-service';
import { GeminiProvider } from '../ai/gemini';
import { GroqProvider } from '../ai/groq';
import { HuggingFaceProvider } from '../ai/huggingface';
import { MemoryCacheService } from './cache/memory-cache';
import { ObsidianFileService } from '../obsidian-file';
import { OllamaProvider } from '../ai/ollama';
import { OllamaCloudProvider } from '../ai/ollama-cloud';
import { OpenRouterProvider } from '../ai/openrouter';
import { YouTubeVideoService } from '../video-data';
import {
    ServiceContainer as IServiceContainer,
    YouTubePluginSettings,
    AIService as IAIService,
    AIProvider,
    VideoDataService,
    FileService,
    CacheService,
    PromptService,
} from '../types';
import { AI_MODELS } from '../ai/api';

/**
 * Simplified service container for the YouTube to Note plugin
 */
export class ServiceContainer implements IServiceContainer {
    private _aiService?: IAIService;
    private _videoService?: VideoDataService;
    private _fileService?: FileService;
    private _cacheService?: CacheService;
    private _promptService?: PromptService;

    constructor(
        private settings: YouTubePluginSettings,
        private app: App,
    ) {}

    get aiService(): IAIService {
        if (this._aiService) return this._aiService;

        const providers: AIProvider[] = [];

        // Provider priority: Groq (fast, reliable) > Gemini (multimodal) > OpenRouter > Ollama Cloud > HuggingFace > Ollama Local
        if (this.settings.groqApiKey) {
            providers.push(new GroqProvider(this.settings.groqApiKey));
        }

        if (this.settings.geminiApiKey) {
            providers.push(new GeminiProvider(this.settings.geminiApiKey));
        }

        if (this.settings.openRouterApiKey) {
            providers.push(new OpenRouterProvider(this.settings.openRouterApiKey));
        }

        if (this.settings.ollamaApiKey) {
            providers.push(new OllamaCloudProvider(this.settings.ollamaApiKey, AI_MODELS.OLLAMA_CLOUD));
        }

        if (this.settings.huggingFaceApiKey) {
            providers.push(new HuggingFaceProvider(this.settings.huggingFaceApiKey));
        }

        // Ollama local (always available, lowest priority)
        providers.push(
            new OllamaProvider(
                this.settings.ollamaApiKey || '',
                undefined,
                undefined,
                this.settings.ollamaEndpoint || 'http://localhost:11434',
            ),
        );

        this._aiService = new AIService(providers, this.settings);
        return this._aiService;
    }

    get videoService(): VideoDataService {
        if (!this._videoService) {
            this._videoService = new YouTubeVideoService(this.cacheService);
        }
        return this._videoService;
    }

    get fileService(): FileService {
        if (!this._fileService) {
            this._fileService = new ObsidianFileService(this.app);
        }
        return this._fileService;
    }

    get cacheService(): CacheService {
        if (!this._cacheService) {
            this._cacheService = new MemoryCacheService();
        }
        return this._cacheService;
    }

    get promptService(): PromptService {
        if (!this._promptService) {
            this._promptService = new AIPromptService();
        }
        return this._promptService;
    }

    /**
     * Update settings and recreate dependent services
     */
    async updateSettings(newSettings: YouTubePluginSettings): Promise<void> {
        this.settings = newSettings;

        // Clear AI service to pick up new API keys
        this._aiService = undefined;
        this._videoService = undefined;
    }

    /**
     * Clear all services (called on plugin unload)
     */
    clearServices(): void {
        // Cleanup individual services
        if (this._aiService && typeof this._aiService.cleanup === 'function') {
            this._aiService.cleanup();
        }
        if (this._videoService && typeof this._videoService.cleanup === 'function') {
            this._videoService.cleanup();
        }
        if (this._cacheService && typeof this._cacheService.destroy === 'function') {
            this._cacheService.destroy();
        }

        this._aiService = undefined;
        this._videoService = undefined;
        this._fileService = undefined;
        this._cacheService = undefined;
        this._promptService = undefined;
    }

    /**
     * Cleanup method to be called when plugin is unloaded
     */
    cleanup(): void {
        this.clearServices();
    }
}
