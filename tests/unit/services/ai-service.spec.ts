/**
 * Unit tests for AIService
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIService } from '../../../src/services/ai-service';
import { AIProvider, YouTubePluginSettings } from '../../../src/types';
import { createMockSettings } from '@tests/utils/test-helpers';

// Mock the dependencies before importing
jest.mock('../../../src/services/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('../../../src/services/performance-tracker', () => ({
    performanceTracker: {
        measureOperation: jest.fn((name, id, operation, metadata) => operation()),
        trackOperation: jest.fn(),
    },
}));

jest.mock('../../../src/utils/http-client', () => ({
    OptimizedHttpClient: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        post: jest.fn(),
    })),
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
                generateResponse: jest.fn().mockResolvedValue({
                    content: 'Test response from Gemini',
                    model: 'gemini-pro',
                    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
                }),
                setTimeout: jest.fn(),
            } as unknown as AIProvider,
            {
                name: 'Groq',
                generateResponse: jest.fn().mockResolvedValue({
                    content: 'Test response from Groq',
                    model: 'llama2-70b',
                    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
                }),
                setTimeout: jest.fn(),
            } as unknown as AIProvider,
        ];

        mockSettings = createMockSettings({
            geminiApiKey: 'test-gemini-key',
            groqApiKey: 'test-groq-key',
            performanceMode: 'balanced' as const,
            enableParallelProcessing: true,
            cacheEnabled: true,
        });
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
            }).toThrow('No valid Gemini or Groq API key configured');
        });

        it('should apply performance settings on initialization', () => {
            aiService = new AIService(mockProviders, mockSettings);
            // Verify setTimeout was called on providers
            expect(mockProviders[0].setTimeout).toHaveBeenCalled();
        });

        it('should use custom timeouts when provided', () => {
            const customTimeouts = {
                geminiTimeout: 60000,
                groqTimeout: 45000,
                ollamaTimeout: 120000,
                huggingfaceTimeout: 30000,
                openrouterTimeout: 30000,
            };

            mockSettings.customTimeouts = customTimeouts;
            aiService = new AIService(mockProviders, mockSettings);

            expect(mockProviders[0].setTimeout).toHaveBeenCalledWith(60000);
        });
    });

    describe('updateSettings', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should update settings and reapply performance settings', () => {
            const newSettings = {
                ...mockSettings,
                performanceMode: 'fast' as const,
            };

            aiService.updateSettings(newSettings);
            // Should reapply settings (verified by no error thrown)
            expect(mockProviders[0].setTimeout).toHaveBeenCalled();
        });
    });

    describe('getProviderModels', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should return models for a known provider', () => {
            const models = aiService.getProviderModels('Google Gemini');
            expect(Array.isArray(models)).toBe(true);
            expect(models.length).toBeGreaterThan(0);
        });

        it('should return empty array for unknown provider', () => {
            const models = aiService.getProviderModels('Unknown Provider');
            expect(models).toEqual([]);
        });

        it('should handle both string arrays and model objects', () => {
            const geminiModels = aiService.getProviderModels('Google Gemini');
            geminiModels.forEach(model => {
                expect(typeof model).toBe('string');
            });
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

    describe('Error Handling', () => {
        it('should handle missing API keys gracefully', () => {
            expect(() => {
                new AIService([], mockSettings);
            }).toThrow();
        });
    });

    describe('Performance Modes', () => {
        it('should apply fast performance settings', () => {
            mockSettings.performanceMode = 'fast' as const;
            aiService = new AIService(mockProviders, mockSettings);
            expect(mockProviders[0].setTimeout).toHaveBeenCalled();
        });

        it('should apply balanced performance settings', () => {
            mockSettings.performanceMode = 'balanced' as const;
            aiService = new AIService(mockProviders, mockSettings);
            expect(mockProviders[0].setTimeout).toHaveBeenCalled();
        });

        it('should apply quality performance settings', () => {
            mockSettings.performanceMode = 'quality' as const;
            aiService = new AIService(mockProviders, mockSettings);
            expect(mockProviders[0].setTimeout).toHaveBeenCalled();
        });
    });
});
