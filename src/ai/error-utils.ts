/**
 * Shared error formatting utilities for AI providers
 */

/**
 * Extract retry time from error message
 */
function extractRetryTime(message: string): string {
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
 * Check if message contains any of the patterns
 */
function containsAny(message: string, patterns: string[]): boolean {
    return patterns.some(p => message.includes(p));
}

/**
 * Format quota/limit errors consistently across providers
 */
export function formatQuotaError(rawMessage: string, provider: string): string {
    const retryInfo = extractRetryTime(rawMessage);
    const msg = rawMessage.toLowerCase();

    if (containsAny(msg, ['free tier', 'free_tier', 'limit: 0'])) {
        return `${provider} free tier quota exhausted.${retryInfo} Upgrade your plan or wait for quota reset.`;
    }

    if (containsAny(msg, ['tokens per minute', 'tokens per second'])) {
        return `${provider} rate limit reached.${retryInfo} Try a shorter video or wait.`;
    }

    if (containsAny(msg, ['requests per minute', 'requests per second'])) {
        return `${provider} request limit reached.${retryInfo}`;
    }

    if (containsAny(msg, ['quota exceeded', 'quota'])) {
        return `${provider} API quota exceeded.${retryInfo} Check your usage.`;
    }

    if (msg.includes('rate limit')) {
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
