/**
 * Performance monitoring and metrics collection
 */

interface PerformanceMetric {
    duration: number;
    timestamp: number;
    success?: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

interface PerformanceReport {
    timestamp: string;
    metrics: Record<string, MetricsSummary>;
    systemInfo: SystemInfo;
    recommendations: string[];
}

interface MetricsSummary {
    count: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    successRate: number;
}

interface SystemInfo {
    userAgent: string;
    platform: string;
    memory?: {
        used: number;
        total: number;
        limit: number;
    };
    connection?: {
        effectiveType: string;
        downlink: number;
    };
}

export class PerformanceMonitor {
    private metrics: Map<string, PerformanceMetric[]> = new Map();
    private observers: PerformanceObserver[] = [];
    private enabled: boolean = true;

    constructor(enableMonitoring: boolean = true) {
        this.enabled = enableMonitoring;
        if (enableMonitoring) {
            this.setupPerformanceObservers();
            this.setupMemoryMonitoring();
        }
    }

    /**
     * Set up performance observers for browser metrics
     */
    private setupPerformanceObservers(): void {
        // Observe Long Tasks
        if ('PerformanceObserver' in window) {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.recordMetric('long-task', {
                        duration: entry.duration,
                        startTime: entry.startTime,
                        name: entry.name
                    });
                });
            });

            try {
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.push(longTaskObserver);
            } catch (error) {
                console.warn('Long task observer not supported:', error);
            }

            // Observe Navigation
            try {
                const navigationObserver = new PerformanceObserver((list) => {
                    const navigation = list.getEntries()[0] as PerformanceNavigationTiming;
                    if (navigation) {
                        this.recordMetric('navigation', {
                            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                            firstPaint: this.getFirstPaint(),
                            firstContentfulPaint: this.getFirstContentfulPaint()
                        });
                    }
                });

                navigationObserver.observe({ entryTypes: ['navigation'] });
                this.observers.push(navigationObserver);
            } catch (error) {
                console.warn('Navigation observer not supported:', error);
            }
        }
    }

    /**
     * Set up memory monitoring
     */
    private setupMemoryMonitoring(): void {
        // Monitor memory usage every 30 seconds
        setInterval(() => {
            if (this.isMemoryUsageHigh()) {
                this.recordMetric('memory-warning', {
                    duration: 0,
                    timestamp: Date.now(),
                    metadata: {
                        memoryUsage: this.getMemoryUsage()
                    }
                });
            }
        }, 30000);
    }

    /**
     * Measure operation performance with automatic tracking
     */
    async measureOperation<T>(
        name: string,
        operation: () => T | Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        if (!this.enabled) {
            return operation();
        }

        const startTime = performance.now();

        try {
            const result = await operation();
            const duration = performance.now() - startTime;

            this.recordMetric(name, {
                duration,
                success: true,
                timestamp: Date.now(),
                metadata
            });

            return result;
        } catch (error) {
            const duration = performance.now() - startTime;

            this.recordMetric(name, {
                duration,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
                metadata
            });

            throw error;
        }
    }

    /**
     * Record a metric entry
     */
    recordMetric(name: string, data: Partial<PerformanceMetric>): void {
        if (!this.enabled) return;

        const metric: PerformanceMetric = {
            duration: 0,
            timestamp: Date.now(),
            ...data
        };

        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const metricList = this.metrics.get(name)!;
        metricList.push(metric);

        // Keep only last 1000 metrics per category to prevent memory leaks
        if (metricList.length > 1000) {
            metricList.splice(0, metricList.length - 1000);
        }

        // Log slow operations
        if (metric.duration > 5000) {
            console.warn(`Slow operation detected: ${name} took ${metric.duration.toFixed(2)}ms`);
        }
    }

    /**
     * Get performance summary for a specific metric category
     */
    getMetricsSummary(category: string): MetricsSummary {
        const metrics = this.metrics.get(category) || [];

        if (metrics.length === 0) {
            return {
                count: 0,
                average: 0,
                min: 0,
                max: 0,
                p50: 0,
                p95: 0,
                p99: 0,
                successRate: 0
            };
        }

        const durations = metrics
            .filter(m => typeof m.duration === 'number')
            .map(m => m.duration)
            .sort((a, b) => a - b);

        const successCount = metrics.filter(m => m.success !== false).length;

        return {
            count: metrics.length,
            average: durations.reduce((a, b) => a + b, 0) / durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            p50: this.getPercentile(durations, 0.5),
            p95: this.getPercentile(durations, 0.95),
            p99: this.getPercentile(durations, 0.99),
            successRate: successCount / metrics.length
        };
    }

    /**
     * Generate comprehensive performance report
     */
    generateReport(): PerformanceReport {
        const report: PerformanceReport = {
            timestamp: new Date().toISOString(),
            metrics: {},
            systemInfo: this.getSystemInfo(),
            recommendations: []
        };

        // Add summaries for all metric categories
        this.metrics.forEach((_, category) => {
            report.metrics[category] = this.getMetricsSummary(category);
        });

        // Generate recommendations
        report.recommendations = this.generateRecommendations(report);

        return report;
    }

    /**
     * Generate performance recommendations based on metrics
     */
    private generateRecommendations(report: PerformanceReport): string[] {
        const recommendations: string[] = [];

        // Check processing times
        const processingMetrics = report.metrics['video-processing'];
        if (processingMetrics && processingMetrics.p95 > 60000) {
            recommendations.push('Consider optimizing video processing - 95th percentile time exceeds 60s');
        }

        // Check success rates
        Object.entries(report.metrics).forEach(([category, metrics]) => {
            if (metrics.successRate < 0.95) {
                recommendations.push(`${category} success rate below 95% (${(metrics.successRate * 100).toFixed(1)}%)`);
            }
        });

        // Check for long tasks
        const longTaskMetrics = report.metrics['long-task'];
        if (longTaskMetrics && longTaskMetrics.max > 100) {
            recommendations.push('Long blocking tasks detected - consider breaking up complex operations');
        }

        // Check memory usage
        if (this.isMemoryUsageHigh()) {
            recommendations.push('High memory usage detected - consider implementing more aggressive cleanup');
        }

        // Check navigation performance
        const navigationMetrics = report.metrics['navigation'];
        if (navigationMetrics) {
            if (navigationMetrics.average > 3000) {
                recommendations.push('Slow page load detected - consider optimizing bundle size');
            }
            if (navigationMetrics.p95 > 5000) {
                recommendations.push('Poor navigation performance for 95th percentile users');
            }
        }

        return recommendations;
    }

    /**
     * Get system information
     */
    private getSystemInfo(): SystemInfo {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : undefined,
            connection: (navigator as any).connection ? {
                effectiveType: (navigator as any).connection.effectiveType,
                downlink: (navigator as any).connection.downlink
            } : undefined
        };
    }

    /**
     * Get percentile from sorted array
     */
    private getPercentile(sortedArray: number[], percentile: number): number {
        const index = Math.ceil(sortedArray.length * percentile) - 1;
        return sortedArray[Math.max(0, index)] || 0;
    }

    /**
     * Get first paint time
     */
    private getFirstPaint(): number | null {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    /**
     * Get first contentful paint time
     */
    private getFirstContentfulPaint(): number | null {
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcp ? fcp.startTime : null;
    }

    /**
     * Check if memory usage is high
     */
    private isMemoryUsageHigh(): boolean {
        if (performance.memory) {
            const usedMemory = performance.memory.usedJSHeapSize;
            const totalMemory = performance.memory.jsHeapSizeLimit;
            const usageRatio = usedMemory / totalMemory;
            return usageRatio > 0.8; // 80% threshold
        }
        return false;
    }

    /**
     * Get current memory usage
     */
    private getMemoryUsage(): number {
        return performance.memory?.usedJSHeapSize || 0;
    }

    /**
     * Get current metrics for all categories
     */
    getAllMetrics(): Record<string, MetricsSummary> {
        const result: Record<string, MetricsSummary> = {};

        this.metrics.forEach((_, category) => {
            result[category] = this.getMetricsSummary(category);
        });

        return result;
    }

    /**
     * Enable or disable monitoring
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;

        if (!enabled) {
            // Clean up observers
            this.observers.forEach(observer => {
                observer.disconnect();
            });
            this.observers = [];
        } else {
            // Re-setup observers
            this.setupPerformanceObservers();
        }
    }

    /**
     * Clear all collected metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
    }

    /**
     * Export metrics to JSON for analysis
     */
    exportMetrics(): string {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            metrics: Object.fromEntries(this.metrics),
            systemInfo: this.getSystemInfo()
        }, null, 2);
    }

    /**
     * Cleanup method to be called when plugin unloads
     */
    destroy(): void {
        this.setEnabled(false);
        this.clearMetrics();
    }
}

// Singleton instance for global use
export const performanceMonitor = new PerformanceMonitor();

// Convenience function for measuring operations
export function measure<T>(
    name: string,
    operation: () => T | Promise<T>,
    metadata?: Record<string, any>
): Promise<T> {
    return performanceMonitor.measureOperation(name, operation, metadata);
}

// Performance decorator for automatic measurement
export function performanceTrack(options: {
    category?: string;
    logErrors?: boolean;
    includeArgs?: boolean;
} = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        const category = options.category || propertyName;

        descriptor.value = function (...args: any[]) {
            const startTime = performance.now();
            const context = `${target.constructor.name}.${propertyName}`;

            return performanceMonitor.measureOperation(category, async () => {
                const result = await method.apply(this, args);

                // Log successful operation if needed
                if (options.logErrors !== false) {
                    console.debug(`Performance: ${context} completed in ${(performance.now() - startTime).toFixed(2)}ms`);
                }

                return result;
            }, {
                operation: propertyName,
                args: options.includeArgs ? args : undefined
            });
        };

        return descriptor;
    };
}