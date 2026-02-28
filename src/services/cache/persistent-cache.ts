import { CacheService, CacheMetrics } from '../../types';

/**
 * Persistent cache using localStorage for data that survives plugin reloads
 */

interface PersistentCacheItem<T> {
    data: T;
    expiresAt: number;
}

interface PersistentCacheConfig {
    namespace: string;
    maxItems: number;
    defaultTTL: number;
}

const DEFAULT_CONFIG: PersistentCacheConfig = {
    namespace: 'ytc',
    maxItems: 100,
    defaultTTL: 86400000, // 24 hours
};

export class PersistentCacheService implements CacheService {
    private config: PersistentCacheConfig;
    private metrics: CacheMetrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0,
    };

    constructor(config: Partial<PersistentCacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cleanupExpired();
    }

    private getStorageKey(key: string): string {
        return `${this.config.namespace}-${key}`;
    }

    private getIndex(): string[] {
        try {
            const index = localStorage.getItem(`${this.config.namespace}-index`);
            return index ? JSON.parse(index) : [];
        } catch {
            return [];
        }
    }

    private setIndex(keys: string[]): void {
        try {
            localStorage.setItem(`${this.config.namespace}-index`, JSON.stringify(keys));
            this.metrics.size = keys.length;
        } catch {
            // Ignore
        }
    }

    get<T>(key: string): T | null {
        try {
            const storageKey = this.getStorageKey(key);
            const stored = localStorage.getItem(storageKey);

            if (!stored) {
                this.metrics.misses++;
                this.updateMetrics();
                return null;
            }

            const item: PersistentCacheItem<T> = JSON.parse(stored);

            // Check expiration
            if (Date.now() > item.expiresAt) {
                this.delete(key);
                this.metrics.misses++;
                this.updateMetrics();
                return null;
            }

            this.metrics.hits++;
            this.updateMetrics();
            return item.data;
        } catch {
            this.metrics.misses++;
            this.updateMetrics();
            return null;
        }
    }

    set<T>(key: string, data: T, ttl?: number): void {
        try {
            const index = this.getIndex();

            // Evict oldest if at capacity
            while (index.length >= this.config.maxItems) {
                const oldestKey = index.shift();
                if (oldestKey) {
                    localStorage.removeItem(this.getStorageKey(oldestKey));
                    this.metrics.evictions++;
                }
            }

            const item: PersistentCacheItem<T> = {
                data,
                expiresAt: Date.now() + (ttl ?? this.config.defaultTTL),
            };

            localStorage.setItem(this.getStorageKey(key), JSON.stringify(item));

            // Update index
            if (!index.includes(key)) {
                index.push(key);
            }
            this.setIndex(index);
        } catch (error) {
            if ((error as Error).name === 'QuotaExceededError') {
                this.evictOldest(10);
                try {
                    this.set(key, data, ttl);
                } catch {
                    // Give up
                }
            }
        }
    }

    delete(key: string): boolean {
        try {
            const storageKey = this.getStorageKey(key);
            const existed = localStorage.getItem(storageKey) !== null;

            if (existed) {
                localStorage.removeItem(storageKey);
                const index = this.getIndex().filter(k => k !== key);
                this.setIndex(index);
            }

            return existed;
        } catch {
            return false;
        }
    }

    clear(): void {
        try {
            const index = this.getIndex();
            index.forEach(key => {
                localStorage.removeItem(this.getStorageKey(key));
            });
            this.setIndex([]);
            this.metrics = {
                hits: 0,
                misses: 0,
                evictions: 0,
                size: 0,
                hitRate: 0,
            };
        } catch {
            // Ignore
        }
    }

    getMetrics(): CacheMetrics {
        return { ...this.metrics };
    }

    private evictOldest(count: number): void {
        const index = this.getIndex();
        const toRemove = index.slice(0, count);

        toRemove.forEach(key => {
            localStorage.removeItem(this.getStorageKey(key));
            this.metrics.evictions++;
        });

        this.setIndex(index.slice(count));
    }

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
                        if (now <= item.expiresAt) {
                            validKeys.push(key);
                        } else {
                            localStorage.removeItem(storageKey);
                        }
                    } catch {
                        localStorage.removeItem(storageKey);
                    }
                }
            });

            this.setIndex(validKeys);
        } catch {
            // Ignore
        }
    }

    private updateMetrics(): void {
        const total = this.metrics.hits + this.metrics.misses;
        this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    }

    destroy(): void {
        this.clear();
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
