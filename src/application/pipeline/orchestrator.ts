/**
 * Pipeline Orchestrator
 * Manages the execution of pipeline stages with error recovery and telemetry
 */

import { v4 as uuidv4 } from 'uuid';

import {
    PipelineContext,
    PipelineMetrics,
    StageExecution,
} from './types';
import { PipelineStage, BaseStage } from './stage';
import { PipelineMiddleware } from './middleware';

export interface PipelineConfig {
  /**
   * Continue execution even if a stage fails
   */
  continueOnError?: boolean;

  /**
   * Maximum number of retries for failed stages
   */
  maxRetries?: number;

  /**
   * Enable parallel stage execution where possible
   */
  enableParallel?: boolean;

  /**
   * Maximum concurrent stages
   */
  maxConcurrency?: number;
}

export interface ErrorRecoveryStrategy {
  canRecover(error: Error, stage: string): boolean;
  recover(context: PipelineContext, error: Error): Promise<PipelineContext>;
}

export class PipelineOrchestrator {
    private stages: Map<string, PipelineStage> = new Map();
    private middlewares: PipelineMiddleware[] = [];
    private config: PipelineConfig;

    constructor(config: PipelineConfig = {}) {
        this.config = {
            continueOnError: false,
            maxRetries: 2,
            enableParallel: false,
            maxConcurrency: 5,
            ...config,
        };
    }

    /**
   * Register a pipeline stage
   */
    registerStage(stage: PipelineStage): this {
        this.stages.set(stage.name, stage);
        return this;
    }

    /**
   * Register multiple stages
   */
    registerStages(stages: PipelineStage[]): this {
        stages.forEach(stage => this.registerStage(stage));
        return this;
    }

    /**
   * Add middleware
   */
    use(middleware: PipelineMiddleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    /**
   * Execute the complete pipeline
   */
    async execute(initialInput: any, metadata: Partial<PipelineContext['metadata']> = {}): Promise<PipelineResult> {
        const pipelineId = uuidv4();
        const startTime = performance.now();

        // Initialize context
        const context: PipelineContext = {
            input: initialInput,
            stageHistory: [],
            metadata: {
                pipelineId,
                timestamp: Date.now(),
                source: metadata.source ?? 'manual',
                startTime,
                ...metadata,
            },
        };

        const executionHistory: StageExecution[] = [];

        try {
            // Execute stages in sequence
            for (const [stageName, stage] of this.stages) {
                const stageResult = await this.executeStage(stage, context);

                executionHistory.push(stageResult);

                // Update context with stage output
                if (stageResult.status === 'success' && stageResult.output) {
                    context.input = {
                        ...context.input,
                        ...stageResult.output,
                    };
                }

                // Handle stage failure
                if (stageResult.status === 'failed') {
                    errorCount++;

                    if (!this.config.continueOnError) {
                        // Add error to context
                        if (!context.errors) context.errors = [];
                        context.errors.push({
                            stage: stageName,
                            error: stageResult.error!,
                            recoverable: false,
                        });

                        // Early termination
                        break;
                    }
                }
            }

            // Calculate metrics
            const metrics = this.calculateMetrics(executionHistory);

            const success = executionHistory.every(s => s.status === 'success');

            return {
                success,
                finalContext: context,
                history: executionHistory,
                metrics,
            };
        } catch (error) {
            // Unhandled error
            return {
                success: false,
                finalContext: context,
                history: executionHistory,
                metrics: this.calculateMetrics(executionHistory),
            };
        }
    }

    /**
   * Execute a single stage with middleware
   */
    private async executeStage(stage: PipelineStage, context: PipelineContext): Promise<StageExecution> {
        const startTime = performance.now();
        const stageName = stage.name;

        try {
            // Check if stage can execute
            if (stage.canExecute && !stage.canExecute(context)) {
                return {
                    stage: stageName,
                    status: 'skipped',
                    duration: 0,
                    timestamp: Date.now(),
                };
            }

            // Apply pre-middlewares
            let processingContext = context;
            for (const middleware of this.middlewares.filter(m => m.phase === 'pre')) {
                processingContext = await middleware.apply(processingContext, stageName) as PipelineContext;
            }

            // Execute stage
            const output = await (stage instanceof BaseStage ? stage.executeSafe(context) : stage.execute(processingContext));

            // Apply post-middlewares
            let processedOutput = output;
            for (const middleware of this.middlewares.filter(m => m.phase === 'post')) {
                processedOutput = await middleware.apply(processedOutput, stageName) as any;
            }

            const duration = performance.now() - startTime;

            return {
                stage: stageName,
                status: 'success',
                output: processedOutput,
                duration,
                timestamp: Date.now(),
            };
        } catch (error) {
            const duration = performance.now() - startTime;

            return {
                stage: stageName,
                status: 'failed',
                error: error as Error,
                duration,
                timestamp: Date.now(),
            };
        }
    }

    /**
   * Calculate pipeline metrics
   */
    private calculateMetrics(history: StageExecution[]): PipelineMetrics {
        const totalTime = history.reduce((sum, h) => sum + h.duration, 0);

        const stageTimes: Record<string, number> = {};
        history.forEach(h => {
            if (!stageTimes[h.stage]) {
                stageTimes[h.stage] = 0;
            }
            stageTimes[h.stage] += h.duration;
        });

        const errorCount = history.filter(h => h.status === 'failed').length;

        // Count cache hits/misses from telemetry middleware
        const cacheHits = 0;
        const cacheMisses = 0;
        for (const middleware of this.middlewares) {
            if (middleware.name === 'telemetry') {
                // Could extract cache metrics here if needed
            }
        }

        return {
            totalTime,
            stageTimes,
            errorCount,
            cacheHits,
            cacheMisses,
        };
    }

    /**
   * Get all registered stages
   */
    getStages(): PipelineStage[] {
        return Array.from(this.stages.values());
    }

    /**
   * Get a specific stage by name
   */
    getStage(name: string): PipelineStage | undefined {
        return this.stages.get(name);
    }

    /**
   * Remove all stages
   */
    clearStages(): void {
        this.stages.clear();
    }

    /**
   * Remove all middleware
   */
    clearMiddleware(): void {
        this.middlewares = [];
    }

    /**
   * Cleanup all stages
   */
    async cleanup(): Promise<void> {
        for (const stage of this.stages.values()) {
            if (stage.cleanup) {
                await stage.cleanup();
            }
        }
    }
}

/**
 * Factory function to create a new pipeline
 */
export function createPipeline(config?: PipelineConfig): PipelineOrchestrator {
    return new PipelineOrchestrator(config);
}
