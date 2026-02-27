/* eslint-disable max-lines */
import { SecureConfigService } from './secure-config';
import { ValidationUtils } from './validation';
import { YouTubePluginSettings } from './types';
import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { logger } from './services/logger';
import { ErrorHandler } from './services/error-handler';
import {
    SettingsDrawer,
    ProviderCard,
    createInfoIcon,
    hideTooltip,
    type ProviderStatus
} from './components/settings';

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
    private searchInput?: HTMLInputElement;
    private providerStatuses: Map<string, ProviderStatus> = new Map();
    private drawers: Map<string, SettingsDrawer> = new Map();
    private providerCards: Map<string, ProviderCard> = new Map();

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

        // Hide any existing tooltips
        hideTooltip();

        // Refresh settings from plugin to ensure we have the latest data
        this.settings = { ...this.options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);

        // Clear references
        this.drawers.clear();
        this.providerCards.clear();

        this.createHeader();
        this.createPresets();
        this.createSearchBar();
        this.createProviderStatusDashboard();
        this.createQuickActions();
        this.createAPISection();
        this.createAISection();
        this.createOutputSection();
        // Create advanced section asynchronously
        void this.createAdvancedSection();
    }

    private headerBadge?: HTMLDivElement;

    private createHeader(): void {
        const { containerEl } = this;
        const header = containerEl.createDiv({ cls: `${CSS_PREFIX}-header` });

        const title = header.createDiv({ cls: `${CSS_PREFIX}-title` });
        title.createSpan({ text: '\uD83C\uDFAC' }); // 🎬
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
            this.headerBadge.textContent = isReady ? '\u2713 Ready' : '\u26A0 Setup Required';
        }
    }

    /**
     * Create settings presets section
     */
    private createPresets(): void {
        const presetsContainer = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-presets` });

        const presets = [
            {
                id: 'fast',
                icon: '\u26A1', // ⚡
                label: 'Fast',
                desc: 'Quick results',
                settings: { performanceMode: 'fast', defaultMaxTokens: 2048, defaultTemperature: 0.3, enableParallelProcessing: true }
            },
            {
                id: 'balanced',
                icon: '\u2696\uFE0F', // ⚖️
                label: 'Balanced',
                desc: 'Good speed & quality',
                settings: { performanceMode: 'balanced', defaultMaxTokens: 4096, defaultTemperature: 0.5, enableParallelProcessing: true }
            },
            {
                id: 'quality',
                icon: '\u2728', // ✨
                label: 'Quality',
                desc: 'Best results',
                settings: { performanceMode: 'quality', defaultMaxTokens: 8192, defaultTemperature: 0.7, enableParallelProcessing: false }
            }
        ];

        const currentMode = this.settings.performanceMode ?? 'balanced';

        presets.forEach(preset => {
            const btn = presetsContainer.createEl('button', {
                cls: `${CSS_PREFIX}-preset-btn${currentMode === preset.id ? ' active' : ''}`,
                attr: {
                    type: 'button',
                    'aria-pressed': String(currentMode === preset.id)
                }
            });

            btn.createSpan({ cls: 'preset-icon', text: preset.icon });
            btn.createSpan({ cls: 'preset-label', text: preset.label });
            btn.createSpan({ cls: 'preset-desc', text: preset.desc });

            btn.addEventListener('click', async () => {
                // Apply preset settings
                Object.entries(preset.settings).forEach(([key, value]) => {
                    (this.settings as unknown as Record<string, unknown>)[key] = value;
                });

                await this.validateAndSaveSettings();
                this.display();
                this.showToast(`Applied ${preset.label} preset`, 'success');
            });
        });
    }

    private createSearchBar(): void {
        const searchBar = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-search-bar` });
        searchBar.createSpan({ cls: `${CSS_PREFIX}-search-icon`, text: '\uD83D\uDD0D' }); // 🔍

        this.searchInput = searchBar.createEl('input', {
            attr: {
                placeholder: 'Search settings... (Ctrl+K)',
                'aria-label': 'Search settings'
            },
        });

        this.searchInput.addEventListener('input', () => {
            this.filterSettings(this.searchInput?.value ?? '');
        });

        // Keyboard shortcut for search focus
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'k' && e.ctrlKey) {
                e.preventDefault();
                this.searchInput?.focus();
            }
        });
    }

    private filterSettings(query: string): void {
        const lowerQuery = query.toLowerCase().trim();

        this.drawers.forEach((drawer, _id) => {
            drawer.filterByQuery(lowerQuery);
        });
    }

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
        ];

        providers.forEach(provider => {
            const hasKey = Boolean((this.settings[provider.key as keyof YouTubePluginSettings] as string)?.trim());
            const status = this.providerStatuses.get(provider.id) ?? 'untested';

            const chip = grid.createDiv({
                cls: `${CSS_PREFIX}-status-chip ${hasKey ? status : 'untested'}`,
                attr: {
                    role: 'button',
                    tabindex: hasKey ? '0' : '-1',
                    'aria-label': `${provider.name}: ${hasKey ? status : 'not configured'}`
                }
            });
            chip.createDiv({ cls: `${CSS_PREFIX}-status-dot` });
            chip.createDiv({ cls: `${CSS_PREFIX}-status-name`, text: provider.name });

            if (!hasKey) {
                chip.style.opacity = '0.5';
                chip.style.cursor = 'default';
            } else {
                chip.title = 'Click to test connection';

                chip.addEventListener('click', () => {
                    void this.testProvider(provider.id, provider.name, provider.key as keyof YouTubePluginSettings);
                });

                chip.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void this.testProvider(provider.id, provider.name, provider.key as keyof YouTubePluginSettings);
                    }
                });
            }
        });
    }

    // eslint-disable-next-line complexity, max-lines-per-function
    private async testProvider(id: string, name: string, key: keyof YouTubePluginSettings): Promise<void> {
        this.providerStatuses.set(id, 'testing');
        this.display(); // Refresh to show testing state

        const apiKey = (this.settings[key] as string)?.trim();
        if (!apiKey) {
            this.providerStatuses.set(id, 'untested');
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
            attr: { type: 'button', 'aria-label': 'Test all provider connections' }
        });
        testAllBtn.innerHTML = '<span>\uD83E\uDDEA</span> Test Connections'; // 🧪
        testAllBtn.addEventListener('click', () => this.testAllProviders());

        // Export/Import dropdown
        const settingsBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn`,
            attr: { type: 'button', 'aria-label': 'Manage settings' }
        });
        settingsBtn.innerHTML = '<span>\u2699\uFE0F</span> Manage Settings'; // ⚙️
        settingsBtn.addEventListener('click', (e) => this.showSettingsPopup(e));

        // Reset to Defaults
        const resetBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn danger`,
            attr: { type: 'button', 'aria-label': 'Reset settings to defaults' }
        });
        resetBtn.innerHTML = '<span>\uD83D\uDD04</span> Reset'; // 🔄
        resetBtn.addEventListener('click', async () => this.resetToDefaults());
    }

    // eslint-disable-next-line max-lines-per-function
    private showSettingsPopup(e: MouseEvent): void {
        const settingsBtn = e.currentTarget as HTMLElement;

        const popup = document.createElement('div');
        popup.className = `${CSS_PREFIX}-popup`;
        popup.setAttribute('role', 'menu');

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            z-index: 999;
        `;

        const createItem = (text: string, icon: string, onClick: () => void): HTMLElement => {
            const btn = document.createElement('button');
            btn.className = `${CSS_PREFIX}-popup-item`;
            btn.setAttribute('role', 'menuitem');
            btn.innerHTML = `<span>${icon}</span> ${text}`;
            btn.onclick = () => {
                onClick();
                popup.remove();
                overlay.remove();
            };
            return btn;
        };

        popup.appendChild(createItem('Export Settings', '\uD83D\uDCE4', () => this.exportSettings())); // 📤
        popup.appendChild(createItem('Import Settings', '\uD83D\uDCE5', () => this.importSettings())); // 📥

        // Position popup
        const rect = settingsBtn.getBoundingClientRect();
        popup.style.top = `${rect.bottom + 5}px`;
        popup.style.left = `${rect.left}px`;
        popup.style.position = 'fixed';

        overlay.onclick = () => {
            popup.remove();
            overlay.remove();
        };

        document.body.appendChild(overlay);
        document.body.appendChild(popup);
    }

    private async testAllProviders(): Promise<void> {
        const providers = [
            { id: 'gemini', name: 'Google Gemini', key: 'geminiApiKey' as keyof YouTubePluginSettings },
            { id: 'groq', name: 'Groq', key: 'groqApiKey' as keyof YouTubePluginSettings },
            { id: 'huggingface', name: 'Hugging Face', key: 'huggingFaceApiKey' as keyof YouTubePluginSettings },
            { id: 'openrouter', name: 'OpenRouter', key: 'openRouterApiKey' as keyof YouTubePluginSettings },
            { id: 'ollama', name: 'Ollama', key: 'ollamaApiKey' as keyof YouTubePluginSettings },
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
        const icon = type === 'success' ? '\u2705' : type === 'error' ? '\u274C' : '\u2139\uFE0F'; // ✅ ❌ ℹ️
        toast.createSpan({ text: icon });
        toast.createSpan({ text: ` ${message}` });
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'ytc-settings-slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // eslint-disable-next-line max-lines-per-function
    private createAPISection(): void {
        const drawer = new SettingsDrawer({
            id: 'api-keys',
            title: 'API Keys',
            icon: '\uD83D\uDD11', // 🔑
            description: 'Configure your API keys for AI providers. Keys are stored securely and encrypted.',
            isOpen: false
        });

        this.containerEl.appendChild(drawer.render());
        this.drawers.set('api-keys', drawer);

        const content = drawer.getContentElement();

        this.createAPIKeySetting(content, {
            name: 'Google Gemini API Key',
            desc: 'Primary AI provider for video analysis.',
            placeholder: 'Enter your Gemini API key (AIzaSy...)',
            settingKey: 'geminiApiKey',
            infoTooltip: 'Get a free API key from Google AI Studio (aistudio.google.com)',
            validateFn: async (key: string) => {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            },
        });

        this.createAPIKeySetting(content, {
            name: 'Groq API Key',
            desc: 'Fast alternative AI provider.',
            placeholder: 'Enter your Groq API key (gsk_...)',
            settingKey: 'groqApiKey',
            infoTooltip: 'Get a free API key from Groq Console (console.groq.com)',
            validateFn: async (key: string) => {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { Authorization: `Bearer ${key}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            },
        });

        this.createAPIKeySetting(content, {
            name: 'Hugging Face API Key',
            desc: 'Alternative AI provider with free tier.',
            placeholder: 'hf_...',
            settingKey: 'huggingFaceApiKey',
            infoTooltip: 'Get a token from huggingface.co/settings/tokens',
            validateFn: async (key: string) => {
                const res = await fetch('https://huggingface.co/api/whoami-v2', {
                    headers: { Authorization: `Bearer ${key}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            },
        });

        this.createAPIKeySetting(content, {
            name: 'OpenRouter API Key',
            desc: 'Access multiple AI models through one API.',
            placeholder: 'sk-or-...',
            settingKey: 'openRouterApiKey',
            infoTooltip: 'Get a key from openrouter.ai/keys',
            validateFn: async (key: string) => {
                const res = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { Authorization: `Bearer ${key}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
            },
        });

        this.createAPIKeySetting(content, {
            name: 'Ollama API Key',
            desc: 'Required for Ollama Cloud. Not needed for local instances.',
            placeholder: 'Optional - required for cloud only',
            settingKey: 'ollamaApiKey',
            infoTooltip: 'Get a key from ollama.com/settings (cloud only)',
            optional: true,
            validateFn: async (key: string) => {
                const endpoint = this.settings.ollamaEndpoint || 'http://localhost:11434';
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
        new Setting(content)
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
        infoTooltip: string;
        optional?: boolean;
        validateFn: (key: string) => Promise<void>;
    }): void {
        const setting = new Setting(container)
            .setName(opts.name)
            .setDesc(opts.desc);

        // Add info icon with tooltip
        const infoIcon = createInfoIcon(opts.infoTooltip);
        setting.nameEl.appendChild(infoIcon);

        setting.addText(text => {
            text.inputEl.type = 'password';
            text.inputEl.autocomplete = 'off';
            text.inputEl.style.width = '300px';

            // Get the actual API key (de-obfuscated) or empty string - async
            this.secureConfig.getApiKey(opts.settingKey).then(async (actualKey) => {
                const displayValue = actualKey ? await this.secureConfig.getMaskedApiKey(opts.settingKey) : '';
                text.setValue(displayValue);
            });

            text
                .setPlaceholder(opts.placeholder)
                .onChange(async (value) => {
                    await this.updateSetting(opts.settingKey, value.trim());
                });
        });

        const controlEl = setting.controlEl;

        // Password visibility toggle
        const toggleBtn = controlEl.createEl('button', {
            cls: `${CSS_PREFIX}-password-toggle`,
            text: '\uD83D\uDC41\uFE0F', // 👁️
            attr: {
                type: 'button',
                title: 'Toggle visibility',
                'aria-label': 'Toggle password visibility'
            }
        });

        let isVisible = false;
        let originalValue = '';

        toggleBtn.addEventListener('click', async () => {
            isVisible = !isVisible;
            const textInput = controlEl.querySelector('input[type="password"], input[type="text"]') as HTMLInputElement;

            if (textInput) {
                if (isVisible) {
                    originalValue = textInput.value;
                    const actualKey = await this.secureConfig.getApiKey(opts.settingKey);
                    textInput.value = actualKey || '';
                    textInput.type = 'text';
                    toggleBtn.textContent = '\uD83D\uDE48'; // 🙈
                    toggleBtn.title = 'Hide key';
                } else {
                    const maskedKey = await this.secureConfig.getMaskedApiKey(opts.settingKey);
                    textInput.value = originalValue || maskedKey || '';
                    textInput.type = 'password';
                    toggleBtn.textContent = '\uD83D\uDC41\uFE0F'; // 👁️
                    toggleBtn.title = 'Show key';
                }
            }
        });

        // Validate button
        const validateBtn = controlEl.createEl('button', {
            cls: `${CSS_PREFIX}-validate-btn`,
            text: '\u2713 Test', // ✓ Test
            attr: {
                type: 'button',
                'aria-label': `Test ${opts.name}`
            }
        });

        validateBtn.addEventListener('click', async () => {
            const key = await this.secureConfig.getApiKey(opts.settingKey);
            if (!key && !opts.optional) {
                this.showToast(`No ${opts.name} configured`, 'info');
                return;
            }

            validateBtn.disabled = true;
            validateBtn.innerHTML = '<span class="ytc-settings-spinner"></span>';
            validateBtn.removeClass('is-success', 'is-error');

            try {
                await opts.validateFn(key);
                validateBtn.textContent = '\u2713 Valid'; // ✓ Valid
                validateBtn.addClass('is-success');
                this.showToast(`${opts.name} is valid!`, 'success');

                const providerId = opts.settingKey.replace('ApiKey', '').toLowerCase();
                this.providerStatuses.set(providerId, 'valid');
            } catch (err) {
                validateBtn.textContent = '\u2717 Invalid'; // ✗ Invalid
                validateBtn.addClass('is-error');
                this.showToast(`${opts.name} failed: ${(err as Error).message}`, 'error');

                const providerId = opts.settingKey.replace('ApiKey', '').toLowerCase();
                this.providerStatuses.set(providerId, 'invalid');
            }

            setTimeout(() => {
                validateBtn.textContent = '\u2713 Test'; // ✓ Test
                validateBtn.removeClass('is-success', 'is-error');
                validateBtn.disabled = false;
            }, 3000);
        });
    }

    private createAISection(): void {
        const drawer = new SettingsDrawer({
            id: 'ai-config',
            title: 'AI Configuration',
            icon: '\uD83E\uDD16', // 🤖
            description: 'Configure AI model behavior and output settings.',
            isOpen: false
        });

        this.containerEl.appendChild(drawer.render());
        this.drawers.set('ai-config', drawer);

        const content = drawer.getContentElement();

        // Max Tokens slider
        this.createSlider(content, {
            label: 'Maximum Output Tokens',
            desc: 'Controls the length of generated notes. Higher values produce more detailed output.',
            min: 512,
            max: 8192,
            step: 256,
            value: this.settings.defaultMaxTokens || 4096,
            key: 'defaultMaxTokens',
            format: (v) => v.toLocaleString(),
            scale: ['Short (512)', 'Long (8192)'],
        });

        // Temperature slider
        this.createSlider(content, {
            label: 'Temperature',
            desc: 'Controls AI creativity. Lower = more focused/factual, Higher = more creative.',
            min: 0,
            max: 1,
            step: 0.1,
            value: this.settings.defaultTemperature ?? 0.5,
            key: 'defaultTemperature',
            format: (v) => v.toFixed(1),
            scale: ['Precise (0)', 'Creative (1)'],
        });

        new Setting(content)
            .setName('Performance Mode')
            .setDesc('Choose processing speed vs output quality tradeoff.')
            .addDropdown(dd => dd
                .addOption('fast', '\u26A1 Fast \u2014 Quick results, basic analysis') // ⚡ —
                .addOption('balanced', '\u2696\uFE0F Balanced \u2014 Good speed & quality') // ⚖️ —
                .addOption('quality', '\u2728 Quality \u2014 Best results, slower') // ✨ —
                .setValue(this.settings.performanceMode || 'balanced')
                .onChange(async (value) => {
                    await this.updateSetting('performanceMode', value as 'fast' | 'balanced' | 'quality');
                }));
    }

    private createOutputSection(): void {
        const drawer = new SettingsDrawer({
            id: 'output',
            title: 'Output Settings',
            icon: '\uD83D\uDC1B', // 🐛
            description: 'Configure where processed video notes are saved.',
            isOpen: false
        });

        this.containerEl.appendChild(drawer.render());
        this.drawers.set('output', drawer);

        const content = drawer.getContentElement();

        new Setting(content)
            .setName('Output Folder')
            .setDesc('Folder path where processed video notes will be saved.')
            .addText(text => text
                .setPlaceholder('YouTube/Processed Videos')
                .setValue(this.settings.outputPath || 'YouTube/Processed Videos')
                .onChange(async (value) => {
                    await this.updateSetting('outputPath', value.trim() || 'YouTube/Processed Videos');
                }));
    }

    private async createAdvancedSection(): Promise<void> {
        const drawer = new SettingsDrawer({
            id: 'advanced',
            title: 'Advanced Settings',
            icon: '\u2699\uFE0F', // ⚙️
            description: 'Advanced configuration options for power users.',
            isOpen: false
        });

        this.containerEl.appendChild(drawer.render());
        this.drawers.set('advanced', drawer);

        const content = drawer.getContentElement();

        // Security Status Section
        const securityDesc = content.createDiv({ cls: `${CSS_PREFIX}-security-status` });
        const securityTitle = securityDesc.createEl('h3', { text: '\uD83D\uDD12 Security Status' }); // 🔒
        const securityContent = securityDesc.createDiv();

        // Run security validation
        const securityResult = await this.secureConfig.validateSecurityConfiguration();

        if (securityResult.warnings.length > 0 || securityResult.suggestions.length > 0) {
            if (securityResult.warnings.length > 0) {
                const warningEl = securityContent.createEl('div', {
                    cls: `${CSS_PREFIX}-security-warnings`
                });
                securityResult.warnings.forEach((warning: string) => {
                    const item = warningEl.createEl('div');
                    item.textContent = `\u26A0\uFE0F ${warning}`; // ⚠️
                    item.style.margin = '4px 0';
                });
            }

            if (securityResult.suggestions.length > 0) {
                const suggestionEl = securityContent.createEl('div', {
                    cls: `${CSS_PREFIX}-security-suggestions`
                });
                securityResult.suggestions.forEach((suggestion: string) => {
                    const item = suggestionEl.createEl('div');
                    item.textContent = suggestion;
                    item.style.margin = '4px 0';
                    item.style.color = 'var(--text-muted)';
                });
            }

            const recommendations = this.secureConfig.getRotationRecommendations();
            const needsRotation = recommendations.filter(r => r.shouldRotate);

            if (needsRotation.length > 0) {
                const rotationEl = securityContent.createEl('div', {
                    cls: `${CSS_PREFIX}-rotation-alert`
                });
                const rotationTitle = rotationEl.createEl('div', {
                    text: '\uD83D\uDD04 Key Rotation Recommended' // 🔄
                });
                rotationTitle.style.fontWeight = 'bold';
                rotationTitle.style.margin = '8px 0 4px 0';
                rotationEl.appendChild(rotationTitle);

                needsRotation.forEach(rec => {
                    const item = rotationEl.createEl('div');
                    item.style.marginLeft = '16px';
                    item.textContent = `\u2022 ${rec.keyType}: ${rec.reason}`; // •
                });
            }
        } else {
            const secureEl = securityContent.createEl('div', {
                cls: `${CSS_PREFIX}-security-secure`
            });
            secureEl.textContent = '\u2705 All API keys are properly secured'; // ✅
        }

        // Security actions
        const actionsDiv = securityContent.createDiv({
            cls: `${CSS_PREFIX}-security-actions`
        });
        actionsDiv.style.marginTop = '12px';

        const clearKeysBtn = actionsDiv.createEl('button', {
            text: '\uD83D\uDDD1\uFE0F Clear All API Keys', // 🗑️
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

        const exportBtn = actionsDiv.createEl('button', {
            text: '\uD83D\uDCE4 Export Settings (Masked)' // 📤
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

        new Setting(content)
            .setName('Parallel Processing')
            .setDesc('Query multiple AI providers simultaneously for faster results.')
            .addToggle(toggle => toggle
                .setValue(this.settings.enableParallelProcessing ?? false)
                .onChange(async (value) => {
                    await this.updateSetting('enableParallelProcessing', value);
                }));

        new Setting(content)
            .setName('Multimodal Video Analysis')
            .setDesc('Enable audio + visual analysis for supported models (Gemini 2.5+).')
            .addToggle(toggle => toggle
                .setValue(this.settings.preferMultimodal ?? false)
                .onChange(async (value) => {
                    await this.updateSetting('preferMultimodal', value);
                }));

        new Setting(content)
            .setName('Use Environment Variables')
            .setDesc('Load API keys from environment variables (YTC_GEMINI_API_KEY, etc.).')
            .addToggle(toggle => toggle
                .setValue(this.settings.useEnvironmentVariables ?? false)
                .onChange(async (value) => {
                    await this.updateSetting('useEnvironmentVariables', value);
                }));

        // Environment variable template button
        new Setting(content)
            .setName('Get Environment Variable Template')
            .setDesc('Get a template file showing how to set up environment variables for secure key management.')
            .addButton(button => {
                button.setButtonText('\uD83D\uDCCB Copy Template'); // 📋
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
        key: string;
        format: (v: number) => string;
        scale: [string, string];
    }): void {
        const wrap = container.createDiv({ cls: `${CSS_PREFIX}-slider-wrap` });

        const top = wrap.createDiv({ cls: `${CSS_PREFIX}-slider-top` });
        top.createSpan({ cls: `${CSS_PREFIX}-slider-label`, text: opts.label });
        const valueEl = top.createSpan({ cls: `${CSS_PREFIX}-slider-value`, text: opts.format(opts.value) });

        const slider = wrap.createEl('input', {
            type: 'range',
            cls: `${CSS_PREFIX}-slider`,
            attr: {
                'aria-label': opts.label,
                'aria-valuemin': String(opts.min),
                'aria-valuemax': String(opts.max),
                'aria-valuenow': String(opts.value)
            }
        });
        slider.min = String(opts.min);
        slider.max = String(opts.max);
        slider.step = String(opts.step);
        slider.value = String(opts.value);

        const scaleDiv = wrap.createDiv({ cls: `${CSS_PREFIX}-slider-scale` });
        scaleDiv.createSpan({ text: opts.scale[0] });
        scaleDiv.createSpan({ text: opts.scale[1] });

        wrap.createDiv({ cls: `${CSS_PREFIX}-slider-desc`, text: opts.desc });

        slider.addEventListener('input', () => {
            const val = parseFloat(slider.value);
            valueEl.textContent = opts.format(val);
            slider.setAttribute('aria-valuenow', String(val));
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
            // Use secure storage for API keys
            if (this.isApiKeyField(key) && typeof value === 'string') {
                if (value && value !== '') {
                    try {
                        const obfuscated = this.secureConfig.setApiKey(key as 'geminiApiKey' | 'groqApiKey' | 'ollamaApiKey' | 'huggingFaceApiKey' | 'openRouterApiKey', value);
                        (this.settings as unknown as Record<string, unknown>)[key] = obfuscated;
                    } catch (error) {
                        ErrorHandler.handle(error as Error, `API Key Validation: ${key}`, true);
                        return;
                    }
                } else {
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
}
