/**
 * Pipeline Integration Tests
 * Tests the 5-stage pipeline functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PipelineOrchestrator } from '../src/application/pipeline/orchestrator';
import { IngestionStage } from '../src/application/pipeline/stages/ingestion.stage';
import { ValidationStage } from '../src/application/pipeline/stages/validation.stage';
import { EnrichmentStage } from '../src/application/pipeline/stages/enrichment.stage';
import { ProcessingStage } from '../src/application/pipeline/stages/processing.stage';
import { PersistenceStage } from '../src/application/pipeline/stages/persistence.stage';

describe('Pipeline Integration Tests', () => {
  let orchestrator: PipelineOrchestrator;

  beforeEach(() => {
    orchestrator = new PipelineOrchestrator({
      continueOnError: false,
      maxRetries: 2
    });
  });

  afterEach(() => {
    orchestrator.clearStages();
  });

  describe('Stage 1: Ingestion', () => {
    it('should detect YouTube URL from clipboard', async () => {
      const stage = new IngestionStage();
      orchestrator.registerStage(stage);

      const result = await orchestrator.execute({
        source: 'clipboard',
        rawInput: 'https://youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(result.success).toBe(true);
      expect(result.finalContext.input.url).toContain('youtube.com');
    });

    it('should handle invalid URL gracefully', async () => {
      const stage = new IngestionStage();
      orchestrator.registerStage(stage);

      const result = await orchestrator.execute({
        source: 'manual',
        rawInput: 'not-a-url'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Stage 2: Validation', () => {
    it('should validate YouTube URL format', async () => {
      const ingestion = new IngestionStage();
      const validation = new ValidationStage();
      orchestrator.registerStage(ingestion).registerStage(validation);

      const result = await orchestrator.execute({
        source: 'manual',
        rawInput: 'https://youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(result.success).toBe(true);
      expect(result.finalContext.input.sanitized).toBeDefined();
      expect(result.finalContext.input.sanitized.videoId).toBe('dQw4w9WgXcQ');
    });

    it('should detect configuration issues', async () => {
      const ingestion = new IngestionStage();
      const validation = new ValidationStage();
      orchestrator.registerStage(ingestion).registerStage(validation);

      const result = await orchestrator.execute({
        source: 'manual',
        rawInput: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        config: {} // No API keys configured
      });

      expect(result.success).toBe(true);
      expect(result.finalContext.input.warnings).toBeDefined();
    });
  });

  describe('Full Pipeline', () => {
    it('should execute all 5 stages in sequence', async () => {
      const mockVideoService = {
        getVideoData: async () => ({
          title: 'Test Video',
          description: 'Test Description'
        })
      };

      const mockAIService = {
        process: async () => ({
          content: 'Generated content',
          provider: 'Test Provider',
          model: 'test-model'
        })
      };

      const mockFileService = {
        saveToFile: async () => '/test/path.md'
      };

      orchestrator
        .registerStage(new IngestionStage())
        .registerStage(new ValidationStage())
        .registerStage(new EnrichmentStage(mockVideoService))
        .registerStage(new ProcessingStage(mockAIService))
        .registerStage(new PersistenceStage(mockFileService));

      const result = await orchestrator.execute({
        source: 'manual',
        rawInput: 'https://youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(result.success).toBe(true);
      expect(result.history).toHaveLength(5);
      expect(result.metrics.totalTime).toBeGreaterThan(0);
    });

    it('should handle stage failure gracefully', async () => {
      orchestrator.registerStage(new IngestionStage());

      const result = await orchestrator.execute({
        source: 'manual',
        rawInput: 'invalid-url'
      });

      expect(result.success).toBe(false);
      expect(result.metrics.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Middleware', () => {
    it('should apply pre-middlewares', async () => {
      const stage = new IngestionStage();
      orchestrator.registerStage(stage);

      let middlewareCalled = false;
      orchestrator.use({
        name: 'test-middleware',
        phase: 'pre',
        apply: async (context) => {
          middlewareCalled = true;
          return context;
        }
      });

      await orchestrator.execute({
        source: 'manual',
        rawInput: 'https://youtube.com/watch?v=test'
      });

      expect(middlewareCalled).toBe(true);
    });

    it('should apply post-middlewares', async () => {
      const stage = new IngestionStage();
      orchestrator.registerStage(stage);

      let middlewareCalled = false;
      orchestrator.use({
        name: 'test-middleware',
        phase: 'post',
        apply: async (result) => {
          middlewareCalled = true;
          return result;
        }
      });

      await orchestrator.execute({
        source: 'manual',
        rawInput: 'https://youtube.com/watch?v=test'
      });

      expect(middlewareCalled).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track execution time for each stage', async () => {
      orchestrator.registerStage(new IngestionStage());

      const result = await orchestrator.execute({
        source: 'manual',
        rawInput: 'https://youtube.com/watch?v=test'
      });

      expect(result.metrics.stageTimes).toBeDefined();
      expect(Object.keys(result.metrics.stageTimes)).toContain('ingestion');
    });
  });
});
