import { ErrorHandlerInterface } from '../types';
import { MESSAGES } from '../messages';
import { Notice } from 'obsidian';

/**
 * Centralized error handling to eliminate code duplication
 */


export class ErrorHandler implements ErrorHandlerInterface {
    /**
     * Handle errors with consistent logging and user feedback
     */
    static handle(error: Error, context: string, showNotice = true): void {
        const errorMessage = `${context}: ${error.message}`;
        
if (showNotice) {
            new Notice(`Error: ${error.message}`);
        }
    }

    /**
     * Execute an operation with automatic error handling
     */
    static async withErrorHandling<T>(
        operation: () => Promise<T>,
        context: string,
        showNotice = true
    ): Promise<T | null> {
        try {
            return await operation();
        } catch (error) {
            this.handle(error as Error, context, showNotice);
            return null;
        }
    }

    /**
     * Execute a synchronous operation with error handling
     */
    static withSyncErrorHandling<T>(
        operation: () => T,
        context: string,
        showNotice = true
    ): T | null {
        try {
            return operation();
        } catch (error) {
            this.handle(error as Error, context, showNotice);
            return null;
        }
    }

    /**
     * Create a standardized error for API responses
     */
    static createAPIError(
        provider: string,
        status: number,
        statusText: string,
        details?: string
    ): Error {
        const message = `${provider} API error: ${status} ${statusText}${details ? `. ${details}` : ''}`;
        return new Error(message);
    }

    /**
     * Handle API response errors with consistent format
     */
    static async handleAPIError(
        response: Response,
        provider: string,
        fallbackMessage?: string
    ): Promise<never> {
        let errorDetails = fallbackMessage || '';
        
        try {
            const errorData = await response.json();
            errorDetails = errorData.error?.message || errorData.message || fallbackMessage || '';
        } catch {
            // Ignore JSON parsing errors
        }
        
        throw this.createAPIError(provider, response.status, response.statusText, errorDetails);
    }

    /**
     * Validate required configuration and throw descriptive errors
     */
    static validateConfiguration(config: Record<string, any>, requiredFields: string[]): void {
        const missing = requiredFields.filter(field => !config[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.join(', ')}`);
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
                    cls: 'mod-cta'
                });

                retryButton.style.marginLeft = '10px';
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
     */
    static isQuotaError(error: Error): boolean {
        const errorMessage = error.message.toLowerCase();
        const quotaKeywords = [
            'quota', 'limit', 'exceeded', 'rate', 'billing', 'payment',
            'credit', 'balance', 'insufficient', '429', 'usage'
        ];

        return quotaKeywords.some(keyword => errorMessage.includes(keyword));
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

    // Instance methods implementing interface
    handle(error: Error, context: string, showNotice = true): void {
        ErrorHandler.handle(error, context, showNotice);
    }

    async withErrorHandling<T>(
        operation: () => Promise<T>,
        context: string
    ): Promise<T | null> {
        return ErrorHandler.withErrorHandling(operation, context);
    }
}
