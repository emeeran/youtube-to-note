/**
 * Unit tests for Crypto Service
 */

import { CryptoService, CryptoMigration, LegacyCryptoService, CRYPTO_VERSION } from '../../../src/services/crypto-service';

// Mock Web Crypto API for jsdom environment
const mockSubtle = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateKey: jest.fn(),
    deriveKey: jest.fn(),
    importKey: jest.fn(),
    exportKey: jest.fn(),
};

const mockCrypto = {
    subtle: mockSubtle,
    getRandomValues: jest.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    }),
};

// Setup mocks before tests
beforeAll(() => {
    Object.defineProperty(global, 'crypto', {
        value: mockCrypto,
        writable: true,
    });
});

describe('CryptoService', () => {
    describe('isAvailable', () => {
        it('should check if Web Crypto API is available', () => {
            // With our mock, it should be available
            const available = CryptoService.isAvailable();
            expect(typeof available).toBe('boolean');
        });
    });

    describe('serialize and parse', () => {
        it('should serialize encryption result', () => {
            const result = {
                encrypted: 'encrypted-data',
                version: CRYPTO_VERSION,
                salt: 'c2FsdA==', // base64 'salt'
                iv: 'aXY=', // base64 'iv'
            };

            const serialized = CryptoService.serialize(result);
            expect(typeof serialized).toBe('string');
            expect(serialized).toContain('encrypted');
            expect(serialized).toContain('version');
        });

        it('should parse valid JSON', () => {
            const data = {
                encrypted: 'test-encrypted',
                version: CRYPTO_VERSION,
                salt: 'test-salt',
                iv: 'test-iv',
            };
            const serialized = JSON.stringify(data);

            const parseResult = CryptoService.parse(serialized);
            expect(parseResult.isOk()).toBe(true);

            if (parseResult.isOk()) {
                expect(parseResult.value.encrypted).toBe('test-encrypted');
                expect(parseResult.value.version).toBe(CRYPTO_VERSION);
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
        it('should detect encrypted values with JSON structure', () => {
            const data = {
                encrypted: 'test',
                version: CRYPTO_VERSION,
                salt: 'test',
                iv: 'test',
            };
            const serialized = JSON.stringify(data);
            expect(CryptoService.isEncrypted(serialized)).toBe(true);
        });

        it('should not detect plain text as encrypted', () => {
            expect(CryptoService.isEncrypted('plain-text')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(CryptoService.isEncrypted('')).toBe(false);
        });

        it('should return false for short strings', () => {
            expect(CryptoService.isEncrypted('abc')).toBe(false);
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

        it('should return false for short strings', () => {
            expect(LegacyCryptoService.isLegacy('abc')).toBe(false);
        });
    });
});

describe('CryptoMigration', () => {
    describe('needsMigration', () => {
        it('should return false for empty value', () => {
            expect(CryptoMigration.needsMigration('')).toBe(false);
        });

        it('should return true for legacy base64 format', () => {
            // Simple base64 that doesn't look like JSON
            expect(CryptoMigration.needsMigration('dGVzdA==')).toBe(true);
        });

        it('should return false for new format JSON', () => {
            const newFormat = JSON.stringify({
                encrypted: 'test',
                version: CRYPTO_VERSION,
                salt: 'test',
                iv: 'test',
            });
            expect(CryptoMigration.needsMigration(newFormat)).toBe(false);
        });
    });
});
