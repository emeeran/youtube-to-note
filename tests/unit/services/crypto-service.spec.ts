/**
 * Unit tests for Crypto Service
 */

import { CryptoService, CryptoMigration, LegacyCryptoService, CRYPTO_VERSION } from '../../../src/services/crypto-service';

describe('CryptoService', () => {
    beforeAll(() => {
        // Ensure Web Crypto API is available
        if (!CryptoService.isAvailable()) {
            console.warn('Web Crypto API not available, some tests may be skipped');
        }
    });

    describe('isAvailable', () => {
        it('should check if Web Crypto API is available', () => {
            const available = CryptoService.isAvailable();
            expect(typeof available).toBe('boolean');
        });
    });

    describe('encrypt and decrypt', () => {
        it('should encrypt and decrypt a string', async () => {
            if (!CryptoService.isAvailable()) {
                console.warn('Skipping test: Web Crypto API not available');
                return;
            }

            const plaintext = 'my-secret-api-key-12345';

            const encryptResult = await CryptoService.encrypt(plaintext);
            expect(encryptResult.isOk()).toBe(true);

            if (encryptResult.isOk()) {
                const { encrypted, version, salt, iv } = encryptResult.value;

                expect(encrypted).toBeDefined();
                expect(version).toBe(CRYPTO_VERSION);
                expect(salt).toBeDefined();
                expect(iv).toBeDefined();

                // Decrypt
                const decryptResult = await CryptoService.decrypt({
                    encrypted,
                    version,
                    salt,
                    iv,
                });

                expect(decryptResult.isOk()).toBe(true);
                if (decryptResult.isOk()) {
                    expect(decryptResult.value.plaintext).toBe(plaintext);
                    expect(decryptResult.value.wasLegacy).toBe(false);
                }
            }
        });

        it('should produce different ciphertext for same plaintext', async () => {
            if (!CryptoService.isAvailable()) return;

            const plaintext = 'test-key';

            const result1 = await CryptoService.encrypt(plaintext);
            const result2 = await CryptoService.encrypt(plaintext);

            if (result1.isOk() && result2.isOk()) {
                // Different due to random IV and salt
                expect(result1.value.encrypted).not.toBe(result2.value.encrypted);
            }
        });

        it('should handle empty string', async () => {
            if (!CryptoService.isAvailable()) return;

            const plaintext = '';

            const encryptResult = await CryptoService.encrypt(plaintext);
            expect(encryptResult.isOk()).toBe(true);
        });

        it('should handle special characters', async () => {
            if (!CryptoService.isAvailable()) return;

            const plaintext = 'key-with_special.chars!@#$%^&*()';

            const encryptResult = await CryptoService.encrypt(plaintext);
            expect(encryptResult.isOk()).toBe(true);

            if (encryptResult.isOk()) {
                const decryptResult = await CryptoService.decrypt(encryptResult.value);
                expect(decryptResult.isOk()).toBe(true);
                if (decryptResult.isOk()) {
                    expect(decryptResult.value.plaintext).toBe(plaintext);
                }
            }
        });

        it('should handle unicode characters', async () => {
            if (!CryptoService.isAvailable()) return;

            const plaintext = '你好世界 🌍 مرحبا';

            const encryptResult = await CryptoService.encrypt(plaintext);
            expect(encryptResult.isOk()).toBe(true);

            if (encryptResult.isOk()) {
                const decryptResult = await CryptoService.decrypt(encryptResult.value);
                expect(decryptResult.isOk()).toBe(true);
                if (decryptResult.isOk()) {
                    expect(decryptResult.value.plaintext).toBe(plaintext);
                }
            }
        });
    });

    describe('serialize and parse', () => {
        it('should serialize and parse encryption result', async () => {
            if (!CryptoService.isAvailable()) return;

            const plaintext = 'test-key';
            const encryptResult = await CryptoService.encrypt(plaintext);

            if (encryptResult.isOk()) {
                const serialized = CryptoService.serialize(encryptResult.value);
                expect(typeof serialized).toBe('string');

                const parseResult = CryptoService.parse(serialized);
                expect(parseResult.isOk()).toBe(true);

                if (parseResult.isOk()) {
                    expect(parseResult.value.encrypted).toBe(encryptResult.value.encrypted);
                    expect(parseResult.value.version).toBe(encryptResult.value.version);
                }
            }
        });

        it('should fail to parse invalid JSON', () => {
            const parseResult = CryptoService.parse('not valid json');
            expect(parseResult.isErr()).toBe(true);
        });

        it('should fail to parse invalid structure', () => {
            const parseResult = CryptoService.parse('{"foo":"bar"}');
            expect(parseResult.isErr()).toBe(true);
        });
    });

    describe('isEncrypted', () => {
        it('should detect encrypted values', async () => {
            if (!CryptoService.isAvailable()) return;

            const plaintext = 'test-key';
            const encryptResult = await CryptoService.encrypt(plaintext);

            if (encryptResult.isOk()) {
                const serialized = CryptoService.serialize(encryptResult.value);
                expect(CryptoService.isEncrypted(serialized)).toBe(true);
            }
        });

        it('should not detect plain text as encrypted', () => {
            expect(CryptoService.isEncrypted('plain-text')).toBe(false);
        });
    });
});

describe('LegacyCryptoService', () => {
    describe('deobfuscate', () => {
        it('should return empty for empty input', () => {
            const result = LegacyCryptoService.deobfuscate('');
            expect(result).toBe('');
        });

        it('should return empty for invalid base64', () => {
            const result = LegacyCryptoService.deobfuscate('not-valid-base64!!!');
            expect(result).toBe('');
        });
    });

    describe('isLegacy', () => {
        it('should detect legacy format', () => {
            // Base64 without JSON structure
            expect(LegacyCryptoService.isLegacy('dGVzdC1rZXk=')).toBe(true);
        });

        it('should not detect JSON as legacy', () => {
            expect(LegacyCryptoService.isLegacy('{"version":2}')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(LegacyCryptoService.isLegacy('')).toBe(false);
        });
    });
});

describe('CryptoMigration', () => {
    describe('needsMigration', () => {
        it('should return false for empty value', () => {
            expect(CryptoMigration.needsMigration('')).toBe(false);
        });

        it('should return false for new format', async () => {
            if (!CryptoService.isAvailable()) return;

            const encryptResult = await CryptoService.encrypt('test');
            if (encryptResult.isOk()) {
                const serialized = CryptoService.serialize(encryptResult.value);
                expect(CryptoMigration.needsMigration(serialized)).toBe(false);
            }
        });
    });
});
