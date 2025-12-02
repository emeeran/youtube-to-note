/**
 * AI Constants - Re-exports from api.ts for backward compatibility
 * This file provides the constants that AI providers expect to import from './constants'
 */

// Re-export API endpoints and models from api.ts
export {
    API_ENDPOINTS,
    AI_MODELS,
    PROVIDER_MODEL_OPTIONS,
    PROVIDER_MODEL_LIST_URLS,
    PROVIDER_MODEL_REGEX,
    API_LIMITS,
    TIMEOUTS
} from './api';

// Additional AI-specific constants can be defined here
export const AI_PROVIDERS = {
    GEMINI: 'Google Gemini',
    GROQ: 'Groq',
    OLLAMA: 'Ollama'
} as const;

export const AI_ERROR_CODES = {
    INVALID_API_KEY: 'INVALID_API_KEY',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    PROCESSING_FAILED: 'PROCESSING_FAILED'
} as const;

export type ProviderModelEntry = {
    name: string;
    supportsAudioVideo?: boolean;
};