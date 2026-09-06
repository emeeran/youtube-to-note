/**
 * Pure helpers for the YouTube URL modal.
 *
 * Everything here is DOM-free so the modal component can stay focused on
 * rendering and event wiring (and so these bits are trivially unit-testable).
 */

import { BatchItemResult, OutputFormat, ProcessStage, ProcessingResult, ProgressUpdate } from '../../../types';
import { ValidationUtils } from '../../../validation';

// ── Progress checklist ───────────────────────────────────────────────────────

/** Checklist step rendered while a video is being processed. */
export interface ProgressStep {
    key: 'metadata' | 'transcript' | 'ai' | 'save';
    icon: string;
    label: string;
}

/** Pipeline stages surfaced to the user, in execution order. */
export const PROGRESS_STEPS: readonly ProgressStep[] = [
    { key: 'metadata', icon: '📡', label: 'Metadata' },
    { key: 'transcript', icon: '📝', label: 'Transcript' },
    { key: 'ai', icon: '🧠', label: 'AI' },
    { key: 'save', icon: '💾', label: 'Save' },
];

/** Fallback text when a ProgressUpdate carries no detail. */
export const STEP_FALLBACK_TEXT: Record<string, string> = {
    metadata: 'Fetching video metadata…',
    transcript: 'Fetching transcript…',
    prompt: 'Building prompt…',
    ai: 'Analyzing with AI…',
    save: 'Saving note…',
};

/** A stage lands on one checklist step; prompt-building is part of the AI step. */
const STAGE_TO_STEP: Record<ProcessStage, number> = {
    metadata: 0,
    transcript: 1,
    prompt: 2,
    ai: 2,
    save: 3,
};

export function stepIndexForStage(stage: ProcessStage): number {
    return STAGE_TO_STEP[stage] ?? 0;
}

// ── URL parsing ──────────────────────────────────────────────────────────────

/** Characters that separate URLs inside a single pasted blob. */
const URL_SPLIT_RE = /[\s,;]+/;

/** Punctuation that may stick to a URL when it is copied out of prose. */
const TRAILING_PUNCT_RE = /[)\]}.,;:!?"'`]+$/;

export interface ParsedUrls {
    urls: string[];
    /** Tokens the user typed that were not recognizable YouTube URLs. */
    invalidCount: number;
}

/**
 * Split free-form input into YouTube URLs (whitespace, commas, semicolons and
 * newlines all count as separators). Validity is decided by ValidationUtils so
 * the URL grammar lives in exactly one place.
 */
export function parseUrlInput(raw: string): ParsedUrls {
    const urls: string[] = [];
    let invalidCount = 0;

    for (const token of raw.split(URL_SPLIT_RE)) {
        const candidate = token.replace(TRAILING_PUNCT_RE, '');
        if (!candidate) continue;
        if (ValidationUtils.isValidYouTubeUrl(candidate)) {
            if (!urls.includes(candidate)) urls.push(candidate);
        } else {
            invalidCount += 1;
        }
    }

    return { urls, invalidCount };
}

/** Extract every YouTube URL embedded in arbitrary text ("see https://youtu.be/x here"). */
export function extractYouTubeUrls(text: string): string[] {
    return parseUrlInput(text).urls;
}

/** Copy for the validation line once input has been parsed. */
export function formatReadyMessage(parsed: ParsedUrls): string {
    if (parsed.invalidCount > 0) {
        const count = parsed.urls.length;
        return `${count} video${count === 1 ? '' : 's'} will be processed · ${parsed.invalidCount} skipped.`;
    }
    if (parsed.urls.length === 1) {
        return 'Ready to process this video.';
    }
    return `Ready to process ${parsed.urls.length} videos.`;
}

// ── Batch results ────────────────────────────────────────────────────────────

export interface BatchSummary {
    created: number;
    duplicates: number;
    failed: number;
}

export function summarizeBatch(items: BatchItemResult[]): BatchSummary {
    const summary: BatchSummary = { created: 0, duplicates: 0, failed: 0 };
    for (const item of items) {
        if (!item.result.success) {
            summary.failed += 1;
        } else if (item.result.duplicateOfPath) {
            summary.duplicates += 1;
        } else {
            summary.created += 1;
        }
    }
    return summary;
}

/** '✅ 4 created · ⚠️ 1 duplicate · ❌ 1 failed' — only the non-zero parts. */
export function formatBatchSummary(summary: BatchSummary): string {
    const parts: string[] = [];
    if (summary.created > 0) parts.push(`✅ ${summary.created} created`);
    if (summary.duplicates > 0) parts.push(`⚠️ ${summary.duplicates} duplicate${summary.duplicates === 1 ? '' : 's'}`);
    if (summary.failed > 0) parts.push(`❌ ${summary.failed} failed`);
    return parts.join(' · ');
}

/** Vault filename (without extension) from a note path. */
export function noteNameFromPath(path: string): string {
    const base = path.split('/').pop() ?? path;
    return base.replace(/\.md$/i, '') || path;
}

/** Provider/model that actually produced the note, e.g. 'Groq · llama-3.3-70b'. */
export function formatAttribution(result: ProcessingResult): string | null {
    if (!result.providerUsed) return null;
    return result.modelUsed ? `${result.providerUsed} · ${result.modelUsed}` : result.providerUsed;
}

/** Detail line for a ProgressUpdate: the pipeline's wording, else a stage fallback. */
export function resolveProgressDetail(update: ProgressUpdate): string {
    const detail = update.detail?.trim();
    if (detail) return detail;
    return STEP_FALLBACK_TEXT[update.stage] ?? 'Working…';
}

/**
 * True when a result means "the user stopped this run", which must never be
 * reported as a failure.
 *
 * When our own signal was aborted any cancel-flavoured message counts;
 * otherwise only the pipeline's exact cancellation wording does, so a provider
 * error that merely mentions "cancelled" is still surfaced as an error.
 */
export function isCancelledResult(message: string | undefined, signalAborted: boolean): boolean {
    const text = (message ?? '').trim();
    if (signalAborted) return /cancel/i.test(text);
    return /^processing cancelled\.?$/i.test(text);
}

// ── Format picker order (shared by the modal and the settings tab) ──────────

export const FORMAT_ORDER: readonly OutputFormat[] = [
    'quick-notes',
    'executive-summary',
    'technical-analysis',
    '3c-accelerated-learning',
    'atom-notes',
    'article',
    'complete-transcription',
];
