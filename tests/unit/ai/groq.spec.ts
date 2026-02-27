/**
 * Unit tests for Groq AI Provider
 */

import { GroqProvider } from '../../../src/ai/groq';
import { API_ENDPOINTS } from '../../../src/constants/index';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock btoa for base64 encoding
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

describe('GroqProvider', () => {
    const validApiKey = 'gsk_1234567890123456789012345678901234567890';
    let provider: GroqProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new GroqProvider(validApiKey);
    });

    describe('constructor', () => {
        it('should create provider with API key', () => {
            expect(provider).toBeDefined();
            expect(provider.name).toBe('Groq');
        });

        it('should accept custom model', () => {
            const customProvider = new GroqProvider(validApiKey, 'llama-70b');
            expect(customProvider).toBeDefined();
        });

        it('should accept custom timeout', () => {
            const timeoutProvider = new GroqProvider(validApiKey, undefined, 5000);
            expect(timeoutProvider).toBeDefined();
        });
    });

    describe('process', () => {
        const mockSuccessResponse = {
            choices: [{
                message: {
                    role: 'assistant',
                    content: 'This is a test response',
                },
                finish_reason: 'stop',
                index: 0,
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
                API_ENDPOINTS.GROQ,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${validApiKey}`,
                    }),
                    body: expect.any(String),
                })
            );
        });

        it('should handle 401 Unauthorized', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
            });

            await expect(provider.process('Test')).rejects.toThrow();
        });

        it('should handle 402 Payment Required', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 402,
            });

            await expect(provider.process('Test')).rejects.toThrow();
        });

        it('should handle 404 Model Not Found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
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

        it('should handle 500 Server Error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            await expect(provider.process('Test')).rejects.toThrow();
        });

        it('should handle invalid response format', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [] }),
            });

            await expect(provider.process('Test')).rejects.toThrow();
        });

        it('should trim response text', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: '  Trimmed response  ',
                        },
                        finish_reason: 'stop',
                        index: 0,
                    }],
                }),
            });

            const result = await provider.process('Test');
            expect(result).toBe('Trimmed response');
        });
    });

    describe('request body construction', () => {
        const mockResponse = {
            choices: [{
                message: {
                    role: 'assistant',
                    content: 'Response',
                },
                finish_reason: 'stop',
                index: 0,
            }],
        };

        it('should create valid request body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await provider.process('Test prompt');

            const call = mockFetch.mock.calls[0];
            const body = JSON.parse(call[1].body);

            expect(body).toHaveProperty('model');
            expect(body).toHaveProperty('messages');
            expect(body).toHaveProperty('temperature');
            expect(body).toHaveProperty('max_tokens');
            expect(body.messages).toHaveLength(2); // system + user
            expect(body.messages[1].content).toBe('Test prompt');
        });

        it('should include Authorization header', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            await provider.process('Test');

            const call = mockFetch.mock.calls[0];
            expect(call[1].headers['Authorization']).toBe(`Bearer ${validApiKey}`);
        });
    });
});
