import { MESSAGES } from '../constants/index';
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
        logger.debug(`${context}: ${error.message}`, 'ErrorHandler');
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

    /**
     * Handle API quota and billing errors with specific user guidance
     */
    // eslint-disable-next-line complexity
    static handleQuotaError(error: Error, provider: string): void {
        const errorMessage = error.message.toLowerCase();
        let userMessage = '';
        let showRetryAction = false;

        if (errorMessage.includes('quota') || errorMessage.includes('limit') || errorMessage.includes('exceeded')) {
            if (errorMessage.includes('rate') || errorMessage.includes('too many requests')) {
                userMessage = MESSAGES.ERRORS.RATE_LIMITED(provider);
                showRetryAction = true;
            } else if (errorMessage.includes('billing') || errorMessage.includes('payment')) {
                userMessage = MESSAGES.ERRORS.BILLING_REQUIRED(provider);
            } else if (errorMessage.includes('credit') || errorMessage.includes('balance')) {
                userMessage = MESSAGES.ERRORS.CREDIT_EXHAUSTED(provider);
            } else {
                userMessage = MESSAGES.ERRORS.QUOTA_EXCEEDED(provider);
                showRetryAction = true;
            }
        } else {
            userMessage = MESSAGES.ERRORS.QUOTA_EXCEEDED(provider);
        }

        if (showRetryAction) {
            const noticeWithAction = new Notice(userMessage, 0);

            // Add retry button to notice
            setTimeout(() => {
                const noticeEl = noticeWithAction.noticeEl;
                const retryButton = noticeEl.createEl('button', {
                    text: 'Retry',
                    cls: 'mod-cta ytc-notice-retry',
                });

                retryButton.onclick = () => {
                    noticeWithAction.hide();
                    // Trigger a retry by dispatching a custom event
                    window.dispatchEvent(new CustomEvent('yt-clipper-retry-processing'));
                };
            }, 100);
        } else {
            new Notice(userMessage, 8000); // 8 seconds for billing errors
        }
    }

    /**
     * Detect if an error is quota/billing related
     * Uses specific phrases to avoid false positives
     */
    static isQuotaError(error: Error): boolean {
        const errorMessage = error.message.toLowerCase();

        // Specific rate limit/quota phrases (not just keywords)
        const quotaPhrases = [
            'quota exceeded',
            'rate limit',
            'rate_limit',
            'too many requests',
            'billing required',
            'payment required',
            'credit exhausted',
            'insufficient credits',
            'insufficient balance',
            'usage limit',
            'api limit exceeded',
            'requests per minute',
            'requests per second',
            'resource_exhausted',
        ];

        // Check for HTTP 429 status code in message
        if (errorMessage.includes('429')) {
            return true;
        }

        return quotaPhrases.some(phrase => errorMessage.includes(phrase));
    }

    /**
     * Get provider name from error or use default
     */
    static extractProviderName(error: Error, defaultProvider: string = 'AI Service'): string {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('gemini') || errorMessage.includes('google')) {
            return 'Google Gemini';
        } else if (errorMessage.includes('groq')) {
            return 'Groq';
        } else if (errorMessage.includes('openai')) {
            return 'OpenAI';
        }

        return defaultProvider;
    }

    /**
     * Enhanced error handling with quota detection
     */
    static handleEnhanced(error: Error, context: string, showNotice = true): void {
        // Check if this is a quota-related error
        if (this.isQuotaError(error)) {
            const provider = this.extractProviderName(error);
            this.handleQuotaError(error, provider);
            return;
        }

        // Use standard error handling for non-quota errors
        this.handle(error, context, showNotice);
    }
}
