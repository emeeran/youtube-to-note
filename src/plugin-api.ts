import { App, Plugin, TFile } from 'obsidian';
import { YoutubeClipperPlugin } from './main';
import { PerformanceMonitor } from './performance-monitor';

export interface PluginAPI {
    version: string;
    capabilities: PluginCapabilities;
    video: VideoAPI;
    ai: AIAPI;
    storage: StorageAPI;
    ui: UIAPI;
    events: EventsAPI;
    utils: UtilsAPI;
}

export interface PluginCapabilities {
    videoProcessing: boolean;
    aiProcessing: boolean;
    transcriptExtraction: boolean;
    fileManagement: boolean;
    customization: boolean;
    monitoring: boolean;
}

export interface VideoAPI {
    process: (url: string, options?: VideoProcessingOptions) => Promise<VideoProcessingResult>;
    extractMetadata: (url: string) => Promise<VideoMetadata>;
    extractTranscript: (videoId: string) => Promise<Transcript>;
    validateUrl: (url: string) => boolean;
    extractVideoId: (url: string) => string | null;
}

export interface AIAPI {
    process: (prompt: string, options?: AIProcessingOptions) => Promise<AIResponse>;
    getProviders: () => AIProvider[];
    getModels: (provider?: string) => string[];
    setProvider: (provider: string) => void;
    setModel: (model: string) => void;
}

export interface StorageAPI {
    saveFile: (path: string, content: string) => Promise<TFile>;
    readFile: (path: string) => Promise<string>;
    fileExists: (path: string) => Promise<boolean>;
    createFolder: (path: string) => Promise<void>;
    listFiles: (folder: string, extension?: string) => Promise<string[]>;
}

export interface UIAPI {
    showModal: (options: ModalOptions) => Promise<any>;
    showNotice: (message: string, timeout?: number) => void;
    confirm: (message: string, title?: string) => Promise<boolean>;
    prompt: (message: string, defaultValue?: string) => Promise<string | null>;
    createProgressBar: (max: number) => ProgressBarAPI;
}

export interface EventsAPI {
    on: (event: string, callback: EventCallback) => () => void;
    emit: (event: string, data?: any) => void;
    once: (event: string, callback: EventCallback) => () => void;
    off: (event: string, callback: EventCallback) => void;
}

export interface UtilsAPI {
    formatTimestamp: (timestamp: number) => string;
    sanitizeFilename: (filename: string) => string;
    generateId: () => string;
    debounce: <T extends (...args: any[]) => any>(fn: T, delay: number) => T;
    throttle: <T extends (...args: any[]) => any>(fn: T, limit: number) => T;
}

export interface VideoProcessingOptions {
    format?: 'executive-summary' | 'detailed-guide' | 'brief' | 'custom';
    provider?: string;
    model?: string;
    customPrompt?: string;
    outputPath?: string;
    includeTranscript?: boolean;
    performanceMode?: 'fast' | 'balanced' | 'quality';
}

export interface VideoProcessingResult {
    success: boolean;
    filePath?: string;
    error?: string;
    metadata?: VideoMetadata;
    transcript?: Transcript;
    aiResponse?: AIResponse;
    processingTime?: number;
}

export interface VideoMetadata {
    title: string;
    description: string;
    duration: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnailUrl: string;
    tags: string[];
    viewCount: number;
    likeCount: number;
}

export interface Transcript {
    text: string;
    language: string;
    segments: TranscriptSegment[];
}

export interface TranscriptSegment {
    text: string;
    start: number;
    duration: number;
}

export interface AIProcessingOptions {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface AIResponse {
    content: string;
    provider: string;
    model: string;
    tokensUsed?: number;
    processingTime?: number;
}

export interface AIProvider {
    name: string;
    models: string[];
    capabilities: string[];
}

export interface ModalOptions {
    title: string;
    content: string;
    buttons?: ModalButton[];
    input?: ModalInputOptions;
    width?: number;
    height?: number;
}

export interface ModalButton {
    label: string;
    value?: any;
    primary?: boolean;
    cancel?: boolean;
}

export interface ModalInputOptions {
    type: 'text' | 'textarea' | 'select' | 'checkbox';
    placeholder?: string;
    defaultValue?: any;
    options?: Array<{ label: string; value: any }>;
    required?: boolean;
}

export interface ProgressBarAPI {
    update: (value: number, text?: string) => void;
    increment: (amount?: number) => void;
    complete: (text?: string) => void;
    hide: () => void;
}

export type EventCallback = (data?: any) => void;

/**
 * Plugin API Manager for third-party integrations
 */
export class PluginAPIManager {
    private static instance: PluginAPIManager;
    private plugin: YoutubeClipperPlugin;
    private app: App;
    private api: PluginAPI;
    private eventListeners = new Map<string, Set<EventCallback>>();
    private registeredPlugins = new Map<string, RegisteredPlugin>();
    private performanceMonitor?: PerformanceMonitor;

    private constructor(plugin: YoutubeClipperPlugin, app: App) {
        this.plugin = plugin;
        this.app = app;
        this.performanceMonitor = new PerformanceMonitor();

        this.initializeAPI();
    }

    static getInstance(plugin: YoutubeClipperPlugin, app: App): PluginAPIManager {
        if (!PluginAPIManager.instance) {
            PluginAPIManager.instance = new PluginAPIManager(plugin, app);
        }
        return PluginAPIManager.instance;
    }

    private initializeAPI(): void {
        this.api = {
            version: '1.3.5',
            capabilities: {
                videoProcessing: true,
                aiProcessing: true,
                transcriptExtraction: true,
                fileManagement: true,
                customization: true,
                monitoring: true
            },
            video: this.createVideoAPI(),
            ai: this.createAIAPI(),
            storage: this.createStorageAPI(),
            ui: this.createUIAPI(),
            events: this.createEventsAPI(),
            utils: this.createUtilsAPI()
        };
    }

    private createVideoAPI(): VideoAPI {
        return {
            process: async (url: string, options: VideoProcessingOptions = {}) => {
                return this.performanceMonitor.measure('api-video-process', async () => {
                    try {
                        const container = this.plugin.getServiceContainer();
                        if (!container) {
                            throw new Error('Service container not available');
                        }

                        const videoService = container.videoService;
                        const aiService = container.aiService;
                        const fileService = container.fileService;

                        // Extract video ID
                        const videoId = videoService.extractVideoId(url);
                        if (!videoId) {
                            return { success: false, error: 'Invalid YouTube URL' };
                        }

                        // Extract metadata
                        const metadata = await videoService.getVideoData(videoId);

                        // Extract transcript if needed
                        let transcript: Transcript | undefined;
                        if (options.includeTranscript !== false) {
                            transcript = await videoService.getTranscript(videoId);
                        }

                        // Process with AI
                        let aiResponse: AIResponse | undefined;
                        if (options.format || options.customPrompt) {
                            const prompt = this.createPrompt(metadata, transcript, options);
                            aiResponse = await aiService.process(prompt, options.provider, options.model);
                        }

                        // Save to file if content was generated
                        let filePath: string | undefined;
                        if (aiResponse) {
                            const content = this.formatOutput(metadata, aiResponse, transcript);
                            filePath = await fileService.saveToFile(
                                metadata.title,
                                content,
                                options.outputPath || this.plugin.getCurrentSettings().outputPath
                            );
                        }

                        return {
                            success: true,
                            filePath,
                            metadata: {
                                title: metadata.title,
                                description: metadata.description,
                                duration: metadata.duration,
                                channelId: metadata.channelId,
                                channelTitle: metadata.channelTitle,
                                publishedAt: metadata.publishedAt,
                                thumbnailUrl: metadata.thumbnailUrl,
                                tags: metadata.tags || [],
                                viewCount: metadata.viewCount,
                                likeCount: metadata.likeCount
                            },
                            transcript,
                            aiResponse,
                            processingTime: 0 // Will be set by performance monitor
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: (error as Error).message
                        };
                    }
                });
            },

            extractMetadata: async (url: string) => {
                const container = this.plugin.getServiceContainer();
                if (!container) {
                    throw new Error('Service container not available');
                }

                const videoService = container.videoService;
                const videoId = videoService.extractVideoId(url);
                if (!videoId) {
                    throw new Error('Invalid YouTube URL');
                }

                const metadata = await videoService.getVideoData(videoId);
                return {
                    title: metadata.title,
                    description: metadata.description,
                    duration: metadata.duration,
                    channelId: metadata.channelId,
                    channelTitle: metadata.channelTitle,
                    publishedAt: metadata.publishedAt,
                    thumbnailUrl: metadata.thumbnailUrl,
                    tags: metadata.tags || [],
                    viewCount: metadata.viewCount,
                    likeCount: metadata.likeCount
                };
            },

            extractTranscript: async (videoId: string) => {
                const container = this.plugin.getServiceContainer();
                if (!container) {
                    throw new Error('Service container not available');
                }

                const videoService = container.videoService;
                return await videoService.getTranscript(videoId);
            },

            validateUrl: (url: string) => {
                try {
                    const urlObj = new URL(url);
                    return ['youtube.com', 'youtu.be', 'm.youtube.com'].includes(urlObj.hostname);
                } catch {
                    return false;
                }
            },

            extractVideoId: (url: string) => {
                try {
                    const urlObj = new URL(url);

                    if (urlObj.hostname === 'youtu.be') {
                        return urlObj.pathname.slice(1);
                    }

                    if (urlObj.hostname.includes('youtube.com')) {
                        const params = new URLSearchParams(urlObj.search);
                        return params.get('v');
                    }

                    return null;
                } catch {
                    return null;
                }
            }
        };
    }

    private createAIAPI(): AIAPI {
        return {
            process: async (prompt: string, options: AIProcessingOptions = {}) => {
                const container = this.plugin.getServiceContainer();
                if (!container) {
                    throw new Error('Service container not available');
                }

                const aiService = container.aiService;
                return await aiService.process(prompt, options.provider, options.model);
            },

            getProviders: () => {
                const container = this.plugin.getServiceContainer();
                if (!container) {
                    return [];
                }

                const aiService = container.aiService;
                return aiService.getProviderNames().map(name => ({
                    name,
                    models: aiService.getProviderModels(name) || [],
                    capabilities: ['text-generation', 'analysis', 'summarization']
                }));
            },

            getModels: (provider?: string) => {
                const container = this.plugin.getServiceContainer();
                if (!container) {
                    return [];
                }

                const aiService = container.aiService;
                if (provider) {
                    return aiService.getProviderModels(provider) || [];
                }

                // Return all models from all providers
                const allModels: string[] = [];
                for (const p of aiService.getProviderNames()) {
                    allModels.push(...(aiService.getProviderModels(p) || []));
                }
                return allModels;
            },

            setProvider: (provider: string) => {
                const settings = this.plugin.getCurrentSettings();
                // This would need to be implemented in the main plugin
                console.info('AI provider set to:', provider);
            },

            setModel: (model: string) => {
                const settings = this.plugin.getCurrentSettings();
                // This would need to be implemented in the main plugin
                console.info('AI model set to:', model);
            }
        };
    }

    private createStorageAPI(): StorageAPI {
        return {
            saveFile: async (path: string, content: string) => {
                const container = this.plugin.getServiceContainer();
                if (!container) {
                    throw new Error('Service container not available');
                }

                const fileService = container.fileService;
                return await fileService.saveFile(path, content);
            },

            readFile: async (path: string) => {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (!file || !(file instanceof TFile)) {
                    throw new Error(`File not found: ${path}`);
                }

                return await this.app.vault.read(file);
            },

            fileExists: async (path: string) => {
                const file = this.app.vault.getAbstractFileByPath(path);
                return file instanceof TFile;
            },

            createFolder: async (path: string) => {
                await this.app.vault.createFolder(path);
            },

            listFiles: async (folder: string, extension?: string) => {
                const folderFile = this.app.vault.getAbstractFileByPath(folder);
                if (!folderFile) {
                    throw new Error(`Folder not found: ${folder}`);
                }

                const files: string[] = [];
                const children = this.app.vault.getAllLoadedFiles()
                    .filter(file => file.path.startsWith(folder));

                for (const child of children) {
                    if (!extension || child.path.endsWith(extension)) {
                        files.push(child.path);
                    }
                }

                return files;
            }
        };
    }

    private createUIAPI(): UIAPI {
        return {
            showModal: async (options: ModalOptions) => {
                return new Promise((resolve) => {
                    // This would create a modal using the plugin's modal system
                    // For now, we'll use a simple prompt
                    if (options.input) {
                        const result = options.input.type === 'text' ?
                            prompt(options.content, options.input.defaultValue) :
                            confirm(options.content);

                        resolve(result);
                    } else {
                        alert(options.content);
                        resolve(undefined);
                    }
                });
            },

            showNotice: (message: string, timeout?: number) => {
                // Use Obsidian's Notice system
                const { Notice } = require('obsidian');
                new Notice(message, timeout);
            },

            confirm: (message: string, title?: string) => {
                return Promise.resolve(confirm(`${title ? title + '\n' : ''}${message}`));
            },

            prompt: (message: string, defaultValue?: string) => {
                return Promise.resolve(prompt(message, defaultValue) || null);
            },

            createProgressBar: (max: number) => {
                return {
                    update: (value: number, text?: string) => {
                        console.log(`Progress: ${value}/${max}${text ? ` - ${text}` : ''}`);
                    },
                    increment: (amount = 1) => {
                        console.log(`Progress incremented by ${amount}`);
                    },
                    complete: (text?: string) => {
                        console.log(`Progress complete${text ? ` - ${text}` : ''}`);
                    },
                    hide: () => {
                        console.log('Progress hidden');
                    }
                };
            }
        };
    }

    private createEventsAPI(): EventsAPI {
        return {
            on: (event: string, callback: EventCallback) => {
                if (!this.eventListeners.has(event)) {
                    this.eventListeners.set(event, new Set());
                }

                this.eventListeners.get(event)!.add(callback);

                // Return unsubscribe function
                return () => {
                    const listeners = this.eventListeners.get(event);
                    if (listeners) {
                        listeners.delete(callback);
                        if (listeners.size === 0) {
                            this.eventListeners.delete(event);
                        }
                    }
                };
            },

            emit: (event: string, data?: any) => {
                const listeners = this.eventListeners.get(event);
                if (listeners) {
                    listeners.forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error(`Error in event listener for ${event}:`, error);
                        }
                    });
                }
            },

            once: (event: string, callback: EventCallback) => {
                const onceCallback = (data?: any) => {
                    callback(data);
                    this.off(event, onceCallback);
                };

                return this.on(event, onceCallback);
            },

            off: (event: string, callback: EventCallback) => {
                const listeners = this.eventListeners.get(event);
                if (listeners) {
                    listeners.delete(callback);
                    if (listeners.size === 0) {
                        this.eventListeners.delete(event);
                    }
                }
            }
        };
    }

    private createUtilsAPI(): UtilsAPI {
        return {
            formatTimestamp: (timestamp: number) => {
                return new Date(timestamp).toLocaleString();
            },

            sanitizeFilename: (filename: string) => {
                return filename
                    .replace(/[<>:"/\\|?*]/g, '_')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 255);
            },

            generateId: () => {
                return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
            },

            debounce: <T extends (...args: any[]) => any>(fn: T, delay: number) => {
                let timeoutId: number;
                return ((...args: Parameters<T>) => {
                    clearTimeout(timeoutId);
                    timeoutId = window.setTimeout(() => fn(...args), delay);
                }) as T;
            },

            throttle: <T extends (...args: any[]) => any>(fn: T, limit: number) => {
                let inThrottle = false;
                return ((...args: Parameters<T>) => {
                    if (!inThrottle) {
                        fn(...args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                }) as T;
            }
        };
    }

    private createPrompt(metadata: any, transcript?: Transcript, options?: VideoProcessingOptions): string {
        const format = options.format || 'detailed-guide';
        const customPrompt = options.customPrompt;

        if (customPrompt) {
            return customPrompt;
        }

        // Create prompt based on format
        const basePrompt = `Please analyze the following YouTube video and provide a comprehensive ${format}:`;

        const metadataSection = `
Video Title: ${metadata.title}
Channel: ${metadata.channelTitle}
Description: ${metadata.description}
Duration: ${metadata.duration}
`;

        const transcriptSection = transcript ? `
Transcript:
${transcript.text}
` : '';

        return `${basePrompt}

${metadataSection}
${transcriptSection}

Please structure your response to be actionable and informative.`;
    }

    private formatOutput(metadata: any, aiResponse: AIResponse, transcript?: Transcript): string {
        const output = [
            '---',
            `# ${metadata.title}`,
            '',
            **Video Information:**',
            `- **Channel:** ${metadata.channelTitle}`,
            `- **Duration:** ${metadata.duration}`,
            `- **Published:** ${new Date(metadata.publishedAt).toLocaleDateString()}`,
            '',
            '## AI Analysis',
            aiResponse.content,
            ''
        ];

        if (transcript) {
            output.push(
                '## Transcript',
                transcript.text,
                ''
            );
        }

        output.push('---');
        return output.join('\n');
    }

    // Public API methods

    /**
     * Get the plugin API
     */
    getAPI(): PluginAPI {
        return this.api;
    }

    /**
     * Register a third-party plugin
     */
    registerPlugin(pluginInfo: ThirdPartyPlugin): boolean {
        try {
            // Validate plugin
            if (!pluginInfo.name || !pluginInfo.version) {
                return false;
            }

            // Check if plugin is already registered
            if (this.registeredPlugins.has(pluginInfo.name)) {
                return false;
            }

            // Initialize plugin if it has an init function
            if (pluginInfo.init) {
                pluginInfo.init(this.api);
            }

            const registeredPlugin: RegisteredPlugin = {
                ...pluginInfo,
                registeredAt: Date.now(),
                active: true
            };

            this.registeredPlugins.set(pluginInfo.name, registeredPlugin);

            // Emit registration event
            this.emit('plugin-registered', { plugin: registeredPlugin });

            console.info(`Plugin registered: ${pluginInfo.name} v${pluginInfo.version}`);
            return true;
        } catch (error) {
            console.error(`Failed to register plugin ${pluginInfo.name}:`, error);
            return false;
        }
    }

    /**
     * Unregister a third-party plugin
     */
    unregisterPlugin(name: string): boolean {
        try {
            const plugin = this.registeredPlugins.get(name);
            if (!plugin) {
                return false;
            }

            // Call cleanup if available
            if (plugin.cleanup) {
                plugin.cleanup();
            }

            this.registeredPlugins.delete(name);

            // Emit unregistration event
            this.emit('plugin-unregistered', { plugin });

            console.info(`Plugin unregistered: ${name}`);
            return true;
        } catch (error) {
            console.error(`Failed to unregister plugin ${name}:`, error);
            return false;
        }
    }

    /**
     * Get registered plugins
     */
    getRegisteredPlugins(): RegisteredPlugin[] {
        return Array.from(this.registeredPlugins.values());
    }

    /**
     * Get plugin by name
     */
    getPlugin(name: string): RegisteredPlugin | undefined {
        return this.registeredPlugins.get(name);
    }

    /**
     * Emit an event to all registered plugins
     */
    emit(event: string, data?: any): void {
        this.createEventsAPI().emit(event, data);

        // Also emit to registered plugins that have event handlers
        this.registeredPlugins.forEach(plugin => {
            if (plugin.active && plugin.eventHandler) {
                try {
                    plugin.eventHandler(event, data);
                } catch (error) {
                    console.error(`Error in plugin ${plugin.name} event handler:`, error);
                }
            }
        });
    }

    /**
     * Get API metrics
     */
    getMetrics(): any {
        return this.performanceMonitor.getOverview();
    }

    /**
     * Cleanup API manager
     */
    cleanup(): void {
        // Cleanup all registered plugins
        this.registeredPlugins.forEach((plugin, name) => {
            if (plugin.cleanup) {
                try {
                    plugin.cleanup();
                } catch (error) {
                    console.error(`Error cleaning up plugin ${name}:`, error);
                }
            }
        });

        this.registeredPlugins.clear();
        this.eventListeners.clear();

        if (this.performanceMonitor) {
            this.performanceMonitor.cleanup();
        }
    }
}

// Type definitions for external plugins
export interface ThirdPartyPlugin {
    name: string;
    version: string;
    description?: string;
    author?: string;
    dependencies?: string[];
    init?: (api: PluginAPI) => void;
    cleanup?: () => void;
    eventHandler?: (event: string, data?: any) => void;
}

export interface RegisteredPlugin extends ThirdPartyPlugin {
    registeredAt: number;
    active: boolean;
}

// Global API instance
export let pluginAPI: PluginAPI;