/**
 * Pipeline Middleware
 * Allows pre/post processing of stages
 */

import { PipelineContext, StageOutput } from './types';

export type MiddlewarePhase = 'pre' | 'post';

export interface PipelineMiddleware {
  /**
   * Unique middleware identifier
   */
  readonly name: string;

  /**
   * Phase to apply middleware
   */
  readonly phase: MiddlewarePhase;

  /**
   * Apply middleware to context (pre-phase) or result (post-phase)
   * @param contextOrResult Pipeline context or stage result
   * @param stageName Name of the stage being processed
   */
  apply(contextOrResult: PipelineContext | StageOutput, stageName: string): Promise<PipelineContext | StageOutput>;
}

/**
 * Base class for middlewares
 */
export abstract class BaseMiddleware implements PipelineMiddleware {
  abstract readonly name: string;
  abstract readonly phase: MiddlewarePhase;
  abstract apply(contextOrResult: PipelineContext | StageOutput, stageName: string): Promise<PipelineContext | StageOutput>;
}

/**
 * Middleware for logging stage execution
 */
export class LoggingMiddleware extends BaseMiddleware {
    readonly name = 'logging';
    readonly phase = 'post' as const;

    constructor(private logger: (message: string, data?: any) => void) {
        super();
    }

    async apply(result: StageOutput, stageName: string): Promise<StageOutput> {
        const metadata = (result as any)._stageMetadata;
        if (metadata) {
            this.logger(`Stage '${stageName}' completed`, {
                duration: metadata.duration,
                timestamp: metadata.timestamp,
            });
        }
        return result;
    }
}

/**
 * Middleware for caching
 */
export class CacheMiddleware extends BaseMiddleware {
    readonly name = 'caching';
    readonly phase = 'pre' as const;

    constructor(
    private cache: Map<string, any>,
    private logger?: (message: string, data?: any) => void
    ) {
        super();
    }

    async apply(context: PipelineContext, stageName: string): Promise<PipelineContext> {
        const cacheKey = this.getCacheKey(context, stageName);

        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (this.logger) {
                this.logger(`Cache hit for stage '${stageName}'`, { cacheKey });
            }

            // Return early with cached data
            context.metadata = {
                ...context.metadata,
                _cached: true,
                _cacheKey,
            };

            context.input = {
                ...context.input,
                ...cached,
            };
        }

        return context;
    }

    private getCacheKey(context: PipelineContext, stageName: string): string {
        return `${stageName}:${JSON.stringify(context.input)}`;
    }
}

/**
 * Middleware for telemetry
 */
export class TelemetryMiddleware extends BaseMiddleware {
    readonly name = 'telemetry';
    readonly phase = 'post' as const;

    private metrics: Map<string, number[]> = new Map();

    async apply(result: StageOutput, stageName: string): Promise<StageOutput> {
        const metadata = (result as any)._stageMetadata;
        if (metadata?.duration) {
            if (!this.metrics.has(stageName)) {
                this.metrics.set(stageName, []);
            }
      this.metrics.get(stageName)!.push(metadata.duration);
        }
        return result;
    }

    getMetrics(stageName?: string): Record<string, { avg: number; min: number; max: number }> {
        const result: Record<string, { avg: number; min: number; max: number }> = {};

        const stages = stageName ? [stageName] : Array.from(this.metrics.keys());

        for (const stage of stages) {
            const times = this.metrics.get(stage) || [];
            if (times.length > 0) {
                result[stage] = {
                    avg: times.reduce((a, b) => a + b, 0) / times.length,
                    min: Math.min(...times),
                    max: Math.max(...times),
                };
            }
        }

        return result;
    }

    clear(): void {
        this.metrics.clear();
    }
}
