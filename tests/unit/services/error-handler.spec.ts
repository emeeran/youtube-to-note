/**
 * Unit tests for Error Handler Service
 */

import { ErrorHandler } from '../../../src/services/error-handler';

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
        it('should handle Error instances', () => {
            const error = new Error('Test error');

            ErrorHandler.handle(error, 'TestContext');

            expect(console.error).toHaveBeenCalled();
        });

        it('should handle string errors', () => {
            ErrorHandler.handle('String error', 'TestContext');

            expect(console.error).toHaveBeenCalled();
        });

        it('should handle unknown error types', () => {
            ErrorHandler.handle({ custom: 'error' }, 'TestContext');

            expect(console.error).toHaveBeenCalled();
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

        it('should log error on failure', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Test error'));

            await ErrorHandler.withErrorHandling(operation, 'TestContext');

            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('error classification', () => {
        it('should classify network errors', () => {
            const error = new Error('Network request failed');

            ErrorHandler.handle(error, 'NetworkTest');

            expect(console.error).toHaveBeenCalled();
        });

        it('should classify authentication errors', () => {
            const error = new Error('401 Unauthorized - invalid API key');

            ErrorHandler.handle(error, 'AuthTest');

            expect(console.error).toHaveBeenCalled();
        });

        it('should classify rate limit errors', () => {
            const error = new Error('429 Too Many Requests - rate limit exceeded');

            ErrorHandler.handle(error, 'RateLimitTest');

            expect(console.error).toHaveBeenCalled();
        });

        it('should classify timeout errors', () => {
            const error = new Error('Request timed out after 30000ms');

            ErrorHandler.handle(error, 'TimeoutTest');

            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('handleEnhanced', () => {
        it('should provide user-friendly messages', () => {
            const error = new Error('429 Rate limit exceeded');

            ErrorHandler.handleEnhanced(error, 'EnhancedTest');

            expect(console.error).toHaveBeenCalled();
        });

        it('should detect quota issues', () => {
            const error = new Error('Quota exceeded for today');

            ErrorHandler.handleEnhanced(error, 'QuotaTest');

            expect(console.error).toHaveBeenCalled();
        });

        it('should detect billing issues', () => {
            const error = new Error('Billing issue - please upgrade');

            ErrorHandler.handleEnhanced(error, 'BillingTest');

            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('user guidance', () => {
        it('should provide guidance for API key issues', () => {
            const error = new Error('Invalid API key');

            ErrorHandler.handleEnhanced(error, 'APIKeyTest');

            expect(console.error).toHaveBeenCalled();
        });

        it('should provide guidance for network issues', () => {
            const error = new Error('Failed to fetch');

            ErrorHandler.handleEnhanced(error, 'NetworkTest');

            expect(console.error).toHaveBeenCalled();
        });
    });
});
