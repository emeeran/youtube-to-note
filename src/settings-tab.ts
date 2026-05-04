/* eslint-disable max-lines */
import { SecureConfigService } from './secure-config';
import { ValidationUtils } from './validation';
import { YouTubePluginSettings } from './types';
import { App, Menu, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { logger } from './services/logger';
import { ErrorHandler } from './services/error-handler';

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
    private drawerStates: Map<string, boolean> = new Map();
    private readonly DRAWER_STATES_KEY = 'ytc-settings-drawer-states';
    private providerStatuses: Map<string, 'valid' | 'invalid' | 'testing' | 'untested'> = new Map();

    constructor(
        app: App,
        private options: SettingsTabOptions
    ) {
        super(app, options.plugin);
        this.settings = { ...options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);
        this.loadDrawerStates();
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass(`${CSS_PREFIX}-container`);

        // Refresh settings from plugin to ensure we have the latest data
        this.settings = { ...this.options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);

        this.injectStyles();
        this.createHeader();
        this.createProviderStatusDashboard();
        this.createQuickActions();
        this.createAPISection();
        this.createAISection();
        this.createOutputSection();
        this.createAdvancedSection();
    }

    private injectStyles(): void {
        return;
    }

    private createDrawer(
        title: string,
        icon: string,
        isOpenByDefault = false
    ): { drawer: HTMLElement; content: HTMLElement } {
        const drawerKey = title; // Use title as unique identifier
        const savedState = this.drawerStates.get(drawerKey) ?? isOpenByDefault;

        const drawer = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-drawer${savedState ? ' is-open' : ''}` });

        const header = drawer.createDiv({ cls: `${CSS_PREFIX}-drawer-header` });
        header.createSpan({ cls: `${CSS_PREFIX}-drawer-icon`, text: icon });
        header.createEl('h3', { cls: `${CSS_PREFIX}-drawer-title`, text: title });
        header.createSpan({ cls: `${CSS_PREFIX}-drawer-arrow`, text: '▼' });

        const contentWrapper = drawer.createDiv({ cls: `${CSS_PREFIX}-drawer-content` });
        const content = contentWrapper.createDiv({ cls: `${CSS_PREFIX}-drawer-inner` });

        header.addEventListener('click', () => {
            const isOpen = drawer.classList.toggle('is-open');
            this.drawerStates.set(drawerKey, isOpen);
            this.saveDrawerStates();
        });

        return { drawer, content };
    }

    private headerBadge?: HTMLDivElement;

    private createProviderStatusDashboard(): void {
        const dashboard = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-status-dashboard` });
        dashboard.createDiv({ cls: `${CSS_PREFIX}-status-title`, text: 'Providers' });

        const grid = dashboard.createDiv({ cls: `${CSS_PREFIX}-status-grid` });

        const providers = [
            { id: 'gemini', name: 'Gemini', key: 'geminiApiKey' },
            { id: 'groq', name: 'Groq', key: 'groqApiKey' },
            { id: 'huggingface', name: 'HuggingFace', key: 'huggingFaceApiKey' },
            { id: 'openrouter', name: 'OpenRouter', key: 'openRouterApiKey' },
            { id: 'ollama', name: 'Ollama', key: 'ollamaApiKey' },
            { id: 'ollama-cloud', name: 'Ollama Cloud', key: 'ollamaApiKey' },
        ];

        providers.forEach(provider => {
            const hasKey = Boolean((this.settings[provider.key as keyof YouTubePluginSettings] as string)?.trim());
            const status = this.providerStatuses.get(provider.id) ?? (hasKey ? 'untested' : 'untested');

            const chip = grid.createDiv({ cls: `${CSS_PREFIX}-status-chip ${status}` });
            chip.createDiv({ cls: `${CSS_PREFIX}-status-dot ${status}` });
            chip.createDiv({ cls: `${CSS_PREFIX}-status-name`, text: provider.name });

            // Click to re-test
            chip.addEventListener('click', () => {
                if (hasKey) {
                    void this.testProvider(provider.id, provider.name, provider.key as keyof YouTubePluginSettings);
                }
            });

            if (!hasKey) {
                chip.style.opacity = '0.5';
                chip.style.cursor = 'default';
            } else {
                chip.title = 'Click to test connection';
            }
        });
    }

    // eslint-disable-next-line complexity, max-lines-per-function
    private async testProvider(id: string, name: string, key: keyof YouTubePluginSettings): Promise<void> {
        this.providerStatuses.set(id, 'testing');
        this.display(); // Refresh to show testing state

        const apiKey = (this.settings[key] as string)?.trim();
        if (!apiKey) {
            this.providerStatuses.set(id, 'invalid');
            this.display();
            return;
        }

        try {
            // Validate based on provider
            switch (id) {
                case 'gemini':
                    await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    break;
                case 'groq':
                    await fetch('https://api.groq.com/openai/v1/models', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    break;
                case 'huggingface':
                    await fetch('https://huggingface.co/api/whoami-v2', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    break;
                case 'openrouter':
                    await fetch('https://openrouter.ai/api/v1/models', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    break;
                case 'ollama': {
                    const endpoint = this.settings.ollamaEndpoint ?? 'http://localhost:11434';
                    await fetch(`${endpoint}/api/tags`);
                    break;
                }
                case 'ollama-cloud':
                    if (!this.settings.ollamaApiKey) {
                        throw new Error('Ollama Cloud requires API key');
                    }
                    await fetch('https://ollama.com/api/tags', {
                        headers: { Authorization: `Bearer ${this.settings.ollamaApiKey}` },
                    });
                    break;
            }

            this.providerStatuses.set(id, 'valid');
            this.showToast(`${name} API key is valid!`, 'success');
        } catch (error) {
            this.providerStatuses.set(id, 'invalid');
            this.showToast(`${name} API key validation failed`, 'error');
        }

        this.display();
    }

    // eslint-disable-next-line max-lines-per-function
    private createQuickActions(): void {
        const actions = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-quick-actions` });

        // Test All Keys
        const testAllBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn primary`,
        });
        testAllBtn.innerHTML = '<span>🧪</span> Test Connections';
        testAllBtn.addEventListener('click', () => this.testAllProviders());

        // Export/Import dropdown combo
        const settingsBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn`,
        });
        settingsBtn.innerHTML = '<span>⚙️</span> Manage Settings';
        settingsBtn.addEventListener('click', (e: MouseEvent) => {
            const menu = new Menu();
            menu.addItem(item => item.setTitle('Export Settings').setIcon('export').onClick(() => this.exportSettings()));
            menu.addItem(item => item.setTitle('Import Settings').setIcon('import').onClick(() => this.importSettings()));
            menu.showAtMouseEvent(e);
        });

        // Reset to Defaults
        const resetBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn danger`,
        });
        resetBtn.innerHTML = '<span>🔄</span> Reset';
        resetBtn.addEventListener('click', async () => this.resetToDefaults());
    }

    private async testAllProviders(): Promise<void> {
        const providers = [
            { id: 'gemini', name: 'Google Gemini', key: 'geminiApiKey' as keyof YouTubePluginSettings },
            { id: 'groq', name: 'Groq', key: 'groqApiKey' as keyof YouTubePluginSettings },
            { id: 'huggingface', name: 'Hugging Face', key: 'huggingFaceApiKey' as keyof YouTubePluginSettings },
            { id: 'openrouter', name: 'OpenRouter', key: 'openRouterApiKey' as keyof YouTubePluginSettings },
            { id: 'ollama', name: 'Ollama', key: 'ollamaApiKey' as keyof YouTubePluginSettings },
            { id: 'ollama-cloud', name: 'Ollama Cloud', key: 'ollamaApiKey' as keyof YouTubePluginSettings },
        ];

        for (const provider of providers) {
            if ((this.settings[provider.key] as string)?.trim()) {
                await this.testProvider(provider.id, provider.name, provider.key);
                // Small delay between tests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    private exportSettings(): void {
        const settingsJson = JSON.stringify(this.settings, null, 2);
        const blob = new Blob([settingsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yt-clipper-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Settings exported successfully!', 'success');
    }

    private importSettings(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const imported = JSON.parse(text);

                // Validate imported settings
                const validation = ValidationUtils.validateSettings(imported);
                if (!validation.isValid) {
                    this.showToast(`Invalid settings file: ${validation.errors.join(', ')}`, 'error');
                    return;
                }

                // Confirm import using ConfirmationModal
                const { ConfirmationModal } = await import('./components/common/confirmation-modal');
                const modal = new ConfirmationModal(this.app, {
                    title: 'Import Settings',
                    message: 'This will overwrite your current settings.',
                });
                const confirmed = await modal.openAndWait();

                if (confirmed) {
                    await this.options.onSettingsChange(imported);
                    this.settings = { ...imported };
                    this.display();
                    this.showToast('Settings imported successfully!', 'success');
                }
            } catch (error) {
                this.showToast('Failed to import settings. Check file format.', 'error');
            }
        });
        input.click();
    }

    private async resetToDefaults(): Promise<void> {
        // Confirm reset using ConfirmationModal
        const { ConfirmationModal } = await import('./components/common/confirmation-modal');
        const modal = new ConfirmationModal(this.app, {
            title: 'Reset to Defaults',
            message: 'This action cannot be undone.',
            confirmText: 'Reset',
            isDangerous: true,
        });
        const confirmed = await modal.openAndWait();

        if (confirmed) {
            // Keep API keys, reset everything else
            const apiKeys = {
                geminiApiKey: this.settings.geminiApiKey,
                groqApiKey: this.settings.groqApiKey,
                huggingFaceApiKey: this.settings.huggingFaceApiKey,
                openRouterApiKey: this.settings.openRouterApiKey,
                ollamaApiKey: this.settings.ollamaApiKey,
                ollamaEndpoint: this.settings.ollamaEndpoint,
            };

            // Define defaults inline
            const defaults: YouTubePluginSettings = {
                ...apiKeys,
                outputPath: 'YouTube/Processed Videos',
                useEnvironmentVariables: false,
                environmentPrefix: 'YTC',
                performanceMode: 'balanced',
                enableParallelProcessing: true,
                enableAutoFallback: true,
                preferMultimodal: true,
                defaultMaxTokens: 4096,
                defaultTemperature: 0.5,
            };

            this.settings = defaults;
            void this.options.onSettingsChange(defaults);
            this.display();
            this.showToast('Settings reset to defaults', 'info');
        }
    }

    private showToast(message: string, type: 'success' | 'error' | 'info'): void {
        const toast = document.createElement('div');
        toast.className = `${CSS_PREFIX}-toast ${type}`;
        toast.createSpan({ text: type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️' });
        toast.createSpan({ text: message });
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    private createHeader(): void {
        const { containerEl } = this;
        const header = containerEl.createDiv({ cls: `${CSS_PREFIX}-header` });

        const title = header.createDiv({ cls: `${CSS_PREFIX}-title` });
        title.createSpan({ text: '🎬' });
        title.createSpan({ text: 'YT Clipper' });

        const isReady = this.validateConfiguration();
        this.headerBadge = header.createDiv({
            cls: `${CSS_PREFIX}-badge ${isReady ? `${CSS_PREFIX}-badge-ready` : `${CSS_PREFIX}-badge-setup`}`,
        });
        this.headerBadge.textContent = isReady ? 'READY' : 'SETUP REQUIRED';
    }

    private updateHeaderBadge(isReady: boolean): void {
        if (this.headerBadge) {
            const badgeClass = isReady ?
                `${CSS_PREFIX}-badge-ready` :
                `${CSS_PREFIX}-badge-setup`;
            this.headerBadge.className = `${CSS_PREFIX}-badge ${badgeClass}`;
            this.headerBadge.textContent = isReady ? '✓ Ready' : '⚠ Setup Required';
        }
    }

    // eslint-disable-next-line max-lines-per-function
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
            },
        });

        this.createAPIKeySetting(section, {
            name: 'Groq API Key',
            desc: 'Fast alternative AI provider. Get free key from Groq Console.',
            placeholder: 'Enter your Groq API key (gsk_...)',
            settingKey: 'groqApiKey',
            validateFn: async (key: string) => {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { Authorization: `Bearer ${key}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            },
        });

        this.createAPIKeySetting(section, {
            name: 'Hugging Face API Key',
            desc: 'Get from huggingface.co/settings/tokens (free tier available)',
            placeholder: 'hf_...',
            settingKey: 'huggingFaceApiKey',
            validateFn: async (key: string) => {
                const res = await fetch('https://huggingface.co/api/whoami-v2', {
                    headers: { Authorization: `Bearer ${key}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            },
        });

        this.createAPIKeySetting(section, {
            name: 'OpenRouter API Key',
            desc: 'Get from openrouter.ai/keys (free models available)',
            placeholder: 'sk-or-...',
            settingKey: 'openRouterApiKey',
            validateFn: async (key: string) => {
                const res = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { Authorization: `Bearer ${key}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            },
        });

        this.createAPIKeySetting(section, {
            name: 'Ollama API Key',
            desc: 'Required for Ollama Cloud (https://ollama.com). Get API key from ollama.com/settings. Not required for local instances.',
            placeholder: 'Optional - required for cloud only',
            settingKey: 'ollamaApiKey',
            validateFn: async (key: string) => {
                const endpoint = this.settings.ollamaEndpoint || 'http://localhost:11434';
                // Determine if this is cloud or local
                const isCloud = endpoint.includes('ollama.com') || endpoint.includes('cloud');
                const apiBaseUrl = isCloud ? 'https://ollama.com/api' : `${endpoint}/api`;

                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (isCloud && key) {
                    headers['Authorization'] = `Bearer ${key}`;
                }

                const res = await fetch(`${apiBaseUrl}/tags`, { headers });
                if (!res.ok) {
                    const errorText = await res.text().catch(() => 'Unknown error');
                    throw new Error(`HTTP ${res.status}: ${errorText}`);
                }
            },
        });

        // Ollama Endpoint setting
        new Setting(section)
            .setName('Ollama Endpoint')
            .setDesc('Ollama API endpoint. Local: http://localhost:11434 | Cloud: https://ollama.com')
            .addText(text => {
                text
                    .setPlaceholder('http://localhost:11434')
                    .setValue(this.settings.ollamaEndpoint || 'http://localhost:11434')
                    .onChange(async (value) => {
                        await this.updateSetting('ollamaEndpoint', value.trim());
                    });
            });
    }

    // eslint-disable-next-line max-lines-per-function
    private createAPIKeySetting(container: HTMLElement, opts: {
        name: string;
        desc: string;
        placeholder: string;
        settingKey: 'geminiApiKey' | 'groqApiKey' | 'ollamaApiKey' | 'huggingFaceApiKey' | 'openRouterApiKey';
        validateFn: (key: string) => Promise<void>;
    }): void {
        const setting = new Setting(container)
            .setName(opts.name)
            .setDesc(opts.desc)
            .addText(text => {
                text.inputEl.type = 'password';
                text.inputEl.autocomplete = 'off';
                text.inputEl.style.width = '300px';

                // Get the actual API key (de-obfuscated) or empty string
                const actualKey = this.secureConfig.getApiKey(opts.settingKey);
                // Show masked version or placeholder
                const displayValue = actualKey ? this.secureConfig.getMaskedApiKey(opts.settingKey) : '';

                text
                    .setPlaceholder(opts.placeholder)
                    .setValue(displayValue)
                    .onChange(async (value) => {
                        await this.updateSetting(opts.settingKey, value.trim());
                    });
            });

        const controlEl = setting.controlEl;

        // Password visibility toggle
        const toggleBtn = controlEl.createEl('button', {
            cls: `${CSS_PREFIX}-password-toggle`,
            text: '👁️',
        });
        toggleBtn.title = 'Toggle visibility';

        let isVisible = false;
        let originalValue = '';

        toggleBtn.addEventListener('click', () => {
            isVisible = !isVisible;
            const textInput = controlEl.querySelector('input[type="password"], input[type="text"]') as HTMLInputElement;

            if (textInput) {
                if (isVisible) {
                    // Show actual key temporarily
                    originalValue = textInput.value;
                    const actualKey = this.secureConfig.getApiKey(opts.settingKey);
                    textInput.value = actualKey || '';
                    textInput.type = 'text';
                    toggleBtn.textContent = '🙈';
                    toggleBtn.title = 'Hide key';
                } else {
                    // Revert to masked display
                    textInput.value = originalValue || (this.secureConfig.getMaskedApiKey(opts.settingKey) || '');
                    textInput.type = 'password';
                    toggleBtn.textContent = '👁️';
                    toggleBtn.title = 'Show key';
                }
            }
        });

        // Validate button
        const validateBtn = controlEl.createEl('button', {
            cls: `${CSS_PREFIX}-validate-btn`,
            text: '✓ Test',
        });

        validateBtn.addEventListener('click', async () => {
            // Get actual de-obfuscated API key for validation
            const key = this.secureConfig.getApiKey(opts.settingKey);
            if (!key && opts.settingKey !== 'ollamaApiKey') {
                this.showToast(`No ${opts.name} configured`, 'info');
                return;
            }

            validateBtn.disabled = true;
            validateBtn.textContent = '...';
            validateBtn.removeClass('is-success', 'is-error');

            // Add spinner
            const spinner = validateBtn.createEl('span', { cls: `${CSS_PREFIX}-spinner` });

            try {
                await opts.validateFn(key);
                spinner.remove();
                validateBtn.textContent = '✓ Valid';
                validateBtn.addClass('is-success');
                this.showToast(`${opts.name} is valid!`, 'success');

                // Update provider status
                const providerId = opts.settingKey.replace('ApiKey', '').toLowerCase();
                this.providerStatuses.set(providerId, 'valid');
            } catch (err) {
                spinner.remove();
                validateBtn.textContent = '✗ Invalid';
                validateBtn.addClass('is-error');
                this.showToast(`${opts.name} failed: ${(err as Error).message}`, 'error');

                // Update provider status
                const providerId = opts.settingKey.replace('ApiKey', '').toLowerCase();
                this.providerStatuses.set(providerId, 'invalid');
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
        const { content: section } = this.createDrawer('Output Settings', '📁', false);

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
        const { content: section } = this.createDrawer('Advanced Settings', '⚙️', false);

        // Security Status Section
        const securityDesc = section.createDiv({ cls: `${CSS_PREFIX}-security-status` });
        const securityTitle = securityDesc.createEl('h3', { text: '🔒 Security Status' });
        const securityContent = securityDesc.createDiv();

        // Run security validation
        const securityResult = this.secureConfig.validateSecurityConfiguration();

        if (securityResult.warnings.length > 0 || securityResult.suggestions.length > 0) {
            // Show warnings
            if (securityResult.warnings.length > 0) {
                const warningEl = securityContent.createEl('div', {
                    cls: `${CSS_PREFIX}-security-warnings`
                });
                securityResult.warnings.forEach(warning => {
                    const item = warningEl.createEl('div');
                    item.textContent = `⚠️ ${warning}`;
                    item.style.margin = '4px 0';
                });
            }

            // Show suggestions
            if (securityResult.suggestions.length > 0) {
                const suggestionEl = securityContent.createEl('div', {
                    cls: `${CSS_PREFIX}-security-suggestions`
                });
                securityResult.suggestions.forEach(suggestion => {
                    const item = suggestionEl.createEl('div');
                    item.textContent = suggestion;
                    item.style.margin = '4px 0';
                    item.style.color = 'var(--text-muted)';
                });
            }

            // Show rotation recommendations if keys are getting old
            const recommendations = this.secureConfig.getRotationRecommendations();
            const needsRotation = recommendations.filter(r => r.shouldRotate);

            if (needsRotation.length > 0) {
                const rotationEl = securityContent.createEl('div', {
                    cls: `${CSS_PREFIX}-rotation-alert`
                });
                const rotationTitle = rotationEl.createEl('div', {
                    text: '🔄 Key Rotation Recommended'
                });
                rotationTitle.style.fontWeight = 'bold';
                rotationTitle.style.margin = '8px 0 4px 0';
                rotationEl.appendChild(rotationTitle);

                needsRotation.forEach(rec => {
                    const item = rotationEl.createEl('div');
                    item.style.marginLeft = '16px';
                    item.textContent = `• ${rec.keyType}: ${rec.reason}`;
                });
            }
        } else {
            // All secure
            const secureEl = securityContent.createEl('div', {
                cls: `${CSS_PREFIX}-security-secure`
            });
            secureEl.textContent = '✅ All API keys are properly secured';
        }

        // Security actions
        const actionsDiv = securityContent.createDiv({
            cls: `${CSS_PREFIX}-security-actions`
        });
        actionsDiv.style.marginTop = '12px';

        // Clear all keys button
        const clearKeysBtn = actionsDiv.createEl('button', {
            text: '🗑️ Clear All API Keys',
            cls: 'mod-warning'
        });
        clearKeysBtn.style.marginRight = '8px';
        clearKeysBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all API keys? This cannot be undone.')) {
                this.secureConfig.clearAllApiKeys();
                this.showToast('All API keys have been cleared', 'info');
                this.display();
            }
        });

        // Export settings (with masked keys) button
        const exportBtn = actionsDiv.createEl('button', {
            text: '📤 Export Settings (Masked)'
        });
        exportBtn.addEventListener('click', () => {
            const safeSettings = this.secureConfig.exportSafeSettings();
            const json = JSON.stringify(safeSettings, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `youtube-clipper-settings-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            this.showToast('Settings exported (API keys are masked)', 'success');
        });

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

        // Environment variable template button
        new Setting(section)
            .setName('Get Environment Variable Template')
            .setDesc('Get a template file showing how to set up environment variables for secure key management.')
            .addButton(button => {
                button.setButtonText('📋 Copy Template');
                button.onClick(() => {
                    const template = this.secureConfig.getEnvironmentTemplate();

                    navigator.clipboard.writeText(template).then(() => {
                        this.showToast('Environment template copied to clipboard!', 'success');
                    }).catch(() => {
                        this.showToast('Failed to copy template', 'error');
                    });
                });
            });
    }

    private createSlider(container: HTMLElement, opts: {
        label: string;
        desc: string;
        min: number;
        max: number;
        step: number;
        value: number;
        key: keyof YouTubePluginSettings;
    }): void {
        new Setting(container)
            .setName(opts.label)
            .setDesc(opts.desc)
            .addSlider(slider => slider
                .setLimits(opts.min, opts.max, opts.step)
                .setValue(opts.value)
                .setDynamicTooltip()
                .onChange(async (v) => {
                    await this.updateSetting(opts.key, opts.step < 1 ? parseFloat(String(v)) : parseInt(String(v)));
                })
            );
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
            // Use secure storage for API keys
            if (this.isApiKeyField(key) && typeof value === 'string') {
                // Only set the key if it's not empty or user is intentionally clearing it
                if (value && value !== '') {
                    try {
                        const obfuscated = this.secureConfig.setApiKey(key as import('./secure-config').ApiKeyName, value);
                        (this.settings as unknown as Record<string, unknown>)[key] = obfuscated;
                    } catch (error) {
                        // Show validation error for invalid keys
                        ErrorHandler.handle(error as Error, `API Key Validation: ${key}`, true);
                        return; // Don't save invalid keys
                    }
                } else {
                    // Clear API key
                    (this.settings as unknown as Record<string, unknown>)[key] = '';
                }
            } else {
                (this.settings as unknown as Record<string, unknown>)[key] = value;
            }
            await this.validateAndSaveSettings();
        } catch (error) {
            ErrorHandler.handle(error as Error, `Settings update: ${key}`);
        }
    }

    /**
     * Check if a settings key is an API key field
     */
    private isApiKeyField(key: keyof YouTubePluginSettings): boolean {
        const apiKeyFields: (keyof YouTubePluginSettings)[] = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey'
        ];
        return apiKeyFields.includes(key);
    }

    private async validateAndSaveSettings(): Promise<void> {
        const validation = ValidationUtils.validateSettings(this.settings as unknown as Record<string, unknown>);
        const hadErrors = this.validationErrors.length > 0;
        const hasErrors = validation.errors.length > 0;

        this.validationErrors = validation.errors;

        if (validation.isValid) {
            await this.options.onSettingsChange(this.settings);
            this.updateHeaderBadge(true);
        } else {
            this.updateHeaderBadge(false);
        }

        // Only refresh display if validation state changed (errors appeared/disappeared)
        // This prevents drawers from closing on every setting change
        if (hadErrors !== hasErrors) {
            this.display();
        }
    }

    getSettings(): YouTubePluginSettings {
        return { ...this.settings };
    }

    updateSettings(newSettings: YouTubePluginSettings): void {
        this.settings = { ...newSettings };
        this.display();
    }

    private loadDrawerStates(): void {
        try {
            const stored = localStorage.getItem(this.DRAWER_STATES_KEY);
            if (stored) {
                const states = JSON.parse(stored);
                Object.entries(states).forEach(([key, value]) => {
                    this.drawerStates.set(key, Boolean(value));
                });
            }
        } catch (error) {
            // Silently fail and use defaults
            logger.debug('Could not load drawer states:', 'SettingsTab', { error });
        }
    }

    private saveDrawerStates(): void {
        try {
            const states: Record<string, boolean> = {};
            this.drawerStates.forEach((value, key) => {
                states[key] = value;
            });
            localStorage.setItem(this.DRAWER_STATES_KEY, JSON.stringify(states));
        } catch (error) {
            // Silently fail
            logger.debug('Could not save drawer states:', 'SettingsTab', { error });
        }
    }
}
