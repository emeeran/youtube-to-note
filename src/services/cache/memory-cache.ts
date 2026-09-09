import { CacheService } from '../../types';

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

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);

        if (!item) {
            return null;
        }

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    set<T>(key: string, data: T, ttl?: number): void {
        const expiresAt = Date.now() + (ttl ?? this.config.defaultTTL);

        // Evict oldest item if at capacity
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, { data, expiresAt });
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    destroy(): void {
        this.clear();
    }
}
