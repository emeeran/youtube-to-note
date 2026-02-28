import { CacheService, CacheMetrics } from '../../types';

/**
 * LRU (Least Recently Used) in-memory cache with TTL support
 *
 * Features:
 * - LRU eviction when capacity is reached
 * - TTL (Time-To-Live) expiration
 * - Access order tracking
 * - Metrics for monitoring
 */

interface CacheItem<T> {
    data: T;
    expiresAt: number;
    lastAccessed: number;
    accessCount: number;
}

interface CacheConfig {
    maxSize: number;
    defaultTTL: number;
    cleanupInterval?: number; // Interval for automatic expired item cleanup
}

const DEFAULT_CONFIG: CacheConfig = {
    maxSize: 100,
    defaultTTL: 300000, // 5 minutes
    cleanupInterval: 60000, // 1 minute
};

export class MemoryCacheService implements CacheService {
    private cache: Map<string, CacheItem<unknown>> = new Map();
    private accessOrder: Map<string, number> = new Map(); // Track access order for LRU
    private config: CacheConfig;
    private metrics: CacheMetrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0,
    };
    private cleanupTimer?: ReturnType<typeof setInterval>;
    private accessCounter = 0;

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Start cleanup timer
        if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
            this.cleanupTimer = setInterval(() => {
                this.cleanup();
            }, this.config.cleanupInterval);
        }
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);

        if (!item) {
            this.metrics.misses++;
            this.updateMetrics();
            return null;
        }

        // Check expiration
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
            this.metrics.misses++;
            this.metrics.size = this.cache.size;
            this.updateMetrics();
            return null;
        }

        // Update access order for LRU
        item.lastAccessed = Date.now();
        item.accessCount++;
        this.accessOrder.set(key, ++this.accessCounter);

        this.metrics.hits++;
        this.updateMetrics();
        return item.data as T;
    }

    set<T>(key: string, data: T, ttl?: number): void {
        const expiresAt = Date.now() + (ttl ?? this.config.defaultTTL);

        // If key already exists, just update it
        if (this.cache.has(key)) {
            this.cache.set(key, {
                data,
                expiresAt,
                lastAccessed: Date.now(),
                accessCount: 1,
            });
            this.accessOrder.set(key, ++this.accessCounter);
            this.metrics.size = this.cache.size;
            return;
        }

        // Evict LRU item if at capacity
        if (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            data,
            expiresAt,
            lastAccessed: Date.now(),
            accessCount: 1,
        });
        this.accessOrder.set(key, ++this.accessCounter);
        this.metrics.size = this.cache.size;
    }

    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        this.accessOrder.delete(key);
        if (deleted) {
            this.metrics.size = this.cache.size;
        }
        return deleted;
    }

    clear(): void {
        this.cache.clear();
        this.accessOrder.clear();
        this.accessCounter = 0;
        this.metrics.size = 0;
    }

    getMetrics(): CacheMetrics {
        return { ...this.metrics };
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        metrics: CacheMetrics;
        itemCount: number;
        oldestAccess: number;
        newestAccess: number;
        } {
        let oldestAccess = Infinity;
        let newestAccess = 0;

        for (const item of this.cache.values()) {
            if (item.lastAccessed < oldestAccess) oldestAccess = item.lastAccessed;
            if (item.lastAccessed > newestAccess) newestAccess = item.lastAccessed;
        }

        return {
            metrics: this.getMetrics(),
            itemCount: this.cache.size,
            oldestAccess: oldestAccess === Infinity ? 0 : oldestAccess,
            newestAccess,
        };
    }

    /**
     * Evict least recently used item
     */
    private evictLRU(): void {
        let lruKey: string | null = null;
        let lruOrder = Infinity;

        // Find the least recently accessed item
        for (const [key, order] of this.accessOrder) {
            if (order < lruOrder) {
                lruOrder = order;
                lruKey = key;
            }
        }

        if (lruKey) {
            this.cache.delete(lruKey);
            this.accessOrder.delete(lruKey);
            this.metrics.evictions++;
        }
    }

    /**
     * Remove expired items
     */
    cleanup(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, item] of this.cache) {
            if (now > item.expiresAt) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
        }

        if (expiredKeys.length > 0) {
            this.metrics.size = this.cache.size;
        }
    }

    private updateMetrics(): void {
        const total = this.metrics.hits + this.metrics.misses;
        this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
    }
}
