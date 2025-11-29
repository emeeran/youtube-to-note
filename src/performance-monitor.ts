export interface PerformanceMetrics {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
    tags?: string[];
}

export interface PerformanceStats {
    totalOperations: number;
    averageResponseTime: number;
    slowestOperation: number;
    fastestOperation: number;
    errorCount: number;
    operationsPerSecond: number;
    memoryUsage?: number;
    cacheHitRate?: number;
}

export interface PerformanceAlert {
    id: string;
    type: 'threshold' | 'error_rate' | 'memory' | 'performance_degradation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: number;
    value: number;
    threshold: number;
    metadata?: Record<string, any>;
}

export interface PerformanceConfig {
    enableMetrics: boolean;
    enableTracing: boolean;
    enableProfiling: boolean;
    enableAlerts: boolean;
    maxMetricsHistory: number;
    alertThresholds: {
        responseTime: number;
        errorRate: number;
        memoryUsage: number;
        cacheHitRate: number;
    };
    samplingRate: number;
}

/**
 * Comprehensive Performance Monitoring System
 */
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private config: PerformanceConfig;
    private metrics: PerformanceMetrics[] = [];
    private stats: Map<string, PerformanceStats> = new Map();
    private activeProfiles = new Map<string, PerformanceMetrics>();
    private alerts: PerformanceAlert[] = [];
    private startTimes = new Map<string, number>();
    private memorySnapshots: number[] = [];
    private isCollecting = false;
    private collectionInterval?: number;
    private observers: PerformanceObserver[] = [];

    private constructor(config: Partial<PerformanceConfig> = {}) {
        this.config = {
            enableMetrics: true,
            enableTracing: true,
            enableProfiling: true,
            enableAlerts: true,
            maxMetricsHistory: 1000,
            alertThresholds: {
                responseTime: 5000, // 5 seconds
                errorRate: 0.05, // 5%
                memoryUsage: 100 * 1024 * 1024, // 100MB
                cacheHitRate: 0.5 // 50%
            },
            samplingRate: 1.0,
            ...config
        };

        this.initializeMonitoring();
    }

    static getInstance(config?: Partial<PerformanceConfig>): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor(config);
        }
        return PerformanceMonitor.instance;
    }

    private initializeMonitoring(): void {
        if (!this.config.enableMetrics) return;

        // Set up performance observers
        this.setupPerformanceObservers();

        // Start periodic collection
        this.startPeriodicCollection();

        // Set up memory monitoring
        this.setupMemoryMonitoring();

        console.info('📊 Performance monitoring initialized');
    }

    private setupPerformanceObservers(): void {
        if (typeof PerformanceObserver === 'undefined') return;

        try {
            // Measure API calls and other operations
            const measureObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'measure') {
                        this.recordMetric({
                            name: entry.name,
                            startTime: entry.startTime,
                            endTime: entry.startTime + entry.duration,
                            duration: entry.duration,
                            metadata: {
                                entryType: entry.entryType,
                                detail: entry.detail
                            }
                        });
                    }
                }
            });

            measureObserver.observe({ entryTypes: ['measure'] });
            this.observers.push(measureObserver);

            // Monitor resource loading
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'resource') {
                        const resourceEntry = entry as PerformanceResourceTiming;
                        this.recordMetric({
                            name: `resource-${resourceEntry.name}`,
                            startTime: resourceEntry.startTime,
                            endTime: resourceEntry.responseEnd,
                            duration: resourceEntry.responseEnd - resourceEntry.startTime,
                            metadata: {
                                type: resourceEntry.initiatorType,
                                size: resourceEntry.transferSize,
                                encodedSize: resourceEntry.encodedBodySize
                            }
                        });
                    }
                }
            });

            resourceObserver.observe({ entryTypes: ['resource'] });
            this.observers.push(resourceObserver);

        } catch (error) {
            console.warn('Performance observers not fully supported:', error);
        }
    }

    private startPeriodicCollection(): void {
        if (this.isCollecting) return;

        this.isCollecting = true;
        this.collectionInterval = window.setInterval(() => {
            this.collectSystemMetrics();
        }, 5000); // Collect every 5 seconds
    }

    private setupMemoryMonitoring(): void {
        // Store initial memory snapshot
        this.takeMemorySnapshot();

        // Monitor memory every 30 seconds
        setInterval(() => {
            this.takeMemorySnapshot();
        }, 30000);
    }

    private takeMemorySnapshot(): void {
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            const memory = (performance as any).memory;
            this.memorySnapshots.push(memory.usedJSHeapSize);

            // Keep only last 100 snapshots
            if (this.memorySnapshots.length > 100) {
                this.memorySnapshots = this.memorySnapshots.slice(-100);
            }

            // Check for memory leaks
            this.checkMemoryLeaks();

            // Check memory threshold
            if (memory.usedJSHeapSize > this.config.alertThresholds.memoryUsage) {
                this.triggerAlert({
                    type: 'memory',
                    severity: 'high',
                    message: `Memory usage (${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB) exceeds threshold`,
                    value: memory.usedJSHeapSize,
                    threshold: this.config.alertThresholds.memoryUsage
                });
            }
        }
    }

    private checkMemoryLeaks(): void {
        if (this.memorySnapshots.length < 10) return;

        const recent = this.memorySnapshots.slice(-10);
        const trend = this.calculateTrend(recent);

        if (trend > 0.1) { // 10% growth trend
            this.triggerAlert({
                type: 'memory',
                severity: 'medium',
                message: `Potential memory leak detected (${(trend * 100).toFixed(1)}% growth trend)`,
                value: trend,
                threshold: 0.1
            });
        }
    }

    private calculateTrend(values: number[]): number {
        if (values.length < 2) return 0;

        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));

        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

        return (secondAvg - firstAvg) / firstAvg;
    }

    private collectSystemMetrics(): void {
        // Update statistics for tracked operations
        this.updateStatistics();

        // Check for performance degradation
        this.checkPerformanceDegradation();
    }

    private updateStatistics(): void {
        const recentMetrics = this.metrics.slice(-100); // Last 100 operations
        const groupedMetrics = new Map<string, PerformanceMetrics[]>();

        // Group metrics by operation name
        recentMetrics.forEach(metric => {
            if (!groupedMetrics.has(metric.name)) {
                groupedMetrics.set(metric.name, []);
            }
            groupedMetrics.get(metric.name)!.push(metric);
        });

        // Calculate statistics for each operation
        groupedMetrics.forEach((ops, name) => {
            const durations = ops
                .filter(op => op.duration !== undefined)
                .map(op => op.duration!);

            if (durations.length > 0) {
                const totalOperations = ops.length;
                const averageResponseTime = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
                const slowestOperation = Math.max(...durations);
                const fastestOperation = Math.min(...durations);
                const errorCount = ops.filter(op => op.metadata?.error === true).length;
                const errorRate = errorCount / totalOperations;
                const operationsPerSecond = this.calculateOperationsPerSecond(ops);

                const currentStats = this.stats.get(name) || {
                    totalOperations: 0,
                    averageResponseTime: 0,
                    slowestOperation: 0,
                    fastestOperation: Infinity,
                    errorCount: 0,
                    operationsPerSecond: 0
                };

                this.stats.set(name, {
                    totalOperations: currentStats.totalOperations + totalOperations,
                    averageResponseTime: (currentStats.averageResponseTime + averageResponseTime) / 2,
                    slowestOperation: Math.max(currentStats.slowestOperation, slowestOperation),
                    fastestOperation: Math.min(currentStats.fastestOperation, fastestOperation),
                    errorCount: currentStats.errorCount + errorCount,
                    operationsPerSecond: operationsPerSecond,
                    memoryUsage: this.getAverageMemoryUsage(),
                    cacheHitRate: this.getCacheHitRate()
                });

                // Check alert thresholds
                if (averageResponseTime > this.config.alertThresholds.responseTime) {
                    this.triggerAlert({
                        type: 'threshold',
                        severity: 'medium',
                        message: `${name} average response time (${averageResponseTime.toFixed(2)}ms) exceeds threshold`,
                        value: averageResponseTime,
                        threshold: this.config.alertThresholds.responseTime,
                        metadata: { operation: name }
                    });
                }

                if (errorRate > this.config.alertThresholds.errorRate) {
                    this.triggerAlert({
                        type: 'error_rate',
                        severity: 'high',
                        message: `${name} error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold`,
                        value: errorRate,
                        threshold: this.config.alertThresholds.errorRate,
                        metadata: { operation: name, errorCount, totalOperations }
                    });
                }
            }
        });
    }

    private calculateOperationsPerSecond(operations: PerformanceMetrics[]): number {
        if (operations.length < 2) return 0;

        const timestamps = operations
            .map(op => op.startTime || op.endTime || 0)
            .filter(time => time > 0)
            .sort((a, b) => a - b);

        if (timestamps.length < 2) return 0;

        const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
        return timeSpan > 0 ? (operations.length / timeSpan) * 1000 : 0;
    }

    private getAverageMemoryUsage(): number {
        if (this.memorySnapshots.length === 0) return 0;
        return this.memorySnapshots.reduce((sum, size) => sum + size, 0) / this.memorySnapshots.length;
    }

    private getCacheHitRate(): number {
        // This would be implemented based on cache integration
        return 0.8; // Placeholder
    }

    private checkPerformanceDegradation(): void {
        const recentStats = Array.from(this.stats.values());

        for (const stats of recentStats) {
            const historicalStats = this.getHistoricalStats(stats.totalOperations);

            if (historicalStats && this.isPerformanceDegraded(stats, historicalStats)) {
                this.triggerAlert({
                    type: 'performance_degradation',
                    severity: 'medium',
                    message: `Performance degradation detected for operation`,
                    value: stats.averageResponseTime,
                    threshold: historicalStats.averageResponseTime * 1.5,
                    metadata: { current: stats, historical: historicalStats }
                });
            }
        }
    }

    private getHistoricalStats(currentTotalOperations: number): PerformanceStats | null {
        // Get stats from when operations were half the current count
        const halfOperations = Math.floor(currentTotalOperations / 2);

        // This would need proper historical tracking
        return null;
    }

    private isPerformanceDegraded(current: PerformanceStats, historical: PerformanceStats): boolean {
        return current.averageResponseTime > historical.averageResponseTime * 1.5;
    }

    private triggerAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
        if (!this.config.enableAlerts) return;

        const alert: PerformanceAlert = {
            id: this.generateAlertId(),
            timestamp: Date.now(),
            ...alertData
        };

        this.alerts.push(alert);

        // Keep only recent alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }

        console.warn(`🚨 Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`, {
            value: alert.value,
            threshold: alert.threshold
        });
    }

    private generateAlertId(): string {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods

    /**
     * Start measuring an operation
     */
    start(name: string, metadata?: Record<string, any>): void {
        if (!this.config.enableMetrics) return;

        const startTime = performance.now();
        this.startTimes.set(name, startTime);

        if (this.config.enableProfiling) {
            this.activeProfiles.set(name, {
                name,
                startTime,
                metadata
            });
        }
    }

    /**
     * End measuring an operation
     */
    end(name: string, metadata?: Record<string, any>, tags?: string[]): number {
        if (!this.config.enableMetrics) return 0;

        const startTime = this.startTimes.get(name);
        if (!startTime) {
            console.warn(`No start time found for operation: ${name}`);
            return 0;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        this.recordMetric({
            name,
            startTime,
            endTime,
            duration,
            metadata: { ...this.activeProfiles.get(name)?.metadata, ...metadata },
            tags
        });

        this.startTimes.delete(name);
        this.activeProfiles.delete(name);

        return duration;
    }

    /**
     * Record a custom metric
     */
    recordMetric(metric: PerformanceMetrics): void {
        if (!this.config.enableMetrics) return;

        // Apply sampling
        if (Math.random() > this.config.samplingRate) return;

        this.metrics.push(metric);

        // Keep only recent metrics
        if (this.metrics.length > this.config.maxMetricsHistory) {
            this.metrics = this.metrics.slice(-this.config.maxMetricsHistory);
        }
    }

    /**
     * Measure a function execution
     */
    async measure<T>(
        name: string,
        fn: () => Promise<T> | T,
        metadata?: Record<string, any>,
        tags?: string[]
    ): Promise<T> {
        this.start(name, metadata);

        try {
            const result = await fn();
            this.end(name, { ...metadata, success: true }, tags);
            return result;
        } catch (error) {
            this.end(name, { ...metadata, error: true, errorMessage: (error as Error).message }, tags);
            throw error;
        }
    }

    /**
     * Create a performance mark
     */
    mark(name: string): void {
        if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark(name);
        }
    }

    /**
     * Create a performance measure
     */
    measure(name: string, startMark?: string, endMark?: string): number {
        if (typeof performance !== 'undefined' && performance.measure) {
            try {
                performance.measure(name, startMark, endMark);
                return 0; // The actual duration will be captured by the observer
            } catch (error) {
                console.warn('Failed to create performance measure:', error);
                return 0;
            }
        }
        return 0;
    }

    /**
     * Get statistics for an operation
     */
    getStats(operationName?: string): PerformanceStats | Record<string, PerformanceStats> {
        if (operationName) {
            return this.stats.get(operationName) || {
                totalOperations: 0,
                averageResponseTime: 0,
                slowestOperation: 0,
                fastestOperation: 0,
                errorCount: 0,
                operationsPerSecond: 0
            };
        }

        const result: Record<string, PerformanceStats> = {};
        this.stats.forEach((stats, name) => {
            result[name] = stats;
        });
        return result;
    }

    /**
     * Get recent alerts
     */
    getAlerts(severity?: string, limit?: number): PerformanceAlert[] {
        let alerts = [...this.alerts].reverse(); // Most recent first

        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }

        if (limit) {
            alerts = alerts.slice(0, limit);
        }

        return alerts;
    }

    /**
     * Get system overview
     */
    getOverview(): {
        totalOperations: number;
        averageResponseTime: number;
        errorRate: number;
        memoryUsage: number;
        activeProfiles: number;
        recentAlerts: number;
    } {
        const allStats = Array.from(this.stats.values());
        const totalOperations = allStats.reduce((sum, stats) => sum + stats.totalOperations, 0);
        const totalErrors = allStats.reduce((sum, stats) => sum + stats.errorCount, 0);
        const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0;
        const averageResponseTime = allStats.length > 0 ?
            allStats.reduce((sum, stats) => sum + stats.averageResponseTime, 0) / allStats.length : 0;
        const recentAlerts = this.alerts.filter(alert =>
            Date.now() - alert.timestamp < 300000 // Last 5 minutes
        ).length;

        return {
            totalOperations,
            averageResponseTime,
            errorRate,
            memoryUsage: this.getAverageMemoryUsage(),
            activeProfiles: this.activeProfiles.size,
            recentAlerts
        };
    }

    /**
     * Export performance data
     */
    exportData(): {
        timestamp: number;
        metrics: PerformanceMetrics[];
        stats: Record<string, PerformanceStats>;
        alerts: PerformanceAlert[];
        memorySnapshots: number[];
        config: PerformanceConfig;
    } {
        const stats: Record<string, PerformanceStats> = {};
        this.stats.forEach((value, key) => {
            stats[key] = value;
        });

        return {
            timestamp: Date.now(),
            metrics: this.metrics,
            stats,
            alerts: this.alerts,
            memorySnapshots: this.memorySnapshots,
            config: this.config
        };
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.metrics = [];
        this.stats.clear();
        this.alerts = [];
        this.activeProfiles.clear();
        this.startTimes.clear();
        this.memorySnapshots = [];
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<PerformanceConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Enable or disable monitoring
     */
    setEnabled(enabled: boolean): void {
        this.config.enableMetrics = enabled;
        if (!enabled) {
            this.stopPeriodicCollection();
        } else {
            this.startPeriodicCollection();
        }
    }

    private stopPeriodicCollection(): void {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = undefined;
        }
        this.isCollecting = false;
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.stopPeriodicCollection();

        // Disconnect performance observers
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers = [];

        this.clear();
    }

    /**
     * Log metric for compatibility with existing code
     */
    logMetric(name: string, value: number | Record<string, any>, metadata?: Record<string, any>): void {
        if (typeof value === 'number') {
            this.recordMetric({
                name,
                startTime: Date.now(),
                endTime: Date.now(),
                duration: value,
                metadata
            });
        } else {
            this.recordMetric({
                name,
                startTime: Date.now(),
                endTime: Date.now(),
                duration: 0,
                metadata: { ...metadata, ...value }
            });
        }
    }
}

// Global performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Performance decorator for methods
export function measurePerformance(name?: string, metadata?: Record<string, any>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const metricName = name || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            return performanceMonitor.measure(metricName, () => originalMethod.apply(this, args), {
                className: target.constructor.name,
                methodName: propertyKey,
                args: args.length
            });
        };

        return descriptor;
    };
}

// Performance utility functions
export const PerformanceUtils = {
    /**
     * Create a debounced function with performance tracking
     */
    debounce<T extends (...args: any[]) => any>(
        fn: T,
        delay: number,
        name?: string
    ): T {
        let timeoutId: number;
        let lastCall = 0;

        return ((...args: Parameters<T>) => {
            const now = Date.now();
            const timeSinceLastCall = now - lastCall;

            if (timeSinceLastCall >= delay) {
                lastCall = now;
                return fn(...args);
            }

            clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                lastCall = Date.now();
                performanceMonitor.start(name || 'debounced-call');
                try {
                    return fn(...args);
                } finally {
                    performanceMonitor.end(name || 'debounced-call');
                }
            }, delay - timeSinceLastCall);
        }) as T;
    },

    /**
     * Create a throttled function with performance tracking
     */
    throttle<T extends (...args: any[]) => any>(
        fn: T,
        limit: number,
        name?: string
    ): T {
        let inThrottle = false;

        return ((...args: Parameters<T>) => {
            if (!inThrottle) {
                inThrottle = true;
                performanceMonitor.start(name || 'throttled-call');
                try {
                    const result = fn(...args);
                    performanceMonitor.end(name || 'throttled-call');
                    return result;
                } finally {
                    setTimeout(() => {
                        inThrottle = false;
                    }, limit);
                }
            }
        }) as T;
    },

    /**
     * Measure render performance
     */
    measureRender(componentName: string, renderFn: () => void | Promise<void>): void | Promise<void> {
        return performanceMonitor.measure(`render-${componentName}`, renderFn, {
            type: 'render',
            component: componentName
        });
    }
};