import { YouTubePluginSettings } from '../types';

/**
 * Token optimization service for staying within API limits
 * Implements multiple strategies to reduce token usage while maintaining quality
 */

export interface TokenUsageReport {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    optimizations: string[];
}

export interface ContentSummary {
    originalLength: number;
    summarizedLength: number;
    compressionRatio: number;
    summary: string;
    keyPoints: string[];
}

export class TokenOptimizer {
    // Token costs per million tokens (approximate as of 2024)
    private static readonly TOKEN_COSTS = {
        'Google Gemini': { input: 0.075, output: 0.30 },  // Free tier: 15 RPD (requests per day)
        'Groq': { input: 0, output: 0 },  // Free tier: extremely generous limits
        'OpenRouter': { input: 0, output: 0 },  // Varies by model
        'Hugging Face': { input: 0, output: 0 },  // Free Inference API
        'Ollama': { input: 0, output: 0 },  // Self-hosted, free
    };

    // Free tier limits (tokens per request)
    private static readonly FREE_TIER_LIMITS = {
        'Google Gemini': {
            geminiFlash: 1000000,  // 1M tokens
            geminiPro: 1000000,
        },
        'Groq': {
            default: 128000,  // 128K context window
        },
        'OpenRouter': {
            free: 200000,  // 200K per month
        },
        'Hugging Face': {
            default: 30000,  // ~30K per request
        },
        'Ollama': {
            default: 128000,  // Depends on model
        },
    };

    // Target token counts for different modes
    private static readonly TARGET_TOKENS = {
        ultraCompact: 2000,
        compact: 4000,
        balanced: 6000,
        comprehensive: 8000,
    };

    /**
     * Estimate token count (rough approximation: ~4 chars per token)
     */
    static estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Summarize transcript using intelligent extraction
     * This reduces tokens while preserving key information
     */
    static summarizeTranscript(
        transcript: string,
        targetTokens: number = TARGET_TOKENS.balanced
    ): { processed: string; summary: ContentSummary; report: TokenUsageReport } {
        const originalTokens = this.estimateTokens(transcript);
        const optimizations: string[] = [];

        // Strategy 1: Extract key segments (beginning, middle, end)
        let processed = transcript;
        let compressionRatio = 1;

        if (originalTokens > targetTokens) {
            const summary = this.extractKeySegments(transcript, targetTokens);
            processed = summary;
            compressionRatio = transcript.length / summary.length;
            optimizations.push(`Extracted key segments (compression: ${compressionRatio.toFixed(1)}x)`);
        }

        // Strategy 2: Remove filler words and repetitions
        processed = this.removeFillerWords(processed);
        if (processed.length < transcript.length) {
            optimizations.push('Removed filler words and repetitions');
        }

        // Strategy 3: Smart truncation with context preservation
        if (this.estimateTokens(processed) > targetTokens) {
            const beforeLength = processed.length;
            processed = this.smartTruncate(processed, targetTokens);
            optimizations.push(`Smart truncation (removed ${(beforeLength - processed.length).toLocaleString()} chars)`);
        }

        const finalTokens = this.estimateTokens(processed);

        return {
            processed,
            summary: {
                originalLength: transcript.length,
                summarizedLength: processed.length,
                compressionRatio: transcript.length / processed.length,
                summary: this.extractKeyPoints(processed),
                keyPoints: [],
            },
            report: {
                inputTokens: finalTokens,
                outputTokens: 0,
                totalTokens: finalTokens,
                estimatedCost: 0,
                optimizations,
            },
        };
    }

    /**
     * Extract key segments from transcript (beginning, key timestamps, end)
     */
    private static extractKeySegments(transcript: string, targetTokens: number): string {
        const lines = transcript.split('\n').filter(line => line.trim());
        const totalLines = lines.length;

        // For very short transcripts, return as-is
        if (totalLines < 20) {
            return transcript;
        }

        // Extract strategic segments
        const segments: string[] = [];

        // Beginning (20% of lines)
        const startCount = Math.ceil(totalLines * 0.2);
        segments.push(...lines.slice(0, startCount));

        // Middle sections (every 10th line for context)
        const step = Math.max(5, Math.floor(totalLines / 20));
        for (let i = startCount; i < totalLines - startCount; i += step) {
            segments.push(lines[i]);
        }

        // End (20% of lines)
        segments.push(...lines.slice(-startCount));

        return segments.join('\n');
    }

    /**
     * Remove common filler words and repeated phrases
     */
    private static removeFillerWords(text: string): string {
        const fillerPatterns = [
            /\b(um|uh|ah|like|you know|i mean|basically|actually|literally)\b/gi,
            /\s+/g,  // Multiple spaces to single space
            /\n{3,}/g,  // Multiple newlines to double newline
        ];

        let cleaned = text;
        for (const pattern of fillerPatterns) {
            cleaned = cleaned.replace(pattern, ' ');
        }

        return cleaned.trim();
    }

    /**
     * Smart truncation that preserves sentence boundaries
     */
    private static smartTruncate(text: string, targetTokens: number): string {
        const targetLength = targetTokens * 4;  // Convert back to chars

        if (text.length <= targetLength) {
            return text;
        }

        // Try to truncate at sentence boundary
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let result = '';
        let totalLength = 0;

        for (const sentence of sentences) {
            if (totalLength + sentence.length > targetLength) {
                break;
            }
            result += sentence;
            totalLength += sentence.length;
        }

        return result || text.substring(0, targetLength);
    }

    /**
     * Extract key points from transcript
     */
    private static extractKeyPoints(transcript: string): string[] {
        const keyPoints: string[] = [];

        // Look for numbered/bulleted lists
        const listMatches = transcript.match(/^\d+\.\s+.+$/gm);
        if (listMatches) {
            keyPoints.push(...listMatches.slice(0, 10));
        }

        // Look for sentences with keywords
        const keywords = ['important', 'key', 'main', 'critical', 'essential', 'remember'];
        const lines = transcript.split('\n');

        for (const line of lines) {
            if (keyPoints.length >= 10) break;
            const lowerLine = line.toLowerCase();
            if (keywords.some(kw => lowerLine.includes(kw))) {
                keyPoints.push(line.trim());
            }
        }

        return keyPoints;
    }

    /**
     * Create ultra-compact prompt template
     */
    static createCompactPrompt(videoData: any, format: string, transcript?: string): string {
        const parts = [`Analyze: ${videoData.title}`];

        if (videoData.description) {
            const shortDesc = videoData.description.substring(0, 200);
            parts.push(`Desc: ${shortDesc}`);
        }

        if (transcript) {
            const { processed, report } = this.summarizeTranscript(transcript, 2000);
            parts.push(`Content: ${processed}`);
            console.log('[Token Optimizer]', report.optimizations.join(', '));
        }

        parts.push(`Format: ${format}`);
        parts.push('Output in markdown with frontmatter.');

        return parts.join('\n\n');
    }

    /**
     * Get recommended provider based on content size
     */
    static getRecommendedProvider(
        estimatedTokens: number,
        availableProviders: string[],
        settings: YouTubePluginSettings
    ): string {
        // Prefer Groq for large content (generous free tier)
        if (estimatedTokens > 10000 && availableProviders.includes('Groq')) {
            return 'Groq';
        }

        // Prefer Gemini for balanced usage (15 free requests/day)
        if (estimatedTokens < 10000 && availableProviders.includes('Google Gemini')) {
            return 'Google Gemini';
        }

        // Fallback to user's preferred provider
        return availableProviders[0] || 'Google Gemini';
    }

    /**
     * Calculate if content fits within free tier limits
     */
    static fitsWithinFreeTier(
        provider: string,
        model: string,
        inputTokens: number,
        outputTokens: number
    ): { fits: boolean; reason: string; recommendation: string } {
        const limits = this.FREE_TIER_LIMITS[provider as keyof typeof this.FREE_TIER_LIMITS];

        if (!limits) {
            return {
                fits: true,
                reason: 'No limits known for this provider',
                recommendation: 'Proceed normally'
            };
        }

        const maxTokens = limits[model as keyof typeof limits] || limits.default || 100000;
        const totalTokens = inputTokens + outputTokens;

        if (totalTokens > maxTokens) {
            return {
                fits: false,
                reason: `Exceeds limit: ${totalTokens.toLocaleString()} > ${maxTokens.toLocaleString()} tokens`,
                recommendation: `Enable transcript summarization or split into smaller chunks`
            };
        }

        return {
            fits: true,
            reason: `Within limits: ${totalTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens`,
            recommendation: 'Good to proceed'
        };
    }

    /**
     * Generate token usage report
     */
    static generateReport(
        prompt: string,
        response: string,
        provider: string
    ): TokenUsageReport {
        const inputTokens = this.estimateTokens(prompt);
        const outputTokens = this.estimateTokens(response);
        const totalTokens = inputTokens + outputTokens;

        const costs = this.TOKEN_COSTS[provider as keyof typeof this.TOKEN_COSTS];
        const estimatedCost = costs
            ? ((inputTokens / 1000000) * costs.input + (outputTokens / 1000000) * costs.output)
            : 0;

        return {
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCost,
            optimizations: [],
        };
    }
}
