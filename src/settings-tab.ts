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
    private drawerStates: Map<string, boolean> = new Map();
    private readonly DRAWER_STATES_KEY = 'ytc-settings-drawer-states';
    private searchInput?: HTMLInputElement;
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
        this.createSearchBar();
        this.createProviderStatusDashboard();
        this.createQuickActions();
        this.createAPISection();
        this.createAISection();
        this.createOutputSection();
        this.createAdvancedSection();
        this.createHelpSection();
        this.createKeyboardShortcutsInfo();
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

            .${CSS_PREFIX}-search-bar {
                margin-bottom: 20px;
                padding: 12px 16px;
                background: var(--background-secondary);
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .${CSS_PREFIX}-search-bar input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                font-size: 0.95rem;
                color: var(--text-normal);
            }

            .${CSS_PREFIX}-search-bar input::placeholder {
                color: var(--text-muted);
            }

            .${CSS_PREFIX}-search-icon {
                font-size: 1.1rem;
                color: var(--text-muted);
            }

            .${CSS_PREFIX}-status-dashboard {
                margin-bottom: 20px;
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 12px;
                border: 1px solid var(--background-modifier-border);
            }

            .${CSS_PREFIX}-status-title {
                font-size: 0.9rem;
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .${CSS_PREFIX}-status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 10px;
            }

            .${CSS_PREFIX}-status-card {
                padding: 12px;
                background: var(--background-primary);
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
                display: flex;
                flex-direction: column;
                gap: 6px;
                transition: all 0.2s ease;
            }

            .${CSS_PREFIX}-status-card:hover {
                border-color: var(--interactive-accent);
                transform: translateY(-2px);
            }

            .${CSS_PREFIX}-status-card.valid {
                border-color: #22c55e;
                background: linear-gradient(135deg, var(--background-primary) 0%, rgba(34, 197, 94, 0.1) 100%);
            }

            .${CSS_PREFIX}-status-card.invalid {
                border-color: #ef4444;
                background: linear-gradient(135deg, var(--background-primary) 0%, rgba(239, 68, 68, 0.1) 100%);
            }

            .${CSS_PREFIX}-status-card.testing {
                border-color: #f59e0b;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .${CSS_PREFIX}-status-name {
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--text-normal);
            }

            .${CSS_PREFIX}-status-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.8rem;
            }

            .${CSS_PREFIX}-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .${CSS_PREFIX}-status-dot.valid {
                background: #22c55e;
                box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
            }

            .${CSS_PREFIX}-status-dot.invalid {
                background: #ef4444;
            }

            .${CSS_PREFIX}-status-dot.testing {
                background: #f59e0b;
                animation: blink 1s infinite;
            }

            .${CSS_PREFIX}-status-dot.untested {
                background: var(--text-muted);
            }

            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }

            .${CSS_PREFIX}-status-text {
                color: var(--text-muted);
            }

            .${CSS_PREFIX}-quick-actions {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }

            .${CSS_PREFIX}-action-btn {
                flex: 1;
                min-width: 140px;
                padding: 12px 16px;
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                color: var(--text-normal);
            }

            .${CSS_PREFIX}-action-btn:hover {
                background: var(--background-modifier-hover);
                border-color: var(--interactive-accent);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .${CSS_PREFIX}-action-btn:active {
                transform: translateY(0);
            }

            .${CSS_PREFIX}-action-btn.primary {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }

            .${CSS_PREFIX}-action-btn.primary:hover {
                background: var(--interactive-accent-hover);
            }

            .${CSS_PREFIX}-action-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
            }

            .${CSS_PREFIX}-password-toggle {
                padding: 6px 10px;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                cursor: pointer;
                font-size: 1.1rem;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }

            .${CSS_PREFIX}-password-toggle:hover {
                background: var(--background-modifier-hover);
                border-color: var(--interactive-accent);
            }

            .${CSS_PREFIX}-shortcuts-info {
                margin-bottom: 20px;
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 12px;
                border: 1px solid var(--background-modifier-border);
            }

            .${CSS_PREFIX}-shortcuts-title {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .${CSS_PREFIX}-shortcuts-list {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 8px;
            }

            .${CSS_PREFIX}-shortcut-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: var(--background-primary);
                border-radius: 6px;
                font-size: 0.85rem;
            }

            .${CSS_PREFIX}-shortcut-key {
                background: var(--background-modifier-border);
                padding: 4px 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            .${CSS_PREFIX}-hidden {
                display: none !important;
            }

            .${CSS_PREFIX}-spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid var(--background-modifier-border);
                border-top-color: currentColor;
                border-radius: 50%;
                animation: spin 0.6s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .${CSS_PREFIX}-toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 16px 20px;
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 1000;
                animation: slideIn 0.3s ease;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            .${CSS_PREFIX}-toast.success {
                border-color: #22c55e;
            }

            .${CSS_PREFIX}-toast.error {
                border-color: #ef4444;
            }

            .${CSS_PREFIX}-toast.info {
                border-color: var(--interactive-accent);
            }
        `;
        document.head.appendChild(style);
    }

    private createDrawer(title: string, icon: string, isOpenByDefault = false): { drawer: HTMLElement; content: HTMLElement } {
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

    private createSearchBar(): void {
        const searchBar = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-search-bar` });
        searchBar.createSpan({ cls: `${CSS_PREFIX}-search-icon`, text: '🔍' });

        this.searchInput = searchBar.createEl('input', {
            attr: { placeholder: 'Search settings... (Ctrl+K)' }
        });

        this.searchInput.addEventListener('input', () => {
            this.filterSettings(this.searchInput!.value);
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
        const drawers = this.containerEl.querySelectorAll(`.${CSS_PREFIX}-drawer`);
        const lowerQuery = query.toLowerCase().trim();

        drawers.forEach(drawer => {
            if (!lowerQuery) {
                drawer.removeClass(`${CSS_PREFIX}-hidden`);
                return;
            }

            const title = drawer.querySelector(`.${CSS_PREFIX}-drawer-title`)?.textContent?.toLowerCase() || '';
            const content = drawer.querySelector(`.${CSS_PREFIX}-drawer-inner}`)?.textContent?.toLowerCase() || '';

            if (title.includes(lowerQuery) || content.includes(lowerQuery)) {
                drawer.removeClass(`${CSS_PREFIX}-hidden`);
                // Auto-expand matching drawer
                drawer.addClass('is-open');
            } else {
                drawer.addClass(`${CSS_PREFIX}-hidden`);
            }
        });
    }

    private createProviderStatusDashboard(): void {
        const dashboard = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-status-dashboard` });
        dashboard.createDiv({ cls: `${CSS_PREFIX}-status-title`, text: 'Provider Status' });

        const grid = dashboard.createDiv({ cls: `${CSS_PREFIX}-status-grid` });

        const providers = [
            { id: 'gemini', name: 'Google Gemini', key: 'geminiApiKey' },
            { id: 'groq', name: 'Groq', key: 'groqApiKey' },
            { id: 'huggingface', name: 'Hugging Face', key: 'huggingFaceApiKey' },
            { id: 'openrouter', name: 'OpenRouter', key: 'openRouterApiKey' },
            { id: 'ollama', name: 'Ollama', key: 'ollamaApiKey' }
        ];

        providers.forEach(provider => {
            const hasKey = Boolean((this.settings[provider.key as keyof YouTubePluginSettings] as string)?.trim());
            const status = this.providerStatuses.get(provider.id) || (hasKey ? 'untested' : 'untested');

            const card = grid.createDiv({ cls: `${CSS_PREFIX}-status-card ${status}` });
            card.createDiv({ cls: `${CSS_PREFIX}-status-name`, text: provider.name });

            const indicator = card.createDiv({ cls: `${CSS_PREFIX}-status-indicator` });
            indicator.createDiv({ cls: `${CSS_PREFIX}-status-dot ${status}` });

            let statusText = 'Not configured';
            if (hasKey) {
                statusText = status === 'valid' ? 'Working' : status === 'invalid' ? 'Invalid' : 'Untested';
            }
            indicator.createSpan({ cls: `${CSS_PREFIX}-status-text`, text: statusText });

            // Click to re-test
            card.addEventListener('click', () => {
                if (hasKey) {
                    this.testProvider(provider.id, provider.name, provider.key);
                }
            });
        });
    }

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
                        headers: { Authorization: `Bearer ${apiKey}` }
                    });
                    break;
                case 'huggingface':
                    await fetch('https://huggingface.co/api/whoami-v2', {
                        headers: { Authorization: `Bearer ${apiKey}` }
                    });
                    break;
                case 'openrouter':
                    await fetch('https://openrouter.ai/api/v1/models', {
                        headers: { Authorization: `Bearer ${apiKey}` }
                    });
                    break;
                case 'ollama':
                    const endpoint = this.settings.ollamaEndpoint || 'http://localhost:11434';
                    await fetch(`${endpoint}/api/tags`);
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

    private createQuickActions(): void {
        const actions = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-quick-actions` });

        // Test All Keys
        const testAllBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn primary`,
            text: '🧪 Test All Keys'
        });
        testAllBtn.addEventListener('click', () => this.testAllProviders());

        // Export Settings
        const exportBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn`,
            text: '📤 Export Settings'
        });
        exportBtn.addEventListener('click', () => this.exportSettings());

        // Import Settings
        const importBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn`,
            text: '📥 Import Settings'
        });
        importBtn.addEventListener('click', () => this.importSettings());

        // Reset to Defaults
        const resetBtn = actions.createEl('button', {
            cls: `${CSS_PREFIX}-action-btn`,
            text: '🔄 Reset Defaults'
        });
        resetBtn.addEventListener('click', () => this.resetToDefaults());
    }

    private async testAllProviders(): Promise<void> {
        const providers = [
            { id: 'gemini', name: 'Google Gemini', key: 'geminiApiKey' as keyof YouTubePluginSettings },
            { id: 'groq', name: 'Groq', key: 'groqApiKey' as keyof YouTubePluginSettings },
            { id: 'huggingface', name: 'Hugging Face', key: 'huggingFaceApiKey' as keyof YouTubePluginSettings },
            { id: 'openrouter', name: 'OpenRouter', key: 'openRouterApiKey' as keyof YouTubePluginSettings },
            { id: 'ollama', name: 'Ollama', key: 'ollamaApiKey' as keyof YouTubePluginSettings }
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

                // Confirm import
                if (confirm('Import settings? This will overwrite your current settings.')) {
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

    private resetToDefaults(): void {
        if (confirm('Reset all settings to defaults? This action cannot be undone.')) {
            // Keep API keys, reset everything else
            const apiKeys = {
                geminiApiKey: this.settings.geminiApiKey,
                groqApiKey: this.settings.groqApiKey,
                huggingFaceApiKey: this.settings.huggingFaceApiKey,
                openRouterApiKey: this.settings.openRouterApiKey,
                ollamaApiKey: this.settings.ollamaApiKey,
                ollamaEndpoint: this.settings.ollamaEndpoint
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
                defaultTemperature: 0.5
            };

            this.settings = defaults;
            this.options.onSettingsChange(defaults);
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

    private createKeyboardShortcutsInfo(): void {
        const shortcuts = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-shortcuts-info` });

        const title = shortcuts.createDiv({ cls: `${CSS_PREFIX}-shortcuts-title` });
        title.createSpan({ text: '⌨️' });
        title.createSpan({ text: 'Keyboard Shortcuts' });

        const list = shortcuts.createDiv({ cls: `${CSS_PREFIX}-shortcuts-list` });

        const shortcutsData = [
            { action: 'Focus search', key: 'Ctrl+K' },
            { action: 'Toggle settings', key: 'Ctrl+,' },
            { action: 'Save settings', key: 'Ctrl+S' },
            { action: 'Open command palette', key: 'Ctrl+P' }
        ];

        shortcutsData.forEach(({ action, key }) => {
            const item = list.createDiv({ cls: `${CSS_PREFIX}-shortcut-item` });
            item.createSpan({ text: action });
            item.createSpan({ cls: `${CSS_PREFIX}-shortcut-key`, text: key });
        });
    }

    private createHeader(): void {
        const { containerEl } = this;
        const header = containerEl.createDiv({ cls: `${CSS_PREFIX}-header` });

        const title = header.createEl('h2', { cls: `${CSS_PREFIX}-title` });
        title.createSpan({ text: '🎬' });
        title.createSpan({ text: 'YT Clipper' });

        const isReady = this.validateConfiguration();
        this.headerBadge = header.createDiv({
            cls: `${CSS_PREFIX}-badge ${isReady ? `${CSS_PREFIX}-badge-ready` : `${CSS_PREFIX}-badge-setup`}`
        });
        this.headerBadge.textContent = isReady ? '✓ Ready' : '⚠ Setup Required';
    }

    private updateHeaderBadge(isReady: boolean): void {
        if (this.headerBadge) {
            this.headerBadge.className = `${CSS_PREFIX}-badge ${isReady ? `${CSS_PREFIX}-badge-ready` : `${CSS_PREFIX}-badge-setup`}`;
            this.headerBadge.textContent = isReady ? '✓ Ready' : '⚠ Setup Required';
        }
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
            }
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
                text.inputEl.style.width = '300px';
                text
                    .setPlaceholder(opts.placeholder)
                    .setValue((this.settings[opts.settingKey] as string) || '')
                    .onChange(async (value) => {
                        await this.updateSetting(opts.settingKey, value.trim());
                    });
            });

        const controlEl = setting.controlEl;

        // Password visibility toggle
        const toggleBtn = controlEl.createEl('button', {
            cls: `${CSS_PREFIX}-password-toggle`,
            text: '👁️'
        });
        toggleBtn.title = 'Toggle visibility';

        let isVisible = false;
        toggleBtn.addEventListener('click', () => {
            isVisible = !isVisible;
            const textInput = controlEl.querySelector('input[type="password"], input[type="text"]') as HTMLInputElement;
            if (textInput) {
                textInput.type = isVisible ? 'text' : 'password';
                toggleBtn.textContent = isVisible ? '🙈' : '👁️';
                toggleBtn.title = isVisible ? 'Hide key' : 'Show key';
            }
        });

        // Validate button
        const validateBtn = controlEl.createEl('button', {
            cls: `${CSS_PREFIX}-validate-btn`,
            text: '✓ Test'
        });

        validateBtn.addEventListener('click', async () => {
            const key = (this.settings[opts.settingKey] as string)?.trim();
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
            console.debug('Could not load drawer states:', error);
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
            console.debug('Could not save drawer states:', error);
        }
    }
}
