import { PerformanceMonitor } from './performance-monitor';

export function importState(stateJson: string): void {
    try {
        const state = JSON.parse(stateJson);
export enum CircuitState {
    CLOSED = 'CLOSED',      // Normal operation
    OPEN = 'OPEN',          // Circuit is open, blocking calls
    HALF_OPEN = 'HALF_OPEN' // Testing if the service has recovered
}

export interface CircuitBreakerConfig {
    failureThreshold: number;      // Number of failures before opening
    recoveryTimeout: number;       // Time in ms to wait before trying again
    monitoringPeriod: number;      // Time window for failure counting
    expectedRecoveryTime: number;  // Expected time for recovery
    halfOpenMaxCalls: number;      // Max calls in half-open state
    resetTimeout: number;          // Timeout for forced reset
}

export interface CircuitBreakerMetrics {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    totalCalls: number;
    lastFailureTime: number | null;
    lastSuccessTime: number | null;
    stateChanges: number;
    averageResponseTime: number;
    uptimePercentage: number;
}

export interface CircuitBreakerOptions {
    name: string;
    config?: Partial<CircuitBreakerConfig>;
    fallback?: (error: Error) => any;
    onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
    performanceMonitor?: PerformanceMonitor;
}

/**
 * Circuit Breaker implementation for preventing cascading failures
 */
export class CircuitBreaker {
    private name: string;
    private config: CircuitBreakerConfig;
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private successCount = 0;
    private totalCalls = 0;
    private lastFailureTime: number | null = null;
    private lastSuccessTime: number | null = null;
    private stateChanges = 0;
    private halfOpenCalls = 0;
    private responseTimes: number[] = [];
    private monitoringStartTime = Date.now();
    private fallback?: (error: Error) => any;
    private onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
    private performanceMonitor?: PerformanceMonitor;
    private timeoutHandles: Set<number> = new Set();

    constructor(options: CircuitBreakerOptions) {
        this.name = options.name;
        this.fallback = options.fallback;
        this.onStateChange = options.onStateChange;
        this.performanceMonitor = options.performanceMonitor;

        this.config = {
            failureThreshold: 5,            // Open after 5 failures
            recoveryTimeout: 60000,         // 1 minute recovery timeout
            monitoringPeriod: 300000,       // 5 minute monitoring window
            expectedRecoveryTime: 30000,    // 30 seconds expected recovery
            halfOpenMaxCalls: 3,            // Allow 3 calls in half-open state
            resetTimeout: 300000,           // 5 minutes forced reset
            ...options.config
        };

        // Start periodic cleanup
        this.startPeriodicCleanup();
    }

    private startPeriodicCleanup(): void {
        const cleanupInterval = setInterval(() => {
            this.cleanupMetrics();
        }, this.config.monitoringPeriod);

        // Cleanup on process exit
        if (typeof process !== 'undefined') {
            process.on('exit', () => {
                clearInterval(cleanupInterval);
                this.cleanup();
            });
        }
    }

    private cleanupMetrics(): void {
        const now = Date.now();

        // Clean old response times (keep last 100)
        if (this.responseTimes.length > 100) {
            this.responseTimes = this.responseTimes.slice(-100);
        }

        // Reset failure count if outside monitoring period
        if (this.lastFailureTime && now - this.lastFailureTime > this.config.monitoringPeriod) {
            this.failureCount = Math.max(0, this.failureCount - 1);
        }

        // Log periodic metrics
        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('circuit_breaker_metrics', this.getMetrics());
        }
    }

    private changeState(newState: CircuitState): void {
        const oldState = this.state;
        if (oldState !== newState) {
            this.state = newState;
            this.stateChanges++;
            this.halfOpenCalls = 0; // Reset half-open calls

            
if (this.onStateChange) {
                this.onStateChange(oldState, newState);
            }

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('circuit_breaker_state_change', 1, {
                    name: this.name,
                    oldState,
                    newState
                });
            }
        }
    }

    private shouldAllowRequest(): boolean {
        const now = Date.now();

        switch (this.state) {
            case CircuitState.CLOSED:
                return true;

            case CircuitState.OPEN:
                if (now - (this.lastFailureTime || 0) > this.config.recoveryTimeout) {
                    this.changeState(CircuitState.HALF_OPEN);
                    return this.halfOpenCalls < this.config.halfOpenMaxCalls;
                }
                return false;

            case CircuitState.HALF_OPEN:
                return this.halfOpenCalls < this.config.halfOpenMaxCalls;

            default:
                return false;
        }
    }

    private onSuccess(responseTime: number): void {
        const now = Date.now();
        this.successCount++;
        this.totalCalls++;
        this.lastSuccessTime = now;
        this.responseTimes.push(responseTime);

        // Keep only last 100 response times
        if (this.responseTimes.length > 100) {
            this.responseTimes = this.responseTimes.slice(-100);
        }

        if (this.state === CircuitState.HALF_OPEN) {
            // Successful call in half-open state, close the circuit
            this.changeState(CircuitState.CLOSED);
            this.failureCount = 0;
        } else if (this.state === CircuitState.CLOSED) {
            // Reset failure count on success in closed state
            this.failureCount = Math.max(0, this.failureCount - 1);
        }

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('circuit_breaker_success', 1, {
                name: this.name,
                responseTime
            });
        }
    }

    private onFailure(error: Error): void {
        const now = Date.now();
        this.failureCount++;
        this.totalCalls++;
        this.lastFailureTime = now;

        if (this.state === CircuitState.HALF_OPEN) {
            // Failure in half-open state, open the circuit immediately
            this.changeState(CircuitState.OPEN);
        } else if (this.state === CircuitState.CLOSED) {
            // Check if we should open the circuit
            if (this.failureCount >= this.config.failureThreshold) {
                this.changeState(CircuitState.OPEN);
            }
        }

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('circuit_breaker_failure', 1, {
                name: this.name,
                error: error.message,
                failureCount: this.failureCount
            });
        }
    }

    /**
     * Execute an operation through the circuit breaker
     */
    async execute<T>(operation: () => Promise<T>, timeout?: number): Promise<T> {
        if (!this.shouldAllowRequest()) {
            const error = new Error(`CircuitBreaker '${this.name}' is ${this.state}`);

            if (this.fallback) {
                try {
                    return this.fallback(error);
                } catch (fallbackError) {
                    throw fallbackError;
                }
            }

            throw error;
        }

        const startTime = performance.now();
        let timeoutHandle: number | undefined;

        try {
            // Increment half-open calls if in that state
            if (this.state === CircuitState.HALF_OPEN) {
                this.halfOpenCalls++;
            }

            // Set up timeout if provided
            if (timeout && timeout > 0) {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timeoutHandle = window.setTimeout(() => {
                        reject(new Error(`CircuitBreaker '${this.name}' operation timed out after ${timeout}ms`));
                    }, timeout);
                });

                const operationPromise = operation();
                const result = await Promise.race([operationPromise, timeoutPromise]);

                // Clear timeout if operation completed
                if (timeoutHandle) {
                    window.clearTimeout(timeoutHandle);
                }

                const responseTime = performance.now() - startTime;
                this.onSuccess(responseTime);

                return result;
            } else {
                const result = await operation();
                const responseTime = performance.now() - startTime;
                this.onSuccess(responseTime);

                return result;
            }
        } catch (error) {
            // Clear timeout if operation failed
            if (timeoutHandle) {
                window.clearTimeout(timeoutHandle);
            }

            this.onFailure(error as Error);
            throw error;
        }
    }

    /**
     * Execute with automatic retry
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        retryDelay: number = 1000,
        backoffMultiplier: number = 2
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.execute(operation);
            } catch (error) {
                lastError = error as Error;

                if (attempt < maxRetries) {
                    const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
                    
await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * Get current circuit breaker metrics
     */
    getMetrics(): CircuitBreakerMetrics {
        const now = Date.now();
        const uptime = now - this.monitoringStartTime;
        const averageResponseTime = this.responseTimes.length > 0 ?
            this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length : 0;

        // Calculate uptime percentage (time not in OPEN state)
        const totalUptime = this.responseTimes.length * averageResponseTime;
        const uptimePercentage = uptime > 0 ? (totalUptime / uptime) * 100 : 0;

        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalCalls: this.totalCalls,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            stateChanges: this.stateChanges,
            averageResponseTime,
            uptimePercentage
        };
    }

    /**
     * Get current circuit state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Check if circuit is currently open
     */
    isOpen(): boolean {
        return this.state === CircuitState.OPEN;
    }

    /**
     * Check if circuit is currently closed (normal operation)
     */
    isClosed(): boolean {
        return this.state === CircuitState.CLOSED;
    }

    /**
     * Force open the circuit
     */
    forceOpen(): void {
        this.changeState(CircuitState.OPEN);
        this.lastFailureTime = Date.now();
    }

    /**
     * Force close the circuit
     */
    forceClose(): void {
        this.changeState(CircuitState.CLOSED);
        this.failureCount = 0;
        this.lastFailureTime = null;
    }

    /**
     * Reset the circuit breaker to initial state
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.totalCalls = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.stateChanges = 0;
        this.halfOpenCalls = 0;
        this.responseTimes = [];
        this.monitoringStartTime = Date.now();

        // Clear all timeouts
        this.timeoutHandles.forEach(handle => clearTimeout(handle));
        this.timeoutHandles.clear();

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('circuit_breaker_reset', 1, { name: this.name });
        }
    }

    /**
     * Set custom fallback function
     */
    setFallback(fallback: (error: Error) => any): void {
        this.fallback = fallback;
    }

    /**
     * Set state change callback
     */
    setOnStateChange(callback: (oldState: CircuitState, newState: CircuitState) => void): void {
        this.onStateChange = callback;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
        this.config = { ...this.config, ...newConfig };

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('circuit_breaker_config_update', 1, {
                name: this.name,
                config: this.config
            });
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): CircuitBreakerConfig {
        return { ...this.config };
    }

    /**
     * Get circuit breaker name
     */
    getName(): string {
        return this.name;
    }

    /**
     * Export circuit breaker state for persistence
     */
    export(): string {
        return JSON.stringify({
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalCalls: this.totalCalls,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            stateChanges: this.stateChanges,
            responseTimes: this.responseTimes,
            monitoringStartTime: this.monitoringStartTime
        });
    }

    /**
     * Import circuit breaker state
     */
        try {
            const state = JSON.parse(stateJson);

            this.state = state.state || CircuitState.CLOSED;
            this.failureCount = state.failureCount || 0;
            this.successCount = state.successCount || 0;
            this.totalCalls = state.totalCalls || 0;
            this.lastFailureTime = state.lastFailureTime || null;
            this.lastSuccessTime = state.lastSuccessTime || null;
            this.stateChanges = state.stateChanges || 0;
            this.responseTimes = state.responseTimes || [];
            this.monitoringStartTime = state.monitoringStartTime || Date.now();

            
} catch (error) {
            
}
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.timeoutHandles.forEach(handle => clearTimeout(handle));
        this.timeoutHandles.clear();
    }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
    private static instance: CircuitBreakerRegistry;
    private circuitBreakers = new Map<string, CircuitBreaker>();

    private constructor() {}

    static getInstance(): CircuitBreakerRegistry {
        if (!CircuitBreakerRegistry.instance) {
            CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
        }
        return CircuitBreakerRegistry.instance;
    }

    create(options: CircuitBreakerOptions): CircuitBreaker {
        const breaker = new CircuitBreaker(options);
        this.circuitBreakers.set(options.name, breaker);
        return breaker;
    }

    get(name: string): CircuitBreaker | undefined {
        return this.circuitBreakers.get(name);
    }

    getAll(): CircuitBreaker[] {
        return Array.from(this.circuitBreakers.values());
    }

    getAllMetrics(): Record<string, CircuitBreakerMetrics> {
        const metrics: Record<string, CircuitBreakerMetrics> = {};
        this.circuitBreakers.forEach((breaker, name) => {
            metrics[name] = breaker.getMetrics();
        });
        return metrics;
    }

    remove(name: string): boolean {
        const breaker = this.circuitBreakers.get(name);
        if (breaker) {
            breaker.cleanup();
            return this.circuitBreakers.delete(name);
        }
        return false;
    }

    resetAll(): void {
        this.circuitBreakers.forEach(breaker => breaker.reset());
    }

    forceOpenAll(): void {
        this.circuitBreakers.forEach(breaker => breaker.forceOpen());
    }

    forceCloseAll(): void {
        this.circuitBreakers.forEach(breaker => breaker.forceClose());
    }

    cleanup(): void {
        this.circuitBreakers.forEach(breaker => breaker.cleanup());
        this.circuitBreakers.clear();
    }
}