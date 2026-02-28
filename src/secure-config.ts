import { YouTubePluginSettings } from './types';
import { CryptoService, CryptoMigration, LegacyCryptoService, CRYPTO_VERSION } from './services/crypto-service';
import { securityAudit, SecurityAuditService } from './services/security-audit';
import { logger } from './services/logger';

/** API key type for secure config methods */
type ApiKeyType = 'geminiApiKey' | 'groqApiKey' | 'ollamaApiKey' | 'huggingFaceApiKey' | 'openRouterApiKey';

/**
 * Secure configuration service for API key management
 *
 * SECURITY FEATURES:
 * - API key encryption at rest (AES-GCM with 256-bit key)
 * - PBKDF2 key derivation with device-specific salt
 * - Input masking in UI (password fields)
 * - Key format validation
 * - Secure key clearing on logout/reset
 * - Environment variable support
 * - Automatic migration from legacy XOR encryption
 * - Security audit logging
 */

// Security constants
const MIN_API_KEY_LENGTH = 20;
const MAX_API_KEY_LENGTH = 200;

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
    isEncrypted: boolean;
    encryptionVersion: number;
    keyType: string;
}

/**
 * Secure storage for API keys with AES-GCM encryption
 */
class SecureKeyStorage {
    private storageKey = 'ytc_api_keys_meta';

    /**
     * Encrypt API key using AES-GCM
     */
    async encryptKey(apiKey: string): Promise<string> {
        if (!apiKey) return '';

        const result = await CryptoService.encrypt(apiKey);
        if (result.isErr()) {
            throw new Error(`Encryption failed: ${result.error.message}`);
        }

        return CryptoService.serialize(result.value);
    }

    /**
     * Decrypt API key
     */
    async decryptKey(encrypted: string): Promise<string> {
        if (!encrypted) return '';

        // Check if this is legacy XOR encryption and migrate
        if (CryptoMigration.needsMigration(encrypted)) {
            return this.migrateAndDecrypt(encrypted);
        }

        // Parse and decrypt with new format
        const parseResult = CryptoService.parse(encrypted);
        if (parseResult.isErr()) {
            // Try legacy decryption as fallback
            const legacyResult = LegacyCryptoService.deobfuscate(encrypted);
            if (legacyResult) {
                return legacyResult;
            }
            throw new Error(`Failed to parse encrypted key: ${parseResult.error.message}`);
        }

        const decryptResult = await CryptoService.decrypt(parseResult.value);
        if (decryptResult.isErr()) {
            throw new Error(`Decryption failed: ${decryptResult.error.message}`);
        }

        return decryptResult.value.plaintext;
    }

    /**
     * Migrate legacy XOR-encrypted key to AES-GCM
     */
    private async migrateAndDecrypt(legacyEncrypted: string): Promise<string> {
        const migrateResult = await CryptoMigration.migrateLegacyKey(legacyEncrypted);

        if (migrateResult.isErr()) {
            // Fallback to direct legacy decryption
            const plaintext = LegacyCryptoService.deobfuscate(legacyEncrypted);
            securityAudit.logMigration(false, 'unknown', 1, CRYPTO_VERSION);
            return plaintext;
        }

        securityAudit.logMigration(true, 'unknown', 1, CRYPTO_VERSION);
        // Return the plaintext, not the encrypted form
        const parseResult = CryptoService.parse(migrateResult.value);
        if (parseResult.isOk()) {
            const decryptResult = await CryptoService.decrypt(parseResult.value);
            if (decryptResult.isOk()) {
                return decryptResult.value.plaintext;
            }
        }

        return LegacyCryptoService.deobfuscate(legacyEncrypted);
    }

    /**
     * Check if a value is encrypted (new or legacy format)
     */
    isEncrypted(value: string): boolean {
        if (!value || value.length < 10) return false;
        return CryptoService.isEncrypted(value) || LegacyCryptoService.isLegacy(value);
    }

    /**
     * Store key metadata for tracking
     */
    storeMetadata(keyId: string, keyType: string): void {
        const meta: APIKeyMetadata = {
            lastModified: Date.now(),
            isEncrypted: true,
            encryptionVersion: CRYPTO_VERSION,
            keyType,
        };

        try {
            const stored = this.getAllMetadata();
            stored[keyId] = meta;
            localStorage.setItem(this.storageKey, JSON.stringify(stored));
        } catch (e) {
            logger.warn('Failed to store key metadata', 'SecureConfig', { error: e });
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
            logger.warn('Failed to clear key metadata', 'SecureConfig', { error: e });
        }
    }

    /**
     * Clear all metadata
     */
    clearAllMetadata(): void {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            logger.warn('Failed to clear all metadata', 'SecureConfig', { error: e });
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
                message:
                    `${keyType.toUpperCase()} API key format doesn't match expected pattern. ` +
                    'This may be okay if the format has changed.',
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
        const testKeys = ['sk-test', 'test-key', 'demo-key', 'sample-key'];

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
    private keyCache: Map<string, string> = new Map();

    constructor(settings: YouTubePluginSettings) {
        this.settings = settings;
    }

    /**
     * Get API key with environment variable fallback and auto-decryption
     * Uses async for AES-GCM decryption
     */
    async getApiKey(keyType: ApiKeyType): Promise<string> {
        // Check cache first
        const cached = this.keyCache.get(keyType);
        if (cached) {
            securityAudit.logKeyAccess(keyType, true);
            return cached;
        }

        const rawKey = this.settings[keyType];

        // Return empty if no key stored
        if (!rawKey || rawKey.length === 0) {
            return this.getFromEnvironment(keyType);
        }

        // Check if key is encrypted and decrypt if needed
        if (this.keyStorage.isEncrypted(rawKey)) {
            try {
                const decrypted = await this.keyStorage.decryptKey(rawKey);
                if (decrypted) {
                    this.keyCache.set(keyType, decrypted);
                    securityAudit.logKeyAccess(keyType, true);
                    return decrypted;
                }
            } catch (error) {
                securityAudit.logDecryption(false, keyType, error instanceof Error ? error.message : 'Unknown error');
                securityAudit.logKeyAccess(keyType, false);
                logger.warn('Failed to decrypt key', 'SecureConfig', { error });
            }
        }

        securityAudit.logKeyAccess(keyType, true);
        return rawKey;
    }

    /**
     * Get API key synchronously (uses cached value or raw key)
     * Falls back to raw key if not cached
     */
    getApiKeySync(keyType: ApiKeyType): string {
        const cached = this.keyCache.get(keyType);
        if (cached) {
            return cached;
        }

        const rawKey = this.settings[keyType];
        if (!rawKey || rawKey.length === 0) {
            return this.getFromEnvironment(keyType);
        }

        // If not encrypted, return directly
        if (!this.keyStorage.isEncrypted(rawKey)) {
            return rawKey;
        }

        // Cannot decrypt synchronously - return empty and log warning
        logger.warn(`Key ${keyType} requires async decryption. Use getApiKey() instead.`, 'SecureConfig');
        return '';
    }

    /**
     * Store API key with encryption
     * Returns the encrypted value for storage
     */
    async setApiKey(keyType: ApiKeyType, apiKey: string): Promise<string> {
        const trimmedKey = apiKey.trim();

        // Validate before storing
        const validation = this.validator.validateKeyFormat(keyType, trimmedKey);
        if (!validation.valid) {
            throw new Error(validation.message ?? 'Invalid API key format');
        }

        // Encrypt the key before returning for storage
        const encrypted = await this.keyStorage.encryptKey(trimmedKey);
        this.keyStorage.storeMetadata(keyType, keyType);

        // Update cache
        this.keyCache.set(keyType, trimmedKey);
        securityAudit.logKeySet(keyType);

        return encrypted;
    }

    /**
     * Get masked API key for UI display
     */
    async getMaskedApiKey(keyType: ApiKeyType): Promise<string> {
        const rawKey = await this.getApiKey(keyType);

        if (!rawKey || rawKey.length === 0) {
            return 'Not set';
        }

        return this.validator.maskKey(rawKey);
    }

    /**
     * Check if API key is set
     */
    async hasApiKey(keyType: ApiKeyType): Promise<boolean> {
        const key = await this.getApiKey(keyType);
        return Boolean(key && key.length > 0);
    }

    /**
     * Clear an API key securely
     */
    clearApiKey(keyType: ApiKeyType): void {
        // Clear from cache
        this.keyCache.delete(keyType);

        // Clear from storage
        this.settings[keyType] = '';
        this.keyStorage.clearMetadata(keyType);

        securityAudit.logKeyClear(keyType);
    }

    /**
     * Clear all API keys
     */
    clearAllApiKeys(): void {
        const keyTypes = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ] as const;

        for (const keyType of keyTypes) {
            this.clearApiKey(keyType);
        }

        this.keyStorage.clearAllMetadata();
        this.keyCache.clear();
    }

    /**
     * Clear key cache (for security)
     */
    clearCache(): void {
        this.keyCache.clear();
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

        const prefix = this.settings.environmentPrefix ?? 'YTC';
        const envVarName = `${prefix}_${keyType.toUpperCase().replace('APIKEY', '_API_KEY')}`;

        // Obsidian plugins can access process.env in desktop app
        try {
            // Try Electron/Node.js environment first
            if (typeof process !== 'undefined' && process.env) {
                return process.env[envVarName] ?? '';
            }

            // Check for window-level environment (some setups)
            if (typeof window !== 'undefined') {
                const winEnv = (window as { env?: Record<string, string> }).env;
                if (winEnv?.[envVarName]) {
                    return winEnv[envVarName] ?? '';
                }
            }
        } catch (e) {
            logger.debug('Environment variable access failed', 'SecureConfig', { error: e });
        }

        return '';
    }

    /**
     * Comprehensive security validation
     */
    async validateSecurityConfiguration(): Promise<SecurityValidationResult> {
        const result: SecurityValidationResult = {
            isValid: true,
            warnings: [],
            errors: [],
            suggestions: [],
        };

        // Check if using environment variables (most secure)
        if (this.settings.useEnvironmentVariables) {
            result.suggestions.push(
                '✅ Using environment variables - this is the most secure method',
                'Make sure to set environment variables before starting Obsidian',
            );
            return result;
        }

        const hasStoredKeys = await this.validateStoredKeys(result);

        if (!hasStoredKeys) {
            result.warnings.push('No API keys configured');
            result.suggestions.push(
                'Add API keys in settings to enable AI features',
                'Consider using environment variables for better security',
            );
        }

        this.addSecurityBestPractices(result);

        return result;
    }

    /**
     * Validate all stored API keys
     */
    private async validateStoredKeys(result: SecurityValidationResult): Promise<boolean> {
        const keyTypes = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ] as const;

        let hasStoredKeys = false;

        for (const keyType of keyTypes) {
            const apiKey = await this.getApiKey(keyType);
            if (!apiKey || apiKey.length === 0) continue;

            hasStoredKeys = true;
            this.validateSingleKey(keyType, apiKey, result);
        }

        return hasStoredKeys;
    }

    /**
     * Validate a single API key
     */
    private validateSingleKey(
        keyType: string,
        apiKey: string,
        result: SecurityValidationResult,
    ): void {
        const providerName = keyType.replace('ApiKey', '');

        const formatValidation = this.validator.validateKeyFormat(providerName, apiKey);
        if (!formatValidation.valid) {
            result.warnings.push(`${keyType}: ${formatValidation.message}`);
            result.isValid = false;
        }

        const health = this.validator.checkKeyHealth(providerName, apiKey);
        if (!health.isHealthy) {
            result.warnings.push(`${keyType}: ${health.warnings.join(', ')}`);
            result.isValid = false;
        }

        const rawStored = this.settings[keyType as keyof typeof this.settings];
        if (rawStored && typeof rawStored === 'string' && !this.keyStorage.isEncrypted(rawStored)) {
            result.warnings.push(
                `${keyType}: Key is stored in plain text. Consider re-entering your key to enable encryption.`,
            );
        }
    }

    /**
     * Add security best practices to result
     */
    private addSecurityBestPractices(result: SecurityValidationResult): void {
        result.suggestions.push(
            '🔒 Security Best Practices:',
            '• Use environment variables when possible',
            '• Rotate API keys regularly',
            '• Never commit API keys to version control',
            '• Use scoped keys with minimal permissions',
            '• Monitor API usage for unusual activity',
        );
    }

    /**
     * Get API key rotation recommendations
     */
    getRotationRecommendations(): Array<{
        keyType: string;
        lastRotated: number;
        shouldRotate: boolean;
        reason: string;
    }> {
        const recommendations: Array<{ keyType: string; lastRotated: number; shouldRotate: boolean; reason: string }> =
            [];
        const metadata = this.keyStorage.getAllMetadata();
        const now = Date.now();
        const rotationDays = 90; // Recommended rotation period
        const rotationMs = rotationDays * 24 * 60 * 60 * 1000;

        const keyTypes = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ] as const;

        for (const keyType of keyTypes) {
            const meta = metadata[keyType];
            if (!meta?.lastModified) {
                recommendations.push({
                    keyType,
                    lastRotated: 0,
                    shouldRotate: false,
                    reason: 'No rotation history available',
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
                    ? `Key is ${Math.round(timeSinceRotation / (30 * 24 * 60 * 60 * 1000))} ` +
                      `days old (recommend rotating every ${rotationDays} days)`
                    : 'Key is within recommended rotation period',
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
    async exportSafeSettings(): Promise<Partial<YouTubePluginSettings>> {
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
            customPrompts: this.settings.customPrompts,
            customTimeouts: this.settings.customTimeouts,
            modelOptionsCache: this.settings.modelOptionsCache,
            modelCacheTimestamps: this.settings.modelCacheTimestamps,
        };

        // Add masked API keys (for reference, not functional)
        const keyTypes = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ] as const;

        for (const keyType of keyTypes) {
            if (await this.hasApiKey(keyType)) {
                safe[keyType] = await this.getMaskedApiKey(keyType);
            }
        }

        return safe;
    }

    /**
     * Get security audit summary
     */
    getSecuritySummary(): ReturnType<SecurityAuditService['getSummary']> {
        return securityAudit.getSummary();
    }

    /**
     * Get security concerns
     */
    getSecurityConcerns(): ReturnType<SecurityAuditService['checkSecurityConcerns']> {
        return securityAudit.checkSecurityConcerns();
    }
}
