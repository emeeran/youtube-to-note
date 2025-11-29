import { PerformanceMonitor } from './performance-monitor';
import { ComponentManager } from './memory-management';

export type StateValue = any;
export type StateKey = string;

export interface StateSubscriber<T = StateValue> {
    id: string;
    callback: (value: T, previousValue: T | undefined) => void;
    filter?: (value: T, previousValue: T | undefined) => boolean;
    immediate?: boolean; // Call immediately on subscription
}

export interface StateSlice {
    key: StateKey;
    value: StateValue;
    timestamp: number;
    lastModified: number;
    modifiedBy: string;
    version: number;
    dependencies?: StateKey[];
}

export interface StateConfig {
    persist?: boolean;
    encrypt?: boolean;
    validate?: (value: StateValue) => boolean;
    transform?: (value: StateValue) => StateValue;
    middleware?: StateMiddleware[];
    ttl?: number; // Time to live in milliseconds
    maxSize?: number; // Maximum size for stored values
}

export interface StateMiddleware {
    name: string;
    beforeSet?: (key: StateKey, value: StateValue, currentValue?: StateValue) => StateValue;
    afterSet?: (key: StateKey, value: StateValue, previousValue?: StateValue) => void;
    beforeGet?: (key: StateKey, value: StateValue) => StateValue;
    afterGet?: (key: StateKey, value: StateValue) => void;
}

export interface StateMetrics {
    totalKeys: number;
    totalSubscribers: number;
    setsPerSecond: number;
    getsPerSecond: number;
    averageStateSize: number;
    memoryUsage: number;
    errorCount: number;
    lastActivity: number;
}

export interface StateSnapshot {
    timestamp: number;
    state: Record<string, StateSlice>;
    version: number;
    metadata: Record<string, any>;
}

/**
 * Centralized state management system with subscriptions, persistence, and middleware
 */
export class StateManager {
    private static instance: StateManager;
    private state = new Map<StateKey, StateSlice>();
    private subscribers = new Map<StateKey, Set<StateSubscriber>>();
    private globalSubscribers = new Set<StateSubscriber>();
    private config = new Map<StateKey, StateConfig>();
    private performanceMonitor?: PerformanceMonitor;
    private componentManager: ComponentManager;
    private metrics = {
        sets: 0,
        gets: 0,
        errors: 0,
        lastActivity: Date.now(),
        startTimestamp: Date.now()
    };
    private version = 1;
    private middleware: StateMiddleware[] = [];
    private persistedKeys = new Set<StateKey>();
    private cleanupInterval?: number;

    private constructor(performanceMonitor?: PerformanceMonitor) {
        this.performanceMonitor = performanceMonitor;
        this.componentManager = new ComponentManager(performanceMonitor);

        this.loadPersistedState();
        this.startCleanupInterval();
    }

    static getInstance(performanceMonitor?: PerformanceMonitor): StateManager {
        if (!StateManager.instance) {
            StateManager.instance = new StateManager(performanceMonitor);
        }
        return StateManager.instance;
    }

    private loadPersistedState(): void {
        try {
            const persisted = localStorage.getItem('ytclipper_state');
            if (persisted) {
                const data = JSON.parse(persisted) as StateSnapshot;
                data.version = this.version;

                Object.entries(data.state).forEach(([key, slice]) => {
                    this.state.set(key, {
                        ...slice,
                        timestamp: Date.now(),
                        lastModified: Date.now()
                    });
                    this.persistedKeys.add(key);
                });

                console.info(`Loaded ${Object.keys(data.state).length} state items from persistence`);
            }
        } catch (error) {
            console.error('Failed to load persisted state:', error);
        }
    }

    private savePersistedState(): void {
        try {
            const stateSnapshot = this.createSnapshot();
            const persistData: Record<string, StateSlice> = {};

            this.persistedKeys.forEach(key => {
                const slice = this.state.get(key);
                if (slice) {
                    persistData[key] = slice;
                }
            });

            const snapshot: StateSnapshot = {
                timestamp: Date.now(),
                state: persistData,
                version: this.version,
                metadata: {
                    metrics: this.getMetrics(),
                    persistedKeys: Array.from(this.persistedKeys)
                }
            };

            localStorage.setItem('ytclipper_state', JSON.stringify(snapshot));
        } catch (error) {
            console.error('Failed to save persisted state:', error);
        }
    }

    private startCleanupInterval(): void {
        this.cleanupInterval = window.setInterval(() => {
            this.cleanupExpiredStates();
        }, 60000); // Every minute
    }

    private cleanupExpiredStates(): void {
        const now = Date.now();
        const expiredKeys: StateKey[] = [];

        this.state.forEach((slice, key) => {
            const config = this.config.get(key);
            if (config?.ttl && now - slice.timestamp > config.ttl) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => {
            this.delete(key);
        });

        if (expiredKeys.length > 0 && this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_cleanup', expiredKeys.length);
        }
    }

    /**
     * Set a value in the state
     */
    set<T = StateValue>(
        key: StateKey,
        value: T,
        config?: Partial<StateConfig>,
        modifiedBy: string = 'system'
    ): T {
        const startTime = performance.now();

        try {
            this.metrics.sets++;
            this.metrics.lastActivity = Date.now();

            const previousValue = this.get(key);
            const currentConfig = { ...this.config.get(key), ...config };

            // Apply validation
            if (currentConfig.validate && !currentConfig.validate(value)) {
                throw new Error(`State validation failed for key: ${key}`);
            }

            // Apply transformation
            let transformedValue = value;
            if (currentConfig.transform) {
                transformedValue = currentConfig.transform(value);
            }

            // Apply middleware (beforeSet)
            for (const middleware of this.middleware) {
                if (middleware.beforeSet) {
                    transformedValue = middleware.beforeSet(key, transformedValue, previousValue);
                }
            }
            for (const middleware of currentConfig.middleware || []) {
                if (middleware.beforeSet) {
                    transformedValue = middleware.beforeSet(key, transformedValue, previousValue);
                }
            }

            // Check size limits
            if (currentConfig.maxSize) {
                const size = new Blob([JSON.stringify(transformedValue)]).size;
                if (size > currentConfig.maxSize) {
                    throw new Error(`State value too large for key: ${key} (${size} > ${currentConfig.maxSize})`);
                }
            }

            // Create or update state slice
            const slice: StateSlice = {
                key,
                value: transformedValue,
                timestamp: Date.now(),
                lastModified: Date.now(),
                modifiedBy,
                version: this.version++,
                dependencies: currentConfig.dependencies
            };

            this.state.set(key, slice);

            // Update config if provided
            if (config) {
                this.config.set(key, currentConfig);
            }

            // Handle persistence
            if (currentConfig.persist) {
                this.persistedKeys.add(key);
                this.componentManager.setTimeout(() => {
                    this.savePersistedState();
                }, 1000); // Debounce persistence
            }

            // Apply middleware (afterSet)
            for (const middleware of this.middleware) {
                if (middleware.afterSet) {
                    middleware.afterSet(key, transformedValue, previousValue);
                }
            }
            for (const middleware of currentConfig.middleware || []) {
                if (middleware.afterSet) {
                    middleware.afterSet(key, transformedValue, previousValue);
                }
            }

            // Notify subscribers
            this.notifySubscribers(key, transformedValue, previousValue);

            // Update dependent states
            if (slice.dependencies) {
                this.updateDependentStates(key, slice.dependencies);
            }

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('state_set', performance.now() - startTime, { key });
            }

            return transformedValue;
        } catch (error) {
            this.metrics.errors++;
            console.error(`Failed to set state for key ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get a value from the state
     */
    get<T = StateValue>(key: StateKey, defaultValue?: T): T {
        const startTime = performance.now();

        try {
            this.metrics.gets++;
            this.metrics.lastActivity = Date.now();

            const slice = this.state.get(key);
            let value = slice ? slice.value : defaultValue;

            // Apply middleware (beforeGet)
            for (const middleware of this.middleware) {
                if (middleware.beforeGet && value !== undefined) {
                    value = middleware.beforeGet(key, value);
                }
            }

            // Apply config-specific middleware
            const config = this.config.get(key);
            if (config?.middleware) {
                for (const middleware of config.middleware) {
                    if (middleware.beforeGet && value !== undefined) {
                        value = middleware.beforeGet(key, value);
                    }
                }
            }

            // Apply middleware (afterGet)
            for (const middleware of this.middleware) {
                if (middleware.afterGet && value !== undefined) {
                    middleware.afterGet(key, value);
                }
            }
            for (const middleware of config?.middleware || []) {
                if (middleware.afterGet && value !== undefined) {
                    middleware.afterGet(key, value);
                }
            }

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('state_get', performance.now() - startTime, { key });
            }

            return value as T;
        } catch (error) {
            this.metrics.errors++;
            console.error(`Failed to get state for key ${key}:`, error);
            return defaultValue as T;
        }
    }

    /**
     * Check if a key exists in the state
     */
    has(key: StateKey): boolean {
        return this.state.has(key);
    }

    /**
     * Delete a key from the state
     */
    delete(key: StateKey): boolean {
        const existed = this.state.has(key);
        const previousValue = this.get(key);

        this.state.delete(key);
        this.config.delete(key);
        this.persistedKeys.delete(key);
        this.subscribers.delete(key);

        // Notify subscribers of deletion
        this.notifySubscribers(key, undefined, previousValue);

        if (existed && this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_delete', 1, { key });
        }

        return existed;
    }

    /**
     * Clear all state
     */
    clear(): void {
        const keys = Array.from(this.state.keys());
        keys.forEach(key => this.delete(key));

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_clear', 1);
        }
    }

    /**
     * Subscribe to state changes
     */
    subscribe<T = StateValue>(
        key: StateKey,
        callback: (value: T, previousValue: T | undefined) => void,
        options: {
            filter?: (value: T, previousValue: T | undefined) => boolean;
            immediate?: boolean;
        } = {}
    ): () => void {
        const subscriber: StateSubscriber<T> = {
            id: Math.random().toString(36).substr(2, 9),
            callback: callback as any,
            filter: options.filter as any,
            immediate: options.immediate
        };

        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }

        this.subscribers.get(key)!.add(subscriber);

        // Immediate callback if requested
        if (options.immediate) {
            const currentValue = this.get<T>(key);
            callback(currentValue, undefined);
        }

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_subscribe', 1, { key });
        }

        // Return unsubscribe function
        return () => {
            const subscribers = this.subscribers.get(key);
            if (subscribers) {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    this.subscribers.delete(key);
                }
            }
        };
    }

    /**
     * Subscribe to all state changes
     */
    subscribeAll<T = StateValue>(
        callback: (key: StateKey, value: T, previousValue: T | undefined) => void
    ): () => void {
        const subscriber: StateSubscriber<T> = {
            id: Math.random().toString(36).substr(2, 9),
            callback: callback as any
        };

        this.globalSubscribers.add(subscriber);

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_subscribe_all', 1);
        }

        return () => {
            this.globalSubscribers.delete(subscriber);
        };
    }

    /**
     * Batch update multiple state values
     */
    batchSet(updates: Array<{ key: StateKey; value: StateValue; config?: Partial<StateConfig> }>, modifiedBy: string = 'batch'): void {
        const startTime = performance.now();

        // Create a map of previous values for notifications
        const previousValues = new Map<StateKey, StateValue>();
        updates.forEach(({ key }) => {
            previousValues.set(key, this.get(key));
        });

        // Apply all updates
        updates.forEach(({ key, value, config }) => {
            this.set(key, value, config, modifiedBy);
        });

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_batch_set', performance.now() - startTime, {
                count: updates.length
            });
        }
    }

    /**
     * Create a derived state that depends on other states
     */
    derive<T = StateValue>(
        key: StateKey,
        dependencies: StateKey[],
        computeFn: (...values: StateValue[]) => T,
        config?: Partial<StateConfig>
    ): () => void {
        // Set up subscriptions for dependencies
        const unsubscribers = dependencies.map(dep => {
            return this.subscribe(dep, () => {
                // Recompute when dependency changes
                const values = dependencies.map(d => this.get(d));
                try {
                    const newValue = computeFn(...values);
                    this.set(key, newValue, {
                        ...config,
                        dependencies
                    }, 'derived');
                } catch (error) {
                    console.error(`Failed to compute derived state ${key}:`, error);
                }
            }, { immediate: true });
        });

        // Initial computation
        const values = dependencies.map(d => this.get(d));
        const initialValue = computeFn(...values);
        this.set(key, initialValue, {
            ...config,
            dependencies
        }, 'derived');

        // Return cleanup function
        return () => {
            unsubscribers.forEach(unsub => unsub());
            this.delete(key);
        };
    }

    /**
     * Get state metrics
     */
    getMetrics(): StateMetrics {
        const now = Date.now();
        const uptime = now - this.metrics.startTimestamp;
        const setsPerSecond = uptime > 0 ? (this.metrics.sets / uptime) * 1000 : 0;
        const getsPerSecond = uptime > 0 ? (this.metrics.gets / uptime) * 1000 : 0;

        // Calculate total state size
        let totalSize = 0;
        this.state.forEach(slice => {
            totalSize += new Blob([JSON.stringify(slice.value)]).size;
        });

        const averageStateSize = this.state.size > 0 ? totalSize / this.state.size : 0;

        // Count total subscribers
        let totalSubscribers = this.globalSubscribers.size;
        this.subscribers.forEach(subscribers => {
            totalSubscribers += subscribers.size;
        });

        return {
            totalKeys: this.state.size,
            totalSubscribers,
            setsPerSecond,
            getsPerSecond,
            averageStateSize,
            memoryUsage: totalSize,
            errorCount: this.metrics.errors,
            lastActivity: this.metrics.lastActivity
        };
    }

    /**
     * Create a snapshot of the current state
     */
    createSnapshot(): StateSnapshot {
        const state: Record<string, StateSlice> = {};
        this.state.forEach((slice, key) => {
            state[key] = slice;
        });

        return {
            timestamp: Date.now(),
            state,
            version: this.version,
            metadata: {
                metrics: this.getMetrics(),
                config: Array.from(this.config.entries())
            }
        };
    }

    /**
     * Restore state from a snapshot
     */
    restoreSnapshot(snapshot: StateSnapshot): void {
        this.clear();

        Object.entries(snapshot.state).forEach(([key, slice]) => {
            this.state.set(key, slice);
        });

        this.version = snapshot.version;
        this.metrics.startTimestamp = Date.now();

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_restore', 1, {
                keysRestored: Object.keys(snapshot.state).length,
                version: snapshot.version
            });
        }
    }

    /**
     * Export state for backup
     */
    export(): string {
        const snapshot = this.createSnapshot();
        return JSON.stringify(snapshot);
    }

    /**
     * Import state from backup
     */
    import(data: string): void {
        try {
            const snapshot = JSON.parse(data) as StateSnapshot;
            this.restoreSnapshot(snapshot);
        } catch (error) {
            console.error('Failed to import state:', error);
            throw error;
        }
    }

    /**
     * Add global middleware
     */
    addMiddleware(middleware: StateMiddleware): void {
        this.middleware.push(middleware);

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_middleware_added', 1, {
                name: middleware.name
            });
        }
    }

    /**
     * Remove middleware
     */
    removeMiddleware(name: string): void {
        const index = this.middleware.findIndex(m => m.name === name);
        if (index !== -1) {
            this.middleware.splice(index, 1);

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('state_middleware_removed', 1, {
                    name
                });
            }
        }
    }

    private notifySubscribers<T>(key: StateKey, value: T, previousValue: T | undefined): void {
        // Notify key-specific subscribers
        const subscribers = this.subscribers.get(key);
        if (subscribers) {
            subscribers.forEach(subscriber => {
                try {
                    if (!subscriber.filter || subscriber.filter(value, previousValue)) {
                        subscriber.callback(value, previousValue);
                    }
                } catch (error) {
                    console.error('Error in state subscriber callback:', error);
                }
            });
        }

        // Notify global subscribers
        this.globalSubscribers.forEach(subscriber => {
            try {
                subscriber.callback(key, value, previousValue);
            } catch (error) {
                console.error('Error in global state subscriber callback:', error);
            }
        });
    }

    private updateDependentStates(changedKey: StateKey, dependencies: StateKey[]): void {
        // Find all states that depend on the changed key
        this.state.forEach((slice, key) => {
            if (slice.dependencies?.includes(changedKey)) {
                // Trigger re-computation of dependent state
                const dependentSubscribers = this.subscribers.get(key);
                if (dependentSubscribers && dependentSubscribers.size > 0) {
                    this.notifySubscribers(key, slice.value, slice.value);
                }
            }
        });
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.clear();
        this.componentManager.cleanup();
        this.middleware = [];

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('state_cleanup', 1);
        }
    }
}

/**
 * Factory for creating common state managers
 */
export class StateManagerFactory {
    private static instances = new Map<string, StateManager>();

    static create(name: string, performanceMonitor?: PerformanceMonitor): StateManager {
        if (!this.instances.has(name)) {
            this.instances.set(name, StateManager.getInstance(performanceMonitor));
        }
        return this.instances.get(name)!;
    }

    static get(name: string): StateManager | undefined {
        return this.instances.get(name);
    }

    static destroy(name: string): void {
        const manager = this.instances.get(name);
        if (manager) {
            manager.cleanup();
            this.instances.delete(name);
        }
    }

    static destroyAll(): void {
        this.instances.forEach((manager, name) => {
            manager.cleanup();
        });
        this.instances.clear();
    }
}

// Predefined middleware
export const StateMiddlewarePresets = {
    logging: {
        name: 'logging',
        beforeSet: (key, value, previousValue) => {
            console.debug(`State set: ${key}`, { newValue: value, previousValue });
            return value;
        },
        afterGet: (key, value) => {
            console.debug(`State get: ${key}`, value);
        }
    },

    persistence: {
        name: 'persistence',
        afterSet: (key, value) => {
            // Debounced persistence handled by StateManager
        }
    },

    validation: {
        name: 'validation',
        beforeSet: (key, value) => {
            if (value === undefined || value === null) {
                console.warn(`Invalid state value for key ${key}:`, value);
            }
            return value;
        }
    },

    performance: {
        name: 'performance',
        beforeSet: (key, value, previousValue) => {
            if (JSON.stringify(value) === JSON.stringify(previousValue)) {
                console.debug(`State unchanged for key ${key}, skipping update`);
                return previousValue; // Return previous value to skip update
            }
            return value;
        }
    }
};