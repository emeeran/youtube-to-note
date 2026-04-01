/**
 * Shared error formatting utilities for AI providers
 */

/**
 * Extract retry time from error message
 */
function extractRetryTime(message: string): string {
    const patterns = [
        /retry in ([\d.]+)s/i,
        /retry in ([\d.]+) seconds?/i,
        /(\d+)\s*seconds?/i,
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
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
