/**
 * Rate Limiter Implementation
 * Token Bucket algorithm for rate limiting
 */

export interface RateLimiterConfig {
    tokens: number;      // Maximum tokens
    refillRate: number;  // Tokens per second
    window?: number;     // Time window in ms (default 1000ms)
}

export class RateLimiter {
    private tokens: number;
    private lastRefill: number;

    constructor(
        private config: RateLimiterConfig,
        private key: string = 'default'
    ) {
        this.tokens = config.tokens;
        this.lastRefill = Date.now();
    }

    /**
     * Try to consume a token
     */
    tryConsume(tokens: number = 1): boolean {
        this.refill();

        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }

        return false;
    }

    /**
     * Wait until token is available
     */
    async consume(tokens: number = 1): Promise<void> {
        while (!this.tryConsume(tokens)) {
            const waitTime = Math.ceil((tokens - this.tokens) / this.config.refillRate * 1000);
            await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 100)));
        }
    }

    /**
     * Refill tokens based on elapsed time
     */
    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const window = this.config.window || 1000;

        const tokensToAdd = (elapsed / window) * this.config.refillRate;
        this.tokens = Math.min(this.config.tokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    /**
     * Get available tokens
     */
    getAvailableTokens(): number {
        this.refill();
        return this.tokens;
    }

    /**
     * Reset the rate limiter
     */
    reset(): void {
        this.tokens = this.config.tokens;
        this.lastRefill = Date.now();
    }
}

/**
 * Rate limiter manager for multiple rate limiters
 */
export class RateLimiterManager {
    private limiters: Map<string, RateLimiter> = new Map();

    getLimiter(key: string, config: RateLimiterConfig): RateLimiter {
        if (!this.limiters.has(key)) {
            this.limiters.set(key, new RateLimiter(config, key));
        }
        return this.limiters.get(key)!;
    }

    removeLimiter(key: string): void {
        this.limiters.delete(key);
    }

    clear(): void {
        this.limiters.clear();
    }
}
