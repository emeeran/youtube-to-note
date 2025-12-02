import { PerformanceMonitor } from './performance-monitor';


export interface EventListener {
    element: EventTarget;
    event: string;
    handler: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
}

export interface TimerInfo {
    id: number;
    type: 'timeout' | 'interval';
    createdAt: number;
    description?: string;
}

export interface CleanupTask {
    id: string;
    cleanup: () => void;
    description?: string;
    createdAt: number;
}

export class ComponentManager {
    private eventListeners = new Set<EventListener>();
    private timers = new Set<TimerInfo>();
    private cleanupTasks = new Set<CleanupTask>();
    private disposed = false;
    private performanceMonitor?: PerformanceMonitor;

    constructor(performanceMonitor?: PerformanceMonitor) {
        this.performanceMonitor = performanceMonitor;
    }

    /**
     * Add an event listener with automatic cleanup
     */
    addEventListener<T extends EventTarget>(
        element: T,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        if (this.disposed) {
            
return;
        }

        element.addEventListener(event, handler, options);

        const listener: EventListener = {
            element,
            event,
            handler,
            options
        };

        this.eventListeners.add(listener);

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('event_listener_added', 1);
        }
    }

    /**
     * Remove a specific event listener
     */
    removeEventListener<T extends EventTarget>(
        element: T,
        event: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void {
        element.removeEventListener(event, handler, options);

        const listener = Array.from(this.eventListeners).find(
            l => l.element === element && l.event === event && l.handler === handler
        );

        if (listener) {
            this.eventListeners.delete(listener);
        }
    }

    /**
     * Set a timeout with automatic cleanup
     */
    setTimeout(callback: () => void, delay: number, description?: string): number {
        if (this.disposed) {
            
return -1;
        }

        const id = window.setTimeout(() => {
            this.timers.delete(timerInfo);
            try {
                callback();
            } catch (error) {
                
}
        }, delay);

        const timerInfo: TimerInfo = {
            id,
            type: 'timeout',
            createdAt: Date.now(),
            description
        };

        this.timers.add(timerInfo);
        return id;
    }

    /**
     * Set an interval with automatic cleanup
     */
    setInterval(callback: () => void, delay: number, description?: string): number {
        if (this.disposed) {
            
return -1;
        }

        const id = window.setInterval(() => {
            try {
                callback();
            } catch (error) {
                
}
        }, delay);

        const timerInfo: TimerInfo = {
            id,
            type: 'interval',
            createdAt: Date.now(),
            description
        };

        this.timers.add(timerInfo);
        return id;
    }

    /**
     * Clear a timeout or interval
     */
    clearTimer(id: number): void {
        if (id < 0) return;

        const timerInfo = Array.from(this.timers).find(t => t.id === id);
        if (timerInfo) {
            this.timers.delete(timerInfo);

            if (timerInfo.type === 'timeout') {
                window.clearTimeout(id);
            } else {
                window.clearInterval(id);
            }
        }
    }

    /**
     * Add a custom cleanup task
     */
    addCleanupTask(cleanup: () => void, description?: string): string {
        if (this.disposed) {
            
return '';
        }

        const id = Math.random().toString(36).substr(2, 9);
        const task: CleanupTask = {
            id,
            cleanup,
            description,
            createdAt: Date.now()
        };

        this.cleanupTasks.add(task);
        return id;
    }

    /**
     * Remove a cleanup task
     */
    removeCleanupTask(id: string): void {
        const task = Array.from(this.cleanupTasks).find(t => t.id === id);
        if (task) {
            this.cleanupTasks.delete(task);
        }
    }

    /**
     * Get memory usage statistics
     */
    getMemoryStats(): {
        eventListeners: number;
        timers: number;
        cleanupTasks: number;
        oldestTimer: number | null;
    } {
        const now = Date.now();
        const oldestTimer = Array.from(this.timers).reduce((oldest, timer) => {
            return !oldest || timer.createdAt < oldest ? timer.createdAt : oldest;
        }, null as number | null);

        return {
            eventListeners: this.eventListeners.size,
            timers: this.timers.size,
            cleanupTasks: this.cleanupTasks.size,
            oldestTimer
        };
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        if (this.disposed) {
            return;
        }

        const startTime = performance.now();

        // Cleanup event listeners
        this.eventListeners.forEach(listener => {
            try {
                listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            } catch (error) {
                
}
        });
        this.eventListeners.clear();

        // Cleanup timers
        this.timers.forEach(timer => {
            try {
                if (timer.type === 'timeout') {
                    window.clearTimeout(timer.id);
                } else {
                    window.clearInterval(timer.id);
                }
            } catch (error) {
                
}
        });
        this.timers.clear();

        // Execute cleanup tasks
        this.cleanupTasks.forEach(task => {
            try {
                task.cleanup();
            } catch (error) {
                
}
        });
        this.cleanupTasks.clear();

        this.disposed = true;

        const cleanupTime = performance.now() - startTime;

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('component_cleanup_time', cleanupTime);
        }

        
}ms`);
    }

    /**
     * Check if the component is disposed
     */
    isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Force garbage collection (in development)
     */
    forceGC(): void {
        if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (window.gc) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                window.gc();
            }
        }
    }

    /**
     * Create a weak reference to an object for cleanup
     */
    createWeakRef<T extends object>(obj: T): WeakRef<T> {
        return new WeakRef(obj);
    }

    /**
     * Schedule periodic cleanup
     */
    schedulePeriodicCleanup(intervalMs = 30000): number {
        return this.setInterval(() => {
            const stats = this.getMemoryStats();

            // Log warnings for potential memory leaks
            if (stats.eventListeners > 50) {
                
`);
            }

            if (stats.timers > 20) {
                
`);
            }

            if (stats.oldestTimer && Date.now() - stats.oldestTimer > 300000) { // 5 minutes
                
}

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('memory_stats', stats);
            }
        }, intervalMs, 'periodic-cleanup');
    }
}

// Global component manager for application-wide resource management
export class GlobalComponentManager {
    private static instance: GlobalComponentManager;
    private componentManagers = new Set<ComponentManager>();
    private cleanupTimer?: number;

    private constructor() {
        this.cleanupTimer = window.setInterval(() => {
            this.performHealthCheck();
        }, 60000); // Check every minute
    }

    static getInstance(): GlobalComponentManager {
        if (!GlobalComponentManager.instance) {
            GlobalComponentManager.instance = new GlobalComponentManager();
        }
        return GlobalComponentManager.instance;
    }

    registerComponent(manager: ComponentManager): void {
        this.componentManagers.add(manager);
    }

    unregisterComponent(manager: ComponentManager): void {
        this.componentManagers.delete(manager);
    }

    performHealthCheck(): void {
        let totalListeners = 0;
        let totalTimers = 0;
        let totalCleanupTasks = 0;

        this.componentManagers.forEach(manager => {
            const stats = manager.getMemoryStats();
            totalListeners += stats.eventListeners;
            totalTimers += stats.timers;
            totalCleanupTasks += stats.cleanupTasks;
        });

        if (totalListeners > 200 || totalTimers > 100) {
            
}
    }

    cleanupAll(): void {
        this.componentManagers.forEach(manager => manager.cleanup());
        this.componentManagers.clear();

        if (this.cleanupTimer) {
            window.clearInterval(this.cleanupTimer);
        }
    }
}