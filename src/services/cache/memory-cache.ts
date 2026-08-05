import { CacheService, CacheMetrics } from '../../types';

/**
 * Simple in-memory cache with TTL support
 */

interface CacheItem<T> {
    data: T;
    expiresAt: number;
}

interface CacheConfig {
    maxSize: number;
    defaultTTL: number;
}

const DEFAULT_CONFIG: CacheConfig = {
    maxSize: 100,
    defaultTTL: 300000, // 5 minutes
};

export class MemoryCacheService implements CacheService {
    private cache: Map<string, CacheItem<unknown>> = new Map();
    private config: CacheConfig;
    private metrics: CacheMetrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0,
    };

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);

        if (!item) {
            this.metrics.misses++;
            this.updateMetrics();
            return null;
        }

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.metrics.misses++;
            this.metrics.size = this.cache.size;
            this.updateMetrics();
            return null;
        }

        this.metrics.hits++;
        this.updateMetrics();
        return item.data as T;
    }

    set<T>(key: string, data: T, ttl?: number): void {
        const expiresAt = Date.now() + (ttl ?? this.config.defaultTTL);

        // Evict oldest item if at capacity
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
                this.metrics.evictions++;
            }
        }

        this.cache.set(key, { data, expiresAt });
        this.metrics.size = this.cache.size;
    }

    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.metrics.size = this.cache.size;
        }
        return deleted;
    }

    clear(): void {
        this.cache.clear();
        this.metrics.size = 0;
    }

    getMetrics(): CacheMetrics {
        return { ...this.metrics };
    }

    private updateMetrics(): void {
        const total = this.metrics.hits + this.metrics.misses;
        this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    }

    destroy(): void {
        this.clear();
    }
}
