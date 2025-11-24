/**
 * Retry service for handling transient failures with exponential backoff
 */

import { logger } from './logger';

export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    retryableErrors: string[];
    retryableStatusCodes: number[];
    jitter: boolean;
}

export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    totalTimeMs: number;
}

export class RetryService {
    private static defaultConfig: RetryConfig = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffFactor: 2,
        retryableErrors: [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'NETWORK_ERROR',
            'TIMEOUT',
            'Rate limit',
            'Quota exceeded',
            'Service unavailable'
        ],
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        jitter: true
    };

    /**
     * Execute an operation with retry logic
     */
    static async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationName: string,
        config: Partial<RetryConfig> = {}
    ): Promise<RetryResult<T>> {
        const finalConfig = { ...this.defaultConfig, ...config };
        const startTime = Date.now();
        let lastError: Error | undefined;

        logger.info(`Starting retryable operation: ${operationName}`, 'RetryService', {
            maxAttempts: finalConfig.maxAttempts,
            baseDelayMs: finalConfig.baseDelayMs
        });

        for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
            try {
                const result = await operation();
                const totalTime = Date.now() - startTime;

                logger.info(`Operation succeeded: ${operationName}`, 'RetryService', {
                    attempt,
                    totalTimeMs: totalTime
                });

                return {
                    success: true,
                    result,
                    attempts: attempt,
                    totalTimeMs: totalTime
                };
            } catch (error) {
                lastError = error as Error;

                logger.warn(`Operation failed: ${operationName}`, 'RetryService', {
                    attempt,
                    error: lastError.message,
                    willRetry: attempt < finalConfig.maxAttempts && this.isRetryableError(lastError, finalConfig)
                });

                if (attempt === finalConfig.maxAttempts || !this.isRetryableError(lastError, finalConfig)) {
                    break;
                }

                const delay = this.calculateDelay(attempt, finalConfig);
                logger.debug(`Waiting ${delay}ms before retry`, 'RetryService', {
                    attempt,
                    delay
                });

                await this.sleep(delay);
            }
        }

        const totalTime = Date.now() - startTime;
        logger.error(`Operation failed after all retries: ${operationName}`, 'RetryService', {
            attempts: finalConfig.maxAttempts,
            totalTimeMs: totalTime,
            finalError: lastError?.message
        });

        return {
            success: false,
            error: lastError,
            attempts: finalConfig.maxAttempts,
            totalTimeMs: totalTime
        };
    }

    /**
     * Execute with simple retry (for backward compatibility)
     */
    static async withRetry<T>(
        operation: () => Promise<T>,
        operationName: string,
        maxAttempts: number = 3,
        baseDelayMs: number = 1000
    ): Promise<T> {
        const result = await this.executeWithRetry(operation, operationName, {
            maxAttempts,
            baseDelayMs
        });

        if (result.success) {
            return result.result!;
        } else {
            throw result.error || new Error('Operation failed after retries');
        }
    }

    /**
     * Check if an error is retryable
     */
    private static isRetryableError(error: Error, config: RetryConfig): boolean {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();

        // Check for retryable error messages
        for (const retryableError of config.retryableErrors) {
            if (
                errorMessage.includes(retryableError.toLowerCase()) ||
                errorName.includes(retryableError.toLowerCase())
            ) {
                return true;
            }
        }

        // Check for fetch/API errors with status codes
        if ('status' in error) {
            const status = (error as any).status;
            return config.retryableStatusCodes.includes(status);
        }

        // Check for network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return true;
        }

        return false;
    }

    /**
     * Calculate delay with exponential backoff and optional jitter
     */
    private static calculateDelay(attempt: number, config: RetryConfig): number {
        let delay = config.baseDelayMs * Math.pow(config.backoffFactor, attempt - 1);
        delay = Math.min(delay, config.maxDelayMs);

        if (config.jitter) {
            // Add +/- 25% jitter
            const jitterAmount = delay * 0.25;
            delay = delay + (Math.random() - 0.5) * 2 * jitterAmount;
        }

        return Math.floor(delay);
    }

    /**
     * Sleep for specified milliseconds
     */
    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create a wrapped fetch with retry logic
     */
    static createRetryableFetch(
        input: RequestInfo | URL,
        init?: RequestInit,
        retryConfig?: Partial<RetryConfig>
    ): Promise<Response> {
        return this.withRetry(
            async () => {
                const response = await fetch(input, init);

                if (!response.ok) {
                    const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
                    error.status = response.status;
                    error.statusText = response.statusText;
                    throw error;
                }

                return response;
            },
            `fetch: ${typeof input === 'string' ? input : 'request'}`,
            retryConfig?.maxAttempts || 3,
            retryConfig?.baseDelayMs || 1000
        );
    }

    /**
     * Execute multiple operations concurrently with individual retry logic
     */
    static async executeWithRetryConcurrently<T>(
        operations: Array<{
            operation: () => Promise<T>;
            name: string;
            config?: Partial<RetryConfig>;
        }>
    ): Promise<RetryResult<T>[]> {
        logger.info(`Executing ${operations.length} operations concurrently with retry`, 'RetryService');

        const promises = operations.map(({ operation, name, config }) =>
            this.executeWithRetry(operation, name, config)
        );

        const results = await Promise.all(promises);

        const successfulCount = results.filter(r => r.success).length;
        const failedCount = results.length - successfulCount;

        logger.info(`Concurrent operations completed`, 'RetryService', {
            total: results.length,
            successful: successfulCount,
            failed: failedCount
        });

        return results;
    }

    /**
     * Execute operations in series with retry logic
     */
    static async executeWithRetrySeries<T>(
        operations: Array<{
            operation: () => Promise<T>;
            name: string;
            config?: Partial<RetryConfig>;
            continueOnError?: boolean;
        }>
    ): Promise<RetryResult<T>[]> {
        logger.info(`Executing ${operations.length} operations in series with retry`, 'RetryService');

        const results: RetryResult<T>[] = [];

        for (const { operation, name, config, continueOnError = false } of operations) {
            const result = await this.executeWithRetry(operation, name, config);
            results.push(result);

            if (!result.success && !continueOnError) {
                logger.info(`Stopping series execution due to failure in: ${name}`, 'RetryService');
                break;
            }
        }

        const successfulCount = results.filter(r => r.success).length;
        const failedCount = results.length - successfulCount;

        logger.info(`Series operations completed`, 'RetryService', {
            total: results.length,
            successful: successfulCount,
            failed: failedCount
        });

        return results;
    }
}

// Convenience functions for common retry patterns
export const retry = RetryService.withRetry;
export const retryFetch = RetryService.createRetryableFetch;