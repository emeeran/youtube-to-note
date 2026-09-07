/**
 * Format-specific configuration for token limits, temperature, transcript budgets,
 * and expected sections.
 *
 * Aligned with revamped templates in format-templates.ts.
 */

import { OutputFormat } from '../types';

export interface FormatConfig {
    recommendedMaxTokens: number;
    temperatureHint: number;
    transcriptBudget?: number;
    expectedSections?: string[];
    /** Whether this format already includes a Resources/Citations section in its template */
    hasBuiltInResources?: boolean;
}

export const FORMAT_CONFIG: Readonly<Record<OutputFormat, FormatConfig>> = {
    'executive-summary': {
        recommendedMaxTokens: 4096,
        temperatureHint: 0.5,
        expectedSections: [
            'Executive Summary',
            'Strategic Insights',
            'Impact Assessment',
            'Key References',
            'Action Items',
        ],
        hasBuiltInResources: true,
    },
    'technical-analysis': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.3,
        transcriptBudget: 120_000,
        expectedSections: [
            'Technical Overview',
            'Tech Stack',
            'Architecture',
            'Implementation',
            'Engineering Decisions',
            'Resources',
        ],
        hasBuiltInResources: true,
    },
    '3c-accelerated-learning': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.5,
        transcriptBudget: 120_000,
        expectedSections: ['COMPRESS', 'CONNECT', 'COMPOUND'],
        hasBuiltInResources: false,
    },
    'atom-notes': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.5,
        transcriptBudget: 120_000,
        expectedSections: ['Atomic Ideas', 'Concept Map', 'Notable Captures', 'Implementation Seeds'],
        hasBuiltInResources: false,
    },
    article: {
        recommendedMaxTokens: 8192,
        temperatureHint: 0.6,
        transcriptBudget: 150_000,
        expectedSections: [
            'Executive Summary',
            'The Deep Dive',
            'Technical Glossary',
            'Resources & Citations',
            'Actionable Takeaways',
        ],
        hasBuiltInResources: true,
    },
    'complete-transcription': {
        recommendedMaxTokens: 16384,
        temperatureHint: 0.3,
        // Equal to MAX_TRANSCRIPT_CHARS in transcript-service.ts — the source
        // transcript never exceeds it, so a larger budget here could only ever
        // promise characters that do not exist.
        transcriptBudget: 150_000,
        expectedSections: ['Overview', 'Structured Transcript', 'Key Terms', 'Resources Mentioned'],
        hasBuiltInResources: true,
    },
    'quick-notes': {
        recommendedMaxTokens: 1536,
        temperatureHint: 0.4,
        transcriptBudget: 100_000,
        expectedSections: ['TL;DR', 'Key Points', 'Standout', 'Next Action'],
        hasBuiltInResources: false,
    },
} as const;
