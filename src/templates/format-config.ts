/**
 * Format-specific configuration for token limits, temperature, transcript budgets,
 * and expected sections.
 *
 * Adjusted for revamped templates — tighter token budgets where templates are leaner.
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
        expectedSections: ['The Full Picture', 'Core Thesis', 'Key Insights', 'Implications & Impact', 'Key References', 'Assessment', 'Quick Actions'],
        hasBuiltInResources: true,
    },
    'technical-analysis': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.3,
        transcriptBudget: 120_000,
        expectedSections: ['Overview', 'Tech Stack & Tools', 'Architecture & Design', 'Implementation Details', 'Engineering Trade-offs', 'Resources'],
        hasBuiltInResources: true,
    },
    '3c-accelerated-learning': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.5,
        transcriptBudget: 120_000,
        expectedSections: ['COMPRESS', 'COMPILE', 'CONSOLIDATE', 'Transfer Acceleration'],
        hasBuiltInResources: false,
    },
    'atom-notes': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.5,
        transcriptBudget: 120_000,
        expectedSections: ['Atomic Ideas', 'Concept Map', 'Quick Capture', 'Implementation Seeds'],
        hasBuiltInResources: false,
    },
    'article': {
        recommendedMaxTokens: 8192,
        temperatureHint: 0.6,
        transcriptBudget: 150_000,
        expectedSections: ['Executive Summary', 'The Deep Dive', 'Technical Glossary', 'Resources & Citations', 'Actionable Takeaways'],
        hasBuiltInResources: true,
    },
    'complete-transcription': {
        recommendedMaxTokens: 16384,
        temperatureHint: 0.3,
        transcriptBudget: 200_000,
        expectedSections: ['Overview', 'Full Structured Notes', 'Key Terms'],
        hasBuiltInResources: true,
    },
    'quick-notes': {
        recommendedMaxTokens: 1024,
        temperatureHint: 0.4,
        transcriptBudget: 100_000,
        expectedSections: ['TL;DR', 'Key Points', 'Standout', 'Next Action'],
        hasBuiltInResources: false,
    },
} as const;
