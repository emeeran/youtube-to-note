import { TFile } from 'obsidian';

/**
 * Core interfaces and types for the YouTube Clipper plugin
 * @author YouTube Clipper Team
 * @version 1.3.5
 * @since 1.0.0
 */

/**
 * Main plugin settings interface
 *
 * Contains all configuration options for the YouTube Clipper plugin,
 * including API keys, performance settings, and user preferences.
 *
 * @example
 * ```typescript
 * const settings: YouTubePluginSettings = {
 *   geminiApiKey: 'AIzaSy...',
 *   groqApiKey: 'gsk_...',
 *   outputPath: '/YouTube Notes',
 *   performanceMode: 'balanced',
 *   defaultMaxTokens: 8000,
 *   defaultTemperature: 0.7
 * };
 * ```
 */
export interface YouTubePluginSettings {
    /** Google Gemini API key for video analysis
     * @description Get from https://makersuite.google.com/app/apikey
     * @format string starting with "AIzaSy"
     * @example "AIzaSyDk7-7a3b2c1d9e8f6g5h4i3j2k1l0m9n8o7p6q5r"
     */
    geminiApiKey: string;

    /** Groq API key for high-speed text processing
     * @description Get from https://console.groq.com/keys
     * @format string starting with "gsk_"
     * @example "gsk_4xJz7K8b2L9mN3pQ6rS1tU5vW8xY2zA5b8c"
     */
    groqApiKey: string;

    /** Ollama API key for local AI model access
     * @description Optional key for authenticated Ollama instances
     * @example "ollama-local-key-123456789"
     */
    ollamaApiKey: string;

    /** Default output path for generated notes
     * @description Supports template variables like {{date}} and {{title}}
     * @example "/YouTube Notes/{{date}} - {{title}}"
     */
    outputPath: string;

    /** Enable environment variable override for API keys
     * @description When true, API keys are loaded from environment variables first
     * @default false
     */
    useEnvironmentVariables: boolean;

    /** Prefix for environment variable names
     * @description Used when useEnvironmentVariables is true
     * @default "YTC_"
     * @example "YTC_" for variables like YTC_GEMINI_API_KEY
     */
    environmentPrefix: string;

    /** Cache for available models per provider
     * @description Maps provider names to arrays of available model names
     * @internal Used internally for performance optimization
     */
    modelOptionsCache?: Record<string, string[]>;

    /** Custom prompts for different output formats
     * @description Maps output formats to custom prompt templates
     * @example { 'custom': 'Analyze this video for key insights...' }
     */
    customPrompts?: Record<OutputFormat, string>;

    /** Performance mode affecting speed vs quality trade-offs
     * @description 'fast' prioritizes speed, 'quality' prioritizes quality, 'balanced' is middle ground
     * @default 'balanced'
     */
    performanceMode: PerformanceMode;

    /** Custom timeout settings for different operations
     * @description Allows fine-tuning of timeouts per provider/service
     */
    customTimeouts?: CustomTimeoutSettings;

    /** Enable parallel processing of multiple videos
     * @description When true, multiple videos can be processed simultaneously
     * @default true
     */
    enableParallelProcessing: boolean;

    /** Prefer multimodal AI providers when available
     * @description When true, providers with video/audio analysis are prioritized
     * @default false
     */
    preferMultimodal: boolean;

    /** Default maximum tokens for AI responses
     * @description Controls response length, typically 100-8000 tokens
     * @default 8000
     * @minimum 1
     * @maximum 32000
     */
    defaultMaxTokens: number;

    /** Default temperature for AI responses
     * @description Controls creativity, 0.0 (deterministic) to 1.0 (creative)
     * @default 0.7
     * @minimum 0
     * @maximum 1
     */
    defaultTemperature: number;
}

/**
 * Performance mode options affecting speed and quality trade-offs
 *
 * - **'fast'**: Prioritizes speed over quality, uses smaller models and lower timeouts
 * - **'balanced'**: Middle ground between speed and quality
 * - **'quality'**: Prioritizes quality over speed, uses larger models and higher timeouts
 */
export type PerformanceMode = 'fast' | 'balanced' | 'quality';

/**
 * Custom timeout settings for different API endpoints and providers
 *
 * Allows fine-tuning of request timeouts based on network conditions and
 * expected response times from different services.
 */
export interface CustomTimeoutSettings {
    /** Timeout for Google Gemini API requests in milliseconds
     * @description Typically requires longer timeouts for video analysis
     * @default 30000
     * @minimum 5000
     * @maximum 120000
     */
    geminiTimeout: number;

    /** Timeout for Groq API requests in milliseconds
     * @description Groq is typically fast, but timeouts may be needed for complex prompts
     * @default 25000
     * @minimum 5000
     * @maximum 60000
     */
    groqTimeout: number;

    /** Timeout for YouTube metadata API requests in milliseconds
     * @description For fetching video information from YouTube API
     * @default 10000
     * @minimum 2000
     * @maximum 30000
     */
    metadataTimeout: number;
}

/**
 * Performance preset configuration with optimized settings
 *
 * Contains pre-configured combinations of timeouts, parallel settings,
 * and model strategies for different use cases.
 */
export interface PerformancePreset {
    /** Human-readable name of the preset
     * @example "Lightning Fast"
     */
    name: string;

    /** Description of what this preset is optimized for
     * @example "Optimized for speed with basic analysis"
     */
    description: string;

    /** Timeout settings for this preset
     */
    timeouts: CustomTimeoutSettings;

    /** Whether to enable parallel processing
     */
    enableParallel: boolean;

    /** Whether to prefer multimodal providers
     */
    preferMultimodal: boolean;

    /** Model selection strategy for different output formats
     */
    modelStrategy: ModelStrategy;
}

/**
 * Model selection strategy for different output formats
 *
 * Maps different output formats to specific AI models and provides
 * fallback options for reliability.
 */
export interface ModelStrategy {
    /** Model to use for brief format outputs
     * @description Should be fast and efficient for short responses
     * @example "gemini-2.5-flash"
     */
    briefFormat: string;

    /** Model to use for executive summary format
     * @description Balance between speed and quality for medium-length responses
     * @example "gemini-2.5-pro"
     */
    executiveSummary: string;

    /** Model to use for detailed guide format
     * @description Should handle long-form content generation well
     * @example "gemini-2.5-pro"
     */
    detailedGuide: string;

    /** Fallback model when preferred model is unavailable
     * @description Should be widely available and reliable
     * @example "gemini-2.5-flash"
     */
    fallbackModel: string;
}

/**
 * Available output formats for video analysis
 *
 * Each format produces a different type of structured note from the video content.
 */
export type OutputFormat =
    /** Executive summary with key insights (≤250 words) */
    | 'executive-summary'

    /** Step-by-step detailed guide (≤8000 words) */
    | 'detailed-guide'

    /** Brief overview with essential points (≤100 words) */
    | 'brief'

    /** Custom format using user-defined prompt */
    | 'custom';

/**
 * Options for video processing operations
 *
 * Configures how videos should be analyzed and what features should be used.
 */
export interface ProcessingOptions {
    /** Output format for the analysis */
    format: OutputFormat;

    /** Whether to use multimodal analysis (video + audio + text)
     * @description When true, AI providers with video analysis capabilities are used
     * @default false
     */
    useMultimodal: boolean;
}

/**
 * Video metadata extracted from YouTube
 *
 * Contains essential information about the video including title,
 * description, and engagement metrics.
 */
export interface VideoData {
    /** Video title from YouTube metadata
     * @example "How to Build a REST API with Node.js"
     */
    title: string;

    /** Video description from YouTube metadata
     * @description May contain HTML and rich text content
     */
    description: string;
}

/**
 * Response from AI provider after processing
 *
 * Contains the generated content and metadata about the processing.
 */
export interface AIResponse {
    /** Generated content from the AI provider
     * @description The main text output of the analysis
     */
    content: string;

    /** Name of the AI provider that generated the response
     * @example "Google Gemini"
     */
    provider: string;

    /** Specific model used by the provider
     * @example "gemini-2.5-pro"
     */
    model: string;
}

/**
 * Result of a video processing operation
 *
 * Contains information about whether the processing succeeded,
 * the output file location, and any error that occurred.
 */
export interface ProcessingResult {
    /** Whether the processing was successful
     * @description true if the video was analyzed and note was created
     */
    success: boolean;

    /** Path to the generated note file
     * @description Only present when success is true
     * @example "/YouTube Notes/2024-12-02 - How to Build REST API.md"
     */
    filePath?: string;

    /** Error message if processing failed
     * @description Only present when success is false
     * @example "Failed to extract video ID from URL"
     */
    error?: string;
}

// Service interfaces

/**
 * Interface for AI providers that can process text prompts
 *
 * Defines the contract for all AI service implementations including
 * Google Gemini, Groq, and Ollama providers.
 */
export interface AIProvider {
    /** Readable name of the AI provider
     * @example "Google Gemini"
     */
    readonly name: string;

    /** Current model being used by the provider
     * @example "gemini-2.5-pro"
     */
    model: string;

    /** Process a text prompt and return the AI response
     * @param prompt - The text prompt to process
     * @returns Promise that resolves to the AI-generated text
     * @example
     * ```typescript
     const response = await provider.process("Analyze this video for key insights");
     * console.log(response); // AI-generated analysis
     * ```
     */
    process(prompt: string): Promise<string>;

    /** Optional method for processing prompts with images
     * @param prompt - Text prompt to process
     * @param images - Array of image data as strings or ArrayBuffers
     * @returns Promise that resolves to the AI-generated text
     */
    processWithImage?(prompt: string, images?: (string | ArrayBuffer)[]): Promise<string>;

    /** Optional method to set the AI model
     * @param model - Model name to use
     */
    setModel?(model: string): void;

    /** Optional method to set request timeout
     * @param timeout - Timeout in milliseconds
     */
    setTimeout?(timeout: number): void;

    /** Optional method to set maximum token limit
     * @param maxTokens - Maximum number of tokens for response
     */
    setMaxTokens?(maxTokens: number): void;

    /** Optional method to set temperature (creativity)
     * @param temperature - Temperature value between 0 and 1
     */
    setTemperature?(temperature: number): void;

    /** Optional maximum token limit for responses
     * @description Read-only property for current token limit
     */
    maxTokens?: number;

    /** Optional temperature setting for responses
     * @description Read-only property for current temperature
     */
    temperature?: number;
}

/**
 * Interface for YouTube video data services
 *
 * Handles extraction of video information and metadata from YouTube URLs.
 */
export interface VideoDataService {
    /** Extract YouTube video ID from a URL
     * @param url - YouTube video URL
     * @returns Video ID string or null if invalid
     * @example
     * ```typescript
     const videoId = service.extractVideoId("https://youtube.com/watch?v=abc123");
     * console.log(videoId); // "abc123"
     * ```
     */
    extractVideoId(url: string): string | null;

    /** Get comprehensive video data for a video ID
     * @param videoId - YouTube video ID
     * @returns Promise resolving to video metadata
     * @example
     * ```typescript
     const data = await service.getVideoData("abc123");
     * console.log(data.title); // "Video Title"
     * console.log(data.description); // "Video description"
     * ```
     */
    getVideoData(videoId: string): Promise<VideoData>;
}

/**
 * Interface for file operations within Obsidian
 *
 * Handles saving files to the vault and managing file interactions.
 */
export interface FileService {
    /** Save content to a file in the Obsidian vault
     * @param title - File title (will be sanitized for filename)
     * @param content - File content to save
     * @param outputPath - Directory path where to save the file
     * @returns Promise resolving to the full file path
     * @example
     * ```typescript
     const filePath = await service.saveToFile(
     *   "My Video Analysis",
     *   "# Analysis\n\nKey insights...",
     *   "/YouTube Notes"
     * );
     * console.log(filePath); // "/YouTube Notes/My Video Analysis.md"
     * ```
     */
    saveToFile(title: string, content: string, outputPath: string): Promise<string>;

    /** Open a file with confirmation dialog
     * @param file - Obsidian TFile object to open
     * @returns Promise that resolves when file is opened
     */
    openFileWithConfirmation(file: TFile): Promise<void>;
}

/**
 * Interface for caching services
 *
 * Provides in-memory caching with TTL support for performance optimization.
 */
export interface CacheService {
    /** Get a value from the cache
     * @param key - Cache key
     * @returns Cached value or null if not found
     * @template T - Type of cached value
     */
    get<T>(key: string): T | null;

    /** Set a value in the cache with optional TTL
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttl - Time to live in milliseconds (optional)
     * @template T - Type of value to cache
     */
    set<T>(key: string, value: T, ttl?: number): void;

    /** Remove a value from the cache
     * @param key - Cache key to remove
     * @returns True if value was removed, false if key didn't exist
     */
    delete(key: string): boolean;

    /** Clear all cached values
     */
    clear(): void;
}

/**
 * Interface for prompt generation services
 *
 * Creates structured prompts for AI providers based on video data
 * and desired output formats.
 */
export interface PromptService {
    /** Create analysis prompt based on video data and options
     * @param videoData - Video metadata
     * @param videoUrl - Original video URL
     * @param format - Desired output format
     * @param customPrompt - Optional custom prompt template
     * @returns Formatted prompt string for AI processing
     */
    createAnalysisPrompt(
        videoData: VideoData,
        videoUrl: string,
        format?: OutputFormat,
        customPrompt?: string
    ): string;

    /** Process AI response and format for output
     * @param content - Raw AI response content
     * @param provider - AI provider name
     * @param model - AI model name
     * @param format - Output format used
     * @param videoData - Video metadata
     * @param videoUrl - Original video URL
     * @returns Formatted content ready for file output
     */
    processAIResponse(
        content: string,
        provider: string,
        model: string,
        format?: OutputFormat,
        videoData?: VideoData,
        videoUrl?: string
    ): string;
}

// Utility types

/**
 * Style object for CSS properties
 *
 * Maps CSS property names to their values, supporting both
 * camelCase and kebab-case property names.
 */
export type StyleObject = Record<string, string | number>;

/**
 * Interface for DOM utility functions
 *
 * Provides common DOM manipulation methods used throughout
 * the plugin for consistent styling and element creation.
 */
export interface DOMUtilsInterface {
    /** Apply multiple CSS styles to an element
     * @param element - DOM element to style
     * @param styles - Object with CSS properties
     */
    applyStyles(element: HTMLElement, styles: StyleObject): void;

    /** Create a container div for buttons
     * @param parent - Parent element to append container to
     * @returns Created button container element
     */
    createButtonContainer(parent: HTMLElement): HTMLDivElement;

    /** Create a styled button element
     * @param container - Container to append button to
     * @param text - Button text
     * @param isPrimary - Whether button should use primary styling
     * @param onClick - Click handler function
     * @returns Created button element
     */
    createStyledButton(
        container: HTMLElement,
        text: string,
        isPrimary?: boolean,
        onClick?: () => void
    ): HTMLButtonElement;
}

/**
 * Interface for error handling utilities
 *
 * Provides consistent error handling and user feedback throughout
 * the plugin.
 */
export interface ErrorHandlerInterface {
    /** Handle an error with appropriate user feedback
     * @param error - Error object or message
     * @param context - Context where error occurred
     * @param showNotice - Whether to show Obsidian notice
     */
    handle(error: Error, context: string, showNotice?: boolean): void;

    /** Wrap an operation with error handling
     * @param operation - Async operation to wrap
     * @param context - Context description for error reporting
     * @returns Promise resolving to operation result or null if error
     */
    withErrorHandling<T>(
        operation: () => Promise<T>,
        context: string
    ): Promise<T | null>;
}

// Configuration types

/**
 * Interface for the main service container
 *
 * Manages all plugin services and their dependencies.
 */
export interface ServiceContainer {
    /** AI service for processing video content */
    aiService: AIService;

    /** Video data service for YouTube metadata */
    videoService: VideoDataService;

    /** File service for vault operations */
    fileService: FileService;

    /** Cache service for performance optimization */
    cacheService: CacheService;

    /** Prompt service for AI prompt generation */
    promptService: PromptService;
}

/**
 * Interface for the main AI service
 *
 * Coordinates between different AI providers and manages
 * fallback logic and provider selection.
 */
export interface AIService {
    /** Process a prompt with the current AI configuration
     * @param prompt - Text prompt to process
     * @param images - Optional images for multimodal processing
     * @returns Promise resolving to AI response
     */
    process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse>;

    /** Process with a specific AI provider
     * @param providerName - Name of provider to use
     * @param prompt - Text prompt to process
     * @param overrideModel - Optional model override
     * @param images - Optional images for multimodal processing
     * @returns Promise resolving to AI response
     */
    processWith(
        providerName: string,
        prompt: string,
        overrideModel?: string,
        images?: (string | ArrayBuffer)[]
    ): Promise<AIResponse>;

    /** Get list of available AI provider names
     * @returns Array of provider names
     */
    getProviderNames(): string[];

    /** Get available models for a specific provider
     * @param providerName - Name of provider
     * @returns Array of model names
     */
    getProviderModels(providerName: string): string[];

    /** Fetch latest models from all providers
     * @returns Promise resolving to provider models mapping
     */
    fetchLatestModels(): Promise<Record<string, string[]>>;

    /** Fetch latest models for a specific provider
     * @param providerName - Name of provider to check
     * @returns Promise resolving to array of model names
     */
    fetchLatestModelsForProvider(providerName: string): Promise<string[]>;
}

// Event types

/**
 * Interface for modal event callbacks
 *
 * Defines the standard lifecycle events for modal dialogs.
 */
export interface ModalEvents {
    /** Called when modal is confirmed/accepted
     * @returns Optional promise for async confirmation handling
     */
    onConfirm: () => void | Promise<void>;

    /** Called when modal is cancelled/dismissed */
    onCancel: () => void;
}

// Additional types for extended functionality

/**
 * Enhanced video data with extended metadata
 *
 * Extends the base VideoData interface with additional properties
 * for comprehensive video information.
 */
export interface EnhancedVideoData extends VideoData {
    /** YouTube video ID */
    videoId: string;

    /** Video duration in seconds */
    duration: number;

    /** Channel information */
    channelTitle: string;

    /** Publication date */
    publishDate: string;

    /** View count */
    viewCount: number;

    /** Like count */
    likeCount: number;

    /** Video tags */
    tags: string[];

    /** Video category */
    category: string;

    /** Thumbnail URL */
    thumbnailUrl: string;
}

/**
 * Enhanced processing result with detailed information
 *
 * Extends the base ProcessingResult with additional metadata
 * for comprehensive processing tracking.
 */
export interface EnhancedProcessingResult extends ProcessingResult {
    /** Unique processing request ID */
    requestId: string;

    /** Timestamp when processing started */
    startTime: number;

    /** Timestamp when processing ended */
    endTime: number;

    /** Total processing time in milliseconds */
    processingTime: number;

    /** Number of retry attempts */
    retryCount: number;

    /** Video metadata that was processed */
    videoData?: EnhancedVideoData;

    /** AI provider used for processing */
    provider: string;

    /** AI model used for processing */
    model: string;

    /** Output format used */
    format: OutputFormat;

    /** Whether result was served from cache */
    cacheHit: boolean;
}

/**
 * Batch processing result for multiple videos
 *
 * Contains results and summary information for batch operations.
 */
export interface BatchProcessingResult {
    /** Array of individual processing results */
    results: ProcessingResult[];

    /** Total number of videos processed */
    totalVideos: number;

    /** Number of successful processes */
    successful: number;

    /** Number of failed processes */
    failed: number;

    /** Total processing time for batch */
    totalTime: number;

    /** Average processing time per video */
    averageTime: number;

    /** Batch processing request ID */
    batchId: string;

    /** Timestamp when batch started */
    startTime: number;

    /** Timestamp when batch ended */
    endTime: number;
}

/**
 * Performance metrics for monitoring plugin performance
 *
 * Contains comprehensive metrics about processing speed,
 * cache performance, and resource usage.
 */
export interface PerformanceMetrics {
    /** Total number of operations performed */
    totalOperations: number;

    /** Average processing time in milliseconds */
    averageProcessingTime: number;

    /** Number of slow operations (above threshold) */
    slowOperations: number;

    /** Error rate as percentage */
    errorRate: number;

    /** Cache hit rate as percentage */
    cacheHitRate: number;

    /** Memory usage in bytes */
    memoryUsage: number;

    /** Plugin uptime in milliseconds */
    uptime: number;

    /** Active providers count */
    activeProviders: number;
}

/**
 * Health check result for system health monitoring
 *
 * Contains information about the health of various
 * system components and services.
 */
export interface HealthCheckResult {
    /** Overall system health status */
    status: 'healthy' | 'degraded' | 'unhealthy';

    /** Individual component health results */
    components: ComponentHealth[];

    /** Performance warnings if any */
    warnings: string[];

    /** Errors if any */
    errors: string[];

    /** Timestamp of health check */
    timestamp: number;
}

/**
 * Health information for a single component
 *
 * Represents the health status of an individual system
 * component or service.
 */
export interface ComponentHealth {
    /** Name of the component */
    name: string;

    /** Health status */
    status: 'healthy' | 'degraded' | 'unhealthy';

    /** Health status message */
    message: string;

    /** Response time in milliseconds */
    responseTime?: number;

    /** Additional health metrics */
    metrics?: Record<string, number>;
}

/**
 * Configuration validation result
 *
 * Contains validation information for plugin settings.
 */
export interface ValidationResult {
    /** Whether configuration is valid */
    isValid: boolean;

    /** Array of validation error messages */
    errors: string[];

    /** Array of validation warning messages */
    warnings: string[];

    /** Array of informational messages */
    info: string[];
}