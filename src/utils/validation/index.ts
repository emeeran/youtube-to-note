/**
 * Validation utility functions
 */

import { VALID_YOUTUBE_URLS, INVALID_YOUTUBE_URLS } from '../../../tests/fixtures/video-data.fixtures';

// Enhanced YouTube URL regex patterns
const YOUTUBE_URL_PATTERNS = {
    STANDARD: /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
    SHORT: /^https?:\/\/(www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/,
    EMBED: /^https?:\/\/(www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    SHORTS: /^https?:\/\/(www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    VIMEO: /^https?:\/\/(www\.)?vimeo\.com\/(\d+)/,
    TIKTOK: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
};

/**
 * Validate YouTube URL with enhanced patterns
 */
export function isValidYouTubeUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;

    const patterns = [
        YOUTUBE_URL_PATTERNS.STANDARD,
        YOUTUBE_URL_PATTERNS.SHORT,
        YOUTUBE_URL_PATTERNS.EMBED,
        YOUTUBE_URL_PATTERNS.SHORTS,
    ];

    return patterns.some(pattern => pattern.test(url.trim()));
}

/**
 * Validate Vimeo URL
 */
export function isValidVimeoUrl(url: string): boolean {
    return YOUTUBE_URL_PATTERNS.VIMEO.test(url.trim());
}

/**
 * Validate TikTok URL
 */
export function isValidTikTokUrl(url: string): boolean {
    return YOUTUBE_URL_PATTERNS.TIKTOK.test(url.trim());
}

/**
 * Extract video ID from YouTube URL
 */
export function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
        YOUTUBE_URL_PATTERNS.STANDARD,
        YOUTUBE_URL_PATTERNS.SHORT,
        YOUTUBE_URL_PATTERNS.EMBED,
        YOUTUBE_URL_PATTERNS.SHORTS,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[2]) {
            return match[2];
        }
    }

    return null;
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize URL
 */
export function validateAndSanitizeUrl(url: string): { valid: boolean; sanitized: string } {
    const trimmed = url.trim();
    const valid = isValidYouTubeUrl(trimmed) || isValidVimeoUrl(trimmed) || isValidTikTokUrl(trimmed);
    return {
        valid,
        sanitized: valid ? sanitizeInput(trimmed) : '',
    };
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate API key format
 */
export function isValidApiKey(key: string): boolean {
    return typeof key === 'string' && key.length > 0 && key.length < 200;
}

/**
 * Check if string is empty or only whitespace
 */
export function isBlank(str: string | undefined | null): boolean {
    return !str || str.trim().length === 0;
}

/**
 * Validate number range
 */
export function isInRange(value: number, min: number, max: number): boolean {
    return typeof value === 'number' && value >= min && value <= max;
}
