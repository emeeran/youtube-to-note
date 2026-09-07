import { AIProvider, AIRequestOptions } from '../types';
import {
    MODEL_LIST_TIMEOUT_MS,
    REQUEST_TIMEOUT_MS,
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
    /** Hard ceiling for a generation request (see `requestSignal`). */
    protected _timeout: number = REQUEST_TIMEOUT_MS;
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
     * Effective generation params for THIS request: a per-request override wins,
     * otherwise the provider's configured value applies. Overrides are never
     * written back to the instance — providers are shared singletons, so storing
     * them would leak one run's settings into every later run.
     */
    protected effectiveMaxTokens(options?: AIRequestOptions): number {
        const requested = options?.maxTokens;
        return typeof requested === 'number' && Number.isFinite(requested) && requested > 0
            ? Math.floor(requested)
            : this._maxTokens;
    }

    /** Per-request temperature override, falling back to the configured value. */
    protected effectiveTemperature(options?: AIRequestOptions): number {
        const requested = options?.temperature;
        return typeof requested === 'number' && Number.isFinite(requested) ? requested : this._temperature;
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
     * Run a generation request (`process` / `processWithImage`) under a hard
     * timeout, so a hung provider cannot pin the run forever. The caller's
     * signal still wins: an explicit cancellation propagates untouched, while a
     * timeout is rethrown as a provider-labelled Error (same shape as
     * `fetchWithTimeout`) instead of a bare abort.
     */
    protected async fetchGeneration(url: string, init: RequestInit, options?: AIRequestOptions): Promise<Response> {
        const timeoutMs = this.requestTimeoutMs;
        try {
            return await fetch(url, {
                ...init,
                signal: this.requestSignal({ timeoutMs, signal: options?.signal }),
            });
        } catch (error) {
            if (isTimeoutAbort(error) && options?.signal?.aborted !== true) {
                throw new Error(
                    `${this.name}: request timed out after ${timeoutMs}ms. Try again or use a shorter video.`,
                );
            }
            throw error;
        }
    }

    /** Timeout applied to generation requests (the provider's `_timeout`). */
    protected get requestTimeoutMs(): number {
        return this._timeout > 0 ? this._timeout : REQUEST_TIMEOUT_MS;
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
     * Create request body. `options` carries this request's generation params —
     * implementations must not store them on the instance.
     */
    protected abstract createRequestBody(prompt: string, options?: AIRequestOptions): JsonObject;

    /**
     * Extract content from API response
     */
    protected abstract extractContent(response: JsonObject): string;
}
