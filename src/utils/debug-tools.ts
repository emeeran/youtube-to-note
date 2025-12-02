import { CircuitBreakerRegistry } from './circuit-breaker';
import { NetworkOptimizer } from './network-optimizer';
import { PerformanceMonitor } from './performance-monitor';
import { StateManager } from './state-manager';
import { WorkerSystem } from './worker-system';


export interface DebugConfig {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxLogEntries: number;
    persistLogs: boolean;
    enablePerformanceProfiling: boolean;
    enableMemoryTracking: boolean;
    enableNetworkInspector: boolean;
    enableStateInspector: boolean;
    enableComponentInspector: boolean;
}

export interface LogEntry {
    timestamp: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    category: string;
    message: string;
    data?: any;
    stack?: string;
    duration?: number;
    component?: string;
}

export interface PerformanceProfile {
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    memoryUsage?: number;
    callStack: string[];
    metadata: Record<string, any>;
}

export interface DebugSnapshot {
    timestamp: number;
    logs: LogEntry[];
    performanceProfiles: PerformanceProfile[];
    systemState: {
        memory: any;
        network: any;
        workers: any;
        circuitBreakers: any;
        cache: any;
        state: any;
    };
    config: DebugConfig;
}

/**
 * Comprehensive debugging and developer tools suite
 */
export class DebugTools {
    private static instance: DebugTools;
    private config: DebugConfig;
    private logs: LogEntry[] = [];
    private performanceProfiles: PerformanceProfile[] = [];
    private activeProfiles = new Map<string, PerformanceProfile>();
    private performanceMonitor?: PerformanceMonitor;
    private stateManager?: StateManager;
    private networkOptimizer?: NetworkOptimizer;
    private workerSystem?: WorkerSystem;
    private debugPanel?: HTMLElement;
    private logBufferSize = 1000;
    private isEnabled = false;

    private constructor(config: Partial<DebugConfig> = {}) {
        this.config = {
            enabled: true,
            logLevel: 'debug',
            maxLogEntries: 1000,
            persistLogs: true,
            enablePerformanceProfiling: true,
            enableMemoryTracking: true,
            enableNetworkInspector: true,
            enableStateInspector: true,
            enableComponentInspector: true,
            ...config
        };

        this.initialize();
    }

    static getInstance(config?: Partial<DebugConfig>): DebugTools {
        if (!DebugTools.instance) {
            DebugTools.instance = new DebugTools(config);
        }
        return DebugTools.instance;
    }

    private initialize(): void {
        if (!this.config.enabled) return;

        this.isEnabled = true;

        // Load persisted logs if enabled
        if (this.config.persistLogs) {
            this.loadPersistedLogs();
        }

        // Set up global error handlers
        this.setupGlobalErrorHandlers();

        // Create debug panel if in development
        if (process.env.NODE_ENV === 'development') {
            this.createDebugPanel();
        }

        // Override console methods for enhanced logging
        this.overrideConsole();

        
}

    private setupGlobalErrorHandlers(): void {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.error('Global Error', event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection', event.reason, {
                promise: event.promise
            });
        });
    }

    private overrideConsole(): void {
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };

        const createLogMethod = (level: LogEntry['level'], originalMethod: (...args: any[]) => void) => {
            return (...args: any[]) => {
                // Call original method
                originalMethod.apply(console, args);

                // Add to debug logs
                if (this.isEnabled) {
                    const message = args.map(arg => {
                        if (typeof arg === 'object') {
                            try {
                                return JSON.stringify(arg, null, 2);
                            } catch {
                                return String(arg);
                            }
                        }
                        return String(arg);
                    }).join(' ');

                    this.log(level, 'Console', message, args.length > 1 ? args[1] : undefined);
                }
            };
        };

        console.log = createLogMethod('debug', originalConsole.log);
        console.info = createLogMethod('info', originalConsole.info);
        console.warn = createLogMethod('warn', originalConsole.warn);
        console.error = createLogMethod('error', originalConsole.error);
        console.debug = createLogMethod('debug', originalConsole.debug);
    }

    private createDebugPanel(): void {
        // Create debug panel container
        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'ytclipper-debug-panel';
        this.debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            height: 600px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            padding: 16px;
            font-family: var(--font-monospace);
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            display: none;
        `;

        // Create debug panel content
        this.debugPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: var(--text-normal);">🔧 Debug Panel</h3>
                <button id="debug-close" style="background: none; border: none; cursor: pointer;">❌</button>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button id="debug-logs" class="debug-tab-btn" style="padding: 4px 8px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer;">Logs</button>
                <button id="debug-performance" class="debug-tab-btn" style="padding: 4px 8px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer;">Performance</button>
                <button id="debug-network" class="debug-tab-btn" style="padding: 4px 8px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer;">Network</button>
                <button id="debug-state" class="debug-tab-btn" style="padding: 4px 8px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer;">State</button>
            </div>

            <div id="debug-content" style="height: calc(100% - 120px); overflow-y: auto; background: var(--background-primary); padding: 8px; border-radius: 4px;">
                <div id="debug-logs-content" class="debug-tab-content"></div>
                <div id="debug-performance-content" class="debug-tab-content" style="display: none;"></div>
                <div id="debug-network-content" class="debug-tab-content" style="display: none;"></div>
                <div id="debug-state-content" class="debug-tab-content" style="display: none;"></div>
            </div>

            <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button id="debug-export" style="padding: 4px 8px; border: 1px solid var(--background-modifier-border); background: var(--interactive-accent); color: var(--text-on-accent); cursor: pointer;">Export</button>
                <button id="debug-clear" style="padding: 4px 8px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer;">Clear</button>
                <button id="debug-memory" style="padding: 4px 8px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer;">Memory</button>
            </div>
        `;

        document.body.appendChild(this.debugPanel);

        // Set up event listeners
        this.setupDebugPanelEvents();
    }

    private setupDebugPanelEvents(): void {
        if (!this.debugPanel) return;

        // Tab switching
        const tabButtons = this.debugPanel.querySelectorAll('.debug-tab-btn');
        const tabContents = this.debugPanel.querySelectorAll('.debug-tab-content');

        tabButtons.forEach((button, index) => {
            button.addEventListener('click', () => {
                // Hide all tabs
                tabContents.forEach(content => content.style.display = 'none');
                tabButtons.forEach(btn => btn.style.background = 'var(--background-primary)');

                // Show selected tab
                tabContents[index].style.display = 'block';
                (button as HTMLElement).style.background = 'var(--interactive-accent)';

                // Update content
                this.updateDebugContent(index);
            });
        });

        // Close button
        const closeButton = this.debugPanel.querySelector('#debug-close');
        closeButton?.addEventListener('click', () => {
            this.hideDebugPanel();
        });

        // Action buttons
        document.getElementById('debug-export')?.addEventListener('click', () => {
            this.exportDebugData();
        });

        document.getElementById('debug-clear')?.addEventListener('click', () => {
            this.clearDebugData();
        });

        document.getElementById('debug-memory')?.addEventListener('click', () => {
            this.forceGarbageCollection();
        });
    }

    private updateDebugContent(tabIndex: number): void {
        if (!this.debugPanel) return;

        switch (tabIndex) {
            case 0: // Logs
                this.updateLogsContent();
                break;
            case 1: // Performance
                this.updatePerformanceContent();
                break;
            case 2: // Network
                this.updateNetworkContent();
                break;
            case 3: // State
                this.updateStateContent();
                break;
        }
    }

    private updateLogsContent(): void {
        const content = document.getElementById('debug-logs-content');
        if (!content) return;

        const recentLogs = this.logs.slice(-50).reverse();
        const logHtml = recentLogs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const color = this.getLogLevelColor(log.level);
            const dataStr = log.data ? ` - ${JSON.stringify(log.data, null, 2)}` : '';

            return `
                <div style="margin-bottom: 4px; padding: 4px; border-left: 3px solid ${color}; background: var(--background-secondary);">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted); font-size: 10px;">${timestamp}</span>
                        <span style="color: ${color}; font-weight: bold;">${log.level.toUpperCase()}</span>
                    </div>
                    <div style="color: var(--text-normal); margin-top: 2px;">
                        <strong>${log.category}:</strong> ${log.message}
                    </div>
                    ${dataStr ? `<pre style="margin: 4px 0; font-size: 10px; color: var(--text-muted); white-space: pre-wrap;">${dataStr}</pre>` : ''}
                </div>
            `;
        }).join('');

        content.innerHTML = logHtml || '<div style="color: var(--text-muted); text-align: center;">No logs</div>';
    }

    private updatePerformanceContent(): void {
        const content = document.getElementById('debug-performance-content');
        if (!content) return;

        const recentProfiles = this.performanceProfiles.slice(-10);
        const profileHtml = recentProfiles.map(profile => `
            <div style="margin-bottom: 8px; padding: 8px; background: var(--background-secondary); border-radius: 4px;">
                <div style="display: flex; justify-content: space-between;">
                    <strong>${profile.name}</strong>
                    <span style="color: var(--text-muted);">${profile.duration.toFixed(2)}ms</span>
                </div>
                <div style="color: var(--text-muted); font-size: 10px; margin-top: 4px;">
                    Start: ${new Date(profile.startTime).toLocaleTimeString()} |
                    End: ${new Date(profile.endTime).toLocaleTimeString()}
                </div>
                ${profile.memoryUsage ? `<div style="color: var(--text-muted); font-size: 10px;">Memory: ${(profile.memoryUsage / 1024 / 1024).toFixed(2)}MB</div>` : ''}
            </div>
        `).join('');

        const systemMetrics = this.getSystemMetrics();
        const metricsHtml = `
            <div style="margin-bottom: 16px; padding: 8px; background: var(--background-primary); border-radius: 4px;">
                <h4 style="margin: 0 0 8px 0; color: var(--text-normal);">System Metrics</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <div>Memory: ${(systemMetrics.memory / 1024 / 1024).toFixed(2)}MB</div>
                    <div>Performance: ${systemMetrics.performance.toFixed(2)}</div>
                    <div>Active Workers: ${systemMetrics.workers}</div>
                    <div>Network Requests: ${systemMetrics.networkRequests}</div>
                </div>
            </div>
        `;

        content.innerHTML = metricsHtml + (profileHtml || '<div style="color: var(--text-muted); text-align: center;">No performance profiles</div>');
    }

    private updateNetworkContent(): void {
        const content = document.getElementById('debug-network-content');
        if (!content) return;

        const networkMetrics = this.networkOptimizer?.getMetrics();
        if (!networkMetrics) {
            content.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Network optimizer not available</div>';
            return;
        }

        const networkHtml = `
            <div style="padding: 8px; background: var(--background-secondary); border-radius: 4px;">
                <h4 style="margin: 0 0 8px 0; color: var(--text-normal);">Network Metrics</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <div>Total Requests: ${networkMetrics.totalRequests}</div>
                    <div>Success Rate: ${((networkMetrics.successfulRequests / networkMetrics.totalRequests) * 100).toFixed(1)}%</div>
                    <div>Avg Response: ${networkMetrics.averageResponseTime.toFixed(2)}ms</div>
                    <div>Error Rate: ${networkMetrics.errorRate.toFixed(1)}%</div>
                    <div>Cache Hits: ${networkMetrics.cacheHits}</div>
                    <div>Cache Misses: ${networkMetrics.cacheMisses}</div>
                    <div>Data Transfer: ${(networkMetrics.totalDataTransferred / 1024).toFixed(2)}KB</div>
                    <div>Circuit Trips: ${networkMetrics.circuitBreakerTrips}</div>
                </div>
            </div>
        `;

        content.innerHTML = networkHtml;
    }

    private updateStateContent(): void {
        const content = document.getElementById('debug-state-content');
        if (!content) return;

        const stateMetrics = this.stateManager?.getMetrics();
        if (!stateMetrics) {
            content.innerHTML = '<div style="color: var(--text-muted); text-align: center;">State manager not available</div>';
            return;
        }

        const stateHtml = `
            <div style="padding: 8px; background: var(--background-secondary); border-radius: 4px;">
                <h4 style="margin: 0 0 8px 0; color: var(--text-normal);">State Metrics</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <div>Total Keys: ${stateMetrics.totalKeys}</div>
                    <div>Subscribers: ${stateMetrics.totalSubscribers}</div>
                    <div>Sets/sec: ${stateMetrics.setsPerSecond.toFixed(2)}</div>
                    <div>Gets/sec: ${stateMetrics.getsPerSecond.toFixed(2)}</div>
                    <div>Avg State Size: ${(stateMetrics.averageStateSize / 1024).toFixed(2)}KB</div>
                    <div>Memory: ${(stateMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB</div>
                    <div>Errors: ${stateMetrics.errorCount}</div>
                    <div>Last Activity: ${new Date(stateMetrics.lastActivity).toLocaleTimeString()}</div>
                </div>
            </div>
        `;

        content.innerHTML = stateHtml;
    }

    private getLogLevelColor(level: LogEntry['level']): string {
        const colors = {
            debug: 'var(--text-muted)',
            info: 'var(--color-blue)',
            warn: 'var(--color-orange)',
            error: 'var(--color-red)'
        };
        return colors[level];
    }

    private getSystemMetrics() {
        const memory = (performance as any).memory || { usedJSHeapSize: 0 };
        const performanceMetrics = this.performanceMonitor?.getMetrics() || { averageResponseTime: 0 };
        const workerMetrics = this.workerSystem?.getMetrics() || { activeWorkers: 0 };
        const networkMetrics = this.networkOptimizer?.getMetrics() || { totalRequests: 0 };

        return {
            memory: memory.usedJSHeapSize || 0,
            performance: performanceMetrics.averageResponseTime,
            workers: workerMetrics.activeWorkers,
            networkRequests: networkMetrics.totalRequests
        };
    }

    // Public logging methods
    debug(message: string, data?: any, component?: string): void {
        this.addLog('debug', 'Debug', message, data, component);
    }

    info(message: string, data?: any, component?: string): void {
        this.addLog('info', 'Info', message, data, component);
    }

    warn(message: string, data?: any, component?: string): void {
        this.addLog('warn', 'Warning', message, data, component);
    }

    error(message: string, error?: Error | any, data?: any, component?: string): void {
        const errorData = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : error;

        this.addLog('error', 'Error', message, { ...data, error: errorData }, component);
    }

    private addLog(level: LogEntry['level'], category: string, message: string, data?: any, component?: string): void {
        if (!this.isEnabled) return;

        const logEntry: LogEntry = {
            timestamp: Date.now(),
            level,
            category,
            message,
            data,
            component
        };

        this.logs.push(logEntry);

        // Keep only recent logs
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs = this.logs.slice(-this.config.maxLogEntries);
        }

        // Persist logs if enabled
        if (this.config.persistLogs) {
            this.persistLogs();
        }

        // Update debug panel if visible
        if (this.debugPanel && this.debugPanel.style.display !== 'none') {
            this.updateLogsContent();
        }
    }

    private loadPersistedLogs(): void {
        try {
            const persisted = localStorage.getItem('ytclipper_debug_logs');
            if (persisted) {
                this.logs = JSON.parse(persisted);
            }
        } catch (error) {
            
}
    }

    private persistLogs(): void {
        try {
            localStorage.setItem('ytclipper_debug_logs', JSON.stringify(this.logs));
        } catch (error) {
            
}
    }

    // Performance profiling
    startProfile(name: string, metadata?: Record<string, any>): string {
        const profileId = Math.random().toString(36).substr(2, 9);

        const profile: PerformanceProfile = {
            name,
            startTime: performance.now(),
            endTime: 0,
            duration: 0,
            callStack: this.getCallStack(),
            metadata: metadata || {}
        };

        // Get current memory usage if available
        if (this.config.enableMemoryTracking && (performance as any).memory) {
            profile.memoryUsage = (performance as any).memory.usedJSHeapSize;
        }

        this.activeProfiles.set(profileId, profile);

        if (this.config.enablePerformanceProfiling) {
            this.debug(`Profile started: ${name}`, metadata, 'Performance');
        }

        return profileId;
    }

    endProfile(profileId: string, additionalMetadata?: Record<string, any>): PerformanceProfile | null {
        const profile = this.activeProfiles.get(profileId);
        if (!profile) return null;

        profile.endTime = performance.now();
        profile.duration = profile.endTime - profile.startTime;

        // Add final memory usage if available
        if (this.config.enableMemoryTracking && (performance as any).memory) {
            const currentMemory = (performance as any).memory.usedJSHeapSize;
            if (profile.memoryUsage) {
                profile.metadata.memoryDelta = currentMemory - profile.memoryUsage;
            }
        }

        // Add additional metadata
        if (additionalMetadata) {
            profile.metadata = { ...profile.metadata, ...additionalMetadata };
        }

        this.activeProfiles.delete(profileId);
        this.performanceProfiles.push(profile);

        // Keep only recent profiles
        if (this.performanceProfiles.length > 100) {
            this.performanceProfiles = this.performanceProfiles.slice(-100);
        }

        if (this.config.enablePerformanceProfiling) {
            this.debug(`Profile ended: ${profile.name}`, {
                duration: profile.duration,
                metadata: profile.metadata
            }, 'Performance');
        }

        return profile;
    }

    profileAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
        const profileId = this.startProfile(name, metadata);

        return fn().finally(() => {
            this.endProfile(profileId);
        });
    }

    private getCallStack(): string[] {
        try {
            const stack = new Error().stack;
            if (!stack) return [];

            return stack.split('\n')
                .slice(3) // Skip Error constructor and this function
                .map(line => line.trim())
                .filter(line => line && !line.includes('at DebugTools.'))
                .slice(0, 5); // Keep only top 5 frames
        } catch {
            return [];
        }
    }

    // Debug panel controls
    showDebugPanel(): void {
        if (this.debugPanel) {
            this.debugPanel.style.display = 'block';
            this.updateLogsContent();
        }
    }

    hideDebugPanel(): void {
        if (this.debugPanel) {
            this.debugPanel.style.display = 'none';
        }
    }

    toggleDebugPanel(): void {
        if (this.debugPanel) {
            if (this.debugPanel.style.display === 'none') {
                this.showDebugPanel();
            } else {
                this.hideDebugPanel();
            }
        }
    }

    // Data management
    exportDebugData(): DebugSnapshot {
        const snapshot: DebugSnapshot = {
            timestamp: Date.now(),
            logs: [...this.logs],
            performanceProfiles: [...this.performanceProfiles],
            systemState: {
                memory: (performance as any).memory || {},
                network: this.networkOptimizer?.getMetrics(),
                workers: this.workerSystem?.getMetrics(),
                circuitBreakers: CircuitBreakerRegistry.getInstance().getAllMetrics(),
                cache: this.getCacheMetrics(),
                state: this.stateManager?.getMetrics()
            },
            config: { ...this.config }
        };

        // Export to file
        this.downloadDebugData(snapshot);

        return snapshot;
    }

    private downloadDebugData(snapshot: DebugSnapshot): void {
        const dataStr = JSON.stringify(snapshot, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ytclipper-debug-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    clearDebugData(): void {
        this.logs = [];
        this.performanceProfiles = [];
        this.activeProfiles.clear();

        if (this.config.persistLogs) {
            localStorage.removeItem('ytclipper_debug_logs');
        }

        this.debug('Debug data cleared', undefined, 'DebugTools');
    }

    forceGarbageCollection(): void {
        if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (window.gc) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                window.gc();
                this.debug('Forced garbage collection', undefined, 'DebugTools');
            }
        }
    }

    private getCacheMetrics() {
        // This would need to be implemented based on cache system
        return {
            size: 0,
            hits: 0,
            misses: 0,
            hitRate: 0
        };
    }

    // Integration methods
    setPerformanceMonitor(monitor: PerformanceMonitor): void {
        this.performanceMonitor = monitor;
    }

    setStateManager(manager: StateManager): void {
        this.stateManager = manager;
    }

    setNetworkOptimizer(optimizer: NetworkOptimizer): void {
        this.networkOptimizer = optimizer;
    }

    setWorkerSystem(system: WorkerSystem): void {
        this.workerSystem = system;
    }

    // Utility methods
    isEnabled(): boolean {
        return this.isEnabled;
    }

    enable(): void {
        this.isEnabled = true;
        this.config.enabled = true;
    }

    disable(): void {
        this.isEnabled = false;
        this.config.enabled = false;
    }

    updateConfig(newConfig: Partial<DebugConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.isEnabled = this.config.enabled;
    }

    getConfig(): DebugConfig {
        return { ...this.config };
    }

    // Simulate failures for testing
    simulateNetworkFailure(duration: number = 5000): void {
        this.debug(`Simulating network failure for ${duration}ms`, undefined, 'DebugTools');
        // Implementation would depend on network optimizer
    }

    simulateMemoryPressure(): void {
        this.debug('Simulating memory pressure', undefined, 'DebugTools');
        // Create some memory pressure for testing
        const arrays = [];
        for (let i = 0; i < 100; i++) {
            arrays.push(new Array(1000000).fill(Math.random()));
        }
        setTimeout(() => arrays.length = 0, 2000); // Clean up after 2 seconds
    }

    // Component inspection
    inspectComponent(component: any, name: string): void {
        if (!this.config.enableComponentInspector) return;

        const componentInfo = {
            name,
            type: component.constructor?.name || 'Unknown',
            props: component.props || {},
            state: component.state || {},
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(component))
                .filter(name => typeof component[name] === 'function')
        };

        this.debug(`Component inspection: ${name}`, componentInfo, 'ComponentInspector');
    }

    // Cleanup
    cleanup(): void {
        this.clearDebugData();

        if (this.debugPanel && this.debugPanel.parentNode) {
            this.debugPanel.parentNode.removeChild(this.debugPanel);
        }

        this.isEnabled = false;
    }
}

// Global debug instance
export const debug = DebugTools.getInstance();