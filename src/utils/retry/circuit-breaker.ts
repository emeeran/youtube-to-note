/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when a service is down
 */

export enum CircuitState {
    CLOSED = 'CLOSED',   // Normal operation
    OPEN = 'OPEN',       // Failing, reject requests
    HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerConfig {
    failureThreshold: number;  // Number of failures before opening
    successThreshold: number;  // Number of successes to close circuit
    timeout: number;           // Time to wait before trying again (ms)
    monitoringPeriod?: number; // Time window for counting failures (ms)
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime: number = 0;
    private nextAttemptTime: number = 0;

    constructor(
        private config: CircuitBreakerConfig,
        private name: string = 'CircuitBreaker'
    ) {}

    /**
     * Execute operation with circuit breaker protection
     */
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttemptTime) {
                throw new Error(`Circuit breaker '${this.name}' is OPEN`);
            }
            this.state = CircuitState.HALF_OPEN;
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.config.successThreshold) {
                this.state = CircuitState.CLOSED;
                this.successCount = 0;
            }
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (
            this.failureCount >= this.config.failureThreshold ||
            this.state === CircuitState.HALF_OPEN
        ) {
            this.state = CircuitState.OPEN;
            this.nextAttemptTime = Date.now() + this.config.timeout;
            this.successCount = 0;
        }
    }

    getState(): CircuitState {
        return this.state;
    }

    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        this.nextAttemptTime = 0;
    }
}
