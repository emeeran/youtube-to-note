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

/* ------------------------------------------------------------------ *
 * Key material helpers
 * ------------------------------------------------------------------ */

/**
 * Replicates the device-key derivation of the legacy XOR scheme so a fixture
 * can be produced in-test. Kept in sync with `src/secure-config.ts`
 * (factors, SECURITY_VERSION, hash loop, prefix).
 */
function legacyObfuscationKey(): string {
    const factors = [
        navigator.userAgent,
        navigator.language,
        screen.width.toString(),
        screen.height.toString(),
        (window as unknown as { app?: { vault?: { adapter?: { basePath?: string } } } }).app?.vault?.adapter
            ?.basePath || 'default',
    ];
    const combined = `${factors.join('|')}1.0.0`; // + SECURITY_VERSION
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = (hash << 5) - hash + combined.charCodeAt(i);
        hash = hash & hash; // 32-bit
    }
    return `ytc_sec_${Math.abs(hash).toString(16)}`;
}

/** Produce a value in the exact shape an older plugin version wrote. */
function legacyObfuscate(plaintext: string): string {
    const keyBytes = [...legacyObfuscationKey()].map(char => char.charCodeAt(0));
    const encrypted = [...plaintext].map((char, index) => char.charCodeAt(0) ^ keyBytes[index % keyBytes.length]!);
    return btoa(String.fromCharCode(...encrypted));
}

const GEMINI_KEY = `AIza${'A'.repeat(35)}`;
const GROQ_KEY = `gsk_${'b'.repeat(48)}`;

describe('SecureConfigService — key format validation', () => {
    it('accepts a well-formed key and returns the trimmed value for storage', () => {
        const svc = new SecureConfigService(baseSettings());
        expect(svc.setApiKey('geminiApiKey', `  ${GEMINI_KEY}  `)).toBe(GEMINI_KEY);
    });

    it.each([
        ['', 'API key is empty'],
        ['   ', 'API key is empty'],
        ['tooshort', 'API key is too short (minimum 20 characters)'],
        ['x'.repeat(401), 'API key is too long (maximum 400 characters)'],
        ['your-api-key-here-but-long-enough', 'placeholder API key'],
        ['a'.repeat(10) + 'PLACEHOLDER' + 'a'.repeat(10), 'placeholder API key'],
        ['a'.repeat(12) + 'xxx' + 'a'.repeat(12), 'placeholder API key'],
    ])('rejects %j', (key, expected) => {
        const svc = new SecureConfigService(baseSettings());
        expect(() => svc.setApiKey('groqApiKey', key as string)).toThrow(expected);
    });

    it('treats an unknown provider field as opaque (no pattern to match)', () => {
        const svc = new SecureConfigService(baseSettings());
        const opaque = `ollama-${'c'.repeat(30)}`;
        expect(svc.setApiKey('ollamaApiKey', opaque)).toBe(opaque);
    });

    it('accepts every provider field when only the length rules matter', () => {
        const svc = new SecureConfigService(baseSettings());
        for (const field of [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ] as const) {
            expect(svc.setApiKey(field, `k${'d'.repeat(24)}`)).toBe(`k${'d'.repeat(24)}`);
        }
    });
});

describe('SecureConfigService — masking for the settings UI', () => {
    it('shows the first 8 and last 4 characters of a long key', () => {
        const svc = new SecureConfigService(baseSettings({ geminiApiKey: GEMINI_KEY }));
        const masked = svc.getMaskedApiKey('geminiApiKey');
        expect(masked).toBe(`AIzaAAAA${'*'.repeat(27)}AAAA`);
        expect(masked).toHaveLength(GEMINI_KEY.length);
        expect(masked).not.toContain(GEMINI_KEY.slice(8, -4));
    });

    it('collapses a short key to stars', () => {
        const svc = new SecureConfigService(baseSettings({ geminiApiKey: 'abc' }));
        expect(svc.getMaskedApiKey('geminiApiKey')).toBe('***');
    });

    it('reports "Not set" when no key is stored or resolvable', () => {
        const svc = new SecureConfigService(baseSettings({ useEnvironmentVariables: false }));
        expect(svc.getMaskedApiKey('geminiApiKey')).toBe('Not set');
    });

    it('hasApiKey reflects the stored state', () => {
        const settings = baseSettings({ groqApiKey: GROQ_KEY });
        const svc = new SecureConfigService(settings);
        expect(svc.hasApiKey('groqApiKey')).toBe(true);
        expect(svc.hasApiKey('openRouterApiKey')).toBe(false);
    });
});

describe('SecureConfigService — set / get / clear lifecycle', () => {
    it('stores, resolves and clears a key', () => {
        const settings = baseSettings({ groqApiKey: '' });
        const svc = new SecureConfigService(settings);

        settings.groqApiKey = svc.setApiKey('groqApiKey', `  ${GROQ_KEY}  `);
        expect(svc.getApiKey('groqApiKey')).toBe(GROQ_KEY);
        expect(svc.hasApiKey('groqApiKey')).toBe(true);

        svc.clearApiKey('groqApiKey');
        expect(settings.groqApiKey).toBe('');
        expect(svc.hasApiKey('groqApiKey')).toBe(false);
        expect(svc.getApiKey('groqApiKey')).toBe('');
    });

    it('clears every provider key at once', () => {
        const settings = baseSettings({
            geminiApiKey: GEMINI_KEY,
            groqApiKey: GROQ_KEY,
            ollamaApiKey: `ollama-${'e'.repeat(30)}`,
            huggingFaceApiKey: `hf_${'f'.repeat(30)}`,
            openRouterApiKey: `sk-or-v1-${'0'.repeat(30)}`,
        });
        const svc = new SecureConfigService(settings);

        svc.clearAllApiKeys();

        for (const field of [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ] as const) {
            expect(settings[field]).toBe('');
            expect(svc.hasApiKey(field)).toBe(false);
        }
    });

    it('round-trips obfuscateKey as identity (keys are stored in plaintext)', () => {
        const svc = new SecureConfigService(baseSettings());
        // The public write path returns the value unchanged.
        expect(svc.setApiKey('geminiApiKey', GEMINI_KEY)).toBe(GEMINI_KEY);
    });
});

describe('SecureConfigService — legacy XOR values', () => {
    it('de-obfuscates a value written by an older version on read', () => {
        const legacy = legacyObfuscate(GROQ_KEY);
        expect(legacy).not.toContain(GROQ_KEY);
        const svc = new SecureConfigService(baseSettings({ groqApiKey: legacy }));

        expect(SecureConfigService.isLikelyPlaintextKey(legacy)).toBe(false);
        expect(svc.getApiKey('groqApiKey')).toBe(GROQ_KEY);
    });

    it('migrates legacy values to plaintext in place and reports the change', () => {
        const settings = baseSettings({ groqApiKey: legacyObfuscate(GROQ_KEY) });
        expect(SecureConfigService.migrateApiKeys(settings)).toBe(true);
        expect(settings.groqApiKey).toBe(GROQ_KEY);
        // Idempotent: nothing left to migrate.
        expect(SecureConfigService.migrateApiKeys(settings)).toBe(false);
    });

    it('migrates a mixed data.json, touching only the legacy values', () => {
        const legacy = legacyObfuscate(GROQ_KEY);
        const settings = baseSettings({ geminiApiKey: GEMINI_KEY, groqApiKey: legacy, ollamaApiKey: '' });
        const before = settings.geminiApiKey;

        expect(SecureConfigService.migrateApiKeys(settings)).toBe(true);
        expect(settings.geminiApiKey).toBe(before); // plaintext left alone
        expect(settings.groqApiKey).toBe(GROQ_KEY);
        expect(settings.ollamaApiKey).toBe(''); // empty left alone
    });

    it('returns an unknown base64 blob as-is rather than corrupting it', () => {
        const opaque = btoa('short');
        const svc = new SecureConfigService(baseSettings({ groqApiKey: opaque }));
        expect(svc.getApiKey('groqApiKey')).toBe(opaque);
    });

    it('treats a non-base64 value as plaintext and returns it untouched', () => {
        const token = `ollama-opaque-token-${'1'.repeat(12)}`;
        const svc = new SecureConfigService(baseSettings({ groqApiKey: token }));
        expect(SecureConfigService.isLikelyPlaintextKey(token)).toBe(true);
        expect(svc.getApiKey('groqApiKey')).toBe(token);
    });

    it('treats every known key prefix as plaintext', () => {
        const keys = [
            `AIza${'A'.repeat(35)}`,
            `gsk_${'g'.repeat(48)}`,
            `sk-or-v1-${'h'.repeat(30)}`,
            `hf_${'i'.repeat(30)}`,
            `sk-${'j'.repeat(48)}`,
            `ollama-${'k'.repeat(30)}`,
        ];
        for (const key of keys) {
            expect(SecureConfigService.isLikelyPlaintextKey(key)).toBe(true);
        }
    });

    it('refuses to guess for short values', () => {
        expect(SecureConfigService.isLikelyPlaintextKey('')).toBe(false);
        expect(SecureConfigService.isLikelyPlaintextKey('short')).toBe(false);
    });
});
