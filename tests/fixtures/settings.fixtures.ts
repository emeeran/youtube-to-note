/**
 * Test fixtures for plugin settings.
 *
 * Mirrors `YouTubePluginSettings` in `src/types.ts` and the defaults in
 * `src/main.ts`. If you add a settings key, add it here too — these objects are
 * typed against the real interface, so a drift shows up as a compile error.
 */

import type { OutputFormat, YouTubePluginSettings } from '../../src/types';

/** A complete, valid settings object — equal to the plugin's own defaults. */
export const DEFAULT_SETTINGS: YouTubePluginSettings = {
    geminiApiKey: '',
    groqApiKey: '',
    ollamaApiKey: '',
    ollamaEndpoint: 'http://localhost:11434',
    huggingFaceApiKey: '',
    openRouterApiKey: '',
    outputPath: 'YouTube/Processed Videos',
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
};

/** A Gemini-keyed setup with everything non-default, as a partial. */
export const CUSTOM_SETTINGS: Partial<YouTubePluginSettings> = {
    geminiApiKey: 'AIzaSyA1234567890abcdefghijklmnopqrstuv',
    outputPath: 'YouTube/Notes',
    performanceMode: 'quality',
    includeTimestamps: false,
    warnOnDuplicates: false,
    persistTranscriptCache: true,
    transcriptLanguage: 'en',
    defaultMaxTokens: 8192,
    defaultTemperature: 0.3,
    customPrompts: { 'quick-notes': 'Summarize this in five bullets.' },
};

/**
 * Settings that fail `ValidationUtils.validateSettings`. Each entry isolates one
 * failure so a spec can assert on the exact message.
 */
export const INVALID_SETTINGS = {
    /** No provider key configured and env mode off. */
    MISSING_API_KEYS: {
        ...DEFAULT_SETTINGS,
        geminiApiKey: '',
        groqApiKey: '',
        ollamaApiKey: '',
        huggingFaceApiKey: '',
        openRouterApiKey: '',
    } as YouTubePluginSettings,
    /** Env mode on, but the prefix every lookup depends on is blank. */
    MISSING_ENVIRONMENT_PREFIX: {
        ...DEFAULT_SETTINGS,
        useEnvironmentVariables: true,
        environmentPrefix: '',
    } as YouTubePluginSettings,
    /** No folder to write the note into. */
    MISSING_OUTPUT_PATH: {
        ...DEFAULT_SETTINGS,
        outputPath: '',
    } as YouTubePluginSettings,
    /** An override far above what any provider accepts. */
    OVERSIZED_CUSTOM_PROMPT: {
        ...DEFAULT_SETTINGS,
        geminiApiKey: 'AIzaSyA1234567890abcdefghijklmnopqrstuv',
        customPrompts: { article: 'x'.repeat(10_001) },
    } as YouTubePluginSettings,
};

/** One fixture per provider key field, so a spec can pin a single provider. */
export const PROVIDER_SPECIFIC_SETTINGS = {
    GEMINI: { ...DEFAULT_SETTINGS, geminiApiKey: 'AIzaSyA1234567890abcdefghijklmnopqrstuv' } as YouTubePluginSettings,
    GROQ: { ...DEFAULT_SETTINGS, groqApiKey: 'gsk_1234567890abcdefghijklmnopqrstuvwxyz' } as YouTubePluginSettings,
    OLLAMA: { ...DEFAULT_SETTINGS, ollamaApiKey: 'ollama-key' } as YouTubePluginSettings,
    HUGGINGFACE: { ...DEFAULT_SETTINGS, huggingFaceApiKey: 'hf_1234567890' } as YouTubePluginSettings,
    OPENROUTER: { ...DEFAULT_SETTINGS, openRouterApiKey: 'sk-or-1234567890' } as YouTubePluginSettings,
    /** Env-only mode keeps every key off disk. */
    ENVIRONMENT: {
        ...DEFAULT_SETTINGS,
        geminiApiKey: '',
        useEnvironmentVariables: true,
        environmentPrefix: 'YTC',
    } as YouTubePluginSettings,
};

/** Per-format settings, keyed by `OutputFormat` (a value for every format). */
export const FORMAT_SETTINGS: Record<OutputFormat, Partial<YouTubePluginSettings>> = {
    'executive-summary': { ...DEFAULT_SETTINGS },
    'technical-analysis': { ...DEFAULT_SETTINGS, defaultMaxTokens: 6144, defaultTemperature: 0.3 },
    '3c-accelerated-learning': { ...DEFAULT_SETTINGS, defaultMaxTokens: 6144 },
    'atom-notes': { ...DEFAULT_SETTINGS, defaultMaxTokens: 6144 },
    article: { ...DEFAULT_SETTINGS, defaultMaxTokens: 8192, defaultTemperature: 0.6 },
    'complete-transcription': { ...DEFAULT_SETTINGS, defaultMaxTokens: 16384, defaultTemperature: 0.3 },
    'quick-notes': { ...DEFAULT_SETTINGS, defaultMaxTokens: 1536, includeTimestamps: false },
};

/** Per-format prompt overrides, one per key, for `settings.customPrompts`. */
export const CUSTOM_PROMPT_SETTINGS: Record<OutputFormat, Partial<YouTubePluginSettings>> = {
    'executive-summary': { customPrompts: { 'executive-summary': 'Custom executive prompt' } },
    'technical-analysis': { customPrompts: { 'technical-analysis': 'Custom technical prompt' } },
    '3c-accelerated-learning': { customPrompts: { '3c-accelerated-learning': 'Custom 3C prompt' } },
    'atom-notes': { customPrompts: { 'atom-notes': 'Custom atom prompt' } },
    article: { customPrompts: { article: 'Custom article prompt' } },
    'complete-transcription': { customPrompts: { 'complete-transcription': 'Custom transcript prompt' } },
    'quick-notes': { customPrompts: { 'quick-notes': 'Custom quick prompt' } },
};
