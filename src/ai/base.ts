import { AIProvider, AIRequestOptions } from '../types';
import {
    MODEL_LIST_TIMEOUT_MS,
    createAbortSignal,
    formatQuotaError,
    formatHttpError,
    isTimeoutAbort,
    sanitizeRemoteMessage,
} from './error-utils';
import type { JsonObject } from '../types/api-responses';

/**
 * Base AI provider interface and abstract implementation
 */

export abstract class BaseAIProvider implements AIProvider {
    abstract readonly name: string;
    protected _model: string;
    protected _timeout: number = 30000; // Default 30s timeout
    protected _maxTokens: number = 8192; // Default max tokens
    protected _temperature: number = 0.5; // Default temperature

    get model(): string {
        return this._model;
    }

    get timeout(): number {
        return this._timeout;
    }

    get maxTokens(): number {
        return this._maxTokens;
    }

    get temperature(): number {
        return this._temperature;
    }

    setModel(model: string): void {
        this._model = model;
    }

    setTimeout(timeout: number): void {
        this._timeout = timeout;
    }

    setMaxTokens(maxTokens: number): void {
        this._maxTokens = maxTokens;
    }

    setTemperature(temperature: number): void {
        this._temperature = temperature;
    }

    protected constructor(
        protected apiKey: string,
        initialModel?: string,
        timeout?: number,
    ) {
        // Note: API key validation is now optional - some providers (like Ollama) don't require it
        this._model = initialModel ?? '';
        if (timeout) {
            this._timeout = timeout;
        }
    }

    /**
     * Process a prompt and return the response
     */
    abstract process(prompt: string, options?: AIRequestOptions): Promise<string>;

    /**
     * Validate API response structure
     */
    protected validateResponse(response: JsonObject, requiredPath: string[]): boolean {
        let current: unknown = response;
        for (const key of requiredPath) {
            if (!current || typeof current !== 'object' || !(key in current)) {
                return false;
            }
            current = (current as Record<string, unknown>)[key];
        }
        return current !== null && current !== undefined;
    }

    /**
     * Safely parse JSON response without throwing
     */
    protected async safeJsonParse(response: Response): Promise<JsonObject | null> {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    /**
     * Sanitize a server-controlled message before embedding it in a thrown
     * Error (which may be rendered to the user). Delegates to the shared
     * implementation in `./error-utils` so non-provider code (error handling)
     * applies the exact same rules.
     */
    protected sanitizeRemoteMessage(message: unknown, maxLength = 200): string {
        return sanitizeRemoteMessage(message, maxLength);
    }

    /**
     * Build the AbortSignal for a provider fetch. Combines the caller's signal
     * (when one was threaded down) with an optional timeout. Returns
     * `undefined` when neither applies so existing behavior is unchanged.
     */
    protected requestSignal(options?: { timeoutMs?: number; signal?: AbortSignal }): AbortSignal | undefined {
        return createAbortSignal(options);
    }

    /**
     * Run a bounded request (model lists and other auxiliary calls): a hard
     * timeout always applies, and timeout/network failures are rethrown as a
     * plain, provider-labelled Error so callers treat them like any other
     * failure rather than an unhandled abort.
     */
    protected async fetchWithTimeout(
        url: string,
        init: RequestInit,
        context: string,
        timeoutMs = MODEL_LIST_TIMEOUT_MS,
    ): Promise<Response> {
        try {
            // `RequestInit.signal` may be null in the DOM typings — normalize it.
            return await fetch(url, {
                ...init,
                signal: this.requestSignal({ timeoutMs, signal: init.signal ?? undefined }),
            });
        } catch (error) {
            const reason = isTimeoutAbort(error)
                ? `timed out after ${timeoutMs}ms`
                : this.describeRequestFailure(error);
            throw new Error(`${context}: ${reason}`);
        }
    }

    private describeRequestFailure(error: unknown): string {
        if (error instanceof Error && error.message) {
            return sanitizeRemoteMessage(error.message, 120) || 'request failed';
        }
        return 'request failed';
    }

    /**
     * Handle API errors consistently using shared formatting utilities
     */
    protected async handleAPIError(response: Response): Promise<never> {
        const status = response.status;

        // Auth errors — no body needed
        if (status === 401 || status === 403) {
            throw new Error(formatHttpError(status, this.name));
        }

        // Quota/rate limit — parse body for details
        if (status === 429) {
            const errorData = await this.safeJsonParse(response);
            const rawMessage = (errorData as Record<string, unknown>)?.error
                ? String(((errorData as Record<string, unknown>).error as Record<string, unknown>)?.message ?? '')
                : String((errorData as Record<string, unknown>)?.message ?? '');
            throw new Error(formatQuotaError(this.sanitizeRemoteMessage(rawMessage), this.name));
        }

        // All other errors
        throw new Error(formatHttpError(status, this.name));
    }

    /**
     * Create request headers
     */
    protected abstract createHeaders(): Record<string, string>;

    /**
     * Create request body
     */
    protected abstract createRequestBody(prompt: string): JsonObject;

    /**
     * Extract content from API response
     */
    protected abstract extractContent(response: JsonObject): string;
}
