import { EncryptionService } from './encryption-service';
import { logger } from './logger';
import { performanceMonitor } from './performance-monitor';
import { YouTubePluginSettings } from '../types';

/**
 * Simple optimization service for plugin performance and health checks
 */


export interface OptimizationResult {
    category: 'performance' | 'security' | 'quality';
    status: 'optimal' | 'warning' | 'critical';
    message: string;
    recommendation?: string;
    metrics?: Record<string, unknown>;
}

export interface HealthCheckResult {
    overall: 'healthy' | 'warning' | 'critical';
    issues: OptimizationResult[];
    recommendations: string[];
    score: number; // 0-100
}

export class OptimizationService {
    private static readonly OPTIMAL_SCORE = 90;
    private static readonly WARNING_SCORE = 70;

    /**
     * Run a comprehensive health check
     */
    static async runHealthCheck(settings: YouTubePluginSettings): Promise<HealthCheckResult> {
        logger.info('Running plugin health check', 'OptimizationService');

        const issues: OptimizationResult[] = [];

        // Performance checks
        issues.push(...await this.checkPerformance());

        // Security checks
        issues.push(...await this.checkSecurity(settings));

        // Quality checks
        issues.push(...await this.checkQuality());

        // Calculate overall score and status
        const criticalCount = issues.filter(i => i.status === 'critical').length;
        const warningCount = issues.filter(i => i.status === 'warning').length;

        let score = 100;
        score -= criticalCount * 25; // Critical issues reduce score more
        score -= warningCount * 10;  // Warning issues reduce score less
        score = Math.max(0, score);

        let overall: 'healthy' | 'warning' | 'critical';
        if (criticalCount > 0) {
            overall = 'critical';
        } else if (warningCount > 0 || score < this.WARNING_SCORE) {
            overall = 'warning';
        } else {
            overall = 'healthy';
        }

        const recommendations = issues
            .filter(i => i.recommendation)
            .map(i => i.recommendation!);

        const result: HealthCheckResult = {
            overall,
            issues,
            recommendations,
            score
        };

        logger.info('Health check completed', 'OptimizationService', {
            overall,
            score,
            issueCount: issues.length
        });

        return result;
    }

    /**
     * Check performance-related metrics
     */
    private static async checkPerformance(): Promise<OptimizationResult[]> {
        const issues: OptimizationResult[] = [];
        const summary = performanceMonitor.getSummary();

        // Check average operation time
        if (summary.averageOperationTime > 10000) { // 10 seconds
            issues.push({
                category: 'performance',
                status: 'critical',
                message: `Average operation time is high: ${Math.round(summary.averageOperationTime)}ms`,
                recommendation: 'Consider using faster AI models or enabling parallel processing',
                metrics: { averageTime: summary.averageOperationTime }
            });
        } else if (summary.averageOperationTime > 5000) { // 5 seconds
            issues.push({
                category: 'performance',
                status: 'warning',
                message: `Average operation time is elevated: ${Math.round(summary.averageOperationTime)}ms`,
                recommendation: 'Monitor performance and consider optimization options',
                metrics: { averageTime: summary.averageOperationTime }
            });
        }

        // Check error rate
        if (summary.errorRate > 20) {
            issues.push({
                category: 'performance',
                status: 'critical',
                message: `High error rate: ${Math.round(summary.errorRate)}%`,
                recommendation: 'Check API keys, network connectivity, and rate limits',
                metrics: { errorRate: summary.errorRate }
            });
        } else if (summary.errorRate > 5) {
            issues.push({
                category: 'performance',
                status: 'warning',
                message: `Elevated error rate: ${Math.round(summary.errorRate)}%`,
                recommendation: 'Monitor for recurring errors and check retry logic',
                metrics: { errorRate: summary.errorRate }
            });
        }

        // Check slowest operation
        if (summary.slowestOperation && summary.averageOperationTime > 15000) {
            issues.push({
                category: 'performance',
                status: 'warning',
                message: `Slowest operation: ${summary.slowestOperation}`,
                recommendation: 'Consider optimizing the slowest operation or breaking it into smaller parts',
                metrics: { slowestOperation: summary.slowestOperation }
            });
        }

        return issues;
    }

    /**
     * Check security-related aspects
     */
    private static async checkSecurity(settings: YouTubePluginSettings): Promise<OptimizationResult[]> {
        const issues: OptimizationResult[] = [];
        const encryptionInfo = EncryptionService.getEncryptionInfo();

        // Check encryption support
        if (!encryptionInfo.isSupported) {
            issues.push({
                category: 'security',
                status: 'critical',
                message: 'Encryption not supported in this environment',
                recommendation: 'Update to a modern browser with Web Crypto API support'
            });
        }

        // Check for unencrypted API keys
        const hasUnencryptedGeminiKey = settings.geminiApiKey && !EncryptionService.isEncrypted(settings.geminiApiKey);
        const hasUnencryptedGroqKey = settings.groqApiKey && !EncryptionService.isEncrypted(settings.groqApiKey);

        if (hasUnencryptedGeminiKey || hasUnencryptedGroqKey) {
            issues.push({
                category: 'security',
                status: 'warning',
                message: 'API keys are stored without encryption',
                recommendation: 'Enable encryption for API keys in settings',
                metrics: {
                    hasGeminiKey: !!settings.geminiApiKey,
                    hasGroqKey: !!settings.groqApiKey,
                    geminiEncrypted: EncryptionService.isEncrypted(settings.geminiApiKey || ''),
                    groqEncrypted: EncryptionService.isEncrypted(settings.groqApiKey || '')
                }
            });
        }

        // Check API key format
        if (settings.geminiApiKey && settings.geminiApiKey.length < 10) {
            issues.push({
                category: 'security',
                status: 'critical',
                message: 'Gemini API key appears invalid (too short)',
                recommendation: 'Verify your Gemini API key configuration'
            });
        }

        if (settings.groqApiKey && settings.groqApiKey.length < 10) {
            issues.push({
                category: 'security',
                status: 'critical',
                message: 'Groq API key appears invalid (too short)',
                recommendation: 'Verify your Groq API key configuration'
            });
        }

        // Check output path security
        if (settings.outputPath && (settings.outputPath.includes('..') || settings.outputPath.startsWith('/'))) {
            issues.push({
                category: 'security',
                status: 'warning',
                message: 'Output path may be unsafe',
                recommendation: 'Use a relative path within your vault for security'
            });
        }

        return issues;
    }

    /**
     * Check code quality aspects
     */
    private static async checkQuality(): Promise<OptimizationResult[]> {
        const issues: OptimizationResult[] = [];

        // Check if performance monitoring is enabled
        if (!performanceMonitor.isEnabled()) {
            issues.push({
                category: 'quality',
                status: 'warning',
                message: 'Performance monitoring is disabled',
                recommendation: 'Enable performance monitoring to track plugin health'
            });
        }

        // Check if there are any metrics
        const summary = performanceMonitor.getSummary();
        if (summary.operationCount === 0) {
            issues.push({
                category: 'quality',
                status: 'warning',
                message: 'No performance data available',
                recommendation: 'Use the plugin to generate performance metrics'
            });
        }

        return issues;
    }

    /**
     * Get optimization recommendations based on current usage patterns
     */
    static async getRecommendations(settings: YouTubePluginSettings): Promise<string[]> {
        const recommendations: string[] = [];
        const healthCheck = await this.runHealthCheck(settings);

        // Add health check recommendations
        recommendations.push(...healthCheck.recommendations);

        // Performance-based recommendations
        const stats = performanceMonitor.getAllStats();
        const videoProcessingStats = stats['video-processing'];

        if (videoProcessingStats && videoProcessingStats.averageDuration > 20000) {
            recommendations.push('Consider enabling parallel processing for faster video processing');
            recommendations.push('Try using the "fast" performance mode for quicker results');
        }

        const aiProcessingStats = stats['ai-processing'];
        if (aiProcessingStats && aiProcessingStats.averageDuration > 15000) {
            recommendations.push('Configure multiple AI providers for faster processing');
            recommendations.push('Consider using faster AI models for time-sensitive tasks');
        }

        // Usage-based recommendations
        if (healthCheck.score > this.OPTIMAL_SCORE) {
            recommendations.push('Plugin is performing optimally! Consider contributing improvements.');
        }

        // Remove duplicates
        return [...new Set(recommendations)];
    }

    /**
     * Apply recommended optimizations automatically where safe
     */
    static async applySafeOptimizations(settings: YouTubePluginSettings): Promise<YouTubePluginSettings> {
        logger.info('Applying safe optimizations', 'OptimizationService');

        const optimizedSettings = { ...settings };

        // Enable performance monitoring if disabled
        if (!performanceMonitor.isEnabled()) {
            performanceMonitor.setEnabled(true);
        }

        // Recommend parallel processing if not enabled and AI processing is slow
        const aiStats = performanceMonitor.getStats('ai-processing');
        if (aiStats && aiStats.averageDuration > 10000 && !settings.enableParallelProcessing) {
            logger.info('Recommending parallel processing based on performance data', 'OptimizationService');
            // Note: We don't auto-enable this as it's a user preference
        }

        logger.info('Safe optimizations applied', 'OptimizationService');
        return optimizedSettings;
    }

    /**
     * Generate a performance report
     */
    static generatePerformanceReport(): {
        summary: ReturnType<typeof performanceMonitor.getSummary>;
        stats: Record<string, ReturnType<typeof performanceMonitor.getStats>>;
        recommendations: string[];
        generatedAt: string;
    } {
        return {
            summary: performanceMonitor.getSummary(),
            stats: performanceMonitor.getAllStats(),
            recommendations: [
                'Monitor error rates and retry patterns',
                'Consider parallel processing for faster results',
                'Keep AI models updated for best performance',
                'Regular health checks recommended'
            ],
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Reset all optimization data
     */
    static resetOptimizationData(): void {
        performanceMonitor.clearMetrics();
        logger.info('Optimization data reset', 'OptimizationService');
    }
}