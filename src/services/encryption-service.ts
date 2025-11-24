/**
 * Encryption service for secure storage of API keys and sensitive data
 */

import { logger } from './logger';

export interface EncryptionConfig {
    algorithm: string;
    keyDerivation: {
        iterations: number;
        saltLength: number;
        hashFunction: string;
    };
}

export class EncryptionService {
    private static readonly DEFAULT_CONFIG: EncryptionConfig = {
        algorithm: 'AES-GCM',
        keyDerivation: {
            iterations: 100000,
            saltLength: 32,
            hashFunction: 'SHA-256'
        }
    };

    private static readonly ENCRYPTED_PREFIX = 'encrypted:';
    private static readonly STORAGE_KEY = 'yt-clipper-encryption-key';

    /**
     * Generate a secure encryption key
     */
    private static async generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: this.DEFAULT_CONFIG.keyDerivation.iterations,
                hash: this.DEFAULT_CONFIG.keyDerivation.hashFunction
            },
            keyMaterial,
            { name: this.DEFAULT_CONFIG.algorithm, length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Generate a random salt
     */
    private static generateSalt(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(this.DEFAULT_CONFIG.keyDerivation.saltLength));
    }

    /**
     * Get or create the master encryption key
     */
    private static async getMasterKey(): Promise<string> {
        // Try to get existing key from localStorage
        let masterKey = localStorage.getItem(this.STORAGE_KEY);

        if (!masterKey) {
            // Generate a new key
            masterKey = this.generateSecureRandomString(64);
            localStorage.setItem(this.STORAGE_KEY, masterKey);
            logger.debug('Generated new master encryption key', 'EncryptionService');
        }

        return masterKey;
    }

    /**
     * Generate a cryptographically secure random string
     */
    private static generateSecureRandomString(length: number): string {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Encrypt sensitive data
     */
    static async encrypt(data: string): Promise<string> {
        try {
            const masterKey = await this.getMasterKey();
            const salt = this.generateSalt();
            const key = await this.generateKey(masterKey, salt);

            const encoder = new TextEncoder();
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: this.DEFAULT_CONFIG.algorithm,
                    iv
                },
                key,
                encoder.encode(data)
            );

            // Combine salt, IV, and encrypted data
            const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

            // Convert to base64 and add prefix
            const encryptedBase64 = btoa(String.fromCharCode(...combined));
            const result = this.ENCRYPTED_PREFIX + encryptedBase64;

            logger.debug('Data encrypted successfully', 'EncryptionService', {
                dataLength: data.length,
                encryptedLength: encryptedBase64.length
            });

            return result;
        } catch (error) {
            logger.error('Failed to encrypt data', 'EncryptionService', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error('Encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Decrypt sensitive data
     */
    static async decrypt(encryptedData: string): Promise<string> {
        try {
            if (!encryptedData.startsWith(this.ENCRYPTED_PREFIX)) {
                // Data is not encrypted, return as-is
                return encryptedData;
            }

            const masterKey = await this.getMasterKey();
            const encryptedBase64 = encryptedData.substring(this.ENCRYPTED_PREFIX.length);
            const combined = new Uint8Array(
                atob(encryptedBase64)
                    .split('')
                    .map(char => char.charCodeAt(0))
            );

            // Extract salt, IV, and encrypted data
            const salt = combined.slice(0, this.DEFAULT_CONFIG.keyDerivation.saltLength);
            const iv = combined.slice(
                this.DEFAULT_CONFIG.keyDerivation.saltLength,
                this.DEFAULT_CONFIG.keyDerivation.saltLength + 12
            );
            const data = combined.slice(this.DEFAULT_CONFIG.keyDerivation.saltLength + 12);

            const key = await this.generateKey(masterKey, salt);

            const decryptedData = await crypto.subtle.decrypt(
                {
                    name: this.DEFAULT_CONFIG.algorithm,
                    iv
                },
                key,
                data
            );

            const decoder = new TextDecoder();
            const result = decoder.decode(decryptedData);

            logger.debug('Data decrypted successfully', 'EncryptionService', {
                encryptedLength: encryptedData.length,
                decryptedLength: result.length
            });

            return result;
        } catch (error) {
            logger.error('Failed to decrypt data', 'EncryptionService', {
                error: error instanceof Error ? error.message : String(error),
                dataPrefix: encryptedData.substring(0, 20)
            });
            throw new Error('Decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Check if data is encrypted
     */
    static isEncrypted(data: string): boolean {
        return data.startsWith(this.ENCRYPTED_PREFIX);
    }

    /**
     * Encrypt API keys in settings
     */
    static async encryptApiKeys(settings: Record<string, string>): Promise<Record<string, string>> {
        const encryptedSettings: Record<string, string> = { ...settings };

        for (const [key, value] of Object.entries(settings)) {
            if (this.isApiKeyField(key) && value && !this.isEncrypted(value)) {
                encryptedSettings[key] = await this.encrypt(value);
                logger.debug(`Encrypted API key for field: ${key}`, 'EncryptionService');
            }
        }

        return encryptedSettings;
    }

    /**
     * Decrypt API keys in settings
     */
    static async decryptApiKeys(settings: Record<string, string>): Promise<Record<string, string>> {
        const decryptedSettings: Record<string, string> = { ...settings };

        for (const [key, value] of Object.entries(settings)) {
            if (this.isApiKeyField(key) && value && this.isEncrypted(value)) {
                try {
                    decryptedSettings[key] = await this.decrypt(value);
                    logger.debug(`Decrypted API key for field: ${key}`, 'EncryptionService');
                } catch (error) {
                    logger.warn(`Failed to decrypt API key for field: ${key}`, 'EncryptionService', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    // Keep original value if decryption fails
                }
            }
        }

        return decryptedSettings;
    }

    /**
     * Check if a field name suggests it contains an API key
     */
    public static isApiKeyField(fieldName: string): boolean {
        const apiKeyPatterns = [
            'apikey',
            'api_key',
            'secret',
            'token',
            'password',
            'key'
        ];

        const lowerFieldName = fieldName.toLowerCase();
        return apiKeyPatterns.some(pattern => lowerFieldName.includes(pattern));
    }

    /**
     * Rotate encryption key (re-encrypt all data with new key)
     */
    static async rotateEncryptionKey(settings: Record<string, string>): Promise<Record<string, string>> {
        logger.info('Rotating encryption key', 'EncryptionService');

        // First decrypt all data with old key
        const decryptedSettings = await this.decryptApiKeys(settings);

        // Remove old key from storage
        localStorage.removeItem(this.STORAGE_KEY);

        // Re-encrypt with new key
        const newEncryptedSettings = await this.encryptApiKeys(decryptedSettings);

        logger.info('Encryption key rotation completed', 'EncryptionService');
        return newEncryptedSettings;
    }

    /**
     * Validate encryption is working
     */
    static async validateEncryption(): Promise<boolean> {
        try {
            const testData = 'test-encryption-validation';
            const encrypted = await this.encrypt(testData);
            const decrypted = await this.decrypt(encrypted);

            const isValid = decrypted === testData;
            logger.debug(`Encryption validation ${isValid ? 'passed' : 'failed'}`, 'EncryptionService');

            return isValid;
        } catch (error) {
            logger.error('Encryption validation failed', 'EncryptionService', {
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Clear all encryption data
     */
    static clearEncryptionData(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        logger.info('Encryption data cleared', 'EncryptionService');
    }

    /**
     * Get encryption info for debugging
     */
    static getEncryptionInfo(): {
        hasMasterKey: boolean;
        algorithm: string;
        isSupported: boolean;
    } {
        const hasMasterKey = !!localStorage.getItem(this.STORAGE_KEY);
        const isSupported = !!crypto && !!crypto.subtle;

        return {
            hasMasterKey,
            algorithm: this.DEFAULT_CONFIG.algorithm,
            isSupported
        };
    }
}