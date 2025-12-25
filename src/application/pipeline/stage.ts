/**
 * Pipeline Stage Interface
 * All pipeline stages must implement this interface
 */

import { PipelineContext, StageInput, StageOutput } from './types';

export interface PipelineStage {
  /**
   * Unique stage identifier
   */
  readonly name: string;

  /**
   * Execute the stage logic
   * @param context Current pipeline context
   * @returns Stage output
   */
  execute(context: PipelineContext): Promise<StageOutput>;

  /**
   * Validate if the stage can execute given the context
   * @param context Current pipeline context
   * @returns True if stage can execute
   */
  canExecute?(context: PipelineContext): boolean;

  /**
   * Cleanup resources after execution
   */
  cleanup?(): Promise<void>;

  /**
   * Get stage execution timeout in milliseconds
   */
  getTimeout?(): number;
}

export abstract class BaseStage implements PipelineStage {
  abstract readonly name: string;
  abstract execute(context: PipelineContext): Promise<StageOutput>;

  canExecute(context: PipelineContext): boolean {
    return true;
  }

  getTimeout(): number {
    return 30000; // Default 30 second timeout
  }

  async cleanup(): Promise<void> {
    // Default no-op cleanup
  }

  /**
   * Execute stage with timeout and error handling
   */
  async executeSafe(context: PipelineContext): Promise<StageOutput> {
    const timeout = this.getTimeout();
    const startTime = performance.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Stage '${this.name}' exceeded timeout of ${timeout}ms`));
        }, timeout);
      });

      // Race between execution and timeout
      const result = await Promise.race([
        this.execute(context),
        timeoutPromise
      ]);

      const duration = performance.now() - startTime;

      return {
        ...result,
        _stageMetadata: {
          stage: this.name,
          duration,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      throw new Error(`Stage '${this.name}' failed after ${duration.toFixed(2)}ms: ${(error as Error).message}`);
    }
  }
}
