
/**
 * API endpoints and configuration constants
 */

export const API_ENDPOINTS = {
    GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
    GROQ: 'https://api.groq.com/openai/v1/chat/completions',
    HUGGINGFACE: 'https://api-inference.huggingface.co/models',
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
    YOUTUBE_OEMBED: 'https://www.youtube.com/oembed',
    CORS_PROXY: 'https://api.allorigins.win/raw'
} as const;

export const AI_MODELS = {
    GEMINI: 'gemini-2.5-pro',
    GROQ: 'llama-3.3-70b-versatile',
    HUGGINGFACE: 'Qwen/Qwen3-8B',
    OPENROUTER: 'meta-llama/llama-3.1-8b-instruct:free'
} as const;

// Known model options per provider (used to populate model selector in UI)
// Each entry is now an object with `name` and optional metadata like `supportsAudioVideo`.
// Models are updated to reflect the latest available versions (Nov 2024 - Nov 2025).
export type ProviderModelEntry = { name: string; supportsAudioVideo?: boolean };
export const PROVIDER_MODEL_OPTIONS: Record<string, ProviderModelEntry[]> = {
    'Google Gemini': [
        // Gemini 2.5 series (latest, all support multimodal video analysis)
        { name: 'gemini-2.5-pro', supportsAudioVideo: true },
        { name: 'gemini-2.5-pro-tts', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-lite', supportsAudioVideo: true },
        // Gemini 2.0 series
        { name: 'gemini-2.0-pro', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash' },
        { name: 'gemini-2.0-flash-lite' },
        // Gemini 1.5 series
        { name: 'gemini-1.5-pro' },
        { name: 'gemini-1.5-flash' }
    ],
    'Groq': [
        { name: 'llama-4-maverick-17b-128e-instruct' },
        { name: 'llama-4-scout-17b-16e-instruct' },
        { name: 'llama-3.3-70b-versatile' },
        { name: 'llama-3.1-8b-instant' }
    ],
    'Ollama': [
        { name: 'qwen3-coder:480b-cloud' },
        { name: 'llama3.2' },
        { name: 'llama3.1' },
        { name: 'mistral' },
        { name: 'mixtral' },
        { name: 'gemma2' },
        { name: 'phi3' },
        { name: 'qwen2' },
        { name: 'command-r' }
    ],
    'Hugging Face': [
        // Models verified to work with HuggingFace Inference API (Dec 2025)
        { name: 'Qwen/Qwen3-8B' },
        { name: 'Qwen/Qwen2.5-7B-Instruct' },
        { name: 'Qwen/Qwen3-4B-Instruct-2507' },
        { name: 'meta-llama/Llama-3.2-3B-Instruct' },
        { name: 'meta-llama/Llama-3.2-1B-Instruct' },
        { name: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B' },
        { name: 'mistralai/Mistral-7B-Instruct-v0.2' }
    ],
    'OpenRouter': [
        // Free tier models
        { name: 'meta-llama/llama-3.1-8b-instruct:free' },
        { name: 'google/gemma-2-9b-it:free' },
        { name: 'qwen/qwen-2-7b-instruct:free' },
        // Paid but affordable
        { name: 'anthropic/claude-3.5-sonnet' },
        { name: 'openai/gpt-4o-mini' },
        { name: 'openai/gpt-4o' },
        { name: 'google/gemini-pro-1.5' },
        { name: 'meta-llama/llama-3.1-70b-instruct' },
        { name: 'mistralai/mistral-large' }
    ]
};

// Optional: provider pages to attempt to scrape for latest model names (best-effort)
export const PROVIDER_MODEL_LIST_URLS: Record<string, string> = {
    'Google Gemini': 'https://developers.generativeai.google/models',
    'Groq': 'https://groq.com',
    'Ollama': 'http://localhost:11434',
    'Hugging Face': 'https://huggingface.co/models',
    'OpenRouter': 'https://openrouter.ai/models'
};

// Simple regex patterns to try to extract model-like tokens from provider pages
export const PROVIDER_MODEL_REGEX: Record<string, RegExp> = {
    'Google Gemini': /gemini[-_\.]?\d+(?:\.\d+)?(?:-[a-z0-9\-]+)?/gi,
    'Groq': /llama[-_\.]?\d+(?:\.\d+)?(?:-[a-z0-9\-]+)?/gi,
    'Ollama': /[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g,
    'Hugging Face': /[\w-]+\/[\w\-\.]+/g,
    'OpenRouter': /[\w-]+\/[\w\-\.:]+/g
};

export const API_LIMITS = {
    MAX_TOKENS: 8000,  // Increased from 2000 to handle comprehensive tutorials
    TEMPERATURE: 0.7,
    DESCRIPTION_MAX_LENGTH: 1000,
    TITLE_MAX_LENGTH: 100
} as const;

export const TIMEOUTS = {
    FILE_CREATION_WAIT: 300,
    MODAL_DELAY: 100,
    FALLBACK_MODAL_CHECK: 500,
    FOCUS_DELAY: 150,
    REPAINT_DELAY: 50
} as const;
