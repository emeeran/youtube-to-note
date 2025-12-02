import { CacheService } from '../../types';
import { performanceMonitor } from '../../utils/performance-monitor';

/**
 * Enhanced cache service with multi-layer caching, intelligent invalidation,
 * and advanced performance optimizations
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccessed: number;
    size: number;
    priority: 'low' | 'medium' | 'high';
    tags: string[];
    dependencies?: string[]; // Keys that invalidate this entry
    version?: string; // For cache versioning
}

interface CacheConfig {
    maxSize: number; // Maximum number of entries
    maxMemory: number; // Maximum memory usage in bytes
    defaultTTL: number; // Default TTL in milliseconds
    cleanupInterval: number; // Cleanup interval in milliseconds
    enableMetrics: boolean;
    enableCompression: boolean;
    enablePersistence: boolean;
    layers: {
        memory: number; // Percentage of cache in memory
        persistent: number; // Percentage in persistent storage
    };
    evictionPolicy: 'lru' | 'lfu' | 'priority' | 'adaptive';
}

interface CacheStats {
    entries: number;
    memoryUsage: number;
    hitRate: number;
    missRate: number;
    evictionRate: number;
    averageAccessTime: number;
    hotEntries: Array<{ key: string; accessCount: number }>;
    sizeDistribution: Record<string, number>;
}

interface CacheLayer {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, data: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    size(): Promise<number>;
    getStats(): Promise<any>;
}

const DEFAULT_CONFIG: CacheConfig = {
    maxSize: 1000,
    maxMemory: 50 * 1024 * 1024, // 50MB
    defaultTTL: 300000, // 5 minutes
    cleanupInterval: 60000, // 1 minute
    enableMetrics: true,
    enableCompression: false,
    enablePersistence: false,
    layers: {
        memory: 70,
        persistent: 30
    },
    evictionPolicy: 'adaptive'
};

export class EnhancedCacheService implements CacheService {
    private config: CacheConfig;
    private memoryCache: Map<string, CacheEntry<any>> = new Map();
    private accessOrder: string[] = [];
    private dependencyGraph: Map<string, Set<string>> = new Map();
    private cleanupTimer?: NodeJS.Timeout;
    private metrics: CacheStats;
    private layers: CacheLayer[] = [];

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.metrics = this.initializeMetrics();
        this.setupCleanupTimer();
        this.initializeLayers();
    }

    /**
     * Get item from cache with intelligent routing
     */
    async get<T>(key: string): Promise<T | null> {
        return await performanceMonitor.measureOperation(`cache-get-${key}`, async () => {
            const startTime = performance.now();

            try {
                // Check memory cache first
                let entry = this.memoryCache.get(key);

                if (entry) {
                    // Check if expired
                    if (this.isExpired(entry)) {
                        this.memoryCache.delete(key);
                        this.removeFromAccessOrder(key);
                        entry = null;
                    } else {
                        // Update access metadata
                        this.updateAccessMetadata(key, entry);
                        this.metrics.entries = this.memoryCache.size;

                        return entry.data as T;
                    }
                }

                // Check other layers if not found in memory
                for (const layer of this.layers) {
                    try {
                        const data = await layer.get<T>(key);
                        if (data) {
                            // Promote to memory cache
                            await this.set(key, data, this.config.defaultTTL, { priority: 'medium' });
                            return data;
                        }
                    } catch (error) {
                        console.warn(`Cache layer error for key ${key}:`, error);
                    }
                }

                // Cache miss
                this.recordMiss();
                return null;
            } finally {
                const accessTime = performance.now() - startTime;
                this.updateAverageAccessTime(accessTime);
            }
        }, {
            operation: 'cacheGet',
            key,
            cacheSize: this.memoryCache.size
        });
    }

    /**
     * Set item in cache with intelligent placement
     */
    async set<T>(
        key: string,
        data: T,
        ttl?: number,
        options: {
            priority?: 'low' | 'medium' | 'high';
            tags?: string[];
            dependencies?: string[];
            version?: string;
            compress?: boolean;
        } = {}
    ): Promise<void> {
        return await performanceMonitor.measureOperation(`cache-set-${key}`, async () => {
            const actualTTL = ttl || this.config.defaultTTL;
            const size = this.estimateSize(data, options.compress);
            const priority = options.priority || this.calculatePriority(key, data);

            // Check if we need to make space
            await this.ensureCapacity(size);

            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
                ttl: actualTTL,
                accessCount: 0,
                lastAccessed: Date.now(),
                size,
                priority,
                tags: options.tags || [],
                dependencies: options.dependencies,
                version: options.version
            };

            // Handle dependencies
            if (options.dependencies) {
                this.registerDependencies(key, options.dependencies);
            }

            // Store in memory cache
            this.memoryCache.set(key, entry);
            this.updateAccessOrder(key);

            // Update metrics
            this.metrics.entries = this.memoryCache.size;
            this.metrics.memoryUsage = this.calculateMemoryUsage();

            // Determine if it should be persisted
            if (this.shouldPersist(entry)) {
                await this.persistEntry(key, entry);
            }

            // Invalidate dependent entries if needed
            await this.invalidateDependents(key);
        }, {
            operation: 'cacheSet',
            key,
            size,
            priority
        });
    }

    /**
     * Check if key exists in cache
     */
    async has(key: string): Promise<boolean> {
        const entry = this.memoryCache.get(key);
        if (entry) {
            if (this.isExpired(entry)) {
                await this.delete(key);
                return false;
            }
            return true;
        }

        // Check other layers
        for (const layer of this.layers) {
            try {
                const data = await layer.get(key);
                if (data) {
                    return true;
                }
            } catch (error) {
                console.warn(`Cache layer check error for key ${key}:`, error);
            }
        }

        return false;
    }

    /**
     * Delete item from cache
     */
    async delete(key: string): Promise<boolean> {
        const deleted = this.memoryCache.delete(key);
        if (deleted) {
            this.removeFromAccessOrder(key);
            this.removeDependencies(key);
            this.metrics.entries = this.memoryCache.size;
            this.metrics.memoryUsage = this.calculateMemoryUsage();
        }

        // Delete from other layers
        for (const layer of this.layers) {
            try {
                await layer.delete(key);
            } catch (error) {
                console.warn(`Cache layer delete error for key ${key}:`, error);
            }
        }

        return deleted;
    }

    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        this.memoryCache.clear();
        this.accessOrder = [];
        this.dependencyGraph.clear();
        this.metrics = this.initializeMetrics();

        // Clear other layers
        for (const layer of this.layers) {
            try {
                await layer.clear();
            } catch (error) {
                console.warn('Cache layer clear error:', error);
            }
        }
    }

    /**
     * Get cache size
     */
    async size(): Promise<number> {
        return this.memoryCache.size;
    }

    /**
     * Get comprehensive cache statistics
     */
    async getStats(): Promise<CacheStats> {
        // Update dynamic stats
        this.metrics.entries = this.memoryCache.size;
        this.metrics.memoryUsage = this.calculateMemoryUsage();
        this.metrics.hitRate = this.calculateHitRate();
        this.metrics.missRate = 1 - this.metrics.hitRate;
        this.metrics.hotEntries = this.getHotEntries();
        this.metrics.sizeDistribution = this.calculateSizeDistribution();

        return { ...this.metrics };
    }

    /**
     * Get entries by tags
     */
    async getByTag(tag: string): Promise<Array<{ key: string; data: any }>> {
        const results: Array<{ key: string; data: any }> = [];

        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.tags.includes(tag) && !this.isExpired(entry)) {
                results.push({ key, data: entry.data });
                this.updateAccessMetadata(key, entry);
            }
        }

        return results;
    }

    /**
     * Invalidate entries by tags
     */
    async invalidateByTag(tag: string): Promise<number> {
        let invalidated = 0;

        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.tags.includes(tag)) {
                await this.delete(key);
                invalidated++;
            }
        }

        return invalidated;
    }

    /**
     * Invalidate entries by pattern
     */
    async invalidateByPattern(pattern: RegExp): Promise<number> {
        let invalidated = 0;

        for (const [key] of this.memoryCache.entries()) {
            if (pattern.test(key)) {
                await this.delete(key);
                invalidated++;
            }
        }

        return invalidated;
    }

    /**
     * Warm up cache with predefined data
     */
    async warmUp<T>(entries: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
        const promises = entries.map(({ key, data, ttl }) =>
            this.set(key, data, ttl, { priority: 'high' })
        );

        await Promise.allSettled(promises);
    }

    /**
     * Export cache data for backup
     */
    async export(): Promise<string> {
        const exportData = {
            version: '1.0',
            timestamp: Date.now(),
            config: this.config,
            entries: Array.from(this.memoryCache.entries()).map(([key, entry]) => ({
                key,
                data: entry.data,
                ttl: entry.ttl,
                priority: entry.priority,
                tags: entry.tags,
                version: entry.version
            })),
            metrics: this.metrics
        };

        return JSON.stringify(exportData);
    }

    /**
     * Import cache data from backup
     */
    async import(data: string): Promise<void> {
        try {
            const importData = JSON.parse(data);

            if (importData.version !== '1.0') {
                throw new Error('Unsupported cache export version');
            }

            // Clear existing cache
            await this.clear();

            // Import entries
            for (const entry of importData.entries) {
                await this.set(
                    entry.key,
                    entry.data,
                    entry.ttl,
                    {
                        priority: entry.priority,
                        tags: entry.tags,
                        version: entry.version
                    }
                );
            }

            // Restore metrics if available
            if (importData.metrics) {
                this.metrics = { ...this.metrics, ...importData.metrics };
            }
        } catch (error) {
            throw new Error(`Failed to import cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Initialize metrics
     */
    private initializeMetrics(): CacheStats {
        return {
            entries: 0,
            memoryUsage: 0,
            hitRate: 0,
            missRate: 0,
            evictionRate: 0,
            averageAccessTime: 0,
            hotEntries: [],
            sizeDistribution: {}
        };
    }

    /**
     * Setup cleanup timer
     */
    private setupCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Initialize cache layers
     */
    private initializeLayers(): void {
        // Initialize memory layer (handled by this class)
        // Could add localStorage, IndexedDB, or other persistent layers here
    }

    /**
     * Check if entry is expired
     */
    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    /**
     * Update access metadata
     */
    private updateAccessMetadata(key: string, entry: CacheEntry<any>): void {
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.updateAccessOrder(key);
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
     * Calculate priority based on key and data
     */
    private calculatePriority(key: string, data: any): 'low' | 'medium' | 'high' {
        // Simple heuristics - could be made more sophisticated
        if (key.includes('video-') || key.includes('metadata-')) {
            return 'high';
        }
        if (key.includes('model-') || key.includes('provider-')) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Estimate size of data
     */
    private estimateSize(data: any, compress = false): number {
        try {
            const serialized = JSON.stringify(data);
            const size = serialized.length * 2; // UTF-16 encoding
            return compress ? Math.floor(size * 0.7) : size; // Assume 30% compression
        } catch {
            return 1024; // Default 1KB
        }
    }

    /**
     * Ensure capacity for new entry
     */
    private async ensureCapacity(requiredSize: number): Promise<void> {
        while (this.shouldEvict(requiredSize)) {
            await this.evictEntry();
        }
    }

    /**
     * Check if eviction is needed
     */
    private shouldEvict(requiredSize: number): boolean {
        const currentMemory = this.calculateMemoryUsage();
        const currentEntries = this.memoryCache.size;

        return (
            currentEntries >= this.config.maxSize ||
            currentMemory + requiredSize > this.config.maxMemory
        );
    }

    /**
     * Evict entry based on policy
     */
    private async evictEntry(): Promise<void> {
        if (this.accessOrder.length === 0) return;

        let keyToEvict: string;

        switch (this.config.evictionPolicy) {
            case 'lru':
                keyToEvict = this.accessOrder[0];
                break;
            case 'lfu':
                keyToEvict = this.getLeastFrequentlyUsed();
                break;
            case 'priority':
                keyToEvict = this.getLowestPriority();
                break;
            case 'adaptive':
            default:
                keyToEvict = this.getAdaptiveEviction();
                break;
        }

        if (keyToEvict) {
            await this.delete(keyToEvict);
            this.metrics.evictionRate++;
        }
    }

    /**
     * Get least frequently used entry
     */
    private getLeastFrequentlyUsed(): string {
        let leastUsed = '';
        let minCount = Infinity;

        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.accessCount < minCount) {
                minCount = entry.accessCount;
                leastUsed = key;
            }
        }

        return leastUsed;
    }

    /**
     * Get lowest priority entry
     */
    private getLowestPriority(): string {
        const priorities = { low: 0, medium: 1, high: 2 };
        let lowestPriority = '';
        let minPriority = Infinity;

        for (const [key, entry] of this.memoryCache.entries()) {
            const priority = priorities[entry.priority];
            if (priority < minPriority) {
                minPriority = priority;
                lowestPriority = key;
            }
        }

        return lowestPriority;
    }

    /**
     * Adaptive eviction based on multiple factors
     */
    private getAdaptiveEviction(): string {
        // Combine LRU, LFU, and priority for smart eviction
        const now = Date.now();
        let bestScore = Infinity;
        let bestKey = '';

        for (const [key, entry] of this.memoryCache.entries()) {
            const age = now - entry.timestamp;
            const timeSinceAccess = now - entry.lastAccessed;
            const priorityMultiplier = entry.priority === 'high' ? 3 : entry.priority === 'medium' ? 2 : 1;

            // Score = (age + timeSinceAccess) / (accessCount * priority)
            const score = (age + timeSinceAccess) / (entry.accessCount * priorityMultiplier);

            if (score > bestScore) {
                bestScore = score;
                bestKey = key;
            }
        }

        return bestKey;
    }

    /**
     * Calculate current memory usage
     */
    private calculateMemoryUsage(): number {
        let total = 0;
        for (const entry of this.memoryCache.values()) {
            total += entry.size;
        }
        return total;
    }

    /**
     * Perform cleanup of expired entries
     */
    private async performCleanup(): Promise<void> {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.memoryCache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            await this.delete(key);
        }
    }

    /**
     * Register dependencies
     */
    private registerDependencies(key: string, dependencies: string[]): void {
        for (const dep of dependencies) {
            if (!this.dependencyGraph.has(dep)) {
                this.dependencyGraph.set(dep, new Set());
            }
            this.dependencyGraph.get(dep)!.add(key);
        }
    }

    /**
     * Remove dependencies
     */
    private removeDependencies(key: string): void {
        for (const [dep, dependents] of this.dependencyGraph.entries()) {
            dependents.delete(key);
            if (dependents.size === 0) {
                this.dependencyGraph.delete(dep);
            }
        }
    }

    /**
     * Invalidate dependent entries
     */
    private async invalidateDependents(key: string): Promise<void> {
        const dependents = this.dependencyGraph.get(key);
        if (dependents) {
            for (const dependent of dependents) {
                await this.delete(dependent);
            }
        }
    }

    /**
     * Check if entry should be persisted
     */
    private shouldPersist(entry: CacheEntry<any>): boolean {
        return (
            this.config.enablePersistence &&
            (entry.priority === 'high' || entry.ttl > this.config.defaultTTL)
        );
    }

    /**
     * Persist entry to storage layer
     */
    private async persistEntry(key: string, entry: CacheEntry<any>): Promise<void> {
        // Implementation would depend on storage layer
        // For now, this is a placeholder
    }

    /**
     * Record cache miss
     */
    private recordMiss(): void {
        // Update miss rate calculation
        this.metrics.missRate = (this.metrics.missRate * 0.9) + (0.1); // Exponential moving average
    }

    /**
     * Calculate hit rate
     */
    private calculateHitRate(): number {
        return 1 - this.metrics.missRate;
    }

    /**
     * Update average access time
     */
    private updateAverageAccessTime(accessTime: number): void {
        this.metrics.averageAccessTime =
            (this.metrics.averageAccessTime * 0.9) + (accessTime * 0.1);
    }

    /**
     * Get hot entries
     */
    private getHotEntries(): Array<{ key: string; accessCount: number }> {
        const entries = Array.from(this.memoryCache.entries())
            .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, 10);

        return entries;
    }

    /**
     * Calculate size distribution
     */
    private calculateSizeDistribution(): Record<string, number> {
        const distribution: Record<string, number> = {
            small: 0,    // < 1KB
            medium: 0,   // 1KB - 10KB
            large: 0,    // > 10KB
        };

        for (const entry of this.memoryCache.values()) {
            if (entry.size < 1024) {
                distribution.small++;
            } else if (entry.size < 10240) {
                distribution.medium++;
            } else {
                distribution.large++;
            }
        }

        return distribution;
    }

    /**
     * Cleanup method
     */
    async destroy(): Promise<void> {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        await this.clear();

        // Cleanup layers
        for (const layer of this.layers) {
            try {
                if ('destroy' in layer) {
                    await (layer as any).destroy();
                }
            } catch (error) {
                console.warn('Cache layer cleanup error:', error);
            }
        }
    }
}

// Singleton instance for global use
export const enhancedCache = new EnhancedCacheService({
    maxSize: 500,
    maxMemory: 25 * 1024 * 1024, // 25MB
    enableMetrics: true,
    evictionPolicy: 'adaptive'
});