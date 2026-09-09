import { MESSAGES } from './constants/index';

/**
 * Input validation utilities
 */

/**
 * Maximum accepted length for a single per-format custom prompt override.
 * Kept well below anything a provider would accept, but generous enough for a
 * long hand-written template. Enforced in the settings UI (textarea
 * `maxlength`) and here as a hard validation error for imported/hand-edited
 * `data.json` values.
 */
export const MAX_CUSTOM_PROMPT_LENGTH = 20_000;

/** Settings fields that hold a provider API key. */
export const API_KEY_FIELDS = [
    'geminiApiKey',
    'groqApiKey',
    'ollamaApiKey',
    'huggingFaceApiKey',
    'openRouterApiKey',
] as const;

export type ApiKeyField = (typeof API_KEY_FIELDS)[number];

export interface SettingsValidationResult {
    /** True when the configuration is usable — warnings never block a run. */
    isValid: boolean;
    errors: string[];
    /** Informational notes (e.g. an unusual key format). Surfaced, not enforced. */
    warnings: string[];
}

export class ValidationUtils {
    /**
     * YouTube URL patterns for validation (ordered by frequency for performance)
     * Enhanced patterns to handle various YouTube URL formats
     */
    private static readonly URL_PATTERNS = [
        // Standard youtube.com/watch?v= format (most common) - handles any position of v param and hash fragments
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})(?:[&?#].*)?$/,
        // youtu.be short format (second most common) - handles params and hash
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?#].*)?$/,
        // youtube.com/embed format
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:[?#].*)?$/,
        // youtube.com/v format
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})(?:[?#].*)?$/,
        // Mobile youtube.com format
        /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})(?:[&?#].*)?$/,
        // youtube.com/shorts format (handling Shorts URLs)
        /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:[?#].*)?$/,
        // youtube.com/live format (live streams / premieres)
        /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})(?:[?#].*)?$/,
    ];

    // Memoized regex for video ID validation (hot path optimization)
    private static readonly VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
    private static readonly URL_CACHE = new Map<string, string | null>();

    /**
     * Clean and normalize YouTube URL
     */
    static cleanYouTubeUrl(url: string): string {
        if (!url || typeof url !== 'string') {
            return '';
        }

        // Remove extra whitespace and normalize
        let cleanUrl = url.trim();

        // Handle URLs that might have been copy-pasted with extra characters
        cleanUrl = cleanUrl.replace(/[\u200B-\u200D\uFEFF]/g, '');

        // Add https:// if missing protocol
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = `https://${cleanUrl}`;
        }

        // Convert http to https for YouTube
        if (cleanUrl.startsWith('http://youtube.com') || cleanUrl.startsWith('http://www.youtube.com')) {
            cleanUrl = cleanUrl.replace('http://', 'https://');
        }

        return cleanUrl;
    }

    /**
     * Canonical `https://www.youtube.com/watch?v=<id>` for any accepted URL
     * shape. The intake patterns are intentionally unanchored (an id embedded
     * anywhere passes), so downstream consumers — frontmatter `source:`, the
     * prompt, timestamp links — must only ever see the canonical form, never
     * the raw attacker-shaped string around the id. Null when invalid.
     */
    static canonicalWatchUrl(url: string): string | null {
        const videoId = this.extractVideoId(url);
        return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }

    /**
     * Extract YouTube video ID from URL (memoized for performance)
     * Enhanced extraction with better error handling
     */
    // eslint-disable-next-line complexity
    static extractVideoId(url: string): string | null {
        if (!url || typeof url !== 'string') {
            return null;
        }

        // Check cache first (O(1) for repeated URLs)
        if (this.URL_CACHE.has(url)) {
            const cached = this.URL_CACHE.get(url);
            return cached ?? null;
        }

        const cleanUrl = this.cleanYouTubeUrl(url);
        let result: string | null = null;

        // Direct index access for most common pattern first (micro-optimization)
        const firstPattern = this.URL_PATTERNS[0];
        let match = firstPattern ? cleanUrl.match(firstPattern) : null;
        if (match?.[1] && this.VIDEO_ID_REGEX.test(match[1])) {
            result = match[1];
        } else {
            // Fallback to remaining patterns
            for (let i = 1; i < this.URL_PATTERNS.length && !result; i++) {
                const pattern = this.URL_PATTERNS[i];
                match = pattern ? cleanUrl.match(pattern) : null;
                if (match?.[1] && this.VIDEO_ID_REGEX.test(match[1])) {
                    result = match[1];
                }
            }
        }

        // Evict the oldest entry (FIFO via Map insertion order) instead of
        // wiping the whole cache when it fills — preserves hot entries.
        if (this.URL_CACHE.size > 100) {
            const oldest = this.URL_CACHE.keys().next().value;
            if (oldest !== undefined) {
                this.URL_CACHE.delete(oldest);
            }
        }
        this.URL_CACHE.set(url, result);

        return result;
    }

    /**
     * Validate YouTube URL format
     */
    static isValidYouTubeUrl(url: string): boolean {
        return this.extractVideoId(url) !== null;
    }

    /**
     * Sanitize filename for file system compatibility
     */
    static sanitizeFilename(filename: string, maxLength = 100): string {
        return filename
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, maxLength);
    }

    /**
     * Validate API key format for the two providers with well-known prefixes.
     * The prefix table it reads is the same one the settings-level format check
     * ({@link keyFormatWarning}) uses, so the two cannot drift apart.
     */
    static isValidAPIKey(key: string, provider: 'gemini' | 'groq'): boolean {
        if (!key || typeof key !== 'string') {
            return false;
        }

        const field: ApiKeyField = provider === 'gemini' ? 'geminiApiKey' : 'groqApiKey';
        const prefixes = this.KEY_FORMATS[field].prefixes ?? [];
        return prefixes.some(prefix => key.startsWith(prefix)) && key.length > 10;
    }

    /**
     * Display label + accepted key prefixes per provider field.
     *
     * `prefixes: null` means the provider has no stable public prefix (Ollama
     * issues opaque tokens), so no format check is possible — any non-empty
     * value is accepted.
     */
    private static readonly KEY_FORMATS: Record<ApiKeyField, { label: string; prefixes: string[] | null }> = {
        geminiApiKey: { label: 'Gemini', prefixes: ['AIza'] },
        groqApiKey: { label: 'Groq', prefixes: ['gsk_'] },
        huggingFaceApiKey: { label: 'HuggingFace', prefixes: ['hf_', 'api_'] },
        openRouterApiKey: { label: 'OpenRouter', prefixes: ['sk-or-'] },
        ollamaApiKey: { label: 'Ollama', prefixes: null },
    };

    /**
     * Informational format check for a configured key.
     *
     * Returns a warning message when the key does not start with any prefix the
     * provider is known to issue. It deliberately never blocks: gateways,
     * proxies and rotated key formats are all legitimate, so an unusual prefix
     * is reported to the user rather than treated as an error.
     */
    private static keyFormatWarning(field: ApiKeyField, key: string): string | null {
        const format = this.KEY_FORMATS[field];
        const prefixes = format?.prefixes;
        if (!prefixes) {
            return null;
        }
        if (prefixes.some(prefix => key.startsWith(prefix)) && key.length > 10) {
            return null;
        }
        return MESSAGES.WARNINGS.KEY_FORMAT_MISMATCH(format.label);
    }

    /**
     * Validate settings configuration
     *
     * A configuration is valid when at least one provider key is stored, or
     * environment-variable mode is enabled (which supplies the keys at read
     * time). Format mismatches and other soft findings are returned as
     * `warnings` and never affect {@link SettingsValidationResult.isValid}.
     */
    static validateSettings(settings: Record<string, unknown>): SettingsValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        const usingEnv = Boolean(settings.useEnvironmentVariables);
        const configuredKeys = API_KEY_FIELDS.filter(field => this.isNonEmptyString(settings[field]));

        // Any one of the five providers is enough — an OpenRouter- or
        // HuggingFace-only setup is exactly as valid as a Gemini-only one.
        if (configuredKeys.length === 0 && !usingEnv) {
            errors.push(MESSAGES.ERRORS.MISSING_API_KEYS);
        }

        for (const field of configuredKeys) {
            const warning = this.keyFormatWarning(field, String(settings[field]));
            if (warning) {
                warnings.push(warning);
            }
        }

        if (usingEnv && !this.isNonEmptyString(settings.environmentPrefix)) {
            errors.push('Environment variable prefix is required when using environment variables');
        }

        this.collectCustomPromptErrors(settings, errors);

        if (!settings.outputPath || typeof settings.outputPath !== 'string') {
            errors.push('Output path is required');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Flag per-format prompt overrides that exceed {@link MAX_CUSTOM_PROMPT_LENGTH}.
     * Oversized prompts would be rejected (or truncated) by every provider, so
     * they are reported as errors rather than sent upstream.
     */
    private static collectCustomPromptErrors(settings: Record<string, unknown>, errors: string[]): void {
        const prompts = settings.customPrompts;
        if (!prompts || typeof prompts !== 'object') {
            return;
        }
        for (const [format, value] of Object.entries(prompts as Record<string, unknown>)) {
            if (typeof value === 'string' && value.length > MAX_CUSTOM_PROMPT_LENGTH) {
                errors.push(MESSAGES.ERRORS.CUSTOM_PROMPT_TOO_LONG(format, value.length, MAX_CUSTOM_PROMPT_LENGTH));
            }
        }
    }

    /**
     * Validate file path
     */
    static isValidPath(path: string): boolean {
        return typeof path === 'string' && path.trim().length > 0;
    }

    /**
     * Validate that a string is not empty
     */
    static isNonEmptyString(value: unknown): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }

    /**
     * Truncate text to specified length with ellipsis
     */
    static truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return `${text.substring(0, maxLength - 3)}...`;
    }

    /**
     * Clean HTML entities and escape sequences from text
     */
    static cleanText(text: string): string {
        return text
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\u([0-9a-fA-F]{4})/g, (_match, code) => String.fromCharCode(parseInt(code, 16)));
    }
}
