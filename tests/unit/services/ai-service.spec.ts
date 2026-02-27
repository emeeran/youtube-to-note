/**
 * Unit tests for AIService
 */

import { AIService } from '../../../src/services/ai-service';
import { AIProvider, YouTubePluginSettings } from '../../../src/types';

// Mock the dependencies
jest.mock('../../../src/services/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

describe('AIService', () => {
    let mockProviders: AIProvider[];
    let mockSettings: YouTubePluginSettings;
    let aiService: AIService;

    beforeEach(() => {
        // Create mock providers
        mockProviders = [
            {
                name: 'Google Gemini',
                process: jest.fn().mockResolvedValue('Test response from Gemini'),
                model: 'gemini-pro',
            } as unknown as AIProvider,
            {
                name: 'Groq',
                process: jest.fn().mockResolvedValue('Test response from Groq'),
                model: 'llama2-70b',
            } as unknown as AIProvider,
        ];

        mockSettings = {
            geminiApiKey: 'test-gemini-key',
            groqApiKey: 'test-groq-key',
            performanceMode: 'balanced',
            enableParallelProcessing: true,
            cacheEnabled: true,
        } as YouTubePluginSettings;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with providers and settings', () => {
            aiService = new AIService(mockProviders, mockSettings);
            expect(aiService).toBeDefined();
        });

        it('should throw error when no providers are provided', () => {
            expect(() => {
                new AIService([], mockSettings);
            }).toThrow('At least one AI provider is required');
        });

        it('should throw error when providers is null', () => {
            expect(() => {
                new AIService(null as unknown as AIProvider[], mockSettings);
            }).toThrow('At least one AI provider is required');
        });
    });

    describe('updateSettings', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should update settings without error', () => {
            const newSettings = {
                ...mockSettings,
                performanceMode: 'fast' as const,
            };

            expect(() => aiService.updateSettings(newSettings)).not.toThrow();
        });
    });

    describe('getProviderModels', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should return models for a known provider', () => {
            const models = aiService.getProviderModels('Google Gemini');
            expect(Array.isArray(models)).toBe(true);
        });

        it('should return empty array for unknown provider', () => {
            const models = aiService.getProviderModels('Unknown Provider');
            expect(models).toEqual([]);
        });
    });

    describe('getProviderNames', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should return list of provider names', () => {
            const names = aiService.getProviderNames();
            expect(names).toContain('Google Gemini');
            expect(names).toContain('Groq');
        });
    });

    describe('hasAvailableProviders', () => {
        it('should return true when providers exist', () => {
            aiService = new AIService(mockProviders, mockSettings);
            expect(aiService.hasAvailableProviders()).toBe(true);
        });
    });

    describe('addProvider', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should add a new provider', () => {
            const newProvider = {
                name: 'OpenAI',
                process: jest.fn().mockResolvedValue('Response'),
            } as unknown as AIProvider;

            aiService.addProvider(newProvider);

            expect(aiService.getProviderNames()).toContain('OpenAI');
        });
    });

    describe('removeProvider', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should remove an existing provider', () => {
            const removed = aiService.removeProvider('Groq');

            expect(removed).toBe(true);
            expect(aiService.getProviderNames()).not.toContain('Groq');
        });

        it('should return false for non-existent provider', () => {
            const removed = aiService.removeProvider('NonExistent');

            expect(removed).toBe(false);
        });
    });

    describe('process', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should process prompt with first provider', async () => {
            const result = await aiService.process('Test prompt');

            expect(result.content).toBe('Test response from Gemini');
            expect(result.provider).toBe('Google Gemini');
        });

        it('should throw error for empty prompt', async () => {
            await expect(aiService.process('')).rejects.toThrow('Valid prompt is required');
        });
    });

    describe('processWith', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should process with specific provider', async () => {
            const result = await aiService.processWith('Groq', 'Test prompt');

            expect(result.provider).toBe('Groq');
        });

        it('should throw error for unknown provider', async () => {
            await expect(aiService.processWith('Unknown', 'Test')).rejects.toThrow('Provider "Unknown" not found');
        });

        it('should fallback to another provider on error', async () => {
            // Make first provider throw
            (mockProviders[0].process as jest.Mock).mockRejectedValueOnce(new Error('Provider error'));

            const result = await aiService.processWith('Google Gemini', 'Test', undefined, undefined, true);

            // Should fallback to Groq
            expect(result.provider).toBe('Groq');
        });
    });

    describe('getPerformanceMetrics', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should return performance metrics', () => {
            const metrics = aiService.getPerformanceMetrics();

            expect(metrics.providerCount).toBe(2);
            expect(Array.isArray(metrics.providers)).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should cleanup providers with cleanup method', () => {
            const providerWithCleanup = {
                name: 'Test',
                process: jest.fn(),
                cleanup: jest.fn(),
            } as unknown as AIProvider;

            aiService = new AIService([providerWithCleanup], mockSettings);
            aiService.cleanup();

            expect(providerWithCleanup.cleanup).toHaveBeenCalled();
        });

        it('should handle providers without cleanup method', () => {
            aiService = new AIService(mockProviders, mockSettings);

            expect(() => aiService.cleanup()).not.toThrow();
        });
    });
});
