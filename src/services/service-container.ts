import { AIPromptService } from './prompt-service';
import { AIService } from './ai-service';
import { GeminiProvider } from './../gemini';
import { GroqProvider } from './../groq';
import { MemoryCacheService } from './cache/memory-cache';
import { ObsidianFileService } from './../obsidian-file';
import { OllamaProvider } from './../ollama';
import { YouTubeVideoService } from './../video-data';
import {
import { App } from 'obsidian';

/**
 * Service container for dependency injection
 */

    ServiceContainer as IServiceContainer,
    YouTubePluginSettings,
    AIService as IAIService,
    AIProvider,
    VideoDataService,
    FileService,
    CacheService,
    PromptService
} from '../types/types';


export class ServiceContainer implements IServiceContainer {
    private _aiService?: IAIService;
    private _videoService?: VideoDataService;
    private _fileService?: FileService;
    private _cacheService?: CacheService;
    private _promptService?: PromptService;

    constructor(
        private settings: YouTubePluginSettings,
        private app: App
    ) {}

    get aiService(): IAIService {
        if (!this._aiService) {
            const providers: AIProvider[] = [];

            // Add Gemini provider if API key is available
            if (this.settings.geminiApiKey) {
                providers.push(new GeminiProvider(this.settings.geminiApiKey));
            }

            // Add Groq provider if API key is available
            if (this.settings.groqApiKey) {
                providers.push(new GroqProvider(this.settings.groqApiKey));
            }

            // Add Ollama provider (doesn't require API key, but can use it if provided)
            // We add it always so it appears in dropdowns, but processing will check availability
            providers.push(new OllamaProvider(this.settings.ollamaApiKey || ''));

            this._aiService = new AIService(providers, this.settings);
        }
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
        return this._cacheService!;
    }

    get promptService(): PromptService {
        if (!this._promptService) {
            this._promptService = new AIPromptService();
        }
        return this._promptService;
    }

    /**
     * Update settings and refresh services that depend on them
     */
    async updateSettings(newSettings: YouTubePluginSettings): Promise<void> {
        this.settings = newSettings;
        // Reset AI service to pick up new API keys
        this._aiService = undefined;
    }

    /**
     * Clear all cached services
     */
    clearServices(): void {
        this._aiService = undefined;
        this._videoService = undefined;
        this._fileService = undefined;
        this._cacheService = undefined;
        this._promptService = undefined;
    }
}
