/**
 * Shared error formatting / message-sanitizing / request-signal utilities
 * for AI providers
 */

/** Hard timeout applied to auxiliary (model-list) requests. */
export const MODEL_LIST_TIMEOUT_MS = 15000;

/**
 * Hard timeout applied to generation (`process`) requests.
 *
 * Generative calls legitimately run long — a full video transcript can take a
 * while to analyze — so this is deliberately more generous than the model-list
 * ceiling. Without it a hung provider would pin the run (and its modal) forever.
 */
export const REQUEST_TIMEOUT_MS = 60000;

type AbortSignalStatic = typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
    timeout?: (ms: number) => AbortSignal;
};

/**
 * Sanitize a server-controlled message before embedding it in a thrown Error
 * (which may be rendered to the user). Caps length and strips newlines /
 * control characters so a malicious endpoint cannot push arbitrary multi-line
 * content into Obsidian notices.
 */
export function sanitizeRemoteMessage(message: unknown, maxLength = 200): string {
    if (typeof message !== 'string') return '';
    return message
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\x20-\x7E]/g, '')
        .slice(0, maxLength)
        .trim();
}

/**
 * Build the AbortSignal for an outbound request.
 *
 * Combines an optional hard timeout with an optional caller-supplied signal so
 * either one can cancel the request. Returns `undefined` when neither is
 * requested, which leaves the fetch's behavior untouched.
 */
export function createAbortSignal(options: { timeoutMs?: number; signal?: AbortSignal } = {}): AbortSignal | undefined {
    const signalStatic = AbortSignal as AbortSignalStatic;
    const timeoutSignal =
        options.timeoutMs && options.timeoutMs > 0 && typeof signalStatic.timeout === 'function'
            ? signalStatic.timeout(options.timeoutMs)
            : undefined;

    if (!options.signal) return timeoutSignal;
    if (!timeoutSignal) return options.signal;

    if (typeof signalStatic.any === 'function') {
        return signalStatic.any([options.signal, timeoutSignal]);
    }

    // Older runtimes without AbortSignal.any: wire both sources onto one
    // controller. The fallback timer is unref'd so it never holds the process.
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    options.signal.addEventListener('abort', forwardAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    const cancellable = timer as unknown as { unref?: () => void };
    if (typeof cancellable.unref === 'function') {
        cancellable.unref();
    }
    return controller.signal;
}

/** True when a thrown value is the abort produced by a request timeout. */
export function isTimeoutAbort(error: unknown): boolean {
    if (!error) return false;
    const name = (error as { name?: unknown }).name;
    return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * Extract retry time from error message
 */
export function extractRetryTime(message: string): string {
    const patterns = [/retry in ([\d.]+)s/i, /retry in ([\d.]+) seconds?/i, /(\d+)\s*seconds?/i];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match?.[1]) {
            return ` Retry in ${Math.ceil(parseFloat(match[1]))}s.`;
        }
    }
    return '';
}

/**
 * Format quota/limit errors consistently across providers
 */
export function formatQuotaError(rawMessage: string, provider: string): string {
    const retryInfo = extractRetryTime(rawMessage);
    const lowerMessage = rawMessage.toLowerCase();

    // Free tier quota exhausted
    if (lowerMessage.includes('free tier') || lowerMessage.includes('free_tier') || lowerMessage.includes('limit: 0')) {
        return `${provider} free tier quota exhausted.${retryInfo} Upgrade your plan or wait for quota reset.`;
    }

    // Rate limiting (tokens per minute/second)
    if (lowerMessage.includes('tokens per minute') || lowerMessage.includes('tokens per second')) {
        return `${provider} rate limit reached.${retryInfo} Try a shorter video or wait.`;
    }

    // Request rate limiting
    if (lowerMessage.includes('requests per minute') || lowerMessage.includes('requests per second')) {
        return `${provider} request limit reached.${retryInfo}`;
    }

    // General quota exceeded
    if (lowerMessage.includes('quota exceeded') || lowerMessage.includes('quota')) {
        return `${provider} API quota exceeded.${retryInfo} Check your usage.`;
    }

    // Generic rate limit
    if (lowerMessage.includes('rate limit')) {
        return `${provider} rate limit reached.${retryInfo} Wait a moment before retrying.`;
    }

    return `${provider} API limit reached.${retryInfo}`;
}

/**
 * Format HTTP status errors consistently
 */
export function formatHttpError(status: number, provider: string): string {
    switch (status) {
        case 400:
            return `${provider}: Invalid request. Check model configuration.`;
        case 401:
            return `${provider}: Invalid API key. Check your credentials.`;
        case 403:
            return `${provider}: Access denied. Check your API key permissions.`;
        case 404:
            return `${provider}: Model not found. Check the model name.`;
        case 429:
            return `${provider}: Rate limit exceeded. Wait before retrying.`;
        case 500:
        case 502:
        case 503:
            return `${provider}: Service temporarily unavailable. Try again.`;
        default:
            return `${provider}: HTTP error ${status}.`;
    }
}

/**
 * True when a server message says the request exceeded the model's input-token
 * budget (e.g. Gemini's 400 "The input token count exceeds the maximum number
 * of tokens allowed N"). Used to degrade a media-carrying request to text-only.
 */
export function isInputTokenOverflow(message: string): boolean {
    const lowered = message.toLowerCase();
    return lowered.includes('input token count exceeds') || lowered.includes('maximum number of tokens');
}

/** Host of a request URL, for error copy; the raw string when it cannot be parsed. */
export function describeEndpointHost(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/**
 * True for a genuine connection-level failure — the browser's raw
 * "Failed to fetch" TypeError, a DNS miss, a refused socket. Never true for
 * aborts/timeouts (those keep their own wording) or for HTTP status errors.
 */
export function isNetworkFailure(error: unknown): boolean {
    if (!(error instanceof Error) || isTimeoutAbort(error)) return false;
    const lowered = error.message.toLowerCase();
    return [
        'failed to fetch',
        'network error',
        'networkerror',
        'load failed',
        'econnrefused',
        'enotfound',
        'econnreset',
        'fetch failed',
    ].some(fragment => lowered.includes(fragment));
}
