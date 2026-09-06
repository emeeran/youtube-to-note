/* eslint-disable max-lines */
import { SecureConfigService } from './secure-config';
import { ValidationUtils } from './validation';
import { OutputFormat, YouTubePluginSettings } from './types';
import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { ErrorHandler } from './services/error-handler';
import { FORMAT_META } from './templates/format-templates';
import { FORMAT_ORDER } from './components/features/youtube/youtube-modal-utils';

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
    private sectionStates: Map<string, boolean> = new Map();
    private readonly SECTION_STATES_KEY = 'ytc-settings-section-states';

    constructor(
        app: App,
        private options: SettingsTabOptions,
    ) {
        super(app, options.plugin);
        this.settings = { ...options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);
        this.loadSectionStates();
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass(`${CSS_PREFIX}-container`);

        this.settings = { ...this.options.plugin.settings };
        this.secureConfig = new SecureConfigService(this.settings);

        this.createHeader();

        // Two-column grid
        const grid = containerEl.createDiv({ cls: `${CSS_PREFIX}-grid` });

        // Left column: API Keys + prompt templates
        const left = grid.createDiv({ cls: `${CSS_PREFIX}-col` });
        this.createAPISection(left);
        this.createPromptTemplatesSection(left);

        // Right column: AI + Output + Advanced stacked
        const right = grid.createDiv({ cls: `${CSS_PREFIX}-col` });
        this.createAISection(right);
        this.createOutputSection(right);
        this.createAdvancedSection(right);
    }

    // ── Collapsible section ──────────────────────────────────────────────
    private createSection(parent: HTMLElement, title: string, icon: string): HTMLElement {
        const isOpen = this.sectionStates.get(title) ?? false;
        const section = parent.createDiv({ cls: `${CSS_PREFIX}-section${isOpen ? ' is-open' : ''}` });

        const header = section.createDiv({ cls: `${CSS_PREFIX}-section-header` });
        header.createSpan({ cls: `${CSS_PREFIX}-section-icon`, text: icon });
        header.createSpan({ cls: `${CSS_PREFIX}-section-title`, text: title });
        const arrow = header.createSpan({ cls: `${CSS_PREFIX}-section-arrow`, text: '▸' });

        const content = section.createDiv({ cls: `${CSS_PREFIX}-section-content` });

        header.addEventListener('click', () => {
            const open = section.classList.toggle('is-open');
            arrow.textContent = open ? '▾' : '▸';
            this.sectionStates.set(title, open);
            this.saveSectionStates();
        });

        return content;
    }

    // ── Header ───────────────────────────────────────────────────────────
    private headerBadge?: HTMLDivElement;

    private createHeader(): void {
        const header = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-header` });

        const left = header.createDiv({ cls: `${CSS_PREFIX}-header-left` });
        left.createSpan({ text: '🎬' });
        left.createSpan({ text: 'YT Clipper' });

        const isReady = this.validateConfiguration();
        this.headerBadge = header.createDiv({
            cls: `${CSS_PREFIX}-badge ${isReady ? 'ready' : 'setup'}`,
        });
        this.headerBadge.textContent = isReady ? 'READY' : 'SETUP';

        const actions = header.createDiv({ cls: `${CSS_PREFIX}-header-actions` });

        const manageBtn = actions.createEl('button', { cls: `${CSS_PREFIX}-header-btn` });
        manageBtn.textContent = '⚙️';
        manageBtn.title = 'Manage';
        manageBtn.addEventListener('click', (_e: MouseEvent) => {
            const dropdown = this.containerEl.createDiv({ cls: `${CSS_PREFIX}-mini-menu` });
            const exportOpt = dropdown.createDiv({ cls: `${CSS_PREFIX}-mini-menu-item`, text: '📤 Export' });
            exportOpt.addEventListener('click', () => {
                dropdown.remove();
                this.exportSettings();
            });
            const importOpt = dropdown.createDiv({ cls: `${CSS_PREFIX}-mini-menu-item`, text: '📥 Import' });
            importOpt.addEventListener('click', () => {
                dropdown.remove();
                this.importSettings();
            });
            const rect = manageBtn.getBoundingClientRect();
            dropdown.style.position = 'fixed';
            dropdown.style.top = `${rect.bottom + 4}px`;
            dropdown.style.right = `${window.innerWidth - rect.right}px`;
            setTimeout(() => {
                document.addEventListener('click', function dismiss(ev) {
                    if (!dropdown.contains(ev.target as Node)) {
                        dropdown.remove();
                        document.removeEventListener('click', dismiss);
                    }
                });
            }, 0);
        });

        const resetBtn = actions.createEl('button', { cls: `${CSS_PREFIX}-header-btn` });
        resetBtn.textContent = '🔄';
        resetBtn.title = 'Reset';
        resetBtn.addEventListener('click', async () => this.resetToDefaults());
    }

    private updateHeaderBadge(isReady: boolean): void {
        if (this.headerBadge) {
            this.headerBadge.className = `${CSS_PREFIX}-badge ${isReady ? 'ready' : 'setup'}`;
            this.headerBadge.textContent = isReady ? 'READY' : 'SETUP';
        }
    }

    // ── API Keys ─────────────────────────────────────────────────────────
    private createAPISection(parent: HTMLElement): void {
        const content = this.createSection(parent, 'API Keys', '🔑');

        const providers = [
            {
                name: 'Gemini',
                icon: '✦',
                placeholder: 'AIzaSy...',
                color: '#4285f4',
                key: 'geminiApiKey' as const,
                validate: async (key: string) => {
                    // Send the key as a header (matches the provider path) so it
                    // cannot leak into URL-based logs.
                    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                        headers: { 'x-goog-api-key': key },
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                },
            },
            {
                name: 'Groq',
                icon: '⚡',
                placeholder: 'gsk_...',
                color: '#f55036',
                key: 'groqApiKey' as const,
                validate: async (key: string) => {
                    const res = await fetch('https://api.groq.com/openai/v1/models', {
                        headers: { Authorization: `Bearer ${key}` },
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                },
            },
            {
                name: 'HuggingFace',
                icon: '🤗',
                placeholder: 'hf_...',
                color: '#ffcc00',
                key: 'huggingFaceApiKey' as const,
                validate: async (key: string) => {
                    const res = await fetch('https://huggingface.co/api/whoami-v2', {
                        headers: { Authorization: `Bearer ${key}` },
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                },
            },
            {
                name: 'OpenRouter',
                icon: '🔀',
                placeholder: 'sk-or-...',
                color: '#6366f1',
                key: 'openRouterApiKey' as const,
                validate: async (key: string) => {
                    const res = await fetch('https://openrouter.ai/api/v1/models', {
                        headers: { Authorization: `Bearer ${key}` },
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                },
            },
            {
                name: 'Ollama',
                icon: '🦙',
                placeholder: 'cloud only',
                color: '#6b7280',
                key: 'ollamaApiKey' as const,
                validate: async (key: string) => {
                    const endpoint = this.settings.ollamaEndpoint || 'http://localhost:11434';
                    const isCloud = endpoint.includes('ollama.com') || endpoint.includes('cloud');
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (isCloud && key) headers['Authorization'] = `Bearer ${key}`;
                    const res = await fetch(`${isCloud ? 'https://ollama.com/api' : `${endpoint}/api`}/tags`, {
                        headers,
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                },
            },
        ];

        providers.forEach(p => this.createAPIKeyCard(content, p));

        // Ollama endpoint
        const endpointCard = content.createDiv({ cls: `${CSS_PREFIX}-api-card` });
        const epLeft = endpointCard.createDiv({ cls: `${CSS_PREFIX}-api-card-left` });
        epLeft.createSpan({ cls: `${CSS_PREFIX}-api-icon`, text: '🔗' });
        epLeft.createSpan({ cls: `${CSS_PREFIX}-api-name`, text: 'Endpoint' });
        const epInput = endpointCard.createEl('input', { cls: `${CSS_PREFIX}-api-input` });
        epInput.type = 'text';
        epInput.placeholder = 'http://localhost:11434';
        epInput.value = this.settings.ollamaEndpoint || 'http://localhost:11434';
        epInput.addEventListener('change', async () => {
            await this.updateSetting('ollamaEndpoint', epInput.value.trim());
        });
    }

    private createAPIKeyCard(
        container: HTMLElement,
        opts: {
            name: string;
            icon: string;
            placeholder: string;
            color: string;
            key: 'geminiApiKey' | 'groqApiKey' | 'ollamaApiKey' | 'huggingFaceApiKey' | 'openRouterApiKey';
            validate: (key: string) => Promise<void>;
        },
    ): void {
        const hasKey = Boolean(this.secureConfig.getApiKey(opts.key)?.trim());
        const card = container.createDiv({ cls: `${CSS_PREFIX}-api-card` });

        // Left: icon + name + status dot
        const left = card.createDiv({ cls: `${CSS_PREFIX}-api-card-left` });
        const iconEl = left.createSpan({ cls: `${CSS_PREFIX}-api-icon`, text: opts.icon });
        iconEl.style.color = opts.color;
        left.createSpan({ cls: `${CSS_PREFIX}-api-name`, text: opts.name });
        const dot = left.createSpan({ cls: `${CSS_PREFIX}-api-dot ${hasKey ? 'has-key' : 'no-key'}` });
        dot.title = hasKey ? 'Key configured' : 'No key';

        // Input
        const input = card.createEl('input', { cls: `${CSS_PREFIX}-api-input` });
        input.type = 'password';
        input.autocomplete = 'off';
        input.placeholder = opts.placeholder;
        const actualKey = this.secureConfig.getApiKey(opts.key);
        input.value = actualKey ? this.secureConfig.getMaskedApiKey(opts.key) : '';
        input.addEventListener('change', async () => {
            await this.updateSetting(opts.key, input.value.trim());
            // Update dot
            const nowHasKey = Boolean(input.value.trim());
            dot.className = `${CSS_PREFIX}-api-dot ${nowHasKey ? 'has-key' : 'no-key'}`;
        });

        // Actions
        const actions = card.createDiv({ cls: `${CSS_PREFIX}-api-actions` });

        // Eye toggle
        const eyeBtn = actions.createEl('button', { cls: `${CSS_PREFIX}-api-action`, text: '👁' });
        let visible = false;
        eyeBtn.addEventListener('click', () => {
            visible = !visible;
            input.value = visible
                ? this.secureConfig.getApiKey(opts.key) || ''
                : actualKey
                  ? this.secureConfig.getMaskedApiKey(opts.key)
                  : '';
            input.type = visible ? 'text' : 'password';
            eyeBtn.textContent = visible ? '🙈' : '👁';
        });

        // Test
        const testBtn = actions.createEl('button', { cls: `${CSS_PREFIX}-api-action`, text: '✓' });
        testBtn.title = 'Test';
        testBtn.addEventListener('click', async () => {
            const key = this.secureConfig.getApiKey(opts.key);
            if (!key && opts.key !== 'ollamaApiKey') {
                this.showToast(`No ${opts.name} key`, 'info');
                return;
            }
            testBtn.disabled = true;
            testBtn.textContent = '…';
            try {
                await opts.validate(key);
                testBtn.textContent = '✓';
                testBtn.classList.add('is-valid');
                dot.className = `${CSS_PREFIX}-api-dot has-key`;
                this.showToast(`${opts.name} valid`, 'success');
            } catch {
                testBtn.textContent = '✗';
                testBtn.classList.add('is-error');
                this.showToast(`${opts.name} failed`, 'error');
            }
            setTimeout(() => {
                testBtn.textContent = '✓';
                testBtn.classList.remove('is-valid', 'is-error');
                testBtn.disabled = false;
            }, 2500);
        });
    }

    // ── AI Configuration ─────────────────────────────────────────────────
    private createAISection(parent: HTMLElement): void {
        const content = this.createSection(parent, 'AI', '🤖');

        this.createSlider(content, {
            label: 'Max Tokens',
            min: 512,
            max: 8192,
            step: 256,
            value: this.settings.defaultMaxTokens || 4096,
            key: 'defaultMaxTokens',
        });

        this.createSlider(content, {
            label: 'Temperature',
            min: 0,
            max: 1,
            step: 0.1,
            value: this.settings.defaultTemperature ?? 0.5,
            key: 'defaultTemperature',
        });

        new Setting(content)
            .setName('Performance')
            .setDesc('')
            .addDropdown(dd =>
                dd
                    .addOption('fast', '⚡ Fast')
                    .addOption('balanced', '⚖️ Balanced')
                    .addOption('quality', '✨ Quality')
                    .setValue(this.settings.performanceMode || 'balanced')
                    .onChange(async value => {
                        await this.updateSetting('performanceMode', value as 'fast' | 'balanced' | 'quality');
                    }),
            );
    }

    // ── Prompt templates ─────────────────────────────────────────────────
    private createPromptTemplatesSection(parent: HTMLElement): void {
        const content = this.createSection(parent, 'Prompt templates', '📝');

        const help = content.createDiv({ cls: `${CSS_PREFIX}-template-help` });
        help.textContent =
            'The transcript, video metadata, and formatting rules are added automatically — ' +
            'write only the extra instructions you want for a format.';
        help.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-bottom: 8px;';

        FORMAT_ORDER.forEach(format => this.createTemplateEditor(content, format));
    }

    private createTemplateEditor(container: HTMLElement, format: OutputFormat): void {
        const meta = FORMAT_META[format];
        const override = this.settings.customPrompts?.[format] ?? '';

        new Setting(container)
            .setName(meta.label)
            .setDesc(meta.description)
            .addTextArea(text => {
                text.setPlaceholder('Built-in template used when empty')
                    .setValue(override)
                    .onChange(async value => {
                        await this.updateCustomPrompt(format, value);
                    });
                text.inputEl.style.cssText =
                    'width: 100%; min-height: 88px; font-family: var(--font-monospace); font-size: 12px;';
                return text;
            })
            .addButton(button => {
                button
                    .setButtonText('↺ Reset')
                    .setTooltip('Reset to built-in')
                    .onClick(() => void this.resetCustomPrompt(format));
                button.buttonEl.setAttribute('aria-label', `Reset ${meta.label} to the built-in template`);
            });
    }

    private async updateCustomPrompt(format: OutputFormat, value: string): Promise<void> {
        try {
            const prompts = { ...(this.settings.customPrompts ?? {}) };
            if (value.trim()) {
                prompts[format] = value;
            } else {
                delete prompts[format];
            }
            this.settings.customPrompts = prompts;
            await this.validateAndSaveSettings();
        } catch (error) {
            ErrorHandler.handle(error as Error, `Prompt template: ${format}`);
        }
    }

    private async resetCustomPrompt(format: OutputFormat): Promise<void> {
        try {
            const prompts = { ...(this.settings.customPrompts ?? {}) };
            delete prompts[format];
            this.settings.customPrompts = prompts;
            await this.validateAndSaveSettings();
            this.display();
            this.showToast(`${FORMAT_META[format]?.label ?? format} template reset`, 'info');
        } catch (error) {
            ErrorHandler.handle(error as Error, `Prompt template reset: ${format}`);
        }
    }

    // ── Output ───────────────────────────────────────────────────────────
    private createOutputSection(parent: HTMLElement): void {
        const content = this.createSection(parent, 'Output', '📁');

        new Setting(content)
            .setName('Folder')
            .setDesc('')
            .addText(text =>
                text
                    .setPlaceholder('YouTube/Processed Videos')
                    .setValue(this.settings.outputPath || 'YouTube/Processed Videos')
                    .onChange(async value => {
                        await this.updateSetting('outputPath', value.trim() || 'YouTube/Processed Videos');
                    }),
            );

        new Setting(content)
            .setName('Include timestamp links')
            .setDesc('Add [MM:SS] links that jump straight to that moment in the video.')
            .addToggle(toggle =>
                toggle.setValue(this.settings.includeTimestamps ?? true).onChange(async value => {
                    await this.updateSetting('includeTimestamps', value);
                }),
            );
    }

    // ── Advanced ─────────────────────────────────────────────────────────
    private createAdvancedSection(parent: HTMLElement): void {
        const content = this.createSection(parent, 'Advanced', '⚙️');

        new Setting(content)
            .setName('Parallel Processing')
            .setDesc('')
            .addToggle(toggle =>
                toggle.setValue(this.settings.enableParallelProcessing ?? false).onChange(async value => {
                    await this.updateSetting('enableParallelProcessing', value);
                }),
            );

        new Setting(content)
            .setName('Multimodal')
            .setDesc('')
            .addToggle(toggle =>
                toggle.setValue(this.settings.preferMultimodal ?? false).onChange(async value => {
                    await this.updateSetting('preferMultimodal', value);
                }),
            );

        new Setting(content)
            .setName('Transcript language')
            .setDesc('Preferred caption language code (e.g. en, es, fr). Blank = auto.')
            .addText(text =>
                text
                    .setPlaceholder('auto')
                    .setValue(this.settings.transcriptLanguage ?? '')
                    .onChange(async value => {
                        await this.updateSetting('transcriptLanguage', value.trim().toLowerCase());
                    }),
            );

        new Setting(content)
            .setName('Warn about already-processed videos')
            .setDesc('Tell you when a note for this video already exists instead of duplicating it silently.')
            .addToggle(toggle =>
                toggle.setValue(this.settings.warnOnDuplicates ?? true).onChange(async value => {
                    await this.updateSetting('warnOnDuplicates', value);
                }),
            );

        new Setting(content)
            .setName('Cache transcripts on disk')
            .setDesc(
                'Keep fetched transcripts inside the plugin folder so they can be reused without re-downloading them.',
            )
            .addToggle(toggle =>
                toggle.setValue(this.settings.persistTranscriptCache ?? false).onChange(async value => {
                    await this.updateSetting('persistTranscriptCache', value);
                }),
            );

        new Setting(content)
            .setName('Env Variables')
            .setDesc('')
            .addToggle(toggle =>
                toggle.setValue(this.settings.useEnvironmentVariables ?? false).onChange(async value => {
                    await this.updateSetting('useEnvironmentVariables', value);
                    if (value) this.warnIfKeysStillOnDisk();
                }),
            );

        const actionsDiv = content.createDiv({ cls: `${CSS_PREFIX}-compact-actions` });
        const clearBtn = actionsDiv.createEl('button', { text: '🗑️ Clear Keys', cls: 'mod-warning' });
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all API keys?')) {
                this.secureConfig.clearAllApiKeys();
                this.showToast('Keys cleared', 'info');
                this.display();
            }
        });
    }

    // ── Slider helper ────────────────────────────────────────────────────
    private createSlider(
        container: HTMLElement,
        opts: {
            label: string;
            min: number;
            max: number;
            step: number;
            value: number;
            key: keyof YouTubePluginSettings;
        },
    ): void {
        new Setting(container)
            .setName(opts.label)
            .setDesc('')
            .addSlider(slider =>
                slider
                    .setLimits(opts.min, opts.max, opts.step)
                    .setValue(opts.value)
                    .setDynamicTooltip()
                    .onChange(async v => {
                        await this.updateSetting(opts.key, opts.step < 1 ? parseFloat(String(v)) : parseInt(String(v)));
                    }),
            );
    }

    // ── Settings persistence ─────────────────────────────────────────────
    private validateConfiguration(): boolean {
        const hasKey = this.settings.geminiApiKey?.trim() || this.settings.groqApiKey?.trim();
        const hasPath = ValidationUtils.isValidPath(this.settings.outputPath);
        return Boolean(hasKey && hasPath);
    }

    private async updateSetting(
        key: keyof YouTubePluginSettings,
        value: string | boolean | number | 'fast' | 'balanced' | 'quality',
    ): Promise<void> {
        try {
            if (this.isApiKeyField(key) && typeof value === 'string') {
                if (value) {
                    try {
                        const obfuscated = this.secureConfig.setApiKey(
                            key as import('./secure-config').ApiKeyName,
                            value,
                        );
                        (this.settings as unknown as Record<string, unknown>)[key] = obfuscated;
                    } catch (error) {
                        ErrorHandler.handle(error as Error, `API Key: ${key}`, true);
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
            ErrorHandler.handle(error as Error, `Settings: ${key}`);
        }
    }

    private isApiKeyField(key: keyof YouTubePluginSettings): boolean {
        return ['geminiApiKey', 'groqApiKey', 'ollamaApiKey', 'huggingFaceApiKey', 'openRouterApiKey'].includes(key);
    }

    /**
     * When environment-variable mode is turned on, warn if any keys are still
     * persisted in data.json — so "no secrets on disk" is achievable and visible.
     * Non-destructive: does not clear anything, just nudges toward "Clear Keys".
     */
    private warnIfKeysStillOnDisk(): void {
        const fields: (keyof YouTubePluginSettings)[] = [
            'geminiApiKey',
            'groqApiKey',
            'ollamaApiKey',
            'huggingFaceApiKey',
            'openRouterApiKey',
        ];
        const stored = fields.filter(f => Boolean(String(this.settings[f] ?? '').trim())).length;
        if (stored > 0) {
            new Notice(
                `Environment mode is on, but ${stored} API key(s) are still stored in data.json. ` +
                    'Use "Clear Keys" to remove them from disk.',
            );
        }
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

    // ── Export / Import / Reset ──────────────────────────────────────────
    private exportSettings(): void {
        const blob = new Blob([JSON.stringify(this.settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yt-clipper-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Exported', 'success');
    }

    private importSettings(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', async e => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const imported = JSON.parse(await file.text());
                const validation = ValidationUtils.validateSettings(imported);
                if (!validation.isValid) {
                    this.showToast('Invalid file', 'error');
                    return;
                }
                const { ConfirmationModal } = await import('./components/common/confirmation-modal');
                if (
                    await new ConfirmationModal(this.app, {
                        title: 'Import',
                        message: 'Overwrite current settings?',
                    }).openAndWait()
                ) {
                    await this.options.onSettingsChange(imported);
                    this.settings = { ...imported };
                    this.display();
                    this.showToast('Imported', 'success');
                }
            } catch {
                this.showToast('Import failed', 'error');
            }
        });
        input.click();
    }

    private async resetToDefaults(): Promise<void> {
        const { ConfirmationModal } = await import('./components/common/confirmation-modal');
        if (
            await new ConfirmationModal(this.app, {
                title: 'Reset',
                message: 'Cannot be undone.',
                isDangerous: true,
            }).openAndWait()
        ) {
            const apiKeys = {
                geminiApiKey: this.settings.geminiApiKey,
                groqApiKey: this.settings.groqApiKey,
                huggingFaceApiKey: this.settings.huggingFaceApiKey,
                openRouterApiKey: this.settings.openRouterApiKey,
                ollamaApiKey: this.settings.ollamaApiKey,
                ollamaEndpoint: this.settings.ollamaEndpoint,
            };
            this.settings = {
                ...apiKeys,
                outputPath: 'YouTube/Processed Videos',
                useEnvironmentVariables: false,
                environmentPrefix: 'YTC',
                performanceMode: 'balanced',
                enableParallelProcessing: true,
                enableAutoFallback: true,
                preferMultimodal: true,
                transcriptLanguage: '',
                customPrompts: {},
                includeTimestamps: true,
                warnOnDuplicates: true,
                persistTranscriptCache: false,
                defaultMaxTokens: 4096,
                defaultTemperature: 0.5,
            };
            void this.options.onSettingsChange(this.settings);
            this.display();
            this.showToast('Reset', 'info');
        }
    }

    // ── Toast ────────────────────────────────────────────────────────────
    private showToast(message: string, type: 'success' | 'error' | 'info'): void {
        const toast = document.body.createDiv({ cls: `${CSS_PREFIX}-toast ${type}` });
        toast.createSpan({ text: type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️' });
        toast.createSpan({ text: message });
        setTimeout(() => {
            toast.remove();
        }, 2500);
    }

    // ── Section state persistence ────────────────────────────────────────
    private loadSectionStates(): void {
        try {
            const stored = localStorage.getItem(this.SECTION_STATES_KEY);
            if (stored) Object.entries(JSON.parse(stored)).forEach(([k, v]) => this.sectionStates.set(k, Boolean(v)));
        } catch {
            /* use defaults */
        }
    }

    private saveSectionStates(): void {
        try {
            const states: Record<string, boolean> = {};
            this.sectionStates.forEach((v, k) => {
                states[k] = v;
            });
            localStorage.setItem(this.SECTION_STATES_KEY, JSON.stringify(states));
        } catch {
            /* silently fail */
        }
    }
}
