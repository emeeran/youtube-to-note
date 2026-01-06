/**
 * Pipeline Types and Interfaces
 * Defines the core types for the 5-stage processing pipeline
 */

import { EnhancedVideoData } from '../../types';

export interface PipelineContext {
  // Input data
  input: PipelineInput;

  // Current stage information
  currentStage?: string;
  stageHistory: StageExecution[];

  // Metadata
  metadata: PipelineMetadata;

  // Error tracking
  errors?: PipelineError[];

  // Configuration
  config?: Record<string, unknown>;
}

/** Pipeline input - can be URL or video ID */
export type PipelineInput = string | { url?: string; videoId?: string };

export interface PipelineMetadata {
  // Identification
  pipelineId: string;
  timestamp: number;

  // Source tracking
  source: 'clipboard' | 'protocol' | 'file-monitor' | 'extension' | 'manual';
  sourceFile?: string;

  // Performance tracking
  startTime: number;
  endTime?: number;

  // User data
  userId?: string;
  sessionId?: string;
}

export interface StageExecution {
  stage: string;
  status: 'success' | 'failed' | 'skipped';
  output?: StageOutput;
  error?: Error;
  duration: number;
  timestamp: number;
}

export interface PipelineError {
  stage: string;
  error: Error;
  recoverable: boolean;
  recoveryAttempted?: boolean;
}

export interface PipelineResult {
  success: boolean;
  finalContext: PipelineContext;
  history: StageExecution[];
  metrics: PipelineMetrics;
}

export interface PipelineMetrics {
  totalTime: number;
  stageTimes: Record<string, number>;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface StageInput {
  [key: string]: unknown;
}

export interface StageOutput {
  [key: string]: unknown;
}

// Stage-specific types
export interface IngestionInput {
  source: PipelineMetadata['source'];
  rawInput: string;
}

export interface IngestionOutput {
  url: string;
  source: string;
  metadata: {
    timestamp: number;
    sourceFile?: string;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: {
    url: string;
    videoId: string;
  };
}

export interface EnrichmentOutput extends StageOutput {
  videoData: EnhancedVideoData;
  transcript?: string;
  thumbnail?: string;
  cacheStatus: 'hit' | 'miss' | 'partial';
}

export interface ProcessingOutput {
  generatedContent: string;
  provider: string;
  model: string;
  metrics: {
    responseTime: number;
    tokenCount?: number;
  };
  fallbackChain: string[];
}

export interface PersistenceOutput {
  filePath: string;
  fileSize: number;
  cacheUpdated: boolean;
  conflicts: string[];
}
