import { ErrorHandler } from './services/error-handler';
import { SecureConfigService } from './secure-config';
import { ValidationUtils } from './lib/utils-consolidated';
import { YouTubePluginSettings } from './types';
import { App, PluginSettingTab, Setting } from 'obsidian';

/**
 * Plugin settings tab component
 * Designed to prevent conflicts with other plugin settings
 */


// Unique CSS classes to prevent conflicts
const SETTINGS_CSS_CLASSES = {
    container: 'ytc-settings-container',
    section: 'ytc-settings-section',
    header: 'ytc-settings-header',
    validation: 'ytc-settings-validation'
} as const;

export interface SettingsTabOptions {
    plugin: any; // Plugin instance
    onSettingsChange: (settings: YouTubePluginSettings) => Promise<void>;
}

export class YouTubeSettingsTab extends PluginSettingTab {
    private settings: YouTubePluginSettings;
    private validationErrors: string[] = [];
    private secureConfig: SecureConfigService;

    constructor(
        app: App,
        private options: SettingsTabOptions
    ) {
        super(app, options.plugin);
        this.settings = { ...options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Add unique CSS class for conflict prevention
        containerEl.addClass(SETTINGS_CSS_CLASSES.container);
        containerEl.setAttribute('data-plugin', 'youtube-clipper');

        // Enhanced scrolling capability with better styling and visual indicators
        containerEl.style.overflowY = 'auto';
        containerEl.style.maxHeight = '80vh';
        containerEl.style.height = 'fit-content';
        containerEl.style.paddingRight = '8px';
        containerEl.style.margin = '0';
        containerEl.style.padding = '8px';

        // Add custom scrollbar styling for better UX
        this.addScrollbarStyling();

        // Create improved compact layout
        this.createImprovedCompactLayout();
    }

    /**
     * Add custom scrollbar styling for better UX
     */
    private addScrollbarStyling(): void {
        if (document.getElementById('ytc-scrollbar-styles')) {
            return; // Already added
        }

        const scrollbarStyle = document.createElement('style');
        scrollbarStyle.id = 'ytc-scrollbar-styles';
        scrollbarStyle.textContent = `
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
        `;
        document.head.appendChild(scrollbarStyle);
    }

    /**
     * Create improved compact and scollable layout
     */
    private createImprovedCompactLayout(): void {
        // Add compact CSS styles to the document
        this.addCompactStyles();

        const { containerEl } = this;

        // Set container styles for compact layout
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.height = 'fit-content';
        containerEl.style.gap = '8px';  // Reduced gap for compactness
        containerEl.style.padding = '8px';  // Reduced padding
        containerEl.style.overflow = 'visible';
        containerEl.style.backgroundColor = 'var(--background-primary)';

        // Compact header
        this.createCompactHeader();

        // Single column layout for better compactness
        const mainContent = containerEl.createDiv();
        mainContent.style.display = 'flex';
        mainContent.style.flexDirection = 'column';
        mainContent.style.gap = '8px';  // More compact spacing
        mainContent.style.width = '100%';

        // Create compact sections (using existing methods which are now compact)
        this.createAPISettingsSection(mainContent);
        this.createAIParametersSection(mainContent);
        this.createFileSettingsSection(mainContent);
        this.createAdvancedSettingsSection(mainContent);
        this.createQuickStartSection(mainContent);
    }

    /**
     * Add compact styles to the document
     */
    private addCompactStyles(): void {
        if (document.getElementById('ytc-compact-styles')) {
            return; // Already added
        }

        const compactStyle = document.createElement('style');
        compactStyle.id = 'ytc-compact-styles';
        compactStyle.textContent = `
            .${SETTINGS_CSS_CLASSES.container} .setting-item {
                padding: 6px 4px !important;
                margin: 2px 0 !important;
            }
            .${SETTINGS_CSS_CLASSES.container} .setting-item-name {
                font-size: 0.85rem !important;
                margin-bottom: 1px !important;
            }
            .${SETTINGS_CSS_CLASSES.container} .setting-item-description {
                font-size: 0.75rem !important;
                margin-bottom: 2px !important;
            }
            .${SETTINGS_CSS_CLASSES.container} input[type="text"] {
                font-size: 0.8rem !important;
                padding: 4px 6px !important;
            }
            .${SETTINGS_CSS_CLASSES.container} select {
                font-size: 0.8rem !important;
                padding: 4px 6px !important;
            }
            .${SETTINGS_CSS_CLASSES.container} button {
                font-size: 0.75rem !important;
                padding: 3px 8px !important;
            }
        `;
        document.head.appendChild(compactStyle);
    }

    /**
     * Create compact header
     */
    private createCompactHeader(): void {
        const { containerEl } = this;

        const header = containerEl.createDiv();
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 10px;
            background: var(--background-secondary);
            border-radius: 5px;
            border: 1px solid var(--background-modifier-border);
            margin-bottom: 6px;
        `;

        // Title
        const title = header.createEl('h2', {
            text: 'YT Clipper Settings',
            style: 'margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-normal);'
        });

        // Status
        const hasValidConfig = this.validateConfiguration();
        const statusBadge = header.createDiv();
        statusBadge.style.cssText = `
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 0.7rem;
            font-weight: 600;
        `;

        if (hasValidConfig) {
            statusBadge.style.background = 'var(--interactive-accent)';
            statusBadge.style.color = 'var(--text-on-accent)';
            statusBadge.textContent = '✓ Ready';
        } else {
            statusBadge.style.background = 'var(--text-warning)';
            statusBadge.style.color = 'var(--text-on-accent)';
            statusBadge.textContent = '⚠ Setup Needed';
        }
    }

    /**
     * Create API settings section
     */
    private createAPISettingsSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '6px';  // More compact
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '4px';     // Tighter spacing

        // Header
        const header = section.createEl('h3', {
            text: '🔑 API',
            style: 'margin: 0 0 3px 0; font-size: 0.85rem; font-weight: 600; color: var(--text-normal);'  // Smaller font
        });

        // Use Obsidian's Setting component for consistency
        new Setting(section)
            .setName('Gemi')
            .setDesc('Key')
            .addText(text => text
                .setPlaceholder('AIza...')
                .setValue(this.settings.geminiApiKey || '')
                .onChange(async (value) => {
                    await this.updateSetting('geminiApiKey', value);
                }))
            .setClass('compact-setting');

        new Setting(section)
            .setName('Groq')
            .setDesc('Key')
            .addText(text => text
                .setPlaceholder('gsk_...')
                .setValue(this.settings.groqApiKey || '')
                .onChange(async (value) => {
                    await this.updateSetting('groqApiKey', value);
                }))
            .setClass('compact-setting');

        new Setting(section)
            .setName('Ollm')
            .setDesc('Key')
            .addText(text => text
                .setPlaceholder('key')
                .setValue(this.settings.ollamaApiKey || '')
                .onChange(async (value) => {
                    await this.updateSetting('ollamaApiKey', value);
                }))
            .setClass('compact-setting');

        // Test button
        const testDiv = section.createDiv();
        testDiv.style.marginTop = '2px';
        new Setting(testDiv)
            .setName('Test')
            .setDesc('')
            .addButton(btn => btn
                .setButtonText('✓')
                .onClick(async () => {
                    btn.setDisabled(true);
                    btn.setButtonText('...');
                    try {
                        await this.testAPIKeys();
                        btn.setButtonText('✓');
                        setTimeout(() => {
                            btn.setButtonText('✓');
                            btn.setDisabled(false);
                        }, 1500);
                    } catch (error) {
                        btn.setButtonText('✗');
                        ErrorHandler.handle(error as Error, 'API key test failed', true);
                        setTimeout(() => {
                            btn.setButtonText('✓');
                            btn.setDisabled(false);
                        }, 1500);
                    }
                }))
            .setClass('compact-setting');
    }

    /**
     * Create AI parameters section with model defaults
     */
    private createAIParametersSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '6px';  // More compact
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '4px';     // Tighter spacing

        // Header
        const header = section.createEl('h3', {
            text: '⚙️ AI',
            style: 'margin: 0 0 3px 0; font-size: 0.85rem; font-weight: 600; color: var(--text-normal);'  // Smaller font
        });

        // Add global slider styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .ytc-slider {
                width: 100% !important;
                height: 5px !important; /* Even thinner for compactness */
                border-radius: 2px !important;
                background: var(--interactive-normal) !important;
                outline: none !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                cursor: pointer !important;
            }
            .ytc-slider:hover {
                background: var(--interactive-hover) !important;
            }
            .ytc-slider::-webkit-slider-thumb {
                -webkit-appearance: none !important;
                appearance: none !important;
                width: 14px !important; /* Smaller thumb */
                height: 14px !important;
                background: var(--interactive-accent) !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                border: 1px solid var(--text-on-accent) !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
            }
            .ytc-slider::-moz-range-thumb {
                width: 14px !important;
                height: 14px !important;
                background: var(--interactive-accent) !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                border: 1px solid var(--text-on-accent) !important;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
            }
        `;
        document.head.appendChild(styleSheet);

        // Compact slider container
        const createCompactSlider = (label: string, min: number, max: number, step: number, value: number, settingKey: string): HTMLElement => {
            const container = section.createDiv();
            container.style.marginBottom = '4px';  // Tighter

            const labelRow = container.createDiv();
            labelRow.style.display = 'flex';
            labelRow.style.justifyContent = 'space-between';
            labelRow.style.alignItems = 'center';
            labelRow.style.marginBottom = '2px';  // Tighter

            const labelText = labelRow.createSpan();
            labelText.textContent = label;
            labelText.style.fontSize = '0.75rem';  // Smaller font
            labelText.style.fontWeight = '500';
            labelText.style.color = 'var(--text-normal)';

            const valueText = labelRow.createSpan();
            valueText.textContent = value.toString();
            valueText.style.fontSize = '0.7rem';  // Smaller font
            valueText.style.fontWeight = '600';
            valueText.style.color = 'var(--interactive-accent)';
            valueText.style.padding = '1px 3px';  // Smaller padding
            valueText.style.background = 'var(--background-primary)';
            valueText.style.borderRadius = '2px';  // Smaller radius
            valueText.style.border = '1px solid var(--interactive-accent)';

            const slider = container.createEl('input', { type: 'range' });
            slider.className = 'ytc-slider';
            slider.min = min.toString();
            slider.max = max.toString();
            slider.step = step.toString();
            slider.value = value.toString();

            slider.addEventListener('input', () => {
                valueText.textContent = settingKey === 'defaultTemperature'
                    ? parseFloat(slider.value).toFixed(1)
                    : slider.value;
            });

            slider.addEventListener('change', async () => {
                const finalValue = settingKey === 'defaultTemperature'
                    ? parseFloat(slider.value)
                    : parseInt(slider.value);
                await this.updateSetting(settingKey, finalValue);
            });

            return container;
        };

        // Max Tokens slider
        createCompactSlider(
            'Tokens',
            256,
            8192,
            256,
            this.settings.defaultMaxTokens || 4096,
            'defaultMaxTokens'
        );

        // Temperature slider
        createCompactSlider(
            'Temp',
            0,
            2,
            0.1,
            this.settings.defaultTemperature || 0.5,
            'defaultTemperature'
        );

        // Scale labels
        const scaleDiv = section.createDiv();
        scaleDiv.style.display = 'flex';
        scaleDiv.style.justifyContent = 'space-between';
        scaleDiv.style.fontSize = '0.6rem';  // Smaller font
        scaleDiv.style.color = 'var(--text-muted)';
        scaleDiv.style.marginTop = '-4px';
        scaleDiv.style.padding = '0 1px';   // Less padding
        scaleDiv.createSpan({ text: 'P' });  // Abbreviated
        scaleDiv.createSpan({ text: 'C' });  // Abbreviated

        // Performance Mode
        new Setting(section)
            .setName('Perf')
            .setDesc('Mode')
            .addDropdown(dropdown => dropdown
                .addOption('fast', 'F')
                .addOption('balanced', 'B')
                .addOption('quality', 'Q')
                .setValue(this.settings.performanceMode || 'balanced')
                .onChange(async (value) => {
                    await this.updateSetting('performanceMode', value as 'fast' | 'balanced' | 'quality');
                }))
            .setClass('compact-setting');
    }

    /**
     * Create advanced settings section for moved options from modal
     */
    private createAdvancedSettingsSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '6px';  // More compact
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '3px';     // Tighter spacing

        // Header
        const header = section.createEl('h3', {
            text: '⚙️ Adv',
            style: 'margin: 0 0 2px 0; font-size: 0.85rem; font-weight: 600; color: var(--text-normal);'  // Smaller font
        });

        // Enable Parallel Processing
        new Setting(section)
            .setName('Parallel')
            .setDesc('Multi')
            .addToggle(toggle => toggle
                .setValue(this.settings.enableParallelProcessing || false)
                .onChange(async (value) => {
                    await this.updateSetting('enableParallelProcessing', value);
                }))
            .setClass('compact-setting');

        // Prefer Multimodal Analysis
        new Setting(section)
            .setName('MM-Audio')
            .setDesc('Vid')
            .addToggle(toggle => toggle
                .setValue(this.settings.preferMultimodal || false)
                .onChange(async (value) => {
                    await this.updateSetting('preferMultimodal', value);
                }))
            .setClass('compact-setting');
    }

    /**
     * Create file settings section
     */
    private createFileSettingsSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '6px';  // More compact
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '4px';     // Tighter spacing

        // Header
        const header = section.createEl('h3', {
            text: '📁 Files',
            style: 'margin: 0 0 2px 0; font-size: 0.85rem; font-weight: 600; color: var(--text-normal);'  // Smaller font
        });

        // Use Obsidian's Setting component
        new Setting(section)
            .setName('Path')
            .setDesc('Out')
            .addText(text => text
                .setPlaceholder('YT/Proc')
                .setValue(this.settings.outputPath || 'YouTube/Processed Videos')
                .onChange(async (value) => {
                    await this.updateSetting('outputPath', value);
                }))
            .setClass('compact-setting');
    }

    /**
     * Validate entire configuration
     */
    private validateConfiguration(): boolean {
        const hasApiKey = this.settings.geminiApiKey?.trim() || this.settings.groqApiKey?.trim();
        const hasValidPath = ValidationUtils.isValidPath(this.settings.outputPath);
        return Boolean(hasApiKey && hasValidPath);
    }

    /**
     * Show inline documentation
     */
    private showDocumentation(): void {
        window.open('https://github.com/youtube-clipper/obsidian-plugin#readme', '_blank');
    }

    /**
     * Create quick start section
     */
    private createQuickStartSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '6px';  // More compact
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '3px';     // Tighter spacing

        // Header
        const header = section.createEl('h3', {
            text: '🚀 Go',
            style: 'margin: 0 0 2px 0; font-size: 0.8rem; font-weight: 600; color: var(--text-normal);'  // Smaller font
        });

        // Steps
        const stepsDiv = section.createDiv();
        stepsDiv.style.fontSize = '0.7rem';  // Smaller font
        stepsDiv.style.lineHeight = '1.2';   // Tighter line spacing

        const steps = [
            'API (G/G)',
            'Cfg',
            'URL',
            'Go',
        ];

        steps.forEach((step, index) => {
            const stepDiv = stepsDiv.createDiv();
            stepDiv.style.marginBottom = '2px';  // Smaller gap
            stepDiv.style.display = 'flex';
            stepDiv.style.alignItems = 'flex-start';
            stepDiv.style.gap = '3px';  // Smaller gap

            const stepNumber = stepDiv.createSpan();
            stepNumber.textContent = (index + 1) + '.';
            stepNumber.style.color = 'var(--interactive-accent)';
            stepNumber.style.fontWeight = '600';
            stepNumber.style.minWidth = '10px';  // Smaller width

            const stepText = stepDiv.createSpan();
            stepText.textContent = step;
        });

        // API links
        const linksDiv = section.createDiv();
        linksDiv.style.marginTop = '3px';
        linksDiv.style.paddingTop = '3px';
        linksDiv.style.borderTop = '1px solid var(--background-modifier-border)';
        linksDiv.style.fontSize = '0.65rem';  // Smaller font
        linksDiv.style.color = 'var(--text-muted)';

        const linksLabel = linksDiv.createSpan();
        linksLabel.textContent = 'Keys: ';
        linksLabel.style.fontWeight = '500';

        const geminiLink = linksDiv.createEl('a', {
            text: 'G',
            href: 'https://aistudio.google.com/app/apikey',
            cls: 'external-link'
        });
        geminiLink.style.marginRight = '5px';
        geminiLink.style.color = 'var(--link-color)';
        geminiLink.style.fontSize = '0.65rem';  // Smaller font

        const groqLink = linksDiv.createEl('a', {
            text: 'Gr',
            href: 'https://console.groq.com/keys',
            cls: 'external-link'
        });
        groqLink.style.color = 'var(--link-color)';
        groqLink.style.fontSize = '0.65rem';  // Smaller font
    }

    /**
     * Test API keys for validity
     */
    private async testAPIKeys(): Promise<void> {
        const errors: string[] = [];

        if (this.settings.geminiApiKey) {
            try {
                const response = await fetch(
                    'https://generativelanguage.googleapis.com/v1beta/models?key=' + this.settings.geminiApiKey
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
     * Update a setting value
     */
    private async updateSetting(
        key: keyof YouTubePluginSettings,
        value: string | boolean | number | 'fast' | 'balanced' | 'quality'
    ): Promise<void> {
        try {
            (this.settings as any)[key] = value;
            await this.validateAndSaveSettings();
        } catch (error) {
            ErrorHandler.handle(error as Error, `Settings update for ${key}`);
        }
    }

    /**
     * Validate and save settings
     */
    private async validateAndSaveSettings(): Promise<void> {
        const validation = ValidationUtils.validateSettings(this.settings);
        this.validationErrors = validation.errors;

        if (validation.isValid) {
            await this.options.onSettingsChange(this.settings);
        }

        // Refresh display to show validation status
        this.display();
    }

    /**
     * Get current settings
     */
    getSettings(): YouTubePluginSettings {
        return { ...this.settings };
    }

    /**
     * Update settings from external source
     */
    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = { ...newSettings };
        this.display();
    }
}