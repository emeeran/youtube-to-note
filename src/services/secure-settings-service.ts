import { EncryptionService } from './encryption-service';
import { logger } from './logger';
import { YouTubePluginSettings } from '../types/types';

/**
 * Secure settings service that handles encryption of sensitive data
 */


export interface SecureSettingsConfig {
    encryptApiKeys: boolean;
    validateEncryption: boolean;
    backupEncryptedKeys: boolean;
}

export class SecureSettingsService {
    private static readonly DEFAULT_CONFIG: SecureSettingsConfig = {
        encryptApiKeys: true,
        validateEncryption: true,
        backupEncryptedKeys: true
    };

    /**
     * Save settings with encryption for sensitive data
     */
    static async saveSecureSettings(
        settings: YouTubePluginSettings,
        saveDataFn: (data: YouTubePluginSettings) => Promise<void>
    ): Promise<void> {
        try {
            logger.info('Saving settings securely', 'SecureSettings');

            const config = this.DEFAULT_CONFIG;
            let settingsToSave = { ...settings };

            // Validate encryption is working if enabled
            if (config.encryptApiKeys && config.validateEncryption) {
                const encryptionValid = await EncryptionService.validateEncryption();
                if (!encryptionValid) {
                    logger.error('Encryption validation failed, saving without encryption', 'SecureSettings');
                    const decryptedSettings = await EncryptionService.decryptApiKeys(settingsToSave as any);
                    settingsToSave = { ...settingsToSave, ...decryptedSettings };
                }
            }

            // Encrypt API keys if enabled
            if (config.encryptApiKeys) {
                const encryptedSettings = await EncryptionService.encryptApiKeys(settingsToSave as any);
                settingsToSave = { ...settingsToSave, ...encryptedSettings };

                // Create backup of encrypted keys
                if (config.backupEncryptedKeys) {
                    await this.createBackup(settingsToSave);
                }
            }

            await saveDataFn(settingsToSave);

            logger.info('Settings saved securely', 'SecureSettings', {
                hasGeminiKey: !!(settingsToSave.geminiApiKey),
                hasGroqKey: !!(settingsToSave.groqApiKey),
                encryptionEnabled: config.encryptApiKeys
            });

        } catch (error) {
            logger.error('Failed to save settings securely', 'SecureSettings', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Load settings with decryption of sensitive data
     */
    static async loadSecureSettings(
        loadDataFn: () => Promise<Partial<YouTubePluginSettings>>,
        defaultSettings: YouTubePluginSettings
    ): Promise<YouTubePluginSettings> {
        try {
            logger.info('Loading settings securely', 'SecureSettings');

            const loadedSettings = await loadDataFn();
            const settings: YouTubePluginSettings = { ...defaultSettings, ...loadedSettings };

            // Decrypt API keys if they are encrypted
            const decryptedPartialSettings = await EncryptionService.decryptApiKeys(settings as any);
            const decryptedSettings: YouTubePluginSettings = { ...settings, ...decryptedPartialSettings };

            logger.info('Settings loaded securely', 'SecureSettings', {
                hasGeminiKey: !!(decryptedSettings.geminiApiKey),
                hasGroqKey: !!(decryptedSettings.groqApiKey),
                hadEncryptedKeys: Object.entries(settings).some(([key, value]) =>
                    EncryptionService.isApiKeyField(key) && value && EncryptionService.isEncrypted(value as string)
                )
            });

            return decryptedSettings;

        } catch (error) {
            logger.error('Failed to load settings securely', 'SecureSettings', {
                error: error instanceof Error ? error.message : String(error)
            });

            // Fallback to default settings
            logger.warn('Falling back to default settings', 'SecureSettings');
            return defaultSettings;
        }
    }

    /**
     * Migrate unencrypted settings to encrypted format
     */
    static async migrateToEncrypted(
        currentSettings: YouTubePluginSettings,
        saveDataFn: (data: YouTubePluginSettings) => Promise<void>
    ): Promise<YouTubePluginSettings> {
        try {
            logger.info('Migrating settings to encrypted format', 'SecureSettings');

            // Check if migration is needed
            const hasUnencryptedKeys = Object.entries(currentSettings).some(([key, value]) =>
                EncryptionService.isApiKeyField(key) && value && !EncryptionService.isEncrypted(value as string)
            );

            if (!hasUnencryptedKeys) {
                logger.info('No migration needed - all keys already encrypted', 'SecureSettings');
                return currentSettings;
            }

            // Create backup before migration
            await this.createBackup(currentSettings, 'pre-migration');

            // Encrypt the keys
            const encryptedPartialSettings = await EncryptionService.encryptApiKeys(currentSettings as any);
            const encryptedSettings: YouTubePluginSettings = { ...currentSettings, ...encryptedPartialSettings };

            // Save the encrypted settings
            await saveDataFn(encryptedSettings);

            logger.info('Migration to encrypted format completed', 'SecureSettings');

            return encryptedSettings;

        } catch (error) {
            logger.error('Failed to migrate to encrypted format', 'SecureSettings', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Rotate encryption key for all sensitive data
     */
    static async rotateEncryptionKey(
        currentSettings: YouTubePluginSettings,
        saveDataFn: (data: YouTubePluginSettings) => Promise<void>
    ): Promise<YouTubePluginSettings> {
        try {
            logger.info('Rotating encryption key for settings', 'SecureSettings');

            // Create backup before rotation
            await this.createBackup(currentSettings, 'pre-rotation');

            // Rotate encryption key
            const rotatedSettings = await EncryptionService.rotateEncryptionKey(currentSettings);

            // Save the re-encrypted settings
            await saveDataFn(rotatedSettings);

            logger.info('Encryption key rotation completed', 'SecureSettings');

            return rotatedSettings;

        } catch (error) {
            logger.error('Failed to rotate encryption key', 'SecureSettings', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Create backup of settings
     */
    private static async createBackup(
        settings: YouTubePluginSettings,
        suffix: string = 'auto'
    ): Promise<void> {
        try {
            const backupKey = `yt-clipper-settings-backup-${suffix}-${Date.now()}`;
            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.3.5',
                settings
            };

            // Create backup without sensitive data for safety
            const safeBackup = {
                ...backupData,
                settings: {
                    ...settings,
                    geminiApiKey: settings.geminiApiKey ? '[ENCRYPTED]' : '',
                    groqApiKey: settings.groqApiKey ? '[ENCRYPTED]' : ''
                }
            };

            localStorage.setItem(backupKey, JSON.stringify(safeBackup));

            logger.debug(`Created settings backup: ${backupKey}`, 'SecureSettings');

            // Clean old backups (keep last 5)
            this.cleanOldBackups();

        } catch (error) {
            logger.warn('Failed to create settings backup', 'SecureSettings', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Clean old backups, keeping only the most recent ones
     */
    private static cleanOldBackups(): void {
        try {
            const backupKeys = Object.keys(localStorage).filter(key =>
                key.startsWith('yt-clipper-settings-backup-')
            );

            if (backupKeys.length <= 5) return;

            // Sort by timestamp (newest first)
            backupKeys.sort((a, b) => {
                const aTime = parseInt(a.split('-').pop() || '0');
                const bTime = parseInt(b.split('-').pop() || '0');
                return bTime - aTime;
            });

            // Remove oldest backups
            const backupsToRemove = backupKeys.slice(5);
            backupsToRemove.forEach(key => localStorage.removeItem(key));

            logger.debug(`Cleaned up ${backupsToRemove.length} old backups`, 'SecureSettings');

        } catch (error) {
            logger.warn('Failed to clean old backups', 'SecureSettings', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Get security status information
     */
    static getSecurityStatus(settings: YouTubePluginSettings): {
        encryptionEnabled: boolean;
        hasEncryptedKeys: boolean;
        hasUnencryptedKeys: boolean;
        encryptionSupported: boolean;
        hasMasterKey: boolean;
        recommendations: string[];
    } {
        const encryptionInfo = EncryptionService.getEncryptionInfo();
        const hasEncryptedKeys = Object.entries(settings).some(([key, value]) =>
            EncryptionService.isApiKeyField(key) && value && EncryptionService.isEncrypted(value as string)
        );
        const hasUnencryptedKeys = Object.entries(settings).some(([key, value]) =>
            EncryptionService.isApiKeyField(key) && value && !EncryptionService.isEncrypted(value as string)
        );

        const recommendations: string[] = [];

        if (!encryptionInfo.isSupported) {
            recommendations.push('Encryption not supported in this environment');
        } else if (hasUnencryptedKeys) {
            recommendations.push('Migrate unencrypted API keys to encrypted format');
        }

        if (!encryptionInfo.hasMasterKey) {
            recommendations.push('No encryption key found - new key will be generated');
        }

        return {
            encryptionEnabled: this.DEFAULT_CONFIG.encryptApiKeys && encryptionInfo.isSupported,
            hasEncryptedKeys,
            hasUnencryptedKeys,
            encryptionSupported: encryptionInfo.isSupported,
            hasMasterKey: encryptionInfo.hasMasterKey,
            recommendations
        };
    }

    /**
     * Validate settings security
     */
    static async validateSecurity(settings: YouTubePluginSettings): Promise<{
        isValid: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];

        try {
            // Check if encryption is working
            if (this.DEFAULT_CONFIG.encryptApiKeys) {
                const encryptionValid = await EncryptionService.validateEncryption();
                if (!encryptionValid) {
                    issues.push('Encryption validation failed');
                    recommendations.push('Check browser support for Web Crypto API');
                }
            }

            // Check for weak or missing API keys
            if (settings.geminiApiKey && settings.geminiApiKey.length < 10) {
                issues.push('Gemini API key appears to be too short');
            }

            if (settings.groqApiKey && settings.groqApiKey.length < 10) {
                issues.push('Groq API key appears to be too short');
            }

            // Check output path security
            if (settings.outputPath && settings.outputPath.includes('..')) {
                issues.push('Output path contains potentially unsafe directory traversal');
            }

            // Security recommendations
            if (!settings.geminiApiKey && !settings.groqApiKey) {
                recommendations.push('Configure at least one AI provider API key');
            }

            const securityStatus = this.getSecurityStatus(settings);
            recommendations.push(...securityStatus.recommendations);

            return {
                isValid: issues.length === 0,
                issues,
                recommendations
            };

        } catch (error) {
            return {
                isValid: false,
                issues: [`Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                recommendations: ['Check browser security settings and try again']
            };
        }
    }
}