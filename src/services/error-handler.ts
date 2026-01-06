import { ErrorHandlerInterface } from '../types';
import { MESSAGES } from '../constants/index';
import { Notice } from 'obsidian';

/**
 * Error category for better handling
 */
export enum ErrorCategory {
    NETWORK = 'network',
    QUOTA = 'quota',
    AUTH = 'auth',
    VALIDATION = 'validation',
    PROVIDER = 'provider',
    UNKNOWN = 'unknown'
}

/**
 * Structured error result
 */
export interface ErrorResult {
    category: ErrorCategory;
    message: string;
    retryable: boolean;
    retryDelay?: number;
    userGuidance?: string;
}

/**
 * Centralized error handling to eliminate code duplication
 */

export class ErrorHandler implements ErrorHandlerInterface {
    /**
     * Classify an error into categories for appropriate handling
     */
    static classifyError(error: Error): ErrorResult {
        const message = error.message.toLowerCase();

        // Network errors
        if (message.includes('network') || message.includes('fetch') ||
            message.includes('connection') || message.includes('timeout') ||
            message.includes('econnrefused') || message.includes('enotfound')) {
            return {
                category: ErrorCategory.NETWORK,
                message: MESSAGES.ERRORS.NETWORK_ERROR,
                retryable: true,
                retryDelay: 2000,
                userGuidance: 'Check your internet connection and try again.',
            };
        }

        // Quota/Rate limit errors
        if (this.isQuotaError(error)) {
            const provider = this.extractProviderName(error);
            return {
                category: ErrorCategory.QUOTA,
                message: message.includes('rate')
                    ? MESSAGES.ERRORS.RATE_LIMITED(provider)
                    : MESSAGES.ERRORS.QUOTA_EXCEEDED(provider),
                retryable: message.includes('rate'),
                retryDelay: message.includes('rate') ? 60000 : undefined,
                userGuidance: message.includes('rate')
                    ? 'Wait a minute before trying again.'
                    : 'Check your API plan or try a different provider.',
            };
        }

        // Authentication errors
        if (message.includes('401') || message.includes('403') ||
            message.includes('unauthorized') || message.includes('invalid key') ||
            message.includes('invalid api key') || message.includes('authentication')) {
            return {
                category: ErrorCategory.AUTH,
                message: 'API key is invalid or expired. Please check your settings.',
                retryable: false,
                userGuidance: 'Verify your API key in the plugin settings.',
            };
        }

        // Validation errors
        if (message.includes('invalid url') || message.includes('video id') ||
            message.includes('not found') || message.includes('unavailable')) {
            return {
                category: ErrorCategory.VALIDATION,
                message: error.message,
                retryable: false,
                userGuidance: 'Check the video URL and try again.',
            };
        }

        // Provider-specific errors
        if (message.includes('model') || message.includes('context length') ||
            message.includes('too long') || message.includes('token')) {
            return {
                category: ErrorCategory.PROVIDER,
                message: error.message,
                retryable: false,
                userGuidance: 'Try a different model or shorter video.',
            };
        }

        // Unknown errors
        return {
            category: ErrorCategory.UNKNOWN,
            message: error.message,
            retryable: true,
            retryDelay: 3000,
            userGuidance: 'An unexpected error occurred. Please try again.',
        };
    }

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
     * Handle errors with classification and better UX
     */
    static handleWithGuidance(error: Error, context: string): ErrorResult {
        const result = this.classifyError(error);

        // Create notice with guidance
        const noticeMessage = result.userGuidance
            ? `${result.message}\n\n💡 ${result.userGuidance}`
            : result.message;

        const noticeDuration = result.retryable ? 5000 : 8000;
        new Notice(noticeMessage, noticeDuration);

        return result;
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
                    cls: 'mod-cta',
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
