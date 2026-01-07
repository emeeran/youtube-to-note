/**
 * Optimized HTTP client with connection pooling, retries, and performance monitoring
 */

import { logger } from '../services/logger';

interface HttpClientConfig {
    timeout: number;
    retries: number;
    retryDelay: number;
    maxConcurrent: number;
    keepAlive: boolean;
    enableMetrics?: boolean;
}

interface RequestMetrics {
    url: string;
    method: string;
    duration: number;
    success: boolean;
    statusCode?: number;
    error?: string;
    retryCount: number;
    timestamp: number;
}

interface ActiveRequest {
    controller: AbortController;
    startTime: number;
    url: string;
    method: string;
}

export class OptimizedHttpClient {
    private config: HttpClientConfig;
    private activeRequests: Set<ActiveRequest> = new Set();
    private requestMetrics: RequestMetrics[] = [];
    private pendingQueue: Array<() => void> = [];
    private maxConcurrent: number;

    constructor(config: Partial<HttpClientConfig> = {}) {
        this.config = {
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            maxConcurrent: 10,
            keepAlive: true,
            enableMetrics: true,
            ...config,
        };
        this.maxConcurrent = this.config.maxConcurrent;
    }

    /**
     * Execute HTTP request with optimizations
     */
    async request(url: string, options: RequestInit = {}): Promise<Response> {
        // Check concurrent request limit
        await this.waitForSlot();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const request: ActiveRequest = {
            controller,
            startTime: performance.now(),
            url,
            method: options.method ?? 'GET',
        };

        this.activeRequests.add(request);

        try {
            const response = await this.executeWithRetry(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Connection': this.config.keepAlive ? 'keep-alive' : 'close',
                    'Keep-Alive': `timeout=${this.config.timeout / 1000}`,
                    'User-Agent': 'YouTube-Clipper/1.3.5',
                    ...options.headers,
                },
            });

            // Remove timeout if request completed
            clearTimeout(timeoutId);

            // Record metrics
            if (this.config.enableMetrics) {
                this.recordRequestMetrics({
                    url,
                    method: options.method ?? 'GET',
                    duration: performance.now() - request.startTime,
                    success: response.ok,
                    statusCode: response.status,
                    retryCount: 0,
                });
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } finally {
            clearTimeout(timeoutId);
            this.activeRequests.delete(request);
            this.processQueue();
        }
    }

    /**
     * Execute request with retry logic
     */
    private async executeWithRetry(url: string, options: RequestInit): Promise<Response> {
        let lastError: Error;

        for (let attempt = 0; attempt <= this.config.retries; attempt++) {
            try {
                const response = await fetch(url, options);
                return response;
            } catch (error) {
                lastError = error as Error;

                if (attempt < this.config.retries) {
                    const delay = this.config.retryDelay * Math.pow(2, attempt);
                    await this.delay(delay);

                    // Record retry attempt
                    if (this.config.enableMetrics) {
                        logger.debug(`Retrying request (attempt ${attempt + 1}/${this.config.retries}): ${url}`, 'HttpClient');
                    }
                }
            }
        }

        throw lastError!;
    }

    /**
     * POST request helper
     */
    async post(url: string, data: any, options: RequestInit = {}): Promise<Response> {
        return this.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options,
        });
    }

    /**
     * GET request helper
     */
    async get(url: string, options: RequestInit = {}): Promise<Response> {
        return this.request(url, {
            method: 'GET',
            ...options,
        });
    }

    /**
     * PUT request helper
     */
    async put(url: string, data: any, options: RequestInit = {}): Promise<Response> {
        return this.request(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options,
        });
    }

    /**
     * DELETE request helper
     */
    async delete(url: string, options: RequestInit = {}): Promise<Response> {
        return this.request(url, {
            method: 'DELETE',
            ...options,
        });
    }

    /**
     * Wait for available request slot
     */
    private async waitForSlot(): Promise<void> {
        if (this.activeRequests.size < this.maxConcurrent) {
            return;
        }

        return new Promise(resolve => {
            this.pendingQueue.push(resolve);
        });
    }

    /**
     * Process pending requests when a slot becomes available
     */
    private processQueue(): void {
        if (this.pendingQueue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
            const resolve = this.pendingQueue.shift();
            resolve?.();
        }
    }

    /**
     * Delay utility
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Record request metrics
     */
    private recordRequestMetrics(metrics: Omit<RequestMetrics, 'retryCount' | 'timestamp'> & Partial<RequestMetrics>): void {
        const metric: RequestMetrics = {
            retryCount: 0,
            timestamp: Date.now(),
            ...metrics,
        };

        this.requestMetrics.push(metric);

        // Keep only last 1000 metrics to prevent memory leaks
        if (this.requestMetrics.length > 1000) {
            this.requestMetrics = this.requestMetrics.slice(-1000);
        }
    }

    /**
     * Get request metrics
     */
    getMetrics(): {
        totalRequests: number;
        activeRequests: number;
        maxConcurrent: number;
        utilizationRate: number;
        averageResponseTime: number;
        successRate: number;
        errorRate: number;
        timeouts: number;
        } {
        const totalRequests = this.requestMetrics.length;
        const activeRequests = this.activeRequests.size;
        const successfulRequests = this.requestMetrics.filter(m => m.success).length;
        const timeoutRequests = this.requestMetrics.filter(m =>
            m.error?.includes('abort') ?? m.error?.includes('timeout')
        ).length;

        const durations = this.requestMetrics
            .map(m => m.duration)
            .filter(d => d > 0);

        return {
            totalRequests,
            activeRequests,
            maxConcurrent: this.maxConcurrent,
            utilizationRate: activeRequests / this.maxConcurrent,
            averageResponseTime: durations.length > 0 ?
                durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
            errorRate: totalRequests > 0 ? (totalRequests - successfulRequests) / totalRequests : 0,
            timeouts: timeoutRequests,
        };
    }

    /**
     * Get detailed metrics for analysis
     */
    getDetailedMetrics(): {
        requests: RequestMetrics[];
        performanceBreakdown: {
            byStatus: Record<number, number>;
            byMethod: Record<string, { count: number; averageTime: number; successRate: number }>;
            byTimeRange: Record<string, number>;
        };
        } {
        // Analyze metrics by status code
        const byStatus: Record<number, number> = {};
        this.requestMetrics.forEach(metric => {
            if (metric.statusCode) {
                const status = Math.floor(metric.statusCode / 100) * 100;
                byStatus[status] = (byStatus[status] ?? 0) + 1;
            }
        });

        // Analyze metrics by method
        const byMethod: Record<string, { count: number; averageTime: number; successRate: number }> = {};
        const methodGroups = this.groupBy(this.requestMetrics, 'method');

        Object.entries(methodGroups).forEach(([method, requests]) => {
            const methodMetrics = this.analyzeMetrics(requests);
            byMethod[method] = methodMetrics;
        });

        return {
            requests: this.requestMetrics,
            performanceBreakdown: {
                byStatus,
                byMethod,
                byTimeRange: {
                    lastHour: this.getMetricsByTimeRange(Date.now() - 3600000),
                    lastDay: this.getMetricsByTimeRange(Date.now() - 86400000),
                    lastWeek: this.getMetricsByTimeRange(Date.now() - 604800000),
                },
            },
        };
    }

    /**
     * Group metrics by property
     */
    private groupBy(metrics: RequestMetrics[], property: keyof RequestMetrics): Record<string, RequestMetrics[]> {
        const groups: Record<string, RequestMetrics[]> = {};

        metrics.forEach(metric => {
            const key = String(metric[property]);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key]!.push(metric);
        });

        return groups;
    }

    /**
     * Analyze a set of metrics
     */
    private analyzeMetrics(metrics: RequestMetrics[]): { count: number; averageTime: number; successRate: number } {
        const count = metrics.length;
        const durations = metrics.map(m => m.duration);
        const successfulRequests = metrics.filter(m => m.success);

        return {
            count,
            averageTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            successRate: count > 0 ? successfulRequests.length / count : 0,
        };
    }

    /**
     * Get metrics by time range
     */
    private getMetricsByTimeRange(since: number): number {
        return this.requestMetrics.filter(metric => metric.timestamp >= since).length;
    }

    /**
     * Update max concurrent requests
     */
    setMaxConcurrent(max: number): void {
        this.maxConcurrent = Math.max(1, max);
    }

    /**
     * Abort all active requests
     */
    abortAllRequests(): void {
        this.activeRequests.forEach(request => {
            request.controller.abort();
        });
        this.activeRequests.clear();

        // Clear pending queue
        this.pendingQueue.length = 0;
    }

    /**
     * Cleanup method to be called when plugin unloads
     */
    cleanup(): void {
        this.abortAllRequests();
        this.requestMetrics = [];
    }
}