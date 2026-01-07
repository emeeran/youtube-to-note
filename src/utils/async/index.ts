/**
 * Async utility functions
 */

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
    multiplier: number = 2
): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxAttempts) {
                const delayMs = baseDelay * Math.pow(multiplier, attempt - 1);
                await delay(delayMs + Math.random() * 1000); // Add jitter
            }
        }
    }

    if (!lastError) {
        throw new Error('All retry attempts failed');
    }
    throw lastError;
}

/**
 * Execute promises in parallel with concurrency limit
 */
export async function parallel<T>(
    items: T[],
    fn: (item: T) => Promise<unknown>,
    concurrency: number = 5
): Promise<void> {
    const executing: Promise<unknown>[] = [];

    for (const item of items) {
        const promise = fn(item);
        executing.push(promise);

        // Remove from executing when done (fire and forget)
        /* eslint-disable @typescript-eslint/no-floating-promises */
        void promise.then(
            () => {
                const idx = executing.indexOf(promise);
                if (idx !== -1) {
                    executing.splice(idx, 1);
                }
            },
            () => {
                const idx = executing.indexOf(promise);
                if (idx !== -1) {
                    executing.splice(idx, 1);
                }
            }
        );
        /* eslint-enable @typescript-eslint/no-floating-promises */

        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }

    await Promise.all(executing);
}

/**
 * Create a debounced function
 */
export function debounce<T extends(...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        timeoutId = setTimeout(() => void fn(...args), delay || 0);
    };
}

/**
 * Create a throttled function
 */
export function throttle<T extends(...args: unknown[]) => unknown>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Timeout a promise
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Operation timed out'
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        ),
    ]);
}
