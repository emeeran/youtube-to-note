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

/** Upper bound on how many videos a single run may queue. */
export const MAX_BATCH_URLS = 50;

export interface ParsedUrls {
    urls: string[];
    /** Tokens the user typed that were not recognizable YouTube URLs. */
    invalidCount: number;
    /** Recognized URLs dropped because the batch hit {@link MAX_BATCH_URLS}. */
    droppedCount: number;
}

/** An empty parse — "nothing typed", used to reset the modal's hints. */
export const EMPTY_PARSED_URLS: ParsedUrls = { urls: [], invalidCount: 0, droppedCount: 0 };

/**
 * Split free-form input into YouTube URLs (whitespace, commas, semicolons and
 * newlines all count as separators). Validity is decided by ValidationUtils so
 * the URL grammar lives in exactly one place.
 *
 * Deduplication is on the extracted video id, not the string: `youtu.be/ID` and
 * `watch?v=ID` are the same video and must not be processed twice. The first
 * spelling the user typed wins. Past {@link MAX_BATCH_URLS} the extra URLs are
 * counted in `droppedCount` rather than run.
 */
export function parseUrlInput(raw: string): ParsedUrls {
    const urls: string[] = [];
    const seenIds = new Set<string>();
    let invalidCount = 0;
    let droppedCount = 0;

    for (const token of raw.split(URL_SPLIT_RE)) {
        const candidate = token.replace(TRAILING_PUNCT_RE, '');
        if (!candidate) continue;
        if (!ValidationUtils.isValidYouTubeUrl(candidate)) {
            invalidCount += 1;
            continue;
        }

        const videoId = ValidationUtils.extractVideoId(candidate) ?? candidate;
        if (seenIds.has(videoId)) continue;

        if (urls.length >= MAX_BATCH_URLS) {
            droppedCount += 1;
            continue;
        }

        seenIds.add(videoId);
        urls.push(candidate);
    }

    return { urls, invalidCount, droppedCount };
}

/** Extract every YouTube URL embedded in arbitrary text ("see https://youtu.be/x here"). */
export function extractYouTubeUrls(text: string): string[] {
    return parseUrlInput(text).urls;
}

/** Copy for the validation line once input has been parsed. */
export function formatReadyMessage(parsed: ParsedUrls): string {
    const count = parsed.urls.length;
    let message: string;
    if (parsed.invalidCount > 0) {
        message = `${count} video${count === 1 ? '' : 's'} will be processed`;
    } else if (count === 1) {
        message = 'Ready to process this video';
    } else {
        message = `Ready to process ${count} videos`;
    }

    const caveats: string[] = [];
    if (parsed.invalidCount > 0) caveats.push(`${parsed.invalidCount} skipped`);
    if (parsed.droppedCount > 0) caveats.push(`${parsed.droppedCount} over the ${MAX_BATCH_URLS}-video limit`);

    return caveats.length > 0 ? `${message} · ${caveats.join(' · ')}.` : `${message}.`;
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
    return /^(processing|save) cancelled( by user)?\.?$/i.test(text);
}

// ── Retry selection ──────────────────────────────────────────────────────────

/** Everything needed to re-run a submission exactly as the user configured it. */
export interface ModalSubmission {
    urls: string[];
    format: OutputFormat;
    /** Provider chosen in the dropdown — the pipeline puts it first in the chain. */
    providerName?: string;
    model?: string;
    instructions: string;
}

/** URLs that still need a run: the failures only, in their original order. */
export function failedUrlsOf(items: BatchItemResult[]): string[] {
    return items.filter(item => !item.result.success).map(item => item.url);
}

/**
 * The submission a "Retry" should run: the user's settings unchanged, with just
 * the URLs that failed. Notes already created are therefore never re-asked for.
 * Returns `undefined` when nothing failed, which the modal reports as "nothing
 * to retry" instead of silently running an empty batch.
 */
export function buildFailureRetry(lastRun: ModalSubmission, items: BatchItemResult[]): ModalSubmission | undefined {
    const urls = failedUrlsOf(items);
    return urls.length > 0 ? { ...lastRun, urls } : undefined;
}

/** Path of the first note a run actually created ('' when none did). */
export function firstCreatedFilePath(items: BatchItemResult[]): string {
    return items.find(item => item.result.success && item.result.filePath)?.result.filePath ?? '';
}

/** Retry button label — 'Retry' for a single video, else how many are left. */
export function formatRetryLabel(failedCount: number): string {
    return failedCount <= 1 ? 'Retry' : `Retry ${failedCount} failed`;
}

// ── Keyboard + timing helpers ────────────────────────────────────────────────

/** True when the user has text selected — Ctrl+C must copy that, not our note path. */
export function hasTextSelection(doc: Document = document): boolean {
    // window.getSelection() does not report selections inside form fields in
    // Chromium — check the active element too, or Ctrl+C in the instructions
    // box would copy the note path instead of the user's text.
    const active = doc.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        return active.selectionStart !== active.selectionEnd;
    }
    const selection = doc.getSelection?.()?.toString() ?? '';
    return selection.trim().length > 0;
}

/** True when Enter should keep its editing meaning (multi-line field). */
export function isMultilineField(target: EventTarget | null): boolean {
    return target instanceof HTMLTextAreaElement;
}

type AbortSignalWithTimeout = typeof AbortSignal & { timeout?: (milliseconds: number) => AbortSignal };

/**
 * An AbortSignal that fires after `ms`, or `undefined` on engines without
 * `AbortSignal.timeout` (older Electron builds) so callers can degrade quietly.
 */
export function timeoutSignal(ms: number): AbortSignal | undefined {
    const ctor = AbortSignal as AbortSignalWithTimeout;
    return typeof ctor.timeout === 'function' ? ctor.timeout(ms) : undefined;
}

/**
 * Reject if `promise` has not settled within `ms`, so a hung request cannot pin
 * the modal. The loser of the race is still observed, so nothing is left
 * unhandled.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).then(
        value => {
            if (timer !== undefined) window.clearTimeout(timer);
            return value;
        },
        reason => {
            if (timer !== undefined) window.clearTimeout(timer);
            throw reason;
        },
    );
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
