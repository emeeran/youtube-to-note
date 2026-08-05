import { YouTubePluginSettings } from './types';

/**
 * Secure configuration service for API key management
 *
 * DESIGN:
 * - API keys are stored in plaintext inside the plugin's local data.json.
 *   The user fully controls that file locally; this mirrors how every other
 *   Obsidian plugin stores credentials and avoids the false security of a
 *   reversible in-renderer "obfuscation" scheme.
 * - Optional environment-variable resolution for users who prefer not to
 *   persist keys to disk.
 * - Legacy XOR-obfuscated values (written by older plugin versions) are
 *   transparently de-obfuscated on read and migrated to plaintext on load.
 * - Input masking + format validation for the settings UI.
 */

// Security constants
const SECURITY_VERSION = '1.0.0';
const OBFUSCATION_KEY_PREFIX = 'ytc_sec_';
const MIN_API_KEY_LENGTH = 20;
const MAX_API_KEY_LENGTH = 400;

/**
 * API key field names in settings
 */
export type ApiKeyName = 'geminiApiKey' | 'groqApiKey' | 'ollamaApiKey' | 'huggingFaceApiKey' | 'openRouterApiKey';

/**
 * Result of security validation
 */
export interface SecurityValidationResult {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    suggestions: string[];
}

/**
 * API key metadata for tracking
 */
interface APIKeyMetadata {
    lastModified: number;
    lastRotated?: number;
    isObfuscated: boolean;
    keyType: string;
}

/**
 * Secure storage for API keys with obfuscation
 * Note: This provides basic obfuscation, not true encryption.
 * For production use, consider using Obsidian's DataCore with encryption.
 */
class SecureKeyStorage {
    private storageKey = 'ytc_api_keys_meta';

    /**
     * Generate device-specific obfuscation key
     * Creates a unique key based on device/browser characteristics
     */
    private generateObfuscationKey(): string {
        // Use multiple factors to create a device-specific key
        const factors = [
            navigator.userAgent,
            navigator.language,
            screen.width.toString(),
            screen.height.toString(),
            // Add vault-specific factor if available
            (window as any).app?.vault?.adapter?.basePath || 'default',
        ];

        // Simple hash function to create numeric key
        let hash = 0;
        const combined = factors.join('|') + SECURITY_VERSION;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return OBFUSCATION_KEY_PREFIX + Math.abs(hash).toString(16);
    }

    /**
     * Obfuscate API key.
     *
     * This is now an identity function: keys are intentionally stored in
     * plaintext (see file header). The method is retained only so that
     * `setApiKey` can keep its existing call shape. The XOR routine below is
     * intentionally NOT used for new writes — `deobfuscateKey` still exists
     * solely to recover values written by older plugin versions.
     */
    obfuscateKey(apiKey: string): string {
        return apiKey;
    }

    /**
     * De-obfuscate API key
     */
    deobfuscateKey(obfuscated: string): string {
        if (!obfuscated) return '';

        try {
            const key = this.generateObfuscationKey();
            const keyBytes = this.stringToBytes(key);
            const data = atob(obfuscated);
            const dataBytes = new Array(data.length);

            for (let i = 0; i < data.length; i++) {
                dataBytes[i] = data.charCodeAt(i);
            }

            // XOR each byte with key to recover original
            const recovered = dataBytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]!);

            return String.fromCharCode(...recovered);
        } catch (e) {
            console.warn('Failed to de-obfuscate key:', e);
            return ''; // Return empty on failure
        }
    }

    /**
     * Convert string to byte array
     */
    private stringToBytes(str: string): number[] {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    }

    /**
     * Store key metadata for tracking
     */
    storeMetadata(keyId: string, keyType: string): void {
        const meta: APIKeyMetadata = {
            lastModified: Date.now(),
            isObfuscated: true,
            keyType,
        };

        try {
            const stored = this.getAllMetadata();
            stored[keyId] = meta;
            localStorage.setItem(this.storageKey, JSON.stringify(stored));
        } catch (e) {
            console.warn('Failed to store key metadata:', e);
        }
    }

    /**
     * Get all stored metadata
     */
    getAllMetadata(): Record<string, APIKeyMetadata> {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    }

    /**
     * Clear metadata for a specific key
     */
    clearMetadata(keyId: string): void {
        try {
            const stored = this.getAllMetadata();
            delete stored[keyId];
            localStorage.setItem(this.storageKey, JSON.stringify(stored));
        } catch (e) {
            console.warn('Failed to clear key metadata:', e);
        }
    }

    /**
     * Clear all metadata
     */
    clearAllMetadata(): void {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            console.warn('Failed to clear all metadata:', e);
        }
    }
}

/**
 * API Key validator with pattern matching for known providers
 */
class APIKeyValidator {
    // Common API key patterns (simplified for validation)
    private static readonly PATTERNS = {
        gemini: /^AIza[A-Za-z0-9_-]{35}$/, // Gemini API keys
        groq: /^gsk_[A-Za-z0-9_-]{48,52}$/, // Groq API keys
        openai: /^sk-[A-Za-z0-9_-]{48,}$/, // OpenAI-compatible (for reference)
    };

    /**
     * Validate API key format
     */
    validateKeyFormat(keyType: string, apiKey: string): { valid: boolean; message?: string } {
        if (!apiKey || apiKey.trim().length === 0) {
            return { valid: false, message: 'API key is empty' };
        }

        const trimmedKey = apiKey.trim();

        // Check minimum length
        if (trimmedKey.length < MIN_API_KEY_LENGTH) {
            return { valid: false, message: `API key is too short (minimum ${MIN_API_KEY_LENGTH} characters)` };
        }

        if (trimmedKey.length > MAX_API_KEY_LENGTH) {
            return { valid: false, message: `API key is too long (maximum ${MAX_API_KEY_LENGTH} characters)` };
        }

        // Check for placeholder/default values
        const placeholderPatterns = [
            'your-api-key-here',
            'your_key_here',
            'placeholder',
            'example-key',
            'xxx',
            '...',
            '<insert>',
        ];

        const lowerKey = trimmedKey.toLowerCase();
        for (const pattern of placeholderPatterns) {
            if (lowerKey.includes(pattern)) {
                return {
                    valid: false,
                    message: 'This appears to be a placeholder API key. Please enter your actual API key.',
                };
            }
        }

        // Provider-specific validation (soft validation)
        const pattern = APIKeyValidator.PATTERNS[keyType as keyof typeof APIKeyValidator.PATTERNS];
        if (pattern && !pattern.test(trimmedKey)) {
            return {
                valid: false,
                message: `${keyType.toUpperCase()} API key format doesn't match expected pattern. This may be okay if the format has changed.`,
            };
        }

        return { valid: true };
    }

    /**
     * Mask API key for display (show only first 8 and last 4 characters)
     */
    maskKey(apiKey: string): string {
        if (!apiKey || apiKey.length < 12) return '***';

        const prefix = apiKey.substring(0, 8);
        const suffix = apiKey.substring(apiKey.length - 4);
        const maskedLength = Math.max(8, apiKey.length - 12);

        return `${prefix}${'*'.repeat(maskedLength)}${suffix}`;
    }

    /**
     * Check if key is already masked
     */
    isMasked(apiKey: string): boolean {
        return apiKey.includes('*') && apiKey.length >= 12;
    }
}

export class SecureConfigService {
    private settings: YouTubePluginSettings;
    private keyStorage = new SecureKeyStorage();
    private validator = new APIKeyValidator();

    constructor(settings: YouTubePluginSettings) {
        this.settings = settings;
    }

    /**
     * Known plaintext API-key prefixes. A value beginning with one of these is
     * always treated as plaintext (never de-obfuscated), which guarantees we
     * can never corrupt a real key.
     */
    private static readonly KNOWN_KEY_PREFIXES = ['AIza', 'gsk_', 'sk-or-v1-', 'hf_', 'sk-', 'ollama-'];

    /**
     * Heuristic: does this value look like a real (plaintext) API key?
     * Returns true for any known-prefixed key, or any non-base64 string of
     * reasonable length (covers opaque tokens like some Ollama keys).
     */
    static isLikelyPlaintextKey(value: string): boolean {
        if (!value || value.length < MIN_API_KEY_LENGTH) return false;
        if (this.KNOWN_KEY_PREFIXES.some(prefix => value.startsWith(prefix))) return true;
        // A real base64 blob *might* be a legacy-obfuscated value, so anything
        // that is NOT valid base64 is safely plaintext.
        try {
            atob(value);
            return false;
        } catch {
            return true;
        }
    }

    /**
     * Get API key with environment-variable fallback and legacy de-obfuscation.
     */
    getApiKey(
        keyType: keyof Pick<
            YouTubePluginSettings,
            'geminiApiKey' | 'groqApiKey' | 'ollamaApiKey' | 'huggingFaceApiKey' | 'openRouterApiKey'
        >,
    ): string {
        const rawKey = this.settings[keyType];

        // Return empty if no key stored
        if (!rawKey || rawKey.length === 0) {
            return this.getFromEnvironment(keyType);
        }

        // Plaintext keys are returned untouched.
        if (SecureConfigService.isLikelyPlaintextKey(rawKey)) {
            return rawKey;
        }

        // Otherwise attempt legacy de-obfuscation (values written by old versions).
        const deobfuscated = this.keyStorage.deobfuscateKey(rawKey);
        if (deobfuscated && SecureConfigService.isLikelyPlaintextKey(deobfuscated)) {
            return deobfuscated;
        }

        // Unknown opaque value — return as-is rather than risk corrupting it.
        return rawKey;
    }

    /**
     * One-time migration: resolve any legacy-obfuscated keys to plaintext in
     * place so future reads are trivial and data.json is no longer mixed.
     * Returns whether any value changed.
     */
    static migrateApiKeys(settings: YouTubePluginSettings): boolean {
        const fields = ['geminiApiKey', 'groqApiKey', 'ollamaApiKey', 'huggingFaceApiKey', 'openRouterApiKey'] as const;
        const svc = new SecureConfigService(settings);
        let changed = false;
        for (const field of fields) {
            const raw = settings[field];
            if (!raw) continue;
            const resolved = svc.getApiKey(field);
            if (resolved && resolved !== raw) {
                settings[field] = resolved;
                changed = true;
            }
        }
        return changed;
    }

    /**
     * Store an API key. Keys are kept in plaintext (see file header); this
     * validates the format and returns the trimmed value for storage.
     */
    setApiKey(keyType: ApiKeyName, apiKey: string): string {
        const trimmedKey = apiKey.trim();

        // Validate before storing
        const validation = this.validator.validateKeyFormat(keyType, trimmedKey);
        if (!validation.valid) {
            throw new Error(validation.message ?? 'Invalid API key format');
        }

        this.keyStorage.storeMetadata(keyType, keyType);

        return trimmedKey;
    }

    /**
     * Get masked API key for UI display
     */
    getMaskedApiKey(keyType: ApiKeyName): string {
        const rawKey = this.getApiKey(keyType);

        if (!rawKey || rawKey.length === 0) {
            return 'Not set';
        }

        return this.validator.maskKey(rawKey);
    }

    /**
     * Check if API key is set
     */
    hasApiKey(keyType: ApiKeyName): boolean {
        const key = this.getApiKey(keyType);
        return Boolean(key && key.length > 0);
    }

    /**
     * Clear an API key securely
     */
    clearApiKey(keyType: ApiKeyName): void {
        // Clear from storage
        this.settings[keyType] = '' as any;
        this.keyStorage.clearMetadata(keyType);

        // Clear from any caches
        this.clearKeyFromMemory(keyType);
    }

    /**
     * Clear all API keys
     */
    clearAllApiKeys(): void {
        const keyTypes: ApiKeyName[] = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ];

        for (const keyType of keyTypes) {
            this.clearApiKey(keyType);
        }

        this.keyStorage.clearAllMetadata();
    }

    /**
     * Clear key from runtime memory
     */
    private clearKeyFromMemory(keyType: ApiKeyName): void {
        // Overwrite the key in settings to clear it from memory
        (this.settings as any)[keyType] = '';
    }

    /**
     * Get API key from environment variables
     * Note: In Obsidian, this requires the user to set environment variables
     * before launching the application
     */
    private getFromEnvironment(keyType: string): string {
        if (!this.settings.useEnvironmentVariables) {
            return '';
        }

        const prefix = this.settings.environmentPrefix || 'YTC';
        const envVarName = `${prefix}_${keyType.toUpperCase().replace('APIKEY', '_API_KEY')}`;

        // Obsidian plugins can access process.env in desktop app
        try {
            // Try Electron/Node.js environment first
            if (typeof process !== 'undefined' && process.env) {
                return process.env[envVarName] ?? '';
            }

            // Check for window-level environment (some setups)
            if (typeof window !== 'undefined') {
                const winEnv = (window as any).env;
                if (winEnv?.[envVarName]) {
                    return winEnv[envVarName];
                }
            }
        } catch (e) {
            console.debug('Environment variable access failed:', e);
        }

        return '';
    }
}
