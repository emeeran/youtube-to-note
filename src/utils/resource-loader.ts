/**
 * Advanced Resource Loader with Bundling and Lazy Loading
 * Provides intelligent resource management, prefetching, and performance optimization
 */

import { performanceMonitor } from './performance-monitor';

export interface ResourceConfig {
    url: string;
    type: 'script' | 'style' | 'image' | 'font' | 'json' | 'html';
    priority: 'high' | 'medium' | 'low';
    preload?: boolean;
    cacheable?: boolean;
    integrity?: string;
    crossOrigin?: 'anonymous' | 'use-credentials';
    timeout?: number;
    retryCount?: number;
    dependencies?: string[];
}

export interface LoadResult {
    success: boolean;
    resource: ResourceConfig;
    content?: any;
    error?: string;
    loadTime: number;
    cached: boolean;
    size?: number;
}

export interface BundleConfig {
    name: string;
    resources: ResourceConfig[];
    strategy: 'parallel' | 'sequential' | 'waterfall';
    maxConcurrency?: number;
    timeout?: number;
    retryCount?: number;
}

export interface PrefetchConfig {
    resources: ResourceConfig[];
    priority?: number;
    whenIdle?: boolean;
    timeout?: number;
}

export interface LoaderStats {
    totalResources: number;
    loadedResources: number;
    failedResources: number;
    cacheHitRate: number;
    averageLoadTime: number;
    totalSize: number;
    bandwidth: number;
}

export class ResourceLoader {
    private resourceCache: Map<string, any> = new Map();
    private loadingPromises: Map<string, Promise<LoadResult>> = new Map();
    private loadQueue: ResourceConfig[] = [];
    private isProcessing = false;
    private stats: LoaderStats;
    private bandwidthEstimator: number[] = [];
    private prefetchQueue: PrefetchConfig[] = [];
    private observer?: IntersectionObserver;
    private supportedFormats: Set<string>;

    constructor() {
        this.stats = this.initializeStats();
        this.supportedFormats = new Set(['webp', 'jpeg', 'png', 'gif', 'svg']);
        this.initializeObserver();
    }

    /**
     * Load a single resource
     */
    async load(config: ResourceConfig): Promise<LoadResult> {
        const startTime = performance.now();

        // Check if already loading
        if (this.loadingPromises.has(config.url)) {
            return this.loadingPromises.get(config.url)!;
        }

        // Check cache first
        if (this.resourceCache.has(config.url)) {
            const cached = this.resourceCache.get(config.url)!;
            return {
                success: true,
                resource: config,
                content: cached,
                loadTime: performance.now() - startTime,
                cached: true
            };
        }

        // Create loading promise
        const loadPromise = this.performLoad(config, startTime);
        this.loadingPromises.set(config.url, loadPromise);

        try {
            const result = await loadPromise;
            return result;
        } finally {
            this.loadingPromises.delete(config.url);
        }
    }

    /**
     * Load multiple resources in a bundle
     */
    async loadBundle(config: BundleConfig): Promise<LoadResult[]> {
        return await performanceMonitor.measureOperation(`load-bundle-${config.name}`, async () => {
            const { resources, strategy, maxConcurrency = 5 } = config;

            switch (strategy) {
                case 'parallel':
                    return await this.loadParallel(resources, maxConcurrency);
                case 'sequential':
                    return await this.loadSequential(resources);
                case 'waterfall':
                    return await this.loadWaterfall(resources);
                default:
                    throw new Error(`Unknown bundle strategy: ${strategy}`);
            }
        }, {
            strategy,
            resourceCount: resources.length
        });
    }

    /**
     * Load resources in parallel with concurrency control
     */
    private async loadParallel(resources: ResourceConfig[], maxConcurrency: number): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        const semaphore = new Semaphore(maxConcurrency);

        const promises = resources.map(async (resource) => {
            await semaphore.acquire();
            try {
                const result = await this.load(resource);
                results.push(result);
                return result;
            } finally {
                semaphore.release();
            }
        });

        await Promise.allSettled(promises);
        return results;
    }

    /**
     * Load resources sequentially
     */
    private async loadSequential(resources: ResourceConfig[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const resource of resources) {
            const result = await this.load(resource);
            results.push(result);

            // Stop on critical failure
            if (!result.success && resource.priority === 'high') {
                break;
            }
        }

        return results;
    }

    /**
     * Load resources with dependency waterfall
     */
    private async loadWaterfall(resources: ResourceConfig[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        const loaded = new Set<string>();

        for (const resource of resources) {
            // Check dependencies
            if (resource.dependencies) {
                for (const dep of resource.dependencies) {
                    if (!loaded.has(dep)) {
                        // Find and load dependency
                        const depResource = resources.find(r => r.url === dep);
                        if (depResource) {
                            const depResult = await this.load(depResource);
                            results.push(depResult);
                            loaded.add(dep);

                            if (!depResult.success) {
                                break;
                            }
                        }
                    }
                }
            }

            const result = await this.load(resource);
            results.push(result);
            loaded.add(resource.url);

            // Stop on critical failure
            if (!result.success && resource.priority === 'high') {
                break;
            }
        }

        return results;
    }

    /**
     * Perform actual resource loading
     */
    private async performLoad(config: ResourceConfig, startTime: number): Promise<LoadResult> {
        const { url, type, timeout = 30000, retryCount = 3 } = config;

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                const result = await this.loadResource(url, type, timeout, config);

                if (result.success && config.cacheable !== false) {
                    this.resourceCache.set(url, result.content);
                }

                // Update stats
                this.updateStats(result, performance.now() - startTime);

                return result;

            } catch (error) {
                if (attempt === retryCount) {
                    const loadTime = performance.now() - startTime;
                    return {
                        success: false,
                        resource: config,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        loadTime,
                        cached: false
                    };
                }

                // Wait before retry
                await this.delay(1000 * Math.pow(2, attempt));
            }
        }

        // Should never reach here
        return {
            success: false,
            resource: config,
            error: 'Max retries exceeded',
            loadTime: performance.now() - startTime,
            cached: false
        };
    }

    /**
     * Load individual resource based on type
     */
    private async loadResource(
        url: string,
        type: string,
        timeout: number,
        config: ResourceConfig
    ): Promise<LoadResult> {
        const startTime = performance.now();

        switch (type) {
            case 'script':
                return await this.loadScript(url, config);
            case 'style':
                return await this.loadStyle(url, config);
            case 'image':
                return await this.loadImage(url, config);
            case 'font':
                return await this.loadFont(url, config);
            case 'json':
                return await this.loadJSON(url, config);
            case 'html':
                return await this.loadHTML(url, config);
            default:
                throw new Error(`Unsupported resource type: ${type}`);
        }
    }

    /**
     * Load JavaScript script
     */
    private async loadScript(url: string, config: ResourceConfig): Promise<LoadResult> {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;

            if (config.integrity) {
                script.integrity = config.integrity;
                script.crossOrigin = config.crossOrigin || 'anonymous';
            }

            const timeoutId = setTimeout(() => {
                reject(new Error('Script load timeout'));
            }, 30000);

            script.onload = () => {
                clearTimeout(timeoutId);
                resolve({
                    success: true,
                    resource: config,
                    content: script,
                    loadTime: performance.now(),
                    cached: false
                });
            };

            script.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Script load failed'));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Load CSS stylesheet
     */
    private async loadStyle(url: string, config: ResourceConfig): Promise<LoadResult> {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;

            if (config.integrity) {
                link.integrity = config.integrity;
                link.crossOrigin = config.crossOrigin || 'anonymous';
            }

            const timeoutId = setTimeout(() => {
                reject(new Error('Style load timeout'));
            }, 30000);

            link.onload = () => {
                clearTimeout(timeoutId);
                resolve({
                    success: true,
                    resource: config,
                    content: link,
                    loadTime: performance.now(),
                    cached: false
                });
            };

            link.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error('Style load failed'));
            };

            document.head.appendChild(link);
        });
    }

    /**
     * Load image
     */
    private async loadImage(url: string, config: ResourceConfig): Promise<LoadResult> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            if (config.crossOrigin) {
                img.crossOrigin = config.crossOrigin;
            }

            const startTime = performance.now();

            img.onload = () => {
                resolve({
                    success: true,
                    resource: config,
                    content: img,
                    loadTime: performance.now() - startTime,
                    cached: false
                });
            };

            img.onerror = () => {
                reject(new Error('Image load failed'));
            };

            img.src = url;
        });
    }

    /**
     * Load font
     */
    private async loadFont(url: string, config: ResourceConfig): Promise<LoadResult> {
        if (!('fonts' in document)) {
            throw new Error('Font loading not supported');
        }

        try {
            const fontFace = new FontFace(
                config.url.split('/').pop()?.split('.')[0] || 'custom-font',
                `url(${url}) format('${this.getFontFormat(url)}')`,
                {}
            );

            await fontFace.load();
            document.fonts.add(fontFace);

            return {
                success: true,
                resource: config,
                content: fontFace,
                loadTime: performance.now(),
                cached: false
            };
        } catch (error) {
            throw new Error('Font load failed');
        }
    }

    /**
     * Load JSON data
     */
    private async loadJSON(url: string, config: ResourceConfig): Promise<LoadResult> {
        const startTime = performance.now();
        const response = await fetch(url, {
            headers: config.integrity ? { 'If-None-Match': config.integrity } : {},
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            success: true,
            resource: config,
            content: data,
            loadTime: performance.now() - startTime,
            cached: response.status === 304,
            size: JSON.stringify(data).length
        };
    }

    /**
     * Load HTML content
     */
    private async loadHTML(url: string, config: ResourceConfig): Promise<LoadResult> {
        const startTime = performance.now();
        const response = await fetch(url, {
            headers: {
                'Accept': 'text/html',
                ...config.integrity ? { 'If-None-Match': config.integrity } : {}
            },
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();

        return {
            success: true,
            resource: config,
            content,
            loadTime: performance.now() - startTime,
            cached: response.status === 304,
            size: content.length
        };
    }

    /**
     * Prefetch resources
     */
    async prefetch(config: PrefetchConfig): Promise<void> {
        const { resources, whenIdle = true, timeout = 10000 } = config;

        if (whenIdle && 'requestIdleCallback' in window) {
            requestIdleCallback(() => {
                this.performPrefetch(resources, timeout);
            }, { timeout });
        } else {
            await this.performPrefetch(resources, timeout);
        }
    }

    /**
     * Perform actual prefetching
     */
    private async performPrefetch(resources: ResourceConfig[], timeout: number): Promise<void> {
        const prefetchPromises = resources
            .filter(resource => resource.preload !== false)
            .map(resource => this.prefetchResource(resource, timeout));

        await Promise.allSettled(prefetchPromises);
    }

    /**
     * Prefetch individual resource
     */
    private async prefetchResource(resource: ResourceConfig, timeout: number): Promise<void> {
        if (resource.type === 'script' || resource.type === 'style') {
            // Use link prefetch for scripts and styles
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = resource.url;
            link.as = resource.type === 'script' ? 'script' : 'style';

            if (resource.integrity) {
                link.integrity = resource.integrity;
                link.crossOrigin = resource.crossOrigin || 'anonymous';
            }

            document.head.appendChild(link);
        } else {
            // Use fetch for other resource types
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                await fetch(resource.url, {
                    signal: controller.signal,
                    headers: { 'Purpose': 'prefetch' }
                });

                clearTimeout(timeoutId);
            } catch (error) {
                // Prefetch failures are not critical
                console.warn(`Prefetch failed for ${resource.url}:`, error);
            }
        }
    }

    /**
     * Lazy load resources when they come into viewport
     */
    lazyLoad(elements: HTMLElement[], loader: (element: HTMLElement) => ResourceConfig): void {
        if (!this.observer) {
            console.warn('[Resource Loader] IntersectionObserver not supported');
            return;
        }

        elements.forEach(element => {
            this.observer.observe(element);
        });

        // Store loader callback
        const originalCallback = (element: HTMLElement) => {
            const config = loader(element);
            this.load(config).then(result => {
                if (result.success) {
                    this.onResourceLoaded(element, result);
                }
            });
        };

        // This would need to be stored for proper cleanup
    }

    /**
     * Initialize IntersectionObserver for lazy loading
     */
    private initializeObserver(): void {
        if (!('IntersectionObserver' in window)) {
            return;
        }

        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target as HTMLElement;
                        // Trigger lazy load for element
                        this.observer!.unobserve(element);
                    }
                });
            },
            {
                rootMargin: '50px' // Start loading 50px before element comes into view
            }
        );
    }

    /**
     * Handle resource loaded callback
     */
    private onResourceLoaded(element: HTMLElement, result: LoadResult): void {
        // Set data attributes for tracking
        element.setAttribute('data-loaded', 'true');
        element.setAttribute('data-load-time', result.loadTime.toString());

        // Dispatch custom event
        element.dispatchEvent(new CustomEvent('resourceLoaded', {
            detail: result
        }));
    }

    /**
     * Get font format from URL
     */
    private getFontFormat(url: string): string {
        const extension = url.split('.').pop()?.toLowerCase();
        const formatMap: Record<string, string> = {
            'woff': 'woff',
            'woff2': 'woff2',
            'ttf': 'truetype',
            'otf': 'opentype',
            'eot': 'embedded-opentype',
            'svg': 'svg'
        };

        return formatMap[extension || ''] || 'woff2';
    }

    /**
     * Update loading statistics
     */
    private updateStats(result: LoadResult, loadTime: number): void {
        this.stats.totalResources++;

        if (result.success) {
            this.stats.loadedResources++;
            this.stats.averageLoadTime = (
                this.stats.averageLoadTime * 0.9 + loadTime * 0.1
            );

            if (result.cached) {
                this.stats.cacheHitRate = this.stats.cacheHitRate * 0.9 + 0.1;
            } else {
                this.stats.cacheHitRate = this.stats.cacheHitRate * 0.9;
            }

            if (result.size) {
                this.stats.totalSize += result.size;
                this.estimateBandwidth(result.size, loadTime);
            }
        } else {
            this.stats.failedResources++;
        }
    }

    /**
     * Estimate bandwidth usage
     */
    private estimateBandwidth(size: number, time: number): void {
        const bandwidth = (size * 8) / (time / 1000); // bits per second
        this.bandwidthEstimator.push(bandwidth);

        // Keep only last 10 measurements
        if (this.bandwidthEstimator.length > 10) {
            this.bandwidthEstimator.shift();
        }
    }

    /**
     * Initialize statistics
     */
    private initializeStats(): LoaderStats {
        return {
            totalResources: 0,
            loadedResources: 0,
            failedResources: 0,
            cacheHitRate: 0,
            averageLoadTime: 0,
            totalSize: 0,
            bandwidth: 0
        };
    }

    /**
     * Delay utility
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current statistics
     */
    getStats(): LoaderStats {
        // Calculate current bandwidth
        if (this.bandwidthEstimator.length > 0) {
            this.stats.bandwidth = this.bandwidthEstimator.reduce((a, b) => a + b, 0) / this.bandwidthEstimator.length;
        }

        return { ...this.stats };
    }

    /**
     * Get cached resources
     */
    getCachedResources(): string[] {
        return Array.from(this.resourceCache.keys());
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.resourceCache.clear();
        this.stats.cacheHitRate = 0;
        console.log('[Resource Loader] Cache cleared');
    }

    /**
     * Clear specific resource from cache
     */
    clearResource(url: string): void {
        this.resourceCache.delete(url);
    }

    /**
     * Check if resource is cached
     */
    isCached(url: string): boolean {
        return this.resourceCache.has(url);
    }

    /**
     * Preload critical resources
     */
    async preloadCritical(resources: ResourceConfig[]): Promise<void> {
        const criticalResources = resources.filter(r => r.priority === 'high');
        await this.loadBundle({
            name: 'critical',
            resources: criticalResources,
            strategy: 'parallel'
        });
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.resourceCache.clear();
        this.loadingPromises.clear();
        this.loadQueue = [];
        this.observer?.disconnect();
        console.log('[Resource Loader] Destroyed');
    }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
    private permits: number;
    private waitQueue: Array<() => void> = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return;
        }

        return new Promise(resolve => {
            this.waitQueue.push(resolve);
        });
    }

    release(): void {
        this.permits++;

        if (this.waitQueue.length > 0) {
            const resolve = this.waitQueue.shift()!;
            resolve();
            this.permits--;
        }
    }
}

// Export singleton instance
export const resourceLoader = new ResourceLoader();

/**
 * Convenience function to load bundle
 */
export async function loadBundle(config: BundleConfig): Promise<LoadResult[]> {
    return resourceLoader.loadBundle(config);
}

/**
 * Convenience function to prefetch resources
 */
export async function prefetch(config: PrefetchConfig): Promise<void> {
    return resourceLoader.prefetch(config);
}