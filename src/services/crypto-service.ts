/**
 * Cryptography service for secure API key storage
 *
 * SECURITY FEATURES:
 * - AES-GCM encryption (256-bit key)
 * - PBKDF2 key derivation (100,000 iterations)
 * - Device-specific salt generation
 * - Version tracking for migration
 */

import { Result, ok, err } from '../types/result';

/** Encryption version for migration support */
export const CRYPTO_VERSION = 2;

/** Legacy XOR version identifier */
export const LEGACY_VERSION = 1;

/** Encryption result with metadata */
export interface EncryptionResult {
    encrypted: string;
    version: number;
    salt: string;
    iv: string;
}

/** Decryption result */
export interface DecryptionResult {
    plaintext: string;
    wasLegacy: boolean;
}

/** Crypto service error types */
export type CryptoError =
    | { type: 'encryption_failed'; message: string }
    | { type: 'decryption_failed'; message: string }
    | { type: 'invalid_format'; message: string }
    | { type: 'unsupported_version'; version: number; message: string };

/**
 * Cryptography service using Web Crypto API
 */
export class CryptoService {
    private static readonly ALGORITHM = 'AES-GCM';
    private static readonly KEY_LENGTH = 256;
    private static readonly IV_LENGTH = 12;
    private static readonly SALT_LENGTH = 16;
    private static readonly PBKDF2_ITERATIONS = 100000;

    /**
     * Check if Web Crypto API is available
     */
    static isAvailable(): boolean {
        return typeof window !== 'undefined' &&
            window.crypto !== undefined &&
            window.crypto.subtle !== undefined;
    }

    /**
     * Encrypt a plaintext string using AES-GCM
     */
    static async encrypt(plaintext: string): Promise<Result<EncryptionResult, CryptoError>> {
        if (!this.isAvailable()) {
            return err({ type: 'encryption_failed', message: 'Web Crypto API not available' });
        }

        try {
            // Generate random salt and IV
            const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
            const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

            // Derive encryption key
            const keyMaterial = await this.deriveKey(salt);

            // Encode plaintext
            const encoded = new TextEncoder().encode(plaintext);

            // Encrypt
            const encrypted = await window.crypto.subtle.encrypt(
                {
                    name: this.ALGORITHM,
                    iv: iv,
                },
                keyMaterial,
                encoded
            );

            return ok({
                encrypted: this.bufferToBase64(encrypted),
                version: CRYPTO_VERSION,
                salt: this.bufferToBase64(salt),
                iv: this.bufferToBase64(iv),
            });
        } catch (error) {
            return err({
                type: 'encryption_failed',
                message: error instanceof Error ? error.message : 'Unknown encryption error',
            });
        }
    }

    /**
     * Decrypt an encrypted string
     */
    static async decrypt(encryptedData: EncryptionResult): Promise<Result<DecryptionResult, CryptoError>> {
        if (!this.isAvailable()) {
            return err({ type: 'decryption_failed', message: 'Web Crypto API not available' });
        }

        try {
            // Validate version
            if (encryptedData.version !== CRYPTO_VERSION) {
                return err({ type: 'unsupported_version', version: encryptedData.version, message: `Unsupported encryption version: ${encryptedData.version}` });
            }

            // Decode base64 values
            const salt = this.base64ToBuffer(encryptedData.salt);
            const iv = this.base64ToBuffer(encryptedData.iv);
            const encrypted = this.base64ToBuffer(encryptedData.encrypted);

            // Derive decryption key
            const keyMaterial = await this.deriveKey(salt);

            // Decrypt
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: this.ALGORITHM,
                    iv: iv,
                },
                keyMaterial,
                encrypted
            );

            const plaintext = new TextDecoder().decode(decrypted);

            return ok({
                plaintext,
                wasLegacy: false,
            });
        } catch (error) {
            return err({
                type: 'decryption_failed',
                message: error instanceof Error ? error.message : 'Unknown decryption error',
            });
        }
    }

    /**
     * Serialize encryption result for storage
     */
    static serialize(result: EncryptionResult): string {
        return JSON.stringify(result);
    }

    /**
     * Parse encrypted data from storage
     */
    static parse(stored: string): Result<EncryptionResult, CryptoError> {
        try {
            const parsed = JSON.parse(stored) as unknown;

            if (!this.isValidEncryptionResult(parsed)) {
                return err({ type: 'invalid_format', message: 'Invalid encryption result format' });
            }

            return ok(parsed);
        } catch {
            return err({ type: 'invalid_format', message: 'Failed to parse encrypted data' });
        }
    }

    /**
     * Check if a stored value is encrypted with new format
     */
    static isEncrypted(value: string): boolean {
        try {
            const parsed = JSON.parse(value) as unknown;
            return this.isValidEncryptionResult(parsed);
        } catch {
            return false;
        }
    }

    /**
     * Check if a stored value is legacy XOR format
     */
    static isLegacyEncrypted(value: string): boolean {
        if (!value || value.length < 10) return false;

        // Legacy format is base64 without JSON structure
        try {
            // Check if it's valid base64 but not JSON
            atob(value);
            // If it parses as JSON with version field, it's new format
            const parsed = JSON.parse(value) as { version?: number };
            return !('version' in parsed);
        } catch {
            return false;
        }
    }

    /**
     * Derive encryption key from device-specific factors
     */
    private static async deriveKey(salt: Uint8Array): Promise<CryptoKey> {
        // Get device-specific key material
        const keyMaterial = await this.getDeviceKeyMaterial();

        // Import as raw key
        const baseKey = await window.crypto.subtle.importKey(
            'raw',
            keyMaterial,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        // Derive AES key using PBKDF2
        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256',
            },
            baseKey,
            {
                name: this.ALGORITHM,
                length: this.KEY_LENGTH,
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Generate device-specific key material
     */
    private static async getDeviceKeyMaterial(): Promise<Uint8Array> {
        // Combine multiple device factors for key material
        const factors = [
            navigator.userAgent,
            navigator.language,
            screen.width.toString(),
            screen.height.toString(),
            new Date().getTimezoneOffset().toString(),
            // Add vault-specific factor if available
            this.getVaultPath(),
        ].join('|');

        // Hash the factors to create key material
        const encoded = new TextEncoder().encode(factors);
        const hash = await window.crypto.subtle.digest('SHA-256', encoded);

        return new Uint8Array(hash);
    }

    /**
     * Get vault path for additional uniqueness
     */
    private static getVaultPath(): string {
        try {
            const app = (window as { app?: { vault?: { adapter?: { basePath?: string } } } }).app;
            return app?.vault?.adapter?.basePath ?? 'default-vault';
        } catch {
            return 'default-vault';
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    private static bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            const byte = bytes[i];
            if (byte !== undefined) {
                binary += String.fromCharCode(byte);
            }
        }
        return btoa(binary);
    }

    /**
     * Convert base64 string to Uint8Array
     */
    private static base64ToBuffer(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Type guard for EncryptionResult
     */
    private static isValidEncryptionResult(value: unknown): value is EncryptionResult {
        if (typeof value !== 'object' || value === null) return false;

        const obj = value as Record<string, unknown>;
        return (
            typeof obj.encrypted === 'string' &&
            typeof obj.version === 'number' &&
            typeof obj.salt === 'string' &&
            typeof obj.iv === 'string'
        );
    }
}

/**
 * Legacy XOR decryption for migration
 * Used to decrypt old XOR-encrypted keys before re-encrypting with AES-GCM
 */
export class LegacyCryptoService {
    private static readonly OBFUSCATION_KEY_PREFIX = 'ytc_sec_';

    /**
     * De-obfuscate legacy XOR-encrypted key
     */
    static deobfuscate(obfuscated: string): string {
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
            const recovered = dataBytes.map((byte, i) => {
                const keyByte = keyBytes[i % keyBytes.length] ?? 0;
                return byte ^ keyByte;
            });

            return String.fromCharCode(...recovered);
        } catch {
            return '';
        }
    }

    /**
     * Check if value is legacy obfuscated format
     */
    static isLegacy(value: string): boolean {
        if (!value || value.length < 10) return false;

        try {
            atob(value);
            // If it parses as JSON, it's not legacy
            JSON.parse(value);
            return false;
        } catch {
            return true;
        }
    }

    /**
     * Generate device-specific obfuscation key (same as original)
     */
    private static generateObfuscationKey(): string {
        const factors = [
            navigator.userAgent,
            navigator.language,
            screen.width.toString(),
            screen.height.toString(),
            this.getVaultPath(),
        ];

        // Simple hash function to create numeric key
        let hash = 0;
        const combined = factors.join('|') + '1.0.0';
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return this.OBFUSCATION_KEY_PREFIX + Math.abs(hash).toString(16);
    }

    /**
     * Get vault path (same as original)
     */
    private static getVaultPath(): string {
        try {
            const app = (window as { app?: { vault?: { adapter?: { basePath?: string } } } }).app;
            return app?.vault?.adapter?.basePath ?? 'default';
        } catch {
            return 'default';
        }
    }

    /**
     * Convert string to byte array
     */
    private static stringToBytes(str: string): number[] {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    }
}

/**
 * Migration helper to convert legacy keys to new format
 */
export class CryptoMigration {
    /**
     * Migrate a legacy XOR-encrypted key to AES-GCM
     */
    static async migrateLegacyKey(legacyValue: string): Promise<Result<string, CryptoError>> {
        // Decrypt using legacy method
        const plaintext = LegacyCryptoService.deobfuscate(legacyValue);

        if (!plaintext) {
            return err({ type: 'decryption_failed', message: 'Failed to decrypt legacy key' });
        }

        // Re-encrypt with new method
        const encryptResult = await CryptoService.encrypt(plaintext);

        if (encryptResult.isErr()) {
            return encryptResult;
        }

        return ok(CryptoService.serialize(encryptResult.value));
    }

    /**
     * Check if a value needs migration
     */
    static needsMigration(value: string): boolean {
        if (!value) return false;

        // Needs migration if it's legacy XOR but not new AES-GCM
        return LegacyCryptoService.isLegacy(value) && !CryptoService.isEncrypted(value);
    }
}
