import { App } from 'obsidian';
import { AIPromptService } from './prompt-service';
import { AIService } from './ai-service';
import { GeminiProvider } from '../ai/gemini';
import { GroqProvider } from '../ai/groq';
import { HuggingFaceProvider } from '../ai/huggingface';
import { MemoryCacheService } from './cache/memory-cache';
import { TranscriptDiskCache } from './transcript-cache';
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
import { SecureConfigService } from '../secure-config';

/**
 * Simplified service container for the YouTube to Note plugin
 */
export class ServiceContainer implements IServiceContainer {
    private _aiService?: IAIService;
    private _videoService?: VideoDataService;
    private _fileService?: FileService;
    private _cacheService?: CacheService;
    private _promptService?: PromptService;
    private _transcriptDiskCache?: TranscriptDiskCache;

    constructor(
        private settings: YouTubePluginSettings,
        private app: App,
        /**
         * Plugin folder relative to the vault root (`manifest.dir`). Optional —
         * when omitted the transcript disk cache falls back to the manifest id
         * constant. main.ts should pass `this.manifest.dir`.
         */
        private pluginDir?: string,
    ) {}

    get aiService(): IAIService {
        if (this._aiService) return this._aiService;

        // Resolve keys centrally through SecureConfigService so that legacy
        // obfuscated values and environment variables are both handled.
        const secure = new SecureConfigService(this.settings);

        const providers: AIProvider[] = [];

        // Provider priority: Groq (fast, reliable) > Gemini (multimodal) > OpenRouter > Ollama Cloud > HuggingFace > Ollama Local
        const groqKey = secure.getApiKey('groqApiKey');
        if (groqKey) {
            providers.push(new GroqProvider(groqKey));
        }

        const geminiKey = secure.getApiKey('geminiApiKey');
        if (geminiKey) {
            providers.push(new GeminiProvider(geminiKey));
        }

        const openRouterKey = secure.getApiKey('openRouterApiKey');
        if (openRouterKey) {
            providers.push(new OpenRouterProvider(openRouterKey));
        }

        const ollamaCloudKey = secure.getApiKey('ollamaApiKey');
        if (ollamaCloudKey) {
            providers.push(new OllamaCloudProvider(ollamaCloudKey, AI_MODELS.OLLAMA_CLOUD));
        }

        const huggingFaceKey = secure.getApiKey('huggingFaceApiKey');
        if (huggingFaceKey) {
            providers.push(new HuggingFaceProvider(huggingFaceKey));
        }

        // Ollama local (always available, lowest priority)
        providers.push(
            new OllamaProvider(
                ollamaCloudKey || '',
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
            this._videoService = new YouTubeVideoService(this.cacheService, {
                // Read settings lazily so toggles (e.g. persistTranscriptCache)
                // take effect without rebuilding the service.
                getSettings: () => this.settings,
                diskCache: this.transcriptDiskCache,
            });
        }
        return this._videoService;
    }

    /**
     * Shared on-disk transcript cache. Opt-in: nothing touches the disk unless
     * `settings.persistTranscriptCache` is true when a transcript is fetched.
     */
    private get transcriptDiskCache(): TranscriptDiskCache {
        if (!this._transcriptDiskCache) {
            this._transcriptDiskCache = new TranscriptDiskCache(this.app, this.pluginDir);
        }
        return this._transcriptDiskCache;
    }

    /**
     * Delete every persisted transcript. Hook this to an explicit settings
     * action or command — NOT to plugin unload, which would erase the cache
     * the setting exists to preserve across Obsidian reloads.
     */
    async clearTranscriptCache(): Promise<void> {
        await this.transcriptDiskCache.clear();
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
        // The disk cache is intentionally NOT cleared here: it exists to spare
        // YouTube refetches across reloads. Use clearTranscriptCache() instead.
    }

    /**
     * Cleanup method to be called when plugin is unloaded
     */
    cleanup(): void {
        this.clearServices();
    }
}
