/**
 * Unit tests for the `processYouTubeVideo` pipeline in `src/main.ts`.
 *
 * The plugin class is constructed with the mocked Obsidian `Plugin` base and
 * its private `_settings` / `serviceContainer` / `historyService` slots are
 * injected directly, so each test drives only the pipeline (not `onload`).
 *
 * `onload` is deliberately not exercised: it constructs the real
 * ServiceContainer, which wires network-backed providers and vault writes —
 * that belongs to an integration test, not a unit one.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { PluginManifest } from 'obsidian';
import YoutubeClipperPlugin from '../../src/main';
import { getNoticeCalls, resetNoticeCalls } from '../__mocks__/obsidian';
import { ProcessingHistoryService } from '../../src/services/processing-history';
import type {
    AIResponse,
    OutputFormat,
    ProcessingResult,
    PromptService,
    ServiceContainer,
    TranscriptOutcome,
    VideoData,
    VideoDataService,
    YouTubePluginSettings,
} from '../../src/types';

const VIDEO_ID = 'dQw4w9WgXcQ';
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

/** Shape `PromptService.createAnalysisPrompt` reports real trimming through. */
interface TruncationInfo {
    budget: number;
    originalLength: number;
}

const VIDEO_DATA: VideoData = {
    title: 'Test Video Title',
    description: 'A test video',
    duration: 600,
    channelName: 'Test Channel',
    publishedAt: '2024-01-01T00:00:00Z',
    thumbnail: 'https://example.com/thumb.jpg',
};

const SUCCESS_RESPONSE: AIResponse = {
    content: '# Generated note',
    provider: 'Google Gemini',
    model: 'gemini-2.0-flash',
};

const OK_TRANSCRIPT: TranscriptOutcome = {
    ok: true,
    transcript: {
        fullText: 'hello world, this is the transcript',
        segments: [{ start: 0, duration: 2, text: 'hello world' }],
        language: 'en',
        truncated: false,
    },
};

function makeSettings(over: Partial<YouTubePluginSettings> = {}): YouTubePluginSettings {
    return {
        geminiApiKey: `AIza${'A'.repeat(35)}`,
        groqApiKey: '',
        ollamaApiKey: '',
        ollamaEndpoint: 'http://localhost:11434',
        huggingFaceApiKey: '',
        openRouterApiKey: '',
        outputPath: 'YouTube/Notes',
        useEnvironmentVariables: false,
        environmentPrefix: 'YTC',
        performanceMode: 'balanced',
        enableParallelProcessing: true,
        enableAutoFallback: true,
        preferMultimodal: true,
        transcriptLanguage: '',
        includeTimestamps: true,
        warnOnDuplicates: true,
        persistTranscriptCache: false,
        customPrompts: {},
        defaultMaxTokens: 4096,
        defaultTemperature: 0.5,
        ...over,
    };
}

function makeManifest(over: Partial<PluginManifest> = {}): PluginManifest {
    return {
        id: 'youtube-to-note',
        name: 'YouTube to Note',
        author: 'Test Author',
        version: '2.0.0',
        minAppVersion: '1.4.0',
        description: 'Turn a YouTube video into a note',
        isDesktopOnly: false,
        dir: '.obsidian/plugins/youtube-to-note',
        ...over,
    };
}

/** Every collaborator the stubbed container exposes, as a typed jest.fn. */
interface ContainerMocks {
    extractVideoId: jest.Mock;
    getVideoData: jest.Mock;
    fetchTranscriptOutcome: jest.Mock;
    getProviderNames: jest.Mock;
    setModelParameters: jest.Mock;
    processWith: jest.Mock;
    createAnalysisPrompt: jest.Mock;
    processAIResponse: jest.Mock;
    saveToFile: jest.Mock;
}

/** Build a fully-stubbed container: every collaborator is a jest.fn. */
function makeContainer(
    overrides: {
        transcriptOutcome?: TranscriptOutcome;
        processWith?: jest.Mock;
        videoData?: VideoData;
    } = {},
): { container: ServiceContainer; mocks: ContainerMocks } {
    const processWith = overrides.processWith ?? jest.fn(async () => SUCCESS_RESPONSE);

    const mocks: ContainerMocks = {
        extractVideoId: jest.fn(() => VIDEO_ID),
        getVideoData: jest.fn(async () => overrides.videoData ?? VIDEO_DATA),
        fetchTranscriptOutcome: jest.fn(async () => overrides.transcriptOutcome ?? OK_TRANSCRIPT),
        getProviderNames: jest.fn(() => ['Google Gemini', 'Groq']),
        setModelParameters: jest.fn(),
        processWith,
        createAnalysisPrompt: jest.fn(() => 'ANALYSIS PROMPT'),
        processAIResponse: jest.fn(() => 'FORMATTED NOTE'),
        saveToFile: jest.fn(async () => 'YouTube/Notes/Test Video Title.md'),
    };

    const container = {
        aiService: {
            getProviderNames: mocks.getProviderNames,
            setModelParameters: mocks.setModelParameters,
            processWith: mocks.processWith,
        },
        videoService: {
            extractVideoId: mocks.extractVideoId,
            getVideoData: mocks.getVideoData,
            fetchTranscriptOutcome: mocks.fetchTranscriptOutcome,
        } as unknown as VideoDataService,
        fileService: {
            saveToFile: mocks.saveToFile,
            openFileWithConfirmation: jest.fn(),
        },
        cacheService: { get: jest.fn(), set: jest.fn(), delete: jest.fn(), clear: jest.fn() },
        promptService: {
            createAnalysisPrompt: mocks.createAnalysisPrompt,
            processAIResponse: mocks.processAIResponse,
        } as unknown as PromptService,
    } as unknown as ServiceContainer;

    return { container, mocks };
}

/** Plugin with private slots injected — `onload` is never called. */
function makePlugin(
    settings: YouTubePluginSettings,
    container: ServiceContainer,
    history?: Partial<ProcessingHistoryService>,
): YoutubeClipperPlugin {
    const plugin = new YoutubeClipperPlugin({} as never, makeManifest());
    Object.assign(plugin, { _settings: settings, serviceContainer: container, historyService: history });
    return plugin;
}

interface ProgressSpy {
    stages: string[];
    updates: Array<{ stage: string; detail?: string }>;
}

function makeProgressSpy(): ProgressSpy & { onProgress: (u: { stage: string; detail?: string }) => void } {
    const updates: Array<{ stage: string; detail?: string }> = [];
    return {
        updates,
        get stages(): string[] {
            const seen: string[] = [];
            for (const update of updates) {
                if (!seen.includes(update.stage)) seen.push(update.stage);
            }
            return seen;
        },
        onProgress: update => {
            updates.push(update);
        },
    };
}

describe('processYouTubeVideo pipeline', () => {
    beforeEach(() => {
        resetNoticeCalls();
    });

    describe('success path', () => {
        it('returns a populated ProcessingResult and saves the note', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.filePath).toBe('YouTube/Notes/Test Video Title.md');
            expect(result.providerUsed).toBe('Google Gemini');
            expect(result.modelUsed).toBe('gemini-2.0-flash');
            expect(result.warnings).toEqual([]);

            expect(mocks.extractVideoId).toHaveBeenCalledWith(VIDEO_URL);
            expect(mocks.getVideoData).toHaveBeenCalledWith(VIDEO_ID, expect.anything());
            expect(mocks.fetchTranscriptOutcome).toHaveBeenCalledWith(VIDEO_ID, '', expect.anything());
            expect(mocks.saveToFile).toHaveBeenCalledWith('Test Video Title', 'FORMATTED NOTE', 'YouTube/Notes');
            expect(mocks.processAIResponse).toHaveBeenCalledWith(
                SUCCESS_RESPONSE.content,
                SUCCESS_RESPONSE.provider,
                SUCCESS_RESPONSE.model,
                'executive-summary',
                VIDEO_DATA,
                VIDEO_URL,
                OK_TRANSCRIPT.ok ? OK_TRANSCRIPT.transcript.segments : undefined,
            );
        });

        it('reports progress through every stage, in execution order', async () => {
            const { container } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);
            const spy = makeProgressSpy();

            await plugin.processYouTubeVideo(VIDEO_URL, { onProgress: spy.onProgress });

            expect(spy.stages).toEqual(['metadata', 'transcript', 'prompt', 'ai', 'save']);
            expect(spy.updates[spy.updates.length - 1]?.detail).toBe('Saving note…');
            // Providers are announced individually inside the 'ai' stage.
            expect(spy.updates.some(update => update.detail === 'Trying Google Gemini…')).toBe(true);
        });

        it('notifies on start and completion only', async () => {
            const { container } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);

            await plugin.processYouTubeVideo(VIDEO_URL);

            expect(getNoticeCalls()).toHaveLength(2);
            expect(getNoticeCalls()[0]?.message).toBe('Processing YouTube video...');
            expect(getNoticeCalls()[1]?.message).toBe('Successfully processed: Test Video Title');
        });

        it('threads the per-run format, model, provider and user instructions through', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);

            await plugin.processYouTubeVideo(VIDEO_URL, {
                format: 'article' as OutputFormat,
                model: 'gemini-1.5-flash',
                providerName: 'Groq',
                userInstructions: 'Keep it under 200 words',
            });

            expect(mocks.createAnalysisPrompt).toHaveBeenCalledWith(
                expect.objectContaining({
                    format: 'article',
                    providerName: 'Groq',
                    userInstructions: 'Keep it under 200 words',
                    videoUrl: VIDEO_URL,
                }),
            );
            expect(mocks.processWith).toHaveBeenCalledWith(
                'Groq',
                'ANALYSIS PROMPT',
                'gemini-1.5-flash',
                undefined,
                false,
                expect.objectContaining({ signal: expect.anything(), maxTokens: 4096, temperature: 0.5 }),
            );
            // A pinned provider is tried first; the chain stops at the first success.
            expect(mocks.processWith).toHaveBeenCalledTimes(1);
            expect(mocks.processAIResponse.mock.calls[0]?.[3]).toBe('article');
        });

        it('omits transcript segments when timestamps are disabled', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings({ includeTimestamps: false }), container);

            await plugin.processYouTubeVideo(VIDEO_URL);

            expect(mocks.createAnalysisPrompt).toHaveBeenCalledWith(expect.objectContaining({ segments: undefined }));
        });

        it('flags a source-capped transcript as both a flag and a warning', async () => {
            const truncated: TranscriptOutcome = {
                ok: true,
                transcript: { fullText: 'partial', segments: [], truncated: true },
            };
            const { container } = makeContainer({ transcriptOutcome: truncated });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(true);
            expect(result.transcriptTruncated).toBe(true);
            expect(result.warnings?.join(' ')).toContain('capped at the source ceiling of 150,000');
        });

        it('surfaces the real budget numbers when PromptService trims the transcript', async () => {
            const { container, mocks } = makeContainer();
            mocks.createAnalysisPrompt.mockImplementation(options => {
                const info = options as { onTruncated?: (info: TruncationInfo) => void };
                info.onTruncated?.({ budget: 20_000, originalLength: 95_000 });
                return 'ANALYSIS PROMPT';
            });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(true);
            expect(result.transcriptTruncated).toBe(true);
            expect(result.warnings?.join(' ')).toContain(
                'Transcript trimmed to the first 20,000 of 95,000 characters for this format.',
            );
        });

        it('reports both truncation sources in the same run as two distinct warnings', async () => {
            const truncated: TranscriptOutcome = {
                ok: true,
                transcript: { fullText: 'partial', segments: [], truncated: true },
            };
            const { container, mocks } = makeContainer({ transcriptOutcome: truncated });
            mocks.createAnalysisPrompt.mockImplementation(options => {
                const info = options as { onTruncated?: (info: TruncationInfo) => void };
                info.onTruncated?.({ budget: 20_000, originalLength: 95_000 });
                return 'ANALYSIS PROMPT';
            });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(true);
            // One flag, two reasons: the source ceiling and the per-format budget.
            expect(result.transcriptTruncated).toBe(true);
            expect(result.warnings).toHaveLength(2);
            expect(result.warnings?.join(' ')).toContain('capped at the source ceiling of 150,000');
            expect(result.warnings?.join(' ')).toContain(
                'Transcript trimmed to the first 20,000 of 95,000 characters for this format.',
            );
        });

        it('keeps going when a progress callback throws', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);
            const spy = makeProgressSpy();
            spy.onProgress = () => {
                throw new Error('renderer blew up');
            };

            const result = await plugin.processYouTubeVideo(VIDEO_URL, { onProgress: spy.onProgress });

            expect(result.success).toBe(true);
            expect(result.filePath).toBe('YouTube/Notes/Test Video Title.md');
            expect(mocks.saveToFile).toHaveBeenCalledTimes(1);
        });

        it('threads the settings-level prompt overrides through to the prompt service', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(
                makeSettings({ customPrompts: { 'quick-notes': 'Answer in five bullets.' } }),
                container,
            );

            await plugin.processYouTubeVideo(VIDEO_URL, { format: 'quick-notes' as OutputFormat });

            expect(mocks.createAnalysisPrompt).toHaveBeenCalledWith(
                expect.objectContaining({
                    format: 'quick-notes',
                    customPrompts: { 'quick-notes': 'Answer in five bullets.' },
                }),
            );
        });

        it('records the run in processing history', async () => {
            const { container } = makeContainer();
            const history = {
                find: jest.fn(() => undefined),
                add: jest.fn(async () => undefined),
            };
            const plugin = makePlugin(makeSettings(), container, history as unknown as ProcessingHistoryService);

            await plugin.processYouTubeVideo(VIDEO_URL);

            expect(history.find).toHaveBeenCalledWith(VIDEO_ID);
            expect(history.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    videoId: VIDEO_ID,
                    url: VIDEO_URL,
                    title: 'Test Video Title',
                    provider: 'Google Gemini',
                    model: 'gemini-2.0-flash',
                    filePath: 'YouTube/Notes/Test Video Title.md',
                }),
            );
        });
    });

    describe('provider fallback', () => {
        it('attributes the providers that failed and warns about the fallback', async () => {
            const processWith = jest
                .fn<() => Promise<AIResponse>>()
                .mockRejectedValueOnce(new Error('quota exhausted'))
                .mockResolvedValueOnce({ content: 'ok', provider: 'Groq', model: 'llama-3.3-70b-versatile' });
            const { container, mocks } = makeContainer({ processWith });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(true);
            expect(result.failedProviders).toEqual(['Google Gemini']);
            expect(result.providerUsed).toBe('Groq');
            expect(result.warnings?.join(' ')).toContain('Fell back to Groq after Google Gemini failed');
            expect(mocks.processAIResponse.mock.calls[0]?.[1]).toBe('Groq');
        });

        it('fails with every provider attributed when the whole chain fails', async () => {
            const processWith = jest.fn<() => Promise<AIResponse>>().mockRejectedValue(new Error('down'));
            const { container, mocks } = makeContainer({ processWith });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(false);
            expect(result.error).toBe('down');
            expect(result.failedProviders).toEqual(['Google Gemini', 'Groq']);
            expect(result.providerUsed).toBeUndefined();
            expect(getNoticeCalls()).toHaveLength(2); // "processing" + the failure notice
            expect(getNoticeCalls()[1]?.message).toContain('down');
            expect(mocks.saveToFile).not.toHaveBeenCalled();
        });

        it('tries only the pinned provider when auto-fallback is off', async () => {
            const processWith = jest.fn<() => Promise<AIResponse>>().mockRejectedValue(new Error('down'));
            const { container, mocks } = makeContainer({ processWith });
            const plugin = makePlugin(makeSettings(), container);

            await plugin.processYouTubeVideo(VIDEO_URL, { providerName: 'Groq', enableAutoFallback: false });

            expect(mocks.processWith).toHaveBeenCalledTimes(1);
            expect(mocks.processWith.mock.calls[0]?.[0]).toBe('Groq');
        });

        it('sends per-run generation parameters with the request, not on the shared providers', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);

            await plugin.processYouTubeVideo(VIDEO_URL, { maxTokens: 1024, temperature: 0.2 });

            expect(mocks.setModelParameters).not.toHaveBeenCalled();
            expect(mocks.processWith).toHaveBeenCalledWith(
                'Google Gemini',
                'ANALYSIS PROMPT',
                undefined,
                undefined,
                false,
                expect.objectContaining({ maxTokens: 1024, temperature: 0.2, signal: expect.anything() }),
            );
        });

        it('falls back to the settings defaults when a run sets no generation parameters', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings({ defaultMaxTokens: 8192, defaultTemperature: 0.3 }), container);

            await plugin.processYouTubeVideo(VIDEO_URL);

            expect(mocks.processWith).toHaveBeenCalledWith(
                'Google Gemini',
                'ANALYSIS PROMPT',
                undefined,
                undefined,
                false,
                expect.objectContaining({ maxTokens: 8192, temperature: 0.3 }),
            );
        });
    });

    describe('cancellation', () => {
        it('returns a clean cancelled result and fires no Notice when pre-aborted', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);
            const controller = new AbortController();
            controller.abort();

            const result = await plugin.processYouTubeVideo(VIDEO_URL, { signal: controller.signal });

            expect(result).toEqual({ success: false, error: 'Processing cancelled', warnings: [] });
            expect(getNoticeCalls()).toHaveLength(0);
            expect(mocks.getVideoData).not.toHaveBeenCalled();
            expect(mocks.processWith).not.toHaveBeenCalled();
        });

        it('propagates an abort raised mid-run into the cancelled result', async () => {
            const controller = new AbortController();
            const processWith = jest.fn<() => Promise<AIResponse>>().mockImplementation(() => {
                controller.abort();
                return Promise.reject(new Error('The user aborted a request.'));
            });
            const { container, mocks } = makeContainer({ processWith });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL, { signal: controller.signal });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Processing cancelled');
            expect(result.filePath).toBeUndefined();
            expect(mocks.saveToFile).not.toHaveBeenCalled();
        });

        it('refuses to start while the plugin is unloading', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings(), container);
            Object.assign(plugin, { isUnloading: true });

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            // Returns before the warnings array is even allocated — nothing else is set.
            expect(result).toEqual({ success: false, error: 'Plugin is shutting down' });
            expect(mocks.getVideoData).not.toHaveBeenCalled();
        });
    });

    describe('transcript failures', () => {
        /** Reasons that abort the run (no-captions deliberately does not — see below). */
        const FAILING_REASONS = ['restricted', 'private', 'unavailable', 'network', 'unknown'] as const;

        it.each(FAILING_REASONS)(
            'explains a "%s" transcript failure as a distinct Notice + result error',
            async reason => {
                const outcome: TranscriptOutcome = { ok: false, reason, message: `detail for ${reason}` };
                const { container, mocks } = makeContainer({ transcriptOutcome: outcome });
                const plugin = makePlugin(makeSettings(), container);

                const result = await plugin.processYouTubeVideo(VIDEO_URL);

                expect(result.success).toBe(false);
                expect(result.error).toBe(getNoticeCalls()[1]?.message);
                expect(result.error).not.toBe('Processing cancelled');
                expect(mocks.processWith).not.toHaveBeenCalled();
                expect(mocks.saveToFile).not.toHaveBeenCalled();
                expect(getNoticeCalls()).toHaveLength(2);
            },
        );

        it('gives every failing reason a different user-facing message', async () => {
            const messages = new Set<string>();
            for (const reason of FAILING_REASONS) {
                resetNoticeCalls();
                const { container } = makeContainer({ transcriptOutcome: { ok: false, reason } });
                const plugin = makePlugin(makeSettings(), container);
                const result: ProcessingResult = await plugin.processYouTubeVideo(VIDEO_URL);
                messages.add(result.error ?? '');
            }
            expect(messages.size).toBe(FAILING_REASONS.length);
        });

        it('still produces a metadata-only note when the video has no captions', async () => {
            const { container, mocks } = makeContainer({
                transcriptOutcome: { ok: false, reason: 'no-captions' },
            });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            // A caption-less video is not a failure: the note is built from metadata.
            expect(result.success).toBe(true);
            expect(result.filePath).toBe('YouTube/Notes/Test Video Title.md');
            expect(result.warnings?.join(' ')).toContain('No captions available');
            expect(getNoticeCalls().some(call => call.message.startsWith('🚫'))).toBe(true);
            expect(mocks.processWith).toHaveBeenCalledTimes(1);
        });

        it('treats a whitespace-only transcript as "no captions", not as a failure', async () => {
            const { container, mocks } = makeContainer({
                transcriptOutcome: { ok: true, transcript: { fullText: '   \n\t', segments: [] } },
            });
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.warnings?.join(' ')).toContain('No captions available');
            expect(mocks.processWith).toHaveBeenCalledTimes(1);
        });
    });

    describe('guards', () => {
        it('rejects invalid configuration before any work', async () => {
            const { container, mocks } = makeContainer();
            const plugin = makePlugin(makeSettings({ geminiApiKey: 'not-a-real-key', outputPath: '' }), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Configuration invalid');
            expect(getNoticeCalls()[1]?.message).toContain('Configuration invalid');
            expect(mocks.getVideoData).not.toHaveBeenCalled();
        });

        it('fails when no video id can be extracted', async () => {
            const { container, mocks } = makeContainer();
            (container.videoService.extractVideoId as jest.Mock<() => string | null>).mockReturnValue(null);
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo('https://example.com/not-a-video');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Could not extract video ID from URL. Please check the URL format.');
            expect(mocks.getVideoData).not.toHaveBeenCalled();
        });

        it('fails when the service container is missing', async () => {
            const plugin = makePlugin(makeSettings(), undefined as unknown as ServiceContainer);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Service container not initialized');
        });

        it('warns about a duplicate before doing any AI work', async () => {
            const { container, mocks } = makeContainer();
            const history = {
                find: jest.fn(() => ({
                    videoId: VIDEO_ID,
                    title: 'Test Video Title',
                    url: VIDEO_URL,
                    format: 'executive-summary',
                    provider: 'Google Gemini',
                    model: 'gemini-2.0-flash',
                    filePath: 'YouTube/Notes/Existing note.md',
                    processedAt: '2024-03-04T05:06:07.000Z',
                })),
                add: jest.fn(async () => undefined),
            };
            const plugin = makePlugin(makeSettings(), container, history as unknown as ProcessingHistoryService);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.duplicateOfPath).toBe('YouTube/Notes/Existing note.md');
            expect(result.warnings?.join(' ')).toContain('This video was already processed on');
            expect(getNoticeCalls().some(call => call.message.includes('ℹ️ Duplicate'))).toBe(true);
            // A duplicate warns but never blocks the run.
            expect(result.success).toBe(true);
            expect(mocks.processWith).toHaveBeenCalledTimes(1);
        });

        it('stays silent about duplicates when warnOnDuplicates is off', async () => {
            const { container } = makeContainer();
            const history = { find: jest.fn(() => ({ filePath: 'x.md', processedAt: '2024-03-04' })) };
            const plugin = makePlugin(
                makeSettings({ warnOnDuplicates: false }),
                container,
                history as unknown as ProcessingHistoryService,
            );

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.duplicateOfPath).toBeUndefined();
            expect(result.warnings).toEqual([]);
            expect(getNoticeCalls().some(call => call.message.includes('Duplicate'))).toBe(false);
        });

        it('survives a metadata fetch failure and reports it', async () => {
            const { container, mocks } = makeContainer();
            (container.videoService.getVideoData as jest.Mock<() => Promise<unknown>>).mockRejectedValue(
                new Error('video not found'),
            );
            const plugin = makePlugin(makeSettings(), container);

            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(false);
            expect(result.error).toBe('video not found');
            expect(mocks.fetchTranscriptOutcome).not.toHaveBeenCalled();
        });

        it('never throws, even when the transcript service rejects', async () => {
            const { container } = makeContainer();
            (container.videoService.fetchTranscriptOutcome as jest.Mock<() => Promise<unknown>>).mockRejectedValue(
                new Error('boom'),
            );
            const plugin = makePlugin(makeSettings(), container);

            // The typed path failing falls back to the legacy `{ fullText }` API,
            // which this stub does not implement — so the note is still produced.
            const result = await plugin.processYouTubeVideo(VIDEO_URL);

            expect(result.success).toBe(true);
        });
    });
});
