import { ErrorHandler } from './services/error-handler';
import { SecureConfigService } from './secure-config';
import { ValidationUtils } from './validation';
import { YouTubePluginSettings } from './types';
import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';

/**
 * Plugin settings tab component
 * Clean, readable design with clear labels
 */

interface PluginWithSettings extends Plugin {
    settings: YouTubePluginSettings;
}

const CSS_PREFIX = 'ytc-settings';

export interface SettingsTabOptions {
    plugin: PluginWithSettings;
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
        containerEl.addClass(`${CSS_PREFIX}-container`);

        this.injectStyles();
        this.createHeader();
        this.createAPISection();
        this.createAISection();
        this.createOutputSection();
        this.createAdvancedSection();
        this.createHelpSection();
    }

    private injectStyles(): void {
        if (document.getElementById(`${CSS_PREFIX}-styles`)) return;

        const style = document.createElement('style');
        style.id = `${CSS_PREFIX}-styles`;
        style.textContent = `
            .${CSS_PREFIX}-container {
                max-width: 700px;
                margin: 0 auto;
            }

            .${CSS_PREFIX}-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                margin-bottom: 24px;
                background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-secondary-alt) 100%);
                border-radius: 12px;
                border: 1px solid var(--background-modifier-border);
            }

            .${CSS_PREFIX}-title {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .${CSS_PREFIX}-badge {
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 600;
            }

            .${CSS_PREFIX}-badge-ready {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }

            .${CSS_PREFIX}-badge-setup {
                background: #f59e0b;
                color: white;
            }

            .${CSS_PREFIX}-section {
                margin-bottom: 24px;
                padding: 20px;
                background: var(--background-secondary);
                border-radius: 12px;
                border: 1px solid var(--background-modifier-border);
            }

            .${CSS_PREFIX}-section-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--background-modifier-border);
            }

            .${CSS_PREFIX}-section-icon {
                font-size: 1.3rem;
            }

            .${CSS_PREFIX}-section-title {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 600;
            }

            .${CSS_PREFIX}-slider-wrap {
                margin: 16px 0;
                padding: 12px;
                background: var(--background-primary);
                border-radius: 8px;
            }

            .${CSS_PREFIX}-slider-top {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .${CSS_PREFIX}-slider-label {
                font-weight: 600;
                font-size: 0.95rem;
            }

            .${CSS_PREFIX}-slider-value {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                padding: 4px 12px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 0.85rem;
                min-width: 60px;
                text-align: center;
            }

            .${CSS_PREFIX}-slider-desc {
                font-size: 0.8rem;
                color: var(--text-muted);
                margin-top: 8px;
            }

            .${CSS_PREFIX}-slider {
                width: 100%;
                height: 8px;
                border-radius: 4px;
                background: var(--background-modifier-border);
                -webkit-appearance: none;
                appearance: none;
                cursor: pointer;
            }

            .${CSS_PREFIX}-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 20px;
                height: 20px;
                background: var(--interactive-accent);
                border-radius: 50%;
                cursor: pointer;
                border: 3px solid var(--background-primary);
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            }

            .${CSS_PREFIX}-slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
                background: var(--interactive-accent);
                border-radius: 50%;
                cursor: pointer;
                border: 3px solid var(--background-primary);
            }

            .${CSS_PREFIX}-slider-scale {
                display: flex;
                justify-content: space-between;
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-top: 6px;
            }

            .${CSS_PREFIX}-help-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }

            .${CSS_PREFIX}-help-card {
                padding: 14px;
                background: var(--background-primary);
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
                transition: border-color 0.2s ease;
            }

            .${CSS_PREFIX}-help-card:hover {
                border-color: var(--interactive-accent);
            }

            .${CSS_PREFIX}-help-card h4 {
                margin: 0 0 6px 0;
                font-size: 0.95rem;
            }

            .${CSS_PREFIX}-help-card p {
                margin: 0;
                font-size: 0.85rem;
                color: var(--text-muted);
            }

            .${CSS_PREFIX}-help-card a {
                color: var(--link-color);
            }

            .${CSS_PREFIX}-drawer {
                margin-bottom: 24px;
                border-radius: 12px;
                border: 1px solid var(--background-modifier-border);
                overflow: hidden;
            }

            .${CSS_PREFIX}-drawer-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 16px 20px;
                background: var(--background-secondary);
                cursor: pointer;
                user-select: none;
                transition: background 0.2s ease;
            }

            .${CSS_PREFIX}-drawer-header:hover {
                background: var(--background-secondary-alt);
            }

            .${CSS_PREFIX}-drawer-icon {
                font-size: 1.3rem;
            }

            .${CSS_PREFIX}-drawer-title {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 600;
                flex: 1;
            }

            .${CSS_PREFIX}-drawer-arrow {
                font-size: 0.9rem;
                transition: transform 0.3s ease;
                color: var(--text-muted);
            }

            .${CSS_PREFIX}-drawer.is-open .${CSS_PREFIX}-drawer-arrow {
                transform: rotate(180deg);
            }

            .${CSS_PREFIX}-drawer-content {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
                background: var(--background-secondary);
            }

            .${CSS_PREFIX}-drawer.is-open .${CSS_PREFIX}-drawer-content {
                max-height: 2000px;
            }

            .${CSS_PREFIX}-drawer-inner {
                padding: 0 20px 20px 20px;
            }

            .${CSS_PREFIX}-api-key-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .${CSS_PREFIX}-api-key-row .setting-item-control {
                flex-wrap: nowrap;
            }

            .${CSS_PREFIX}-validate-btn {
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 0.8rem;
                cursor: pointer;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                transition: all 0.2s ease;
                white-space: nowrap;
            }

            .${CSS_PREFIX}-validate-btn:hover {
                background: var(--background-modifier-hover);
                border-color: var(--interactive-accent);
            }

            .${CSS_PREFIX}-validate-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .${CSS_PREFIX}-validate-btn.is-success {
                background: #22c55e;
                color: white;
                border-color: #22c55e;
            }

            .${CSS_PREFIX}-validate-btn.is-error {
                background: #ef4444;
                color: white;
                border-color: #ef4444;
            }
        `;
        document.head.appendChild(style);
    }

    private createDrawer(title: string, icon: string, isOpenByDefault = false): { drawer: HTMLElement; content: HTMLElement } {
        const drawer = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-drawer${isOpenByDefault ? ' is-open' : ''}` });
        
        const header = drawer.createDiv({ cls: `${CSS_PREFIX}-drawer-header` });
        header.createSpan({ cls: `${CSS_PREFIX}-drawer-icon`, text: icon });
        header.createEl('h3', { cls: `${CSS_PREFIX}-drawer-title`, text: title });
        header.createSpan({ cls: `${CSS_PREFIX}-drawer-arrow`, text: '▼' });

        const contentWrapper = drawer.createDiv({ cls: `${CSS_PREFIX}-drawer-content` });
        const content = contentWrapper.createDiv({ cls: `${CSS_PREFIX}-drawer-inner` });

        header.addEventListener('click', () => {
            drawer.classList.toggle('is-open');
        });

        return { drawer, content };
    }

    private createHeader(): void {
        const { containerEl } = this;
        const header = containerEl.createDiv({ cls: `${CSS_PREFIX}-header` });

        const title = header.createEl('h2', { cls: `${CSS_PREFIX}-title` });
        title.createSpan({ text: '🎬' });
        title.createSpan({ text: 'YT Clipper' });

        const isReady = this.validateConfiguration();
        const badge = header.createDiv({
            cls: `${CSS_PREFIX}-badge ${isReady ? `${CSS_PREFIX}-badge-ready` : `${CSS_PREFIX}-badge-setup`}`
        });
        badge.textContent = isReady ? '✓ Ready' : '⚠ Setup Required';
    }

    private createAPISection(): void {
        const { content: section } = this.createDrawer('API Keys', '🔑', false);

        this.createAPIKeySetting(section, {
            name: 'Google Gemini API Key',
            desc: 'Primary AI provider for video analysis. Get free key from Google AI Studio.',
            placeholder: 'Enter your Gemini API key (AIzaSy...)',
            settingKey: 'geminiApiKey',
            validateFn: async (key: string) => {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            }
        });

        this.createAPIKeySetting(section, {
            name: 'Groq API Key',
            desc: 'Fast alternative AI provider. Get free key from Groq Console.',
            placeholder: 'Enter your Groq API key (gsk_...)',
            settingKey: 'groqApiKey',
            validateFn: async (key: string) => {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { Authorization: `Bearer ${key}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            }
        });

        this.createAPIKeySetting(section, {
            name: 'Hugging Face API Key',
            desc: 'Get from huggingface.co/settings/tokens (free tier available)',
            placeholder: 'hf_...',
            settingKey: 'huggingFaceApiKey',
            validateFn: async (key: string) => {
                const res = await fetch('https://huggingface.co/api/whoami-v2', {
                    headers: { Authorization: `Bearer ${key}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            }
        });

        this.createAPIKeySetting(section, {
            name: 'OpenRouter API Key',
            desc: 'Get from openrouter.ai/keys (free models available)',
            placeholder: 'sk-or-...',
            settingKey: 'openRouterApiKey',
            validateFn: async (key: string) => {
                const res = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { Authorization: `Bearer ${key}` }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            }
        });

        this.createAPIKeySetting(section, {
            name: 'Ollama API Key',
            desc: 'Optional: For authenticated local Ollama instances.',
            placeholder: 'Optional - leave blank for default Ollama',
            settingKey: 'ollamaApiKey',
            validateFn: async (_key: string) => {
                const res = await fetch('http://localhost:11434/api/tags');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            }
        });
    }

    private createAPIKeySetting(container: HTMLElement, opts: {
        name: string;
        desc: string;
        placeholder: string;
        settingKey: keyof YouTubePluginSettings;
        validateFn: (key: string) => Promise<void>;
    }): void {
        const setting = new Setting(container)
            .setName(opts.name)
            .setDesc(opts.desc)
            .addText(text => {
                text.inputEl.type = 'password';
                text.inputEl.autocomplete = 'off';
                text
                    .setPlaceholder(opts.placeholder)
                    .setValue((this.settings[opts.settingKey] as string) || '')
                    .onChange(async (value) => {
                        await this.updateSetting(opts.settingKey, value.trim());
                    });
            });

        const controlEl = setting.controlEl;
        const validateBtn = controlEl.createEl('button', {
            cls: `${CSS_PREFIX}-validate-btn`,
            text: '✓ Test'
        });

        validateBtn.addEventListener('click', async () => {
            const key = (this.settings[opts.settingKey] as string)?.trim();
            if (!key && opts.settingKey !== 'ollamaApiKey') {
                new Notice(`No ${opts.name} configured`);
                return;
            }

            validateBtn.disabled = true;
            validateBtn.textContent = '...';
            validateBtn.removeClass('is-success', 'is-error');

            try {
                await opts.validateFn(key);
                validateBtn.textContent = '✓ Valid';
                validateBtn.addClass('is-success');
                new Notice(`✓ ${opts.name} is valid!`);
            } catch (err) {
                validateBtn.textContent = '✗ Invalid';
                validateBtn.addClass('is-error');
                new Notice(`✗ ${opts.name} failed: ${(err as Error).message}`);
            }

            setTimeout(() => {
                validateBtn.textContent = '✓ Test';
                validateBtn.removeClass('is-success', 'is-error');
                validateBtn.disabled = false;
            }, 3000);
        });
    }

    private createAISection(): void {
        const { content: section } = this.createDrawer('AI Configuration', '🤖', false);

        // Max Tokens slider
        this.createSlider(section, {
            label: 'Maximum Output Tokens',
            desc: 'Controls the length of generated notes. Higher values produce more detailed output.',
            min: 512,
            max: 8192,
            step: 256,
            value: this.settings.defaultMaxTokens || 4096,
            key: 'defaultMaxTokens',
            format: (v) => v.toLocaleString(),
            scale: ['Short (512)', 'Long (8192)']
        });

        // Temperature slider
        this.createSlider(section, {
            label: 'Temperature',
            desc: 'Controls AI creativity. Lower = more focused/factual, Higher = more creative.',
            min: 0,
            max: 1,
            step: 0.1,
            value: this.settings.defaultTemperature ?? 0.5,
            key: 'defaultTemperature',
            format: (v) => v.toFixed(1),
            scale: ['Precise (0)', 'Creative (1)']
        });

        new Setting(section)
            .setName('Performance Mode')
            .setDesc('Choose processing speed vs output quality tradeoff.')
            .addDropdown(dd => dd
                .addOption('fast', '⚡ Fast — Quick results, basic analysis')
                .addOption('balanced', '⚖️ Balanced — Good speed & quality')
                .addOption('quality', '✨ Quality — Best results, slower')
                .setValue(this.settings.performanceMode || 'balanced')
                .onChange(async (value) => {
                    await this.updateSetting('performanceMode', value as 'fast' | 'balanced' | 'quality');
                }));
    }

    private createOutputSection(): void {
        const section = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-section` });

        const header = section.createDiv({ cls: `${CSS_PREFIX}-section-header` });
        header.createSpan({ cls: `${CSS_PREFIX}-section-icon`, text: '📁' });
        header.createEl('h3', { cls: `${CSS_PREFIX}-section-title`, text: 'Output Settings' });

        new Setting(section)
            .setName('Output Folder')
            .setDesc('Folder path where processed video notes will be saved.')
            .addText(text => text
                .setPlaceholder('YouTube/Processed Videos')
                .setValue(this.settings.outputPath || 'YouTube/Processed Videos')
                .onChange(async (value) => {
                    await this.updateSetting('outputPath', value.trim() || 'YouTube/Processed Videos');
                }));
    }

    private createAdvancedSection(): void {
        const section = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-section` });

        const header = section.createDiv({ cls: `${CSS_PREFIX}-section-header` });
        header.createSpan({ cls: `${CSS_PREFIX}-section-icon`, text: '⚙️' });
        header.createEl('h3', { cls: `${CSS_PREFIX}-section-title`, text: 'Advanced Settings' });

        new Setting(section)
            .setName('Parallel Processing')
            .setDesc('Query multiple AI providers simultaneously for faster results.')
            .addToggle(toggle => toggle
                .setValue(this.settings.enableParallelProcessing ?? false)
                .onChange(async (value) => {
                    await this.updateSetting('enableParallelProcessing', value);
                }));

        new Setting(section)
            .setName('Multimodal Video Analysis')
            .setDesc('Enable audio + visual analysis for supported models (Gemini 2.5+).')
            .addToggle(toggle => toggle
                .setValue(this.settings.preferMultimodal ?? false)
                .onChange(async (value) => {
                    await this.updateSetting('preferMultimodal', value);
                }));

        new Setting(section)
            .setName('Use Environment Variables')
            .setDesc('Load API keys from environment variables (YTC_GEMINI_API_KEY, etc.).')
            .addToggle(toggle => toggle
                .setValue(this.settings.useEnvironmentVariables ?? false)
                .onChange(async (value) => {
                    await this.updateSetting('useEnvironmentVariables', value);
                }));
    }

    private createHelpSection(): void {
        const section = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-section` });

        const header = section.createDiv({ cls: `${CSS_PREFIX}-section-header` });
        header.createSpan({ cls: `${CSS_PREFIX}-section-icon`, text: '❓' });
        header.createEl('h3', { cls: `${CSS_PREFIX}-section-title`, text: 'Help & Resources' });

        const grid = section.createDiv({ cls: `${CSS_PREFIX}-help-grid` });

        // Card 1: Get API Keys
        const card1 = grid.createDiv({ cls: `${CSS_PREFIX}-help-card` });
        card1.createEl('h4', { text: '🔑 Get API Keys' });
        const p1 = card1.createEl('p');
        p1.innerHTML = '<a href="https://aistudio.google.com/app/apikey" target="_blank">Google Gemini</a> · <a href="https://console.groq.com/keys" target="_blank">Groq</a>';

        // Card 2: Quick Start
        const card2 = grid.createDiv({ cls: `${CSS_PREFIX}-help-card` });
        card2.createEl('h4', { text: '🚀 Quick Start' });
        card2.createEl('p', { text: '1. Add API key → 2. Click 🎬 icon → 3. Paste URL → 4. Process!' });

        // Card 3: Documentation
        const card3 = grid.createDiv({ cls: `${CSS_PREFIX}-help-card` });
        card3.createEl('h4', { text: '📖 Documentation' });
        const p3 = card3.createEl('p');
        p3.innerHTML = '<a href="https://github.com/emeeran/yt-clipper#readme" target="_blank">View full docs on GitHub</a>';

        // Card 4: Support
        const card4 = grid.createDiv({ cls: `${CSS_PREFIX}-help-card` });
        card4.createEl('h4', { text: '🐛 Report Issues' });
        const p4 = card4.createEl('p');
        p4.innerHTML = '<a href="https://github.com/emeeran/yt-clipper/issues" target="_blank">Submit bug reports or feature requests</a>';
    }

    private createSlider(container: HTMLElement, opts: {
        label: string;
        desc: string;
        min: number;
        max: number;
        step: number;
        value: number;
        key: string;
        format: (v: number) => string;
        scale: [string, string];
    }): void {
        const wrap = container.createDiv({ cls: `${CSS_PREFIX}-slider-wrap` });

        const top = wrap.createDiv({ cls: `${CSS_PREFIX}-slider-top` });
        top.createSpan({ cls: `${CSS_PREFIX}-slider-label`, text: opts.label });
        const valueEl = top.createSpan({ cls: `${CSS_PREFIX}-slider-value`, text: opts.format(opts.value) });

        const slider = wrap.createEl('input', { type: 'range', cls: `${CSS_PREFIX}-slider` });
        slider.min = String(opts.min);
        slider.max = String(opts.max);
        slider.step = String(opts.step);
        slider.value = String(opts.value);

        const scaleDiv = wrap.createDiv({ cls: `${CSS_PREFIX}-slider-scale` });
        scaleDiv.createSpan({ text: opts.scale[0] });
        scaleDiv.createSpan({ text: opts.scale[1] });

        wrap.createDiv({ cls: `${CSS_PREFIX}-slider-desc`, text: opts.desc });

        slider.addEventListener('input', () => {
            valueEl.textContent = opts.format(parseFloat(slider.value));
        });

        slider.addEventListener('change', async () => {
            const val = opts.step < 1 ? parseFloat(slider.value) : parseInt(slider.value);
            await this.updateSetting(opts.key as keyof YouTubePluginSettings, val);
        });
    }

    private validateConfiguration(): boolean {
        const hasKey = this.settings.geminiApiKey?.trim() || this.settings.groqApiKey?.trim();
        const hasPath = ValidationUtils.isValidPath(this.settings.outputPath);
        return Boolean(hasKey && hasPath);
    }

    private async updateSetting(
        key: keyof YouTubePluginSettings,
        value: string | boolean | number | 'fast' | 'balanced' | 'quality'
    ): Promise<void> {
        try {
            (this.settings as any)[key] = value;
            await this.validateAndSaveSettings();
        } catch (error) {
            ErrorHandler.handle(error as Error, `Settings update: ${key}`);
        }
    }

    private async validateAndSaveSettings(): Promise<void> {
        const validation = ValidationUtils.validateSettings(this.settings);
        this.validationErrors = validation.errors;

        if (validation.isValid) {
            await this.options.onSettingsChange(this.settings);
        }

        this.display();
    }

    getSettings(): YouTubePluginSettings {
        return { ...this.settings };
    }

    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = { ...newSettings };
        this.display();
    }
}
