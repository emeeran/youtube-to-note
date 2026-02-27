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
    customPrompts?: Record<string, string>; // Custom prompts for different formats
    enableParallelProcessing: boolean;
    enableAutoFallback: boolean;
    preferMultimodal: boolean;
    defaultMaxTokens: number;
    defaultTemperature: number;
    encryptionVersion?: number; // Version of encryption used for API keys
}

/** Performance mode options */
export type PerformanceMode = 'fast' | 'balanced' | 'quality';

/** Timeout settings for API endpoints */
export interface CustomTimeoutSettings {
    geminiTimeout: number;
    groqTimeout: number;
    metadataTimeout: number;
}

/** Performance preset configuration */
export interface PerformancePreset {
    name: string;
    description: string;
    timeouts: CustomTimeoutSettings;
    enableParallel: boolean;
    preferMultimodal: boolean;
    modelStrategy: ModelStrategy;
}

/** Model selection strategy */
export interface ModelStrategy {
    briefFormat: string;
    executiveSummary: string;
    detailedGuide: string;
    fallbackModel: string;
}

/** Output formats for video analysis */
export type OutputFormat =
    | 'executive-summary'
    | 'step-by-step-tutorial'
    | 'concise-summary'
    | 'technical-analysis'
    | '3c-accelerated-learning'
    | 'complete-transcription';

/** Options for video processing */
export interface ProcessingOptions {
    format: OutputFormat;
    useMultimodal: boolean;
}

/** Video metadata from YouTube */
export interface VideoData {
    title: string;
    description: string;
    duration?: number;
    thumbnail?: string;
    channelName?: string;
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
    setModel?(model: string): void;
    setTimeout?(timeout: number): void;
    setMaxTokens?(maxTokens: number): void;
    setTemperature?(temperature: number): void;
    maxTokens?: number;
    temperature?: number;
}

/** Video data service interface */
export interface VideoDataService {
    extractVideoId(url: string): string | null;
    getVideoData(videoId: string): Promise<VideoData>;
    getTranscript?(videoId: string): Promise<{ fullText: string } | null>;
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
    ): Promise<AIResponse>;
    getProviderNames(): string[];
    getProviderModels(providerName: string): string[];
    fetchLatestModels(): Promise<Record<string, string[]>>;
    fetchLatestModelsForProvider(providerName: string): Promise<string[]>;
    getPerformanceMetrics?(): Record<string, unknown>;
    cleanup?(): void;
}

/** Modal event callbacks */
export interface ModalEvents {
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

/** Enhanced video data with extended metadata */
export interface EnhancedVideoData extends VideoData {
    videoId: string;
    duration: number;
    channelTitle: string;
    publishDate: string;
    viewCount: number;
    likeCount: number;
    tags: string[];
    category: string;
    thumbnailUrl: string;
}

/** Performance metrics for monitoring */
export interface PerformanceMetrics {
    totalOperations: number;
    averageProcessingTime: number;
    slowOperations: number;
    errorRate: number;
    cacheHitRate: number;
    memoryUsage: number;
    uptime: number;
    activeProviders: number;
}

/** Validation result for configuration */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: string[];
}
