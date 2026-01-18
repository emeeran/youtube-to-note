import { OutputFormat, PerformanceMode } from '../types';

/**
 * User preferences service for storing and managing user-specific settings
 */

export interface UserPreferences {
    // Last used settings
    lastFormat?: OutputFormat;
    lastProvider?: string;
    lastModel?: string;
    lastMaxTokens?: number;
    lastTemperature?: number;
    lastPerformanceMode?: PerformanceMode;
    lastParallelProcessing?: boolean;
    lastMultimodal?: boolean;
    lastAutoFallback?: boolean;

    // Provider-specific model preferences
    lastModel_Gemini?: string;
    lastModel_Groq?: string;
    lastModel_Ollama?: string;
    lastModel_OllamaCloud?: string;
    lastModel_HuggingFace?: string;
    lastModel_OpenRouter?: string;

    // User preferences
    preferredFormat?: OutputFormat;
    preferredProvider?: string;
    preferredModel?: string;
    preferredAutoFallback?: boolean;
    autoSelectProvider?: boolean;
    showPreview?: boolean;
    enableKeyboardShortcuts?: boolean;
    enableAnimations?: boolean;

    // UI preferences
    rememberWindowPosition?: boolean;
    autoFocusUrl?: boolean;
    showAdvancedSettings?: boolean;
    compactMode?: boolean;

    // Usage statistics
    totalProcessed?: number;
    formatUsage?: Record<OutputFormat, number>;
    providerUsage?: Record<string, number>;
    lastUsed?: string;
}

export class UserPreferencesService {
    private static readonly STORAGE_KEY = 'yt-clipper-user-preferences';
    private static readonly DEFAULT_PREFERENCES: UserPreferences = {
        autoSelectProvider: true,
        showPreview: true,
        enableKeyboardShortcuts: true,
        enableAnimations: true,
        autoFocusUrl: true,
        showAdvancedSettings: false,
        compactMode: false,
        formatUsage: {
            brief: 0,
            'executive-summary': 0,
            'detailed-guide': 0,
            custom: 0,
            transcript: 0,
            '3c-concept': 0,
            'technical-analysis': 0,
            'accelerated-learning': 0,
            'executive-briefing': 0,
        },
        providerUsage: {},
    };

    /**
     * Load user preferences from storage
     */
    static loadPreferences(): UserPreferences {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...this.DEFAULT_PREFERENCES, ...parsed };
            }
        } catch {
            // Ignore error
        }
        return { ...this.DEFAULT_PREFERENCES };
    }

    /**
     * Save user preferences to storage
     */
    static savePreferences(preferences: UserPreferences): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
        } catch {
            // Ignore error
        }
    }

    /**
     * Get a specific preference value
     */
    static getPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
        const preferences = this.loadPreferences();
        return preferences[key];
    }

    /**
     * Set a specific preference value
     */
    static setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
        const preferences = this.loadPreferences();
        preferences[key] = value;
        this.savePreferences(preferences);
    }

    /**
     * Update last used settings
     */
    // eslint-disable-next-line complexity
    static updateLastUsed(settings: {
        format?: OutputFormat;
        provider?: string;
        model?: string;
        maxTokens?: number;
        temperature?: number;
        performanceMode?: PerformanceMode;
        parallelProcessing?: boolean;
        multimodal?: boolean;
        autoFallback?: boolean;
    }): void {
        const preferences = this.loadPreferences();

        if (settings.format) {
            preferences.lastFormat = settings.format;
            if (!preferences.formatUsage) {
                preferences.formatUsage = {};
            }
            preferences.formatUsage[settings.format] = (preferences.formatUsage[settings.format] ?? 0) + 1;
        }

        if (settings.provider) {
            preferences.lastProvider = settings.provider;
            if (!preferences.providerUsage) {
                preferences.providerUsage = {};
            }
            preferences.providerUsage[settings.provider] = (preferences.providerUsage[settings.provider] ?? 0) + 1;
        }

        if (settings.model) preferences.lastModel = settings.model;
        if (settings.maxTokens) preferences.lastMaxTokens = settings.maxTokens;
        if (settings.temperature) preferences.lastTemperature = settings.temperature;
        if (settings.performanceMode) preferences.lastPerformanceMode = settings.performanceMode;
        if (settings.parallelProcessing !== undefined) preferences.lastParallelProcessing = settings.parallelProcessing;
        if (settings.multimodal !== undefined) preferences.lastMultimodal = settings.multimodal;
        if (settings.autoFallback !== undefined) preferences.lastAutoFallback = settings.autoFallback;

        preferences.lastUsed = new Date().toISOString();
        preferences.totalProcessed = (preferences.totalProcessed ?? 0) + 1;

        this.savePreferences(preferences);
    }

    /**
     * Get smart default format based on usage patterns
     */
    static getSmartDefaultFormat(): OutputFormat {
        const preferences = this.loadPreferences();

        // Return user's preferred format if set
        if (preferences.preferredFormat) {
            return preferences.preferredFormat;
        }

        // Return most frequently used format
        const formatUsage = preferences.formatUsage ?? {};
        let maxUsage = 0;
        let mostUsedFormat: OutputFormat = 'executive-summary';

        for (const [format, count] of Object.entries(formatUsage)) {
            const countValue = typeof count === 'number' ? count : 0;
            if (countValue > maxUsage) {
                maxUsage = countValue;
                mostUsedFormat = format as OutputFormat;
            }
        }

        return mostUsedFormat;
    }

    /**
     * Get smart default provider based on usage patterns
     */
    static getSmartDefaultProvider(): string | undefined {
        const preferences = this.loadPreferences();

        // Return user's preferred provider if set
        if (preferences.preferredProvider) {
            return preferences.preferredProvider;
        }

        // Return most frequently used provider
        const providerUsage = preferences.providerUsage ?? {};
        let maxUsage = 0;
        let mostUsedProvider: string | undefined;

        for (const [provider, count] of Object.entries(providerUsage)) {
            if (count > maxUsage) {
                maxUsage = count;
                mostUsedProvider = provider;
            }
        }

        return mostUsedProvider;
    }

    /**
     * Get smart defaults for model parameters based on user history
     */
    static getSmartDefaultModelParameters(): { maxTokens: number; temperature: number } {
        const preferences = this.loadPreferences();

        return {
            maxTokens: preferences.lastMaxTokens ?? 4096,
            temperature: preferences.lastTemperature ?? 0.5,
        };
    }

    /**
     * Get smart default performance settings
     */
    static getSmartDefaultPerformanceSettings(): {
        mode: PerformanceMode;
        parallel: boolean;
        multimodal: boolean;
        autoFallback: boolean;
        } {
        const preferences = this.loadPreferences();

        return {
            mode: preferences.lastPerformanceMode ?? 'balanced',
            parallel: preferences.lastParallelProcessing ?? false,
            multimodal: preferences.lastMultimodal ?? true,
            autoFallback: preferences.lastAutoFallback ?? true,
        };
    }

    /**
     * Get smart default auto-fallback setting
     */
    static getSmartDefaultAutoFallback(): boolean {
        const preferences = this.loadPreferences();

        // Return user's preferred auto-fallback if set
        if (preferences.preferredAutoFallback !== undefined) {
            return preferences.preferredAutoFallback;
        }

        // Return last used auto-fallback setting
        return preferences.lastAutoFallback ?? true;
    }

    /**
     * Analyze user behavior and suggest optimizations
     */
    // eslint-disable-next-line complexity
    static getUserInsights(): {
        favoriteFormat: OutputFormat;
        favoriteProvider: string;
        averageTokens: number;
        averageTemperature: number;
        usageLevel: 'light' | 'moderate' | 'heavy';
        recommendations: string[];
        } {
        const preferences = this.loadPreferences();
        const formatUsage = preferences.formatUsage ?? {};
        const providerUsage = preferences.providerUsage ?? {};

        // Find favorites
        let favoriteFormat: OutputFormat = 'executive-summary';
        let maxFormatUsage = 0;

        for (const [format, count] of Object.entries(formatUsage)) {
            const countValue = typeof count === 'number' ? count : 0;
            if (countValue > maxFormatUsage) {
                maxFormatUsage = countValue;
                favoriteFormat = format as OutputFormat;
            }
        }

        let favoriteProvider = '';
        let maxProviderUsage = 0;

        for (const [provider, count] of Object.entries(providerUsage)) {
            const countValue = typeof count === 'number' ? count : 0;
            if (countValue > maxProviderUsage) {
                maxProviderUsage = countValue;
                favoriteProvider = provider;
            }
        }

        // Determine usage level
        const totalProcessed = preferences.totalProcessed ?? 0;
        const usageLevel = totalProcessed < 5 ? 'light' : totalProcessed < 20 ? 'moderate' : 'heavy';

        // Generate recommendations
        const recommendations: string[] = [];

        if (usageLevel === 'heavy' && !preferences.showAdvancedSettings) {
            recommendations.push('Consider enabling advanced settings for more control');
        }

        if (!preferences.autoSelectProvider && Object.keys(providerUsage).length > 1) {
            recommendations.push('Enable auto-select provider to speed up your workflow');
        }

        if (!preferences.showPreview && totalProcessed > 10) {
            recommendations.push('Enable video preview for better context');
        }

        return {
            favoriteFormat,
            favoriteProvider,
            averageTokens: preferences.lastMaxTokens ?? 4096,
            averageTemperature: preferences.lastTemperature ?? 0.5,
            usageLevel,
            recommendations,
        };
    }

    /**
     * Reset preferences to defaults
     */
    static resetPreferences(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    /**
     * Export preferences for backup
     */
    static exportPreferences(): string {
        const preferences = this.loadPreferences();
        return JSON.stringify(preferences, null, 2);
    }

    /**
     * Import preferences from backup
     */
    static importPreferences(jsonData: string): boolean {
        try {
            const preferences = JSON.parse(jsonData);
            this.savePreferences({ ...this.DEFAULT_PREFERENCES, ...preferences });
            return true;
        } catch (error) {

            return false;
        }
    }
}