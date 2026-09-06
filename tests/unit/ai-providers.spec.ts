/**
 * Smoke specs for the AI provider clients.
 *
 * These pin the transport contract that is easy to get wrong: credentials go in
 * HEADERS (never a URL query string), the abort signal actually reaches fetch,
 * and a failed auxiliary request comes back as a clean, provider-labelled Error.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GeminiProvider } from '../../src/ai/gemini';
import { GroqProvider } from '../../src/ai/groq';
import { OpenRouterProvider } from '../../src/ai/openrouter';
import { API_ENDPOINTS } from '../../src/ai/api';
import type { AIRequestOptions } from '../../src/types';

type FetchMock = jest.Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>>;

const KEY = 'test-api-key-1234567890';
const PROMPT = 'Summarize this YouTube video for me.';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const GEMINI_BODY = { candidates: [{ content: { parts: [{ text: 'gemini says hi' }] } }] };
const OPENAI_BODY = { choices: [{ message: { content: 'openai-compatible says hi' } }] };

/** Stub global.fetch, recording every call. */
function stubFetch(handler?: (url: string, init: RequestInit) => Response): FetchMock {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        handler ? handler(String(input), (init ?? {}) as RequestInit) : jsonResponse(200, GEMINI_BODY),
    ) as unknown as FetchMock;
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

function lastCall(fetchMock: FetchMock): { url: string; init: RequestInit } {
    const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

/** A fetch that dies the way an aborted request does (AbortError), immediately. */
function stubAbortedFetch(): FetchMock {
    const fetchMock = jest.fn(
        () =>
            new Promise<Response>((_resolve, reject) => {
                setTimeout(() => {
                    const error = new Error('The operation was aborted.');
                    error.name = 'AbortError';
                    reject(error);
                }, 0);
            }),
    ) as unknown as FetchMock;
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

/** A fetch that fails with AbortError whenever it is handed an already-aborted signal. */
function abortAwareHandler(body: unknown) {
    return (_url: string, init: RequestInit): Response => {
        if ((init.signal as AbortSignal | undefined)?.aborted) {
            throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
        }
        return jsonResponse(200, body);
    };
}

describe.each([
    ['Gemini', () => new GeminiProvider(KEY), API_ENDPOINTS.GEMINI_BASE, GEMINI_BODY],
    ['Groq', () => new GroqProvider(KEY), API_ENDPOINTS.GROQ, OPENAI_BODY],
])('%s transport', (_name, makeProvider, endpoint, body) => {
    let fetchMock: FetchMock;

    beforeEach(() => {
        fetchMock = stubFetch(() => jsonResponse(200, body));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as { fetch?: unknown }).fetch;
    });

    it('sends the credential in a header, never in the URL', async () => {
        await makeProvider().process(PROMPT);

        const { url, init } = lastCall(fetchMock);
        expect(url).not.toContain('key=');
        expect(url).not.toContain(KEY);
        expect(url).toContain(endpoint);
        const headers = init.headers as Record<string, string>;
        expect(Object.values(headers).join(' ')).toContain(KEY);
    });

    it('reaches fetch with the caller-supplied abort signal, which rejects the request', async () => {
        fetchMock = stubFetch(abortAwareHandler(body));
        const controller = new AbortController();
        controller.abort();
        const options: AIRequestOptions = { signal: controller.signal };

        await expect(makeProvider().process(PROMPT, options)).rejects.toThrow(/aborted/i);

        const { init } = lastCall(fetchMock);
        expect((init.signal as AbortSignal | undefined)?.aborted).toBe(true);
    });

    it('leaves the signal untouched when one is supplied (no hidden timeout)', async () => {
        const controller = new AbortController();
        await makeProvider().process(PROMPT, { signal: controller.signal });
        expect(lastCall(fetchMock).init.signal).toBe(controller.signal);
    });

    it('rejects with a readable error when the endpoint fails', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { message: 'kaboom' } }));
        await expect(makeProvider().process(PROMPT)).rejects.toThrow('Service temporarily unavailable');
    });
});

describe('GeminiProvider', () => {
    let fetchMock: FetchMock;

    beforeEach(() => {
        fetchMock = stubFetch(() => jsonResponse(200, GEMINI_BODY));
    });

    afterEach(() => {
        delete (global as { fetch?: unknown }).fetch;
    });

    it('includes the prompt text in the request body', async () => {
        await new GeminiProvider(KEY).process(PROMPT);

        const { url, init } = lastCall(fetchMock);
        expect(url).toBe(`${API_ENDPOINTS.GEMINI_BASE}/gemini-2.5-flash:generateContent`);
        const body = JSON.parse(String(init.body)) as {
            contents: Array<{ parts: Array<{ text?: string; fileData?: unknown }> }>;
        };
        expect(body.contents[0]?.parts[0]?.text).toBe(PROMPT);
    });

    it('attaches the video as a fileData part for a multimodal model', async () => {
        const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        await new GeminiProvider(KEY).process(`Analyze this YouTube video: ${videoUrl}`);

        const body = JSON.parse(String(lastCall(fetchMock).init.body)) as {
            contents: Array<{ parts: Array<{ fileData?: { fileUri: string; mimeType: string } }> }>;
            systemInstruction?: { parts: Array<{ text: string }> };
        };

        expect(body.systemInstruction?.parts[0]?.text).toContain('expert video content analyzer');
        const fileData = body.contents[0]?.parts.find(part => part.fileData)?.fileData;
        expect(fileData).toEqual({ fileUri: videoUrl, mimeType: 'video/mp4' });
    });

    it('does not attach a video for a text-only model', async () => {
        await new GeminiProvider(KEY, 'text-only-model').process(
            'Analyze this YouTube video: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        );

        const body = JSON.parse(String(lastCall(fetchMock).init.body)) as {
            contents: Array<{ parts: Array<{ fileData?: unknown; text?: string }> }>;
        };
        expect(body.contents[0]?.parts.some(part => part.fileData)).toBe(false);
    });

    it('sends a plain request when the prompt is not about a video', async () => {
        await new GeminiProvider(KEY).process('What is 2 + 2?');

        const body = JSON.parse(String(lastCall(fetchMock).init.body)) as {
            contents: unknown[];
            systemInstruction?: unknown;
        };
        expect(body.systemInstruction).toBeUndefined();
        expect(body.contents).toHaveLength(1);
    });

    it('maps a 429 quota response to a quota error', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: { message: 'free tier quota exhausted' } }));

        await expect(new GeminiProvider(KEY).process(PROMPT)).rejects.toThrow('free tier quota exhausted');
    });

    it('does not leak a hostile server message into the thrown error', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(400, { error: { message: `leak\n${'x'.repeat(500)}\r\n<script>alert(1)</script>` } }),
        );

        let message = '';
        try {
            await new GeminiProvider(KEY).process(PROMPT);
        } catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }

        expect(message).not.toBe('');
        expect(message).not.toContain('\n');
        expect(message).not.toContain('<script>');
        expect(message.length).toBeLessThan(300);
    });
});

describe('OpenRouterProvider', () => {
    let fetchMock: FetchMock;

    beforeEach(() => {
        fetchMock = stubFetch(() => jsonResponse(200, OPENAI_BODY));
    });

    afterEach(() => {
        delete (global as { fetch?: unknown }).fetch;
    });

    it('authorizes with a Bearer token and identifies the app', async () => {
        await new OpenRouterProvider(KEY).process(PROMPT);

        const { url, init } = lastCall(fetchMock);
        expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
        expect((init.headers as Record<string, string>)['X-Title']).toContain('YouTube');
        expect(url).not.toContain(KEY);
    });

    it('sends the selected model and generation settings', async () => {
        const provider = new OpenRouterProvider(KEY, 'anthropic/claude-3.5-sonnet');
        provider.setMaxTokens(1234);
        provider.setTemperature(0.25);

        await provider.process(PROMPT);

        const body = JSON.parse(String(lastCall(fetchMock).init.body)) as {
            model: string;
            max_tokens: number;
            temperature: number;
            messages: Array<{ role: string }>;
        };
        expect(body.model).toBe('anthropic/claude-3.5-sonnet');
        expect(body.max_tokens).toBe(1234);
        expect(body.temperature).toBe(0.25);
        expect(body.messages.map(message => message.role)).toEqual(['system', 'user']);
    });

    it('refuses to run without a key', async () => {
        await expect(new OpenRouterProvider('').process(PROMPT)).rejects.toThrow('openrouter.ai/keys');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('turns a rate-limit response into retry guidance', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: { message: 'Rate limit exceeded: retry in 12s' } }));

        await expect(new OpenRouterProvider(KEY).process(PROMPT)).rejects.toThrow(
            'OpenRouter rate limit reached. Retry in 12s.',
        );
    });
});

describe('GroqProvider', () => {
    afterEach(() => {
        delete (global as { fetch?: unknown }).fetch;
    });

    it('authorizes with a Bearer token against the chat endpoint', async () => {
        const fetchMock = stubFetch(() => jsonResponse(200, OPENAI_BODY));
        await new GroqProvider(KEY).process(PROMPT);

        const { url, init } = lastCall(fetchMock);
        expect(url).toBe(API_ENDPOINTS.GROQ);
        expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
        expect(url).not.toContain(KEY);
    });

    it('explains a 402 as a billing problem', async () => {
        stubFetch(() => jsonResponse(402, { error: { message: 'payment required' } }));
        await expect(new GroqProvider(KEY).process(PROMPT)).rejects.toThrow('paid plan');
    });
});

describe('provider model lists', () => {
    afterEach(() => {
        delete (global as { fetch?: unknown }).fetch;
    });

    it('Gemini filters to models that support generateContent', async () => {
        const fetchMock = stubFetch(() =>
            jsonResponse(200, {
                models: [
                    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
                    { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
                    { name: 'models/no-methods' },
                ],
            }),
        );

        await expect(new GeminiProvider(KEY).listModels()).resolves.toEqual(['gemini-2.5-flash']);

        const { url, init } = lastCall(fetchMock);
        expect(url).toBe(`${API_ENDPOINTS.GEMINI_BASE}?pageSize=200`);
        expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    });

    it('Groq returns the ids of its models endpoint', async () => {
        stubFetch(() => jsonResponse(200, { data: [{ id: 'llama-3.3-70b-versatile' }, { id: '' }] }));
        await expect(new GroqProvider(KEY).listModels()).resolves.toEqual(['llama-3.3-70b-versatile']);
    });

    it('maps an aborted model-list request to a clean timeout error', async () => {
        const fetchMock = stubAbortedFetch();

        await expect(new GeminiProvider(KEY).listModels()).rejects.toThrow(
            'Gemini models request failed: timed out after 15000ms',
        );
        await expect(new GroqProvider(KEY).listModels()).rejects.toThrow(
            'Groq models request failed: timed out after 15000ms',
        );
        // When the runtime supports `AbortSignal.timeout`, every auxiliary request
        // runs under one. (jsdom does not implement it, so the timeout — and with
        // it the signal — silently disappears there; Chromium, which Obsidian runs
        // on, does implement it.)
        const supportsTimeoutSignal = typeof (AbortSignal as { timeout?: unknown }).timeout === 'function';
        for (const call of fetchMock.mock.calls) {
            if (supportsTimeoutSignal) {
                expect(call[1]?.signal).toBeDefined();
            } else {
                expect(call[1]?.signal).toBeUndefined();
            }
        }
    });

    it('maps a non-ok model-list response to an error carrying the status', async () => {
        stubFetch(() => jsonResponse(403, { error: { message: 'denied' } }));
        await expect(new OpenRouterProvider(KEY).listModels()).rejects.toThrow('OpenRouter models request failed: 403');
    });
});
