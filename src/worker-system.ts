import { PerformanceMonitor } from './performance-monitor';


export interface WorkerTask<T = any, R = any> {
    id: string;
    type: string;
    data: T;
    priority: 'low' | 'normal' | 'high' | 'critical';
    timeout?: number;
    retries?: number;
    onProgress?: (progress: number) => void;
    onComplete?: (result: R) => void;
    onError?: (error: Error) => void;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
}

export interface WorkerMessage<T = any> {
    id: string;
    type: 'task' | 'cancel' | 'ping' | 'terminate';
    data?: T;
    timestamp: number;
}

export interface WorkerResponse<R = any> {
    id: string;
    type: 'result' | 'error' | 'progress' | 'pong';
    data?: R;
    error?: string;
    timestamp: number;
    workerId: string;
}

export interface WorkerPoolConfig {
    maxSize: number;
    minSize: number;
    maxTaskTime: number;
    workerTimeout: number;
    restartThreshold: number;
    scriptPath?: string;
}

export interface WorkerMetrics {
    activeWorkers: number;
    totalWorkers: number;
    queuedTasks: number;
    processingTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskTime: number;
    workerUtilization: number;
    memoryUsage: number;
}

/**
 * Task that can be executed in a web worker
 */
export abstract class WorkerTaskImpl<T = any, R = any> {
    abstract readonly type: string;
    abstract readonly priority: WorkerTask['priority'];

    constructor(public data: T) {}

    abstract execute(data: T): Promise<R>;

    serialize(): WorkerTask<T, R> {
        return {
            id: Math.random().toString(36).substr(2, 9),
            type: this.type,
            data: this.data,
            priority: this.priority,
            createdAt: Date.now()
        };
    }
}

/**
 * AI Processing Task
 */
export class AIProcessingTask extends WorkerTaskImpl<{
    prompt: string;
    provider: string;
    model?: string;
    apiKey?: string;
    options?: any;
}, {
    content: string;
    provider: string;
    model: string;
    processingTime: number;
}> {
    readonly type = 'ai-processing';
    readonly priority = 'high';

    async execute(data: this['data']): Promise<this['result']> {
        // Implementation would be moved to worker
        throw new Error('This should only be executed in worker');
    }
}

/**
 * Video Processing Task
 */
export class VideoProcessingTask extends WorkerTaskImpl<{
    videoId: string;
    transcript?: string;
    options?: any;
}, {
    summary: string;
    keyMoments: any[];
    processingTime: number;
}> {
    readonly type = 'video-processing';
    readonly priority = 'normal';

    async execute(data: this['data']): Promise<this['result']> {
        throw new Error('This should only be executed in worker');
    }
}

/**
 * Compression Task
 */
export class CompressionTask extends WorkerTaskImpl<{
    data: any;
    algorithm?: string;
    level?: number;
}, {
    compressedData: Uint8Array;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
}> {
    readonly type = 'compression';
    readonly priority = 'low';

    async execute(data: this['data']): Promise<this['result']> {
        throw new Error('This should only be executed in worker');
    }
}

/**
 * Individual worker wrapper
 */
class WorkerWrapper {
    private worker?: Worker;
    private isAlive = false;
    private isBusy = false;
    private currentTask?: string;
    private lastActivity = Date.now();
    private taskCount = 0;
    private errorCount = 0;
    private startTime = Date.now();

    constructor(
        public id: string,
        private scriptPath: string,
        private onMessage: (response: WorkerResponse) => void,
        private onError: (error: Error, workerId: string) => void
    ) {
        this.start();
    }

    private start(): void {
        try {
            this.worker = new Worker(this.scriptPath);
            this.isAlive = true;
            this.startTime = Date.now();

            this.worker.onmessage = (event) => {
                this.lastActivity = Date.now();
                this.onMessage({
                    ...event.data,
                    workerId: this.id
                } as WorkerResponse);
            };

            this.worker.onerror = (error) => {
                this.errorCount++;
                this.onError(new Error(`Worker error: ${error.message}`), this.id);
            };

            this.worker.onmessageerror = (error) => {
                this.errorCount++;
                this.onError(new Error(`Worker message error: ${error}`), this.id);
            };

            // Send initial ping
            this.ping();
        } catch (error) {
            this.onError(error as Error, this.id);
        }
    }

    postMessage(message: WorkerMessage): void {
        if (!this.worker || !this.isAlive) {
            throw new Error(`Worker ${this.id} is not available`);
        }

        this.worker.postMessage(message);
        this.lastActivity = Date.now();
    }

    startTask(taskId: string): void {
        if (this.isBusy) {
            throw new Error(`Worker ${this.id} is already busy`);
        }

        this.isBusy = true;
        this.currentTask = taskId;
        this.taskCount++;
    }

    finishTask(): void {
        this.isBusy = false;
        this.currentTask = undefined;
    }

    cancelTask(): void {
        this.finishTask();
    }

    ping(): void {
        if (this.isAlive) {
            this.postMessage({
                id: Math.random().toString(36).substr(2, 9),
                type: 'ping',
                timestamp: Date.now()
            });
        }
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = undefined;
        }
        this.isAlive = false;
        this.isBusy = false;
        this.currentTask = undefined;
    }

    restart(): void {
        this.terminate();
        this.start();
    }

    getMetrics() {
        const uptime = Date.now() - this.startTime;
        return {
            id: this.id,
            isAlive: this.isAlive,
            isBusy: this.isBusy,
            currentTask: this.currentTask,
            taskCount: this.taskCount,
            errorCount: this.errorCount,
            uptime,
            lastActivity: this.lastActivity,
            utilization: this.taskCount / Math.max(1, uptime / 1000) // Tasks per second
        };
    }
}

/**
 * Worker Pool for managing multiple web workers
 */
export class WorkerPool {
    private workers = new Map<string, WorkerWrapper>();
    private taskQueue: WorkerTask[] = [];
    private processingTasks = new Map<string, { task: WorkerTask; workerId: string; startTime: number }>();
    private config: WorkerPoolConfig;
    private performanceMonitor?: PerformanceMonitor;
    private metrics: WorkerMetrics = {
        activeWorkers: 0,
        totalWorkers: 0,
        queuedTasks: 0,
        processingTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageTaskTime: 0,
        workerUtilization: 0,
        memoryUsage: 0
    };
    private taskTimes: number[] = [];

    constructor(
        config: Partial<WorkerPoolConfig> = {},
        performanceMonitor?: PerformanceMonitor
    ) {
        this.config = {
            maxSize: Math.min(navigator.hardwareConcurrency || 4, 8),
            minSize: 1,
            maxTaskTime: 300000, // 5 minutes
            workerTimeout: 60000, // 1 minute
            restartThreshold: 3, // Restart after 3 errors
            scriptPath: 'data:text/javascript;base64,' + btoa(this.getWorkerScript()),
            ...config
        };

        this.performanceMonitor = performanceMonitor;

        // Start minimum workers
        for (let i = 0; i < this.config.minSize; i++) {
            this.createWorker();
        }

        // Start processing queue
        this.processQueue();

        // Start health monitoring
        this.startHealthMonitoring();
    }

    private getWorkerScript(): string {
        return `
            // Worker script for background processing
            let performanceMonitor = null;

            // Message handler
            self.onmessage = function(event) {
                const message = event.data;

                switch (message.type) {
                    case 'task':
                        handleTask(message);
                        break;
                    case 'ping':
                        handlePing(message);
                        break;
                    case 'cancel':
                        handleCancel(message);
                        break;
                    case 'terminate':
                        self.close();
                        break;
                }
            };

            async function handleTask(message) {
                const { id, data, type } = message;

                try {
                    let result;

                    switch (type) {
                        case 'ai-processing':
                            result = await processAIRequest(data);
                            break;
                        case 'video-processing':
                            result = await processVideoRequest(data);
                            break;
                        case 'compression':
                            result = await processCompressionRequest(data);
                            break;
                        default:
                            throw new Error('Unknown task type: ' + type);
                    }

                    self.postMessage({
                        id,
                        type: 'result',
                        data: result,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    self.postMessage({
                        id,
                        type: 'error',
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
            }

            function handlePing(message) {
                self.postMessage({
                    id: message.id,
                    type: 'pong',
                    timestamp: Date.now()
                });
            }

            function handleCancel(message) {
                // Cancel logic would go here
                
}

            // AI Processing implementation
            async function processAIRequest(data) {
                const { prompt, provider, model, apiKey, options } = data;
                const startTime = Date.now();

                // Simulate AI processing
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

                const content = \`Processed response for: \${prompt.substring(0, 100)}...\`;

                return {
                    content,
                    provider,
                    model: model || 'default',
                    processingTime: Date.now() - startTime
                };
            }

            // Video Processing implementation
            async function processVideoRequest(data) {
                const { videoId, transcript, options } = data;
                const startTime = Date.now();

                // Simulate video processing
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

                const summary = \`Summary for video \${videoId}: This is a simulated summary.\`;
                const keyMoments = [
                    { time: '0:30', description: 'Introduction begins' },
                    { time: '2:15', description: 'Key point discussed' },
                    { time: '5:45', description: 'Conclusion starts' }
                ];

                return {
                    summary,
                    keyMoments,
                    processingTime: Date.now() - startTime
                };
            }

            // Compression implementation
            async function processCompressionRequest(data) {
                const { data: inputData, algorithm = 'gzip', level = 6 } = data;
                const startTime = Date.now();

                const jsonString = JSON.stringify(inputData);
                const encoder = new TextEncoder();
                const uint8Array = encoder.encode(jsonString);

                let compressedData;

                if ('CompressionStream' in self) {
                    const compressionStream = new CompressionStream(algorithm);
                    const writer = compressionStream.writable.getWriter();
                    const reader = compressionStream.readable.getReader();

                    writer.write(uint8Array);
                    writer.close();

                    const chunks = [];
                    let done = false;

                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) chunks.push(value);
                    }

                    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    compressedData = new Uint8Array(totalLength);
                    let offset = 0;

                    for (const chunk of chunks) {
                        compressedData.set(chunk, offset);
                        offset += chunk.length;
                    }
                } else {
                    // Fallback compression
                    compressedData = uint8Array;
                }

                return {
                    compressedData: Array.from(compressedData),
                    originalSize: uint8Array.length,
                    compressedSize: compressedData.length,
                    compressionRatio: compressedData.length / uint8Array.length,
                    processingTime: Date.now() - startTime
                };
            }
        `;
    }

    private createWorker(): WorkerWrapper {
        const id = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        const wrapper = new WorkerWrapper(
            id,
            this.config.scriptPath!,
            (response) => this.handleWorkerMessage(response),
            (error, workerId) => this.handleWorkerError(error, workerId)
        );

        this.workers.set(id, wrapper);
        this.updateMetrics();

        return wrapper;
    }

    private handleWorkerMessage(response: WorkerResponse): void {
        const { id, type, data, error, workerId } = response;
        const wrapper = this.workers.get(workerId);

        if (!wrapper) return;

        switch (type) {
            case 'result':
                this.handleTaskResult(id, data, workerId);
                wrapper.finishTask();
                break;

            case 'error':
                this.handleTaskError(id, new Error(error), workerId);
                wrapper.finishTask();
                break;

            case 'progress':
                this.handleTaskProgress(id, data, workerId);
                break;

            case 'pong':
                // Worker is alive
                break;
        }

        this.processQueue(); // Process next task if available
    }

    private handleWorkerError(error: Error, workerId: string): void {
        const wrapper = this.workers.get(workerId);
        if (!wrapper) return;

        // Check if we should restart the worker
        if (wrapper.getMetrics().errorCount >= this.config.restartThreshold) {
            
wrapper.restart();
        }

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('worker_error', 1, {
                workerId,
                error: error.message
            });
        }
    }

    private handleTaskResult(taskId: string, result: any, workerId: string): void {
        const processingInfo = this.processingTasks.get(taskId);
        if (!processingInfo) return;

        const { task, startTime } = processingInfo;
        const processingTime = Date.now() - startTime;

        // Update metrics
        this.metrics.completedTasks++;
        this.taskTimes.push(processingTime);
        if (this.taskTimes.length > 100) {
            this.taskTimes = this.taskTimes.slice(-100);
        }

        // Calculate average task time
        this.metrics.averageTaskTime = this.taskTimes.reduce((sum, time) => sum + time, 0) / this.taskTimes.length;

        // Clean up
        this.processingTasks.delete(taskId);

        // Call completion callbacks
        if (task.onComplete) {
            task.onComplete(result);
        }

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('worker_task_completed', processingTime, {
                taskId,
                workerId,
                taskType: task.type
            });
        }
    }

    private handleTaskError(taskId: string, error: Error, workerId: string): void {
        const processingInfo = this.processingTasks.get(taskId);
        if (!processingInfo) return;

        const { task } = processingInfo;

        // Update metrics
        this.metrics.failedTasks++;

        // Clean up
        this.processingTasks.delete(taskId);

        // Retry logic
        const retries = (task.retries || 0) + 1;
        if (retries <= 3) {
            // Re-queue task with retry count
            const retryTask = { ...task, retries };
            this.enqueueTask(retryTask);
        } else {
            // Call error callback
            if (task.onError) {
                task.onError(error);
            }
        }

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('worker_task_failed', 1, {
                taskId,
                workerId,
                error: error.message,
                retries
            });
        }
    }

    private handleTaskProgress(taskId: string, progress: number, workerId: string): void {
        const processingInfo = this.processingTasks.get(taskId);
        if (!processingInfo) return;

        const { task } = processingInfo;

        if (task.onProgress) {
            task.onProgress(progress);
        }
    }

    private processQueue(): void {
        // Find available workers
        const availableWorkers = Array.from(this.workers.values())
            .filter(worker => worker.getMetrics().isAlive && !worker.getMetrics().isBusy);

        if (availableWorkers.length === 0 || this.taskQueue.length === 0) {
            return;
        }

        // Sort queue by priority
        this.taskQueue.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        // Assign tasks to available workers
        while (availableWorkers.length > 0 && this.taskQueue.length > 0) {
            const worker = availableWorkers.shift()!;
            const task = this.taskQueue.shift()!;

            this.executeTask(worker, task);
        }
    }

    private executeTask(worker: WorkerWrapper, task: WorkerTask): void {
        worker.startTask(task.id);
        task.startedAt = Date.now();

        const message: WorkerMessage = {
            id: task.id,
            type: 'task',
            data: {
                type: task.type,
                data: task.data
            },
            timestamp: Date.now()
        };

        this.processingTasks.set(task.id, {
            task,
            workerId: worker.id,
            startTime: Date.now()
        });

        // Set timeout for task
        if (task.timeout || this.config.maxTaskTime) {
            const timeout = task.timeout || this.config.maxTaskTime;
            setTimeout(() => {
                if (this.processingTasks.has(task.id)) {
                    this.handleTaskError(task.id, new Error('Task timeout'), worker.id);
                    worker.finishTask();
                }
            }, timeout);
        }

        worker.postMessage(message);

        if (this.performanceMonitor) {
            this.performanceMonitor.logMetric('worker_task_started', 1, {
                taskId: task.id,
                workerId: worker.id,
                taskType: task.type,
                priority: task.priority
            });
        }
    }

    private enqueueTask(task: WorkerTask): void {
        this.taskQueue.push(task);
        this.processQueue();
    }

    private startHealthMonitoring(): void {
        setInterval(() => {
            this.updateMetrics();
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
    }

    private performHealthCheck(): void {
        const now = Date.now();
        const deadWorkers: string[] = [];

        this.workers.forEach((worker, id) => {
            const metrics = worker.getMetrics();

            // Check if worker is unresponsive
            if (now - metrics.lastActivity > this.config.workerTimeout) {
                deadWorkers.push(id);
            }

            // Ping worker
            worker.ping();
        });

        // Remove dead workers
        deadWorkers.forEach(id => {
            const worker = this.workers.get(id);
            if (worker) {
                worker.terminate();
                this.workers.delete(id);
                
}
        });

        // Scale workers if needed
        this.scaleWorkers();

        if (this.performanceMonitor && deadWorkers.length > 0) {
            this.performanceMonitor.logMetric('worker_cleanup', deadWorkers.length);
        }
    }

    private scaleWorkers(): void {
        const busyWorkers = Array.from(this.workers.values())
            .filter(worker => worker.getMetrics().isBusy);

        const queueLength = this.taskQueue.length;
        const currentSize = this.workers.size;

        // Scale up if needed
        if (queueLength > busyWorkers.length && currentSize < this.config.maxSize) {
            const workersToAdd = Math.min(
                queueLength - busyWorkers.length,
                this.config.maxSize - currentSize,
                2 // Add max 2 workers at a time
            );

            for (let i = 0; i < workersToAdd; i++) {
                this.createWorker();
            }

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('worker_scale_up', workersToAdd);
            }
        }

        // Scale down if needed
        if (queueLength === 0 && busyWorkers.length === 0 && currentSize > this.config.minSize) {
            const workersToRemove = Math.min(
                currentSize - this.config.minSize,
                1 // Remove max 1 worker at a time
            );

            const idleWorkers = Array.from(this.workers.values())
                .filter(worker => !worker.getMetrics().isBusy)
                .slice(0, workersToRemove);

            idleWorkers.forEach(worker => {
                worker.terminate();
                this.workers.delete(worker.id);
            });

            if (this.performanceMonitor) {
                this.performanceMonitor.logMetric('worker_scale_down', workersToRemove);
            }
        }
    }

    private updateMetrics(): void {
        const workers = Array.from(this.workers.values());
        const aliveWorkers = workers.filter(w => w.getMetrics().isAlive);
        const busyWorkers = workers.filter(w => w.getMetrics().isBusy);

        this.metrics.activeWorkers = aliveWorkers.length;
        this.metrics.totalWorkers = workers.length;
        this.metrics.queuedTasks = this.taskQueue.length;
        this.metrics.processingTasks = this.processingTasks.size;

        // Calculate worker utilization
        this.metrics.workerUtilization = workers.length > 0 ? busyWorkers.length / workers.length : 0;

        // Estimate memory usage (rough approximation)
        this.metrics.memoryUsage = workers.length * 50 * 1024 * 1024; // 50MB per worker estimate
    }

    /**
     * Submit a task to the worker pool
     */
    submitTask<T = any, R = any>(task: WorkerTask<T, R>): Promise<R> {
        return new Promise((resolve, reject) => {
            const taskWithCallbacks = {
                ...task,
                onComplete: (result: R) => {
                    resolve(result);
                    if (task.onComplete) task.onComplete(result);
                },
                onError: (error: Error) => {
                    reject(error);
                    if (task.onError) task.onError(error);
                }
            };

            this.enqueueTask(taskWithCallbacks);
        });
    }

    /**
     * Cancel a task
     */
    cancelTask(taskId: string): boolean {
        // Remove from queue if pending
        const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
        if (queueIndex !== -1) {
            this.taskQueue.splice(queueIndex, 1);
            return true;
        }

        // Cancel if processing
        const processingInfo = this.processingTasks.get(taskId);
        if (processingInfo) {
            const worker = this.workers.get(processingInfo.workerId);
            if (worker) {
                worker.postMessage({
                    id: taskId,
                    type: 'cancel',
                    timestamp: Date.now()
                });
                worker.finishTask();
                this.processingTasks.delete(taskId);
                return true;
            }
        }

        return false;
    }

    /**
     * Get current metrics
     */
    getMetrics(): WorkerMetrics {
        this.updateMetrics();
        return { ...this.metrics };
    }

    /**
     * Get detailed worker metrics
     */
    getWorkerMetrics() {
        return Array.from(this.workers.values()).map(worker => worker.getMetrics());
    }

    /**
     * Terminate all workers
     */
    terminate(): void {
        this.workers.forEach(worker => worker.terminate());
        this.workers.clear();
        this.taskQueue.length = 0;
        this.processingTasks.clear();
    }
}

/**
 * Global worker pool instance
 */
export class WorkerSystem {
    private static instance: WorkerSystem;
    private pool: WorkerPool;

    private constructor(performanceMonitor?: PerformanceMonitor) {
        this.pool = new WorkerPool({}, performanceMonitor);
    }

    static getInstance(performanceMonitor?: PerformanceMonitor): WorkerSystem {
        if (!WorkerSystem.instance) {
            WorkerSystem.instance = new WorkerSystem(performanceMonitor);
        }
        return WorkerSystem.instance;
    }

    /**
     * Submit AI processing task
     */
    async processAI(prompt: string, provider: string, options?: any): Promise<any> {
        const task = new AIProcessingTask({
            prompt,
            provider,
            options
        });

        return this.pool.submitTask(task.serialize());
    }

    /**
     * Submit video processing task
     */
    async processVideo(videoId: string, transcript?: string, options?: any): Promise<any> {
        const task = new VideoProcessingTask({
            videoId,
            transcript,
            options
        });

        return this.pool.submitTask(task.serialize());
    }

    /**
     * Submit compression task
     */
    async compress(data: any, algorithm?: string, level?: number): Promise<any> {
        const task = new CompressionTask({
            data,
            algorithm,
            level
        });

        return this.pool.submitTask(task.serialize());
    }

    /**
     * Get system metrics
     */
    getMetrics(): WorkerMetrics {
        return this.pool.getMetrics();
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        this.pool.terminate();
    }
}