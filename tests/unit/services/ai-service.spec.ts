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

describe('AIService', () => {
    let mockProviders: AIProvider[];
    let mockSettings: YouTubePluginSettings;
    let aiService: AIService;

    beforeEach(() => {
        mockProviders = [
            {
                name: 'Google Gemini',
                model: 'gemini-pro',
                process: jest.fn().mockResolvedValue('Test response from Gemini'),
            } as unknown as AIProvider,
            {
                name: 'Groq',
                model: 'llama2-70b',
                process: jest.fn().mockResolvedValue('Test response from Groq'),
            } as unknown as AIProvider,
        ];

        mockSettings = createMockSettings({
            geminiApiKey: 'test-gemini-key',
            groqApiKey: 'test-groq-key',
            performanceMode: 'balanced' as const,
            enableParallelProcessing: true,
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
            }).toThrow('At least one AI provider is required');
        });
    });

    describe('process', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should process prompt with first provider', async () => {
            const result = await aiService.process('test prompt');
            expect(result.content).toBe('Test response from Gemini');
            expect(result.provider).toBe('Google Gemini');
        });

        it('should throw on empty prompt', async () => {
            await expect(aiService.process('')).rejects.toThrow('Valid prompt is required');
        });
    });

    describe('processWith', () => {
        beforeEach(() => {
            aiService = new AIService(mockProviders, mockSettings);
        });

        it('should process with specific provider', async () => {
            const result = await aiService.processWith('Groq', 'test prompt');
            expect(result.provider).toBe('Groq');
        });

        it('should throw for unknown provider', async () => {
            await expect(aiService.processWith('Unknown', 'test prompt')).rejects.toThrow(
                'Provider "Unknown" not found',
            );
        });

        it('should fallback to another provider on failure', async () => {
            (mockProviders[0].process as jest.Mock).mockRejectedValueOnce(new Error('fail'));
            const result = await aiService.processWith('Google Gemini', 'test prompt', undefined, undefined, true);
            expect(result.provider).toBe('Groq');
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

    describe('updateSettings', () => {
        it('should update settings without error', () => {
            aiService = new AIService(mockProviders, mockSettings);
            const newSettings = { ...mockSettings, performanceMode: 'fast' as const };
            expect(() => aiService.updateSettings(newSettings)).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing providers gracefully', () => {
            expect(() => {
                new AIService([], mockSettings);
            }).toThrow();
        });
    });
});
