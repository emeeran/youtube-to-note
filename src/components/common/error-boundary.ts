/**
 * Error Boundary Component
 *
 * Provides a pattern for wrapping operations with error handling,
 * fallback UI rendering, and error recovery.
 *
 * Features:
 * - Wrap async operations with error handling
 * - Render fallback UI on errors
 * - Retry mechanisms
 * - Error classification and user guidance
 */

import { Notice } from 'obsidian';

/** Error classification types */
export type ErrorType =
    | 'network'
    | 'authentication'
    | 'authorization'
    | 'rate_limit'
    | 'validation'
    | 'timeout'
    | 'not_found'
    | 'unknown';

/** Classified error with additional context */
export interface ClassifiedError {
    type: ErrorType;
    originalError: Error;
    message: string;
    userGuidance: string;
    retryable: boolean;
    retryAfter?: number; // ms until retry is recommended
}

/** Error boundary options */
export interface ErrorBoundaryOptions {
    /** Context name for logging */
    context: string;
    /** Show notice on error */
    showNotice?: boolean;
    /** Custom error message */
    customMessage?: string;
    /** Enable retry */
    enableRetry?: boolean;
    /** Max retry attempts */
    maxRetries?: number;
    /** Retry delay in ms */
    retryDelay?: number;
    /** Callback on error */
    onError?: (error: ClassifiedError) => void;
    /** Callback on retry */
    onRetry?: (attempt: number) => void;
    /** Callback on success after retry */
    onSuccess?: () => void;
}

const DEFAULT_OPTIONS: Required<Omit<ErrorBoundaryOptions, 'context' | 'onError' | 'onRetry' | 'onSuccess'>> = {
    showNotice: true,
    customMessage: '',
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
};

/** Error patterns for classification */
const ERROR_PATTERNS: Record<ErrorType, {
    patterns: (string | RegExp)[];
    userGuidance: string;
    retryable: boolean;
}> = {
    network: {
        patterns: ['network', 'ECONNREFUSED', 'ENOTFOUND', 'fetch', 'offline'],
        userGuidance: 'Check your internet connection and try again.',
        retryable: true,
    },
    authentication: {
        patterns: ['401', 'unauthorized', 'invalid api key', 'invalid_key', 'authentication'],
        userGuidance: 'Your API key may be invalid or expired. Check your settings.',
        retryable: false,
    },
    authorization: {
        patterns: ['403', 'forbidden', 'access denied', 'permission'],
        userGuidance: 'You do not have permission to access this resource.',
        retryable: false,
    },
    rate_limit: {
        patterns: ['429', 'rate limit', 'quota', 'too many requests'],
        userGuidance: 'Rate limit exceeded. Please wait a moment and try again.',
        retryable: true,
    },
    validation: {
        patterns: ['400', 'invalid', 'validation', 'bad request'],
        userGuidance: 'The request was invalid. Check your input and try again.',
        retryable: false,
    },
    timeout: {
        patterns: ['timeout', 'timed out', 'ETIMEDOUT'],
        userGuidance: 'The request took too long. Try again or check your connection.',
        retryable: true,
    },
    not_found: {
        patterns: ['404', 'not found', 'does not exist'],
        userGuidance: 'The requested resource was not found.',
        retryable: false,
    },
    unknown: {
        patterns: [],
        userGuidance: 'An unexpected error occurred. Please try again.',
        retryable: true,
    },
};

/**
 * Classify an error based on its message
 */
export function classifyError(error: Error): ClassifiedError {
    const message = error.message.toLowerCase();
    const errorString = error.toString().toLowerCase();

    for (const [type, config] of Object.entries(ERROR_PATTERNS) as [ErrorType, typeof ERROR_PATTERNS[ErrorType]][]) {
        for (const pattern of config.patterns) {
            const searchStr = typeof pattern === 'string' ? pattern.toLowerCase() : pattern.source.toLowerCase();
            if (message.includes(searchStr) || errorString.includes(searchStr)) {
                return {
                    type,
                    originalError: error,
                    message: error.message,
                    userGuidance: config.userGuidance,
                    retryable: config.retryable,
                    retryAfter: type === 'rate_limit' ? 60000 : undefined, // 1 minute for rate limits
                };
            }
        }
    }

    return {
        type: 'unknown',
        originalError: error,
        message: error.message,
        userGuidance: ERROR_PATTERNS.unknown.userGuidance,
        retryable: ERROR_PATTERNS.unknown.retryable,
    };
}

/**
 * Error Boundary class for wrapping operations
 */
export class ComponentErrorBoundary {
    private options: Required<ErrorBoundaryOptions>;
    private retryCount = 0;

    constructor(options: ErrorBoundaryOptions) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
        } as Required<ErrorBoundaryOptions>;
    }

    /**
     * Wrap an async operation with error handling
     */
    async wrap<T>(operation: () => Promise<T>): Promise<T | null> {
        try {
            const result = await operation();
            if (this.retryCount > 0) {
                this.options.onSuccess?.();
            }
            this.retryCount = 0;
            return result;
        } catch (error) {
            const classifiedError = classifyError(error instanceof Error ? error : new Error(String(error)));
            return this.handleError(classifiedError, operation);
        }
    }

    /**
     * Handle error with optional retry
     */
    private async handleError<T>(classifiedError: ClassifiedError, operation: () => Promise<T>): Promise<T | null> {
        this.options.onError?.(classifiedError);

        // Show user notice
        if (this.options.showNotice) {
            const message = this.options.customMessage || classifiedError.userGuidance;
            new Notice(`Error: ${message}`);
        }

        // Check if retry is possible
        if (
            classifiedError.retryable &&
            this.options.enableRetry &&
            this.retryCount < this.options.maxRetries
        ) {
            return this.retry(operation);
        }

        // Log error
        console.error(`[${this.options.context}] Error:`, classifiedError);

        return null;
    }

    /**
     * Retry operation
     */
    private async retry<T>(operation: () => Promise<T>): Promise<T | null> {
        this.retryCount++;
        this.options.onRetry?.(this.retryCount);

        // Wait before retry
        if (this.options.retryDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        }

        return this.wrap(operation);
    }

    /**
     * Render a fallback UI element for errors
     */
    renderFallback(error: Error, onRetry?: () => void): HTMLElement {
        const classified = classifyError(error);
        const container = document.createElement('div');
        container.className = 'error-boundary-fallback';
        container.style.cssText = `
            padding: 16px;
            border-radius: 8px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-error);
        `;

        // Error icon and message
        const messageEl = container.createEl('div');
        messageEl.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';

        const icon = messageEl.createEl('span');
        icon.textContent = '⚠️';
        icon.style.cssText = 'font-size: 1.2em;';

        const text = messageEl.createEl('span');
        text.textContent = classified.message;
        text.style.cssText = 'color: var(--text-error);';

        // User guidance
        const guidanceEl = container.createEl('div');
        guidanceEl.textContent = classified.userGuidance;
        guidanceEl.style.cssText = 'color: var(--text-muted); margin-bottom: 12px; font-size: 0.9em;';

        // Retry button
        if (classified.retryable && onRetry) {
            const retryBtn = container.createEl('button');
            retryBtn.textContent = 'Try Again';
            retryBtn.style.cssText = `
                padding: 6px 12px;
                border-radius: 4px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                cursor: pointer;
            `;
            retryBtn.addEventListener('click', onRetry);
        }

        return container;
    }

    /**
     * Reset error boundary state
     */
    reset(): void {
        this.retryCount = 0;
    }
}

/**
 * Create an error boundary with simplified options
 */
export function createErrorBoundary(context: string, options?: Partial<ErrorBoundaryOptions>): ComponentErrorBoundary {
    return new ComponentErrorBoundary({
        context,
        ...options,
    });
}
