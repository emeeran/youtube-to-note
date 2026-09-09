/**
 * API endpoints, model defaults, and curated model lists per provider.
 *
 * Design principles:
 * - Default models are the best available for note generation (quality + speed + cost)
 * - Model lists are curated, not exhaustive — only competent, tested models
 * - Models ordered by quality within each provider (best first)
 */

export const API_ENDPOINTS = {
    /** Gemini endpoint template — model name injected dynamically */
    GEMINI_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
    GROQ: 'https://api.groq.com/openai/v1/chat/completions',
    // HF's OpenAI-compatible router — hf-inference itself no longer serves
    // text-generation models, so the per-model `/hf-inference/models/<id>`
    // path is chat-dead. The router routes to whichever provider is live.
    HUGGINGFACE: 'https://router.huggingface.co/v1/chat/completions',
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
    YOUTUBE_OEMBED: 'https://www.youtube.com/oembed',
} as const;

/**
 * Optimal default model per provider.
 * These are chosen for the best balance of quality, speed, and cost for note generation.
 * Providers decommission models without notice (Groq retired its entire llama-3.x
 * lineup, hf-inference dropped chat entirely) — when a default starts failing with
 * a model error, re-check it against that provider's live model list and update
 * both this map and the curated lists below.
 */
export const AI_MODELS = {
    GEMINI: 'gemini-2.5-flash',
    GROQ: 'openai/gpt-oss-120b',
    HUGGINGFACE: 'Qwen/Qwen3.8-27B',
    OPENROUTER: 'google/gemini-2.5-flash-preview-05-20',
    OLLAMA_CLOUD: 'deepseek-v3.2',
    OLLAMA_LOCAL: 'qwen3:latest',
} as const;

export type ProviderModelEntry = {
    name: string;
    supportsAudioVideo?: boolean;
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
        { name: 'gemini-2.5-flash-exp:free', supportsAudioVideo: true },

        // Gemini 2.5 Pro — Highest quality
        { name: 'gemini-2.5-pro', supportsAudioVideo: true },
        { name: 'gemini-2.5-pro-preview-06-05', supportsAudioVideo: true },

        // Gemini 2.0 Flash — Fast and capable
        { name: 'gemini-2.0-flash', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-lite', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-thinking-exp:free', supportsAudioVideo: true },

        // Gemini 2.0 Pro
        { name: 'gemini-2.0-pro', supportsAudioVideo: true },

        // Gemini 1.5 — Stable fallback
        { name: 'gemini-1.5-pro', supportsAudioVideo: true },
        { name: 'gemini-1.5-flash', supportsAudioVideo: true },
    ],

    Groq: [
        // gpt-oss-120b — OpenAI open-weights on Groq's LPU (RECOMMENDED).
        // Groq retired its whole llama-3.x lineup; this is their current flagship.
        { name: 'openai/gpt-oss-120b' },
        { name: 'openai/gpt-oss-20b' },

        // Qwen 3.x — Multilingual, strong general chat
        { name: 'qwen/qwen3.8-27b' },
        { name: 'qwen/qwen3.6-27b' },

        // Groq compound — tool-using agentic models
        { name: 'groq/compound' },
        { name: 'groq/compound-mini' },
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
        // Models served live by the HF router (verified against /v1/models).
        // hf-inference no longer hosts chat models; the router forwards each
        // request to a partner provider that has the model deployed.

        // Qwen 3.8 — Verified end-to-end via the router (RECOMMENDED)
        { name: 'Qwen/Qwen3.8-27B' },

        // OpenAI open-weights
        { name: 'openai/gpt-oss-120b' },
        { name: 'openai/gpt-oss-20b' },

        // GLM — Fast, strong general chat
        { name: 'zai-org/GLM-5.3-Flash' },

        // Gemma
        { name: 'google/gemma-4-31B-it' },

        // Smaller / cheaper
        { name: 'Qwen/Qwen3.5-9B' },
        { name: 'meta-llama/Llama-3.1-8B-Instruct' },
        { name: 'ibm-granite/granite-4.2-3b' },
    ],

    OpenRouter: [
        // Gemini 2.5 Flash — Best value on OpenRouter (RECOMMENDED)
        { name: 'google/gemini-2.5-flash-preview-05-20', supportsAudioVideo: true },
        { name: 'google/gemini-2.5-pro-exp:free', supportsAudioVideo: true },
        { name: 'google/gemini-2.5-flash-exp:free', supportsAudioVideo: true },

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
        { name: 'meta-llama/llama-3.1-8b-instruct:free' },
        { name: 'google/gemma-2-9b-it:free' },
        { name: 'qwen/qwen-2.5-7b-instruct:free' },
    ],
};

export const TIMEOUTS = {
    FILE_CREATION_WAIT: 300,
    MODAL_DELAY: 100,
    FALLBACK_MODAL_CHECK: 500,
    FOCUS_DELAY: 150,
    REPAINT_DELAY: 50,
} as const;
