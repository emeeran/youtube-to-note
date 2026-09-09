/**
 * Test helper utilities.
 *
 * Thin factories so a spec can build a consistent starting state without
 * repeating itself.
 */

import type { YouTubePluginSettings } from '../../src/types';

/** The plugin's real defaults, mirrored for tests (keep in sync with main.ts). */
const DEFAULT_SETTINGS: YouTubePluginSettings = {
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

/**
 * Create a valid plugin settings object, overridable key by key.
 * Starts from the real defaults, so a spec only names what it changes.
 */
export function createMockSettings(overrides: Partial<YouTubePluginSettings> = {}): YouTubePluginSettings {
    return { ...DEFAULT_SETTINGS, geminiApiKey: 'test-gemini-key', ...overrides };
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Wait for a specified amount of time
 */
export async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
