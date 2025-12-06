import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { YouTubePluginSettings, PerformanceMode } from './types';

/**
 * Settings tab options interface
 */
export interface SettingsTabOptions {
    plugin: any;
    onSettingsChange: (settings: YouTubePluginSettings) => Promise<void>;
}

/**
 * YouTube Clipper Settings Tab
 * Clean implementation for Obsidian plugin settings
 */
export class YouTubeSettingsTab extends PluginSettingTab {
    private settings: YouTubePluginSettings;
    private onSettingsChange: (settings: YouTubePluginSettings) => Promise<void>;

    constructor(app: App, options: SettingsTabOptions) {
        super(app, options.plugin);
        this.settings = { ...options.plugin.settings };
        this.onSettingsChange = options.onSettingsChange;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Main header
        containerEl.createEl('h1', { text: 'YouTube Clipper Settings' });

        // Status indicator
        this.createStatusBadge(containerEl);

        // API Keys Section
        this.createAPISection(containerEl);

        // AI Parameters Section
        this.createAIParametersSection(containerEl);

        // File Settings Section
        this.createFileSettingsSection(containerEl);

        // Advanced Settings Section
        this.createAdvancedSettingsSection(containerEl);

        // Help Section
        this.createHelpSection(containerEl);
    }

    /**
     * Create status badge showing configuration state
     */
    private createStatusBadge(containerEl: HTMLElement): void {
        const statusDiv = containerEl.createDiv({ cls: 'ytc-status-container' });
        statusDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding: 10px;
            background: var(--background-secondary);
            border-radius: 8px;
        `;

        const hasValidConfig = this.hasValidAPIKey();
        const badge = statusDiv.createSpan();
        badge.style.cssText = `
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
        `;

        if (hasValidConfig) {
            badge.style.background = 'var(--interactive-accent)';
            badge.style.color = 'var(--text-on-accent)';
            badge.textContent = '✓ Ready to use';
        } else {
            badge.style.background = 'var(--text-warning)';
            badge.style.color = 'white';
            badge.textContent = '⚠ API key required';
        }
    }

    /**
     * Check if at least one valid API key is configured
     */
    private hasValidAPIKey(): boolean {
        const hasGemini = this.settings.geminiApiKey?.trim()?.startsWith('AIza');
        const hasGroq = this.settings.groqApiKey?.trim()?.startsWith('gsk_');
        return hasGemini || hasGroq;
    }

    /**
     * Create API Keys configuration section
     */
    private createAPISection(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: '🔑 API Keys' });

        const desc = containerEl.createEl('p', {
            text: 'Configure at least one AI provider to use YouTube Clipper.',
            cls: 'setting-item-description'
        });
        desc.style.marginBottom = '15px';

        // Gemini API Key
        new Setting(containerEl)
            .setName('Google Gemini API Key')
            .setDesc('Get your key from Google AI Studio')
            .addText(text => text
                .setPlaceholder('AIzaSy...')
                .setValue(this.settings.geminiApiKey || '')
                .onChange(async (value) => {
                    this.settings.geminiApiKey = value;
                    await this.saveSettings();
                }))
            .addExtraButton(btn => btn
                .setIcon('external-link')
                .setTooltip('Open Google AI Studio')
                .onClick(() => {
                    window.open('https://aistudio.google.com/app/apikey', '_blank');
                }));

        // Groq API Key
        new Setting(containerEl)
            .setName('Groq API Key')
            .setDesc('Get your key from Groq Console')
            .addText(text => text
                .setPlaceholder('gsk_...')
                .setValue(this.settings.groqApiKey || '')
                .onChange(async (value) => {
                    this.settings.groqApiKey = value;
                    await this.saveSettings();
                }))
            .addExtraButton(btn => btn
                .setIcon('external-link')
                .setTooltip('Open Groq Console')
                .onClick(() => {
                    window.open('https://console.groq.com/keys', '_blank');
                }));

        // Ollama API Key (optional)
        new Setting(containerEl)
            .setName('Ollama API Key (Optional)')
            .setDesc('For authenticated local Ollama instances')
            .addText(text => text
                .setPlaceholder('Optional')
                .setValue(this.settings.ollamaApiKey || '')
                .onChange(async (value) => {
                    this.settings.ollamaApiKey = value;
                    await this.saveSettings();
                }));

        // Test API Keys button
        new Setting(containerEl)
            .setName('Test API Connection')
            .setDesc('Verify your API keys are working')
            .addButton(btn => btn
                .setButtonText('Test Keys')
                .setCta()
                .onClick(async () => {
                    btn.setDisabled(true);
                    btn.setButtonText('Testing...');
                    try {
                        await this.testAPIKeys();
                        new Notice('✓ API keys are valid!');
                        btn.setButtonText('✓ Success');
                    } catch (error) {
                        new Notice(`✗ ${(error as Error).message}`);
                        btn.setButtonText('✗ Failed');
                    }
                    setTimeout(() => {
                        btn.setButtonText('Test Keys');
                        btn.setDisabled(false);
                    }, 2000);
                }));
    }

    /**
     * Create AI Parameters configuration section
     */
    private createAIParametersSection(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: '⚙️ AI Parameters' });

        // Max Tokens
        new Setting(containerEl)
            .setName('Max Tokens')
            .setDesc(`Response length limit: ${this.settings.defaultMaxTokens || 4096} tokens`)
            .addSlider(slider => slider
                .setLimits(256, 8192, 256)
                .setValue(this.settings.defaultMaxTokens || 4096)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.settings.defaultMaxTokens = value;
                    await this.saveSettings();
                    this.display(); // Refresh to update description
                }));

        // Temperature
        new Setting(containerEl)
            .setName('Temperature')
            .setDesc(`Creativity level: ${(this.settings.defaultTemperature || 0.5).toFixed(1)} (0 = focused, 2 = creative)`)
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.settings.defaultTemperature || 0.5)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.settings.defaultTemperature = value;
                    await this.saveSettings();
                    this.display(); // Refresh to update description
                }));

        // Performance Mode
        new Setting(containerEl)
            .setName('Performance Mode')
            .setDesc('Balance between speed and quality')
            .addDropdown(dropdown => dropdown
                .addOption('fast', 'Fast - Quick results')
                .addOption('balanced', 'Balanced - Best of both')
                .addOption('quality', 'Quality - Best results')
                .setValue(this.settings.performanceMode || 'balanced')
                .onChange(async (value) => {
                    this.settings.performanceMode = value as PerformanceMode;
                    await this.saveSettings();
                }));
    }

    /**
     * Create File Settings configuration section
     */
    private createFileSettingsSection(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: '📁 File Settings' });

        // Output Path
        new Setting(containerEl)
            .setName('Output Folder')
            .setDesc('Where to save processed video notes')
            .addText(text => text
                .setPlaceholder('YouTube/Processed Videos')
                .setValue(this.settings.outputPath || 'YouTube/Processed Videos')
                .onChange(async (value) => {
                    this.settings.outputPath = value || 'YouTube/Processed Videos';
                    await this.saveSettings();
                }));
    }

    /**
     * Create Advanced Settings configuration section
     */
    private createAdvancedSettingsSection(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: '🔧 Advanced Settings' });

        // Parallel Processing
        new Setting(containerEl)
            .setName('Enable Parallel Processing')
            .setDesc('Process multiple requests simultaneously')
            .addToggle(toggle => toggle
                .setValue(this.settings.enableParallelProcessing ?? true)
                .onChange(async (value) => {
                    this.settings.enableParallelProcessing = value;
                    await this.saveSettings();
                }));

        // Multimodal Analysis
        new Setting(containerEl)
            .setName('Prefer Multimodal Analysis')
            .setDesc('Use video/audio analysis when available')
            .addToggle(toggle => toggle
                .setValue(this.settings.preferMultimodal ?? false)
                .onChange(async (value) => {
                    this.settings.preferMultimodal = value;
                    await this.saveSettings();
                }));

        // Environment Variables
        new Setting(containerEl)
            .setName('Use Environment Variables')
            .setDesc('Load API keys from environment variables')
            .addToggle(toggle => toggle
                .setValue(this.settings.useEnvironmentVariables ?? false)
                .onChange(async (value) => {
                    this.settings.useEnvironmentVariables = value;
                    await this.saveSettings();
                    this.display(); // Refresh to show/hide env prefix
                }));

        // Environment Prefix (shown only if env vars enabled)
        if (this.settings.useEnvironmentVariables) {
            new Setting(containerEl)
                .setName('Environment Variable Prefix')
                .setDesc('Prefix for environment variable names (e.g., YTC_GEMINI_API_KEY)')
                .addText(text => text
                    .setPlaceholder('YTC')
                    .setValue(this.settings.environmentPrefix || 'YTC')
                    .onChange(async (value) => {
                        this.settings.environmentPrefix = value || 'YTC';
                        await this.saveSettings();
                    }));
        }
    }

    /**
     * Create Help section with quick start guide
     */
    private createHelpSection(containerEl: HTMLElement): void {
        containerEl.createEl('h2', { text: '❓ Quick Start' });

        const helpDiv = containerEl.createDiv();
        helpDiv.style.cssText = `
            background: var(--background-secondary);
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
        `;

        const steps = [
            'Add your Gemini or Groq API key above',
            'Click "Test Keys" to verify connection',
            'Use the ribbon icon or command palette to process videos',
            'Paste a YouTube URL and select output format'
        ];

        const stepsList = helpDiv.createEl('ol');
        stepsList.style.cssText = 'margin: 0; padding-left: 20px;';
        
        steps.forEach(step => {
            const li = stepsList.createEl('li');
            li.textContent = step;
            li.style.marginBottom = '8px';
        });

        // Links section
        const linksDiv = helpDiv.createDiv();
        linksDiv.style.cssText = 'margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--background-modifier-border);';
        
        linksDiv.createEl('strong', { text: 'Get API Keys: ' });
        
        const geminiLink = linksDiv.createEl('a', {
            text: 'Google Gemini',
            href: 'https://aistudio.google.com/app/apikey'
        });
        geminiLink.style.marginRight = '15px';
        
        linksDiv.createEl('a', {
            text: 'Groq',
            href: 'https://console.groq.com/keys'
        });
    }

    /**
     * Test API keys for validity
     */
    private async testAPIKeys(): Promise<void> {
        const errors: string[] = [];

        if (this.settings.geminiApiKey?.trim()) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.geminiApiKey}`
                );
                if (!response.ok) {
                    errors.push(`Gemini: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                errors.push('Gemini: Network error');
            }
        }

        if (this.settings.groqApiKey?.trim()) {
            try {
                const response = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: {
                        'Authorization': `Bearer ${this.settings.groqApiKey}`
                    }
                });
                if (!response.ok) {
                    errors.push(`Groq: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                errors.push('Groq: Network error');
            }
        }

        if (!this.settings.geminiApiKey?.trim() && !this.settings.groqApiKey?.trim()) {
            throw new Error('No API keys configured');
        }

        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
    }

    /**
     * Save settings and notify parent
     */
    private async saveSettings(): Promise<void> {
        await this.onSettingsChange(this.settings);
    }

    /**
     * Get current settings (for external access)
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
