/**
 * Performance Integration Layer
 * Demonstrates how all optimization components work together
 */

import { performanceMonitor, performanceTrack } from '../utils/performance-monitor';
import { performanceTracker } from '../services/performance-tracker';
import { OptimizedHttpClient } from '../utils/http-client';
import { EnhancedCacheService } from '../services/cache/enhanced-cache';
import { imageOptimizer } from '../utils/image-optimizer';
import { resourceLoader, loadBundle } from '../utils/resource-loader';
import { pwaManager } from '../workers/pwa-manager';
import { backgroundSync } from '../services/sync/background-sync';

/**
 * Performance Integration Manager
 * Orchestrates all optimization components
 */
export class PerformanceIntegration {
    private httpClient: OptimizedHttpClient;
    private cacheService: EnhancedCacheService;
    private isInitialized = false;

    constructor() {
        this.httpClient = new OptimizedHttpClient({
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            maxConcurrent: 5,
            keepAlive: true,
            enableMetrics: true
        });

        this.cacheService = new EnhancedCacheService({
            maxSize: 500,
            maxMemory: 25 * 1024 * 1024, // 25MB
            enableMetrics: true,
            evictionPolicy: 'adaptive'
        });
    }

    /**
     * Initialize all performance components
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        const initResult = await performanceMonitor.measureOperation('performance-integration', async () => {
            // Initialize PWA features
            await pwaManager.initialize();

            // Initialize background sync
            await backgroundSync.initialize();

            // Preload critical resources
            await this.preloadCriticalResources();

            // Setup performance monitoring
            this.setupPerformanceMonitoring();

            // Setup offline support
            this.setupOfflineSupport();

            console.log('[Performance Integration] All components initialized');
        });

        this.isInitialized = true;
        return initResult;
    }

    /**
     * Optimized YouTube video processing with all enhancements
     */
    @performanceTrack({ category: 'video-processing' })
    async processVideoWithOptimizations(videoUrl: string): Promise<any> {
        return await performanceMonitor.measureOperation('process-video', async () => {
            // Step 1: Check cache first
            const cacheKey = `video-${videoUrl}`;
            let videoData = await this.cacheService.get(cacheKey);

            if (videoData) {
                performanceTracker.trackOperation(
                    'VideoProcessor',
                    'processVideo',
                    0,
                    true,
                    { source: 'cache', videoUrl }
                );
                return videoData;
            }

            // Step 2: Fetch video metadata with optimized HTTP client
            const metadata = await this.httpClient.get(
                `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
            );

            if (!metadata.ok) {
                throw new Error(`Failed to fetch video metadata: ${metadata.status}`);
            }

            const metadataData = await metadata.json();

            // Step 3: Process with AI (mock implementation)
            const aiResult = await this.processWithAI(metadataData);

            // Step 4: Cache results
            const resultData = {
                metadata: metadataData,
                aiResult,
                processedAt: Date.now()
            };

            await this.cacheService.set(cacheKey, resultData, 30 * 60 * 1000, {
                priority: 'high',
                tags: ['video', 'processed'],
                dependencies: ['metadata', 'ai-result']
            });

            // Step 5: Add to background sync for offline support
            if (!navigator.onLine) {
                backgroundSync.addOperation({
                    type: 'create',
                    entityType: 'video',
                    data: resultData,
                    priority: 'medium'
                });
            }

            performanceTracker.trackOperation(
                'VideoProcessor',
                'processVideo',
                Date.now(),
                true,
                { source: 'network', videoUrl }
            );

            return resultData;
        }, { videoUrl });
    }

    /**
     * Process with AI using optimized communication
     */
    private async processWithAI(metadata: any): Promise<any> {
        return await performanceMonitor.measureOperation('ai-processing', async () => {
            // Simulate AI processing
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

            return {
                summary: 'AI-generated summary of the video',
                keyPoints: ['Point 1', 'Point 2', 'Point 3'],
                duration: metadata.length || 'Unknown',
                processedAt: Date.now()
            };
        }, { metadata });
    }

    /**
     * Optimize and process images
     */
    async optimizeImages(files: File[]): Promise<any[]> {
        return await performanceMonitor.measureOperation('batch-image-optimization', async () => {
            // Validate images first
            const validImages = await Promise.all(
                files.map(file => imageOptimizer.validateImage(file))
            );

            const validFiles = files.filter((_, index) => validImages[index]);

            // Process images in parallel with worker pool
            const results = await imageOptimizer.optimizeImages(validFiles, {
                maxWidth: 1920,
                maxHeight: 1080,
                quality: 85,
                format: 'auto',
                generateThumbnails: true,
                thumbnailSizes: [150, 300, 600]
            });

            // Cache optimized images
            for (const result of results) {
                await this.cacheService.set(`image-${result.info.dimensions.width}x${result.info.dimensions.height}`, result.blob, 24 * 60 * 60 * 1000, {
                    priority: 'medium',
                    tags: ['image', 'optimized'],
                    size: result.info.optimizedSize
                });
            }

            return results;
        }, {
            fileCount: files.length,
            validCount: validFiles.length
        });
    }

    /**
     * Load resources with intelligent bundling
     */
    async loadAppResources(): Promise<void> {
        return await performanceMonitor.measureOperation('load-app-resources', async () => {
            // Define resource bundles
            const criticalBundle = {
                name: 'critical',
                resources: [
                    {
                        url: '/styles/main.css',
                        type: 'style' as const,
                        priority: 'high' as const,
                        cacheable: true,
                        preload: true
                    },
                    {
                        url: '/scripts/main.js',
                        type: 'script' as const,
                        priority: 'high' as const,
                        cacheable: true,
                        preload: true
                    }
                ],
                strategy: 'parallel' as const,
                maxConcurrency: 5
            };

            const assetBundle = {
                name: 'assets',
                resources: [
                    {
                        url: '/icons/icon-192.png',
                        type: 'image' as const,
                        priority: 'medium' as const,
                        cacheable: true
                    },
                    {
                        url: '/fonts/main.woff2',
                        type: 'font' as const,
                        priority: 'medium' as const,
                        cacheable: true
                    }
                ],
                strategy: 'waterfall' as const
            };

            // Load bundles
            await Promise.all([
                loadBundle(criticalBundle),
                loadBundle(assetBundle)
            ]);

            // Prefetch secondary resources
            await resourceLoader.prefetch({
                resources: [
                    {
                        url: '/api/models',
                        type: 'json' as const,
                        priority: 'low' as const
                    }
                ],
                whenIdle: true,
                timeout: 5000
            });
        });
    }

    /**
     * Preload critical resources
     */
    private async preloadCriticalResources(): Promise<void> {
        await resourceLoader.preloadCritical([
            {
                url: '/styles/optimized.css',
                type: 'style',
                priority: 'high',
                cacheable: true
            },
            {
                url: '/scripts/bundle.js',
                type: 'script',
                priority: 'high',
                cacheable: true
            }
        ]);
    }

    /**
     * Setup performance monitoring
     */
    private setupPerformanceMonitoring(): void {
        // Monitor cache performance
        setInterval(async () => {
            const cacheStats = await this.cacheService.getStats();
            const httpMetrics = this.httpClient.getMetrics();

            if (cacheStats.hitRate < 0.7) {
                console.warn('[Performance Integration] Low cache hit rate:', cacheStats.hitRate);
            }

            if (httpMetrics.averageResponseTime > 5000) {
                console.warn('[Performance Integration] High response time:', httpMetrics.averageResponseTime);
            }
        }, 30000); // Check every 30 seconds

        // Monitor memory usage
        setInterval(() => {
            if (performance.memory) {
                const usage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
                if (usage > 100) { // 100MB threshold
                    console.warn('[Performance Integration] High memory usage:', usage.toFixed(2), 'MB');
                }
            }
        }, 60000); // Check every minute
    }

    /**
     * Setup offline support
     */
    private setupOfflineSupport(): void {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('[Performance Integration] Back online - processing queue');
            backgroundSync.forceSync();
        });

        window.addEventListener('offline', () => {
            console.log('[Performance Integration] Offline - queueing operations');
        });

        // Setup service worker messages
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'CACHE_UPDATED') {
                    console.log('[Performance Integration] Cache updated:', event.data.keys);
                }
            });
        }
    }

    /**
     * Get comprehensive performance metrics
     */
    async getPerformanceMetrics(): Promise<any> {
        const [cacheStats, httpMetrics, pwaStats, trackerStats, backgroundStats] = await Promise.all([
            this.cacheService.getStats(),
            Promise.resolve(this.httpClient.getMetrics()),
            pwaManager.getMetrics(),
            Promise.resolve(performanceTracker.generateReport()),
            backgroundSync.getStats()
        ]);

        const resourceStats = resourceLoader.getStats();

        return {
            cache: {
                ...cacheStats,
                efficiency: cacheStats.memoryUsage / (cacheStats.entries * 1000) // KB per entry
            },
            network: {
                ...httpMetrics,
                averageBandwidth: resourceStats.bandwidth
            },
            pwa: {
                ...pwaStats,
                offline: !navigator.onLine
            },
            application: {
                ...trackerStats,
                uptime: performanceTracker.getUptime()
            },
            backgroundSync: backgroundStats,
            resources: resourceStats,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }

    /**
     * Generate performance recommendations
     */
    async generateRecommendations(): Promise<string[]> {
        const metrics = await this.getPerformanceMetrics();
        const recommendations: string[] = [];

        // Cache recommendations
        if (metrics.cache.hitRate < 0.8) {
            recommendations.push('Increase cache TTL for frequently accessed resources');
        }

        if (metrics.cache.evictionRate > 0.1) {
            recommendations.push('Consider increasing cache size to reduce evictions');
        }

        // Network recommendations
        if (metrics.network.averageResponseTime > 3000) {
            recommendations.push('Consider using faster API endpoints or reducing payload sizes');
        }

        if (metrics.network.errorRate > 0.05) {
            recommendations.push('Improve error handling and retry logic for network requests');
        }

        // Memory recommendations
        if (metrics.memory && metrics.memory.used / metrics.memory.limit > 0.8) {
            recommendations.push('Implement more aggressive cleanup to prevent memory leaks');
        }

        // PWA recommendations
        if (!metrics.pwa.serviceWorkerActive) {
            recommendations.push('Service worker is not active - offline features disabled');
        }

        // Background sync recommendations
        if (metrics.backgroundSync.pendingOperations > 10) {
            recommendations.push('Large number of pending sync operations - check network connectivity');
        }

        // Resource loading recommendations
        if (metrics.resources.averageLoadTime > 1000) {
            recommendations.push('Consider optimizing resources or enabling better caching');
        }

        return recommendations;
    }

    /**
     * Cleanup all performance components
     */
    async destroy(): Promise<void> {
        // Cleanup individual components
        this.httpClient.cleanup();
        await this.cacheService.destroy();
        imageOptimizer.destroy();
        resourceLoader.destroy();
        pwaManager.destroy();
        await backgroundSync.destroy();

        // Clear performance monitors
        performanceMonitor.clearMetrics();
        performanceTracker.clearMetrics();

        console.log('[Performance Integration] All components destroyed');
    }

    /**
     * Export performance data for analysis
     */
    async exportPerformanceData(): Promise<string> {
        const metrics = await this.getPerformanceMetrics();
        const recommendations = await this.generateRecommendations();

        const exportData = {
            timestamp: new Date().toISOString(),
            metrics,
            recommendations,
            version: '1.0.0'
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Load performance report from cache
     */
    async loadPerformanceReport(): Promise<any> {
        const report = await this.cacheService.get('performance-report');
        if (report) {
            return report;
        }

        // Generate fresh report if not cached
        const freshReport = await this.getPerformanceMetrics();
        await this.cacheService.set('performance-report', freshReport, 5 * 60 * 1000); // 5 minutes
        return freshReport;
    }
}

// Export singleton instance
export const performanceIntegration = new PerformanceIntegration();

/**
 * Convenience function to process video with all optimizations
 */
export async function processVideo(videoUrl: string): Promise<any> {
    return performanceIntegration.processVideoWithOptimizations(videoUrl);
}

/**
 * Convenience function to optimize images
 */
export async function optimizeImages(files: File[]): Promise<any[]> {
    return performanceIntegration.optimizeImages(files);
}

/**
 * Convenience function to get performance metrics
 */
export async function getPerformanceMetrics(): Promise<any> {
    return performanceIntegration.getPerformanceMetrics();
}