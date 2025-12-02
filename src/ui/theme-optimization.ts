import { StyleManager } from './constants/index';


/**
 * Theme configuration
 */
export interface ThemeConfig {
    name: string;
    isDark: boolean;
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    shadow: string;
    success: string;
    warning: string;
    error: string;
    info: string;
}

/**
 * Theme optimization and management system
 */
export class ThemeOptimizationManager {
    private static instance: ThemeOptimizationManager;
    private currentTheme: ThemeConfig;
    private systemThemeListener: ((isDark: boolean) => void) | null = null;
    private customThemes: Map<string, ThemeConfig> = new Map();
    private themeObservers: Set<(theme: ThemeConfig) => void> = new Set();
    private colorSchemePreference: 'light' | 'dark' | 'system' = 'system';

    private constructor() {
        this.initializeDefaultThemes();
        this.setupThemeDetection();
        this.setupThemeOptimizations();
        this.loadSavedTheme();
    }

    static getInstance(): ThemeOptimizationManager {
        if (!ThemeOptimizationManager.instance) {
            ThemeOptimizationManager.instance = new ThemeOptimizationManager();
        }
        return ThemeOptimizationManager.instance;
    }

    /**
     * Initialize default themes
     */
    private initializeDefaultThemes(): void {
        // Light theme
        this.customThemes.set('light', {
            name: 'Light',
            isDark: false,
            primary: '#1976d2',
            secondary: '#424242',
            accent: '#7c4dff',
            background: '#ffffff',
            surface: '#f5f5f5',
            text: '#212121',
            textSecondary: '#757575',
            border: '#e0e0e0',
            shadow: 'rgba(0, 0, 0, 0.1)',
            success: '#4caf50',
            warning: '#ff9800',
            error: '#f44336',
            info: '#2196f3'
        });

        // Dark theme
        this.customThemes.set('dark', {
            name: 'Dark',
            isDark: true,
            primary: '#90caf9',
            secondary: '#b0b0b0',
            accent: '#b388ff',
            background: '#121212',
            surface: '#1e1e1e',
            text: '#ffffff',
            textSecondary: '#b0b0b0',
            border: '#333333',
            shadow: 'rgba(0, 0, 0, 0.3)',
            success: '#66bb6a',
            warning: '#ffa726',
            error: '#ef5350',
            info: '#42a5f5'
        });

        // Sepia theme
        this.customThemes.set('sepia', {
            name: 'Sepia',
            isDark: false,
            primary: '#8d6e63',
            secondary: '#5d4037',
            accent: '#795548',
            background: '#fbf8f3',
            surface: '#f3e9d9',
            text: '#3e2723',
            textSecondary: '#6d4c41',
            border: '#d7ccc8',
            shadow: 'rgba(93, 64, 55, 0.1)',
            success: '#689f38',
            warning: '#ffa000',
            error: '#e53935',
            info: '#43a047'
        });

        // High contrast theme
        this.customThemes.set('high-contrast', {
            name: 'High Contrast',
            isDark: true,
            primary: '#ffffff',
            secondary: '#cccccc',
            accent: '#ffff00',
            background: '#000000',
            surface: '#1a1a1a',
            text: '#ffffff',
            textSecondary: '#cccccc',
            border: '#ffffff',
            shadow: 'rgba(255, 255, 255, 0.2)',
            success: '#00ff00',
            warning: '#ffff00',
            error: '#ff0000',
            info: '#00ffff'
        });

        // Ocean theme
        this.customThemes.set('ocean', {
            name: 'Ocean',
            isDark: true,
            primary: '#4fc3f7',
            secondary: '#80deea',
            accent: '#18ffff',
            background: '#0a192f',
            surface: '#112240',
            text: '#ccd6f6',
            textSecondary: '#8892b0',
            border: '#233554',
            shadow: 'rgba(79, 195, 247, 0.1)',
            success: '#64ffda',
            warning: '#f7b731',
            error: '#ff6b6b',
            info: '#74c0fc'
        });

        // Forest theme
        this.customThemes.set('forest', {
            name: 'Forest',
            isDark: false,
            primary: '#2e7d32',
            secondary: '#4caf50',
            accent: '#66bb6a',
            background: '#f1f8e9',
            surface: '#dcedc8',
            text: '#1b5e20',
            textSecondary: '#33691e',
            border: '#a5d6a7',
            shadow: 'rgba(46, 125, 50, 0.1)',
            success: '#2e7d32',
            warning: '#ff8f00',
            error: '#c62828',
            info: '#0277bd'
        });

        // Set current theme based on system
        this.currentTheme = this.getSystemPreferredTheme();
    }

    /**
     * Setup theme detection and system preference monitoring
     */
    private setupThemeDetection(): void {
        // Monitor system color scheme changes
        if (window.matchMedia) {
            const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

            this.systemThemeListener = (e: MediaQueryListEvent) => {
                if (this.colorSchemePreference === 'system') {
                    const newTheme = e.matches ?
                        this.customThemes.get('dark')! :
                        this.customThemes.get('light')!;
                    this.applyTheme(newTheme);
                }
            };

            colorSchemeQuery.addEventListener('change', this.systemThemeListener);
        }

        // Monitor reduced motion preference
        if (window.matchMedia) {
            const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            motionQuery.addEventListener('change', (e) => {
                this.updateMotionPreferences(e.matches);
            });

            // Apply initial motion preference
            this.updateMotionPreferences(motionQuery.matches);
        }

        // Monitor contrast preference
        if (window.matchMedia) {
            const contrastQuery = window.matchMedia('(prefers-contrast: high)');
            contrastQuery.addEventListener('change', (e) => {
                this.updateContrastPreferences(e.matches);
            });

            // Apply initial contrast preference
            this.updateContrastPreferences(contrastQuery.matches);
        }
    }

    /**
     * Setup theme optimizations
     */
    private setupThemeOptimizations(): void {
        const optimizationCSS = `
            /* Theme-aware CSS variables */
            :root {
                /* Primary colors */
                --yt-theme-primary: var(--interactive-accent);
                --yt-theme-secondary: var(--text-muted);
                --yt-theme-accent: var(--interactive-accent-hover);

                /* Background colors */
                --yt-theme-background: var(--background-primary);
                --yt-theme-surface: var(--background-secondary);
                --yt-theme-surface-alt: var(--background-modifier-hover);

                /* Text colors */
                --yt-theme-text: var(--text-normal);
                --yt-theme-text-secondary: var(--text-muted);
                --yt-theme-text-accent: var(--text-accent);

                /* Border and shadow colors */
                --yt-theme-border: var(--background-modifier-border);
                --yt-theme-border-focus: var(--interactive-accent);
                --yt-theme-shadow: rgba(0, 0, 0, 0.1);

                /* Status colors */
                --yt-theme-success: var(--text-success);
                --yt-theme-warning: var(--text-warning);
                --yt-theme-error: var(--text-error);
                --yt-theme-info: var(--text-info);

                /* Component-specific optimizations */
                --yt-theme-button-primary: var(--interactive-accent);
                --yt-theme-button-primary-hover: var(--interactive-accent-hover);
                --yt-theme-button-secondary: var(--background-modifier-hover);
                --yt-theme-input-border: var(--background-modifier-border);
                --yt-theme-input-border-focus: var(--interactive-accent);

                /* Dark theme overrides */
                --yt-theme-shadow-dark: rgba(0, 0, 0, 0.3);
                --yt-theme-shadow-light: rgba(255, 255, 255, 0.1);

                /* Animation speeds */
                --yt-theme-transition-fast: 150ms;
                --yt-theme-transition-normal: 250ms;
                --yt-theme-transition-slow: 350ms;
            }

            /* Dark theme optimizations */
            [data-theme="dark"] {
                --yt-theme-shadow: var(--yt-theme-shadow-dark);
                --yt-theme-button-secondary: var(--background-modifier-border);
            }

            /* Light theme optimizations */
            [data-theme="light"] {
                --yt-theme-shadow: var(--yt-theme-shadow-light);
            }

            /* High contrast theme optimizations */
            [data-theme="high-contrast"] {
                --yt-theme-border-width: 2px;
                --yt-theme-border-style: solid;
                --yt-theme-focus-outline-width: 3px;
            }

            /* Reduced motion optimizations */
            @media (prefers-reduced-motion: reduce) {
                :root {
                    --yt-theme-transition-fast: 0ms;
                    --yt-theme-transition-normal: 0ms;
                    --yt-theme-transition-slow: 0ms;
                }

                .yt-theme-transition {
                    transition: none !important;
                    animation: none !important;
                }
            }

            /* High contrast optimizations */
            @media (prefers-contrast: high) {
                :root {
                    --yt-theme-border-width: 2px;
                    --yt-theme-border-style: solid;
                }

                .yt-theme-border {
                    border-width: var(--yt-theme-border-width) !important;
                    border-style: var(--yt-theme-border-style) !important;
                }

                .yt-theme-focus {
                    outline: var(--yt-theme-focus-outline-width) solid var(--yt-theme-border-focus) !important;
                    outline-offset: 2px !important;
                }
            }

            /* Component theme classes */
            .yt-themed {
                color: var(--yt-theme-text);
                background-color: var(--yt-theme-background);
                border-color: var(--yt-theme-border);
                transition: all var(--yt-theme-transition-normal) ease;
            }

            .yt-themed-surface {
                background-color: var(--yt-theme-surface);
            }

            .yt-themed-accent {
                color: var(--yt-theme-text-accent);
            }

            .yt-themed-border {
                border-color: var(--yt-theme-border);
            }

            .yt-themed-shadow {
                box-shadow: 0 2px 8px var(--yt-theme-shadow);
            }

            .yt-themed-button-primary {
                background-color: var(--yt-theme-button-primary);
                color: white;
                border: 1px solid var(--yt-theme-button-primary);
                transition: all var(--yt-theme-transition-fast) ease;
            }

            .yt-themed-button-primary:hover {
                background-color: var(--yt-theme-button-primary-hover);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px var(--yt-theme-shadow);
            }

            .yt-themed-button-secondary {
                background-color: var(--yt-theme-button-secondary);
                color: var(--yt-theme-text);
                border: 1px solid var(--yt-theme-border);
                transition: all var(--yt-theme-transition-fast) ease;
            }

            .yt-themed-button-secondary:hover {
                background-color: var(--yt-theme-surface-alt);
            }

            .yt-themed-input {
                background-color: var(--yt-theme-background);
                color: var(--yt-theme-text);
                border: 1px solid var(--yt-theme-input-border);
                transition: border-color var(--yt-theme-transition-fast) ease;
            }

            .yt-themed-input:focus {
                border-color: var(--yt-theme-input-border-focus);
                box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
            }

            /* Status color classes */
            .yt-themed-success {
                color: var(--yt-theme-success);
                border-color: var(--yt-theme-success);
            }

            .yt-themed-warning {
                color: var(--yt-theme-warning);
                border-color: var(--yt-theme-warning);
            }

            .yt-themed-error {
                color: var(--yt-theme-error);
                border-color: var(--yt-theme-error);
            }

            .yt-themed-info {
                color: var(--yt-theme-info);
                border-color: var(--yt-theme-info);
            }

            /* Theme-aware scrollbars */
            .yt-themed-scrollbar::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }

            .yt-themed-scrollbar::-webkit-scrollbar-track {
                background: var(--yt-theme-surface);
            }

            .yt-themed-scrollbar::-webkit-scrollbar-thumb {
                background: var(--yt-theme-border);
                border-radius: 4px;
            }

            .yt-themed-scrollbar::-webkit-scrollbar-thumb:hover {
                background: var(--yt-theme-text-secondary);
            }

            /* Theme-aware selection */
            ::selection {
                background-color: var(--yt-theme-accent);
                color: var(--yt-theme-background);
            }

            /* Theme-aware links */
            .yt-themed-link {
                color: var(--yt-theme-accent);
                text-decoration: none;
                transition: color var(--yt-theme-transition-fast) ease;
            }

            .yt-themed-link:hover {
                color: var(--yt-theme-primary);
                text-decoration: underline;
            }

            /* Theme-aware code blocks */
            .yt-themed-code {
                background-color: var(--yt-theme-surface);
                border: 1px solid var(--yt-theme-border);
                border-radius: 4px;
                padding: 2px 4px;
                font-family: monospace;
                font-size: 0.9em;
            }

            /* Theme-aware blockquotes */
            .yt-themed-blockquote {
                border-left: 4px solid var(--yt-theme-accent);
                padding-left: 16px;
                margin: 16px 0;
                color: var(--yt-theme-text-secondary);
                font-style: italic;
            }

            /* Theme-aware tables */
            .yt-themed-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid var(--yt-theme-border);
            }

            .yt-themed-table th,
            .yt-themed-table td {
                padding: 8px 12px;
                border: 1px solid var(--yt-theme-border);
                text-align: left;
            }

            .yt-themed-table th {
                background-color: var(--yt-theme-surface);
                font-weight: 600;
            }

            .yt-themed-table tr:hover {
                background-color: var(--yt-theme-surface-alt);
            }

            /* Theme transitions */
            .yt-theme-transition * {
                transition: background-color var(--yt-theme-transition-normal) ease,
                            color var(--yt-theme-transition-normal) ease,
                            border-color var(--yt-theme-transition-normal) ease,
                            box-shadow var(--yt-theme-transition-normal) ease;
            }

            /* Responsive theme adjustments */
            @media (max-width: 768px) {
                :root {
                    --yt-theme-transition-fast: 100ms;
                    --yt-theme-transition-normal: 150ms;
                    --yt-theme-transition-slow: 200ms;
                }
            }
        `;

        StyleManager.addClass('theme-optimization', {
            'root': optimizationCSS
        });
    }

    /**
     * Apply theme
     */
    applyTheme(theme: ThemeConfig): void {
        this.currentTheme = theme;

        // Apply theme data attribute
        document.documentElement.setAttribute('data-theme', theme.name.toLowerCase());

        // Apply CSS custom properties
        this.applyCSSVariables(theme);

        // Apply theme-specific optimizations
        this.applyThemeOptimizations(theme);

        // Notify observers
        this.themeObservers.forEach(observer => observer(theme));

        // Save theme preference
        this.saveThemePreference(theme);

        // Announce to screen readers
        this.announceThemeChange(theme);
    }

    /**
     * Apply CSS custom properties
     */
    private applyCSSVariables(theme: ThemeConfig): void {
        const root = document.documentElement;

        // Convert colors to RGB values for better opacity support
        const toRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ?
                `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
                '0, 0, 0';
        };

        // Apply theme variables
        root.style.setProperty('--yt-theme-primary', theme.primary);
        root.style.setProperty('--yt-theme-secondary', theme.secondary);
        root.style.setProperty('--yt-theme-accent', theme.accent);
        root.style.setProperty('--yt-theme-background', theme.background);
        root.style.setProperty('--yt-theme-surface', theme.surface);
        root.style.setProperty('--yt-theme-text', theme.text);
        root.style.setProperty('--yt-theme-text-secondary', theme.textSecondary);
        root.style.setProperty('--yt-theme-border', theme.border);
        root.style.setProperty('--yt-theme-shadow', theme.shadow);
        root.style.setProperty('--yt-theme-success', theme.success);
        root.style.setProperty('--yt-theme-warning', theme.warning);
        root.style.setProperty('--yt-theme-error', theme.error);
        root.style.setProperty('--yt-theme-info', theme.info);

        // Apply RGB versions for opacity support
        root.style.setProperty('--yt-theme-primary-rgb', toRgb(theme.primary));
        root.style.setProperty('--yt-theme-accent-rgb', toRgb(theme.accent));
        root.style.setProperty('--yt-theme-success-rgb', toRgb(theme.success));
        root.style.setProperty('--yt-theme-warning-rgb', toRgb(theme.warning));
        root.style.setProperty('--yt-theme-error-rgb', toRgb(theme.error));
        root.style.setProperty('--yt-theme-info-rgb', toRgb(theme.info));
    }

    /**
     * Apply theme-specific optimizations
     */
    private applyThemeOptimizations(theme: ThemeConfig): void {
        // Apply dark mode optimizations
        if (theme.isDark) {
            document.body.classList.add('yt-dark-mode');
            document.body.classList.remove('yt-light-mode');

            // Optimize for OLED displays
            if (this.isOLEDDisplay()) {
                document.documentElement.style.setProperty('--yt-theme-background', '#000000');
            }

            // Enable blue light filter if needed
            if (this.shouldEnableBlueLightFilter()) {
                this.enableBlueLightFilter();
            }

        } else {
            document.body.classList.add('yt-light-mode');
            document.body.classList.remove('yt-dark-mode');

            // Disable blue light filter
            this.disableBlueLightFilter();
        }

        // Apply high contrast optimizations
        if (theme.name === 'High Contrast') {
            document.body.classList.add('yt-high-contrast');
        } else {
            document.body.classList.remove('yt-high-contrast');
        }

        // Apply reading mode optimizations
        this.applyReadingModeOptimizations(theme);
    }

    /**
     * Get system preferred theme
     */
    private getSystemPreferredTheme(): ThemeConfig {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return this.customThemes.get('dark')!;
        }
        return this.customThemes.get('light')!;
    }

    /**
     * Update motion preferences
     */
    private updateMotionPreferences(reducedMotion: boolean): void {
        if (reducedMotion) {
            document.body.classList.add('yt-reduced-motion');
        } else {
            document.body.classList.remove('yt-reduced-motion');
        }
    }

    /**
     * Update contrast preferences
     */
    private updateContrastPreferences(highContrast: boolean): void {
        if (highContrast) {
            document.body.classList.add('yt-high-contrast');
        } else {
            document.body.classList.remove('yt-high-contrast');
        }
    }

    /**
     * Check if display is OLED
     */
    private isOLEDDisplay(): boolean {
        // Heuristic: check for high pixel ratio and dark mode preference
        const hasHighPixelRatio = window.devicePixelRatio > 2;
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        return hasHighPixelRatio && prefersDark;
    }

    /**
     * Check if blue light filter should be enabled
     */
    private shouldEnableBlueLightFilter(): boolean {
        const hour = new Date().getHours();
        return hour >= 20 || hour <= 6; // 8 PM to 6 AM
    }

    /**
     * Enable blue light filter
     */
    private enableBlueLightFilter(): void {
        const filterCSS = `
            .yt-blue-light-filter {
                filter: sepia(0.2) saturate(0.8) hue-rotate(315deg) brightness(0.9);
            }
        `;
        StyleManager.addClass('blue-light-filter', {
            'body': filterCSS
        });
        document.body.classList.add('yt-blue-light-filter');
    }

    /**
     * Disable blue light filter
     */
    private disableBlueLightFilter(): void {
        document.body.classList.remove('yt-blue-light-filter');
    }

    /**
     * Apply reading mode optimizations
     */
    private applyReadingModeOptimizations(theme: ThemeConfig): void {
        // Optimize line height and spacing for reading
        const readingCSS = `
            .yt-reading-optimized {
                line-height: 1.6;
                letter-spacing: 0.01em;
                word-spacing: 0.05em;
            }

            .yt-reading-optimized p {
                margin-bottom: 1.2em;
            }

            .yt-reading-optimized h1,
            .yt-reading-optimized h2,
            .yt-reading-optimized h3 {
                margin-top: 1.5em;
                margin-bottom: 0.8em;
                font-weight: 600;
            }
        `;
        StyleManager.addClass('reading-optimization', {
            'root': readingCSS
        });
    }

    /**
     * Announce theme change to screen readers
     */
    private announceThemeChange(theme: ThemeConfig): void {
        const announcement = `Theme changed to ${theme.name} mode`;

        // Create live region if it doesn't exist
        let liveRegion = document.getElementById('yt-theme-live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'yt-theme-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.style.cssText = `
                position: absolute;
                left: -10000px;
                width: 1px;
                height: 1px;
                overflow: hidden;
            `;
            document.body.appendChild(liveRegion);
        }

        liveRegion.textContent = announcement;
    }

    /**
     * Save theme preference
     */
    private saveThemePreference(theme: ThemeConfig): void {
        try {
            localStorage.setItem('yt-theme-preference', JSON.stringify({
                theme: theme.name,
                colorSchemePreference: this.colorSchemePreference
            }));
        } catch (error) {
            
}
    }

    /**
     * Load saved theme preference
     */
    private loadSavedTheme(): void {
        try {
            const saved = localStorage.getItem('yt-theme-preference');
            if (saved) {
                const preference = JSON.parse(saved);
                this.colorSchemePreference = preference.colorSchemePreference || 'system';

                if (preference.theme && preference.theme !== 'system') {
                    const theme = this.customThemes.get(preference.theme);
                    if (theme) {
                        this.applyTheme(theme);
                    }
                } else if (this.colorSchemePreference === 'system') {
                    this.applyTheme(this.getSystemPreferredTheme());
                }
            }
        } catch (error) {
            
}
    }

    /**
     * Set theme by name
     */
    setTheme(themeName: string): void {
        const theme = this.customThemes.get(themeName);
        if (theme) {
            this.colorSchemePreference = 'custom';
            this.applyTheme(theme);
        }
    }

    /**
     * Set color scheme preference
     */
    setColorSchemePreference(preference: 'light' | 'dark' | 'system'): void {
        this.colorSchemePreference = preference;

        switch (preference) {
            case 'light':
                this.applyTheme(this.customThemes.get('light')!);
                break;
            case 'dark':
                this.applyTheme(this.customThemes.get('dark')!);
                break;
            case 'system':
                this.applyTheme(this.getSystemPreferredTheme());
                break;
        }
    }

    /**
     * Add custom theme
     */
    addCustomTheme(name: string, theme: ThemeConfig): void {
        this.customThemes.set(name, theme);
    }

    /**
     * Remove custom theme
     */
    removeCustomTheme(name: string): void {
        this.customThemes.delete(name);
    }

    /**
     * Get available themes
     */
    getAvailableThemes(): ThemeConfig[] {
        return Array.from(this.customThemes.values());
    }

    /**
     * Get current theme
     */
    getCurrentTheme(): ThemeConfig {
        return this.currentTheme;
    }

    /**
     * Get color scheme preference
     */
    getColorSchemePreference(): 'light' | 'dark' | 'system' {
        return this.colorSchemePreference;
    }

    /**
     * Check if dark mode is active
     */
    isDarkMode(): boolean {
        return this.currentTheme.isDark;
    }

    /**
     * Add theme observer
     */
    addThemeObserver(observer: (theme: ThemeConfig) => void): void {
        this.themeObservers.add(observer);
    }

    /**
     * Remove theme observer
     */
    removeThemeObserver(observer: (theme: ThemeConfig) => void): void {
        this.themeObservers.delete(observer);
    }

    /**
     * Get theme CSS for component
     */
    getThemeCSS(component: string): string {
        const theme = this.currentTheme;

        switch (component) {
            case 'button':
                return `
                    background-color: ${theme.primary};
                    color: ${theme.isDark ? theme.text : 'white'};
                    border-color: ${theme.primary};
                    box-shadow: 0 2px 4px ${theme.shadow};
                `;
            case 'input':
                return `
                    background-color: ${theme.background};
                    color: ${theme.text};
                    border-color: ${theme.border};
                    box-shadow: 0 1px 3px ${theme.shadow};
                `;
            case 'card':
                return `
                    background-color: ${theme.surface};
                    color: ${theme.text};
                    border-color: ${theme.border};
                    box-shadow: 0 4px 8px ${theme.shadow};
                `;
            default:
                return '';
        }
    }

    /**
     * Optimize theme for accessibility
     */
    optimizeForAccessibility(): void {
        // Ensure sufficient contrast ratios
        this.enhanceContrastRatios();

        // Optimize focus indicators
        this.enhanceFocusIndicators();

        // Optimize text sizing
        this.enhanceTextSizing();
    }

    /**
     * Enhance contrast ratios
     */
    private enhanceContrastRatios(): void {
        const style = document.createElement('style');
        style.textContent = `
            .yt-enhanced-contrast {
                --yt-theme-text-secondary: ${this.adjustContrast(this.currentTheme.textSecondary, this.currentTheme.background, 4.5)};
                --yt-theme-border: ${this.adjustContrast(this.currentTheme.border, this.currentTheme.background, 3)};
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Enhance focus indicators
     */
    private enhanceFocusIndicators(): void {
        const style = document.createElement('style');
        style.textContent = `
            .yt-enhanced-focus *:focus {
                outline: 3px solid ${this.currentTheme.accent} !important;
                outline-offset: 2px !important;
                background-color: ${this.currentTheme.surface} !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Enhance text sizing
     */
    private enhanceTextSizing(): void {
        const style = document.createElement('style');
        style.textContent = `
            .yt-enhanced-text {
                font-size: 16px !important;
                line-height: 1.5 !important;
            }

            .yt-enhanced-text h1 { font-size: 1.8em !important; }
            .yt-enhanced-text h2 { font-size: 1.5em !important; }
            .yt-enhanced-text h3 { font-size: 1.3em !important; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Adjust color contrast
     */
    private adjustContrast(foreground: string, background: string, targetRatio: number): string {
        // Simplified contrast adjustment - in production, use a proper color library
        const getLuminance = (color: string): number => {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16) / 255;
            const g = parseInt(hex.substr(2, 2), 16) / 255;
            const b = parseInt(hex.substr(4, 2), 16) / 255;
            return 0.299 * r + 0.587 * g + 0.114 * b;
        };

        const fgLuminance = getLuminance(foreground);
        const bgLuminance = getLuminance(background);
        const currentRatio = (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);

        if (currentRatio >= targetRatio) {
            return foreground;
        }

        // Simple adjustment - make color darker or lighter
        const isLight = fgLuminance > bgLuminance;
        return isLight ? '#ffffff' : '#000000';
    }

    /**
     * Cleanup theme manager
     */
    destroy(): void {
        // Remove system theme listener
        if (this.systemThemeListener && window.matchMedia) {
            const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            colorSchemeQuery.removeEventListener('change', this.systemThemeListener);
        }

        // Clear observers
        this.themeObservers.clear();

        // Remove theme classes
        document.body.classList.remove(
            'yt-dark-mode',
            'yt-light-mode',
            'yt-high-contrast',
            'yt-reduced-motion',
            'yt-blue-light-filter'
        );

        // Remove live region
        const liveRegion = document.getElementById('yt-theme-live-region');
        if (liveRegion) {
            liveRegion.remove();
        }
    }
}

// Export singleton instance
export const themeOptimizationManager = ThemeOptimizationManager.getInstance();

// Export utility functions
export const themeOptimization = {
    setTheme: (name: string) => themeOptimizationManager.setTheme(name),
    setColorScheme: (preference: 'light' | 'dark' | 'system') =>
        themeOptimizationManager.setColorSchemePreference(preference),
    getCurrentTheme: () => themeOptimizationManager.getCurrentTheme(),
    isDarkMode: () => themeOptimizationManager.isDarkMode(),
    getAvailableThemes: () => themeOptimizationManager.getAvailableThemes(),
    addCustomTheme: (name: string, theme: ThemeConfig) =>
        themeOptimizationManager.addCustomTheme(name, theme),
    getThemeCSS: (component: string) => themeOptimizationManager.getThemeCSS(component),
    optimizeForAccessibility: () => themeOptimizationManager.optimizeForAccessibility(),
    addObserver: (observer: (theme: ThemeConfig) => void) =>
        themeOptimizationManager.addThemeObserver(observer),
    removeObserver: (observer: (theme: ThemeConfig) => void) =>
        themeOptimizationManager.removeThemeObserver(observer)
};