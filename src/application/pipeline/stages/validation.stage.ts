/**
 * Stage 2: Validation
 * Validates URL, checks authentication, validates configuration
 */

import { BaseStage } from '../stage';
import { PipelineContext, StageOutput, ValidationResult } from '../types';

export interface ValidationInput {
  url: string;
}

export interface ValidationOutput extends StageOutput {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: {
    url: string;
    videoId: string;
  };
}

export class ValidationStage extends BaseStage {
    readonly name = 'validation';

    async execute(context: PipelineContext): Promise<ValidationOutput> {
        const input = context.input as ValidationInput;

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate URL format
        if (!this.isValidYouTubeUrl(input.url)) {
            errors.push('Invalid YouTube URL format');
            return {
                isValid: false,
                errors,
                warnings,
                sanitized: {
                    url: input.url,
                    videoId: '',
                },
            };
        }

        // Extract video ID
        const videoId = this.extractVideoId(input.url);
        if (!videoId) {
            errors.push('Could not extract video ID from URL');
            return {
                isValid: false,
                errors,
                warnings,
                sanitized: {
                    url: input.url,
                    videoId: '',
                },
            };
        }

        // Sanitize URL
        const sanitizedUrl = this.sanitizeUrl(input.url, videoId);

        // Check configuration (if available)
        const configWarnings = this.validateConfiguration(context);
        warnings.push(...configWarnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitized: {
                url: sanitizedUrl,
                videoId,
            },
        };
    }

    private isValidYouTubeUrl(url: string): boolean {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const patterns = [
            /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
            /^https?:\/\/youtu\.be\/[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    private extractVideoId(url: string): string | null {
        const patterns = [
            /(?:[?&]v=|youtu\.be\/|\/embed\/|\/v\/|\/shorts\/)([\w-]{11})/,
            /^([\w-]{11})$/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match?.[1]) {
                return match[1];
            }
        }

        return null;
    }

    private sanitizeUrl(url: string, videoId: string): string {
    // Return canonical YouTube watch URL
        return `https://www.youtube.com/watch?v=${videoId}`;
    }

    private validateConfiguration(context: PipelineContext): string[] {
        const warnings: string[] = [];

        // Check if settings are available
        if (!context.config) {
            return warnings;
        }

        // Check for API keys
        const hasAnyKey =
      context.config.geminiApiKey ||
      context.config.groqApiKey ||
      context.config.ollamaApiKey ||
      context.config.huggingFaceApiKey ||
      context.config.openRouterApiKey;

        if (!hasAnyKey) {
            warnings.push('No API keys configured');
        }

        // Check output path
        if (!context.config.outputPath) {
            warnings.push('No output path configured');
        }

        return warnings;
    }

    canExecute(context: PipelineContext): boolean {
        const input = context.input as ValidationInput;
        return !!(input && input.url);
    }

    getTimeout(): number {
        return 5000; // 5 seconds
    }
}
