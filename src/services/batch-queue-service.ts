/**
 * Enhanced Batch Processing Queue System
 */

export interface BatchJob {
    id: string;
    url: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    priority: number;
    addedAt: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
}

export interface BatchQueueOptions {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
}

export class BatchQueueService {
    private queue: Map<string, BatchJob> = new Map();
    private processing: Set<string> = new Set();
    private options: BatchQueueOptions = {
        concurrency: 3,
        maxRetries: 3,
        retryDelay: 1000,
    };

    constructor(options?: Partial<BatchQueueOptions>) {
        if (options) {
            this.options = { ...this.options, ...options };
        }
    }

    add(url: string, priority: number = 0): string {
        const id = this.generateId();
        const job: BatchJob = {
            id,
            url,
            status: 'pending',
            priority,
            addedAt: Date.now(),
        };

        this.queue.set(id, job);
        void this.processQueue();

        return id;
    }

    private async processQueue(): Promise<void> {
        if (this.processing.size >= this.options.concurrency) {
            return;
        }

        // Get pending jobs sorted by priority
        const pendingJobs = Array.from(this.queue.values())
            .filter(job => job.status === 'pending')
            .sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);

        const availableSlots = this.options.concurrency - this.processing.size;

        for (let i = 0; i < Math.min(availableSlots, pendingJobs.length); i++) {
            const job = pendingJobs[i];
            this.processing.add(job.id);
            void this.processJob(job);
        }
    }

    private async processJob(job: BatchJob): Promise<void> {
        job.status = 'processing';
        job.startedAt = Date.now();

        try {
            // Process the video (this would integrate with actual processing)
            await this.processVideo(job.url);

            job.status = 'completed';
            job.completedAt = Date.now();
        } catch (error) {
            if (job.retries && job.retries < this.options.maxRetries) {
                job.status = 'pending';
                await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
            } else {
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : String(error);
            }
        } finally {
            this.processing.delete(job.id);
            void this.processQueue();
        }
    }

    private async processVideo(url: string): Promise<void> {
        // Integration point with actual video processing
        console.log('Processing video:', url);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    private generateId(): string {
        return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    getJob(id: string): BatchJob | undefined {
        return this.queue.get(id);
    }

    getAllJobs(): BatchJob[] {
        return Array.from(this.queue.values());
    }

    getJobsByStatus(status: BatchJob['status']): BatchJob[] {
        return Array.from(this.queue.values()).filter(job => job.status === status);
    }

    removeJob(id: string): boolean {
        return this.queue.delete(id);
    }

    clear(): void {
        this.queue.clear();
        this.processing.clear();
    }

    getStats() {
        const jobs = Array.from(this.queue.values());
        return {
            total: jobs.length,
            pending: jobs.filter(j => j.status === 'pending').length,
            processing: jobs.filter(j => j.status === 'processing').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            failed: jobs.filter(j => j.status === 'failed').length,
        };
    }
}

export const batchQueueService = new BatchQueueService();
