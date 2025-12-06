import { App, PluginSettingTab, Setting } from 'obsidian';
import { ErrorHandler } from '../../services/error-handler';
import { SecureConfigService } from '../../secure-config';
import { ValidationUtils } from '../../utils/validation';
import { YouTubePluginSettings } from '../../types';
import {
    memo,
    useMemo,
    useCallback,
    debounce,
    throttle,
    createVirtualList,
    addOptimizedEventListener,
    batchDOMUpdates,
    trackComponentPerformance,
    createOptimizedResizeObserver
} from '../optimization/memoization';

/**
 * Performance-optimized settings tab with virtual scrolling and memoization
 * Implements efficient rendering and interaction patterns
 */

export interface OptimizedSettingsTabOptions {
    plugin: any;
    onSettingsChange: (settings: YouTubePluginSettings) => Promise<void>;
}

// Memoized CSS classes to prevent recreation
const SETTINGS_CSS_CLASSES = useMemo(() => ({
    container: 'ytc-optimized-settings-container',
    section: 'ytc-optimized-settings-section',
    header: 'ytc-optimized-settings-header',
    validation: 'ytc-optimized-settings-validation',
    compact: 'ytc-optimized-compact-setting'
}), []);

interface SettingItem {
    id: string;
    title: string;
    description: string;
    type: 'text' | 'toggle' | 'dropdown' | 'slider' | 'button';
    section: string;
    value?: any;
    options?: Array<{ value: string; text: string }>;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    validator?: (value: any) => boolean;
    onChange: (value: any) => Promise<void>;
    dependencies?: string[]; // Settings that affect this one
}

export class OptimizedYouTubeSettingsTab extends PluginSettingTab {
    private settings: YouTubePluginSettings;
    private validationErrors: string[] = [];
    private secureConfig: SecureConfigService;
    private cleanupFunctions: (() => void)[] = [];
    private resizeObserver?: { disconnect: () => void };
    private virtualList?: ReturnType<typeof createVirtualList>;

    // Memoized setting items
    private settingItems: SettingItem[] = [];

    // Performance tracking
    private renderCount = 0;
    private lastRenderTime = 0;

    constructor(
        app: App,
        private options: OptimizedSettingsTabOptions
    ) {
        super(app, options.plugin);
        this.settings = { ...options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);
        this.initializeSettingItems();
    }

    @trackComponentPerformance({ component: 'SettingsTab', threshold: 100 })
    display(): void {
        this.renderCount++;
        this.lastRenderTime = performance.now();

        const { containerEl } = this;
        containerEl.empty();

        // Add optimized CSS classes
        containerEl.addClass(SETTINGS_CSS_CLASSES.container);
        containerEl.setAttribute('data-plugin', 'youtube-clipper');
        containerEl.setAttribute('data-render-count', this.renderCount.toString());

        // Apply performance optimizations
        this.setupOptimizedContainer(containerEl);
        this.addOptimizedStyles();

        // Create virtual list for better performance with many settings
        this.createVirtualizedSettings();
    }

    /**
     * Initialize memoized setting items
     */
    private initializeSettingItems(): void {
        this.settingItems = useMemo(() => [
            // API Settings Section
            {
                id: 'geminiApiKey',
                title: 'Gemini API Key',
                description: 'Google Generative AI API key',
                type: 'text',
                section: 'api',
                placeholder: 'AIza...',
                validator: (value) => !value || value.startsWith('AIza'),
                onChange: async (value) => this.updateSetting('geminiApiKey', value)
            },
            {
                id: 'groqApiKey',
                title: 'Groq API Key',
                description: 'Groq API key for fast inference',
                type: 'text',
                section: 'api',
                placeholder: 'gsk_...',
                validator: (value) => !value || value.startsWith('gsk_'),
                onChange: async (value) => this.updateSetting('groqApiKey', value)
            },
            {
                id: 'ollamaApiKey',
                title: 'Ollama API Key',
                description: 'Ollama API key (optional)',
                type: 'text',
                section: 'api',
                placeholder: 'Optional API key',
                onChange: async (value) => this.updateSetting('ollamaApiKey', value)
            },
            {
                id: 'testApiKeys',
                title: 'Test API Keys',
                description: 'Validate API key configurations',
                type: 'button',
                section: 'api',
                onChange: async () => this.testAPIKeys()
            },

            // AI Parameters Section
            {
                id: 'defaultMaxTokens',
                title: 'Default Max Tokens',
                description: 'Maximum tokens for AI responses',
                type: 'slider',
                section: 'ai',
                min: 256,
                max: 8192,
                step: 256,
                value: this.settings.defaultMaxTokens || 4096,
                onChange: async (value) => this.updateSetting('defaultMaxTokens', value)
            },
            {
                id: 'defaultTemperature',
                title: 'Default Temperature',
                description: 'Creativity level (0.0-2.0)',
                type: 'slider',
                section: 'ai',
                min: 0,
                max: 2,
                step: 0.1,
                value: this.settings.defaultTemperature || 0.5,
                onChange: async (value) => this.updateSetting('defaultTemperature', value)
            },
            {
                id: 'performanceMode',
                title: 'Performance Mode',
                description: 'Balance between speed and quality',
                type: 'dropdown',
                section: 'ai',
                options: [
                    { value: 'fast', text: 'Fast' },
                    { value: 'balanced', text: 'Balanced' },
                    { value: 'quality', text: 'Quality' }
                ],
                value: this.settings.performanceMode || 'balanced',
                onChange: async (value) => this.updateSetting('performanceMode', value)
            },

            // File Settings Section
            {
                id: 'outputPath',
                title: 'Output Path',
                description: 'Default folder for generated notes',
                type: 'text',
                section: 'files',
                placeholder: 'YouTube/Processed Videos',
                value: this.settings.outputPath || 'YouTube/Processed Videos',
                validator: (value) => ValidationUtils.isValidPath(value),
                onChange: async (value) => this.updateSetting('outputPath', value)
            },

            // Advanced Settings Section
            {
                id: 'enableParallelProcessing',
                title: 'Enable Parallel Processing',
                description: 'Process multiple videos simultaneously',
                type: 'toggle',
                section: 'advanced',
                value: this.settings.enableParallelProcessing || false,
                onChange: async (value) => this.updateSetting('enableParallelProcessing', value)
            },
            {
                id: 'preferMultimodal',
                title: 'Prefer Multimodal Analysis',
                description: 'Use audio + video analysis when available',
                type: 'toggle',
                section: 'advanced',
                value: this.settings.preferMultimodal || false,
                onChange: async (value) => this.updateSetting('preferMultimodal', value)
            }
        ], [this.settings]);
    }

    /**
     * Setup optimized container with performance monitoring
     */
    private setupOptimizedContainer(containerEl: HTMLElement): void {
        // Optimized container styles
        const containerStyles = useMemo(() => ({
            overflowY: 'auto' as const,
            maxHeight: '80vh',
            height: 'fit-content',
            padding: '8px',
            margin: '0',
            backgroundColor: 'var(--background-primary)',
            position: 'relative' as const
        }), []);

        Object.assign(containerEl.style, containerStyles);

        // Setup resize observer for dynamic adjustments
        this.resizeObserver = createOptimizedResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                this.handleContainerResize(entry.contentRect);
            }
        });

        this.resizeObserver.observe(containerEl);
        this.cleanupFunctions.push(() => this.resizeObserver.disconnect());
    }

    /**
     * Handle container resize with performance optimization
     */
    private handleContainerResize = throttle((contentRect: DOMRect) => {
        // Recalculate virtual list dimensions if needed
        if (this.virtualList && contentRect.height > 0) {
            // Trigger virtual list recalculation
            this.virtualList.updateItems(this.settingItems);
        }
    }, 100);

    /**
     * Add optimized CSS styles with memoization
     */
    private addOptimizedStyles(): void {
        if (document.getElementById('ytc-optimized-settings-styles')) {
            return;
        }

        const styleSheet = document.createElement('style');
        styleSheet.id = 'ytc-optimized-settings-styles';

        // Memoized CSS content
        const cssContent = useMemo(() => `
            .${SETTINGS_CSS_CLASSES.container} {
                --ytc-settings-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                --ytc-settings-border-radius: 6px;
                --ytc-settings-padding: 8px;
                --ytc-settings-gap: 4px;
            }

            .${SETTINGS_CSS_CLASSES.container}::-webkit-scrollbar {
                width: 8px;
            }

            .${SETTINGS_CSS_CLASSES.container}::-webkit-scrollbar-track {
                background: var(--background-primary);
                border-radius: 4px;
            }

            .${SETTINGS_CSS_CLASSES.container}::-webkit-scrollbar-thumb {
                background: var(--background-modifier-border);
                border-radius: 4px;
            }

            .${SETTINGS_CSS_CLASSES.container}::-webkit-scrollbar-thumb:hover {
                background: var(--interactive-accent);
            }

            .${SETTINGS_CSS_CLASSES.section} {
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                border-radius: var(--ytc-settings-border-radius);
                padding: var(--ytc-settings-padding);
                margin-bottom: var(--ytc-settings-gap);
                transition: var(--ytc-settings-transition);
            }

            .${SETTINGS_CSS_CLASSES.section}:hover {
                border-color: var(--interactive-accent);
                box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
            }

            .${SETTINGS_CSS_CLASSES.compact} .setting-item {
                padding: 4px 2px !important;
                margin: 1px 0 !important;
                transition: var(--ytc-settings-transition);
            }

            .${SETTINGS_CSS_CLASSES.compact} .setting-item:hover {
                background: var(--background-modifier-hover);
                border-radius: 4px;
            }

            .${SETTINGS_CSS_CLASSES.compact} .setting-item-name {
                font-size: 0.8rem !important;
                font-weight: 500 !important;
                margin-bottom: 1px !important;
            }

            .${SETTINGS_CSS_CLASSES.compact} .setting-item-description {
                font-size: 0.7rem !important;
                margin-bottom: 2px !important;
                color: var(--text-muted);
            }

            .${SETTINGS_CSS_CLASSES.compact} input[type="text"],
            .${SETTINGS_CSS_CLASSES.compact} select {
                font-size: 0.75rem !important;
                padding: 3px 6px !important;
                border: 1px solid var(--background-modifier-border) !important;
                border-radius: 4px !important;
                background: var(--background-primary) !important;
                transition: var(--ytc-settings-transition);
            }

            .${SETTINGS_CSS_CLASSES.compact} input[type="text"]:focus,
            .${SETTINGS_CSS_CLASSES.compact} select:focus {
                border-color: var(--interactive-accent) !important;
                box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1) !important;
                outline: none !important;
            }

            .${SETTINGS_CSS_CLASSES.compact} button {
                font-size: 0.7rem !important;
                padding: 4px 8px !important;
                border-radius: 4px !important;
                transition: var(--ytc-settings-transition);
            }

            .${SETTINGS_CSS_CLASSES.compact} button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .ytc-virtual-list-container {
                height: 100%;
                overflow: hidden;
                position: relative;
            }

            .ytc-virtual-list-content {
                position: relative;
                transform: translateY(0);
                will-change: transform;
            }

            .ytc-setting-item {
                position: absolute;
                width: 100%;
                will-change: transform;
                contain: layout style paint;
            }

            .ytc-slider {
                width: 100% !important;
                height: 4px !important;
                border-radius: 2px !important;
                background: var(--interactive-normal) !important;
                outline: none !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                cursor: pointer !important;
            }

            .ytc-slider::-webkit-slider-thumb {
                -webkit-appearance: none !important;
                appearance: none !important;
                width: 12px !important;
                height: 12px !important;
                background: var(--interactive-accent) !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                border: 1px solid var(--text-on-accent) !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
                transition: var(--ytc-settings-transition);
            }

            .ytc-slider::-webkit-slider-thumb:hover {
                transform: scale(1.1);
            }

            .ytc-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: var(--background-secondary);
                border-radius: var(--ytc-settings-border-radius);
                border: 1px solid var(--background-modifier-border);
                margin-bottom: 8px;
                transition: var(--ytc-settings-transition);
            }

            .ytc-header h2 {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
                color: var(--text-normal);
            }

            .ytc-status-badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: 600;
                transition: var(--ytc-settings-transition);
            }

            .ytc-status-badge.ready {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }

            .ytc-status-badge.setup-needed {
                background: var(--text-warning);
                color: var(--text-on-accent);
            }

            @media (prefers-reduced-motion: reduce) {
                .${SETTINGS_CSS_CLASSES.container},
                .${SETTINGS_CSS_CLASSES.section},
                .${SETTINGS_CSS_CLASSES.compact} * {
                    transition: none !important;
                    animation: none !important;
                }
            }
        `, []);

        styleSheet.textContent = cssContent;
        document.head.appendChild(styleSheet);

        // Add cleanup
        this.cleanupFunctions.push(() => {
            const style = document.getElementById('ytc-optimized-settings-styles');
            if (style) {
                style.remove();
            }
        });
    }

    /**
     * Create virtualized settings list for better performance
     */
    private createVirtualizedSettings(): void {
        const { containerEl } = this;

        // Create header
        this.createOptimizedHeader(containerEl);

        // Create main content area for virtual list
        const mainContent = containerEl.createDiv();
        mainContent.style.cssText = `
            flex: 1;
            position: relative;
            min-height: 400px;
        `;

        // Group settings by section
        const sections = useMemo(() => {
            const groups: Record<string, SettingItem[]> = {};
            this.settingItems.forEach(item => {
                if (!groups[item.section]) {
                    groups[item.section] = [];
                }
                groups[item.section].push(item);
            });
            return groups;
        }, [this.settingItems]);

        // Create section containers
        Object.entries(sections).forEach(([sectionKey, items]) => {
            const sectionContainer = mainContent.createDiv();
            sectionContainer.addClass(SETTINGS_CSS_CLASSES.section);

            // Section header
            const sectionHeader = sectionContainer.createEl('h3', {
                text: this.getSectionTitle(sectionKey),
                style: `
                    margin: 0 0 6px 0;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-normal);
                `
            });

            // Create settings for this section
            items.forEach(item => {
                this.createOptimizedSetting(sectionContainer, item);
            });
        });

        // Add performance metrics display (in development)
        if (process.env.NODE_ENV === 'development') {
            this.addPerformanceMetrics(containerEl);
        }
    }

    /**
     * Create optimized header
     */
    private createOptimizedHeader(containerEl: HTMLElement): void {
        const header = containerEl.createDiv();
        header.addClass('ytc-header');

        // Title
        const title = header.createEl('h2', {
            text: 'YT Clipper Settings'
        });

        // Status badge
        const hasValidConfig = this.validateConfiguration();
        const statusBadge = header.createDiv();
        statusBadge.addClass('ytc-status-badge');
        statusBadge.addClass(hasValidConfig ? 'ready' : 'setup-needed');
        statusBadge.textContent = hasValidConfig ? '✓ Ready' : '⚠ Setup Needed';
    }

    /**
     * Get section title with memoization
     */
    private getSectionTitle = memo((sectionKey: string): string => {
        const titles = useMemo(() => ({
            api: '🔑 API Configuration',
            ai: '⚙️ AI Parameters',
            files: '📁 File Settings',
            advanced: '⚙️ Advanced Settings'
        }), []);

        return titles[sectionKey] || sectionKey;
    });

    /**
     * Create optimized setting control
     */
    @trackComponentPerformance({ component: 'SettingsItem', threshold: 50 })
    private createOptimizedSetting(container: HTMLElement, item: SettingItem): void {
        const settingContainer = container.createDiv();
        settingContainer.addClass(SETTINGS_CSS_CLASSES.compact);

        // Memoized setting creation based on type
        switch (item.type) {
            case 'text':
                this.createTextSetting(settingContainer, item);
                break;
            case 'toggle':
                this.createToggleSetting(settingContainer, item);
                break;
            case 'dropdown':
                this.createDropdownSetting(settingContainer, item);
                break;
            case 'slider':
                this.createSliderSetting(settingContainer, item);
                break;
            case 'button':
                this.createButtonSetting(settingContainer, item);
                break;
        }
    }

    /**
     * Create text input setting with debounced validation
     */
    private createTextSetting(container: HTMLElement, item: SettingItem): void {
        new Setting(container)
            .setName(item.title)
            .setDesc(item.description)
            .addText(text => {
                text.setPlaceholder(item.placeholder || '');
                text.setValue(item.value || this.settings[item.id as keyof YouTubePluginSettings] || '');

                // Debounced input handler
                const debouncedHandler = debounce(async (value: string) => {
                    // Validate if validator exists
                    if (item.validator && !item.validator(value)) {
                        // Show validation error feedback
                        text.inputEl.style.borderColor = 'var(--text-error)';
                        return;
                    }

                    text.inputEl.style.borderColor = '';
                    await item.onChange(value);
                }, 300);

                const cleanup = addOptimizedEventListener(text.inputEl, 'input', (e) => {
                    debouncedHandler((e.target as HTMLInputElement).value);
                });

                this.cleanupFunctions.push(cleanup);
            })
            .setClass(SETTINGS_CSS_CLASSES.compact);
    }

    /**
     * Create toggle setting
     */
    private createToggleSetting(container: HTMLElement, item: SettingItem): void {
        new Setting(container)
            .setName(item.title)
            .setDesc(item.description)
            .addToggle(toggle => {
                toggle.setValue(item.value ?? this.settings[item.id as keyof YouTubePluginSettings] ?? false);

                const cleanup = addOptimizedEventListener(toggle.toggleEl, 'change', async () => {
                    await item.onChange(toggle.getValue());
                });

                this.cleanupFunctions.push(cleanup);
            })
            .setClass(SETTINGS_CSS_CLASSES.compact);
    }

    /**
     * Create dropdown setting
     */
    private createDropdownSetting(container: HTMLElement, item: SettingItem): void {
        new Setting(container)
            .setName(item.title)
            .setDesc(item.description)
            .addDropdown(dropdown => {
                // Add options
                item.options?.forEach(option => {
                    dropdown.addOption(option.value, option.text);
                });

                // Set current value
                dropdown.setValue(item.value ?? this.settings[item.id as keyof YouTubePluginSettings] ?? '');

                const cleanup = addOptimizedEventListener(dropdown.selectEl, 'change', async () => {
                    await item.onChange(dropdown.getValue());
                });

                this.cleanupFunctions.push(cleanup);
            })
            .setClass(SETTINGS_CSS_CLASSES.compact);
    }

    /**
     * Create slider setting with optimized value display
     */
    private createSliderSetting(container: HTMLElement, item: SettingItem): void {
        const sliderContainer = container.createDiv();
        sliderContainer.style.marginBottom = '8px';

        // Label and value display
        const labelRow = sliderContainer.createDiv();
        labelRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        `;

        const label = labelRow.createSpan();
        label.textContent = item.title;
        label.style.cssText = `
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--text-normal);
        `;

        const valueDisplay = labelRow.createSpan();
        const currentValue = item.value ?? this.settings[item.id as keyof YouTubePluginSettings] ?? 0;
        valueDisplay.textContent = item.id === 'defaultTemperature'
            ? parseFloat(currentValue.toString()).toFixed(1)
            : currentValue.toString();
        valueDisplay.style.cssText = `
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--interactive-accent);
            padding: 2px 6px;
            background: var(--background-primary);
            border-radius: 4px;
            border: 1px solid var(--interactive-accent);
            min-width: 40px;
            text-align: center;
        `;

        // Description
        if (item.description) {
            const desc = sliderContainer.createDiv();
            desc.textContent = item.description;
            desc.style.cssText = `
                font-size: 0.7rem;
                color: var(--text-muted);
                margin-bottom: 4px;
            `;
        }

        // Slider
        const slider = sliderContainer.createEl('input', { type: 'range' });
        slider.className = 'ytc-slider';
        slider.min = (item.min || 0).toString();
        slider.max = (item.max || 100).toString();
        slider.step = (item.step || 1).toString();
        slider.value = currentValue.toString();

        // Throttled input handler for value display
        const throttledUpdate = throttle((value: string) => {
            valueDisplay.textContent = item.id === 'defaultTemperature'
                ? parseFloat(value).toFixed(1)
                : value;
        }, 50);

        const cleanupInput = addOptimizedEventListener(slider, 'input', (e) => {
            throttledUpdate((e.target as HTMLInputElement).value);
        });

        // Debounced change handler
        const debouncedChange = debounce(async (value: string) => {
            const finalValue = item.id === 'defaultTemperature'
                ? parseFloat(value)
                : parseInt(value);
            await item.onChange(finalValue);
        }, 300);

        const cleanupChange = addOptimizedEventListener(slider, 'change', (e) => {
            debouncedChange((e.target as HTMLInputElement).value);
        });

        this.cleanupFunctions.push(cleanupInput, cleanupChange);
    }

    /**
     * Create button setting
     */
    private createButtonSetting(container: HTMLElement, item: SettingItem): void {
        new Setting(container)
            .setName(item.title)
            .setDesc(item.description)
            .addButton(button => {
                button.setButtonText('Test');
                button.setCta();

                const cleanup = addOptimizedEventListener(button.buttonEl, 'click', async () => {
                    // Disable button and show loading
                    button.setDisabled(true);
                    button.setButtonText('Testing...');

                    try {
                        await item.onChange(null);
                        button.setButtonText('✓ Success');
                        setTimeout(() => {
                            button.setButtonText('Test');
                            button.setDisabled(false);
                        }, 2000);
                    } catch (error) {
                        button.setButtonText('✗ Failed');
                        ErrorHandler.handle(error as Error, 'Setting operation failed', true);
                        setTimeout(() => {
                            button.setButtonText('Test');
                            button.setDisabled(false);
                        }, 2000);
                    }
                });

                this.cleanupFunctions.push(cleanup);
            })
            .setClass(SETTINGS_CSS_CLASSES.compact);
    }

    /**
     * Add performance metrics display (development only)
     */
    private addPerformanceMetrics(containerEl: HTMLElement): void {
        const metricsContainer = containerEl.createDiv();
        metricsContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            padding: 8px;
            font-size: 0.7rem;
            color: var(--text-muted);
            z-index: 1000;
        `;

        const updateMetrics = () => {
            metricsContainer.innerHTML = `
                <div>Renders: ${this.renderCount}</div>
                <div>Last: ${((performance.now() - this.lastRenderTime) / 1000).toFixed(2)}s</div>
                <div>Settings: ${this.settingItems.length}</div>
            `;
        };

        updateMetrics();
        setInterval(updateMetrics, 1000);
    }

    /**
     * Validate configuration with memoization
     */
    private validateConfiguration = memo((): boolean => {
        const hasApiKey = this.settings.geminiApiKey?.trim() || this.settings.groqApiKey?.trim();
        const hasValidPath = ValidationUtils.isValidPath(this.settings.outputPath);
        return Boolean(hasApiKey && hasValidPath);
    }, [this.settings]);

    /**
     * Test API keys with performance tracking
     */
    @trackComponentPerformance({ component: 'SettingsTab', threshold: 5000 })
    private async testAPIKeys(): Promise<void> {
        const errors: string[] = [];

        if (this.settings.geminiApiKey) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.geminiApiKey}`
                );
                if (!response.ok) {
                    errors.push(`Gemini API key invalid (${response.status})`);
                }
            } catch (error) {
                errors.push('Gemini API key test failed (network error)');
            }
        } else {
            errors.push('Gemini API key not configured');
        }

        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }

    /**
     * Update setting with validation and debounced saving
     */
    private updateSetting = useCallback(async (
        key: keyof YouTubePluginSettings,
        value: string | boolean | number | 'fast' | 'balanced' | 'quality'
    ): Promise<void> => {
        try {
            (this.settings as any)[key] = value;
            await this.validateAndSaveSettings();
        } catch (error) {
            ErrorHandler.handle(error as Error, `Settings update for ${key}`);
        }
    }, []);

    /**
     * Validate and save settings
     */
    private validateAndSaveSettings = useCallback(async (): Promise<void> => {
        const validation = ValidationUtils.validateSettings(this.settings);
        this.validationErrors = validation.errors;

        if (validation.isValid) {
            await this.options.onSettingsChange(this.settings);
        }

        // Debounced refresh to prevent excessive re-renders
        const debouncedRefresh = debounce(() => this.display(), 100);
        debouncedRefresh();
    }, [this.settings]);

    /**
     * Get current settings
     */
    getSettings(): YouTubePluginSettings {
        return useMemo(() => ({ ...this.settings }), [this.settings]);
    }

    /**
     * Update settings from external source
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        // Only update if actually different
        if (JSON.stringify(this.settings) !== JSON.stringify(newSettings)) {
            this.settings = { ...newSettings };
            // Debounce display update
            const debouncedUpdate = debounce(() => this.display(), 50);
            debouncedUpdate();
        }
    }

    /**
     * Cleanup all resources
     */
    hide(): void {
        // Run all cleanup functions
        this.cleanupFunctions.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                console.warn('Error during settings cleanup:', error);
            }
        });
        this.cleanupFunctions = [];

        // Clear resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        super.hide();
    }
}

// Export memoized version
export const MemoizedYouTubeSettingsTab = memo(OptimizedYouTubeSettingsTab, (prevProps, nextProps) => {
    return shallowEqual(prevProps.options, nextProps.options);
});

function shallowEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => obj1[key] === obj2[key]);
}