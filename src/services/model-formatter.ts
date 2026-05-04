/**
 * Model name formatting service
 * Converts raw model IDs into human-readable display names
 * using pattern matching and a curated lookup table.
 */

/** Curated display name overrides for well-known models */
const MODEL_DISPLAY_OVERRIDES: Readonly<Record<string, string>> = {
    // Gemini
    'gemini-2.5-pro': 'Gemini Pro 2.5',
    'gemini-2.5-flash': 'Gemini Flash 2.5',
    'gemini-1.5-pro': 'Gemini Pro 1.5',
    'gemini-1.5-flash': 'Gemini Flash 1.5',
    'gemini-2.0-flash': 'Gemini Flash 2.0',

    // DeepSeek
    'deepseek-r1:32b': 'DeepSeek R1 32B',
    'deepseek-v3.2': 'DeepSeek v3.2',
    'deepseek-v3.2:latest': 'DeepSeek v3.2 (Latest)',
    'deepseek-v3.2:32b': 'DeepSeek v3.2 32B',
    'deepseek-v3.2:70b': 'DeepSeek v3.2 70B',
    'deepseek-v3.2:instruct': 'DeepSeek v3.2 Instruct',
    'deepseek-v3.2:coder': 'DeepSeek v3.2 Coder',
    'deepseek-r1-distill-llama-70b': 'DeepSeek R1 Distill 70B',
    'deepseek-coder-v2-lite-instruct': 'DeepSeek Coder V2 Lite',

    // Llama
    'llama-3.3-70b-versatile': 'Llama 3.3 70B Versatile',
    'llama-3.3-8b-instant': 'Llama 3.3 8B Instant',
    'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
    'llama-3.1-8b-instruct': 'Llama 3.1 8B',
    'llama-3.1-70b-instruct': 'Llama 3.1 70B',
    'llama-3.1-405b-instruct': 'Llama 3.1 405B',

    // Mixtral
    'mixtral-8x7b-instruct-v0.1': 'Mixtral 8x7B Instruct v0.1',
    'mixtral-8x22b-instruct-v0.1': 'Mixtral 8x22B Instruct v0.1',
    'mixtral-8x7b-32768': 'Mixtral 8x7B 32K',

    // Gemma
    'gemma2-9b-it': 'Gemma 2 9B IT',
    'gemma-7b-it': 'Gemma 7B IT',

    // Qwen
    'qwen3-coder:480b-cloud': 'Qwen3-Coder 480B Cloud',

    // Vision / Multimodal (via OpenRouter naming)
    'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
    'anthropic/claude-3.5-haiku': 'Claude 3.5 Haiku',
    'openai/gpt-4o': 'GPT-4o',
    'openai/gpt-4o-mini': 'GPT-4o Mini',
    'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash Exp',

    // Specialized
    'llama-guard-3-8b': 'Llama Guard 3 8B',
    'code-llama-34b-instruct': 'Code Llama 34B',
};

/** Multimodal model name patterns */
const MULTIMODAL_PATTERNS = [
    'vision',
    'vl',
    'v-',
    'multimodal',
    'pixtral',
    'fuyu',
    'llava',
    'moondream',
    'gemini-3',
    'gemini-2.5',
    'gemini-2.0',
    'gemini-1.5',
    'claude-3.5',
    'claude-4',
    'gpt-4o',
    'phi-3.5-vision',
    'qwen2-vl',
    'qwen3',
    'idefics',
];

/**
 * Format a raw model ID into a human-readable display name
 */
export function formatModelName(modelId: string): string {
    // 1. Exact match in lookup table
    const override = MODEL_DISPLAY_OVERRIDES[modelId];
    if (override) return override;

    // 2. Pattern-based formatting
    let name = modelId;

    // Handle provider/name format (e.g., "anthropic/claude-3.5-sonnet")
    if (name.includes('/')) {
        const parts = name.split('/');
        name = parts[parts.length - 1] ?? name;
    }

    // Handle :tag format (e.g., "deepseek-r1:32b")
    name = name.replace(/:latest$/, '');
    const tagMatch = name.match(/^(.+):([a-z]+(?:-\d+b)?)$/);
    if (tagMatch) {
        const base = formatBaseName(tagMatch[1] ?? name);
        const tag = (tagMatch[2] ?? '').replace(/-/g, ' ');
        return `${base} ${tag}`;
    }

    return formatBaseName(name);
}

/**
 * Format base model name: capitalize, replace delimiters with spaces
 */
function formatBaseName(name: string): string {
    return (
        name.charAt(0).toUpperCase() +
        name
            .slice(1)
            .replace(/[-_]/g, ' ')
            .replace(/\b(\d+)\b/g, ' $1 ') // space around numbers
            .replace(/\s+/g, ' ')
            .trim()
    );
}

/**
 * Check if a model supports multimodal input (vision/audio)
 */
export function isMultimodalModel(provider: string, model: string): boolean {
    const lower = model.toLowerCase();
    return MULTIMODAL_PATTERNS.some(p => lower.includes(p));
}

/**
 * Multimodal-aware display name (appends 👁️ for multimodal models)
 */
export function formatModelNameWithMultimodal(provider: string, model: string): string {
    const name = formatModelName(model);
    return isMultimodalModel(provider, model) ? `${name} 👁️` : name;
}
