import { TFile } from 'obsidian';

/**
 * Core interfaces and types for the YouTube Clipper plugin
 */

/** Main plugin settings */
export interface YouTubePluginSettings {
    geminiApiKey: string;
    groqApiKey: string;
    ollamaApiKey: string;
    ollamaEndpoint: string;
    huggingFaceApiKey: string;
    openRouterApiKey: string;
    outputPath: string;
    useEnvironmentVariables: boolean;
    environmentPrefix: string;
    modelOptionsCache?: Record<string, string[]>;
    modelCacheTimestamps?: Record<string, number>; // Cache timestamps for each provider
    performanceMode: PerformanceMode;
    customTimeouts?: CustomTimeoutSettings;
    enableParallelProcessing: boolean;
    enableAutoFallback: boolean;
    preferMultimodal: boolean;
    /** Preferred transcript language code (e.g. "en", "es"). Blank = auto (English fallback). */
    transcriptLanguage?: string;
    defaultMaxTokens: number;
    defaultTemperature: number;
}

/** Performance mode options */
export type PerformanceMode = 'fast' | 'balanced' | 'quality';

/** Timeout settings for API endpoints */
export interface CustomTimeoutSettings {
    geminiTimeout: number;
    groqTimeout: number;
    metadataTimeout: number;
}

/** Output formats for video analysis */
export type OutputFormat =
    | 'executive-summary'
    | 'technical-analysis'
    | '3c-accelerated-learning'
    | 'atom-notes'
    | 'article'
    | 'complete-transcription'
    | 'quick-notes';

/** Video metadata from YouTube */
export interface VideoData {
    title: string;
    description: string;
    duration?: number;
    thumbnail?: string;
    channelName?: string;
    publishedAt?: string;
}

/** Response from AI provider */
export interface AIResponse {
    content: string;
    provider: string;
    model: string;
}

/** Result of video processing */
export interface ProcessingResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

/** AI provider interface */
export interface AIProvider {
    readonly name: string;
    model: string;
    process(prompt: string): Promise<string>;
    processWithImage?(prompt: string, images?: (string | ArrayBuffer)[]): Promise<string>;
    /** Live-fetch the models available under this provider's credentials. */
    listModels?(): Promise<string[]>;
    setModel?(model: string): void;
    setTimeout?(timeout: number): void;
    setMaxTokens?(maxTokens: number): void;
    setTemperature?(temperature: number): void;
    maxTokens?: number;
    temperature?: number;
    cleanup?(): void;
}

/** Video data service interface */
export interface VideoDataService {
    extractVideoId(url: string): string | null;
    getVideoData(videoId: string): Promise<VideoData>;
    getTranscript?(videoId: string, language?: string): Promise<{ fullText: string } | null>;
    getPerformanceMetrics?(): Record<string, unknown>;
    cleanup?(): void;
}

/** File service interface */
export interface FileService {
    saveToFile(title: string, content: string, outputPath: string): Promise<string>;
    openFileWithConfirmation(file: TFile): Promise<void>;
}

/** Cache metrics */
export interface CacheMetrics {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    hitRate: number;
}

/** Cache service interface */
export interface CacheService {
    get<T>(key: string): T | null;
    set<T>(key: string, value: T, ttl?: number): void;
    delete(key: string): boolean;
    clear(): void;
    getMetrics?(): CacheMetrics;
    cleanup?(): void;
    destroy?(): void;
}

/** Prompt service interface */
export interface PromptService {
    createAnalysisPrompt(options: {
        videoData: VideoData;
        videoUrl: string;
        format?: OutputFormat;
        transcript?: string;
        performanceMode?: PerformanceMode;
        providerName?: string;
        userInstructions?: string;
    }): string;
    processAIResponse(
        content: string,
        provider: string,
        model: string,
        format?: OutputFormat,
        videoData?: VideoData,
        videoUrl?: string,
    ): string;
}

/** Style object for CSS */
export type StyleObject = Record<string, string | number>;

/** DOM utilities interface */
export interface DOMUtilsInterface {
    applyStyles(element: HTMLElement, styles: StyleObject): void;
    createButtonContainer(parent: HTMLElement): HTMLDivElement;
    createStyledButton(
        container: HTMLElement,
        text: string,
        isPrimary?: boolean,
        onClick?: () => void,
    ): HTMLButtonElement;
}

/** Error handler interface */
export interface ErrorHandlerInterface {
    handle(error: Error, context: string, showNotice?: boolean): void;
    withErrorHandling<T>(operation: () => Promise<T>, context: string): Promise<T | null>;
}

/** Service container interface */
export interface ServiceContainer {
    aiService: AIService;
    videoService: VideoDataService;
    fileService: FileService;
    cacheService: CacheService;
    promptService: PromptService;
}

/** AI service interface */
export interface AIService {
    process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse>;
    processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[],
        enableFallback?: boolean,
    ): Promise<AIResponse>;
    /** Apply maxTokens / temperature to every provider for the next request. */
    setModelParameters?(params: { maxTokens?: number; temperature?: number }): void;
    getProviderNames(): string[];
    getProviderModels(providerName: string): string[];
    fetchLatestModels(): Promise<Record<string, string[]>>;
    fetchLatestModelsForProvider(providerName: string, bypassCache?: boolean): Promise<string[]>;
    getPerformanceMetrics?(): Record<string, unknown>;
    cleanup?(): void;
}

/** Modal event callbacks */
export interface ModalEvents {
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}
