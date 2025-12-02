/**
 * Background Sync Service
 * Handles offline operations, sync queue management, and conflict resolution
 */

import { performanceMonitor } from '../../utils/performance-monitor';

export interface SyncOperation {
    id: string;
    type: 'create' | 'update' | 'delete';
    entityType: 'video' | 'note' | 'settings' | 'cache';
    data: any;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
    priority: 'low' | 'medium' | 'high';
    dependencies?: string[];
    conflictResolution?: 'client' | 'server' | 'merge';
}

export interface SyncResult {
    success: boolean;
    operationId: string;
    timestamp: number;
    error?: string;
    conflict?: {
        type: 'version' | 'data' | 'dependency';
        serverData?: any;
        clientData?: any;
        resolution?: string;
    };
}

export interface SyncStats {
    totalOperations: number;
    pendingOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageSyncTime: number;
    lastSyncTime: number;
    conflicts: number;
}

export interface SyncConfig {
    enableOffline: boolean;
    maxQueueSize: number;
    retryInterval: number;
    maxRetries: number;
    enableConflictResolution: boolean;
    syncOnConnectivity: boolean;
    syncInterval: number;
    batchSize: number;
}

export class BackgroundSyncService {
    private config: SyncConfig;
    private syncQueue: Map<string, SyncOperation> = new Map();
    private processingQueue: Set<string> = new Set();
    private isOnline: boolean = navigator.onLine;
    private syncTimer?: NodeJS.Timeout;
    private conflictResolvers: Map<string, (operation: SyncOperation, serverData: any) => Promise<any>> = new Map();
    private stats: SyncStats;
    private eventListeners: Map<string, (() => void)[]> = new Map();

    constructor(config: Partial<SyncConfig> = {}) {
        this.config = {
            enableOffline: true,
            maxQueueSize: 1000,
            retryInterval: 30000, // 30 seconds
            maxRetries: 3,
            enableConflictResolution: true,
            syncOnConnectivity: true,
            syncInterval: 60000, // 1 minute
            batchSize: 10,
            ...config
        };

        this.stats = this.initializeStats();
        this.initializeEventListeners();
        this.loadPersistedQueue();
    }

    /**
     * Initialize service
     */
    async initialize(): Promise<void> {
        try {
            // Setup periodic sync
            this.setupPeriodicSync();

            // Setup connectivity listeners
            this.setupConnectivityListeners();

            // Process any pending operations
            if (this.isOnline && this.syncQueue.size > 0) {
                await this.processQueue();
            }

            console.log('[Background Sync] Service initialized');

        } catch (error) {
            console.error('[Background Sync] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Add operation to sync queue
     */
    async addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
        const syncOperation: SyncOperation = {
            ...operation,
            id: this.generateId(),
            timestamp: Date.now(),
            retryCount: 0
        };

        // Check queue size limit
        if (this.syncQueue.size >= this.config.maxQueueSize) {
            await this.evictLowPriorityOperations();
        }

        // Handle dependencies
        if (operation.dependencies) {
            await this.validateDependencies(operation.dependencies);
        }

        this.syncQueue.set(syncOperation.id, syncOperation);
        this.stats.totalOperations++;
        this.stats.pendingOperations++;

        // Persist queue
        await this.persistQueue();

        // Try to process immediately if online
        if (this.isOnline && !this.processingQueue.has(syncOperation.id)) {
            await this.processOperation(syncOperation);
        }

        console.log(`[Background Sync] Added operation: ${syncOperation.type} ${syncOperation.entityType}`);
        return syncOperation.id;
    }

    /**
     * Remove operation from queue
     */
    async removeOperation(operationId: string): Promise<boolean> {
        const removed = this.syncQueue.delete(operationId);
        this.processingQueue.delete(operationId);

        if (removed) {
            this.stats.pendingOperations--;
            await this.persistQueue();
        }

        return removed;
    }

    /**
     * Update operation in queue
     */
    async updateOperation(operationId: string, updates: Partial<SyncOperation>): Promise<boolean> {
        const operation = this.syncQueue.get(operationId);
        if (!operation) {
            return false;
        }

        const updatedOperation = { ...operation, ...updates };
        this.syncQueue.set(operationId, updatedOperation);
        await this.persistQueue();

        return true;
    }

    /**
     * Process sync queue
     */
    async processQueue(): Promise<SyncResult[]> {
        if (!this.isOnline || this.syncQueue.size === 0) {
            return [];
        }

        const startTime = performance.now();
        const results: SyncResult[] = [];

        try {
            // Sort operations by priority and timestamp
            const operations = Array.from(this.syncQueue.values())
                .sort((a, b) => {
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                    return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
                })
                .slice(0, this.config.batchSize);

            // Process operations in batches
            for (const operation of operations) {
                if (this.processingQueue.has(operation.id)) {
                    continue; // Skip if already processing
                }

                this.processingQueue.add(operation.id);
                const result = await this.processOperation(operation);
                results.push(result);
                this.processingQueue.delete(operation.id);

                // Update stats
                if (result.success) {
                    this.stats.successfulOperations++;
                    await this.removeOperation(operation.id);
                } else {
                    this.stats.failedOperations++;

                    // Retry logic
                    if (operation.retryCount < operation.maxRetries) {
                        await this.updateOperation(operation.id, {
                            retryCount: operation.retryCount + 1,
                            timestamp: Date.now()
                        });
                    } else {
                        // Max retries reached, remove operation
                        await this.removeOperation(operation.id);
                    }
                }
            }

            // Update sync time
            const processingTime = performance.now() - startTime;
            this.updateAverageSyncTime(processingTime);
            this.stats.lastSyncTime = Date.now();

            console.log(`[Background Sync] Processed ${results.length} operations in ${processingTime.toFixed(2)}ms`);

        } catch (error) {
            console.error('[Background Sync] Queue processing failed:', error);
        }

        return results;
    }

    /**
     * Process individual operation
     */
    private async processOperation(operation: SyncOperation): Promise<SyncResult> {
        return await performanceMonitor.measureOperation(`sync-operation-${operation.id}`, async () => {
            const startTime = performance.now();

            try {
                // Validate dependencies
                if (operation.dependencies) {
                    await this.validateDependencies(operation.dependencies);
                }

                // Execute operation based on type
                let result: any;

                switch (operation.type) {
                    case 'create':
                        result = await this.executeCreate(operation);
                        break;
                    case 'update':
                        result = await this.executeUpdate(operation);
                        break;
                    case 'delete':
                        result = await this.executeDelete(operation);
                        break;
                    default:
                        throw new Error(`Unknown operation type: ${operation.type}`);
                }

                return {
                    success: true,
                    operationId: operation.id,
                    timestamp: Date.now()
                };

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                // Check for conflicts
                if (this.isConflictError(error)) {
                    const conflict = await this.handleConflict(operation, error);
                    this.stats.conflicts++;

                    return {
                        success: false,
                        operationId: operation.id,
                        timestamp: Date.now(),
                        error: errorMessage,
                        conflict
                    };
                }

                return {
                    success: false,
                    operationId: operation.id,
                    timestamp: Date.now(),
                    error: errorMessage
                };
            }
        }, {
            operation: 'processOperation',
            type: operation.type,
            entityType: operation.entityType
        });
    }

    /**
     * Execute create operation
     */
    private async executeCreate(operation: SyncOperation): Promise<any> {
        // Implementation would depend on your API/client
        // This is a placeholder for the actual create logic
        console.log('[Background Sync] Executing create:', operation.entityType);

        // Simulate API call
        await this.simulateNetworkCall();

        return {
            id: operation.id,
            ...operation.data,
            createdAt: Date.now()
        };
    }

    /**
     * Execute update operation
     */
    private async executeUpdate(operation: SyncOperation): Promise<any> {
        console.log('[Background Sync] Executing update:', operation.entityType);

        await this.simulateNetworkCall();

        return {
            ...operation.data,
            updatedAt: Date.now()
        };
    }

    /**
     * Execute delete operation
     */
    private async executeDelete(operation: SyncOperation): Promise<void> {
        console.log('[Background Sync] Executing delete:', operation.entityType);

        await this.simulateNetworkCall();
    }

    /**
     * Handle sync conflicts
     */
    private async handleConflict(operation: SyncOperation, error: any): Promise<any> {
        if (!this.config.enableConflictResolution) {
            return {
                type: 'data',
                resolution: 'pending'
            };
        }

        // Extract server data from error if available
        const serverData = this.extractServerData(error);

        // Try conflict resolution strategy
        switch (operation.conflictResolution) {
            case 'client':
                return {
                    type: 'data',
                    serverData,
                    clientData: operation.data,
                    resolution: 'client-wins'
                };

            case 'server':
                return {
                    type: 'data',
                    serverData,
                    clientData: operation.data,
                    resolution: 'server-wins'
                };

            case 'merge':
                return await this.mergeConflict(operation, serverData);

            default:
                return {
                    type: 'data',
                    serverData,
                    clientData: operation.data,
                    resolution: 'manual'
                };
        }
    }

    /**
     * Merge conflicting data
     */
    private async mergeConflict(operation: SyncOperation, serverData: any): Promise<any> {
        // Custom merge logic would go here
        // For now, simple client priority merge
        return {
            ...serverData,
            ...operation.data,
            _conflict: 'merged',
            _mergedAt: Date.now()
        };
    }

    /**
     * Check if error is a conflict
     */
    private isConflictError(error: any): boolean {
        // Implementation would depend on your API error format
        return (
            error.status === 409 ||
            error.message?.toLowerCase().includes('conflict') ||
            error.message?.toLowerCase().includes('version')
        );
    }

    /**
     * Extract server data from error
     */
    private extractServerData(error: any): any {
        // Implementation would depend on your API error format
        return error.data || error.serverData || null;
    }

    /**
     * Validate operation dependencies
     */
    private async validateDependencies(dependencies: string[]): Promise<void> {
        for (const depId of dependencies) {
            if (this.syncQueue.has(depId)) {
                const dependency = this.syncQueue.get(depId)!;
                if (dependency.retryCount >= dependency.maxRetries) {
                    throw new Error(`Dependency failed: ${depId}`);
                }
            }
        }
    }

    /**
     * Evict low priority operations when queue is full
     */
    private async evictLowPriorityOperations(): Promise<void> {
        const operations = Array.from(this.syncQueue.values())
            .filter(op => op.priority === 'low')
            .sort((a, b) => a.timestamp - b.timestamp);

        const toRemove = Math.min(operations.length, 50); // Remove 50 low priority ops

        for (let i = 0; i < toRemove; i++) {
            await this.removeOperation(operations[i].id);
        }

        console.log(`[Background Sync] Evicted ${toRemove} low priority operations`);
    }

    /**
     * Setup periodic sync
     */
    private setupPeriodicSync(): void {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(() => {
            if (this.isOnline) {
                this.processQueue().catch(error => {
                    console.error('[Background Sync] Periodic sync failed:', error);
                });
            }
        }, this.config.syncInterval);
    }

    /**
     * Setup connectivity listeners
     */
    private setupConnectivityListeners(): void {
        const handleOnline = () => {
            this.isOnline = true;
            console.log('[Background Sync] Online - processing queue');

            if (this.config.syncOnConnectivity) {
                this.processQueue().catch(error => {
                    console.error('[Background Sync] Connectivity sync failed:', error);
                });
            }
        };

        const handleOffline = () => {
            this.isOnline = false;
            console.log('[Background Sync] Offline - queueing operations');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Store listeners for cleanup
        this.addEventListener('connectivity', handleOnline);
        this.addEventListener('connectivity', handleOffline);
    }

    /**
     * Initialize event listeners
     */
    private initializeEventListeners(): void {
        // This would handle other application events
        // For now, it's a placeholder
    }

    /**
     * Add event listener
     */
    private addEventListener(type: string, listener: () => void): void {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, []);
        }
        this.eventListeners.get(type)!.push(listener);
    }

    /**
     * Remove event listeners
     */
    private removeEventListeners(type: string): void {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            listeners.forEach(listener => listener());
            this.eventListeners.delete(type);
        }
    }

    /**
     * Persist queue to storage
     */
    private async persistQueue(): Promise<void> {
        try {
            const queueData = Array.from(this.syncQueue.entries());
            localStorage.setItem('yt-clipper-sync-queue', JSON.stringify(queueData));
        } catch (error) {
            console.warn('[Background Sync] Failed to persist queue:', error);
        }
    }

    /**
     * Load persisted queue
     */
    private loadPersistedQueue(): void {
        try {
            const queueData = localStorage.getItem('yt-clipper-sync-queue');
            if (queueData) {
                const parsed = JSON.parse(queueData);
                this.syncQueue = new Map(parsed);
                this.stats.pendingOperations = this.syncQueue.size;
                console.log(`[Background Sync] Loaded ${this.syncQueue.size} persisted operations`);
            }
        } catch (error) {
            console.warn('[Background Sync] Failed to load persisted queue:', error);
        }
    }

    /**
     * Initialize stats
     */
    private initializeStats(): SyncStats {
        return {
            totalOperations: 0,
            pendingOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            averageSyncTime: 0,
            lastSyncTime: 0,
            conflicts: 0
        };
    }

    /**
     * Update average sync time
     */
    private updateAverageSyncTime(newTime: number): void {
        this.stats.averageSyncTime = (
            this.stats.averageSyncTime * 0.9 + newTime * 0.1
        );
    }

    /**
     * Simulate network call (for testing)
     */
    private async simulateNetworkCall(): Promise<void> {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

        // Simulate occasional failures (5% failure rate)
        if (Math.random() < 0.05) {
            throw new Error('Network request failed');
        }
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get current stats
     */
    getStats(): SyncStats {
        return {
            ...this.stats,
            pendingOperations: this.syncQueue.size
        };
    }

    /**
     * Get pending operations
     */
    getPendingOperations(): SyncOperation[] {
        return Array.from(this.syncQueue.values());
    }

    /**
     * Force sync of all pending operations
     */
    async forceSync(): Promise<SyncResult[]> {
        return await this.processQueue();
    }

    /**
     * Clear all pending operations
     */
    async clearQueue(): Promise<void> {
        this.syncQueue.clear();
        this.processingQueue.clear();
        await this.persistQueue();
        this.stats.pendingOperations = 0;
        console.log('[Background Sync] Queue cleared');
    }

    /**
     * Register conflict resolver
     */
    registerConflictResolver(entityType: string, resolver: (operation: SyncOperation, serverData: any) => Promise<any>): void {
        this.conflictResolvers.set(entityType, resolver);
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<SyncConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // Restart periodic sync if interval changed
        if (newConfig.syncInterval) {
            this.setupPeriodicSync();
        }
    }

    /**
     * Cleanup service
     */
    async destroy(): Promise<void> {
        // Clear timers
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        // Remove event listeners
        this.removeEventListeners('connectivity');

        // Clear data
        this.syncQueue.clear();
        this.processingQueue.clear();
        this.conflictResolvers.clear();
        this.eventListeners.clear();

        console.log('[Background Sync] Service destroyed');
    }
}

// Export singleton instance
export const backgroundSync = new BackgroundSyncService();