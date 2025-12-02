/**
 * Interface Segregation Principle (ISP) - Focused Interfaces
 * Interfaces are small, focused, and client-specific
 * No client is forced to depend on methods it doesn't use
 */

// ==================== AI PROVIDER INTERFACES ====================

/**
 * Core AI provider interface - all providers must implement this
 */
export interface ICoreAIProvider {
    readonly name: string;
    readonly model: string;
    process(prompt: string): Promise<string>;
}

/**
 * Configurable AI provider interface - for providers that support configuration
 */
export interface IConfigurableAIProvider extends ICoreAIProvider {
    setModel(model: string): void;
    setTimeout(timeout: number): void;
    setMaxTokens(maxTokens: number): void;
    setTemperature(temperature: number): void;
}

/**
 * Multimodal AI provider interface - for providers that support images/multimedia
 */
export interface IMultimodalAIProvider extends ICoreAIProvider {
    processWithImage(prompt: string, images: (string | ArrayBuffer)[]): Promise<string>;
    processWithVideo?(prompt: string, videoData: ArrayBuffer): Promise<string>;
}

/**
 * Advanced AI provider interface - for providers with advanced features
 */
export interface IAdvancedAIProvider extends IConfigurableAIProvider, IMultimodalAIProvider {
    getCapabilities(): AIProviderCapabilities;
    validateConfiguration(): boolean;
    getHealthStatus(): Promise<ProviderHealthStatus>;
}

// ==================== SERVICE INTERFACES ====================

/**
 * Core video data interface
 */
export interface IVideoDataService {
    extractVideoId(url: string): string | null;
    getVideoMetadata(videoId: string): Promise<VideoMetadata>;
}

/**
 * Enhanced video data interface with caching
 */
export interface IEnhancedVideoDataService extends IVideoDataService {
    getVideoDataWithCache(videoId: string, forceRefresh?: boolean): Promise<VideoData>;
    clearCache(): void;
    getCacheStats(): CacheStats;
}

/**
 * Core file service interface
 */
export interface IFileService {
    saveToFile(title: string, content: string, outputPath: string): Promise<string>;
    openFile(filePath: string): Promise<void>;
    fileExists(path: string): Promise<boolean>;
}

/**
 * Enhanced file service with confirmation and conflict handling
 */
export interface IEnhancedFileService extends IFileService {
    saveWithConfirmation(title: string, content: string, outputPath: string): Promise<string>;
    handleFileConflict(fileName: string, newPath: string): Promise<string>;
    createBackup(filePath: string): Promise<string>;
}

/**
 * Core cache service interface
 */
export interface ICacheService {
    get<T>(key: string): T | null;
    set<T>(key: string, value: T, ttl?: number): void;
    delete(key: string): boolean;
    clear(): void;
}

/**
 * Advanced cache service interface
 */
export interface IAdvancedCacheService extends ICacheService {
    getWithFallback<T>(key: string, fallback: () => Promise<T>): Promise<T>;
    setWithExpiration<T>(key: string, value: T, expiration: Date): void;
    getStats(): CacheStats;
    cleanup(): void;
}

// ==================== PROCESSING INTERFACES ====================

/**
 * Core prompt service interface
 */
export interface IPromptService {
    createAnalysisPrompt(videoData: VideoData, options: PromptOptions): string;
    processResponse(content: string, format: OutputFormat): string;
}

/**
 * Enhanced prompt service interface with templates
 */
export interface IEnhancedPromptService extends IPromptService {
    registerTemplate(name: string, template: PromptTemplate): void;
    getAvailableTemplates(): string[];
    useTemplate(name: string, variables: Record<string, any>): string;
}

/**
 * Content processor interface
 */
export interface IContentProcessor {
    process(content: string, options: ProcessingOptions): Promise<ProcessedContent>;
    validate(content: string): ValidationResult;
    transform(content: string, transformation: Transformation): Promise<string>;
}

// ==================== UI INTERFACES ====================

/**
 * Core modal interface
 */
export interface IModal {
    open(): void;
    close(): void;
    isOpen(): boolean;
}

/**
 * Configurable modal interface
 */
export interface IConfigurableModal extends IModal {
    setOptions(options: ModalOptions): void;
    getOptions(): ModalOptions;
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
}

/**
 * Form modal interface
 */
export interface IFormModal extends IConfigurableModal {
    validate(): ValidationResult;
    getFormData(): Record<string, any>;
    setFormData(data: Record<string, any>): void;
    reset(): void;
}

// ==================== CONFIGURATION INTERFACES ====================

/**
 * Settings manager interface
 */
export interface ISettingsManager<T = any> {
    load(): Promise<T>;
    save(settings: T): Promise<void>;
    get(): T;
    update(updates: Partial<T>): void;
    validate(settings: Partial<T>): ValidationResult;
}

/**
 * Configuration provider interface
 */
export interface IConfigurationProvider {
    get<K>(key: string): K;
    set<K>(key: string, value: K): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    getAll(): Record<string, any>;
}

/**
 * Environment configuration interface
 */
export interface IEnvironmentConfig {
    get(key: string): string | undefined;
    getRequired(key: string): string;
    getAll(): Record<string, string>;
    isDevelopment(): boolean;
    isProduction(): boolean;
}

// ==================== EVENT HANDLING INTERFACES ====================

/**
 * Event emitter interface
 */
export interface IEventEmitter {
    on(event: string, handler: EventHandler): void;
    off(event: string, handler: EventHandler): void;
    emit(event: string, ...args: any[]): void;
    once(event: string, handler: EventHandler): void;
}

/**
 * Event handler interface
 */
export type EventHandler = (...args: any[]) => void;

/**
 * Event manager interface
 */
export interface IEventManager extends IEventEmitter {
    registerEvent(name: string, handler: EventHandler): void;
    unregisterEvent(name: string, handler: EventHandler): void;
    clear(): void;
    getListenerCount(event: string): number;
}

// ==================== UTILITY INTERFACES ====================

/**
 * Logger interface
 */
export interface ILogger {
    debug(message: string, context?: string, metadata?: any): void;
    info(message: string, context?: string, metadata?: any): void;
    warn(message: string, context?: string, metadata?: any): void;
    error(message: string, context?: string, metadata?: any): void;
}

/**
 * Retry service interface
 */
export interface IRetryService {
    execute<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
    executeWithRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
    clear(): void;
}

/**
 * Validation service interface
 */
export interface IValidationService {
    validate(data: any, rules: ValidationRules): ValidationResult;
    addValidator(name: string, validator: ValidatorFunction): void;
    removeValidator(name: string): void;
    getValidators(): string[];
}

// ==================== SUPPORTING TYPES ====================

export interface AIProviderCapabilities {
    supportsMultimodal: boolean;
    supportsConfiguration: boolean;
    supportsStreaming: boolean;
    maxTokens?: number;
    supportedFormats: string[];
}

export interface ProviderHealthStatus {
    isHealthy: boolean;
    responseTime?: number;
    lastCheck: Date;
    errors: string[];
}

export interface VideoMetadata {
    id: string;
    title: string;
    duration: number;
    thumbnail?: string;
    description?: string;
}

export interface VideoData extends VideoMetadata {
    transcript?: string;
    publishedAt?: string;
    channelName?: string;
    viewCount?: number;
}

export interface CacheStats {
    size: number;
    hitRate: number;
    missRate: number;
    evictions: number;
}

export interface PromptOptions {
    format?: OutputFormat;
    customPrompt?: string;
    includeMetadata?: boolean;
    maxLength?: number;
}

export interface PromptTemplate {
    name: string;
    template: string;
    variables: string[];
    description?: string;
}

export interface ProcessingOptions {
    format?: OutputFormat;
    maxLength?: number;
    includeMetadata?: boolean;
    customTransformations?: Transformation[];
}

export interface ProcessedContent {
    original: string;
    processed: string;
    metadata: {
        wordCount: number;
        processingTime: number;
        transformations: string[];
    };
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}

export interface ModalOptions {
    title?: string;
    width?: number;
    height?: number;
    closable?: boolean;
    resizable?: boolean;
}

export interface Transformation {
    type: string;
    options: Record<string, any>;
}

export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    backoffFactor?: number;
    maxDelay?: number;
    operationName?: string;
}

export interface ValidationRules {
    [key: string]: ValidatorFunction | ValidationRule[];
}

export type ValidatorFunction = (value: any) => ValidationResult;

export interface ValidationRule {
    validator: ValidatorFunction;
    message?: string;
}