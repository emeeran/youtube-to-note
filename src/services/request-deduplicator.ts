/**
 * Request Deduplicator Service
 *
 * Prevents duplicate concurrent requests for the same resource.
 * When multiple calls are made for the same key while a request is in flight,
 * they all receive the same result instead of triggering multiple requests.
 *
 * Features:
 * - Deduplicates concurrent requests
 * - Automatic cleanup of completed requests
 * - Configurable TTL for cached results
 * - Metrics tracking
 */

export interface DeduplicationMetrics {
    totalRequests: number;
    deduplicatedRequests: number;
    uniqueRequests: number;
    deduplicationRate: number;
    pendingRequests: number;
}

interface PendingRequest<T> {
    promise: Promise<T>;
    timestamp: number;
    key: string;
}

interface DeduplicatorConfig {
    /** Time to cache successful results (ms) */
    resultCacheTTL?: number;
    /** Maximum number of pending requests to track */
    maxPendingRequests?: number;
    /** Enable result caching */
    cacheResults?: boolean;
}

const DEFAULT_CONFIG: Required<DeducatorConfig> = {
    resultCacheTTL: 5000, // 5 seconds
    maxPendingRequests: 100,
    cacheResults: true,
};

type RequiredDeduplicatorConfig = {
    resultCacheTTL: number;
    maxPendingRequests: number;
    cacheResults: boolean;
};

type DeducatorConfig = DeduplicatorConfig;

export class RequestDeduplicator {
    private pendingRequests: Map<string, PendingRequest<unknown>> = new Map();
    private resultCache: Map<string, { result: unknown; timestamp: number }> = new Map();
    private config: RequiredDeduplicatorConfig;
    private metrics: DeduplicationMetrics = {
        totalRequests: 0,
        deduplicatedRequests: 0,
        uniqueRequests: 0,
        deduplicationRate: 0,
        pendingRequests: 0,
    };

    constructor(config: DeduplicatorConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Execute a request with deduplication
     * If a request with the same key is already in flight, returns the existing promise
     */
    async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
        this.metrics.totalRequests++;

        // Check result cache first
        if (this.config.cacheResults) {
            const cached = this.getCachedResult<T>(key);
            if (cached !== null) {
                this.metrics.deduplicatedRequests++;
                this.updateMetrics();
                return cached;
            }
        }

        // Check for pending request
        const pending = this.pendingRequests.get(key) as PendingRequest<T> | undefined;
        if (pending) {
            this.metrics.deduplicatedRequests++;
            this.updateMetrics();
            return pending.promise;
        }

        // Create new request
        this.metrics.uniqueRequests++;
        const promise = this.executeRequest(key, fn);
        this.pendingRequests.set(key, {
            promise,
            timestamp: Date.now(),
            key,
        });
        this.metrics.pendingRequests = this.pendingRequests.size;
        this.updateMetrics();

        return promise;
    }

    /**
     * Execute request and handle cleanup
     */
    private async executeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
        try {
            const result = await fn();

            // Cache successful result
            if (this.config.cacheResults) {
                this.resultCache.set(key, {
                    result,
                    timestamp: Date.now(),
                });
            }

            return result;
        } finally {
            // Clean up pending request
            this.pendingRequests.delete(key);
            this.metrics.pendingRequests = this.pendingRequests.size;
        }
    }

    /**
     * Get cached result if still valid
     */
    private getCachedResult<T>(key: string): T | null {
        const cached = this.resultCache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > this.config.resultCacheTTL) {
            this.resultCache.delete(key);
            return null;
        }

        return cached.result as T;
    }

    /**
     * Invalidate cached result for a key
     */
    invalidate(key: string): boolean {
        const hadResult = this.resultCache.delete(key);
        const hadPending = this.pendingRequests.delete(key);
        this.metrics.pendingRequests = this.pendingRequests.size;
        return hadResult || hadPending;
    }

    /**
     * Invalidate all cached results matching a pattern
     */
    invalidatePattern(pattern: RegExp): number {
        let count = 0;
        for (const key of this.resultCache.keys()) {
            if (pattern.test(key)) {
                this.resultCache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear all cached results
     */
    clearCache(): void {
        this.resultCache.clear();
    }

    /**
     * Clear all pending requests
     */
    clearPending(): void {
        this.pendingRequests.clear();
        this.metrics.pendingRequests = 0;
    }

    /**
     * Clear everything
     */
    clear(): void {
        this.clearCache();
        this.clearPending();
    }

    /**
     * Get current metrics
     */
    getMetrics(): DeduplicationMetrics {
        return { ...this.metrics };
    }

    /**
     * Check if a request is pending
     */
    isPending(key: string): boolean {
        return this.pendingRequests.has(key);
    }

    /**
     * Get all pending request keys
     */
    getPendingKeys(): string[] {
        return Array.from(this.pendingRequests.keys());
    }

    /**
     * Cleanup expired cache entries
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, cached] of this.resultCache) {
            if (now - cached.timestamp > this.config.resultCacheTTL) {
                this.resultCache.delete(key);
            }
        }
    }

    private updateMetrics(): void {
        const total = this.metrics.totalRequests;
        this.metrics.deduplicationRate = total > 0 ? this.metrics.deduplicatedRequests / total : 0;
    }
}

// Create singleton instance for common use
export const requestDeduplicator = new RequestDeduplicator();
