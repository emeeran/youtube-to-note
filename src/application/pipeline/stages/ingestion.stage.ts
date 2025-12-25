/**
 * Stage 1: Ingestion
 * Handles URL detection and source identification
 */

import { BaseStage } from '../stage';
import { PipelineContext, StageOutput } from '../types';

export interface IngestionInput {
  source: 'clipboard' | 'protocol' | 'file-monitor' | 'extension' | 'manual';
  rawInput: string;
  sourceFile?: string;
}

export interface IngestionOutput extends StageOutput {
  url: string;
  source: IngestionInput['source'];
  metadata: {
    timestamp: number;
    sourceFile?: string;
    userAgent?: string;
  };
}

export class IngestionStage extends BaseStage {
  readonly name = 'ingestion';

  async execute(context: PipelineContext): Promise<IngestionOutput> {
    const input = context.input as IngestionInput;

    // Detect source
    const source = input.source || context.metadata.source || 'manual';

    // Extract URL from raw input
    const url = this.extractURL(input.rawInput);

    if (!url) {
      throw new Error('No valid URL found in input');
    }

    return {
      url,
      source,
      metadata: {
        timestamp: Date.now(),
        sourceFile: input.sourceFile,
        userAgent: this.detectUserAgent()
      }
    };
  }

  private extractURL(rawInput: string): string | null {
    if (!rawInput || typeof rawInput !== 'string') {
      return null;
    }

    // Remove whitespace
    const trimmed = rawInput.trim();

    // Check if it's a YouTube URL
    const youtubePatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/
    ];

    for (const pattern of youtubePatterns) {
      if (pattern.test(trimmed)) {
        return trimmed;
      }
    }

    // Try to find a URL in the text
    const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      const url = urlMatch[1];
      // Check if it's a YouTube URL
      if (youtubePatterns.some(p => p.test(url))) {
        return url;
      }
    }

    return null;
  }

  private detectUserAgent(): string {
    // Basic user agent detection
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return 'Unknown';
  }

  canExecute(context: PipelineContext): boolean {
    const input = context.input as IngestionInput;
    return !!(input && (input.rawInput || input.source));
  }

  getTimeout(): number {
    return 5000; // 5 seconds
  }
}
