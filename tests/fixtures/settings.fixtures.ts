/**
 * Test fixtures for plugin settings
 */

import { YTClipperSettings } from '../../src/types';

export const DEFAULT_SETTINGS: YTClipperSettings = {
    geminiApiKey: '',
    groqApiKey: '',
    ollamaApiKey: '',
    ollamaApiUrl: 'http://localhost:11434',
    huggingfaceApiKey: '',
    openrouterApiKey: '',
    defaultProvider: 'gemini' as const,
    outputFormat: 'executive' as const,
    performanceMode: 'balanced' as const,
    cacheEnabled: true,
    maxRetries: 3,
    timeout: 30000,
    temperature: 0.7,
    maxTokens: 2000,
    batchSize: 5,
};

export const CUSTOM_SETTINGS: Partial<YTClipperSettings> = {
    geminiApiKey: 'test-gemini-key-12345',
    groqApiKey: 'test-groq-key-67890',
    defaultProvider: 'groq' as const,
    outputFormat: 'detailed' as const,
    performanceMode: 'fast' as const,
    maxRetries: 5,
    timeout: 60000,
    temperature: 0.9,
    maxTokens: 4000,
};

export const INVALID_SETTINGS = {
    MISSING_API_KEYS: {
        ...DEFAULT_SETTINGS,
        geminiApiKey: '',
        groqApiKey: '',
        ollamaApiKey: '',
    },
    INVALID_TIMEOUT: {
        ...DEFAULT_SETTINGS,
        timeout: -1,
    },
    INVALID_TEMPERATURE: {
        ...DEFAULT_SETTINGS,
        temperature: 3, // Should be 0-2
    },
    INVALID_RETRIES: {
        ...DEFAULT_SETTINGS,
        maxRetries: -1,
    },
};

export const PROVIDER_SPECIFIC_SETTINGS = {
    GEMINI: {
        ...DEFAULT_SETTINGS,
        defaultProvider: 'gemini' as const,
        geminiApiKey: 'gemini-key',
        temperature: 0.7,
        maxTokens: 2000,
    },
    GROQ: {
        ...DEFAULT_SETTINGS,
        defaultProvider: 'groq' as const,
        groqApiKey: 'groq-key',
        temperature: 0.8,
        maxTokens: 3000,
    },
    OLLAMA: {
        ...DEFAULT_SETTINGS,
        defaultProvider: 'ollama' as const,
        ollamaApiKey: 'ollama-key',
        ollamaApiUrl: 'http://localhost:11434',
    },
    HUGGINGFACE: {
        ...DEFAULT_SETTINGS,
        defaultProvider: 'huggingface' as const,
        huggingfaceApiKey: 'huggingface-key',
    },
    OPENROUTER: {
        ...DEFAULT_SETTINGS,
        defaultProvider: 'openrouter' as const,
        openrouterApiKey: 'openrouter-key',
    },
};

export const OUTPUT_FORMAT_SETTINGS = {
    EXECUTIVE: {
        ...DEFAULT_SETTINGS,
        outputFormat: 'executive' as const,
    },
    DETAILED: {
        ...DEFAULT_SETTINGS,
        outputFormat: 'detailed' as const,
    },
    BRIEF: {
        ...DEFAULT_SETTINGS,
        outputFormat: 'brief' as const,
    },
    CUSTOM: {
        ...DEFAULT_SETTINGS,
        outputFormat: 'custom' as const,
        customPrompt: 'Summarize this in bullet points',
    },
};
