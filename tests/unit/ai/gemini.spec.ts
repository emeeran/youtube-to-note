/**
 * Unit tests for Gemini AI Provider
 */

import { GeminiProvider } from '../../../src/ai/gemini';
import { API_ENDPOINTS } from '../../../src/constants/index';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GeminiProvider', () => {
    const validApiKey = 'AIza1234567890123456789012345678901234567';
    let provider: GeminiProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new GeminiProvider(validApiKey);
    });

    describe('constructor', () => {
        it('should create provider with API key', () => {
            expect(provider).toBeDefined();
            expect(provider.name).toBe('Google Gemini');
        });

        it('should accept custom model', () => {
            const customProvider = new GeminiProvider(validApiKey, 'gemini-1.5-pro');
            expect(customProvider).toBeDefined();
        });

        it('should accept custom timeout', () => {
            const timeoutProvider = new GeminiProvider(validApiKey, undefined, 5000);
            expect(timeoutProvider).toBeDefined();
        });
    });

    describe('process', () => {
        const mockSuccessResponse = {
            candidates: [{
                content: {
                    parts: [{ text: 'This is a test response' }],
                },
                finishReason: 'STOP',
            }],
        };

        it('should process prompt successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSuccessResponse,
            });

            const result = await provider.process('Test prompt');

            expect(result).toBe('This is a test response');
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining(API_ENDPOINTS.GEMINI),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.any(Object),
                    body: expect.any(String),
                })
            );
        });

        it('should throw error for empty API key', async () => {
            const emptyProvider = new GeminiProvider('');
            await expect(emptyProvider.process('Test')).rejects.toThrow('API key');
        });

        it('should handle 400 Bad Request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: { message: 'Invalid request' } }),
            });

            await expect(provider.process('Test')).rejects.toThrow('400');
        });

        it('should handle 401 Unauthorized', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
            });

            await expect(provider.process('Test')).rejects.toThrow('invalid');
        });

        it('should handle 403 Forbidden (quota)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ error: { message: 'Quota exceeded' } }),
            });

            await expect(provider.process('Test')).rejects.toThrow();
        });

        it('should handle 429 Rate Limit', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({ error: { message: 'Rate limit exceeded' } }),
            });

            await expect(provider.process('Test')).rejects.toThrow();
        });

        it('should handle safety filter block', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        finishReason: 'SAFETY',
                    }],
                }),
            });

            await expect(provider.process('Test')).rejects.toThrow('safety');
        });

        it('should handle empty candidates', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ candidates: [] }),
            });

            await expect(provider.process('Test')).rejects.toThrow('No response');
        });

        it('should trim response text', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: '  Trimmed response  ' }],
                        },
                        finishReason: 'STOP',
                    }],
                }),
            });

            const result = await provider.process('Test');
            expect(result).toBe('Trimmed response');
        });
    });

    describe('request body construction', () => {
        it('should create valid request body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSuccessResponse,
            });

            await provider.process('Test prompt');

            const call = mockFetch.mock.calls[0];
            const body = JSON.parse(call[1].body);

            expect(body).toHaveProperty('contents');
            expect(body).toHaveProperty('generationConfig');
            expect(body.contents[0].parts[0].text).toBe('Test prompt');
        });

        it('should include multimodal config for YouTube URLs', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSuccessResponse,
            });

            await provider.process('Analyze this video: https://youtube.com/watch?v=test');

            const call = mockFetch.mock.calls[0];
            const body = JSON.parse(call[1].body);

            expect(body).toHaveProperty('systemInstruction');
        });
    });
});
