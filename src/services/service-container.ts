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
import { performanceTracker } from './performance-tracker';
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

// Chrome-specific memory API type extension
declare global {
    interface Performance {
        memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
        };
    }
}

/**
 * Performance-optimized service container with memory management
 */
interface ServiceMetrics {
    creationTime: number;
    lastUsed: number;
    usageCount: number;
}

export class ServiceContainer implements IServiceContainer {
    private _aiService?: IAIService;
    private _videoService?: VideoDataService;
    private _fileService?: FileService;
    private _cacheService?: CacheService;
    private _promptService?: PromptService;

    // Performance optimization: Service metrics tracking
    private serviceMetrics: Map<string, ServiceMetrics> = new Map();
    private cleanupInterval?: NodeJS.Timeout;
    private readonly SERVICE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(
        private settings: YouTubePluginSettings,
        private app: App
    ) {
        this.setupPeriodicCleanup();
        this.trackMemoryUsage();
    }

    get aiService(): IAIService {
        return this.getService('aiService', () => {
            const startTime = performance.now();
            const providers: AIProvider[] = [];

            // Add Gemini provider if API key is available
            if (this.settings.geminiApiKey) {
                providers.push(new GeminiProvider(this.settings.geminiApiKey));
            }

            // Add Groq provider if API key is available
            if (this.settings.groqApiKey) {
                providers.push(new GroqProvider(this.settings.groqApiKey));
            }

            // Add Hugging Face provider if API key is available
            if (this.settings.huggingFaceApiKey) {
                providers.push(new HuggingFaceProvider(this.settings.huggingFaceApiKey));
            }

            // Add OpenRouter provider if API key is available
            if (this.settings.openRouterApiKey) {
                providers.push(new OpenRouterProvider(this.settings.openRouterApiKey));
            }

            // Add Ollama provider (local instances)
            providers.push(new OllamaProvider(
                this.settings.ollamaApiKey || '',
                undefined,
                undefined,
                this.settings.ollamaEndpoint || 'http://localhost:11434'
            ));

            // Add Ollama Cloud provider (requires API key)
            if (this.settings.ollamaApiKey) {
                providers.push(new OllamaCloudProvider(
                    this.settings.ollamaApiKey,
                    'deepseek-r1:32b' // Default model for Ollama Cloud
                ));
            }

            const service = new AIService(providers, this.settings);
            this.recordServiceMetrics('aiService', performance.now() - startTime);
            return service;
        });
    }

    get videoService(): VideoDataService {
        return this.getService('videoService', () => {
            const startTime = performance.now();
            const service = new YouTubeVideoService(this.cacheService);
            this.recordServiceMetrics('videoService', performance.now() - startTime);
            return service;
        });
    }

    get fileService(): FileService {
        return this.getService('fileService', () => {
            const startTime = performance.now();
            const service = new ObsidianFileService(this.app);
            this.recordServiceMetrics('fileService', performance.now() - startTime);
            return service;
        });
    }

    get cacheService(): CacheService {
        return this.getService('cacheService', () => {
            const startTime = performance.now();
            const service = new MemoryCacheService();
            this.recordServiceMetrics('cacheService', performance.now() - startTime);
            return service;
        });
    }

    get promptService(): PromptService {
        return this.getService('promptService', () => {
            const startTime = performance.now();
            const service = new AIPromptService();
            this.recordServiceMetrics('promptService', performance.now() - startTime);
            return service;
        });
    }

    /**
     * Generic service getter with performance tracking
     */
    private getService<T>(
        serviceName: string,
        factory: () => T
    ): T {
        const serviceProperty = `_${serviceName}` as keyof this;
        const service = (this as any)[serviceProperty] as T;

        if (service) {
            // Update usage metrics
            const metrics = this.serviceMetrics.get(serviceName);
            if (metrics) {
                metrics.lastUsed = Date.now();
                metrics.usageCount++;
            }
            return service;
        }

        // Create new service instance
        const startTime = performance.now();
        const newService = factory();
        (this as any)[serviceProperty] = newService;

        // Track metrics asynchronously (non-blocking)
        performanceTracker.trackOperation(
            'ServiceContainer',
            `getService-${serviceName}`,
            performance.now() - startTime,
            true,
            { serviceName }
        );

        return newService;
    }

    /**
     * Record service creation metrics
     */
    private recordServiceMetrics(serviceName: string, creationTime: number): void {
        this.serviceMetrics.set(serviceName, {
            creationTime,
            lastUsed: Date.now(),
            usageCount: 0,
        });
    }

    /**
     * Setup periodic cleanup of unused services
     */
    private setupPeriodicCleanup(): void {
        // Check every 2 minutes for services that haven't been used recently
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 2 * 60 * 1000);
    }

    /**
     * Perform cleanup of unused services
     */
    private performCleanup(): void {
        const now = Date.now();
        const servicesToCleanup: string[] = [];

        this.serviceMetrics.forEach((metrics, serviceName) => {
            // Clean up services that haven't been used for 5 minutes
            if (now - metrics.lastUsed > this.SERVICE_TTL) {
                servicesToCleanup.push(serviceName);
            }
        });

        servicesToCleanup.forEach(serviceName => {
            this.clearService(serviceName);
            this.serviceMetrics.delete(serviceName);
        });

        // Also check memory usage and clean up if necessary
        if (this.isMemoryUsageHigh()) {
            this.performAggressiveCleanup();
        }
    }

    /**
     * Clear a specific service
     */
    private clearService(serviceName: string): void {
        const serviceProperty = `_${serviceName}` as keyof this;
        const service = (this as any)[serviceProperty];

        // Call cleanup method if it exists
        if (service && typeof (service).cleanup === 'function') {
            try {
                (service).cleanup();
            } catch (error) {
                console.warn(`Error during cleanup of ${serviceName}:`, error);
            }
        }

        (this as any)[serviceProperty] = undefined;
    }

    /**
     * Check if memory usage is high
     */
    private isMemoryUsageHigh(): boolean {
        if (performance.memory) {
            const usedMemory = performance.memory.usedJSHeapSize;
            const totalMemory = performance.memory.jsHeapSizeLimit;
            const usageRatio = usedMemory / totalMemory;
            return usageRatio > 0.8; // 80% threshold
        }
        return false;
    }

    /**
     * Perform aggressive cleanup when memory is high
     */
    private performAggressiveCleanup(): void {
        console.warn('High memory usage detected, performing aggressive cleanup');

        // Clear all services except the most recently used one
        const sortedServices = Array.from(this.serviceMetrics.entries())
            .sort((a, b) => b[1].lastUsed - a[1].lastUsed);

        // Keep only the most recently used service
        const [keepService] = sortedServices;

        this.serviceMetrics.forEach((_, serviceName) => {
            if (serviceName !== keepService?.[0]) {
                this.clearService(serviceName);
            }
        });

        // Clear all metrics except for the kept service
        this.serviceMetrics.clear();
        if (keepService) {
            this.serviceMetrics.set(keepService[0], keepService[1]);
        }

        // Suggest garbage collection
        if (window.gc) {
            window.gc();
        }
    }

    /**
     * Track memory usage for monitoring
     */
    private trackMemoryUsage(): void {
        // Log memory usage every minute for debugging
        setInterval(() => {
            if (performance.memory) {
                const memory = performance.memory;
                const usageMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
                const totalMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);

                // Only log if memory usage is significant
                if (usageMB > 50) {
                    console.debug(`Memory usage: ${usageMB}MB / ${totalMB}MB`);
                }
            }
        }, 60 * 1000);
    }

    /**
     * Update settings and refresh services that depend on them
     */
    async updateSettings(newSettings: YouTubePluginSettings): Promise<void> {
        this.settings = newSettings;

        // Clear AI service to pick up new API keys
        this.clearService('aiService');
        this.serviceMetrics.delete('aiService');

        // Also clear services that might depend on settings
        this.clearService('videoService');
        this.serviceMetrics.delete('videoService');
    }

    /**
     * Clear all cached services
     */
    clearServices(): void {
        // Clear all services
        Object.keys(this.serviceMetrics).forEach(serviceName => {
            this.clearService(serviceName);
        });

        this._aiService = undefined;
        this._videoService = undefined;
        this._fileService = undefined;
        this._cacheService = undefined;
        this._promptService = undefined;

        // Clear metrics
        this.serviceMetrics.clear();
    }

    /**
     * Get performance metrics for monitoring
     */
    getServiceMetrics(): Record<string, ServiceMetrics> {
        const result: Record<string, ServiceMetrics> = {};
        this.serviceMetrics.forEach((metrics, name) => {
            result[name] = { ...metrics };
        });
        return result;
    }

    /**
     * Get comprehensive performance report
     */
    getPerformanceReport(): any {
        const serviceMetrics = this.getServiceMetrics();
        const performanceReport = performanceTracker.generateReport();

        // Add service-specific metrics
        const aiService = this._aiService;
        if (aiService && typeof aiService.getPerformanceMetrics === 'function') {
            performanceReport.services.aiService = {
                ...performanceReport.services.aiService,
                ...aiService.getPerformanceMetrics(),
            };
        }

        const videoService = this._videoService;
        if (videoService && typeof videoService.getPerformanceMetrics === 'function') {
            performanceReport.services.videoService = {
                ...performanceReport.services.videoService,
                ...videoService.getPerformanceMetrics(),
            };
        }

        const cacheService = this._cacheService;
        if (cacheService && typeof cacheService.getMetrics === 'function') {
            performanceReport.systemMetrics.cacheMetrics = cacheService.getMetrics();
        }

        return {
            ...performanceReport,
            containerMetrics: {
                uptime: performanceTracker.getUptime(),
                services: Object.keys(serviceMetrics),
                memoryUsage: this.isMemoryUsageHigh(),
            },
        };
    }

    /**
     * Cleanup method to be called when plugin is unloaded
     */
    cleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

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

        this.clearServices();
        performanceTracker.clearMetrics();
    }
}