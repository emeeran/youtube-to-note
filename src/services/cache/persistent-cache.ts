import { CacheService, CacheMetrics } from '../../types';

/**
 * Persistent cache service using localStorage for data that should
 * survive plugin reloads (transcripts, video metadata, etc.)
 */

interface PersistentCacheItem<T> {
    data: T;
    timestamp: number;
    ttl: number;
    version: number;
}

interface PersistentCacheConfig {
    namespace: string;
    maxItems: number;
    defaultTTL: number;
    version: number;
}

const DEFAULT_CONFIG: PersistentCacheConfig = {
    namespace: 'ytc',
    maxItems: 100,
    defaultTTL: 86400000, // 24 hours
    version: 1,
};

export class PersistentCacheService implements CacheService {
    private config: PersistentCacheConfig;
    private indexKey: string;
    private metrics: CacheMetrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0,
    };

    constructor(config: Partial<PersistentCacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.indexKey = `${this.config.namespace}-index`;
        this.initializeIndex();
        this.cleanupExpired();
    }

    /**
     * Initialize or load the cache index
     */
    private initializeIndex(): void {
        try {
            const index = localStorage.getItem(this.indexKey);
            if (!index) {
                localStorage.setItem(this.indexKey, JSON.stringify([]));
            }
            this.metrics.size = this.getIndex().length;
        } catch {
            // localStorage not available
        }
    }

    /**
     * Get the list of cached keys
     */
    private getIndex(): string[] {
        try {
            const index = localStorage.getItem(this.indexKey);
            return index ? JSON.parse(index) : [];
        } catch {
            return [];
        }
    }

    /**
     * Update the cache index
     */
    private updateIndex(keys: string[]): void {
        try {
            localStorage.setItem(this.indexKey, JSON.stringify(keys));
            this.metrics.size = keys.length;
        } catch {
            // localStorage not available or quota exceeded
        }
    }

    /**
     * Generate storage key with namespace
     */
    private getStorageKey(key: string): string {
        return `${this.config.namespace}-${key}`;
    }

    /**
     * Get item from cache
     */
    get<T>(key: string): T | null {
        try {
            const storageKey = this.getStorageKey(key);
            const stored = localStorage.getItem(storageKey);

            if (!stored) {
                this.metrics.misses++;
                this.updateHitRate();
                return null;
            }

            const item: PersistentCacheItem<T> = JSON.parse(stored);

            // Check version compatibility
            if (item.version !== this.config.version) {
                this.delete(key);
                this.metrics.misses++;
                this.updateHitRate();
                return null;
            }

            // Check expiration
            if (Date.now() - item.timestamp > item.ttl) {
                this.delete(key);
                this.metrics.misses++;
                this.updateHitRate();
                return null;
            }

            this.metrics.hits++;
            this.updateHitRate();
            return item.data;
        } catch {
            this.metrics.misses++;
            this.updateHitRate();
            return null;
        }
    }

    /**
     * Set item in cache
     */
    set<T>(key: string, data: T, ttl?: number): void {
        try {
            const index = this.getIndex();

            // Evict oldest items if at capacity
            while (index.length >= this.config.maxItems) {
                const oldestKey = index.shift();
                if (oldestKey) {
                    localStorage.removeItem(this.getStorageKey(oldestKey));
                    this.metrics.evictions++;
                }
            }

            const storageKey = this.getStorageKey(key);
            const item: PersistentCacheItem<T> = {
                data,
                timestamp: Date.now(),
                ttl: ttl ?? this.config.defaultTTL,
                version: this.config.version,
            };

            localStorage.setItem(storageKey, JSON.stringify(item));

            // Update index
            if (!index.includes(key)) {
                index.push(key);
            }
            this.updateIndex(index);
        } catch (error) {
            // Handle quota exceeded by clearing old items
            if ((error as Error).name === 'QuotaExceededError') {
                this.evictOldest(10);
                // Retry once
                try {
                    this.set(key, data, ttl);
                } catch {
                    // Give up if still failing
                }
            }
        }
    }

    /**
     * Delete item from cache
     */
    delete(key: string): boolean {
        try {
            const storageKey = this.getStorageKey(key);
            const exists = localStorage.getItem(storageKey) !== null;

            if (exists) {
                localStorage.removeItem(storageKey);
                const index = this.getIndex().filter(k => k !== key);
                this.updateIndex(index);
            }

            return exists;
        } catch {
            return false;
        }
    }

    /**
     * Check if key exists and is valid
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Clear all cached items
     */
    clear(): void {
        try {
            const index = this.getIndex();
            index.forEach(key => {
                localStorage.removeItem(this.getStorageKey(key));
            });
            this.updateIndex([]);
            this.metrics = {
                hits: 0,
                misses: 0,
                evictions: 0,
                size: 0,
                hitRate: 0,
            };
        } catch {
            // Ignore errors
        }
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.getIndex().length;
    }

    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics {
        return { ...this.metrics };
    }

    /**
     * Evict oldest items
     */
    private evictOldest(count: number): void {
        const index = this.getIndex();
        const toRemove = index.slice(0, count);

        toRemove.forEach(key => {
            localStorage.removeItem(this.getStorageKey(key));
            this.metrics.evictions++;
        });

        this.updateIndex(index.slice(count));
    }

    /**
     * Clean up expired items
     */
    private cleanupExpired(): void {
        try {
            const index = this.getIndex();
            const now = Date.now();
            const validKeys: string[] = [];

            index.forEach(key => {
                const storageKey = this.getStorageKey(key);
                const stored = localStorage.getItem(storageKey);

                if (stored) {
                    try {
                        const item = JSON.parse(stored);
                        if (now - item.timestamp <= item.ttl &&
                            item.version === this.config.version) {
                            validKeys.push(key);
                        } else {
                            localStorage.removeItem(storageKey);
                        }
                    } catch {
                        localStorage.removeItem(storageKey);
                    }
                }
            });

            this.updateIndex(validKeys);
        } catch {
            // Ignore errors
        }
    }

    /**
     * Update hit rate metric
     */
    private updateHitRate(): void {
        const total = this.metrics.hits + this.metrics.misses;
        this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    }

    /**
     * Get storage usage stats
     */
    getStorageStats(): {
        itemCount: number;
        estimatedBytes: number;
        maxItems: number;
        } {
        const index = this.getIndex();
        let estimatedBytes = 0;

        try {
            index.forEach(key => {
                const stored = localStorage.getItem(this.getStorageKey(key));
                if (stored) {
                    estimatedBytes += stored.length * 2; // UTF-16
                }
            });
        } catch {
            // Ignore errors
        }

        return {
            itemCount: index.length,
            estimatedBytes,
            maxItems: this.config.maxItems,
        };
    }

    /**
     * Get cached video IDs (for transcript cache)
     */
    getCachedVideoIds(): string[] {
        return this.getIndex()
            .filter(key => key.startsWith('transcript-'))
            .map(key => key.replace('transcript-', ''));
    }
}

// Export singleton instances for different cache types
export const transcriptCache = new PersistentCacheService({
    namespace: 'ytc-transcript',
    maxItems: 50,
    defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
});

export const videoMetadataCache = new PersistentCacheService({
    namespace: 'ytc-metadata',
    maxItems: 200,
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
});
