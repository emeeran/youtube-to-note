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
import { SecureConfigService } from '../secure-config';
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

/**
 * Simplified service container for the YouTube to Note plugin
 */
export class ServiceContainer implements IServiceContainer {
    private _aiService?: IAIService;
    private _videoService?: VideoDataService;
    private _fileService?: FileService;
    private _cacheService?: CacheService;
    private _promptService?: PromptService;
    private _secureConfig?: SecureConfigService;
    private _initialized = false;

    constructor(
        private settings: YouTubePluginSettings,
        private app: App
    ) {}

    /**
     * Get the secure config service
     */
    private get secureConfig(): SecureConfigService {
        if (!this._secureConfig) {
            this._secureConfig = new SecureConfigService(this.settings);
        }
        return this._secureConfig;
    }

    /**
     * Initialize AI service asynchronously
     * Must be called before accessing aiService property
     */
    async initialize(): Promise<void> {
        if (this._initialized) return;

        const providers: AIProvider[] = [];

        // Use secure config to get decrypted API keys
        const geminiKey = await this.secureConfig.getApiKey('geminiApiKey');
        if (geminiKey) {
            providers.push(new GeminiProvider(geminiKey));
        }

        const groqKey = await this.secureConfig.getApiKey('groqApiKey');
        if (groqKey) {
            providers.push(new GroqProvider(groqKey));
        }

        const huggingFaceKey = await this.secureConfig.getApiKey('huggingFaceApiKey');
        if (huggingFaceKey) {
            providers.push(new HuggingFaceProvider(huggingFaceKey));
        }

        const openRouterKey = await this.secureConfig.getApiKey('openRouterApiKey');
        if (openRouterKey) {
            providers.push(new OpenRouterProvider(openRouterKey));
        }

        const ollamaKey = await this.secureConfig.getApiKey('ollamaApiKey');

        // Ollama local (always available)
        providers.push(new OllamaProvider(
            ollamaKey ?? '',
            undefined,
            undefined,
            this.settings.ollamaEndpoint ?? 'http://localhost:11434'
        ));

        if (ollamaKey) {
            providers.push(new OllamaCloudProvider(
                ollamaKey,
                'deepseek-r1:32b'
            ));
        }

        this._aiService = new AIService(providers, this.settings);
        this._initialized = true;
    }

    get aiService(): IAIService {
        if (!this._initialized || !this._aiService) {
            throw new Error('ServiceContainer not initialized. Call initialize() first.');
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

        // Reset secure config to pick up new settings
        this._secureConfig = undefined;

        // Clear AI service to pick up new API keys
        this._aiService = undefined;
        this._videoService = undefined;
        this._initialized = false;

        // Re-initialize with new settings
        await this.initialize();
    }

    /**
     * Check if the service container is initialized
     */
    isInitialized(): boolean {
        return this._initialized;
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
