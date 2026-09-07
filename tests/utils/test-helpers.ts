/**
 * Test helper utilities.
 *
 * Thin factories over the shared Obsidian mock and the real settings fixtures,
 * so a spec can build a consistent starting state without repeating itself.
 */

import { MockApp } from '../__mocks__/obsidian';
import { DEFAULT_SETTINGS } from '../fixtures/settings.fixtures';
import type { AIResponse, VideoData, YouTubePluginSettings } from '../../src/types';

// Re-export fixtures for convenience
export * from '../fixtures';
export { DEFAULT_SETTINGS };

/**
 * Create a mock app instance
 */
export function createMockApp(): MockApp {
    return new MockApp();
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

/** A valid YouTube video id — 11 characters of the `[A-Za-z0-9_-]` class. */
export const TEST_VIDEO_ID = 'dQw4w9WgXcQ';

/** URL that pairs with {@link TEST_VIDEO_ID}. */
export const TEST_VIDEO_URL = `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`;

/**
 * Create a mock video metadata object
 */
export function createMockVideoData(overrides: Partial<VideoData> = {}): VideoData {
    return {
        title: 'Test Video Title',
        description: 'Test video description',
        channelName: 'Test Channel',
        thumbnail: 'https://example.com/thumbnail.jpg',
        duration: 600,
        publishedAt: '2024-01-01T00:00:00Z',
        ...overrides,
    };
}

/**
 * Create a valid plugin settings object, overridable key by key.
 * Starts from the real defaults, so a spec only names what it changes.
 */
export function createMockSettings(overrides: Partial<YouTubePluginSettings> = {}): YouTubePluginSettings {
    return { ...DEFAULT_SETTINGS, geminiApiKey: 'test-gemini-key', ...overrides };
}

/**
 * Create a mock AI response
 */
export function createMockAIResponse(overrides: Partial<AIResponse> = {}): AIResponse {
    return {
        content: 'This is a test AI response content.',
        provider: 'Google Gemini',
        model: 'gemini-2.0-flash',
        ...overrides,
    };
}

/**
 * Mock successful API response
 */
export function createMockSuccessResponse(data: unknown) {
    return {
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
        headers: new Headers(),
    };
}

/**
 * Mock failed API response
 */
export function createMockErrorResponse(status: number, message: string) {
    return {
        ok: false,
        status,
        json: async () => ({ error: message }),
        text: async () => message,
        headers: new Headers(),
    };
}
