import { YouTubePluginSettings } from './types';

/**
 * Secure configuration service for API key management
 *
 * SECURITY FEATURES:
 * - API key obfuscation at rest (XOR encryption with device-specific key)
 * - Input masking in UI (password fields)
 * - Key format validation
 * - Secure key clearing on logout/reset
 * - Environment variable support
 * - Security warnings and best practices
 */

// Security constants
const SECURITY_VERSION = '1.0.0';
const OBFUSCATION_KEY_PREFIX = 'ytc_sec_';
const MIN_API_KEY_LENGTH = 20;
const MAX_API_KEY_LENGTH = 200;

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
            (window as any).app?.vault?.adapter?.basePath || 'default'
        ];

        // Simple hash function to create numeric key
        let hash = 0;
        const combined = factors.join('|') + SECURITY_VERSION;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return OBFUSCATION_KEY_PREFIX + Math.abs(hash).toString(16);
    }

    /**
     * Obfuscate API key using XOR with device-specific key
     * This provides basic obfuscation, not true encryption
     */
    obfuscateKey(apiKey: string): string {
        if (!apiKey) return '';

        const key = this.generateObfuscationKey();
        const keyBytes = this.stringToBytes(key);
        const dataBytes = this.stringToBytes(apiKey);

        // XOR each byte with key (repeating key as needed)
        const obfuscated = dataBytes.map((byte, i) =>
            byte ^ keyBytes[i % keyBytes.length]!
        );

        // Encode as base64 for storage
        return btoa(String.fromCharCode(...obfuscated));
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
            const recovered = dataBytes.map((byte, i) =>
                byte ^ keyBytes[i % keyBytes.length]!
            );

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
     * Check if a value is obfuscated
     */
    isObfuscated(value: string): boolean {
        if (!value || value.length < 10) return false;

        // Check for base64-like pattern
        try {
            // Obfuscated keys are base64 encoded
            atob(value);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Store key metadata for tracking
     */
    storeMetadata(keyId: string, keyType: string): void {
        const meta: APIKeyMetadata = {
            lastModified: Date.now(),
            isObfuscated: true,
            keyType
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
        openai: /^sk-[A-Za-z0-9_-]{48,}$/ // OpenAI-compatible (for reference)
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
            '<insert>'
        ];

        const lowerKey = trimmedKey.toLowerCase();
        for (const pattern of placeholderPatterns) {
            if (lowerKey.includes(pattern)) {
                return { valid: false, message: 'This appears to be a placeholder API key. Please enter your actual API key.' };
            }
        }

        // Provider-specific validation (soft validation)
        const pattern = APIKeyValidator.PATTERNS[keyType as keyof typeof APIKeyValidator.PATTERNS];
        if (pattern && !pattern.test(trimmedKey)) {
            return {
                valid: false,
                message: `${keyType.toUpperCase()} API key format doesn't match expected pattern. This may be okay if the format has changed.`
            };
        }

        return { valid: true };
    }

    /**
     * Check if key looks weak or compromised
     */
    checkKeyHealth(keyType: string, apiKey: string): { isHealthy: boolean; warnings: string[] } {
        const warnings: string[] = [];
        let isHealthy = true;

        const trimmedKey = apiKey.trim();

        // Check if key is all the same character
        if (trimmedKey.length > 10 && new Set(trimmedKey).size === 1) {
            warnings.push('API key appears to be invalid (all same character)');
            isHealthy = false;
        }

        // Check for common test keys
        const testKeys = [
            'sk-test',
            'test-key',
            'demo-key',
            'sample-key'
        ];

        if (testKeys.some(testKey => trimmedKey.toLowerCase().includes(testKey))) {
            warnings.push('This appears to be a test/demo API key');
            isHealthy = false;
        }

        return { isHealthy, warnings };
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
     * Get API key with environment variable fallback and auto-deobfuscation
     */
    getApiKey(keyType: keyof Pick<YouTubePluginSettings, 'geminiApiKey' | 'groqApiKey' | 'ollamaApiKey' | 'huggingFaceApiKey' | 'openRouterApiKey'>): string {
        const rawKey = this.settings[keyType];

        // Return empty if no key stored
        if (!rawKey || rawKey.length === 0) {
            return this.getFromEnvironment(keyType);
        }

        // Check if key is obfuscated and de-obfuscate if needed
        if (this.keyStorage.isObfuscated(rawKey)) {
            const deobfuscated = this.keyStorage.deobfuscateKey(rawKey);
            return deobfuscated || rawKey; // Fall back to raw if de-obfuscation fails
        }

        return rawKey;
    }

    /**
     * Store API key with obfuscation
     * Returns the obfuscated value for storage
     */
    setApiKey(keyType: ApiKeyName, apiKey: string): string {
        const trimmedKey = apiKey.trim();

        // Validate before storing
        const validation = this.validator.validateKeyFormat(keyType, trimmedKey);
        if (!validation.valid) {
            throw new Error(validation.message || 'Invalid API key format');
        }

        // Obfuscate the key before returning for storage
        const obfuscated = this.keyStorage.obfuscateKey(trimmedKey);
        this.keyStorage.storeMetadata(keyType, keyType);

        return obfuscated;
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
            'openRouterApiKey'
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
                return process.env[envVarName] || '';
            }

            // Check for window-level environment (some setups)
            if (typeof window !== 'undefined') {
                const winEnv = (window as any).env;
                if (winEnv && winEnv[envVarName]) {
                    return winEnv[envVarName];
                }
            }
        } catch (e) {
            console.debug('Environment variable access failed:', e);
        }

        return '';
    }

    /**
     * Comprehensive security validation
     */
    validateSecurityConfiguration(): SecurityValidationResult {
        const result: SecurityValidationResult = {
            isValid: true,
            warnings: [],
            errors: [],
            suggestions: []
        };

        // Check if using environment variables (most secure)
        if (this.settings.useEnvironmentVariables) {
            result.suggestions.push(
                '✅ Using environment variables - this is the most secure method',
                'Make sure to set environment variables before starting Obsidian'
            );
            return result;
        }

        // Check stored keys
        const keyTypes: ApiKeyName[] = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey'
        ];

        let hasStoredKeys = false;

        for (const keyType of keyTypes) {
            const apiKey = this.getApiKey(keyType);
            if (!apiKey || apiKey.length === 0) continue;

            hasStoredKeys = true;

            // Format validation
            const formatValidation = this.validator.validateKeyFormat(
                keyType.replace('ApiKey', ''),
                apiKey
            );

            if (!formatValidation.valid) {
                result.warnings.push(`${keyType}: ${formatValidation.message}`);
                result.isValid = false;
            }

            // Health check
            const health = this.validator.checkKeyHealth(
                keyType.replace('ApiKey', ''),
                apiKey
            );

            if (!health.isHealthy) {
                result.warnings.push(`${keyType}: ${health.warnings.join(', ')}`);
                result.isValid = false;
            }

            // Check if key is obfuscated
            const rawStored = this.settings[keyType];
            if (rawStored && !this.keyStorage.isObfuscated(rawStored)) {
                result.warnings.push(
                    `${keyType}: Key is stored in plain text. Consider re-entering your key to enable obfuscation.`
                );
            }
        }

        if (!hasStoredKeys) {
            result.warnings.push('No API keys configured');
            result.suggestions.push(
                'Add API keys in settings to enable AI features',
                'Consider using environment variables for better security'
            );
        }

        // Add security best practices
        result.suggestions.push(
            '🔒 Security Best Practices:',
            '• Use environment variables when possible',
            '• Rotate API keys regularly',
            '• Never commit API keys to version control',
            '• Use scoped keys with minimal permissions',
            '• Monitor API usage for unusual activity'
        );

        return result;
    }

    /**
     * Get API key rotation recommendations
     */
    getRotationRecommendations(): Array<{keyType: string; lastRotated: number; shouldRotate: boolean; reason: string}> {
        const recommendations: Array<{keyType: string; lastRotated: number; shouldRotate: boolean; reason: string}> = [];
        const metadata = this.keyStorage.getAllMetadata();
        const now = Date.now();
        const rotationDays = 90; // Recommended rotation period
        const rotationMs = rotationDays * 24 * 60 * 60 * 1000;

        const keyTypes: ApiKeyName[] = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey'
        ];

        for (const keyType of keyTypes) {
            const meta = metadata[keyType];
            if (!meta || !meta.lastModified) {
                recommendations.push({
                    keyType,
                    lastRotated: 0,
                    shouldRotate: false,
                    reason: 'No rotation history available'
                });
                continue;
            }

            const timeSinceRotation = now - meta.lastModified;
            const shouldRotate = timeSinceRotation > rotationMs;

            recommendations.push({
                keyType,
                lastRotated: meta.lastModified,
                shouldRotate,
                reason: shouldRotate
                    ? `Key is ${Math.round(timeSinceRotation / (30 * 24 * 60 * 60 * 1000))} days old (recommend rotating every ${rotationDays} days)`
                    : 'Key is within recommended rotation period'
            });
        }

        return recommendations;
    }

    /**
     * Get environment variable template for setup
     */
    getEnvironmentTemplate(): string {
        const prefix = this.settings.environmentPrefix || 'YTC';
        return `# YouTube Clipper - Environment Variables for Secure API Key Management
#
# Add these to your shell profile (~/.bashrc, ~/.zshrc, ~/.config/environment)
# or set them in your system's environment before starting Obsidian

# ============================================================================
# AI PROVIDER API KEYS
# ============================================================================

# Google Gemini API Key
# Get your key at: https://ai.google.dev/
${prefix}_GEMINI_API_KEY=your_gemini_api_key_here

# Groq API Key
# Get your key at: https://groq.com/
${prefix}_GROQ_API_KEY=your_groq_api_key_here

# Ollama Cloud API Key (if using cloud instead of local)
${prefix}_OLLAMA_API_KEY=your_ollama_api_key_here

# Hugging Face API Key
${prefix}_HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# OpenRouter API Key
${prefix}_OPENROUTER_API_KEY=your_openrouter_api_key_here

# ============================================================================
# USAGE INSTRUCTIONS
# ============================================================================

# 1. Set these variables in your environment
# 2. Enable "Use Environment Variables" in plugin settings
# 3. Set the Environment Variable Prefix to match (default: YTC)
# 4. Restart Obsidian to pick up the environment variables

# ============================================================================
# SECURITY NOTES
# ============================================================================

# • Never commit .env files or shell profiles with real API keys to version control
# • Use different API keys for development and production
# • Rotate API keys regularly (recommended: every 90 days)
# • Monitor your API usage for unusual activity
# • Revoke keys that are no longer in use

# ============================================================================
# TESTING CONFIGURATION
# ============================================================================

# Test that environment variables are loaded:
# echo $${prefix}_GEMINI_API_KEY

# You should see your API key printed (don't share this output)
`;
    }

    /**
     * Export settings for backup (with sensitive data removed/masked)
     */
    exportSafeSettings(): Partial<YouTubePluginSettings> {
        const safe: Partial<YouTubePluginSettings> = {
            // Non-sensitive settings
            outputPath: this.settings.outputPath,
            useEnvironmentVariables: this.settings.useEnvironmentVariables,
            environmentPrefix: this.settings.environmentPrefix,
            performanceMode: this.settings.performanceMode,
            enableParallelProcessing: this.settings.enableParallelProcessing,
            enableAutoFallback: this.settings.enableAutoFallback,
            preferMultimodal: this.settings.preferMultimodal,
            defaultMaxTokens: this.settings.defaultMaxTokens,
            defaultTemperature: this.settings.defaultTemperature,
            customTimeouts: this.settings.customTimeouts,
            modelOptionsCache: this.settings.modelOptionsCache,
            modelCacheTimestamps: this.settings.modelCacheTimestamps
        };

        // Add masked API keys (for reference, not functional)
        const keyTypes: (keyof YouTubePluginSettings)[] = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey'
        ];

        for (const keyType of keyTypes) {
            if (this.hasApiKey(keyType as ApiKeyName)) {
                (safe as any)[keyType] = this.getMaskedApiKey(keyType as ApiKeyName);
            }
        }

        return safe;
    }
}
