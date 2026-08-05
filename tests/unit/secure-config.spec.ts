/**
 * Unit tests for SecureConfigService — environment-variable fallback.
 * Locks in the "no secrets on disk" path: when useEnvironmentVariables is on
 * and no key is stored in data.json, keys resolve from process.env.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { SecureConfigService } from '../../src/secure-config';
import { YouTubePluginSettings } from '../../src/types';

const ENV_VARS = [
    'YTC_GEMINI_API_KEY',
    'YTC_GROQ_API_KEY',
    'YTC_OLLAMA_API_KEY',
    'YTC_HUGGINGFACE_API_KEY',
    'YTC_OPENROUTER_API_KEY',
    'MYPREFIX_GROQ_API_KEY',
];

function baseSettings(over: Partial<YouTubePluginSettings> = {}): YouTubePluginSettings {
    return {
        geminiApiKey: '',
        groqApiKey: '',
        ollamaApiKey: '',
        ollamaEndpoint: 'http://localhost:11434',
        huggingFaceApiKey: '',
        openRouterApiKey: '',
        outputPath: 'YouTube/Processed Videos',
        useEnvironmentVariables: true,
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

afterEach(() => {
    for (const v of ENV_VARS) delete process.env[v];
});

describe('SecureConfigService — env-var fallback (no secrets on disk)', () => {
    it('returns the env var when env mode is on and no key is stored', () => {
        process.env.YTC_GEMINI_API_KEY = 'gemini-from-env';
        expect(new SecureConfigService(baseSettings()).getApiKey('geminiApiKey')).toBe('gemini-from-env');
    });

    it('returns empty when env mode is off, even if the env var is set', () => {
        process.env.YTC_GEMINI_API_KEY = 'gemini-from-env';
        const svc = new SecureConfigService(baseSettings({ useEnvironmentVariables: false }));
        expect(svc.getApiKey('geminiApiKey')).toBe('');
    });

    it('prefers a stored plaintext key over the env var', () => {
        process.env.YTC_GEMINI_API_KEY = 'gemini-from-env';
        const stored = 'AIza' + 'a'.repeat(35); // AIza prefix -> recognised as plaintext
        const svc = new SecureConfigService(baseSettings({ geminiApiKey: stored }));
        expect(svc.getApiKey('geminiApiKey')).toBe(stored);
    });

    it('honors a custom environment prefix', () => {
        process.env.MYPREFIX_GROQ_API_KEY = 'groq-from-env';
        const svc = new SecureConfigService(baseSettings({ environmentPrefix: 'MYPREFIX' }));
        expect(svc.getApiKey('groqApiKey')).toBe('groq-from-env');
    });

    it('does NOT read the default-prefixed var when a custom prefix is set', () => {
        process.env.YTC_GROQ_API_KEY = 'should-not-be-used';
        const svc = new SecureConfigService(baseSettings({ environmentPrefix: 'MYPREFIX' }));
        expect(svc.getApiKey('groqApiKey')).toBe('');
    });

    it('resolves all five provider keys from env', () => {
        process.env.YTC_GEMINI_API_KEY = 'g';
        process.env.YTC_GROQ_API_KEY = 'gr';
        process.env.YTC_OLLAMA_API_KEY = 'o';
        process.env.YTC_HUGGINGFACE_API_KEY = 'h';
        process.env.YTC_OPENROUTER_API_KEY = 'or';
        const svc = new SecureConfigService(baseSettings());
        expect(svc.getApiKey('geminiApiKey')).toBe('g');
        expect(svc.getApiKey('groqApiKey')).toBe('gr');
        expect(svc.getApiKey('ollamaApiKey')).toBe('o');
        expect(svc.getApiKey('huggingFaceApiKey')).toBe('h');
        expect(svc.getApiKey('openRouterApiKey')).toBe('or');
    });
});
