/**
 * Pipeline Module
 * 5-stage processing pipeline for YT-Clipper
 */

export * from './types';
export * from './stage';
export * from './middleware';
export * from './orchestrator';

// Re-export factory for convenience
export { createPipeline } from './orchestrator';
