/**
 * Specs for the YouTube modal's pure helpers (youtube-modal-utils.ts).
 *
 * These cover the decisions the modal component only orchestrates: which URLs a
 * pasted batch actually contains, which ones a retry should re-run, and the
 * small interaction rules (Enter in a textarea, Ctrl+C with a selection, timed
 * network calls) that used to live inline in the component.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    buildFailureRetry,
    EMPTY_PARSED_URLS,
    extractYouTubeUrls,
    failedUrlsOf,
    firstCreatedFilePath,
    formatBatchSummary,
    formatReadyMessage,
    formatRetryLabel,
    hasTextSelection,
    isMultilineField,
    MAX_BATCH_URLS,
    parseUrlInput,
    summarizeBatch,
    timeoutSignal,
    withTimeout,
    ModalSubmission,
} from '../../src/components/features/youtube/youtube-modal-utils';
import { BatchItemResult, ProcessingResult } from '../../src/types';

const ID_A = 'dQw4w9WgXcQ';
const ID_B = 'aaaaaaaaaaa';
const ID_C = 'bbbbbbbbbbb';

const watchA = `https://www.youtube.com/watch?v=${ID_A}`;
const shortA = `https://youtu.be/${ID_A}`;
const watchB = `https://www.youtube.com/watch?v=${ID_B}`;
const shortC = `https://youtu.be/${ID_C}`;

function item(url: string, result: ProcessingResult): BatchItemResult {
    return { url, result };
}

function success(extra: Partial<ProcessingResult> = {}): ProcessingResult {
    return { success: true, ...extra };
}

function failure(error: string): ProcessingResult {
    return { success: false, error };
}

/** `count` distinct video ids the real URL grammar accepts. */
function distinctIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => {
        const id = `v${String(i).padStart(10, '0')}`;
        expect(id).toHaveLength(11);
        return `https://youtu.be/${id}`;
    });
}

const SUBMISSION: ModalSubmission = {
    urls: [watchA, watchB, shortC],
    format: 'executive-summary',
    model: 'gemini-2.5-pro',
    instructions: 'keep it short',
};

describe('parseUrlInput', () => {
    it('keeps a single URL', () => {
        expect(parseUrlInput(watchA)).toEqual({ urls: [watchA], invalidCount: 0, droppedCount: 0 });
    });

    it('treats separators (spaces, commas, semicolons, newlines) as boundaries', () => {
        const parsed = parseUrlInput(`${watchA},\n ${shortA};${watchB}`);
        expect(parsed.urls).toEqual([watchA, watchB]);
        expect(parsed.invalidCount).toBe(0);
    });

    it('strips punctuation stuck to a URL copied out of prose', () => {
        // 'see' is not a URL, so it is counted as skipped.
        expect(parseUrlInput(`see ${shortA}.`)).toEqual({ urls: [shortA], invalidCount: 1, droppedCount: 0 });
    });

    it('counts tokens that are not YouTube URLs', () => {
        const parsed = parseUrlInput(`${watchA} not-a-url https://vimeo.com/1 ${shortC}`);
        expect(parsed.urls).toEqual([watchA, shortC]);
        expect(parsed.invalidCount).toBe(2);
    });

    it('dedupes on the extracted video id, not the string', () => {
        const parsed = parseUrlInput(`${watchA} ${shortA}`);
        expect(parsed.urls).toEqual([watchA]);
        expect(parsed.invalidCount).toBe(0);
        expect(parsed.droppedCount).toBe(0);
    });

    it('keeps the first spelling the user typed and ignores later order', () => {
        expect(parseUrlInput(`${shortA} ${watchA}`).urls).toEqual([shortA]);
    });

    it('does not merge two different videos that share a host', () => {
        expect(parseUrlInput(`${watchA} ${watchB} ${shortC}`).urls).toEqual([watchA, watchB, shortC]);
    });

    it('caps the batch at MAX_BATCH_URLS and reports what it dropped', () => {
        const parsed = parseUrlInput(distinctIds(MAX_BATCH_URLS + 3).join(' '));

        expect(parsed.urls).toHaveLength(MAX_BATCH_URLS);
        expect(parsed.droppedCount).toBe(3);
    });

    it('does not count a duplicate past the cap as dropped', () => {
        const filler = [watchA, ...distinctIds(MAX_BATCH_URLS - 1)];
        const parsed = parseUrlInput([...filler, watchA, watchA].join(' '));

        expect(parsed.urls).toHaveLength(MAX_BATCH_URLS);
        expect(parsed.droppedCount).toBe(0);
    });

    it('returns nothing for blank input', () => {
        expect(parseUrlInput('   ')).toEqual({ urls: [], invalidCount: 0, droppedCount: 0 });
    });
});

describe('extractYouTubeUrls', () => {
    it('pulls URLs out of prose, deduped and capped', () => {
        const text = `Watch ${watchA} (or ${shortA}) and ${watchB}, then more than the limit?`;
        expect(extractYouTubeUrls(text)).toEqual([watchA, watchB]);
    });
});

describe('formatReadyMessage', () => {
    it('speaks in the singular for one video', () => {
        expect(formatReadyMessage({ urls: [watchA], invalidCount: 0, droppedCount: 0 })).toBe(
            'Ready to process this video.',
        );
    });

    it('counts several videos', () => {
        expect(formatReadyMessage({ urls: [watchA, watchB], invalidCount: 0, droppedCount: 0 })).toBe(
            'Ready to process 2 videos.',
        );
    });

    it('reports skipped entries', () => {
        expect(formatReadyMessage({ urls: [watchA], invalidCount: 2, droppedCount: 0 })).toBe(
            '1 video will be processed · 2 skipped.',
        );
    });

    it('reports the URLs a full batch dropped', () => {
        expect(formatReadyMessage({ urls: Array(MAX_BATCH_URLS).fill(watchA), invalidCount: 1, droppedCount: 4 })).toBe(
            `${MAX_BATCH_URLS} videos will be processed · 1 skipped · 4 over the ${MAX_BATCH_URLS}-video limit.`,
        );
    });
});

describe('batch summaries', () => {
    it('counts created, duplicate and failed separately', () => {
        const summary = summarizeBatch([
            item(watchA, success({ filePath: 'a.md' })),
            item(watchB, success({ filePath: 'b.md', duplicateOfPath: 'old.md' })),
            item(shortC, failure('no captions')),
        ]);

        expect(summary).toEqual({ created: 1, duplicates: 1, failed: 1 });
    });

    it('formats only the non-zero parts', () => {
        expect(formatBatchSummary({ created: 0, duplicates: 0, failed: 0 })).toBe('');
        expect(formatBatchSummary({ created: 2, duplicates: 0, failed: 0 })).toBe('✅ 2 created');
        expect(formatBatchSummary({ created: 2, duplicates: 1, failed: 0 })).toBe('✅ 2 created · ⚠️ 1 duplicate');
        expect(formatBatchSummary({ created: 0, duplicates: 2, failed: 1 })).toBe('⚠️ 2 duplicates · ❌ 1 failed');
    });
});

describe('retry selection', () => {
    const partial: BatchItemResult[] = [
        item(watchA, success({ filePath: 'a.md' })),
        item(watchB, failure('video unavailable')),
        item(shortC, failure('no captions')),
    ];

    it('retries only the failures, in their original order', () => {
        expect(failedUrlsOf(partial)).toEqual([watchB, shortC]);
    });

    it('returns nothing when every video succeeded', () => {
        const allGood = [item(watchA, success({ filePath: 'a.md' }))];
        expect(failedUrlsOf(allGood)).toEqual([]);
        expect(buildFailureRetry(SUBMISSION, allGood)).toBeUndefined();
    });

    it("keeps the user's settings and swaps in only the failed URLs", () => {
        expect(buildFailureRetry(SUBMISSION, partial)).toEqual({
            ...SUBMISSION,
            urls: [watchB, shortC],
        });
    });

    it('retries the whole batch when everything failed', () => {
        const allBad = [item(watchA, failure('x')), item(watchB, failure('y'))];
        expect(buildFailureRetry(SUBMISSION, allBad)?.urls).toEqual([watchA, watchB]);
    });

    it('points Open / Copy Path at the first note the run did create', () => {
        expect(firstCreatedFilePath(partial)).toBe('a.md');
        expect(firstCreatedFilePath([item(watchB, failure('x'))])).toBe('');
        expect(firstCreatedFilePath([item(watchA, success())])).toBe('');
    });

    it('labels the retry button by how much is left', () => {
        expect(formatRetryLabel(1)).toBe('Retry');
        expect(formatRetryLabel(3)).toBe('Retry 3 failed');
    });
});

describe('hasTextSelection', () => {
    afterEach(() => {
        window.getSelection()?.removeAllRanges();
    });

    it('is false with nothing selected', () => {
        expect(hasTextSelection()).toBe(false);
    });

    it('is true once the user selects text', () => {
        const host = document.createElement('div');
        host.textContent = 'copy me';
        document.body.appendChild(host);

        const range = document.createRange();
        range.selectNodeContents(host);
        window.getSelection()?.addRange(range);

        expect(hasTextSelection()).toBe(true);
    });

    it('ignores a whitespace-only selection', () => {
        const host = document.createElement('div');
        host.textContent = '   ';
        document.body.appendChild(host);

        const range = document.createRange();
        range.selectNodeContents(host);
        window.getSelection()?.addRange(range);

        expect(hasTextSelection()).toBe(false);
    });
});

describe('isMultilineField', () => {
    it('claims the textarea so Enter keeps its newline meaning', () => {
        expect(isMultilineField(document.createElement('textarea'))).toBe(true);
    });

    it('leaves inputs and non-fields to the modal', () => {
        expect(isMultilineField(document.createElement('input'))).toBe(false);
        expect(isMultilineField(document.createElement('div'))).toBe(false);
        expect(isMultilineField(null)).toBe(false);
    });
});

describe('timeoutSignal', () => {
    it('returns an aborting signal when the runtime supports it, else undefined', () => {
        const supportsTimeout = typeof (AbortSignal as { timeout?: unknown }).timeout === 'function';
        const signal = timeoutSignal(20);

        if (supportsTimeout) {
            expect(signal).toBeInstanceOf(AbortSignal);
        } else {
            expect(signal).toBeUndefined();
        }
    });
});

describe('withTimeout', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('passes the value through when the promise settles in time', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
    });

    it('rejects when the promise is still pending at the deadline', async () => {
        const pending = new Promise<string>(() => undefined);
        const guarded = withTimeout(pending, 500);
        const guarded2 = withTimeout(new Promise<string>(() => undefined), 500);

        jest.advanceTimersByTime(500);

        await expect(guarded).rejects.toThrow('timed out');
        await expect(guarded2).rejects.toThrow('timed out');
    });

    it('stops the timer once the promise settles, so nothing fires late', async () => {
        const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
        await withTimeout(Promise.resolve('ok'), 1000);
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });
});
