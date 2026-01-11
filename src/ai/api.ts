/**
 * API endpoints and configuration constants
 */

export const API_ENDPOINTS = {
    GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    GROQ: 'https://api.groq.com/openai/v1/chat/completions',
    HUGGINGFACE: 'https://api-inference.huggingface.co/models',
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions',
    YOUTUBE_OEMBED: 'https://www.youtube.com/oembed',
    CORS_PROXY: 'https://api.allorigins.win/raw',
} as const;

export const AI_MODELS = {
    GEMINI: 'gemini-2.0-flash',
    GROQ: 'llama-3.3-70b-versatile',
    HUGGINGFACE: 'Qwen/Qwen3-8B',
    OPENROUTER: 'meta-llama/llama-3.1-8b-instruct:free',
} as const;

// Known model options per provider (used to populate model selector in UI)
// Each entry is now an object with `name` and optional metadata like `supportsAudioVideo`.
// Models are updated to reflect the latest available versions (Nov 2024 - Nov 2025).
export type ProviderModelEntry = { name: string; supportsAudioVideo?: boolean };
export const PROVIDER_MODEL_OPTIONS: Record<string, ProviderModelEntry[]> = {
    'Google Gemini': [
        // Gemini 3 series (NEW - Latest from November/December 2025)
        { name: 'gemini-3-pro-preview', supportsAudioVideo: true },
        { name: 'gemini-3-pro-image-preview', supportsAudioVideo: false },
        { name: 'gemini-3-flash-preview', supportsAudioVideo: true },

        // Gemini 2.5 Pro series (state-of-the-art thinking model)
        { name: 'gemini-2.5-pro', supportsAudioVideo: true },
        { name: 'gemini-2.5-pro-preview-tts', supportsAudioVideo: false },

        // Gemini 2.5 Flash series (best price-performance)
        { name: 'gemini-2.5-flash', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-preview-09-2025', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-lite', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-lite-preview-09-2025', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-exp:free', supportsAudioVideo: true },

        // Gemini 2.5 Flash specialized variants
        { name: 'gemini-2.5-flash-image', supportsAudioVideo: false },
        { name: 'gemini-2.5-flash-native-audio-preview-12-2025', supportsAudioVideo: true },
        { name: 'gemini-2.5-flash-preview-tts', supportsAudioVideo: false },

        // Gemini 2.0 Flash series (second generation)
        { name: 'gemini-2.0-flash', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-001', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-exp', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-lite', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-lite-001', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-thinking-exp:free', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-thinking-exp-01-21', supportsAudioVideo: true },
        { name: 'gemini-2.0-flash-preview-image-generation', supportsAudioVideo: false },

        // Gemini 2.0 Pro series
        { name: 'gemini-2.0-pro', supportsAudioVideo: true },
        { name: 'gemini-2.0-pro-exp', supportsAudioVideo: true },

        // Gemini 1.5 series (stable workhorse)
        { name: 'gemini-1.5-pro', supportsAudioVideo: true },
        { name: 'gemini-1.5-pro-001', supportsAudioVideo: true },
        { name: 'gemini-1.5-pro-002', supportsAudioVideo: true },
        { name: 'gemini-1.5-flash', supportsAudioVideo: true },
        { name: 'gemini-1.5-flash-001', supportsAudioVideo: true },
        { name: 'gemini-1.5-flash-002', supportsAudioVideo: true },
        { name: 'gemini-1.5-flash-8b', supportsAudioVideo: true },
        { name: 'gemini-1.5-flash-exp:free', supportsAudioVideo: true },

        // Experimental models
        { name: 'gemini-exp-1206', supportsAudioVideo: true },
        { name: 'gemini-exp-latest', supportsAudioVideo: true },
    ],
    Groq: [
        // Llama 3.3 Series (latest)
        { name: 'llama-3.3-70b-versatile' },
        { name: 'llama-3.3-8b-instant' },

        // Llama 3.1 Series
        { name: 'llama-3.1-8b-instant' },
        { name: 'llama-3.1-70b-versatile' },

        // DeepSeek R1 Series (latest reasoning models)
        { name: 'deepseek-r1' },
        { name: 'deepseek-r1-distill-llama-70b' },
        { name: 'deepseek-r1-distill-qwen-32b' },

        // Mixtral Models
        { name: 'mixtral-8x7b-32768' },

        // Gemma Models
        { name: 'gemma2-9b-it' },

        // Qwen Models
        { name: 'qwen-2.5-32b' },
        { name: 'qwen-2.5-coder-32b' },
    ],
    Ollama: [
        // DeepSeek v3.2 Series (NEW - Latest reasoning models)
        { name: 'deepseek-v3.2', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:latest', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:32b', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:70b', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:instruct', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:coder', supportsAudioVideo: true },
        // Llama 3.2 Series (Latest)
        { name: 'llama3.2', supportsAudioVideo: true },
        { name: 'llama3.2:3b', supportsAudioVideo: true },
        { name: 'llama3.2:1b', supportsAudioVideo: true },
        { name: 'llama3.2-vision', supportsAudioVideo: true },
        { name: 'llama3.2-vision:11b', supportsAudioVideo: true },
        { name: 'llama3.2-vision:90b', supportsAudioVideo: true },
        // Llama 3.1 Series
        { name: 'llama3.1', supportsAudioVideo: true },
        { name: 'llama3.1:405b', supportsAudioVideo: true },
        { name: 'llama3.1:70b', supportsAudioVideo: true },
        { name: 'llama3.1:8b', supportsAudioVideo: true },
        { name: 'llama3.1-instant', supportsAudioVideo: true },
        // Llama 3.0 Series
        { name: 'llama3', supportsAudioVideo: true },
        { name: 'llama3:70b', supportsAudioVideo: true },
        { name: 'llama3:8b', supportsAudioVideo: true },
        // Llama 2 Series
        { name: 'llama2:70b', supportsAudioVideo: true },
        { name: 'llama2:13b', supportsAudioVideo: true },
        { name: 'llama2:7b', supportsAudioVideo: true },
        // Mistral Series
        { name: 'mistral', supportsAudioVideo: true },
        { name: 'mistral:7b', supportsAudioVideo: true },
        { name: 'mistral:7b-instruct-v0.3', supportsAudioVideo: true },
        { name: 'mixtral', supportsAudioVideo: true },
        { name: 'mixtral:8x7b', supportsAudioVideo: true },
        { name: 'mixtral:8x22b', supportsAudioVideo: true },
        { name: 'mixtral:8x7b-instruct-v0.1', supportsAudioVideo: true },
        // Qwen Series
        { name: 'qwen2', supportsAudioVideo: true },
        { name: 'qwen2:72b', supportsAudioVideo: true },
        { name: 'qwen2:7b', supportsAudioVideo: true },
        { name: 'qwen2:1.5b', supportsAudioVideo: true },
        { name: 'qwen2:0.5b', supportsAudioVideo: true },
        { name: 'qwen2-vl', supportsAudioVideo: true },
        { name: 'qwen2.5', supportsAudioVideo: true },
        { name: 'qwen2.5:72b', supportsAudioVideo: true },
        { name: 'qwen2.5:32b', supportsAudioVideo: true },
        { name: 'qwen2.5:14b', supportsAudioVideo: true },
        { name: 'qwen2.5:7b', supportsAudioVideo: true },
        { name: 'qwen2.5:3b', supportsAudioVideo: true },
        { name: 'qwen2.5-coder:32b', supportsAudioVideo: true },
        { name: 'qwen3', supportsAudioVideo: true },
        { name: 'qwen3:32b', supportsAudioVideo: true },
        { name: 'qwen3:14b', supportsAudioVideo: true },
        { name: 'qwen3:8b', supportsAudioVideo: true },
        { name: 'qwen3:4b', supportsAudioVideo: true },
        { name: 'qwen3-coder', supportsAudioVideo: true },
        { name: 'qwen3-coder:32b', supportsAudioVideo: true },
        { name: 'qwen3-coder:14b', supportsAudioVideo: true },
        { name: 'qwen3-coder:480b-cloud', supportsAudioVideo: true },
        // Gemma Series
        { name: 'gemma2', supportsAudioVideo: true },
        { name: 'gemma2:27b', supportsAudioVideo: true },
        { name: 'gemma2:9b', supportsAudioVideo: true },
        { name: 'gemma', supportsAudioVideo: true },
        { name: 'gemma:7b', supportsAudioVideo: true },
        { name: 'gemma:2b', supportsAudioVideo: true },
        // Phi Series
        { name: 'phi3', supportsAudioVideo: true },
        { name: 'phi3:14b', supportsAudioVideo: true },
        { name: 'phi3:mini', supportsAudioVideo: true },
        { name: 'phi3:4k', supportsAudioVideo: true },
        { name: 'phi3-vision', supportsAudioVideo: true },
        { name: 'phi3.5', supportsAudioVideo: true },
        { name: 'phi3.5:3.8b', supportsAudioVideo: true },
        { name: 'phi3.5-instruct', supportsAudioVideo: true },
        // DeepSeek Series
        { name: 'deepseek-r1', supportsAudioVideo: true },
        { name: 'deepseek-r1:32b', supportsAudioVideo: true },
        { name: 'deepseek-r1:14b', supportsAudioVideo: true },
        { name: 'deepseek-r1:8b', supportsAudioVideo: true },
        { name: 'deepseek-r1-distill-llama-70b', supportsAudioVideo: true },
        { name: 'deepseek-r1-distill-qwen-32b', supportsAudioVideo: true },
        { name: 'deepseek-coder-v2', supportsAudioVideo: true },
        { name: 'deepseek-coder', supportsAudioVideo: true },
        { name: 'deepseek-coder-v2:16b', supportsAudioVideo: true },
        // Multimodal Vision Models
        { name: 'llava', supportsAudioVideo: true },
        { name: 'llava:13b', supportsAudioVideo: true },
        { name: 'llava:7b', supportsAudioVideo: true },
        { name: 'llava-llama3', supportsAudioVideo: true },
        { name: 'llava-llama3:8b', supportsAudioVideo: true },
        { name: 'bakllava', supportsAudioVideo: true },
        { name: 'moondream', supportsAudioVideo: true },
        { name: 'moondream:2b', supportsAudioVideo: true },
        { name: 'nvidia-llama3-1-vision', supportsAudioVideo: true },
        { name: 'minicpm-v', supportsAudioVideo: true },
        { name: 'minicpm-v:2.6', supportsAudioVideo: true },
        { name: 'minicpm-l', supportsAudioVideo: true },
        // Code Models
        { name: 'codellama', supportsAudioVideo: true },
        { name: 'codellama:13b', supportsAudioVideo: true },
        { name: 'codellama:34b', supportsAudioVideo: true },
        { name: 'codellama:70b', supportsAudioVideo: true },
        { name: 'codegemma', supportsAudioVideo: true },
        { name: 'codegemma:7b', supportsAudioVideo: true },
        { name: 'starcoder2', supportsAudioVideo: true },
        { name: 'starcoder2:15b', supportsAudioVideo: true },
        { name: 'starcoder2:7b', supportsAudioVideo: true },
        // Command & Chat Models
        { name: 'command-r', supportsAudioVideo: true },
        { name: 'command-r:35b', supportsAudioVideo: true },
        { name: 'command-r:7b', supportsAudioVideo: true },
        { name: 'command-r-plus', supportsAudioVideo: true },
        { name: 'command-r-zephyr', supportsAudioVideo: true },
        { name: 'neural-chat', supportsAudioVideo: true },
        { name: 'openchat', supportsAudioVideo: true },
        { name: 'openchat:7b', supportsAudioVideo: true },
        { name: 'openchat:8b', supportsAudioVideo: true },
        { name: 'wizardlm2', supportsAudioVideo: true },
        { name: 'wizardlm2:8x22b', supportsAudioVideo: true },
        { name: 'wizardlm2:7b', supportsAudioVideo: true },
        { name: 'yi', supportsAudioVideo: true },
        { name: 'yi:34b', supportsAudioVideo: true },
        { name: 'yi:6b', supportsAudioVideo: true },
        { name: 'yi:1.5-9b', supportsAudioVideo: true },
    ],
    'Ollama Cloud': [
        // DeepSeek v3.2 Series (NEW - Latest reasoning models on Ollama Cloud)
        { name: 'deepseek-v3.2', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:latest', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:32b', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:70b', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:instruct', supportsAudioVideo: true },
        { name: 'deepseek-v3.2:coder', supportsAudioVideo: true },
        // DeepSeek R1 Series (Reasoning models)
        { name: 'deepseek-r1', supportsAudioVideo: true },
        { name: 'deepseek-r1:32b', supportsAudioVideo: true },
        { name: 'deepseek-r1:70b', supportsAudioVideo: true },
        { name: 'deepseek-r1:distill-llama-70b', supportsAudioVideo: true },
        { name: 'deepseek-r1:distill-qwen-32b', supportsAudioVideo: true },
        // Llama 3.2 Series (Latest)
        { name: 'llama3.2', supportsAudioVideo: true },
        { name: 'llama3.2:3b', supportsAudioVideo: true },
        { name: 'llama3.2:1b', supportsAudioVideo: true },
        { name: 'llama3.2-vision', supportsAudioVideo: true },
        { name: 'llama3.2-vision:11b', supportsAudioVideo: true },
        { name: 'llama3.2-vision:90b', supportsAudioVideo: true },
        // Qwen 3 Series (Cloud optimized)
        { name: 'qwen3:32b', supportsAudioVideo: true },
        { name: 'qwen3:14b', supportsAudioVideo: true },
        { name: 'qwen3:8b', supportsAudioVideo: true },
        { name: 'qwen3-coder:480b-cloud', supportsAudioVideo: true },
        { name: 'qwen3-coder:32b', supportsAudioVideo: true },
        // Mixtral Series (Cloud)
        { name: 'mixtral:8x7b', supportsAudioVideo: true },
        { name: 'mixtral:8x22b', supportsAudioVideo: true },
        { name: 'mixtral:8x7b-instruct-v0.1', supportsAudioVideo: true },
    ],
    'Hugging Face': [
        // Multimodal Vision-Language Models
        { name: 'Qwen/Qwen2-VL-7B-Instruct', supportsAudioVideo: true },
        { name: 'Qwen/Qwen2-VL-2B-Instruct', supportsAudioVideo: true },
        { name: 'meta-llama/Llama-3.2-11B-Vision-Instruct', supportsAudioVideo: true },
        { name: 'meta-llama/Llama-3.2-90B-Vision-Instruct', supportsAudioVideo: true },
        { name: 'microsoft/Phi-3.5-vision-instruct', supportsAudioVideo: true },
        { name: 'google/paligemma-3b-mix-448', supportsAudioVideo: true },
        { name: 'HuggingFaceM4/idefics2-8b', supportsAudioVideo: true },

        // High-quality Text Models
        { name: 'Qwen/Qwen3-8B' },
        { name: 'Qwen/Qwen2.5-7B-Instruct' },
        { name: 'Qwen/Qwen3-4B-Instruct-2507' },
        { name: 'meta-llama/Llama-3.2-3B-Instruct' },
        { name: 'meta-llama/Llama-3.2-1B-Instruct' },
        { name: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B' },
        { name: 'mistralai/Mistral-7B-Instruct-v0.2' },

        // Multimodal Specialist Models
        { name: 'llava-hf/llava-1.5-7b', supportsAudioVideo: true },
        { name: 'llava-hf/llava-1.5-13b', supportsAudioVideo: true },
    ],
    OpenRouter: [
        // Free tier models
        { name: 'meta-llama/llama-3.1-8b-instruct:free' },
        { name: 'google/gemma-2-9b-it:free' },
        { name: 'qwen/qwen-2.5-7b-instruct:free' },

        // Latest multimodal models (vision + text)
        { name: 'anthropic/claude-3.5-sonnet', supportsAudioVideo: true },
        { name: 'anthropic/claude-3.5-sonnet:beta', supportsAudioVideo: true },
        { name: 'anthropic/claude-3.5-haiku', supportsAudioVideo: true },
        { name: 'anthropic/claude-3.5-haiku:beta', supportsAudioVideo: true },
        { name: 'openai/gpt-4o', supportsAudioVideo: true },
        { name: 'openai/gpt-4o-mini', supportsAudioVideo: true },
        { name: 'openai/o1-mini' },
        { name: 'openai/o1-preview' },
        { name: 'google/gemini-2.5-pro-exp:free', supportsAudioVideo: true },
        { name: 'google/gemini-2.5-flash-exp:free', supportsAudioVideo: true },
        { name: 'google/gemini-2.0-flash-exp:free', supportsAudioVideo: true },
        { name: 'meta-llama/llama-3.2-11b-vision-instruct', supportsAudioVideo: true },
        { name: 'meta-llama/llama-3.2-90b-vision-instruct', supportsAudioVideo: true },
        { name: 'qwen/qwen-2-vl-7b-instruct', supportsAudioVideo: true },
        { name: 'qwen/qwen-2-vl-72b-instruct', supportsAudioVideo: true },
        { name: 'qwen/qwen-2.5-72b-instruct' },
        { name: 'qwen/qwq-32b-preview' },

        // High-performance text models
        { name: 'meta-llama/llama-3.3-70b-instruct' },
        { name: 'meta-llama/llama-3.1-70b-instruct' },
        { name: 'meta-llama/llama-3.1-8b-instruct' },
        { name: 'mistralai/mistral-large' },
        { name: 'deepseek/deepseek-r1' },
        { name: 'deepseek/deepseek-chat' },
        { name: 'cohere/command-r-plus' },
        { name: 'cohere/command-r-08-2024' },
    ],
};

// Optional: provider pages to attempt to scrape for latest model names (best-effort)
export const PROVIDER_MODEL_LIST_URLS: Record<string, string> = {
    'Google Gemini': 'https://developers.generativeai.google/models',
    Groq: 'https://groq.com',
    Ollama: 'http://localhost:11434',
    'Ollama Cloud': 'https://ollama.com',
    'Hugging Face': 'https://huggingface.co/models',
    OpenRouter: 'https://openrouter.ai/models',
};

// Simple regex patterns to try to extract model-like tokens from provider pages
export const PROVIDER_MODEL_REGEX: Record<string, RegExp> = {
    'Google Gemini': /gemini[-_.]?\d+(?:\.\d+)?(?:-[a-z0-9-]+)?/gi,
    Groq: /llama[-_.]?\d+(?:\.\d+)?(?:-[a-z0-9-]+)?/gi,
    Ollama: /[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g,
    'Ollama Cloud': /[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g,
    'Hugging Face': /[\w-]+\/[\w-.]+/g,
    OpenRouter: /[\w-]+\/[\w-.:]+/g,
};

export const API_LIMITS = {
    MAX_TOKENS: 8000, // Increased from 2000 to handle comprehensive tutorials
    TEMPERATURE: 0.7,
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
