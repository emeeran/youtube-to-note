
/**
 * Performance monitoring service for tracking plugin performance
 */

export interface PerformanceMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, unknown>;
    success?: boolean;
    error?: string;
}

export interface PerformanceStats {
    operationName: string;
    count: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    errorCount: number;
    lastExecution?: Date;
}

export interface PerformanceThresholds {
    warning: number;
    critical: number;
}

export interface PerformanceConfig {
    enabled: boolean;
    maxMetrics: number;
    thresholds: Record<string, PerformanceThresholds>;
    autoCleanup: boolean;
    cleanupInterval: number;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: PerformanceMetric[] = [];
    private config: PerformanceConfig;

    private constructor(config: Partial<PerformanceConfig> = {}) {
        this.config = {
            enabled: true,
            maxMetrics: 1000,
            thresholds: {
                'video-processing': { warning: 30000, critical: 60000 }, // 30s/60s
                'ai-processing': { warning: 15000, critical: 30000 }, // 15s/30s
                'file-operations': { warning: 5000, critical: 10000 }, // 5s/10s
                'modal-operations': { warning: 1000, critical: 3000 }, // 1s/3s
                'url-detection': { warning: 2000, critical: 5000 }, // 2s/5s
                'api-calls': { warning: 5000, critical: 15000 } // 5s/15s
            },
            autoCleanup: true,
            cleanupInterval: 300000, // 5 minutes
            ...config
        };

        if (this.config.autoCleanup) {
            this.startAutoCleanup();
        }
    }

    public static getInstance(config?: Partial<PerformanceConfig>): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor(config);
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Start measuring an operation
     */
    public startMeasurement(name: string, metadata?: Record<string, unknown>): string {
        if (!this.config.enabled) {
            return '';
        }

        const id = Math.random().toString(36).substring(2, 15);
        const metric: PerformanceMetric = {
            name,
            startTime: performance.now(),
            metadata
        };

        this.metrics.push(metric);

        return id;
    }

    /**
     * End measuring an operation
     */
    public endMeasurement(
        id: string,
        success: boolean = true,
        error?: string,
        additionalMetadata?: Record<string, unknown>
    ): void {
        if (!this.config.enabled || !id) {
            return;
        }

        const metric = this.metrics.find(m =>
            m.name === id || (m.startTime && !m.endTime)
        );

        if (!metric) {
            return;
        }

        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;
        metric.success = success;
        metric.error = error;

        if (additionalMetadata) {
            metric.metadata = { ...metric.metadata, ...additionalMetadata };
        }

        this.checkThresholds(metric);
        this.cleanupIfNeeded();
    }

    /**
     * Measure an operation automatically
     */
    public async measureOperation<T>(
        name: string,
        operation: () => Promise<T>,
        metadata?: Record<string, unknown>
    ): Promise<T> {
        const id = this.startMeasurement(name, metadata);

        try {
            const result = await operation();
            this.endMeasurement(id, true);
            return result;
        } catch (error) {
            this.endMeasurement(
                id,
                false,
                error instanceof Error ? error.message : String(error)
            );
            throw error;
        }
    }

    /**
     * Measure a synchronous operation
     */
    public measureSync<T>(
        name: string,
        operation: () => T,
        metadata?: Record<string, unknown>
    ): T {
        const id = this.startMeasurement(name, metadata);

        try {
            const result = operation();
            this.endMeasurement(id, true);
            return result;
        } catch (error) {
            this.endMeasurement(
                id,
                false,
                error instanceof Error ? error.message : String(error)
            );
            throw error;
        }
    }

    /**
     * Get performance statistics for an operation
     */
    public getStats(operationName: string): PerformanceStats | null {
        const operationMetrics = this.metrics.filter(m => m.name === operationName && m.duration);

        if (operationMetrics.length === 0) {
            return null;
        }

        const durations = operationMetrics.map(m => m.duration!);
        const successCount = operationMetrics.filter(m => m.success !== false).length;
        const errorCount = operationMetrics.length - successCount;

        return {
            operationName,
            count: operationMetrics.length,
            totalDuration: durations.reduce((sum, duration) => sum + duration, 0),
            averageDuration: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            successRate: (successCount / operationMetrics.length) * 100,
            errorCount,
            lastExecution: new Date(Math.max(...operationMetrics.map(m => m.startTime)))
        };
    }

    /**
     * Get all performance statistics
     */
    public getAllStats(): Record<string, PerformanceStats> {
        const operationNames = [...new Set(this.metrics.map(m => m.name))];
        const stats: Record<string, PerformanceStats> = {};

        for (const name of operationNames) {
            const stat = this.getStats(name);
            if (stat) {
                stats[name] = stat;
            }
        }

        return stats;
    }

    /**
     * Get recent metrics
     */
    public getRecentMetrics(limit: number = 50): PerformanceMetric[] {
        return this.metrics
            .filter(m => m.endTime)
            .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
            .slice(0, limit);
    }

    /**
     * Check if performance thresholds are exceeded
     */
    private checkThresholds(metric: PerformanceMetric): void {
        if (!metric.duration || !metric.name) {
            return;
        }

        const threshold = this.config.thresholds[metric.name];
        if (!threshold) {
            return;
        }

        if (metric.duration > threshold.critical) {
            
`, metric);
        } else if (metric.duration > threshold.warning) {
            
`, metric);
        }
    }

    /**
     * Clean up old metrics if needed
     */
    private cleanupIfNeeded(): void {
        if (this.metrics.length > this.config.maxMetrics) {
            // Remove oldest metrics
            const toRemove = this.metrics.length - this.config.maxMetrics;
            this.metrics = this.metrics
                .sort((a, b) => a.startTime - b.startTime)
                .slice(toRemove);
        }
    }

    /**
     * Start automatic cleanup interval
     */
    private startAutoCleanup(): void {
        setInterval(() => {
            this.cleanupOldMetrics();
        }, this.config.cleanupInterval);
    }

    /**
     * Clean up metrics older than 1 hour
     */
    private cleanupOldMetrics(): void {
        const oneHourAgo = Date.now() - 3600000; // 1 hour in ms
        const initialCount = this.metrics.length;

        this.metrics = this.metrics.filter(m => m.startTime > oneHourAgo);

        const removed = initialCount - this.metrics.length;
        if (removed > 0) {
            
}
    }

    /**
     * Clear all metrics
     */
    public clearMetrics(): void {
        this.metrics = [];
    }

    /**
     * Get performance summary
     */
    public getSummary(): {
        totalMetrics: number;
        operationCount: number;
        averageOperationTime: number;
        slowestOperation: string;
        fastestOperation: string;
        errorRate: number;
    } {
        const allStats = this.getAllStats();
        const operationNames = Object.keys(allStats);

        if (operationNames.length === 0) {
            return {
                totalMetrics: 0,
                operationCount: 0,
                averageOperationTime: 0,
                slowestOperation: '',
                fastestOperation: '',
                errorRate: 0
            };
        }

        const totalMetrics = this.metrics.length;
        const allDurations = this.metrics
            .filter(m => m.duration)
            .map(m => m.duration!);

        const averageOperationTime = allDurations.length > 0
            ? allDurations.reduce((sum, duration) => sum + duration, 0) / allDurations.length
            : 0;

        const slowestOperation = operationNames.reduce((slowest, name) => {
            const stat = allStats[name];
            const slowestStat = slowest ? allStats[slowest] : undefined;
            return stat && stat.maxDuration > (slowestStat?.maxDuration || 0) ? name : slowest;
        }, operationNames[0]!);

        const fastestOperation = operationNames.reduce((fastest, name) => {
            const stat = allStats[name];
            const fastestStat = fastest ? allStats[fastest] : undefined;
            return stat && stat.averageDuration < (fastestStat?.averageDuration || Infinity) ? name : fastest;
        }, operationNames[0]!);

        const totalOperations = Object.values(allStats).reduce((sum, stat) => sum + stat.count, 0);
        const totalErrors = Object.values(allStats).reduce((sum, stat) => sum + stat.errorCount, 0);
        const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

        return {
            totalMetrics,
            operationCount: totalOperations,
            averageOperationTime,
            slowestOperation,
            fastestOperation,
            errorRate
        };
    }

    /**
     * Export performance data
     */
    public exportData(): {
        timestamp: string;
        config: PerformanceConfig;
        summary: ReturnType<PerformanceMonitor['getSummary']>;
        stats: Record<string, PerformanceStats>;
        recentMetrics: PerformanceMetric[];
    } {
        return {
            timestamp: new Date().toISOString(),
            config: this.config,
            summary: this.getSummary(),
            stats: this.getAllStats(),
            recentMetrics: this.getRecentMetrics(100)
        };
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<PerformanceConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Check if performance monitoring is enabled
     */
    public isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Enable or disable performance monitoring
     */
    public setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }
}

// Convenience decorator for measuring methods
export function measurePerformance(name?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const monitor = PerformanceMonitor.getInstance();

        descriptor.value = async function (...args: unknown[]) {
            const operationName = name || `${target.constructor.name}.${propertyKey}`;
            return monitor.measureOperation(
                operationName,
                () => originalMethod.apply(this, args),
                { args: args.length }
            );
        };

        return descriptor;
    };
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();