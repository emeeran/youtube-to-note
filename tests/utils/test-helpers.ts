/**
 * Test helper utilities
 */

import { MockApp } from '../__mocks__/obsidian';
import { YTClipperSettings } from '../../src/types';

// Re-export fixtures for convenience
export * from '../fixtures';

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

/**
 * Create a mock video data object
 */
export function createMockVideoData(overrides = {}) {
    return {
        videoId: 'test-video-id',
        url: 'https://www.youtube.com/watch?v=test-video-id',
        title: 'Test Video Title',
        author: 'Test Author',
        description: 'Test video description',
        thumbnail: 'https://example.com/thumbnail.jpg',
        duration: 600,
        publishedAt: new Date().toISOString(),
        transcript: 'This is a test transcript content.',
        ...overrides,
    };
}

/**
 * Create a mock plugin settings object
 */
export function createMockSettings(overrides = {}) {
    return {
        geminiApiKey: 'test-gemini-key',
        groqApiKey: 'test-groq-key',
        ollamaApiKey: 'test-ollama-key',
        huggingfaceApiKey: 'test-huggingface-key',
        openrouterApiKey: 'test-openrouter-key',
        defaultProvider: 'gemini',
        outputFormat: 'executive',
        performanceMode: 'balanced',
        cacheEnabled: true,
        maxRetries: 3,
        timeout: 30000,
        ...overrides,
    };
}

/**
 * Create a mock AI response
 */
export function createMockAIResponse(overrides = {}) {
    return {
        content: 'This is a test AI response content.',
        model: 'test-model',
        usage: {
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 300,
        },
        ...overrides,
    };
}

/**
 * Mock successful API response
 */
export function createMockSuccessResponse(data: any) {
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

/**
 * Stub a method and track calls
 */
export function createStub<T extends (...args: any[]) => any>(
    implementation?: T
): jest.MockedFunction<T> {
    return jest.fn(implementation) as jest.MockedFunction<T>;
}

/**
 * Create a spy on an object method
 */
export function spyOn<T extends object, K extends keyof T>(
    obj: T,
    method: K
): jest.SpyInstance<T[K]> {
    return jest.spyOn(obj, method);
}
