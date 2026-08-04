/**
 * API endpoints, model defaults, and curated model lists per provider.
 *
 * Design principles:
 * - Default models are the best available for note generation (quality + speed + cost)
 * - Model lists are curated, not exhaustive — only competent, tested models
 * - Models ordered by quality within each provider (best first)
 * - Free models marked with `free: true` for UI filtering
 */

export const API_ENDPOINTS = {
    /** Gemini endpoint template — model name injected dynamically */
    GEMINI_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
    GROQ: 'https://api.groq.com/openai/v1/chat/completions',
    HUGGINGFACE: 'https://router.huggingface.co/hf-inference/models',
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
    YOUTUBE_OEMBED: 'https://www.youtube.com/oembed',
} as const;

/**
 * Optimal default model per provider.
 * These are chosen for the best balance of quality, speed, and cost for note generation.
 */
export const AI_MODELS = {
    GEMINI: 'gemini-2.5-flash',
    GROQ: 'llama-3.3-70b-versatile',
    HUGGINGFACE: 'Qwen/Qwen3-8B',
    OPENROUTER: 'google/gemini-2.5-flash-preview-05-20',
    OLLAMA_CLOUD: 'deepseek-v3.2',
    OLLAMA_LOCAL: 'qwen3:14b',
} as const;

export type ProviderModelEntry = {
    name: string;
    supportsAudioVideo?: boolean;
    free?: boolean;
};

/**
 * Curated model lists per provider.
 * Ordered by quality (best models first). Only includes competent, tested models.
 * Removed bloat — no deprecated, redundant, or rarely-used models.
 */
export const PROVIDER_MODEL_OPTIONS: Record<string, ProviderModelEntry[]> = {
    'Google Gemini': [
        // Gemini 2.5 Flash — Best price/performance (RECOMMENDED)
        { name: 'gemini-2.5-flash', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-preview-05-20', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-lite-preview-06-17', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-exp:free', supportsAudioVideo: true, free: true },

        // Gemini 2.5 Pro — Highest quality
        { name: 'gemini-2.5-pro', supportsAudioVideo: true },
        { name: 'gemini-2.5-pro-preview-06-05', supportsAudioVideo: true },

        // Gemini 2.0 Flash — Fast and capable
        { name: 'gemini-2.0-flash', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-lite', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-thinking-exp:free', supportsAudioVideo: true, free: true },

        // Gemini 2.0 Pro
        { name: 'gemini-2.0-pro', supportsAudioVideo: true },

        // Gemini 1.5 — Stable fallback
        { name: 'gemini-1.5-pro', supportsAudioVideo: true },
        { name: 'gemini-1.5-flash', supportsAudioVideo: true },
    ],

    Groq: [
        // Llama 3.3 — Latest and best on Groq (RECOMMENDED)
        { name: 'llama-3.3-70b-versatile' },
        { name: 'llama-3.3-8b-instant' },

        // Llama 3.1 — Strong alternative
        { name: 'llama-3.1-70b-versatile' },
        { name: 'llama-3.1-8b-instant' },

        // DeepSeek R1 — Reasoning
        { name: 'deepseek-r1-distill-llama-70b' },
        { name: 'deepseek-r1-distill-qwen-32b' },

        // Qwen — Multilingual + code
        { name: 'qwen-2.5-32b' },
        { name: 'qwen-2.5-coder-32b' },

        // Mixtral — Long context
        { name: 'mixtral-8x7b-32768' },

        // Gemma
        { name: 'gemma2-9b-it' },
    ],

    Ollama: [
        // Qwen 3 — Best local models (RECOMMENDED)
        { name: 'qwen3:32b' },
        { name: 'qwen3:14b' },
        { name: 'qwen3:8b' },
        { name: 'qwen3-coder:32b' },
        { name: 'qwen3-coder:480b-cloud' },

        // DeepSeek v3.2 — Latest reasoning
        { name: 'deepseek-v3.2' },
        { name: 'deepseek-v3.2:70b' },
        { name: 'deepseek-v3.2:32b' },
        { name: 'deepseek-v3.2:coder' },

        // DeepSeek R1 — Reasoning
        { name: 'deepseek-r1:70b' },
        { name: 'deepseek-r1:32b' },
        { name: 'deepseek-r1:14b' },
        { name: 'deepseek-r1-distill-llama-70b' },

        // Llama 3.2 — Latest Meta
        { name: 'llama3.2' },
        { name: 'llama3.2:3b' },
        { name: 'llama3.2-vision' },
        { name: 'llama3.2-vision:90b' },
        { name: 'llama3.2-vision:11b' },

        // Llama 3.1
        { name: 'llama3.1:70b' },
        { name: 'llama3.1:8b' },

        // Qwen 2.5
        { name: 'qwen2.5:72b' },
        { name: 'qwen2.5:32b' },
        { name: 'qwen2.5:14b' },
        { name: 'qwen2.5-coder:32b' },
        { name: 'qwen2-vl' },

        // Gemma
        { name: 'gemma2:27b' },
        { name: 'gemma2:9b' },

        // Multimodal Vision
        { name: 'llava-llama3' },
        { name: 'minicpm-v:2.6' },
        { name: 'moondream' },

        // Code
        { name: 'codellama:34b' },
        { name: 'starcoder2:15b' },

        // Misc
        { name: 'mistral:7b' },
        { name: 'mixtral:8x7b' },
        { name: 'phi3:14b' },
        { name: 'command-r' },
    ],

    'Ollama Cloud': [
        // DeepSeek v3.2 — Best on cloud (RECOMMENDED)
        { name: 'deepseek-v3.2' },
        { name: 'deepseek-v3.2:70b' },
        { name: 'deepseek-v3.2:32b' },
        { name: 'deepseek-v3.2:coder' },

        // DeepSeek R1
        { name: 'deepseek-r1:70b' },
        { name: 'deepseek-r1:32b' },

        // Qwen 3 — Cloud optimized
        { name: 'qwen3-coder:480b-cloud' },
        { name: 'qwen3:32b' },
        { name: 'qwen3:14b' },

        // Llama 3.2
        { name: 'llama3.2-vision:90b' },
        { name: 'llama3.2' },

        // Mixtral
        { name: 'mixtral:8x22b' },
        { name: 'mixtral:8x7b' },
    ],

    'Hugging Face': [
        // Qwen 3 — Best free inference (RECOMMENDED)
        { name: 'Qwen/Qwen3-8B' },
        { name: 'Qwen/Qwen3-4B-Instruct-2507' },

        // Llama 3.2 — Fast and capable
        { name: 'meta-llama/Llama-3.2-3B-Instruct' },
        { name: 'meta-llama/Llama-3.2-1B-Instruct' },

        // Qwen 2.5
        { name: 'Qwen/Qwen2.5-7B-Instruct' },

        // Vision-Language Models
        { name: 'Qwen/Qwen2-VL-7B-Instruct', supportsAudioVideo: true },
        { name: 'meta-llama/Llama-3.2-11B-Vision-Instruct', supportsAudioVideo: true },
        { name: 'microsoft/Phi-3.5-vision-instruct', supportsAudioVideo: true },
        { name: 'HuggingFaceM4/idefics2-8b', supportsAudioVideo: true },

        // Reasoning
        { name: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B' },

        // General
        { name: 'mistralai/Mistral-7B-Instruct-v0.2' },
    ],

    OpenRouter: [
        // Gemini 2.5 Flash — Best value on OpenRouter (RECOMMENDED)
        { name: 'google/gemini-2.5-flash-preview-05-20', supportsAudioVideo: true },
        { name: 'google/gemini-2.5-pro-exp:free', supportsAudioVideo: true, free: true },
        { name: 'google/gemini-2.5-flash-exp:free', supportsAudioVideo: true, free: true },

        // Claude 3.5 — Premium quality
        { name: 'anthropic/claude-sonnet-4', supportsAudioVideo: true },
        { name: 'anthropic/claude-3.5-sonnet', supportsAudioVideo: true },
        { name: 'anthropic/claude-3.5-haiku', supportsAudioVideo: true },

        // GPT-4o — OpenAI flagship
        { name: 'openai/gpt-4o', supportsAudioVideo: true },
        { name: 'openai/gpt-4o-mini', supportsAudioVideo: true },

        // Llama 3.3 — Open weights, strong performance
        { name: 'meta-llama/llama-3.3-70b-instruct' },
        { name: 'meta-llama/llama-3.2-90b-vision-instruct', supportsAudioVideo: true },
        { name: 'meta-llama/llama-3.2-11b-vision-instruct', supportsAudioVideo: true },

        // DeepSeek — Reasoning
        { name: 'deepseek/deepseek-r1' },
        { name: 'deepseek/deepseek-chat' },

        // Qwen — Multilingual + code
        { name: 'qwen/qwen-2.5-72b-instruct' },
        { name: 'qwen/qwq-32b-preview' },
        { name: 'qwen/qwen-2-vl-72b-instruct', supportsAudioVideo: true },

        // Mistral
        { name: 'mistralai/mistral-large' },

        // Free tier
        { name: 'meta-llama/llama-3.1-8b-instruct:free', free: true },
        { name: 'google/gemma-2-9b-it:free', free: true },
        { name: 'qwen/qwen-2.5-7b-instruct:free', free: true },
    ],
};

/** Provider model list URLs for dynamic fetching */
export const PROVIDER_MODEL_LIST_URLS: Record<string, string> = {
    'Google Gemini': 'https://generativelanguage.googleapis.com/v1beta/models',
    Groq: 'https://api.groq.com/openai/v1/models',
    Ollama: 'http://localhost:11434',
    'Ollama Cloud': 'https://ollama.com',
    'Hugging Face': 'https://huggingface.co/models',
    OpenRouter: 'https://openrouter.ai/api/v1/models',
};

/** Regex patterns for extracting model names from provider APIs */
export const PROVIDER_MODEL_REGEX: Record<string, RegExp> = {
    'Google Gemini': /gemini[-_.]?\d+(?:\.\d+)?(?:-[a-z0-9-]+)?/gi,
    Groq: /[a-z][-a-z0-9]+/gi,
    Ollama: /[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g,
    'Ollama Cloud': /[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g,
    'Hugging Face': /[\w-]+\/[\w-.]+/g,
    OpenRouter: /[\w-]+\/[\w-.:]+/g,
};

export const API_LIMITS = {
    MAX_TOKENS: 8192,
    TEMPERATURE: 0.5,
    DESCRIPTION_MAX_LENGTH: 1000,
    TITLE_MAX_LENGTH: 100,
} as const;

export const TIMEOUTS = {
    FILE_CREATION_WAIT: 300,
    MODAL_DELAY: 100,
    FALLBACK_MODAL_CHECK: 500,
    FOCUS_DELAY: 150,
    REPAINT_DELAY: 50,
} as const;
