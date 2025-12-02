import { PerformanceMonitor } from './performance-monitor';


export interface CacheItem<T> {
    data: T;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccessed: number;
    size: number;
    priority: number;
}

export interface CacheConfig {
    maxSize: number; // Maximum total size in bytes
    maxItems: number; // Maximum number of items
    defaultTtl: number; // Default TTL in milliseconds
    cleanupInterval: number; // Cleanup interval in milliseconds
    enableCompression: boolean;
    enablePersistence: boolean;
    priorityThreshold: number; // Items with priority below this may be evicted sooner
}

export interface CacheMetrics {
    hits: number;
    misses: number;
    evictions: number;
    totalSize: number;
    itemCount: number;
    hitRate: number;
    averageAccessTime: number;
    oldestItem: number;
    newestItem: number;
}

export interface CacheStats {
    items: number;
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
}

/**
 * Multi-level caching system with memory and persistent storage
 */
export class AdvancedCache<T = any> {
    private memoryCache = new Map<string, CacheItem<T>>();
    private persistentCache?: Storage;
    private config: CacheConfig;
    private metrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalAccessTime: 0,
        accessCount: 0
    };
    private cleanupTimer?: number;
    private performanceMonitor?: PerformanceMonitor;
    private compressionWorker?: Worker;

    constructor(config: Partial<CacheConfig> = {}, performanceMonitor?: PerformanceMonitor) {
        this.config = {
            maxSize: 50 * 1024 * 1024, // 50MB
            maxItems: 1000,
            defaultTtl: 30 * 60 * 1000, // 30 minutes
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            enableCompression: false,
            enablePersistence: true,
            priorityThreshold: 0.5,
            ...config
        };

        this.performanceMonitor = performanceMonitor;

        if (this.config.enablePersistence && typeof localStorage !== 'undefined') {
            this.persistentCache = localStorage;
        }

        this.startCleanupTimer();
        this.loadPersistentData();

        // Initialize compression worker if enabled
        if (this.config.enableCompression && typeof Worker !== 'undefined') {
            this.initializeCompressionWorker();
        }
    }

    private initializeCompressionWorker(): void {
        const workerCode = `
            self.addEventListener('message', async (e) => {
                const { action, data, key } = e.data;

                try {
                    if (action === 'compress') {
                        const compressed = await this.compressData(data);
                        self.postMessage({ action: 'compressed', key, data: compressed });
                    } else if (action === 'decompress') {
                        const decompressed = await this.decompressData(data);
                        self.postMessage({ action: 'decompressed', key, data: decompressed });
                    }
                } catch (error) {
                    self.postMessage({ action: 'error', key, error: error.message });
                }
            });

            async function compressData(data) {
                const jsonString = JSON.stringify(data);
                const encoder = new TextEncoder();
                const uint8Array = encoder.encode(jsonString);

                if ('CompressionStream' in window) {
                    const compressionStream = new CompressionStream('gzip');
                    const writer = compressionStream.writable.getWriter();
                    const reader = compressionStream.readable.getReader();

                    writer.write(uint8Array);
                    writer.close();

                    const chunks = [];
                    let done = false;

                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) chunks.push(value);
                    }

                    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const combined = new Uint8Array(totalLength);
                    let offset = 0;

                    for (const chunk of chunks) {
                        combined.set(chunk, offset);
                        offset += chunk.length;
                    }

                    return combined;
                }

                return uint8Array;
            }

            async function decompressData(compressedData) {
                if ('DecompressionStream' in window) {
                    const decompressionStream = new DecompressionStream('gzip');
                    const writer = decompressionStream.writable.getWriter();
                    const reader = decompressionStream.readable.getReader();

                    writer.write(compressedData);
                    writer.close();

                    const chunks = [];
                    let done = false;

                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) chunks.push(value);
                    }

                    const decoder = new TextDecoder();
                    let result = '';

                    for (const chunk of chunks) {
                        result += decoder.decode(chunk, { stream: true });
                    }

                    return JSON.parse(result);
                }

                const decoder = new TextDecoder();
                const jsonString = decoder.decode(compressedData);
                return JSON.parse(jsonString);
            }
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.compressionWorker = new Worker(URL.createObjectURL(blob));
    }

    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = window.setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    private loadPersistentData(): void {
        if (!this.persistentCache) return;

        try {
            const keys = Object.keys(this.persistentCache);
            const now = Date.now();

            keys.forEach(key => {
                if (key.startsWith('cache_')) {
                    try {
                        const item = JSON.parse(this.persistentCache!.getItem(key) || '');
                        if (item.timestamp + item.ttl > now) {
                            // Restore to memory cache if not expired
                            this.memoryCache.set(key.replace('cache_', ''), item);
                        } else {
                            // Remove expired persistent item
                            this.persistentCache!.removeItem(key);
                        }
                    } catch (error) {
                        
this.persistentCache!.removeItem(key);
                    }
                }
            });
        } catch (error) {
            
}
    }

    private calculateSize(data: T): number {
        try {
            return new Blob([JSON.stringify(data)]).size;
        } catch (error) {
            return 1024; // Default estimate
        }
    }

    private shouldEvict(newItemSize: number): boolean {
        if (this.memoryCache.size >= this.config.maxItems) return true;

        const currentSize = this.getCurrentSize();
        return currentSize + newItemSize > this.config.maxSize;
    }

    private getCurrentSize(): number {
        let totalSize = 0;
        this.memoryCache.forEach(item => {
            totalSize += item.size;
        });
        return totalSize;
    }

    private evictLeastUseful(): void {
        if (this.memoryCache.size === 0) return;

        const now = Date.now();
        let worstKey: string | null = null;
        let worstScore = Infinity;

        this.memoryCache.forEach((item, key) => {
            // Calculate a score based on access count, recency, and priority
            const age = now - item.lastAccessed;
            const accessFrequency = item.accessCount / Math.max(1, age / 1000); // Accesses per second
            const priorityFactor = item.priority;

            // Lower score means more likely to evict
            const score = accessFrequency * priorityFactor * (item.ttl / Math.max(1, age));

            if (score < worstScore) {
                worstScore = score;
                worstKey = key;
            }
        });

        if (worstKey) {
            this.evict(worstKey);
        }
    }

    private evict(key: string): void {
        const item = this.memoryCache.get(key);
        if (item) {
            this.memoryCache.delete(key);
            this.metrics.evictions++;

            if (this.persistentCache) {
                this.persistentCache.removeItem(`cache_${key}`);
            }

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('cache_eviction', 1, { key });
            }
        }
    }

    private async compressIfNeeded(data: T): Promise<T | Uint8Array> {
        if (!this.config.enableCompression || !this.compressionWorker) {
            return data;
        }

        // Only compress data larger than 1KB
        const size = this.calculateSize(data);
        if (size < 1024) {
            return data;
        }

        return new Promise((resolve, reject) => {
            const messageId = Math.random().toString(36);
            const timeout = setTimeout(() => {
                reject(new Error('Compression timeout'));
            }, 5000);

            const handler = (e: MessageEvent) => {
                if (e.data.key === messageId) {
                    clearTimeout(timeout);
                    this.compressionWorker!.removeEventListener('message', handler);

                    if (e.data.action === 'compressed') {
                        resolve(e.data.data);
                    } else {
                        reject(new Error(e.data.error));
                    }
                }
            };

            this.compressionWorker!.addEventListener('message', handler);
            this.compressionWorker!.postMessage({
                action: 'compress',
                data,
                key: messageId
            });
        });
    }

    private async decompressIfNeeded(data: T | Uint8Array): Promise<T> {
        if (!this.config.enableCompression || !this.compressionWorker || !(data instanceof Uint8Array)) {
            return data as T;
        }

        return new Promise((resolve, reject) => {
            const messageId = Math.random().toString(36);
            const timeout = setTimeout(() => {
                reject(new Error('Decompression timeout'));
            }, 5000);

            const handler = (e: MessageEvent) => {
                if (e.data.key === messageId) {
                    clearTimeout(timeout);
                    this.compressionWorker!.removeEventListener('message', handler);

                    if (e.data.action === 'decompressed') {
                        resolve(e.data.data);
                    } else {
                        reject(new Error(e.data.error));
                    }
                }
            };

            this.compressionWorker!.addEventListener('message', handler);
            this.compressionWorker!.postMessage({
                action: 'decompress',
                data,
                key: messageId
            });
        });
    }

    async set(
        key: string,
        data: T,
        ttl: number = this.config.defaultTtl,
        priority: number = 1.0
    ): Promise<void> {
        const startTime = performance.now();

        try {
            const size = this.calculateSize(data);
            const compressedData = await this.compressIfNeeded(data);

            const item: CacheItem<T> = {
                data,
                timestamp: Date.now(),
                ttl,
                accessCount: 0,
                lastAccessed: Date.now(),
                size,
                priority
            };

            // Evict items if necessary
            while (this.shouldEvict(size)) {
                this.evictLeastUseful();
            }

            this.memoryCache.set(key, item);

            // Persist if enabled
            if (this.persistentCache) {
                try {
                    const persistItem = { ...item, data: compressedData };
                    this.persistentCache.setItem(`cache_${key}`, JSON.stringify(persistItem));
                } catch (error) {
                    
}
            }

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('cache_set', performance.now() - startTime, { key, size });
            }
        } catch (error) {
            
throw error;
        }
    }

    async get(key: string): Promise<T | null> {
        const startTime = performance.now();

        try {
            const item = this.memoryCache.get(key);

            if (!item) {
                this.metrics.misses++;
                return null;
            }

            const now = Date.now();

            // Check if expired
            if (now - item.timestamp > item.ttl) {
                this.evict(key);
                this.metrics.misses++;
                return null;
            }

            // Update access statistics
            item.accessCount++;
            item.lastAccessed = now;

            this.metrics.hits++;
            this.metrics.totalAccessTime += performance.now() - startTime;
            this.metrics.accessCount++;

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('cache_hit', performance.now() - startTime, { key });
            }

            return item.data;
        } catch (error) {
            
this.metrics.misses++;
            return null;
        }
    }

    has(key: string): boolean {
        const item = this.memoryCache.get(key);
        if (!item) return false;

        const now = Date.now();
        return now - item.timestamp <= item.ttl;
    }

    delete(key: string): boolean {
        const existed = this.memoryCache.has(key);
        this.memoryCache.delete(key);

        if (this.persistentCache) {
            this.persistentCache.removeItem(`cache_${key}`);
        }

        return existed;
    }

    clear(): void {
        this.memoryCache.clear();

        if (this.persistentCache) {
            const keys = Object.keys(this.persistentCache);
            keys.forEach(key => {
                if (key.startsWith('cache_')) {
                    this.persistentCache!.removeItem(key);
                }
            });
        }

        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalAccessTime: 0,
            accessCount: 0
        };
    }

    cleanup(): void {
        const now = Date.now();
        const keysToEvict: string[] = [];

        this.memoryCache.forEach((item, key) => {
            if (now - item.timestamp > item.ttl) {
                keysToEvict.push(key);
            }
        });

        keysToEvict.forEach(key => this.evict(key));

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('cache_cleanup', keysToEvict.length);
        }
    }

    getMetrics(): CacheMetrics {
        const now = Date.now();
        let oldestItem = 0;
        let newestItem = 0;

        this.memoryCache.forEach(item => {
            oldestItem = Math.min(oldestItem, item.timestamp || now);
            newestItem = Math.max(newestItem, item.timestamp);
        });

        const totalAccesses = this.metrics.hits + this.metrics.misses;

        return {
            hits: this.metrics.hits,
            misses: this.metrics.misses,
            evictions: this.metrics.evictions,
            totalSize: this.getCurrentSize(),
            itemCount: this.memoryCache.size,
            hitRate: totalAccesses > 0 ? this.metrics.hits / totalAccesses : 0,
            averageAccessTime: this.metrics.accessCount > 0 ?
                this.metrics.totalAccessTime / this.metrics.accessCount : 0,
            oldestItem: oldestItem || now,
            newestItem: newestItem || now
        };
    }

    getStats(): CacheStats {
        const metrics = this.getMetrics();
        return {
            items: metrics.itemCount,
            size: metrics.totalSize,
            hits: metrics.hits,
            misses: metrics.misses,
            evictions: metrics.evictions,
            hitRate: metrics.hitRate
        };
    }

    /**
     * Warm up cache with commonly accessed data
     */
    async warmup(preloadData: Array<{ key: string; loader: () => Promise<T>; priority?: number }>): Promise<void> {
        const promises = preloadData.map(async ({ key, loader, priority = 1.0 }) => {
            if (!this.has(key)) {
                try {
                    const data = await loader();
                    await this.set(key, data, this.config.defaultTtl * 2, priority); // Longer TTL for warmup data
                } catch (error) {
                    
}
            }
        });

        await Promise.all(promises);

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('cache_warmup', preloadData.length);
        }
    }

    /**
     * Export cache data for backup
     */
    export(): string {
        const data: Record<string, CacheItem<T>> = {};
        this.memoryCache.forEach((item, key) => {
            data[key] = item;
        });
        return JSON.stringify(data);
    }

    /**
     * Import cache data from backup
     */
    async import(exportedData: string): Promise<void> {
        try {
            const data = JSON.parse(exportedData) as Record<string, CacheItem<T>>;
            const now = Date.now();

            Object.entries(data).forEach(([key, item]) => {
                // Only import non-expired items
                if (now - item.timestamp <= item.ttl) {
                    this.memoryCache.set(key, item);
                }
            });

            // Cleanup after import
            this.cleanup();
        } catch (error) {
            
throw error;
        }
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        if (this.compressionWorker) {
            this.compressionWorker.terminate();
        }

        this.clear();
    }
}

/**
 * Cache factory for creating different types of caches
 */
export class CacheFactory {
    private static caches = new Map<string, AdvancedCache>();

    static createCache<T>(
        name: string,
        config?: Partial<CacheConfig>,
        performanceMonitor?: PerformanceMonitor
    ): AdvancedCache<T> {
        if (this.caches.has(name)) {
            return this.caches.get(name) as AdvancedCache<T>;
        }

        const cache = new AdvancedCache<T>(config, performanceMonitor);
        this.caches.set(name, cache);
        return cache;
    }

    static getCache<T>(name: string): AdvancedCache<T> | undefined {
        return this.caches.get(name) as AdvancedCache<T>;
    }

    static destroyCache(name: string): void {
        const cache = this.caches.get(name);
        if (cache) {
            cache.destroy();
            this.caches.delete(name);
        }
    }

    static destroyAllCaches(): void {
        this.caches.forEach((cache, name) => {
            cache.destroy();
        });
        this.caches.clear();
    }

    static getAllMetrics(): Record<string, CacheMetrics> {
        const metrics: Record<string, CacheMetrics> = {};
        this.caches.forEach((cache, name) => {
            metrics[name] = cache.getMetrics();
        });
        return metrics;
    }
}