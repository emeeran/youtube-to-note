import { CacheService, CacheMetrics } from '../../types';

/**
 * Performance-optimized in-memory cache service with LRU eviction
 */

interface CacheItem<T> {
    data: T;
    timestamp: number;
    ttl?: number;
    hits: number;
    size: number; // Estimated size in bytes
}

interface CacheConfig {
    maxSize: number;
    defaultTTL: number;
    cleanupInterval: number;
    enableMetrics: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
    maxSize: 200,
    defaultTTL: 300000, // 5 minutes
    cleanupInterval: 60000, // 1 minute
    enableMetrics: true,
};

export class MemoryCacheService implements CacheService {
    private cache: Map<string, CacheItem<any>> = new Map();
    private accessOrder: string[] = [];
    private config: CacheConfig;
    private metrics: CacheMetrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0,
    };
    private lastCleanup: number = 0;

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get item from cache (optimized with LRU and lazy cleanup)
     */
    get<T>(key: string): T | null {
        // Lazy cleanup trigger to avoid frequent iterations
        if (this.cache.size > this.config.maxSize * 0.8) {
            this.cleanup();
        }

        const item = this.cache.get(key);
        if (!item) {
            if (this.config.enableMetrics) {
                this.metrics.misses++;
                this.updateHitRate();
            }
            return null;
        }

        // Check if item has expired
        const ttl = item.ttl ?? this.config.defaultTTL;
        if (Date.now() - item.timestamp > ttl) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            return null;
        }

        // Update LRU access order and metrics
        this.updateAccessOrder(key);
        item.hits++;

        if (this.config.enableMetrics) {
            this.metrics.hits++;
            this.updateHitRate();
        }

        return item.data as T;
    }

    /**
     * Set item in cache with LRU eviction
     */
    set<T>(key: string, data: T, ttl?: number): void {
        // Check if we need to evict items
        if (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }

        const item: CacheItem<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttl || this.config.defaultTTL,
            hits: 0,
            size: this.estimateSize(data),
        };

        this.cache.set(key, item);
        this.updateAccessOrder(key);
        this.metrics.size = this.cache.size;
    }

    /**
     * Clear all cache items
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0,
            hitRate: 0,
        };
    }

    /**
     * Delete specific cache item
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.removeFromAccessOrder(key);
            this.metrics.size = this.cache.size;
        }
        return deleted;
    }

    /**
     * Check if key exists in cache
     */
    has(key: string): boolean {
        const item = this.cache.get(key);
        if (!item) {
            return false;
        }

        // Check if expired
        const ttl = item.ttl ?? this.config.defaultTTL;
        if (Date.now() - item.timestamp > ttl) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            this.metrics.size = this.cache.size;
            return false;
        }

        return true;
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.cache.size;
    }

    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics {
        return { ...this.metrics };
    }

    /**
     * Update access order for LRU
     */
    private updateAccessOrder(key: string): void {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    /**
     * Remove key from access order
     */
    private removeFromAccessOrder(key: string): void {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    /**
     * Evict least recently used item
     */
    private evictLRU(): void {
        if (this.accessOrder.length === 0) return;

        const lruKey = this.accessOrder.shift();
        if (lruKey) {
            this.cache.delete(lruKey);
        }
        this.metrics.evictions++;
        this.metrics.size = this.cache.size;
    }

    /**
     * Estimate size of cached data (rough estimation)
     */
    private estimateSize(data: any): number {
        if (data === null || data === undefined) return 8;
        if (typeof data === 'string') return data.length * 2;
        if (typeof data === 'number') return 8;
        if (typeof data === 'boolean') return 4;
        if (typeof data === 'object') {
            try {
                return JSON.stringify(data).length * 2;
            } catch {
                return 1024; // Default 1KB for objects
            }
        }
        return 64; // Default estimation
    }

    /**
     * Update hit rate metric
     */
    private updateHitRate(): void {
        const total = this.metrics.hits + this.metrics.misses;
        this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    }

    /**
     * Clean up expired items (optimized with batched operations)
     */
    cleanup(): void {
        const now = Date.now();

        // Throttle cleanup to avoid frequent iterations
        if (now - this.lastCleanup < this.config.cleanupInterval) return;
        this.lastCleanup = now;

        // Batch delete operations (more efficient than individual deletes)
        const expiredKeys: string[] = [];

        for (const [key, item] of this.cache.entries()) {
            const ttl = item.ttl ?? this.config.defaultTTL;
            if (now - item.timestamp > ttl) {
                expiredKeys.push(key);
            }
        }

        // Single batch operation
        expiredKeys.forEach(key => {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
        });

        this.metrics.size = this.cache.size;
    }

    /**
     * Get hot items (most frequently accessed)
     */
    getHotItems(limit: number = 10): Array<{ key: string; hits: number }> {
        const items = Array.from(this.cache.entries())
            .map(([key, item]) => ({ key, hits: item.hits }))
            .sort((a, b) => b.hits - a.hits);

        return items.slice(0, limit);
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        totalHits: number;
        totalMisses: number;
        evictions: number;
        memoryUsage: number;
        } {
        const memoryUsage = Array.from(this.cache.values())
            .reduce((total, item) => total + item.size, 0);

        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            hitRate: this.metrics.hitRate,
            totalHits: this.metrics.hits,
            totalMisses: this.metrics.misses,
            evictions: this.metrics.evictions,
            memoryUsage,
        };
    }

    /**
     * Cleanup method to be called when plugin unloads
     */
    destroy(): void {
        this.clear();
        this.accessOrder = [];
    }
}
