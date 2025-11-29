import { PerformanceMonitor } from './performance-monitor';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuit-breaker';
import { AdvancedCache } from './advanced-cache';

export interface NetworkRequestConfig {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    retryBackoffMultiplier?: number;
    circuitBreaker?: string;
    cacheKey?: string;
    cacheTtl?: number;
    priority?: number;
    headers?: Record<string, string>;
}

export interface NetworkResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    duration: number;
    fromCache: boolean;
    requestId: string;
}

export interface ParallelRequestOptions {
    concurrency?: number;
    failFast?: boolean;
    timeout?: number;
    retryFailed?: boolean;
}

export interface NetworkMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    totalDataTransferred: number;
    errorRate: number;
    circuitBreakerTrips: number;
}

/**
 * Advanced network optimization with parallel fetching, caching, and circuit breaking
 */
export class NetworkOptimizer {
    private static instance: NetworkOptimizer;
    private performanceMonitor?: PerformanceMonitor;
    private requestCache: AdvancedCache;
    private circuitBreakerRegistry: CircuitBreakerRegistry;
    private activeRequests = new Map<string, AbortController>();
    private requestQueue: Array<{
        id: string;
        execute: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: any) => void;
        priority: number;
    }> = [];
    private processingQueue = false;
    private metrics: NetworkMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        totalDataTransferred: 0,
        errorRate: 0,
        circuitBreakerTrips: 0
    };
    private responseTimes: number[] = [];

    private constructor(performanceMonitor?: PerformanceMonitor) {
        this.performanceMonitor = performanceMonitor;
        this.circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
        this.requestCache = new AdvancedCache({
            maxSize: 10 * 1024 * 1024, // 10MB
            maxItems: 500,
            defaultTtl: 5 * 60 * 1000, // 5 minutes
            enableCompression: true,
            enablePersistence: true
        }, performanceMonitor);

        // Set up periodic metrics cleanup
        this.startMetricsCleanup();
    }

    static getInstance(performanceMonitor?: PerformanceMonitor): NetworkOptimizer {
        if (!NetworkOptimizer.instance) {
            NetworkOptimizer.instance = new NetworkOptimizer(performanceMonitor);
        }
        return NetworkOptimizer.instance;
    }

    private startMetricsCleanup(): void {
        setInterval(() => {
            // Keep only last 1000 response times
            if (this.responseTimes.length > 1000) {
                this.responseTimes = this.responseTimes.slice(-1000);
            }

            // Update derived metrics
            this.updateDerivedMetrics();

            // Log metrics to performance monitor
            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('network_optimizer_metrics', this.metrics);
            }
        }, 60000); // Every minute
    }

    private updateDerivedMetrics(): void {
        this.metrics.averageResponseTime = this.responseTimes.length > 0 ?
            this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length : 0;

        this.metrics.errorRate = this.metrics.totalRequests > 0 ?
            (this.metrics.failedRequests / this.metrics.totalRequests) * 100 : 0;
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async executeWithCircuitBreaker<T>(
        circuitBreakerName: string,
        operation: () => Promise<T>,
        config: NetworkRequestConfig
    ): Promise<T> {
        let circuitBreaker = this.circuitBreakerRegistry.get(circuitBreakerName);

        if (!circuitBreaker) {
            circuitBreaker = this.circuitBreakerRegistry.create({
                name: circuitBreakerName,
                config: {
                    failureThreshold: 3,
                    recoveryTimeout: 30000,
                    halfOpenMaxCalls: 2
                },
                performanceMonitor: this.performanceMonitor
            });
        }

        const timeout = config.timeout || 30000;

        try {
            return await circuitBreaker.executeWithRetry(
                operation,
                config.retries || 2,
                config.retryDelay || 1000,
                config.retryBackoffMultiplier || 2
            );
        } catch (error) {
            this.metrics.circuitBreakerTrips++;
            throw error;
        }
    }

    /**
     * Make an optimized network request
     */
    async request<T = any>(
        url: string,
        options: RequestInit = {},
        config: NetworkRequestConfig = {}
    ): Promise<NetworkResponse<T>> {
        const requestId = this.generateRequestId();
        const startTime = performance.now();

        try {
            this.metrics.totalRequests++;

            // Check cache first
            if (config.cacheKey) {
                const cachedResponse = await this.requestCache.get(config.cacheKey);
                if (cachedResponse) {
                    this.metrics.cacheHits++;
                    const duration = performance.now() - startTime;
                    return {
                        ...cachedResponse,
                        fromCache: true,
                        requestId,
                        duration
                    };
                } else {
                    this.metrics.cacheMisses++;
                }
            }

            // Create abort controller
            const abortController = new AbortController();
            this.activeRequests.set(requestId, abortController);

            const mergedOptions: RequestInit = {
                ...options,
                signal: abortController.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Obsidian-YT-Clipper/1.3.5',
                    ...config.headers,
                    ...options.headers
                }
            };

            // Determine if we should use circuit breaker
            const circuitBreakerName = config.circuitBreaker || this.extractCircuitBreakerName(url);
            const shouldUseCircuitBreaker = this.shouldUseCircuitBreaker(url);

            let response: Response;
            let data: T;

            if (shouldUseCircuitBreaker) {
                // Use circuit breaker for external APIs
                const response = await this.executeWithCircuitBreaker(
                    circuitBreakerName,
                    () => fetch(url, mergedOptions),
                    config
                );

                data = await response.json();
            } else {
                // Direct fetch for internal URLs
                response = await fetch(url, {
                    ...mergedOptions,
                    signal: AbortSignal.timeout(config.timeout || 30000)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Parse response based on content type
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    data = await response.json();
                } else if (contentType?.includes('text/')) {
                    data = await response.text() as unknown as T;
                } else {
                    data = await response.blob() as unknown as T;
                }
            }

            const duration = performance.now() - startTime;
            this.responseTimes.push(duration);
            this.metrics.successfulRequests++;

            // Extract response headers
            const headers: Record<string, string> = {};
            response?.headers.forEach((value, key) => {
                headers[key] = value;
            });

            const result: NetworkResponse<T> = {
                data,
                status: response?.status || 200,
                statusText: response?.statusText || 'OK',
                headers,
                duration,
                fromCache: false,
                requestId
            };

            // Cache successful response
            if (config.cacheKey && config.cacheTtl) {
                await this.requestCache.set(config.cacheKey, result, config.cacheTtl, config.priority);
            }

            // Update data transfer metrics
            this.metrics.totalDataTransferred += new Blob([JSON.stringify(data)]).size;

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('network_request_success', duration, {
                    url,
                    status: result.status,
                    fromCache: false
                });
            }

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;
            this.metrics.failedRequests++;

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('network_request_error', duration, {
                    url,
                    error: (error as Error).message
                });
            }

            throw error;
        } finally {
            // Clean up abort controller
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Execute multiple requests in parallel with optimization
     */
    async parallelRequest<T = any>(
        requests: Array<{ url: string; options?: RequestInit; config?: NetworkRequestConfig }>,
        options: ParallelRequestOptions = {}
    ): Promise<NetworkResponse<T>[]> {
        const {
            concurrency = 5,
            failFast = false,
            timeout = 60000,
            retryFailed = true
        } = options;

        const results: NetworkResponse<T>[] = [];
        const errors: Error[] = [];

        // Process requests in batches
        for (let i = 0; i < requests.length; i += concurrency) {
            const batch = requests.slice(i, i + concurrency);

            const batchPromises = batch.map(async ({ url, options, config }) => {
                try {
                    return await this.request<T>(url, options, {
                        ...config,
                        timeout: Math.min(config?.timeout || timeout, timeout)
                    });
                } catch (error) {
                    if (failFast) {
                        throw error;
                    }

                    if (retryFailed && config?.retries !== 0) {
                        // Retry failed requests
                        return await this.request<T>(url, options, {
                            ...config,
                            retries: (config?.retries || 2) + 1,
                            timeout: Math.min(config?.timeout || timeout, timeout)
                        });
                    }

                    errors.push(error as Error);
                    throw error;
                }
            });

            try {
                const batchResults = await Promise.allSettled(batchPromises);

                batchResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                    } else {
                        if (!failFast) {
                            errors.push(result.reason);
                        }
                    }
                });

                // If failFast and we have errors, throw
                if (failFast && errors.length > 0) {
                    throw errors[0];
                }
            } catch (error) {
                if (failFast) {
                    throw error;
                }
                // Continue with other batches if not failFast
            }
        }

        if (errors.length > 0 && !failFast) {
            console.warn(`${errors.length} requests failed in parallel execution`, errors);
        }

        return results;
    }

    /**
     * Race multiple URLs and return the first successful response
     */
    async raceRequest<T = any>(
        urls: string[],
        options: RequestInit = {},
        config: NetworkRequestConfig = {}
    ): Promise<NetworkResponse<T>> {
        const requests = urls.map(url => ({
            url,
            options,
            config: { ...config, timeout: (config.timeout || 10000) / urls.length } // Divide timeout among racers
        }));

        const results = await this.parallelRequest<T>(requests, {
            concurrency: urls.length,
            failFast: true,
            timeout: config.timeout || 10000
        });

        return results[0]; // Return first successful result
    }

    /**
     * Request with priority queuing
     */
    async priorityRequest<T = any>(
        url: string,
        options: RequestInit = {},
        config: NetworkRequestConfig = {},
        priority: number = 1.0
    ): Promise<NetworkResponse<T>> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();

            this.requestQueue.push({
                id: requestId,
                execute: () => this.request<T>(url, options, config),
                resolve,
                reject,
                priority
            });

            // Sort queue by priority (higher priority first)
            this.requestQueue.sort((a, b) => b.priority - a.priority);

            if (!this.processingQueue) {
                this.processQueue();
            }
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.processingQueue = true;

        while (this.requestQueue.length > 0) {
            const item = this.requestQueue.shift();
            if (!item) break;

            try {
                const result = await item.execute();
                item.resolve(result);
            } catch (error) {
                item.reject(error);
            }
        }

        this.processingQueue = false;
    }

    /**
     * Cancel a specific request
     */
    cancelRequest(requestId: string): boolean {
        const controller = this.activeRequests.get(requestId);
        if (controller) {
            controller.abort();
            this.activeRequests.delete(requestId);
            return true;
        }
        return false;
    }

    /**
     * Cancel all active requests
     */
    cancelAllRequests(): void {
        this.activeRequests.forEach(controller => {
            controller.abort();
        });
        this.activeRequests.clear();
        this.requestQueue.length = 0;
        this.processingQueue = false;
    }

    /**
     * Get network metrics
     */
    getMetrics(): NetworkMetrics {
        this.updateDerivedMetrics();
        return { ...this.metrics };
    }

    /**
     * Extract circuit breaker name from URL
     */
    private extractCircuitBreakerName(url: string): string {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            if (hostname.includes('youtube.com') || hostname.includes('googleapis.com')) {
                return 'youtube-api';
            } else if (hostname.includes('gemini.google.com')) {
                return 'gemini-api';
            } else if (hostname.includes('groq.com')) {
                return 'groq-api';
            } else if (hostname.includes('rapidapi.com')) {
                return 'rapidapi';
            } else {
                return `external-${hostname.replace(/\./g, '-')}`;
            }
        } catch {
            return 'unknown-api';
        }
    }

    /**
     * Determine if URL should use circuit breaker
     */
    private shouldUseCircuitBreaker(url: string): boolean {
        try {
            const urlObj = new URL(url);

            // Use circuit breaker for external APIs
            return !urlObj.hostname.includes('localhost') &&
                   !urlObj.hostname.includes('127.0.0.1') &&
                   !url.startsWith('obsidian://');
        } catch {
            return false;
        }
    }

    /**
     * Warm up cache with commonly requested data
     */
    async warmupCache(requests: Array<{ url: string; options?: RequestInit; config?: NetworkRequestConfig }>): Promise<void> {
        const warmupPromises = requests.map(async ({ url, options, config }) => {
            if (config?.cacheKey && !this.requestCache.has(config.cacheKey)) {
                try {
                    await this.request(url, options, {
                        ...config,
                        priority: 0.5, // Lower priority for warmup
                        cacheTtl: (config?.cacheTtl || 300000) * 2 // Longer TTL for warmup
                    });
                } catch (error) {
                    console.warn(`Cache warmup failed for ${url}:`, error);
                }
            }
        });

        await Promise.all(warmupPromises);

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('network_cache_warmup', requests.length);
        }
    }

    /**
     * Optimize request based on network conditions
     */
    optimizeRequestConfig(config: NetworkRequestConfig): NetworkRequestConfig {
        const metrics = this.getMetrics();

        // Adaptive timeout based on average response time
        if (metrics.averageResponseTime > 5000) {
            config.timeout = (config.timeout || 30000) * 1.5; // Increase timeout
        }

        // Adaptive retry based on error rate
        if (metrics.errorRate > 10) {
            config.retries = Math.max((config.retries || 2) + 1, 5);
            config.retryDelay = (config.retryDelay || 1000) * 1.5;
        }

        // Force caching during high error rates
        if (metrics.errorRate > 20 && !config.cacheKey) {
            config.cacheKey = `auto_${Date.now()}_${Math.random()}`;
            config.cacheTtl = 60000; // 1 minute
        }

        return config;
    }

    /**
     * Export cache for backup
     */
    exportCache(): string {
        return this.requestCache.export();
    }

    /**
     * Import cache from backup
     */
    async importCache(data: string): Promise<void> {
        await this.requestCache.import(data);
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.cancelAllRequests();
        this.requestCache.destroy();
        this.circuitBreakerRegistry.cleanup();
    }
}

/**
 * Utility functions for common network patterns
 */
export class NetworkUtils {
    static async fetchWithRetry<T = any>(
        url: string,
        options: RequestInit = {},
        retries: number = 3,
        delay: number = 1000
    ): Promise<T> {
        const optimizer = NetworkOptimizer.getInstance();

        return optimizer.request<T>(url, options, {
            retries,
            retryDelay: delay,
            retryBackoffMultiplier: 2
        }).then(response => response.data);
    }

    static async fetchAny<T = any>(
        urls: string[],
        options: RequestInit = {}
    ): Promise<T> {
        const optimizer = NetworkOptimizer.getInstance();

        const response = await optimizer.raceRequest<T>(urls, options);
        return response.data;
    }

    static async fetchAll<T = any>(
        urls: string[],
        options: RequestInit = {},
        concurrency: number = 5
    ): Promise<T[]> {
        const optimizer = NetworkOptimizer.getInstance();

        const requests = urls.map(url => ({ url, options }));
        const responses = await optimizer.parallelRequest<T>(requests, { concurrency });

        return responses.map(response => response.data);
    }

    static createYouTubeTranscriptFetcher(): (videoId: string) => Promise<any> {
        const optimizer = NetworkOptimizer.getInstance();

        return async (videoId: string) => {
            const urls = [
                `https://video.google.com/timedtext?lang=en&v=${videoId}`,
                `https://youtubetranscript.com/server/api.php?v=${videoId}`,
                `https://rapidapi.com/youtube-api1-youtube-api-default/api/youtube-transcript/${videoId}`
            ];

            const response = await optimizer.raceRequest(urls, {}, {
                timeout: 15000,
                retries: 2,
                circuitBreaker: 'youtube-transcript'
            });

            return response.data;
        };
    }

    static createAIRequester(apiProvider: string): (prompt: string, model?: string) => Promise<any> {
        const optimizer = NetworkOptimizer.getInstance();

        return async (prompt: string, model?: string) => {
            const url = this.getProviderEndpoint(apiProvider);
            const body = this.formatProviderRequest(apiProvider, prompt, model);

            const response = await optimizer.request(url, {
                method: 'POST',
                body: JSON.stringify(body)
            }, {
                timeout: 60000,
                retries: 3,
                circuitBreaker: `${apiProvider}-api`,
                cacheKey: `ai_${apiProvider}_${this.hashPrompt(prompt)}`,
                cacheTtl: 300000 // 5 minutes
            });

            return response.data;
        };
    }

    private static getProviderEndpoint(provider: string): string {
        const endpoints = {
            'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
            'groq': 'https://api.groq.com/openai/v1/chat/completions',
            'openai': 'https://api.openai.com/v1/chat/completions'
        };

        return endpoints[provider as keyof typeof endpoints] || '';
    }

    private static formatProviderRequest(provider: string, prompt: string, model?: string): any {
        switch (provider) {
            case 'gemini':
                return {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                };

            case 'groq':
            case 'openai':
                return {
                    model: model || 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                };

            default:
                return { prompt };
        }
    }

    private static hashPrompt(prompt: string): string {
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
}