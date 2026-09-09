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
import { OllamaProvider } from '../../src/ai/ollama';
import { OllamaCloudProvider } from '../../src/ai/ollama-cloud';
import { HuggingFaceProvider } from '../../src/ai/huggingface';
import { API_ENDPOINTS } from '../../src/ai/api';
import { REQUEST_TIMEOUT_MS } from '../../src/ai/error-utils';
import type { AIRequestOptions } from '../../src/types';

type FetchMock = jest.Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>>;

const KEY = 'test-api-key-1234567890';
const PROMPT = 'Summarize this YouTube video for me.';
const PLAIN_PROMPT = 'What is 2 + 2?';

function jsonResponse(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        headers: new Headers(),
    } as unknown as Response;
}

const GEMINI_BODY = { candidates: [{ content: { parts: [{ text: 'gemini says hi' }] } }] };
const OPENAI_BODY = { choices: [{ message: { content: 'openai-compatible says hi' } }] };
const OLLAMA_BODY = { response: 'ollama says hi' };
const HUGGINGFACE_BODY = { choices: [{ message: { content: 'hugging face says hi' } }] };

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

    it('keeps the caller in control of cancellation and adds a timeout of its own', async () => {
        const controller = new AbortController();
        await makeProvider().process(PROMPT, { signal: controller.signal });

        const signal = lastCall(fetchMock).init.signal as AbortSignal | undefined;
        expect(signal).toBeDefined();
        expect(signal?.aborted).toBe(false);

        controller.abort();
        // A combined signal (`AbortSignal.any`) forwards the caller's abort; on a
        // runtime without one the caller's signal is used directly.
        expect(signal?.aborted).toBe(true);
    });

    it('rejects with a readable error when the endpoint fails', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { message: 'kaboom' } }));
        await expect(makeProvider().process(PROMPT)).rejects.toThrow('Service temporarily unavailable');
    });

    it('reports a hung request as a provider-labelled timeout, not a bare abort', async () => {
        const provider = makeProvider();
        fetchMock.mockRejectedValueOnce(
            Object.assign(new Error('The operation was aborted.'), { name: 'TimeoutError' }),
        );

        await expect(provider.process(PROMPT)).rejects.toThrow(
            new RegExp(`${provider.name}: request timed out after ${REQUEST_TIMEOUT_MS}ms`),
        );
    });
});

describe('GeminiProvider', () => {
    let fetchMock: FetchMock;

    beforeEach(() => {
        fetchMock = stubFetch(() => jsonResponse(200, GEMINI_BODY));
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

    describe('input-token overflow fallback', () => {
        const VIDEO_PROMPT = 'Analyze this YouTube video: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        const TOKEN_OVERFLOW = {
            error: { message: 'The input token count exceeds the maximum number of tokens allowed 1048576' },
        };

        type GeminiBody = {
            contents: Array<{ parts: Array<{ text?: string; fileData?: { fileUri: string; mimeType: string } }> }>;
            systemInstruction?: { parts: Array<{ text: string }> };
            generationConfig?: unknown;
        };

        function parseBody(init: RequestInit): GeminiBody {
            return JSON.parse(String(init.body)) as GeminiBody;
        }

        function callBody(fetchMock: FetchMock, index: number): GeminiBody {
            return parseBody((fetchMock.mock.calls[index]?.[1] ?? {}) as RequestInit);
        }

        let warnSpy: jest.SpyInstance;

        beforeEach(() => {
            warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        it('retries once without the video when the input exceeds Gemini token limit', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(400, TOKEN_OVERFLOW));

            await expect(new GeminiProvider(KEY).process(VIDEO_PROMPT)).resolves.toBe('gemini says hi');

            expect(fetchMock).toHaveBeenCalledTimes(2);
            const first = callBody(fetchMock, 0);
            const second = callBody(fetchMock, 1);
            // First attempt carried the video; the retry is text-only.
            expect(first.contents[0]?.parts.some(part => part.fileData)).toBe(true);
            expect(first.systemInstruction).toBeDefined();
            expect(second.contents[0]?.parts.some(part => part.fileData)).toBe(false);
            expect(second.systemInstruction).toBeUndefined();
            expect(second.contents[0]?.parts[0]?.text).toBe(VIDEO_PROMPT);
            expect(second.generationConfig).toEqual(first.generationConfig);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('text only'));
        });

        it('does not retry a 400 that is not a token overflow', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: { message: 'model not found' } }));

            await expect(new GeminiProvider(KEY).process(VIDEO_PROMPT)).rejects.toThrow(
                'Gemini API error: model not found',
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it('does not retry when the request was already text-only', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(400, TOKEN_OVERFLOW));

            await expect(new GeminiProvider(KEY).process(PLAIN_PROMPT)).rejects.toThrow(/input token count exceeds/i);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('surfaces the failure when the text-only retry also overflows', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(400, TOKEN_OVERFLOW));
            fetchMock.mockResolvedValueOnce(jsonResponse(400, TOKEN_OVERFLOW));

            await expect(new GeminiProvider(KEY).process(VIDEO_PROMPT)).rejects.toThrow(/input token count exceeds/i);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('gives up before retrying when the caller already aborted', async () => {
            const controller = new AbortController();
            fetchMock = stubFetch(url => {
                void url;
                controller.abort();
                return jsonResponse(400, TOKEN_OVERFLOW);
            });

            await expect(new GeminiProvider(KEY).process(VIDEO_PROMPT, { signal: controller.signal })).rejects.toThrow(
                /cancelled/i,
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('also drops a gs:// attachment when retrying text-only', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse(400, TOKEN_OVERFLOW));
            const prompt = 'Analyze this YouTube video: https://youtu.be/dQw4w9WgXcQ mirror: gs://my-bucket/clip.mp4';

            await expect(new GeminiProvider(KEY).process(prompt)).resolves.toBe('gemini says hi');

            const first = callBody(fetchMock, 0);
            const second = callBody(fetchMock, 1);
            expect(first.contents).toHaveLength(2);
            expect(first.contents[0]?.parts.filter(part => part.fileData)).toHaveLength(1);
            expect(first.contents[1]?.parts.filter(part => part.fileData)).toHaveLength(1);
            expect(second.contents).toHaveLength(1);
            expect(second.contents[0]?.parts.some(part => part.fileData)).toBe(false);
        });
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

describe.each([
    {
        name: 'Gemini',
        make: () => new GeminiProvider(KEY),
        body: GEMINI_BODY,
        read: (body: Record<string, any>) => ({
            maxTokens: body.generationConfig?.maxOutputTokens,
            temperature: body.generationConfig?.temperature,
        }),
    },
    {
        name: 'Groq',
        make: () => new GroqProvider(KEY),
        body: OPENAI_BODY,
        read: (body: Record<string, any>) => ({ maxTokens: body.max_tokens, temperature: body.temperature }),
    },
    {
        name: 'OpenRouter',
        make: () => new OpenRouterProvider(KEY),
        body: OPENAI_BODY,
        read: (body: Record<string, any>) => ({ maxTokens: body.max_tokens, temperature: body.temperature }),
    },
    {
        name: 'Ollama',
        make: () => new OllamaProvider(),
        body: OLLAMA_BODY,
        read: (body: Record<string, any>) => ({
            maxTokens: body.options?.num_predict,
            temperature: body.options?.temperature,
        }),
    },
    {
        name: 'Ollama Cloud',
        make: () => new OllamaCloudProvider(KEY),
        body: OLLAMA_BODY,
        read: (body: Record<string, any>) => ({
            maxTokens: body.options?.num_predict,
            temperature: body.options?.temperature,
        }),
    },
    {
        name: 'Hugging Face',
        make: () => new HuggingFaceProvider(KEY),
        body: HUGGINGFACE_BODY,
        read: (body: Record<string, any>) => ({
            maxTokens: body.max_tokens,
            temperature: body.temperature,
        }),
    },
])('$name per-request generation params', ({ make, body, read }) => {
    let fetchMock: FetchMock;

    beforeEach(() => {
        fetchMock = stubFetch(() => jsonResponse(200, body));
    });

    afterEach(() => {
        delete (global as { fetch?: unknown }).fetch;
    });

    it('uses options.maxTokens / options.temperature for this request only', async () => {
        const provider = make();
        provider.setMaxTokens(1234);
        provider.setTemperature(0.25);

        await provider.process(PLAIN_PROMPT, { maxTokens: 777, temperature: 0.1 });

        expect(read(JSON.parse(String(lastCall(fetchMock).init.body)))).toEqual({ maxTokens: 777, temperature: 0.1 });
        // Providers are singletons: the override must not stick to the instance.
        expect(provider.maxTokens).toBe(1234);
        expect(provider.temperature).toBe(0.25);
    });

    it('falls back to the configured values when no override is supplied', async () => {
        const provider = make();
        provider.setMaxTokens(1234);
        provider.setTemperature(0.25);

        await provider.process(PLAIN_PROMPT);

        expect(read(JSON.parse(String(lastCall(fetchMock).init.body)))).toEqual({ maxTokens: 1234, temperature: 0.25 });
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

describe.each([
    {
        name: 'Gemini',
        make: () => new GeminiProvider(KEY),
        body: GEMINI_BODY,
        host: 'generativelanguage.googleapis.com',
    },
    { name: 'Groq', make: () => new GroqProvider(KEY), body: OPENAI_BODY, host: 'api.groq.com' },
    { name: 'OpenRouter', make: () => new OpenRouterProvider(KEY), body: OPENAI_BODY, host: 'openrouter.ai' },
    {
        name: 'Hugging Face',
        make: () => new HuggingFaceProvider(KEY),
        body: HUGGINGFACE_BODY,
        host: 'router.huggingface.co',
    },
])('$name reports an unreachable endpoint honestly', ({ make, body, host }) => {
    let fetchMock: FetchMock;

    beforeEach(() => {
        fetchMock = stubFetch(() => jsonResponse(200, body));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as { fetch?: unknown }).fetch;
    });

    it('wraps a raw connection failure with the provider name and host', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(make().process(PROMPT)).rejects.toThrow(`network error reaching ${host}`);
    });

    it('leaves a caller cancellation untouched', async () => {
        fetchMock = stubFetch(abortAwareHandler(body));
        const controller = new AbortController();
        controller.abort();

        const error = await make()
            .process(PROMPT, { signal: controller.signal })
            .then(
                () => {
                    throw new Error('expected the request to fail');
                },
                e => e as Error,
            );

        // Cancellation may keep the raw abort or adopt the provider's own
        // "cancelled" wording — it must never be mislabelled as a network
        // failure or a timeout.
        expect(error.message).not.toMatch(/network error/i);
        expect(error.message).not.toMatch(/timed out/i);
    });
});

describe('Ollama network failures', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as { fetch?: unknown }).fetch;
    });

    it('keeps the local install advice when the local server is unreachable', async () => {
        const fetchMock = stubFetch();
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        const error = await new OllamaProvider('', 'qwen3:14b').process(PROMPT).then(
            () => {
                throw new Error('expected the request to fail');
            },
            e => e as Error,
        );

        expect(error.message).toContain('Ollama server is not running or unreachable');
    });

    it('gives cloud-specific advice for Ollama Cloud instead of "install Ollama"', async () => {
        const fetchMock = stubFetch();
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        const error = await new OllamaCloudProvider(KEY).process(PROMPT).then(
            () => {
                throw new Error('expected the request to fail');
            },
            e => e as Error,
        );

        expect(error.message).toContain('ollama.com');
        expect(error.message).not.toContain('installed and running');
    });

    it('spells out the full pull command when a local model is missing', async () => {
        stubFetch(() => jsonResponse(404, { error: 'model qwen3:14b not found, try pulling it first' }));

        await expect(new OllamaProvider('', 'qwen3:14b').process(PROMPT)).rejects.toThrow(
            "using 'ollama pull qwen3:14b'.",
        );
    });
});

describe('HuggingFaceProvider', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as { fetch?: unknown }).fetch;
    });

    it('sends an OpenAI-compatible chat body and reads choices[0].message.content', async () => {
        const fetchMock = stubFetch(() => jsonResponse(200, HUGGINGFACE_BODY));

        await expect(new HuggingFaceProvider(KEY).process(PROMPT)).resolves.toBe('hugging face says hi');

        const { url, init } = lastCall(fetchMock);
        expect(url).toBe('https://router.huggingface.co/v1/chat/completions');
        const body = JSON.parse(String(init.body)) as {
            model: string;
            messages: Array<{ role: string; content: string }>;
        };
        expect(body.model).toBe('Qwen/Qwen3.8-27B');
        expect(body.messages).toEqual([{ role: 'user', content: PROMPT }]);
    });

    it('rejects a reasoning-only response that never produced content', async () => {
        stubFetch(() => jsonResponse(200, { choices: [{ message: { content: null, reasoning: 'thinking…' } }] }));

        await expect(new HuggingFaceProvider(KEY).process(PROMPT)).rejects.toThrow('Invalid response format');
    });

    it('explains a router 400 "model not available" as a model-choice problem', async () => {
        stubFetch(() =>
            jsonResponse(400, {
                error: {
                    message:
                        'Unable to access non-serverless model Qwen/Qwen2.5-7B-Instruct-Turbo. ' +
                        'Please visit huggingface.co/models to create and start a new dedicated endpoint.',
                    code: 'model_not_available',
                },
            }),
        );

        const error = await new HuggingFaceProvider(KEY).process(PROMPT).then(
            () => {
                throw new Error('expected the request to fail');
            },
            e => e as Error,
        );

        expect(error.message).toContain('not available on the Hugging Face router');
        expect(error.message).toContain('another model');
    });

    it('maps a legacy flat-string error body the same way', async () => {
        stubFetch(() => jsonResponse(400, { error: 'Qwen/Qwen3-8B is not supported by provider hf-inference.' }));

        await expect(new HuggingFaceProvider(KEY).process(PROMPT)).rejects.toThrow(
            'not available on the Hugging Face router',
        );
    });

    it('keeps the retry hint on a 429 rate limit', async () => {
        stubFetch(() => jsonResponse(429, { error: { message: 'rate limit, retry in 12s' } }));

        await expect(new HuggingFaceProvider(KEY).process(PROMPT)).rejects.toThrow(
            'Hugging Face rate limit reached. Retry in 12s.',
        );
    });

    it('does not echo a hostile 400 body', async () => {
        stubFetch(() =>
            jsonResponse(400, {
                error: { message: `boom\n${'x'.repeat(500)}\r\n<script>alert(1)</script>` },
            }),
        );

        let message = '';
        try {
            await new HuggingFaceProvider(KEY).process(PROMPT);
        } catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }

        expect(message).not.toContain('\n');
        expect(message).not.toContain('<script>');
        expect(message.length).toBeLessThan(300);
    });

    it('lists only models a live provider serves with text output', async () => {
        stubFetch(() =>
            jsonResponse(200, {
                data: [
                    {
                        id: 'Qwen/Qwen3.8-27B',
                        providers: [{ provider: 'novita', status: 'live' }],
                        architecture: { output_modalities: ['text'] },
                    },
                    {
                        id: 'dead/model',
                        providers: [{ provider: 'together', status: 'retired' }],
                        architecture: { output_modalities: ['text'] },
                    },
                    {
                        id: 'image/only',
                        providers: [{ provider: 'novita', status: 'live' }],
                        architecture: { output_modalities: ['image'] },
                    },
                    { id: 'no-metadata/model' },
                ],
            }),
        );

        // An entry with no provider metadata cannot be known-live — exclude it.
        await expect(new HuggingFaceProvider(KEY).listModels()).resolves.toEqual(['Qwen/Qwen3.8-27B']);
    });
});
