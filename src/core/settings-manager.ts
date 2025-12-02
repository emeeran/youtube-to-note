/**
 * Settings Manager - Single Responsibility: Settings management
 * Handles loading, saving, validating, and managing plugin settings
 */

import { Plugin } from 'obsidian';
import { logger } from '../services/logger';
import { MESSAGES } from '../constants/index';
import { ValidationUtils } from '../lib/utils-consolidated';
import { YouTubePluginSettings } from '../types';

export interface SettingsManagerConfig {
    pluginKey: string;
    defaultSettings: YouTubePluginSettings;
}

export interface SettingsValidationResult {
    isValid: boolean;
    errors: string[];
}

export type SettingsChangeListener = (newSettings: YouTubePluginSettings) => void;

export class SettingsManager {
    private currentSettings: YouTubePluginSettings;
    private listeners: Set<SettingsChangeListener> = new Set();

    constructor(
        private plugin: Plugin,
        private config: SettingsManagerConfig
    ) {
        this.currentSettings = { ...config.defaultSettings };
    }

    /**
     * Load settings from plugin data
     */
    async loadSettings(): Promise<void> {
        try {
            const loadedSettings = await this.plugin.loadData();

            if (loadedSettings) {
                // Validate loaded settings
                const validation = this.validateSettings(loadedSettings);

                if (validation.isValid) {
                    this.currentSettings = { ...this.config.defaultSettings, ...loadedSettings };
                    logger.info('Settings loaded successfully', 'SettingsManager');
                } else {
                    logger.warn('Invalid settings found, using defaults', 'SettingsManager', {
                        errors: validation.errors
                    });
                    this.currentSettings = { ...this.config.defaultSettings };
                }
            } else {
                logger.info('No saved settings found, using defaults', 'SettingsManager');
                this.currentSettings = { ...this.config.defaultSettings };
            }

            this.notifyListeners();

        } catch (error) {
            logger.error('Failed to load settings', 'SettingsManager', {
                error: error instanceof Error ? error.message : String(error)
            });
            this.currentSettings = { ...this.config.defaultSettings };
        }
    }

    /**
     * Save current settings to plugin data
     */
    async saveSettings(): Promise<void> {
        try {
            const validation = this.validateSettings(this.currentSettings);

            if (!validation.isValid) {
                logger.error('Cannot save invalid settings', 'SettingsManager', {
                    errors: validation.errors
                });
                throw new Error('Invalid settings cannot be saved');
            }

            await this.plugin.saveData(this.currentSettings);
            logger.info('Settings saved successfully', 'SettingsManager');

        } catch (error) {
            logger.error('Failed to save settings', 'SettingsManager', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Get current settings
     */
    getSettings(): YouTubePluginSettings {
        return { ...this.currentSettings };
    }

    /**
     * Update specific setting properties
     */
    updateSettings(updates: Partial<YouTubePluginSettings>): void {
        const newSettings = { ...this.currentSettings, ...updates };
        const validation = this.validateSettings(newSettings);

        if (!validation.isValid) {
            logger.warn('Invalid settings update rejected', 'SettingsManager', {
                updates,
                errors: validation.errors
            });
            throw new Error('Invalid settings update');
        }

        this.currentSettings = newSettings;
        logger.info('Settings updated', 'SettingsManager', { updates });
        this.notifyListeners();
    }

    /**
     * Reset settings to defaults
     */
    resetToDefaults(): void {
        this.currentSettings = { ...this.config.defaultSettings };
        logger.info('Settings reset to defaults', 'SettingsManager');
        this.notifyListeners();
    }

    /**
     * Validate settings object
     */
    validateSettings(settings: Partial<YouTubePluginSettings>): SettingsValidationResult {
        const errors: string[] = [];

        // Basic validation
        if (!ValidationUtils.isValidPath(settings.outputPath || '')) {
            errors.push(MESSAGES.ERRORS.INVALID_OUTPUT_PATH);
        }

        // API key validation
        const usingEnv = Boolean(settings.useEnvironmentVariables);
        const hasDirectKey = ValidationUtils.isNonEmptyString(settings.geminiApiKey) ||
                           ValidationUtils.isNonEmptyString(settings.groqApiKey);

        if (!hasDirectKey && !usingEnv) {
            errors.push(MESSAGES.ERRORS.MISSING_API_KEYS);
        }

        // Environment variable validation
        if (usingEnv && !ValidationUtils.isNonEmptyString(settings.environmentPrefix)) {
            errors.push('Environment variable prefix is required when using environment variables');
        }

        // API key format validation
        if (ValidationUtils.isNonEmptyString(settings.geminiApiKey) &&
            !ValidationUtils.isValidAPIKey(settings.geminiApiKey, 'gemini')) {
            errors.push('Invalid Gemini API key format');
        }

        if (ValidationUtils.isNonEmptyString(settings.groqApiKey) &&
            !ValidationUtils.isValidAPIKey(settings.groqApiKey, 'groq')) {
            errors.push('Invalid Groq API key format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if settings are valid
     */
    areSettingsValid(): boolean {
        return this.validateSettings(this.currentSettings).isValid;
    }

    /**
     * Add settings change listener
     */
    addSettingsChangeListener(listener: SettingsChangeListener): void {
        this.listeners.add(listener);
    }

    /**
     * Remove settings change listener
     */
    removeSettingsChangeListener(listener: SettingsChangeListener): void {
        this.listeners.delete(listener);
    }

    /**
     * Export settings to JSON
     */
    exportSettings(): string {
        return JSON.stringify(this.currentSettings, null, 2);
    }

    /**
     * Import settings from JSON
     */
    async importSettings(settingsJson: string): Promise<void> {
        try {
            const importedSettings = JSON.parse(settingsJson);
            const validation = this.validateSettings(importedSettings);

            if (validation.isValid) {
                this.currentSettings = { ...this.config.defaultSettings, ...importedSettings };
                this.notifyListeners();
                await this.saveSettings();
                logger.info('Settings imported successfully', 'SettingsManager');
            } else {
                throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
            }
        } catch (error) {
            logger.error('Failed to import settings', 'SettingsManager', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            try {
                listener(this.getSettings());
            } catch (error) {
                logger.error('Settings listener error', 'SettingsManager', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
}