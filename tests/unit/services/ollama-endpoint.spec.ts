/**
 * The user's free-text `ollamaEndpoint` decides where transcripts AND API keys
 * are POSTed — pin the normalization (host detection, /api suffix, trailing
 * slashes, lookalike hosts) so it cannot drift or silently hijack again.
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { OllamaProvider, isOllamaCloudEndpoint, resolveOllamaApiBase } from '../../../src/ai/ollama';

describe('isOllamaCloudEndpoint', () => {
    it('detects the cloud host in every sane spelling', () => {
        expect(isOllamaCloudEndpoint('https://ollama.com')).toBe(true);
        expect(isOllamaCloudEndpoint('ollama.com')).toBe(true);
        expect(isOllamaCloudEndpoint('  https://ollama.com  ')).toBe(true);
    });

    it('does not hijack lookalike hosts that merely contain the words', () => {
        expect(isOllamaCloudEndpoint('https://my-proxy.cloud')).toBe(false);
        expect(isOllamaCloudEndpoint('http://ollama.cloud.internal:11434')).toBe(false);
        expect(isOllamaCloudEndpoint('https://notollama.com')).toBe(false);
    });

    it('is false for empty input', () => {
        expect(isOllamaCloudEndpoint('')).toBe(false);
        expect(isOllamaCloudEndpoint('   ')).toBe(false);
    });
});

describe('resolveOllamaApiBase', () => {
    it('defaults to the local API base', () => {
        expect(resolveOllamaApiBase(undefined)).toBe('http://localhost:11434/api');
        expect(resolveOllamaApiBase('')).toBe('http://localhost:11434/api');
    });

    it('appends /api exactly once, tolerating trailing slashes', () => {
        expect(resolveOllamaApiBase('http://localhost:11434')).toBe('http://localhost:11434/api');
        expect(resolveOllamaApiBase('http://localhost:11434/')).toBe('http://localhost:11434/api');
        expect(resolveOllamaApiBase('http://192.168.1.10:11434//')).toBe('http://192.168.1.10:11434/api');
    });

    it('keeps an explicit /api suffix', () => {
        expect(resolveOllamaApiBase('http://box:11434/api')).toBe('http://box:11434/api');
    });

    it('rewrites only the real cloud host to the cloud API base', () => {
        expect(resolveOllamaApiBase('https://ollama.com')).toBe('https://ollama.com/api');
        expect(resolveOllamaApiBase('https://my-proxy.cloud')).toBe('https://my-proxy.cloud/api');
    });
});

describe('OllamaProvider endpoint wiring', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as { fetch?: unknown }).fetch;
    });

    it('sends requests to the normalized base, not a double-slashed one', async () => {
        const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ models: [] }) }));
        global.fetch = fetchMock as unknown as typeof fetch;

        await new OllamaProvider('', 'qwen3:latest', undefined, 'http://192.168.1.10:11434//').listModels();

        expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://192.168.1.10:11434/api/tags');
    });
});
