/**
 * Core Abstractions - Dependency Inversion Principle
 * High-level modules depend on these abstractions, not concrete implementations
 */

import {
    IVideoDataService,
    IFileService,
    ICacheService,
    IPromptService,
    ILogger,
    ISettingsManager,
    IEventEmitter
} from '../interfaces/isp-interfaces';

// ==================== DATA ABSTRACTIONS ====================

/**
 * Abstract repository for data access
 */
export abstract class Repository<T, K> {
    abstract findById(id: K): Promise<T | null>;
    abstract findAll(): Promise<T[]>;
    abstract save(entity: T): Promise<T>;
    abstract update(id: K, entity: Partial<T>): Promise<T>;
    abstract delete(id: K): Promise<boolean>;
}

/**
 * Abstract video data provider
 */
export abstract class VideoDataProvider implements IVideoDataService {
    abstract extractVideoId(url: string): string | null;
    abstract getVideoMetadata(videoId: string): Promise<any>;
    abstract getVideoData(videoId: string): Promise<any>;
}

/**
 * Abstract file system operations
 */
export abstract class FileSystemProvider implements IFileService {
    abstract saveToFile(title: string, content: string, outputPath: string): Promise<string>;
    abstract openFile(filePath: string): Promise<void>;
    abstract fileExists(path: string): Promise<boolean>;
    abstract createDirectory(path: string): Promise<void>;
    abstract readFile(path: string): Promise<string>;
}

// ==================== SERVICE ABSTRACTIONS ====================

/**
 * Abstract service base class
 */
export abstract class Service {
    protected logger: ILogger;
    protected eventEmitter: IEventEmitter;

    constructor(logger: ILogger, eventEmitter: IEventEmitter) {
        this.logger = logger;
        this.eventEmitter = eventEmitter;
    }

    protected emit(event: string, data: any): void {
        this.eventEmitter.emit(event, data);
    }

    protected log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
        this.logger[level](message, this.constructor.name);
    }
}

/**
 * Abstract AI service
 */
export abstract class AIService extends Service {
    abstract process(prompt: string): Promise<string>;
    abstract validateConfiguration(): boolean;
    abstract getCapabilities(): any;
}

/**
 * Abstract cache service
 */
export abstract class CacheService extends Service implements ICacheService {
    abstract get<T>(key: string): T | null;
    abstract set<T>(key: string, value: T, ttl?: number): void;
    abstract delete(key: string): boolean;
    abstract clear(): void;
}

/**
 * Abstract prompt service
 */
export abstract class PromptService extends Service implements IPromptService {
    abstract createAnalysisPrompt(videoData: any, options: any): string;
    abstract processResponse(content: string, format: any): string;
}

// ==================== UI ABSTRACTIONS ====================

/**
 * Abstract modal controller
 */
export abstract class ModalController {
    protected logger: ILogger;
    protected eventEmitter: IEventEmitter;

    constructor(logger: ILogger, eventEmitter: IEventEmitter) {
        this.logger = logger;
        this.eventEmitter = eventEmitter;
    }

    abstract open(): void;
    abstract close(): void;
    abstract isOpen(): boolean;
    abstract validate(): any;

    protected emit(event: string, data: any): void {
        this.eventEmitter.emit(event, data);
    }
}

/**
 * Abstract component base class
 */
export abstract class Component {
    protected element: HTMLElement;
    protected logger: ILogger;
    protected eventEmitter: IEventEmitter;

    constructor(element: HTMLElement, logger: ILogger, eventEmitter: IEventEmitter) {
        this.element = element;
        this.logger = logger;
        this.eventEmitter = eventEmitter;
    }

    abstract render(): void;
    abstract destroy(): void;

    protected emit(event: string, data: any): void {
        this.eventEmitter.emit(event, data);
    }

    protected on(event: string, handler: Function): void {
        this.eventEmitter.on(event, handler);
    }
}

// ==================== PROCESSING ABSTRACTIONS ====================

/**
 * Abstract processor
 */
export abstract class Processor<Input, Output> {
    protected logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    abstract process(input: Input): Promise<Output>;
    abstract validate(input: Input): boolean;
}

/**
 * Abstract content processor
 */
export abstract class ContentProcessor extends Processor<string, string> {
    abstract preprocess(content: string): string;
    abstract postprocess(content: string): string;

    async process(content: string): Promise<string> {
        this.logger.debug(`Processing content (${content.length} characters)`, this.constructor.name);

        try {
            const preprocessed = this.preprocess(content);
            const processed = await this.processContent(preprocessed);
            const postprocessed = this.postprocess(processed);

            this.logger.debug('Content processing completed', this.constructor.name);
            return postprocessed;
        } catch (error) {
            this.logger.error('Content processing failed', this.constructor.name, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    protected abstract processContent(content: string): Promise<string>;
}

/**
 * Abstract pipeline
 */
export abstract class Pipeline<Input, Output> {
    protected steps: Array<Processor<any, any>> = [];
    protected logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    addStep<T>(processor: Processor<Input | T, T>): this {
        this.steps.push(processor as Processor<any, any>);
        return this;
    }

    async execute(input: Input): Promise<Output> {
        this.logger.debug(`Executing pipeline with ${this.steps.length} steps`, this.constructor.name);

        let current: any = input;
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            this.logger.debug(`Executing step ${i + 1}: ${step.constructor.name}`, this.constructor.name);

            try {
                current = await step.process(current);
            } catch (error) {
                this.logger.error(`Pipeline step ${i + 1} failed`, this.constructor.name, {
                    step: step.constructor.name,
                    error: error instanceof Error ? error.message : String(error)
                });
                throw new Error(`Pipeline step ${i + 1} (${step.constructor.name}) failed: ${error}`);
            }
        }

        this.logger.debug('Pipeline execution completed', this.constructor.name);
        return current as Output;
    }

    getStepCount(): number {
        return this.steps.length;
    }

    clear(): void {
        this.steps = [];
        this.logger.debug('Pipeline steps cleared', this.constructor.name);
    }
}

// ==================== CONFIGURATION ABSTRACTIONS ====================

/**
 * Abstract configuration provider
 */
export abstract class ConfigurationProvider {
    protected logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    abstract get<K>(key: string): K;
    abstract set<K>(key: string, value: K): void;
    abstract has(key: string): boolean;
    abstract getAll(): Record<string, any>;
    abstract load(): Promise<void>;
    abstract save(): Promise<void>;
}

/**
 * Abstract settings manager
 */
export abstract class SettingsManager<T> implements ISettingsManager<T> {
    protected logger: ILogger;
    protected settings: T;
    protected defaultSettings: T;

    constructor(defaultSettings: T, logger: ILogger) {
        this.defaultSettings = defaultSettings;
        this.settings = { ...defaultSettings };
        this.logger = logger;
    }

    abstract load(): Promise<void>;
    abstract save(settings: T): Promise<void>;

    get(): T {
        return { ...this.settings };
    }

    update(updates: Partial<T>): void {
        this.settings = { ...this.settings, ...updates };
        this.logger.debug('Settings updated', this.constructor.name, { updates });
    }

    validate(settings: Partial<T>): any {
        // Base validation - can be overridden by subclasses
        return { isValid: true, errors: [] };
    }

    reset(): void {
        this.settings = { ...this.defaultSettings };
        this.logger.info('Settings reset to defaults', this.constructor.name);
    }
}

// ==================== EVENT ABSTRACTIONS ====================

/**
 * Abstract event handler
 */
export abstract class EventHandler<T = any> {
    protected logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    abstract handle(event: T): void | Promise<void>;

    createWrapper(): (event: T) => Promise<void> {
        return async (event: T) => {
            try {
                await this.handle(event);
            } catch (error) {
                this.logger.error('Event handler failed', this.constructor.name, {
                    error: error instanceof Error ? error.message : String(error),
                    event
                });
            }
        };
    }
}

/**
 * Abstract event subscriber
 */
export abstract class EventSubscriber {
    protected logger: ILogger;
    protected eventEmitter: IEventEmitter;

    constructor(eventEmitter: IEventEmitter, logger: ILogger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }

    abstract subscribe(): void;
    abstract unsubscribe(): void;

    protected on<T>(event: string, handler: (data: T) => void): void {
        this.eventEmitter.on(event, handler);
    }

    protected off<T>(event: string, handler: (data: T) => void): void {
        this.eventEmitter.off(event, handler);
    }
}