import { logger } from './logger';

/**
 * Simple retry service for handling transient failures
 */
export class RetryService {
    /**
     * Execute an operation with retry logic
     */
    static async withRetry<T>(
        operation: () => Promise<T>,
        operationName: string,
        maxAttempts: number = 3,
        baseDelayMs: number = 1000
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                logger.warn(`Operation failed: ${operationName}`, 'RetryService', {
                    attempt,
                    error: lastError.message,
                    willRetry: attempt < maxAttempts,
                });

                if (attempt === maxAttempts) break;

                // Exponential backoff with jitter
                const delay = baseDelayMs * Math.pow(2, attempt - 1) * (0.75 + Math.random() * 0.5);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError ?? new Error('Operation failed after retries');
    }
}

// Convenience export
export const retry = RetryService.withRetry;
