import { MESSAGES } from '../constants';

/**
 * Consolidated Utility Functions
 * All utility functions consolidated from scattered files throughout the codebase
 * Eliminates duplicate implementations and provides single source of truth
 */


// ==================== STRING & DATA UTILITIES ====================

/**
 * Format timestamp to human-readable string
 */
export const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
};

/**
 * Sanitize filename for file system compatibility
 */
export const sanitizeFilename = (filename: string, maxLength: number = 255): string => {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
    return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Truncate text to specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
};

/**
 * Clean HTML entities and escape sequences from text
 */
export const cleanText = (text: string): string => {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) =>
            String.fromCharCode(parseInt(code, 16))
        );
};

/**
 * Validate that a string is not empty
 */
export const isNonEmptyString = (value: any): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
};

// ==================== FUNCTIONAL UTILITIES ====================

/**
 * Create a debounced function - delays execution until after delay period
 */
export const debounce = <T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): T => {
    let timeoutId: number;
    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => fn(...args), delay);
    }) as T;
};

/**
 * Create a throttled function - limits execution rate
 */
export const throttle = <T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): T => {
    let inThrottle = false;
    return ((...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }) as T;
};

/**
 * Create a delay promise
 */
export const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

// ==================== URL & YOUTUBE UTILITIES ====================

/**
 * YouTube URL patterns for validation (ordered by frequency for performance)
 */
const YOUTUBE_URL_PATTERNS = [
    // Standard youtube.com/watch?v= format (most common)
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&.*)?$/,
    // youtu.be short format (second most common)
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
    // youtube.com/embed format
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
    // youtube.com/v format
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/,
    // Mobile youtube.com format
    /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&.*)?$/
];

// Memoized regex for video ID validation
const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const URL_CACHE = new Map<string, string | null>();

/**
 * Clean and normalize YouTube URL
 */
export const cleanYouTubeUrl = (url: string): string => {
    if (!url || typeof url !== 'string') {
        return '';
    }

    let cleanUrl = url.trim();

    // Remove zero-width characters
    cleanUrl = cleanUrl.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Add https:// if missing protocol
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }

    // Convert http to https for YouTube
    if (cleanUrl.startsWith('http://youtube.com') || cleanUrl.startsWith('http://www.youtube.com')) {
        cleanUrl = cleanUrl.replace('http://', 'https://');
    }

    return cleanUrl;
};

/**
 * Extract YouTube video ID from URL (memoized for performance)
 */
export const extractVideoId = (url: string): string | null => {
    if (!url || typeof url !== 'string') return null;

    // Check cache first
    if (URL_CACHE.has(url)) {
        return URL_CACHE.get(url)!;
    }

    const cleanUrl = cleanYouTubeUrl(url);
    let result: string | null = null;

    // Try most common pattern first
    let match = cleanUrl.match(YOUTUBE_URL_PATTERNS[0]);
    if (match?.[1] && VIDEO_ID_REGEX.test(match[1])) {
        result = match[1];
    } else {
        // Fallback to remaining patterns
        for (let i = 1; i < YOUTUBE_URL_PATTERNS.length && !result; i++) {
            match = cleanUrl.match(YOUTUBE_URL_PATTERNS[i]);
            if (match?.[1] && VIDEO_ID_REGEX.test(match[1])) {
                result = match[1];
            }
        }
    }

    // Cache result with simple LRU eviction
    if (URL_CACHE.size > 100) {
        URL_CACHE.clear();
    }
    URL_CACHE.set(url, result);

    return result;
};

/**
 * Validate YouTube URL format
 */
export const isValidYouTubeUrl = (url: string): boolean => {
    return extractVideoId(url) !== null;
};

// ==================== VALIDATION UTILITIES ====================

/**
 * Validate API key format
 */
export const isValidAPIKey = (key: string, provider: 'gemini' | 'groq'): boolean => {
    if (!key || typeof key !== 'string') {
        return false;
    }

    switch (provider) {
        case 'gemini':
            return key.startsWith('AIza') && key.length > 10;
        case 'groq':
            return key.startsWith('gsk_') && key.length > 10;
        default:
            return false;
    }
};

/**
 * Validate file path
 */
export const isValidPath = (path: string): boolean => {
    return typeof path === 'string' && path.trim().length > 0;
};

/**
 * Validate settings configuration
 */
export const validateSettings = (settings: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    const usingEnv = Boolean(settings.useEnvironmentVariables);
    const hasDirectKey = isNonEmptyString(settings.geminiApiKey) || isNonEmptyString(settings.groqApiKey);

    if (!hasDirectKey && !usingEnv) {
        errors.push(MESSAGES.ERRORS.MISSING_API_KEYS);
    }

    if (isNonEmptyString(settings.geminiApiKey) && !isValidAPIKey(settings.geminiApiKey, 'gemini')) {
        errors.push('Invalid Gemini API key format');
    }

    if (isNonEmptyString(settings.groqApiKey) && !isValidAPIKey(settings.groqApiKey, 'groq')) {
        errors.push('Invalid Groq API key format');
    }

    if (usingEnv && !isNonEmptyString(settings.environmentPrefix)) {
        errors.push('Environment variable prefix is required when using environment variables');
    }

    if (!settings.outputPath || typeof settings.outputPath !== 'string') {
        errors.push('Output path is required');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

// ==================== DOM & ANIMATION UTILITIES ====================

/**
 * Animate element properties with transitions
 */
export const animateElement = (
    element: HTMLElement,
    properties: Record<string, string>,
    duration: number = 300
): Promise<HTMLElement> => {
    return new Promise(resolve => {
        element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        Object.assign(element.style, properties);

        const handleTransitionEnd = () => {
            element.removeEventListener('transitionend', handleTransitionEnd);
            resolve(element);
        };

        element.addEventListener('transitionend', handleTransitionEnd);
    });
};

/**
 * Create safe event listener that can be cleaned up
 */
export const createSafeEventListener = (
    element: HTMLElement | Window | Document,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
): () => void => {
    element.addEventListener(event, handler, options);

    return () => {
        element.removeEventListener(event, handler, options);
    };
};

// ==================== PERFORMANCE UTILITIES ====================

/**
 * Performance measurement utility
 */
export class PerformanceTimer {
    private startTime: number = 0;
    private measurements: number[] = [];

    start(): void {
        this.startTime = performance.now();
    }

    end(): number {
        const duration = performance.now() - this.startTime;
        this.measurements.push(duration);
        return duration;
    }

    getAverage(): number {
        if (this.measurements.length === 0) return 0;
        return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
    }

    reset(): void {
        this.measurements = [];
    }
}

/**
 * Create performance-tracked debounced function
 */
export const createDebouncedWithPerf = <T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    perfName?: string
): T => {
    let timeoutId: number;
    const timer = new PerformanceTimer();

    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            timer.start();
            fn(...args);
            timer.end();
        }, delay);
    }) as T;
};

/**
 * Create performance-tracked throttled function
 */
export const createThrottledWithPerf = <T extends (...args: any[]) => any>(
    fn: T,
    limit: number,
    perfName?: string
): T => {
    let inThrottle = false;
    const timer = new PerformanceTimer();

    return ((...args: Parameters<T>) => {
        if (!inThrottle) {
            timer.start();
            fn(...args);
            timer.end();
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }) as T;
};

// ==================== ERROR HANDLING UTILITIES ====================

/**
 * Create safe async function with error handling
 */
export const safeAsync = <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    onError?: (error: Error) => void
): T => {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error) {
            if (onError && error instanceof Error) {
                onError(error);
            }
            throw error;
        }
    }) as T;
};

/**
 * Create safe sync function with error handling
 */
export const safeSync = <T extends (...args: any[]) => any>(
    fn: T,
    onError?: (error: Error) => void
): T => {
    return ((...args: Parameters<T>) => {
        try {
            return fn(...args);
        } catch (error) {
            if (onError && error instanceof Error) {
                onError(error);
            }
            throw error;
        }
    }) as T;
};

// ==================== EXPORT CONSOLIDATED UTILITIES ====================

/**
 * Main utilities object for easy importing
 */
export const Utils = {
    // String & Data
    formatTimestamp,
    sanitizeFilename,
    generateId,
    truncateText,
    cleanText,
    isNonEmptyString,

    // Functional
    debounce,
    throttle,
    delay,

    // URL & YouTube
    cleanYouTubeUrl,
    extractVideoId,
    isValidYouTubeUrl,

    // Validation
    isValidAPIKey,
    isValidPath,
    validateSettings,

    // DOM & Animation
    animateElement,
    createSafeEventListener,

    // Performance
    PerformanceTimer,
    createDebouncedWithPerf,
    createThrottledWithPerf,

    // Error Handling
    safeAsync,
    safeSync,
};

// Export all utilities individually for tree-shaking
export {
    // Re-export from Utils for convenience
    Utils as default,
};