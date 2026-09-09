/**
 * Format-specific configuration for token limits, temperature, transcript budgets,
 * and expected sections.
 *
 * Aligned with revamped templates in format-templates.ts.
 */

import { OutputFormat } from '../types';

export interface FormatConfig {
    transcriptBudget?: number;
    expectedSections?: string[];
    /** Whether this format already includes a Resources/Citations section in its template */
    hasBuiltInResources?: boolean;
}

export const FORMAT_CONFIG: Readonly<Record<OutputFormat, FormatConfig>> = {
    'executive-summary': {
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
        transcriptBudget: 120_000,
        expectedSections: ['COMPRESS', 'CONNECT', 'COMPOUND'],
        hasBuiltInResources: false,
    },
    'atom-notes': {
        transcriptBudget: 120_000,
        expectedSections: ['Atomic Ideas', 'Concept Map', 'Notable Captures', 'Implementation Seeds'],
        hasBuiltInResources: false,
    },
    article: {
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
        // Equal to MAX_TRANSCRIPT_CHARS in transcript-service.ts — the source
        // transcript never exceeds it, so a larger budget here could only ever
        // promise characters that do not exist.
        transcriptBudget: 150_000,
        expectedSections: ['Overview', 'Structured Transcript', 'Key Terms', 'Resources Mentioned'],
        hasBuiltInResources: true,
    },
    'quick-notes': {
        transcriptBudget: 100_000,
        expectedSections: ['TL;DR', 'Key Points', 'Standout', 'Next Action'],
        hasBuiltInResources: false,
    },
} as const;
