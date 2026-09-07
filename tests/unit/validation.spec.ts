/**
 * Specs for `ValidationUtils.validateSettings`.
 *
 * The rules under test:
 *  - ANY configured provider key makes the settings valid (R3/H2) — not just
 *    Gemini/Groq, which used to hard-block OpenRouter/HuggingFace/Ollama users.
 *  - A key whose format does not match its provider pattern is a *warning*, and
 *    warnings never affect `isValid`.
 *  - Environment-variable mode with a non-empty prefix is valid on its own.
 *  - Per-format prompt overrides above `MAX_CUSTOM_PROMPT_LENGTH` are errors.
 */

import { describe, it, expect } from '@jest/globals';

import { API_KEY_FIELDS, MAX_CUSTOM_PROMPT_LENGTH, ValidationUtils } from '../../src/validation';
import { MESSAGES } from '../../src/constants/messages';

type Settings = Record<string, unknown>;

const baseSettings = (overrides: Settings = {}): Settings => ({
    outputPath: 'YouTube/Processed Videos',
    useEnvironmentVariables: false,
    environmentPrefix: 'YTC',
    ...overrides,
});

const validate = (overrides: Settings) => ValidationUtils.validateSettings(baseSettings(overrides));

describe('MAX_CUSTOM_PROMPT_LENGTH / API_KEY_FIELDS', () => {
    it('caps custom prompts at 20,000 characters', () => {
        expect(MAX_CUSTOM_PROMPT_LENGTH).toBe(20_000);
    });

    it('covers all five provider key fields', () => {
        expect(API_KEY_FIELDS).toEqual([
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ]);
    });
});

describe('validateSettings — provider gate', () => {
    it('accepts an OpenRouter-only configuration', () => {
        const result = validate({ openRouterApiKey: 'sk-or-v1-abc1234567890' });
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('accepts a HuggingFace-only configuration', () => {
        const result = validate({ huggingFaceApiKey: 'hf_abc1234567890' });
        expect(result.isValid).toBe(true);
    });

    it('accepts an Ollama-only configuration', () => {
        const result = validate({ ollamaApiKey: 'ollama-cloud-token-123' });
        expect(result.isValid).toBe(true);
    });

    it('accepts a Gemini-only configuration', () => {
        const result = validate({ geminiApiKey: 'AIzaSyA1234567890' });
        expect(result.isValid).toBe(true);
    });

    it('rejects a configuration with no key and env mode off', () => {
        const result = validate({});
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(MESSAGES.ERRORS.MISSING_API_KEYS);
        expect(MESSAGES.ERRORS.MISSING_API_KEYS).not.toContain('Gemini or Groq');
    });

    it('treats a whitespace-only key as absent', () => {
        const result = validate({ geminiApiKey: '   ' });
        expect(result.isValid).toBe(false);
    });
});

describe('validateSettings — environment-variable mode', () => {
    it('is valid on its own when a prefix is set', () => {
        const result = validate({ useEnvironmentVariables: true });
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('is invalid when the prefix is empty', () => {
        const result = validate({ useEnvironmentVariables: true, environmentPrefix: '' });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(' ')).toMatch(/prefix/i);
    });

    it('is invalid when the prefix is missing entirely', () => {
        const result = ValidationUtils.validateSettings({
            outputPath: 'YouTube/Processed Videos',
            useEnvironmentVariables: true,
        });
        expect(result.isValid).toBe(false);
    });
});

describe('validateSettings — key format findings are warnings, not errors', () => {
    it('warns without blocking on a malformed Gemini key', () => {
        const result = validate({ geminiApiKey: 'not-a-real-gemini-key' });
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatch(/Gemini/);
    });

    it('warns without blocking on a malformed Groq key', () => {
        const result = validate({ groqApiKey: 'wrong-prefix-123456' });
        expect(result.isValid).toBe(true);
        expect(result.warnings[0]).toMatch(/Groq/);
    });

    it('warns on a malformed OpenRouter key', () => {
        const result = validate({ openRouterApiKey: 'zz-not-openrouter-123' });
        expect(result.isValid).toBe(true);
        expect(result.warnings[0]).toMatch(/OpenRouter/);
    });

    it('stays silent about Ollama keys, which have no stable prefix', () => {
        const result = validate({ ollamaApiKey: 'anything-goes-here' });
        expect(result.warnings).toEqual([]);
    });

    it('reports no warning for well-formed keys', () => {
        const result = validate({ geminiApiKey: 'AIzaSyA1234567890', groqApiKey: 'gsk_abc1234567890' });
        expect(result.warnings).toEqual([]);
        expect(result.isValid).toBe(true);
    });

    it('always returns a warnings array', () => {
        expect(validate({}).warnings).toEqual([]);
    });
});

describe('validateSettings — other rules', () => {
    it('requires an output path', () => {
        const result = ValidationUtils.validateSettings({ geminiApiKey: 'AIzaSyA1234567890' });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(' ')).toMatch(/output path/i);
    });

    it('flags a prompt override over the cap as an error naming the format', () => {
        const tooLong = 'a'.repeat(MAX_CUSTOM_PROMPT_LENGTH + 1);
        const result = ValidationUtils.validateSettings(
            baseSettings({ geminiApiKey: 'AIzaSyA1234567890', customPrompts: { article: tooLong } }),
        );
        expect(result.isValid).toBe(false);
        expect(result.errors.join(' ')).toContain('article');
    });

    it('accepts a prompt override exactly at the cap', () => {
        const atLimit = 'a'.repeat(MAX_CUSTOM_PROMPT_LENGTH);
        const result = ValidationUtils.validateSettings(
            baseSettings({ geminiApiKey: 'AIzaSyA1234567890', customPrompts: { article: atLimit } }),
        );
        expect(result.isValid).toBe(true);
    });

    it('ignores non-string prompt values', () => {
        const result = ValidationUtils.validateSettings(
            baseSettings({ geminiApiKey: 'AIzaSyA1234567890', customPrompts: { article: 42 } }),
        );
        expect(result.isValid).toBe(true);
    });

    it('ignores a missing or non-object customPrompts', () => {
        expect(ValidationUtils.validateSettings(baseSettings({ geminiApiKey: 'AIzaSyA1234567890' })).isValid).toBe(
            true,
        );
        expect(
            ValidationUtils.validateSettings(baseSettings({ geminiApiKey: 'AIzaSyA1234567890', customPrompts: 'nope' }))
                .isValid,
        ).toBe(true);
    });
});
