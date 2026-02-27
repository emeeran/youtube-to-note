/**
 * Unit tests for Error Handler Service
 */

import { ErrorHandler, ErrorCategory } from '../../../src/services/error-handler';

// Mock Notice
jest.mock('obsidian', () => ({
    Notice: jest.fn().mockImplementation((message: string) => {
        return { message };
    }),
}));

describe('ErrorHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('handle', () => {
        it('should handle Error instances without throwing', () => {
            const error = new Error('Test error');

            expect(() => ErrorHandler.handle(error, 'TestContext')).not.toThrow();
        });

        it('should handle string errors without throwing', () => {
            expect(() => ErrorHandler.handle('String error', 'TestContext')).not.toThrow();
        });

        it('should handle unknown error types without throwing', () => {
            expect(() => ErrorHandler.handle({ custom: 'error' }, 'TestContext')).not.toThrow();
        });
    });

    describe('withErrorHandling', () => {
        it('should return result on success', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            const result = await ErrorHandler.withErrorHandling(operation, 'TestContext');

            expect(result).toBe('success');
        });

        it('should return null on error', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Test error'));

            const result = await ErrorHandler.withErrorHandling(operation, 'TestContext');

            expect(result).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Test error'));

            // Should not throw
            await expect(ErrorHandler.withErrorHandling(operation, 'TestContext')).resolves.toBeNull();
        });
    });

    describe('classifyError', () => {
        it('should classify network errors', () => {
            const error = new Error('Network request failed');
            const result = ErrorHandler.classifyError(error);

            expect(result.category).toBe(ErrorCategory.NETWORK);
            expect(result.retryable).toBe(true);
        });

        it('should classify authentication errors', () => {
            const error = new Error('401 Unauthorized - invalid API key');
            const result = ErrorHandler.classifyError(error);

            expect(result.category).toBe(ErrorCategory.AUTH);
            expect(result.retryable).toBe(false);
        });

        it('should classify rate limit errors', () => {
            const error = new Error('429 Too Many Requests - rate limit exceeded');
            const result = ErrorHandler.classifyError(error);

            expect(result.category).toBe(ErrorCategory.QUOTA);
            expect(result.retryable).toBe(true);
        });

        it('should classify timeout errors', () => {
            const error = new Error('Request timeout after 30000ms');
            const result = ErrorHandler.classifyError(error);

            expect(result.category).toBe(ErrorCategory.NETWORK);
            expect(result.retryable).toBe(true);
        });
    });

    describe('handleEnhanced', () => {
        it('should handle rate limit errors without throwing', () => {
            const error = new Error('429 Rate limit exceeded');

            expect(() => ErrorHandler.handleEnhanced(error, 'EnhancedTest')).not.toThrow();
        });

        it('should detect quota issues', () => {
            const error = new Error('Quota exceeded for today');

            expect(() => ErrorHandler.handleEnhanced(error, 'QuotaTest')).not.toThrow();
        });

        it('should detect billing issues', () => {
            const error = new Error('Billing issue - please upgrade');

            expect(() => ErrorHandler.handleEnhanced(error, 'BillingTest')).not.toThrow();
        });
    });

    describe('user guidance', () => {
        it('should handle API key errors without throwing', () => {
            const error = new Error('Invalid API key');

            expect(() => ErrorHandler.handleEnhanced(error, 'APIKeyTest')).not.toThrow();
        });

        it('should handle network errors without throwing', () => {
            const error = new Error('Failed to fetch');

            expect(() => ErrorHandler.handleEnhanced(error, 'NetworkTest')).not.toThrow();
        });
    });

    describe('isQuotaError', () => {
        it('should detect 429 errors', () => {
            const error = new Error('429 Too Many Requests');
            expect(ErrorHandler.isQuotaError(error)).toBe(true);
        });

        it('should detect quota exceeded errors', () => {
            const error = new Error('Quota exceeded for today');
            expect(ErrorHandler.isQuotaError(error)).toBe(true);
        });

        it('should detect rate limit errors', () => {
            const error = new Error('Rate limit exceeded');
            expect(ErrorHandler.isQuotaError(error)).toBe(true);
        });

        it('should not detect regular errors as quota errors', () => {
            const error = new Error('Network error');
            expect(ErrorHandler.isQuotaError(error)).toBe(false);
        });
    });

    describe('extractProviderName', () => {
        it('should extract Google Gemini from error message', () => {
            const error = new Error('gemini API error');
            expect(ErrorHandler.extractProviderName(error)).toBe('Google Gemini');
        });

        it('should extract Groq from error message', () => {
            const error = new Error('groq API error');
            expect(ErrorHandler.extractProviderName(error)).toBe('Groq');
        });

        it('should return default for unknown provider', () => {
            const error = new Error('unknown API error');
            expect(ErrorHandler.extractProviderName(error)).toBe('AI Service');
        });
    });

    describe('createAPIError', () => {
        it('should create error with status and message', () => {
            const error = ErrorHandler.createAPIError('Gemini', 401, 'Unauthorized', 'Invalid key');

            expect(error.message).toContain('Gemini');
            expect(error.message).toContain('401');
            expect(error.message).toContain('Invalid key');
        });
    });
});
