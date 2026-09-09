import { Notice } from 'obsidian';
import { logger } from './logger';

/**
 * Centralized user-facing error handling. Deliberately small: provider-facing
 * error formatting lives in `src/ai/error-utils.ts` and
 * `BaseAIProvider.handleAPIError` — this class only decides what the user sees.
 */
export class ErrorHandler {
    /**
     * Handle errors with consistent logging and user feedback
     */
    static handle(error: Error, context: string, showNotice = true): void {
        logger.warn(`${context}: ${error.message}`, 'ErrorHandler');
        if (showNotice) {
            new Notice(`Error: ${error.message}`);
        }
    }

    /**
     * Create a user-friendly error message for common scenarios
     */
    static createUserFriendlyError(error: Error, operation: string): Error {
        const message = `Failed to ${operation}: ${error.message}`;
        return new Error(message);
    }
}
