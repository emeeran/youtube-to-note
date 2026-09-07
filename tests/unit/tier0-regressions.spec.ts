/**
 * Regression specs for the Tier 0 fixes.
 *
 * Each describe pins one fix so it cannot silently regress:
 *  - ai-service `processWith` restores an overridden model on the shared provider
 *  - video-data caches a *copy*, so the handed-out object stays caller-owned
 *  - templates escape hostile titles into valid YAML and safe HTML attributes
 *  - `withPluginDataLock` serializes concurrent plugin-data read-modify-writes
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { Plugin } from 'obsidian';

import { AIService } from '../../src/services/ai-service';
import * as youtubePage from '../../src/services/youtube-page';
import { YouTubeVideoService } from '../../src/video-data';
import { ProcessingHistoryService, withPluginDataLock } from '../../src/services/processing-history';
import { escapeYamlScalar, generateFrontmatter, generateVideoIframe } from '../../src/templates';
import { AIPromptService } from '../../src/services/prompt-service';
import type { AIProvider, CacheService, TranscriptSegment, YouTubePluginSettings } from '../../src/types';

jest.mock('../../src/services/logger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Video-data scrapes the watch page for extra metadata; stub that out so the
// metadata path is driven entirely by the `fetch` stub below.
jest.mock('../../src/services/youtube-page', () => ({
    assertNotAborted: jest.fn(),
    RequestAbortedError: class extends Error {},
    fetchYouTubePage: jest.fn(async () => '<html></html>'),
    parsePlayerResponse: jest.fn().mockReturnValue({}),
    extractVideoDetails: jest.fn().mockReturnValue({ duration: 600 }),
}));

const TITLE = 'Test Video Title';

function makeSettings(over: Partial<YouTubePluginSettings> = {}): YouTubePluginSettings {
    return {
        geminiApiKey: '',
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
        defaultMaxTokens: 4096,
        defaultTemperature: 0.5,
        ...over,
    };
}

describe('Tier 0 — AIService.processWith restores the overridden model', () => {
    function makeProvider() {
        const provider: AIProvider = {
            name: 'Solo',
            model: 'original-model',
            process: jest.fn(async () => 'content'),
            setModel: jest.fn((model: string) => {
                provider.model = model;
            }),
        };
        return provider;
    }

    it('restores the previous model after each override', async () => {
        const provider = makeProvider();
        const service = new AIService([provider], makeSettings());

        const first = await service.processWith('Solo', 'prompt one', 'override-a');
        expect(first.model).toBe('override-a');
        // Restored as soon as the call finished…
        expect(provider.model).toBe('original-model');

        await service.processWith('Solo', 'prompt two', 'override-b');
        expect(provider.model).toBe('original-model');

        // …so the third, plain call sees the original model again.
        const third = await service.process('plain prompt');
        expect(third.model).toBe('original-model');
        expect(provider.process).toHaveBeenLastCalledWith('plain prompt');
    });

    it('uses the override for the duration of the request, not before/after', async () => {
        const provider = makeProvider();
        const observed: string[] = [];
        provider.process = jest.fn(async () => {
            observed.push(provider.model);
            return 'content';
        });
        const service = new AIService([provider], makeSettings());

        await service.processWith('Solo', 'prompt', 'override-a');
        await service.processWith('Solo', 'prompt', 'override-b');
        await service.process('plain');

        expect(observed).toEqual(['override-a', 'override-b', 'original-model']);
    });

    it('restores the model even when the provider call throws', async () => {
        const provider = makeProvider();
        provider.process = jest.fn(async () => {
            throw new Error('provider exploded');
        });
        const service = new AIService([provider], makeSettings());

        await expect(service.processWith('Solo', 'prompt', 'override-a', undefined, false)).rejects.toThrow(
            'provider exploded',
        );
        expect(provider.model).toBe('original-model');
    });

    it('tolerates a provider that cannot change model at all', async () => {
        const provider: AIProvider = { name: 'Static', model: 'fixed', process: async () => 'content' };
        const service = new AIService([provider], makeSettings());

        await expect(service.processWith('Static', 'prompt', 'override-a')).resolves.toEqual({
            content: 'content',
            provider: 'Static',
            model: 'fixed',
        });
        expect(provider.model).toBe('fixed');
    });
});

describe('Tier 0 — video-data caches a copy, not the handed-out object', () => {
    const VIDEO_ID = 'dQw4w9WgXcQ';
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ title: TITLE, author_name: 'Test Channel', thumbnail_url: 'https://img/thumb.jpg' }),
        }));
        global.fetch = fetchMock as unknown as typeof fetch;
        // The watch-page scrape supplies duration/publishedAt; keep it deterministic.
        const page = jest.mocked(youtubePage);
        page.fetchYouTubePage.mockResolvedValue('<html></html>');
        (page.parsePlayerResponse as jest.Mock).mockReturnValue({});
        (page.extractVideoDetails as jest.Mock).mockReturnValue({ duration: 600 });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    async function makeService() {
        const cache = {
            get: jest.fn().mockReturnValue(null),
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
        };
        const service = new YouTubeVideoService(cache as unknown as CacheService, {
            getSettings: () => makeSettings(),
        });
        // Replace the network-backed transcript service with a stub.
        service.transcriptService = {
            isTranscriptAvailable: jest.fn(async () => true),
        } as unknown as YouTubeVideoService['transcriptService'];
        return { service, cache };
    }

    it('stores a copy, leaving the handed-out object free to be mutated by the caller', async () => {
        const { service, cache } = await makeService();

        // Hand out the object (cache misses on the very first call)…
        const handedOut = await service.getVideoData(VIDEO_ID);
        expect(handedOut.title).toBe(TITLE);

        // set #1: the oEmbed metadata, #2: the video-data result
        expect(cache.set).toHaveBeenCalledTimes(2);
        const cachedCopy = cache.set.mock.calls[1]?.[1] as typeof handedOut;
        expect(cachedCopy).not.toBe(handedOut);

        // Mutating the object the caller owns must not corrupt the cache.
        handedOut.title = 'MUTATED BY CALLER';
        expect(cachedCopy.title).toBe(TITLE);
    });

    it('serves the pristine copy on a cache hit', async () => {
        const { service, cache } = await makeService();
        const handedOut = await service.getVideoData(VIDEO_ID);

        const cachedCopy = cache.set.mock.calls[1]?.[1] as typeof handedOut;
        cache.get.mockReturnValueOnce(cachedCopy);

        handedOut.title = 'MUTATED BY CALLER';
        handedOut.description = 'MUTATED TOO';

        const secondRead = await service.getVideoData(VIDEO_ID);
        expect(secondRead.title).toBe(TITLE);
        expect(secondRead).not.toBe(handedOut);
        // The cache itself still hands out its own object (no defensive copy on read).
        expect(secondRead).toBe(cachedCopy);
    });

    it('never probes transcript availability from the metadata path', async () => {
        const { service, cache } = await makeService();

        // Even a short video must not trigger the (removed, unabortable) prefetch.
        await service.getVideoData(VIDEO_ID);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect((service.transcriptService.isTranscriptAvailable as jest.Mock).mock.calls.length).toBe(0);
        // set #1: the oEmbed metadata, #2: the video-data result — nothing else.
        expect(cache.set).toHaveBeenCalledTimes(2);
    });
});

describe('Tier 0 — templates escape hostile titles', () => {
    const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const VIDEO_ID = 'dQw4w9WgXcQ';

    /** Minimal frontmatter parser: only what generateFrontmatter can emit. */
    function parseFrontmatter(note: string): Record<string, string> {
        const lines = note.split('\n');
        expect(lines[0]).toBe('---');
        const end = lines.indexOf('---', 1);
        expect(end).toBeGreaterThan(0);

        const parsed: Record<string, string> = {};
        for (const line of lines.slice(1, end)) {
            const match = /^([A-Za-z_][A-Za-z0-9_]*): (.*)$/.exec(line);
            expect(match).not.toBeNull();
            const [, key, rawValue] = match!;
            let value = rawValue ?? '';
            if (value.startsWith('"')) {
                value = JSON.parse(value) as string; // double-quoted YAML scalar === JSON string
            } else if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1);
            }
            parsed[key!] = value;
        }
        return parsed;
    }

    it('round-trips escapeYamlScalar through a YAML double-quoted scalar', () => {
        const hostile = 'He said: "hi": ok';
        const encoded = escapeYamlScalar(hostile);
        expect(encoded).toBe('"He said: \\"hi\\": ok"');
        expect(JSON.parse(encoded)).toBe(hostile);
    });

    it('keeps a hostile title on a single, valid YAML line', () => {
        const title = 'He said: "hi": ok';
        const frontmatter = generateFrontmatter(
            title,
            VIDEO_URL,
            VIDEO_ID,
            'executive-summary',
            'Google Gemini',
            'gemini-2.0-flash',
            { title, description: '', channelName: 'Chan: "the sequel"', duration: 91, publishedAt: '2024-01-01' },
        );

        const parsed = parseFrontmatter(frontmatter);
        expect(parsed.title).toBe(title);
        expect(parsed.channel).toBe('Chan: "the sequel"');
        expect(parsed.duration).toBe('91');
        expect(Object.keys(parsed)).toEqual([
            'title',
            'source',
            'created',
            'type',
            'format',
            'tags',
            'video_id',
            'ai_provider',
            'ai_model',
            'channel',
            'duration',
            'published',
        ]);
    });

    it('does not let a multi-line title forge extra frontmatter keys', () => {
        const title = 'Real Title\ninjected_key: pwned\n---';
        const frontmatter = generateFrontmatter(
            title,
            VIDEO_URL,
            VIDEO_ID,
            'article',
            'Groq',
            'llama-3.3-70b-versatile',
        );

        const parsed = parseFrontmatter(frontmatter);
        expect(parsed.title).toBe('Real Title\ninjected_key: pwned\n---');
        expect(parsed.injected_key).toBeUndefined();
        // Exactly two document separators: the frontmatter block itself.
        expect(frontmatter.split('\n').filter(line => line.trim() === '---')).toHaveLength(2);
    });

    it('escapes a hostile title inside the iframe title attribute', () => {
        const hostile = '" onerror=alert(1)';
        const iframe = generateVideoIframe(VIDEO_ID, hostile);

        expect(iframe).toContain('title="&quot; onerror=alert(1)"');
        // The raw quote never reaches the attribute value.
        expect(iframe).not.toContain('title=""');
        expect(iframe).not.toContain('onerror=alert(1)" >');

        const doc = new DOMParser().parseFromString(iframe, 'text/html');
        const iframeEl = doc.querySelector('iframe');
        expect(iframeEl).not.toBeNull();
        // The parser decodes the entity back to the original title.
        expect(iframeEl?.getAttribute('title')).toBe(hostile);
        expect(doc.querySelectorAll('script')).toHaveLength(0);
        expect(iframeEl?.getAttribute('onerror')).toBeNull();
    });

    it('escapes a hostile video id in the embed URL', () => {
        const iframe = generateVideoIframe('abc"&><', 'Nice title');
        expect(iframe).toContain('src="https://www.youtube-nocookie.com/embed/abc&quot;&amp;&gt;&lt;"');
    });

    it('keeps structural frontmatter out of the prompt and assembles the note deterministically (hostile title)', () => {
        const service = new AIPromptService();
        const segments: TranscriptSegment[] = [{ start: 30, duration: 5, text: 'hello' }];
        const videoData = {
            title: 'He said: "hi": ok',
            description: 'A video about quotes: "and colons"',
            channelName: 'Chan',
            duration: 600,
            publishedAt: '2024-01-01',
        };

        const prompt = service.createAnalysisPrompt({
            videoData,
            videoUrl: VIDEO_URL,
            format: 'executive-summary',
            transcript: 'the transcript body',
            segments,
        });

        // The prompt itself carries no YAML frontmatter and no iframe: the model
        // is never asked to echo structural markup it could mangle.
        expect(prompt).not.toContain('title:');
        expect(prompt).not.toContain('<iframe');
        expect(prompt).toContain('He said: "hi": ok'); // title reaches the model as data

        // A minimal model response is enough — processAIResponse assembles the
        // finished note (frontmatter + embed) from known-good values.
        const note = service.processAIResponse(
            '## Executive Summary\n\nBody text',
            'Groq',
            'llama-3.3-70b-versatile',
            'executive-summary',
            videoData,
            VIDEO_URL,
            segments,
        );

        const parsed = parseFrontmatter(note);
        expect(parsed.title).toBe('He said: "hi": ok');
        expect(parsed.video_id).toBe(VIDEO_ID);
        expect(parsed.ai_provider).toBe('Groq');
        // The iframe is embedded with an escaped attribute, not a broken one.
        expect(note).toContain('title="He said: &quot;hi&quot;: ok"');
        expect(note).toContain(`<iframe width="640"`);
        // Deterministic attribution block closes the note.
        expect(note).toContain('## Source');
        expect(note).toContain('**Video**');
    });
});

describe('Prompt assembly regressions', () => {
    const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const service = new AIPromptService();
    const metaData = {
        title: 'Test Video Title',
        description: 'A description',
        channelName: 'Channel',
        duration: 600,
        publishedAt: '2024-01-01',
    };

    it('prepends the deterministic header to content that opens with a `---` horizontal rule', () => {
        const note = service.processAIResponse(
            '---\n\n## Executive Summary\n\nBody text',
            'Groq',
            'llama-3.3-70v',
            'quick-notes',
            metaData,
            VIDEO_URL,
        );

        // Real frontmatter + embed go in front of the rule…
        expect(note.startsWith('---\ntitle:')).toBe(true);
        expect(note).toContain('<iframe');
        // …so `ai_provider` lands in the frontmatter, not underneath the rule.
        expect(note.indexOf('ai_provider:')).toBeGreaterThan(-1);
        expect(note.indexOf('ai_provider:')).toBeLessThan(note.indexOf('## Executive Summary'));
        // The model's own leading rule is left in place.
        expect(note).toContain('---\n\n## Executive Summary');
    });

    it('still recognises real frontmatter and does not add a second header', () => {
        const note = service.processAIResponse(
            '---\ntitle: "Existing"\n---\n\nBody text',
            'Groq',
            'llama-3.3-70v',
            'quick-notes',
            metaData,
            VIDEO_URL,
        );

        expect(note.startsWith('---\n')).toBe(true);
        expect(note).toContain('title: "Existing"');
        expect(note).not.toContain('<iframe');
        // The ai_* safety net still repairs the existing block in place.
        expect(note).toContain('ai_provider: "Groq"');
        expect(note.match(/^---$/gm)).toHaveLength(2);
    });

    it('does not duplicate a Resources section the model already wrote', () => {
        const lowercase = service.processAIResponse(
            '## Notes\n\nBody\n\n## resources\n\n- existing link',
            'Groq',
            'llama-3.3-70v',
            'quick-notes',
            metaData,
            VIDEO_URL,
        );
        expect(lowercase.match(/^##\s*resources\b/gim)).toHaveLength(1);
        expect(lowercase).not.toContain('- Video URL:');

        // A built-in citations heading counts too — same heading, other words after it.
        const citations = service.processAIResponse(
            'Body\n\n## Resources & Citations\n\n- existing link',
            'Groq',
            'llama-3.3-70v',
            'quick-notes',
            metaData,
            VIDEO_URL,
        );
        expect(citations).not.toContain('- Video URL:');
    });

    it('leaves a Source section the model wrote alone, wherever it sits', () => {
        // Starts with the heading: no preceding newline, so the old
        // `includes('\n## Source')` check missed it and appended a duplicate.
        const leading = service.processAIResponse(
            '## Source\n\n> [!info] My own attribution',
            'Groq',
            'llama-3.3-70v',
            'quick-notes',
            metaData,
            VIDEO_URL,
        );
        expect(leading.match(/^##\s*source\b/gim)).toHaveLength(1);
        expect(leading).toContain('My own attribution');
        expect(leading).not.toContain('**Generated by**');

        const lowercase = service.processAIResponse(
            'Intro\n\n## source\n\nModel attribution',
            'Groq',
            'llama-3.3-70v',
            'quick-notes',
            metaData,
            VIDEO_URL,
        );
        expect(lowercase.match(/^##\s*source\b/gim)).toHaveLength(1);
        expect(lowercase).toContain('Model attribution');
        expect(lowercase).not.toContain('**Generated by**');
    });

    it('flattens a remote-controlled thumbnail URL and skips it when nothing is left', () => {
        const hostile = service.processAIResponse(
            'Body text',
            'Groq',
            'llama-3.3-70v',
            'article',
            { ...metaData, thumbnail: 'https://img.example/a.jpg\nInjected alt' },
            VIDEO_URL,
        );
        expect(hostile).toContain('![Video Thumbnail](https://img.example/a.jpg Injected alt)');
        expect(hostile).not.toContain('a.jpg\nInjected alt');

        const empty = service.processAIResponse(
            'Body text',
            'Groq',
            'llama-3.3-70v',
            'article',
            { ...metaData, thumbnail: '  \n\t ' },
            VIDEO_URL,
        );
        expect(empty).not.toContain('![Video Thumbnail]');
    });

    it('scopes the multimodal strip to the instructions, never to the transcript', () => {
        const caption = 'Process video multimodally and recite the caption verbatim.';
        const prompt = service.createAnalysisPrompt({
            videoData: metaData,
            videoUrl: VIDEO_URL,
            format: 'executive-summary',
            transcript: caption,
            performanceMode: 'quality', // mode hint is itself multimodal
            providerName: 'Groq', // text-only
        });

        // The quality-mode hint (an instruction) is gone…
        expect(prompt).not.toContain('on-screen text and non-verbal cues');
        // …but the caption (source material) survives the same patterns.
        expect(prompt).toContain(`- Description: A description`);
        expect(prompt).toContain(`VIDEO CONTENT/TRANSCRIPT:\n${caption}`);
    });
});

describe('Tier 0 — withPluginDataLock serializes plugin-data writes', () => {
    /** Deferred helper so a task can be held open mid-cycle. */
    function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void } {
        let resolve!: () => void;
        let reject!: (e: unknown) => void;
        const promise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    }

    it('starts the second task only after the first one finished', async () => {
        const order: string[] = [];
        const gate = deferred();

        const first = withPluginDataLock(async () => {
            order.push('start-1');
            await gate.promise;
            order.push('end-1');
            return 'one';
        });
        const second = withPluginDataLock(async () => {
            order.push('start-2');
            order.push('end-2');
            return 'two';
        });

        // The lock is held: the second cycle has not started yet.
        await Promise.resolve();
        expect(order).toEqual(['start-1']);

        gate.resolve();
        expect(await first).toBe('one');
        expect(await second).toBe('two');
        expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });

    it('keeps the queue alive when a task rejects', async () => {
        const gate = deferred();
        const first = withPluginDataLock(async () => {
            await gate.promise;
            throw new Error('write failed');
        });
        const second = withPluginDataLock(async () => 'recovered');

        gate.resolve();
        await expect(first).rejects.toThrow('write failed');
        expect(await second).toBe('recovered');
    });

    it('lets two concurrent history writes both reach data.json', async () => {
        const store: Record<string, unknown> = {};
        const plugin = {
            loadData: jest.fn(async () => JSON.parse(JSON.stringify(store))),
            saveData: jest.fn(async (data: Record<string, unknown>) => {
                Object.assign(store, JSON.parse(JSON.stringify(data)));
            }),
        } as unknown as Plugin;

        const service = new ProcessingHistoryService(plugin);
        await service.loadAsync();

        await Promise.all([
            service.add({
                videoId: 'aaaaaaaaaaa',
                title: 'First',
                url: 'https://youtu.be/aaaaaaaaaaa',
                format: 'executive-summary',
                provider: 'Groq',
                model: 'llama-3.3-70b-versatile',
                filePath: 'YouTube/First.md',
            }),
            service.add({
                videoId: 'bbbbbbbbbbb',
                title: 'Second',
                url: 'https://youtu.be/bbbbbbbbbbb',
                format: 'executive-summary',
                provider: 'Groq',
                model: 'llama-3.3-70b-versatile',
                filePath: 'YouTube/Second.md',
            }),
        ]);

        const persisted = store['ytc-processing-history'] as Array<{ videoId: string }>;
        expect(persisted).toHaveLength(2);
        expect(persisted.map(entry => entry.videoId).sort()).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
        expect(service.getAll()).toHaveLength(2);
    });
});
