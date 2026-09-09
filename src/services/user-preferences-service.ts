import { OutputFormat, PerformanceMode } from '../types';

/**
 * User preferences service for storing and managing user-specific settings
 */

export interface UserPreferences {
    // Last used settings
    lastFormat?: OutputFormat;
    lastProvider?: string;
    lastModel?: string;
    lastPerformanceMode?: PerformanceMode;
    lastParallelProcessing?: boolean;
    lastMultimodal?: boolean;
    lastAutoFallback?: boolean;

    // User preferences
    preferredFormat?: OutputFormat;
    preferredProvider?: string;
    preferredModel?: string;

    // Usage statistics
    formatUsage?: Record<OutputFormat, number>;
    providerUsage?: Record<string, number>;
}

/**
 * Migrate old format names to new format names
 */
function migrateFormatName(oldFormat: string): string | null {
    const migrationMap: Record<string, string> = {
        brief: 'executive-summary',
        'concise-summary': 'executive-summary',
        'detailed-guide': 'technical-analysis',
        'step-by-step-tutorial': 'technical-analysis',
        transcript: 'complete-transcription',
        '3c-concept': '3c-accelerated-learning',
        'accelerated-learning': '3c-accelerated-learning',
        'executive-briefing': 'executive-summary',
        custom: 'executive-summary',
    };
    return migrationMap[oldFormat] ?? null;
}

export class UserPreferencesService {
    private static readonly STORAGE_KEY = 'yt-clipper-user-preferences';
    private static readonly DEFAULT_PREFERENCES: UserPreferences = {
        formatUsage: {
            'executive-summary': 0,
            'technical-analysis': 0,
            '3c-accelerated-learning': 0,
            'atom-notes': 0,
            article: 0,
            'complete-transcription': 0,
            'quick-notes': 0,
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
                // Migrate old format names to new ones
                const formatUsage = parsed.formatUsage ?? {};
                const migratedFormatUsage: Record<string, number> = {};
                for (const [key, value] of Object.entries(formatUsage)) {
                    const newKey = migrateFormatName(key);
                    if (newKey) {
                        migratedFormatUsage[newKey] = (migratedFormatUsage[newKey] ?? 0) + (value as number);
                    }
                }
                parsed.formatUsage = migratedFormatUsage as Record<OutputFormat, number>;
                // Also migrate lastFormat if needed
                if (parsed.lastFormat) {
                    const migratedLastFormat = migrateFormatName(parsed.lastFormat);
                    if (migratedLastFormat) {
                        parsed.lastFormat = migratedLastFormat as OutputFormat;
                    }
                }
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
    static updateLastUsed(settings: {
        format?: OutputFormat;
        provider?: string;
        model?: string;
        performanceMode?: PerformanceMode;
        parallelProcessing?: boolean;
        multimodal?: boolean;
        autoFallback?: boolean;
    }): void {
        const preferences = this.loadPreferences();

        if (settings.format) {
            preferences.lastFormat = settings.format;
            if (!preferences.formatUsage) {
                preferences.formatUsage = {} as Record<OutputFormat, number>;
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
        if (settings.performanceMode) preferences.lastPerformanceMode = settings.performanceMode;
        if (settings.parallelProcessing !== undefined) preferences.lastParallelProcessing = settings.parallelProcessing;
        if (settings.multimodal !== undefined) preferences.lastMultimodal = settings.multimodal;
        if (settings.autoFallback !== undefined) preferences.lastAutoFallback = settings.autoFallback;

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
}
