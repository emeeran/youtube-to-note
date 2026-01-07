/**
 * Offline Mode & Operation Queue Service
 */

export interface QueuedOperation {
    id: string;
    type: 'process-video' | 'fetch-transcript' | 'ai-analysis';
    data: any;
    priority: number;
    timestamp: number;
    retries: number;
    maxRetries: number;
}

export class OfflineModeService {
    private queue: QueuedOperation[] = [];
    private processing: boolean = false;
    private isOnline: boolean = true;

    constructor() {
        this.setupNetworkMonitoring();
    }

    private setupNetworkMonitoring(): void {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.setOnline(true));
            window.addEventListener('offline', () => this.setOnline(false));
        }
    }

    setOnline(online: boolean): void {
        this.isOnline = online;
        if (online && this.queue.length > 0) {
            void this.processQueue();
        }
    }

    enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>): string {
        const queuedOp: QueuedOperation = {
            ...operation,
            id: this.generateId(),
            timestamp: Date.now(),
            retries: 0,
        };

        this.queue.push(queuedOp);
        this.queue.sort((a, b) => b.priority - a.priority);

        if (this.isOnline && !this.processing) {
            void this.processQueue();
        }

        return queuedOp.id;
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0 || !this.isOnline) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.isOnline) {
            const operation = this.queue.shift()!;

            try {
                await this.executeOperation(operation);
            } catch (error) {
                if (operation.retries < operation.maxRetries) {
                    operation.retries++;
                    this.queue.push(operation);
                }
            }
        }

        this.processing = false;
    }

    private async executeOperation(operation: QueuedOperation): Promise<void> {
        // This would integrate with the actual services
        console.log('Executing operation:', operation.id);
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    getQueueStatus(): { length: number; processing: boolean; isOnline: boolean } {
        return {
            length: this.queue.length,
            processing: this.processing,
            isOnline: this.isOnline,
        };
    }

    clearQueue(): void {
        this.queue = [];
    }
}

export const offlineModeService = new OfflineModeService();
