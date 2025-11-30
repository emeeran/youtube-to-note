/**
 * Plugin settings tab component
 * Designed to prevent conflicts with other plugin settings
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import { YouTubePluginSettings, OutputFormat } from './types/types';
import { MESSAGES } from './messages';
import { ValidationUtils } from './validation';
import { ErrorHandler } from './services/error-handler';
import { SecureConfigService } from './secure-config';

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

        // Create simple working layout
        this.createSimpleWorkingLayout();
    }

    /**
     * Create simple working layout
     */
    private createSimpleWorkingLayout(): void {
        const { containerEl } = this;

        // Set container styles
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.height = '100%';
        containerEl.style.gap = '12px';
        containerEl.style.padding = '12px';
        containerEl.style.overflow = 'hidden';
        containerEl.style.backgroundColor = 'var(--background-primary)';

        // Header
        this.createSimpleHeader();

        // Main content grid
        const mainContent = containerEl.createDiv();
        mainContent.style.display = 'grid';
        mainContent.style.gridTemplateColumns = '1fr 1fr';
        mainContent.style.gap = '16px';
        mainContent.style.flex = '1';
        mainContent.style.overflow = 'hidden';

        // Add responsive behavior
        const mediaQuery = window.matchMedia('(max-width: 800px)');
        const updateLayout = (e: MediaQueryListEvent | MediaQueryList) => {
            if (e.matches) {
                mainContent.style.gridTemplateColumns = '1fr';
                mainContent.style.gap = '12px';
            } else {
                mainContent.style.gridTemplateColumns = '1fr 1fr';
                mainContent.style.gap = '16px';
            }
        };
        mediaQuery.addEventListener('change', updateLayout as any);
        updateLayout(mediaQuery);

        // Create sections
        this.createAPISettingsSection(mainContent);
        this.createAIParametersSection(mainContent);
        this.createFileSettingsSection(mainContent);
        this.createAdvancedSettingsSection(mainContent);
        this.createQuickStartSection(mainContent);
    }

    /**
     * Create simple header
     */
    private createSimpleHeader(): void {
        const { containerEl } = this;

        const header = containerEl.createDiv();
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.padding = '8px 12px';
        header.style.background = 'var(--background-secondary)';
        header.style.borderRadius = '6px';
        header.style.border = '1px solid var(--background-modifier-border)';

        // Title
        const title = header.createEl('h2', {
            text: 'YouTubeClipper Settings',
            style: 'margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-normal);'
        });

        // Status
        const hasValidConfig = this.validateConfiguration();
        const statusBadge = header.createDiv();
        statusBadge.style.padding = '4px 12px';
        statusBadge.style.borderRadius = '12px';
        statusBadge.style.fontSize = '0.75rem';
        statusBadge.style.fontWeight = '600';

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
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '🔑 API Configuration',
            style: 'margin: 0 0 6px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Use Obsidian's Setting component for consistency
        new Setting(section)
            .setName('Gemini API Key')
            .setDesc('Google Gemini API key for content processing')
            .addText(text => text
                .setPlaceholder('AIza...')
                .setValue(this.settings.geminiApiKey || '')
                .onChange(async (value) => {
                    await this.updateSetting('geminiApiKey', value);
                }));

        new Setting(section)
            .setName('Groq API Key')
            .setDesc('Groq API key for fast processing')
            .addText(text => text
                .setPlaceholder('gsk_...')
                .setValue(this.settings.groqApiKey || '')
                .onChange(async (value) => {
                    await this.updateSetting('groqApiKey', value);
                }));

        // Test button
        const testDiv = section.createDiv();
        testDiv.style.marginTop = '4px';
        new Setting(testDiv)
            .setName('Test Connection')
            .setDesc('Verify API keys')
            .addButton(btn => btn
                .setButtonText('Test')
                .onClick(async () => {
                    btn.setDisabled(true);
                    btn.setButtonText('Testing...');
                    try {
                        await this.testAPIKeys();
                        btn.setButtonText('✓ Success');
                        setTimeout(() => {
                            btn.setButtonText('Test');
                            btn.setDisabled(false);
                        }, 1500);
                    } catch (error) {
                        btn.setButtonText('✗ Failed');
                        ErrorHandler.handle(error as Error, 'API key test failed', true);
                        setTimeout(() => {
                            btn.setButtonText('Test');
                            btn.setDisabled(false);
                        }, 1500);
                    }
                }));
    }

    /**
     * Create AI parameters section with model defaults
     */
    private createAIParametersSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '⚙️ AI Model Defaults',
            style: 'margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Add global slider styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .ytc-slider {
                width: 100% !important;
                height: 8px !important;
                border-radius: 4px !important;
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
                width: 18px !important;
                height: 18px !important;
                background: var(--interactive-accent) !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                border: 2px solid var(--text-on-accent) !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            }
            .ytc-slider::-moz-range-thumb {
                width: 18px !important;
                height: 18px !important;
                background: var(--interactive-accent) !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                border: 2px solid var(--text-on-accent) !important;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            }
            .ytc-slider::-webkit-slider-thumb:hover {
                transform: scale(1.1) !important;
            }
            .ytc-slider::-moz-range-thumb:hover {
                transform: scale(1.1) !important;
            }
        `;
        document.head.appendChild(styleSheet);

        // Compact slider container
        const createCompactSlider = (label: string, min: number, max: number, step: number, value: number, settingKey: string): HTMLElement => {
            const container = section.createDiv();
            container.style.marginBottom = '6px';

            const labelRow = container.createDiv();
            labelRow.style.display = 'flex';
            labelRow.style.justifyContent = 'space-between';
            labelRow.style.alignItems = 'center';
            labelRow.style.marginBottom = '4px';

            const labelText = labelRow.createSpan();
            labelText.textContent = label;
            labelText.style.fontSize = '0.85rem';
            labelText.style.fontWeight = '500';
            labelText.style.color = 'var(--text-normal)';

            const valueText = labelRow.createSpan();
            valueText.textContent = value.toString();
            valueText.style.fontSize = '0.8rem';
            valueText.style.fontWeight = '600';
            valueText.style.color = 'var(--interactive-accent)';
            valueText.style.padding = '2px 6px';
            valueText.style.background = 'var(--background-primary)';
            valueText.style.borderRadius = '4px';
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
            'Max Tokens',
            256,
            8192,
            256,
            this.settings.defaultMaxTokens || 4096,
            'defaultMaxTokens'
        );

        // Temperature slider
        createCompactSlider(
            'Temperature',
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
        scaleDiv.style.fontSize = '0.7rem';
        scaleDiv.style.color = 'var(--text-muted)';
        scaleDiv.style.marginTop = '-4px';
        scaleDiv.style.padding = '0 4px';
        scaleDiv.createSpan({ text: 'Precise' });
        scaleDiv.createSpan({ text: 'Creative' });

        // Performance Mode
        new Setting(section)
            .setName('Performance Mode')
            .setDesc('Speed vs. quality balance')
            .addDropdown(dropdown => dropdown
                .addOption('fast', 'Fast (10-30s)')
                .addOption('balanced', 'Balanced (30-60s)')
                .addOption('quality', 'Quality (60-120s)')
                .setValue(this.settings.performanceMode || 'balanced')
                .onChange(async (value) => {
                    await this.updateSetting('performanceMode', value as 'fast' | 'balanced' | 'quality');
                }));
    }

    /**
     * Create advanced settings section for moved options from modal
     */
    private createAdvancedSettingsSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '⚙️ Advanced Settings',
            style: 'margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Enable Parallel Processing
        new Setting(section)
            .setName('Enable Parallel Processing')
            .setDesc('Process with multiple providers simultaneously for faster results')
            .addToggle(toggle => toggle
                .setValue(this.settings.enableParallelProcessing || false)
                .onChange(async (value) => {
                    await this.updateSetting('enableParallelProcessing', value);
                }));

        // Prefer Multimodal Analysis
        new Setting(section)
            .setName('Prefer Multimodal Analysis')
            .setDesc('Use video-capable models that can analyze both audio and visual content')
            .addToggle(toggle => toggle
                .setValue(this.settings.preferMultimodal || false)
                .onChange(async (value) => {
                    await this.updateSetting('preferMultimodal', value);
                }));
    }

    /**
     * Create file settings section
     */
    private createFileSettingsSection(mainContent: HTMLElement): void {
        const section = mainContent.createDiv();
        section.style.background = 'var(--background-secondary)';
        section.style.border = '1px solid var(--background-modifier-border)';
        section.style.borderRadius = '6px';
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '📁 File Configuration',
            style: 'margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Use Obsidian's Setting component
        new Setting(section)
            .setName('Output Path')
            .setDesc('Folder for processed videos (relative to vault root)')
            .addText(text => text
                .setPlaceholder('YouTube/Processed Videos')
                .setValue(this.settings.outputPath || 'YouTube/Processed Videos')
                .onChange(async (value) => {
                    await this.updateSetting('outputPath', value);
                }));
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
        section.style.padding = '12px';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.gap = '8px';

        // Header
        const header = section.createEl('h3', {
            text: '🚀 Quick Start',
            style: 'margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600; color: var(--text-normal);'
        });

        // Steps
        const stepsDiv = section.createDiv();
        stepsDiv.style.fontSize = '0.8rem';
        stepsDiv.style.lineHeight = '1.4';

        const steps = [
            'Add API key (Gemini/Groq)',
            'Configure AI defaults',
            'Click video icon or paste URL',
            'Process video to create notes'
        ];

        steps.forEach((step, index) => {
            const stepDiv = stepsDiv.createDiv();
            stepDiv.style.marginBottom = '4px';
            stepDiv.style.display = 'flex';
            stepDiv.style.alignItems = 'flex-start';
            stepDiv.style.gap = '6px';

            const stepNumber = stepDiv.createSpan();
            stepNumber.textContent = (index + 1) + '.';
            stepNumber.style.color = 'var(--interactive-accent)';
            stepNumber.style.fontWeight = '600';
            stepNumber.style.minWidth = '16px';

            const stepText = stepDiv.createSpan();
            stepText.textContent = step;
        });

        // API links
        const linksDiv = section.createDiv();
        linksDiv.style.marginTop = '6px';
        linksDiv.style.paddingTop = '8px';
        linksDiv.style.borderTop = '1px solid var(--background-modifier-border)';
        linksDiv.style.fontSize = '0.75rem';
        linksDiv.style.color = 'var(--text-muted)';

        const linksLabel = linksDiv.createSpan();
        linksLabel.textContent = 'Get API Keys: ';
        linksLabel.style.fontWeight = '500';

        const geminiLink = linksDiv.createEl('a', {
            text: 'Gemini',
            href: 'https://aistudio.google.com/app/apikey',
            cls: 'external-link'
        });
        geminiLink.style.marginRight = '8px';
        geminiLink.style.color = 'var(--link-color)';

        const groqLink = linksDiv.createEl('a', {
            text: 'Groq',
            href: 'https://console.groq.com/keys',
            cls: 'external-link'
        });
        groqLink.style.color = 'var(--link-color)';
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