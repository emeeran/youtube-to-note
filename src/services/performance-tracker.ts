import { performanceMonitor } from '../utils/performance-monitor';

/**
 * Centralized performance tracking service for the YouTube Clipper plugin
 * Integrates with all service performance metrics and provides unified reporting
 */

export interface ServicePerformanceMetrics {
    service: string;
    operation: string;
    duration: number;
    success: boolean;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface PluginPerformanceReport {
    timestamp: string;
    uptime: number;
    services: Record<string, {
        totalOperations: number;
        averageResponseTime: number;
        successRate: number;
        errorCount: number;
        slowestOperation: {
            name: string;
            duration: number;
        };
        fastestOperation: {
            name: string;
            duration: number;
        };
    }>;
    systemMetrics: {
        memoryUsage?: number;
        cacheHitRate?: number;
        httpMetrics?: any;
    };
    recommendations: string[];
}

export class PerformanceTracker {
    private startTime: number = Date.now();
    private serviceMetrics: Map<string, ServicePerformanceMetrics[]> = new Map();
    private isEnabled: boolean = true;

    constructor(enabled: boolean = true) {
        this.isEnabled = enabled;
    }

    /**
     * Track a service operation
     */
    trackOperation(
        service: string,
        operation: string,
        duration: number,
        success: boolean = true,
        metadata?: Record<string, any>
    ): void {
        if (!this.isEnabled) return;

        const metric: ServicePerformanceMetrics = {
            service,
            operation,
            duration,
            success,
            timestamp: Date.now(),
            metadata
        };

        if (!this.serviceMetrics.has(service)) {
            this.serviceMetrics.set(service, []);
        }

        const metrics = this.serviceMetrics.get(service)!;
        metrics.push(metric);

        // Keep only last 1000 metrics per service to prevent memory leaks
        if (metrics.length > 1000) {
            metrics.splice(0, metrics.length - 1000);
        }

        // Log slow operations
        if (duration > 10000) { // 10 seconds
            console.warn(`Slow operation detected: ${service}.${operation} took ${duration.toFixed(2)}ms`);
        }
    }

    /**
     * Track an operation with automatic timing
     */
    async measureOperation<T>(
        service: string,
        operation: string,
        fn: () => T | Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        if (!this.isEnabled) {
            return fn();
        }

        const startTime = performance.now();
        const success = { value: true };

        try {
            const result = await fn();
            success.value = true;
            return result;
        } catch (error) {
            success.value = false;
            throw error;
        } finally {
            const duration = performance.now() - startTime;
            this.trackOperation(service, operation, duration, success.value, metadata);
        }
    }

    /**
     * Get metrics for a specific service
     */
    getServiceMetrics(service: string): ServicePerformanceMetrics[] {
        return this.serviceMetrics.get(service) || [];
    }

    /**
     * Generate comprehensive performance report
     */
    generateReport(): PluginPerformanceReport {
        const report: PluginPerformanceReport = {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            services: {},
            systemMetrics: {},
            recommendations: []
        };

        // Process service metrics
        this.serviceMetrics.forEach((metrics, serviceName) => {
            if (metrics.length === 0) return;

            const successfulOps = metrics.filter(m => m.success);
            const failedOps = metrics.filter(m => !m.success);
            const durations = metrics.map(m => m.duration);

            const serviceStats = {
                totalOperations: metrics.length,
                averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
                successRate: successfulOps.length / metrics.length,
                errorCount: failedOps.length,
                slowestOperation: this.findExtremeOperation(metrics, 'slowest'),
                fastestOperation: this.findExtremeOperation(metrics, 'fastest')
            };

            report.services[serviceName] = serviceStats;
        });

        // Add system metrics from performance monitor
        report.systemMetrics = {
            memoryUsage: this.getMemoryUsage(),
            cacheHitRate: this.getCacheHitRate(),
            httpMetrics: this.getHTTPMetrics()
        };

        // Generate recommendations
        report.recommendations = this.generateRecommendations(report);

        return report;
    }

    /**
     * Find extreme operation (slowest or fastest)
     */
    private findExtremeOperation(
        metrics: ServicePerformanceMetrics[],
        type: 'slowest' | 'fastest'
    ): { name: string; duration: number } {
        if (metrics.length === 0) {
            return { name: 'none', duration: 0 };
        }

        const sorted = [...metrics].sort((a, b) =>
            type === 'slowest' ? b.duration - a.duration : a.duration - b.duration
        );

        const extreme = sorted[0];
        return {
            name: `${extreme.operation}${extreme.metadata ? ` (${JSON.stringify(extreme.metadata)})` : ''}`,
            duration: extreme.duration
        };
    }

    /**
     * Get current memory usage
     */
    private getMemoryUsage(): number | undefined {
        if (performance.memory) {
            return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024); // MB
        }
        return undefined;
    }

    /**
     * Get cache hit rate from services that support it
     */
    private getCacheHitRate(): number | undefined {
        // This would need to be implemented by getting metrics from cache service
        // For now, return undefined
        return undefined;
    }

    /**
     * Get HTTP metrics from services that support it
     */
    private getHTTPMetrics(): any {
        // This would need to be implemented by aggregating metrics from HTTP clients
        // For now, return undefined
        return undefined;
    }

    /**
     * Generate performance recommendations
     */
    private generateRecommendations(report: PluginPerformanceReport): string[] {
        const recommendations: string[] = [];

        // Check response times
        Object.entries(report.services).forEach(([service, stats]) => {
            if (stats.averageResponseTime > 5000) {
                recommendations.push(`${service} average response time exceeds 5 seconds (${stats.averageResponseTime.toFixed(0)}ms)`);
            }

            if (stats.successRate < 0.95) {
                recommendations.push(`${service} success rate below 95% (${(stats.successRate * 100).toFixed(1)}%)`);
            }

            if (stats.errorCount > stats.totalOperations * 0.1) {
                recommendations.push(`${service} error rate is high (${stats.errorCount}/${stats.totalOperations})`);
            }
        });

        // Check memory usage
        if (report.systemMetrics.memoryUsage && report.systemMetrics.memoryUsage > 100) {
            recommendations.push('High memory usage detected - consider implementing more aggressive cleanup');
        }

        // Check uptime
        if (report.uptime > 24 * 60 * 60 * 1000) { // 24 hours
            recommendations.push('Plugin has been running for over 24 hours - consider restarting Obsidian');
        }

        return recommendations;
    }

    /**
     * Export metrics for analysis
     */
    exportMetrics(): string {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            services: Object.fromEntries(this.serviceMetrics),
            systemInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                memory: performance.memory ? {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                } : undefined
            }
        }, null, 2);
    }

    /**
     * Clear all collected metrics
     */
    clearMetrics(): void {
        this.serviceMetrics.clear();
    }

    /**
     * Enable or disable performance tracking
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Check if performance tracking is enabled
     */
    isTrackingEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Get uptime in human-readable format
     */
    getUptime(): string {
        const uptime = Date.now() - this.startTime;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// Global instance for use across the plugin
export const performanceTracker = new PerformanceTracker();