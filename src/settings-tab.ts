/* eslint-disable max-lines */
import { SecureConfigService } from './secure-config';
import { API_KEY_FIELDS, MAX_CUSTOM_PROMPT_LENGTH, ValidationUtils } from './validation';
import { OutputFormat, YouTubePluginSettings } from './types';
import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { ErrorHandler } from './services/error-handler';
import { FORMAT_META } from './templates/format-templates';
import { FORMAT_ORDER } from './components/features/youtube/youtube-modal-utils';

interface PluginWithSettings extends Plugin {
    settings: YouTubePluginSettings;
}

const CSS_PREFIX = 'ytc-settings';

/** Delay before a keystroke in a prompt textarea is persisted to data.json. */
const PROMPT_SAVE_DEBOUNCE_MS = 500;

const DEFAULT_OUTPUT_PATH = 'YouTube/Processed Videos';
const DEFAULT_ENV_PREFIX = 'YTC';
const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

export interface SettingsTabOptions {
    plugin: PluginWithSettings;
    onSettingsChange: (settings: YouTubePluginSettings) => Promise<void>;
}

export class YouTubeSettingsTab extends PluginSettingTab {
    private settings: YouTubePluginSettings;
    private validationErrors: string[] = [];
    private validationWarnings: string[] = [];
    private secureConfig: SecureConfigService;
    private sectionStates: Map<string, boolean> = new Map();
    private readonly SECTION_STATES_KEY = 'ytc-settings-section-states';
    /** Live validation banner, updated in place instead of rebuilding the tab. */
    private validationBox?: HTMLElement;
    /** Prompt values awaiting their debounced write to data.json. */
    private readonly pendingPromptSaves = new Map<OutputFormat, string>();
    private readonly promptSaveTimers = new Map<OutputFormat, number>();

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

        // Persistent banner for validation errors/warnings. It survives input
        // events: feedback is patched into it in place rather than triggering a
        // full rebuild (which would drop focus mid-keystroke).
        this.validationBox = containerEl.createDiv({ cls: `${CSS_PREFIX}-validation` });
        this.validationBox.style.cssText =
            'display: flex; flex-direction: column; gap: 4px; margin: 8px 0 12px; ' +
            'font-size: 12px; line-height: 1.4;';
        this.renderValidationFeedback();

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

    /**
     * Obsidian calls this when the settings tab closes. Flush anything typed in
     * the last debounce window so a quick edit is never lost.
     */
    hide(): void {
        this.flushAllPromptSaves();
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
        left.createSpan({ text: 'YouTube to Note' });

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
        epInput.placeholder = DEFAULT_OLLAMA_ENDPOINT;
        epInput.value = this.settings.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT;
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
                    .onChange(value => {
                        // In-memory first so the value is never lost, then a
                        // debounced write: this textarea fires `onChange` on
                        // every keystroke and a full data.json rewrite per
                        // character is far too expensive.
                        this.updateCustomPrompt(format, value);
                        this.schedulePromptSave(format, value);
                    });
                text.inputEl.style.cssText =
                    'width: 100%; min-height: 88px; font-family: var(--font-monospace); font-size: 12px;';
                text.inputEl.maxLength = MAX_CUSTOM_PROMPT_LENGTH;
                text.inputEl.addEventListener('blur', () => this.flushPromptSave(format));
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

    private updateCustomPrompt(format: OutputFormat, value: string): void {
        const prompts = { ...(this.settings.customPrompts ?? {}) };
        if (value.trim()) {
            prompts[format] = value;
        } else {
            delete prompts[format];
        }
        this.settings.customPrompts = prompts;
    }

    /**
     * Queue a debounced persist for one prompt template. Re-typing within the
     * window resets the timer, so a burst of keystrokes costs a single write.
     */
    private schedulePromptSave(format: OutputFormat, value: string): void {
        this.pendingPromptSaves.set(format, value);
        const existing = this.promptSaveTimers.get(format);
        if (existing !== undefined) {
            window.clearTimeout(existing);
        }
        const timer = window.setTimeout(() => {
            this.promptSaveTimers.delete(format);
            this.flushPromptSave(format);
        }, PROMPT_SAVE_DEBOUNCE_MS);
        this.promptSaveTimers.set(format, timer);
    }

    /** Write a pending prompt edit immediately (blur, close, reset). */
    private flushPromptSave(format: OutputFormat): void {
        if (!this.pendingPromptSaves.has(format)) {
            return;
        }
        this.pendingPromptSaves.delete(format);
        const timer = this.promptSaveTimers.get(format);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            this.promptSaveTimers.delete(format);
        }
        void this.persistSettings(`Prompt template: ${format}`);
    }

    private flushAllPromptSaves(): void {
        const formats = [...this.pendingPromptSaves.keys()];
        formats.forEach(format => this.flushPromptSave(format));
    }

    private cancelPromptSave(format: OutputFormat): void {
        this.pendingPromptSaves.delete(format);
        const timer = this.promptSaveTimers.get(format);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            this.promptSaveTimers.delete(format);
        }
    }

    private async resetCustomPrompt(format: OutputFormat): Promise<void> {
        try {
            // A queued keystroke must not resurrect the value we are clearing.
            this.cancelPromptSave(format);
            const prompts = { ...(this.settings.customPrompts ?? {}) };
            delete prompts[format];
            this.settings.customPrompts = prompts;
            await this.persistSettings(`Prompt template reset: ${format}`);
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
                    .setPlaceholder(DEFAULT_OUTPUT_PATH)
                    .setValue(this.settings.outputPath || DEFAULT_OUTPUT_PATH)
                    .onChange(async value => {
                        await this.updateSetting('outputPath', value.trim() || DEFAULT_OUTPUT_PATH);
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

        this.createEnvironmentSettings(content);

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

    /**
     * Environment-variable intake: the toggle plus the prefix it reads keys
     * from. Exposing the prefix here is what makes the "env mode without a
     * stored key" configuration reachable from the UI instead of only by
     * hand-editing data.json.
     */
    private createEnvironmentSettings(content: HTMLElement): void {
        new Setting(content)
            .setName('Env Variables')
            .setDesc('')
            .addToggle(toggle =>
                toggle.setValue(this.settings.useEnvironmentVariables ?? false).onChange(async value => {
                    await this.updateSetting('useEnvironmentVariables', value);
                    if (value) this.warnIfKeysStillOnDisk();
                }),
            );

        new Setting(content)
            .setName('Environment variable prefix')
            .setDesc(
                'Prefix for the environment variables keys are read from, e.g. YTC_GEMINI_API_KEY. ' +
                    'Required when "Env Variables" is on.',
            )
            .addText(text =>
                text
                    .setPlaceholder(DEFAULT_ENV_PREFIX)
                    .setValue(this.settings.environmentPrefix || DEFAULT_ENV_PREFIX)
                    .onChange(async value => {
                        await this.updateSetting('environmentPrefix', value.trim());
                    }),
            );
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
    /**
     * READY/SETUP badge rule: any one provider key (not just Gemini/Groq), or
     * environment-variable mode with a usable prefix.
     */
    private validateConfiguration(): boolean {
        const hasKey = API_KEY_FIELDS.some(field => Boolean(String(this.settings[field] ?? '').trim()));
        const hasEnv =
            Boolean(this.settings.useEnvironmentVariables) &&
            Boolean(String(this.settings.environmentPrefix ?? '').trim());
        return Boolean((hasKey || hasEnv) && ValidationUtils.isValidPath(this.settings.outputPath));
    }

    private async updateSetting(
        key: keyof YouTubePluginSettings,
        value: string | boolean | number | 'fast' | 'balanced' | 'quality',
    ): Promise<void> {
        if (this.isApiKeyField(key) && typeof value === 'string') {
            if (value) {
                try {
                    const obfuscated = this.secureConfig.setApiKey(key as import('./secure-config').ApiKeyName, value);
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
        await this.persistSettings(`Settings: ${key}`);
    }

    private isApiKeyField(key: keyof YouTubePluginSettings): boolean {
        return (API_KEY_FIELDS as readonly string[]).includes(key);
    }

    /**
     * Validate, then persist. Validation feedback is rendered into the live
     * banner and the header badge; the save only happens when the settings are
     * valid, so an invalid edit never reaches data.json.
     */
    private async validateAndSaveSettings(): Promise<void> {
        const validation = ValidationUtils.validateSettings(this.settings as unknown as Record<string, unknown>);
        this.validationErrors = validation.errors;
        this.validationWarnings = validation.warnings;

        if (validation.isValid) {
            await this.options.onSettingsChange(this.settings);
        }
        this.renderValidationFeedback();
    }

    /** Same as {@link validateAndSaveSettings} but user-facing failures become a Notice. */
    private async persistSettings(context: string): Promise<void> {
        try {
            await this.validateAndSaveSettings();
        } catch (error) {
            ErrorHandler.handle(error as Error, context);
        }
    }

    /**
     * Patch the validation banner and header badge in place. Rebuilding the
     * whole tab here used to yank focus away from the control the user was
     * typing in whenever the error set flipped.
     */
    private renderValidationFeedback(): void {
        const isReady = this.validateConfiguration();
        this.updateHeaderBadge(isReady);

        const box = this.validationBox;
        if (!box) {
            return;
        }
        box.empty();

        if (this.validationErrors.length === 0 && this.validationWarnings.length === 0) {
            box.style.display = 'none';
            return;
        }
        box.style.display = 'flex';

        const render = (messages: string[], cls: string, icon: string): void => {
            messages.forEach(message => {
                const row = box.createDiv({ cls: `${CSS_PREFIX}-validation-row ${cls}` });
                row.style.cssText = 'display: flex; gap: 6px; align-items: baseline;';
                const iconEl = row.createSpan({ text: icon });
                iconEl.style.flex = '0 0 auto';
                row.createSpan({ text: message });
            });
        };
        render(this.validationErrors, 'is-error', '⚠️');
        render(this.validationWarnings, 'is-warning', 'ℹ️');
    }

    /**
     * When environment-variable mode is turned on, warn if any keys are still
     * persisted in data.json — so "no secrets on disk" is achievable and visible.
     * Non-destructive: does not clear anything, just nudges toward "Clear Keys".
     */
    private warnIfKeysStillOnDisk(): void {
        const stored = API_KEY_FIELDS.filter(field => Boolean(String(this.settings[field] ?? '').trim())).length;
        if (stored > 0) {
            new Notice(
                `Environment mode is on, but ${stored} API key(s) are still stored in data.json. ` +
                    'Use "Clear Keys" to remove them from disk.',
            );
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
    /**
     * Export the settings as JSON. API keys are deliberately stripped: the
     * download is a plaintext file that easily ends up in shared folders,
     * screenshots and issue reports, so it must never carry credentials.
     */
    private exportSettings(): void {
        const exported: Record<string, unknown> = { ...(this.settings as unknown as Record<string, unknown>) };
        API_KEY_FIELDS.forEach(field => delete exported[field]);
        exported.keysExported = false;
        exported.keysNote =
            'API keys are never exported. Re-enter them in the plugin settings after importing, ' +
            'or provide them through environment variables.';

        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-to-note-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        new Notice('📤 Settings exported — API keys are not included. Add them back after importing.');
    }

    private importSettings(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', async e => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            try {
                const imported = JSON.parse(await file.text()) as unknown;
                const merged =
                    imported && typeof imported === 'object'
                        ? this.mergeImportedSettings(imported as Record<string, unknown>)
                        : this.settings;
                // Validate what will actually be stored, not the raw file: an
                // export without keys must still import into a vault that has them.
                const validation = ValidationUtils.validateSettings(merged as unknown as Record<string, unknown>);
                if (!validation.isValid) {
                    this.showToast(`Invalid file: ${validation.errors[0] ?? 'unexpected content'}`, 'error');
                    return;
                }
                const { ConfirmationModal } = await import('./components/common/confirmation-modal');
                if (
                    await new ConfirmationModal(this.app, {
                        title: 'Import',
                        message:
                            'Overwrite current settings? Your API keys are kept unless the file provides new ones.',
                    }).openAndWait()
                ) {
                    await this.options.onSettingsChange(merged);
                    this.settings = { ...merged };
                    this.display();
                    this.showToast('Imported', 'success');
                }
            } catch {
                this.showToast('Import failed', 'error');
            }
        });
        input.click();
    }

    /**
     * Overlay an imported settings object onto the live one. Provider keys are
     * only taken from the file when it carries a non-empty value — exports never
     * do, so an import can never blank out the keys already stored in data.json.
     */
    private mergeImportedSettings(imported: Record<string, unknown>): YouTubePluginSettings {
        const clean = { ...imported };
        delete clean.keysExported;
        delete clean.keysNote;

        API_KEY_FIELDS.forEach(field => {
            if (!ValidationUtils.isNonEmptyString(clean[field])) {
                delete clean[field];
            }
        });

        return { ...this.settings, ...(clean as Partial<YouTubePluginSettings>) };
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
                outputPath: DEFAULT_OUTPUT_PATH,
                useEnvironmentVariables: false,
                environmentPrefix: DEFAULT_ENV_PREFIX,
                // Model listings are a cache, not a preference — drop them so a
                // reset also forces a fresh `listModels` per provider.
                modelOptionsCache: {},
                performanceMode: 'balanced',
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
            try {
                await this.options.onSettingsChange(this.settings);
            } catch (error) {
                // The in-memory reset already happened; surface the write failure
                // instead of letting the rejection vanish.
                ErrorHandler.handle(error as Error, 'Reset settings');
            }
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
