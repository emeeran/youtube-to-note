/* eslint-disable max-lines */
import { BaseModal } from '../../common/base-modal';
import { ErrorHandler } from '../../../services/error-handler';
import { logger } from '../../../services/logger';
import { MESSAGES } from '../../../constants/index';
import { PROVIDER_MODEL_OPTIONS } from '../../../ai/api';
import { OutputFormat, PerformanceMode } from '../../../types';
import { UserPreferencesService } from '../../../services/user-preferences-service';
import { ValidationUtils } from '../../../validation';
import { FORMAT_CONFIG } from '../../../services/prompt-service';
import { FORMAT_META } from '../../../templates/format-templates';
import { formatModelNameWithMultimodal } from '../../../services/model-formatter';
import { ProcessingHistoryService } from '../../../services/processing-history';
import { App, Notice } from 'obsidian';

/**
 * YouTube URL input modal component
 */

export interface YouTubeUrlModalOptions {
    onProcess: (
        url: string,
        format: OutputFormat,
        provider?: string,
        model?: string,
        performanceMode?: PerformanceMode,
        enableParallel?: boolean,
        preferMultimodal?: boolean,
        maxTokens?: number,
        temperature?: number,
        enableAutoFallback?: boolean,
        userInstructions?: string,
    ) => Promise<string>; // Return file path
    onOpenFile?: (filePath: string) => Promise<void>;
    onOpenBatchModal?: () => void;
    initialUrl?: string;
    providers?: string[]; // available provider names
    modelOptions?: Record<string, string[]>; // mapping providerName -> models
    defaultProvider?: string;
    defaultModel?: string;
    defaultMaxTokens?: number;
    defaultTemperature?: number;
    fetchModels?: () => Promise<Record<string, string[]>>;
    fetchModelsForProvider?: (provider: string, forceRefresh?: boolean) => Promise<string[]>;
    // Performance settings from plugin settings
    performanceMode?: PerformanceMode;
    enableParallelProcessing?: boolean;
    enableAutoFallback?: boolean;
    preferMultimodal?: boolean;
    onPerformanceSettingsChange?: (
        performanceMode: PerformanceMode,
        enableParallel: boolean,
        preferMultimodal: boolean,
    ) => Promise<void>;
    // Processing history
    historyService?: ProcessingHistoryService;
}

export class YouTubeUrlModal extends BaseModal {
    private url = '';
    private format: OutputFormat = 'executive-summary';
    private headerEl?: HTMLHeadingElement;
    private urlInput?: HTMLInputElement;
    private pasteButton?: HTMLButtonElement;
    private clearButton?: HTMLButtonElement;
    private processButton?: HTMLButtonElement;
    private openButton?: HTMLButtonElement;
    private copyPathButton?: HTMLButtonElement;
    private processAnotherButton?: HTMLButtonElement;
    private secondaryActionsRow?: HTMLDivElement;
    private thumbnailEl?: HTMLImageElement;
    private metadataContainer?: HTMLDivElement;
    private fetchInProgress = false;
    private providerSelect?: HTMLSelectElement;
    private modelSelect?: HTMLSelectElement;
    private refreshSpinner?: HTMLSpanElement;
    private selectedProvider?: string;
    private selectedModel?: string;
    private progressContainer?: HTMLDivElement;
    private progressBar?: HTMLDivElement;
    private progressText?: HTMLDivElement;
    private validationMessage?: HTMLDivElement;
    private userInstructionsTextarea?: HTMLTextAreaElement;
    private userInstructions = '';
    private progressSteps: { label: string; element: HTMLLIElement }[] = [];
    private currentStepIndex = 0;
    private isProcessing = false;
    private processedFilePath?: string;
    private refreshButton?: HTMLButtonElement;
    private formatDescriptionEl?: HTMLDivElement;

    // Format, Provider, and Model dropdowns
    private formatSelect?: HTMLSelectElement;

    // Theme state
    private isLightTheme = false;
    private autoFallbackEnabled = true;
    private themeElements?: {
        slider: HTMLDivElement;
        knob: HTMLDivElement;
        sunIcon: HTMLSpanElement;
        moonIcon: HTMLSpanElement;
        updateTheme: (isLight: boolean) => void;
    };

    constructor(
        app: App,
        private options: YouTubeUrlModalOptions,
    ) {
        super(app);

        this.url = options.initialUrl ?? '';

        // Initialize theme from localStorage
        const savedTheme = localStorage.getItem('ytc-theme-mode');
        this.isLightTheme = savedTheme === 'light';

        // Load smart defaults from user preferences
        const smartDefaults = UserPreferencesService.getSmartDefaultPerformanceSettings();
        const lastProvider = UserPreferencesService.getSmartDefaultProvider() ?? 'Google Gemini';
        const lastFormat = UserPreferencesService.getSmartDefaultFormat() ?? 'timestamped';
        const smartAutoFallback = UserPreferencesService.getSmartDefaultAutoFallback() ?? true;

        const preferredModel = UserPreferencesService.getPreference('preferredModel');
        const lastModel = UserPreferencesService.getPreference('lastModel');

        this.selectedProvider = lastProvider ?? 'Google Gemini';
        this.selectedModel = preferredModel ?? lastModel ?? 'gemini-2.5-pro';
        this.format = lastFormat;
        this.autoFallbackEnabled = smartAutoFallback;

        UserPreferencesService.updateLastUsed({
            format: lastFormat,
            provider: this.selectedProvider,
            model: this.selectedModel,
            maxTokens: options.defaultMaxTokens ?? 4096,
            temperature: options.defaultTemperature ?? 0.5,
            performanceMode: smartDefaults.mode,
            parallelProcessing: smartDefaults.parallel,
            multimodal: smartDefaults.multimodal,
        });
    }

    onOpen(): void {
        logger.debug('[YT-CLIPPER] YouTubeUrlModal.onOpen called', 'Modal');
        try {
            this.createModalContent();
            this.setupEventHandlers();
            this.setupKeyboardShortcuts();
            void this.fetchModelsForCurrentProvider();

            if (this.options.initialUrl) {
                this.setUrl(this.options.initialUrl);
                this.updateProcessButtonState();
                const isValid = ValidationUtils.isValidYouTubeUrl((this.options.initialUrl || '').trim());
                if (isValid && this.processButton) {
                    this.processButton.focus();
                    return;
                }
            }
            this.focusUrlInput();
        } catch (error) {
            logger.error('[YT-CLIPPER] Error in onOpen:', 'Modal', { error });
            throw error;
        }
    }

    /**
     * Automatically fetch models for the current provider when modal opens
     */
    private async fetchModelsForCurrentProvider(): Promise<void> {
        if (!this.options.fetchModelsForProvider || !this.selectedProvider) return;

        try {
            const models = await this.options.fetchModelsForProvider(this.selectedProvider, true);
            if (models && models.length > 0) {
                const updatedOptions = { ...this.options.modelOptions, [this.selectedProvider]: models };
                this.options.modelOptions = updatedOptions;
                this.updateModelDropdown(updatedOptions);
            } else {
                this.updateModelDropdown(this.options.modelOptions ?? {});
            }
        } catch {
            this.updateModelDropdown(this.options.modelOptions ?? {});
        }
    }

    /**
     * Create modal content
     */
    private createModalContent(): void {
        try {
            this.contentEl.empty();
            this.contentEl.addClass('ytc-modal-content-wrapper');

            this.createTopBar();
            this.createUrlSection();
            this.createSettingsSection();
            this.createProgressSection();
            this.createActionButtons();

            this.updateModelDropdown(this.options.modelOptions ?? {});
            this.applyTheme(this.isLightTheme);
        } catch (error) {
            logger.error('[YT-CLIPPER] Error in createModalContent:', 'Modal', { error });
            throw error;
        }
    }

    /**
     * Create top bar with header and global controls
     */
    private createTopBar(): void {
        const topBar = this.contentEl.createDiv('ytc-top-bar');
        topBar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        const titleContainer = topBar.createDiv();
        const title = titleContainer.createEl('h2');
        title.textContent = 'YouTube to Note';
        this.headerEl = title;

        const subtitle = titleContainer.createDiv('subtitle');
        subtitle.textContent = 'Generate AI summaries & notes';

        const controls = topBar.createDiv();
        controls.style.cssText = `
            display: flex;
            gap: 6px;
            align-items: center;
        `;

        // History Button
        const historyBtn = controls.createEl('button');
        historyBtn.innerHTML = '<span style="font-size: 1.1em">🕐</span>';
        historyBtn.setAttribute('aria-label', 'Processing History');
        historyBtn.title = 'View recently processed videos';
        historyBtn.style.cssText = `
            background: transparent;
            border: 1px solid var(--ytc-border);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--ytc-text-secondary);
        `;
        historyBtn.onclick = () => this.showHistory();
        historyBtn.onmouseenter = () => {
            historyBtn.style.background = 'var(--ytc-bg-tertiary)';
            historyBtn.style.color = 'var(--ytc-text-primary)';
        };
        historyBtn.onmouseleave = () => {
            historyBtn.style.background = 'transparent';
            historyBtn.style.color = 'var(--ytc-text-secondary)';
        };

        // Auto Fallback Toggle
        const fallbackBtn = controls.createEl('button');
        const updateFallbackIcon = () => {
            fallbackBtn.innerHTML = '<span style="font-size: 1.1em">🔄</span>';
            fallbackBtn.style.opacity = this.autoFallbackEnabled ? '1' : '0.4';
            fallbackBtn.style.borderColor = this.autoFallbackEnabled ? 'var(--ytc-accent)' : 'var(--ytc-border)';
            fallbackBtn.title = `Auto Fallback: ${this.autoFallbackEnabled ? 'ON' : 'OFF'}`;
        };
        fallbackBtn.setAttribute('aria-label', 'Toggle Auto Fallback');
        fallbackBtn.style.cssText = `
            background: transparent;
            border: 1px solid var(--ytc-border);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--ytc-text-secondary);
        `;
        updateFallbackIcon();
        fallbackBtn.onclick = () => {
            this.autoFallbackEnabled = !this.autoFallbackEnabled;
            updateFallbackIcon();
            UserPreferencesService.updateLastUsed({ autoFallback: this.autoFallbackEnabled });
        };
        fallbackBtn.onmouseenter = () => {
            fallbackBtn.style.background = 'var(--ytc-bg-tertiary)';
            fallbackBtn.style.color = 'var(--ytc-text-primary)';
        };
        fallbackBtn.onmouseleave = () => {
            fallbackBtn.style.background = 'transparent';
            fallbackBtn.style.color = 'var(--ytc-text-secondary)';
        };

        // Batch Mode Button
        const batchBtn = controls.createEl('button');
        batchBtn.innerHTML = '<span style="font-size: 1.1em">📦</span>';
        batchBtn.setAttribute('aria-label', 'Batch Process');
        batchBtn.title = 'Batch Process Multiple Videos';
        batchBtn.style.cssText = `
            background: transparent;
            border: 1px solid var(--ytc-border);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--ytc-text-secondary);
        `;
        batchBtn.onclick = () => this.options.onOpenBatchModal?.();
        batchBtn.onmouseenter = () => {
            batchBtn.style.background = 'var(--ytc-bg-tertiary)';
            batchBtn.style.color = 'var(--ytc-text-primary)';
        };
        batchBtn.onmouseleave = () => {
            batchBtn.style.background = 'transparent';
            batchBtn.style.color = 'var(--ytc-text-secondary)';
        };

        // Theme Toggle
        const themeBtn = controls.createEl('button');
        themeBtn.innerHTML = this.isLightTheme ? '🌙' : '☀️';
        themeBtn.setAttribute('aria-label', 'Toggle Theme');
        themeBtn.title = 'Toggle Light/Dark Mode';
        themeBtn.style.cssText = `
            background: transparent;
            border: 1px solid var(--ytc-border);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 1.1em;
            color: var(--ytc-text-secondary);
        `;
        themeBtn.onclick = () => {
            this.isLightTheme = !this.isLightTheme;
            this.applyTheme(this.isLightTheme);
            localStorage.setItem('ytc-theme-mode', this.isLightTheme ? 'light' : 'dark');
            themeBtn.innerHTML = this.isLightTheme ? '🌙' : '☀️';
        };
        themeBtn.onmouseenter = () => {
            themeBtn.style.background = 'var(--ytc-bg-tertiary)';
            themeBtn.style.color = 'var(--ytc-text-primary)';
        };
        themeBtn.onmouseleave = () => {
            themeBtn.style.background = 'transparent';
            themeBtn.style.color = 'var(--ytc-text-secondary)';
        };
    }

    /**
     * Create URL input section
     */
    private createUrlSection(): void {
        const urlContainer = this.contentEl.createDiv();
        urlContainer.style.cssText = `
            margin: 0 0 20px 0;
            position: relative;
        `;

        const inputWrapper = urlContainer.createDiv('ytc-input-group');
        inputWrapper.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
        `;

        this.urlInput = inputWrapper.createEl('input');
        this.urlInput.type = 'url';
        this.urlInput.placeholder = 'Paste YouTube URL here...';
        this.urlInput.setAttribute('aria-label', 'YouTube URL Input');

        this.pasteButton = inputWrapper.createEl('button', { cls: 'ytc-paste-btn-integrated' });
        this.pasteButton.innerHTML = '📋 Paste';
        this.pasteButton.setAttribute('aria-label', 'Paste URL from clipboard');
        this.pasteButton.title = 'Paste from clipboard';

        this.pasteButton.addEventListener('click', e => {
            e.preventDefault();
            void this.handleSmartPaste();
        });

        this.validationMessage = urlContainer.createDiv();
        this.validationMessage.setAttribute('aria-live', 'polite');
        this.validationMessage.style.cssText = `
            position: absolute;
            bottom: -20px;
            left: 2px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            height: 20px;
            display: flex;
            align-items: center;
        `;

        this.createVideoPreviewSection(urlContainer);
    }

    /**
     * Create Settings Section (Format + Collapsible AI Config)
     * User Instructions now visible for ALL formats.
     */
    private createSettingsSection(): void {
        const container = this.contentEl.createDiv();
        container.addClass('ytc-settings-section');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
        `;

        // Controls Row (Output Format + AI Toggle)
        const controlsRow = container.createDiv();
        controlsRow.style.cssText = `
            display: flex;
            gap: 12px;
            align-items: flex-end;
        `;

        // 1. Output Format (Left)
        const formatWrapper = controlsRow.createDiv();
        formatWrapper.style.flex = '1';

        const formatLabel = formatWrapper.createEl('label');
        formatLabel.textContent = 'OUTPUT FORMAT';
        formatLabel.htmlFor = 'ytc-format-select';
        formatLabel.style.cssText = `
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--ytc-text-muted);
            margin-bottom: 6px;
            letter-spacing: 0.05em;
            display: block;
        `;

        this.formatSelect = formatWrapper.createEl('select');
        this.formatSelect.id = 'ytc-format-select';

        // Build format options from FORMAT_META
        const formatOrder: OutputFormat[] = [
            'quick-notes',
            'executive-summary',
            'technical-analysis',
            '3c-accelerated-learning',
            'atom-notes',
            'article',
            'complete-transcription',
        ];

        formatOrder.forEach(format => {
            if (!this.formatSelect) return;
            const meta = FORMAT_META[format];
            const optionEl = this.formatSelect.createEl('option');
            optionEl.value = format;
            optionEl.textContent = meta.label;
            optionEl.title = meta.description; // Tooltip on hover
        });

        this.formatSelect.value = this.format;
        this.formatSelect.addEventListener('change', () => {
            this.format = (this.formatSelect?.value as OutputFormat) ?? 'executive-summary';
            UserPreferencesService.setPreference('lastFormat', this.format);
            this.updateFormatDescription();
        });

        // Format description line
        this.formatDescriptionEl = formatWrapper.createDiv();
        this.formatDescriptionEl.style.cssText = `
            font-size: 0.75rem;
            color: var(--ytc-text-muted);
            margin-top: 4px;
            min-height: 18px;
        `;
        this.updateFormatDescription();

        // 2. AI Config Toggle (Right)
        const aiToggleWrapper = controlsRow.createDiv();
        aiToggleWrapper.style.flex = '1';

        const aiLabel = aiToggleWrapper.createEl('label');
        aiLabel.textContent = 'AI CONFIGURATION';
        aiLabel.style.cssText = `
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--ytc-text-muted);
            margin-bottom: 6px;
            letter-spacing: 0.05em;
            display: block;
        `;

        const aiToggleBtn = aiToggleWrapper.createDiv();
        aiToggleBtn.addClass('ytc-ai-toggle-btn');
        aiToggleBtn.setAttribute('role', 'button');
        aiToggleBtn.setAttribute('tabindex', '0');
        aiToggleBtn.style.cssText = `
            background: var(--ytc-bg-input);
            border: 1px solid var(--ytc-border);
            border-radius: 8px;
            height: 38px;
            padding: 0 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        `;

        const aiSummary = aiToggleBtn.createDiv();
        aiSummary.style.cssText = `
            font-size: 0.9rem;
            color: var(--ytc-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;

        const chevron = aiToggleBtn.createDiv();
        chevron.innerHTML =
            '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1"/></svg>';
        chevron.style.cssText = `
            transition: transform 0.2s ease;
            opacity: 0.5;
            margin-left: 8px;
            flex-shrink: 0;
            color: var(--ytc-text-secondary);
        `;

        const aiContent = container.createDiv('ytc-ai-content');
        aiContent.style.cssText = `
            background: var(--ytc-bg-secondary);
            border: 1px solid var(--ytc-border);
            border-radius: 8px;
            padding: 16px;
            display: none;
            margin-top: -4px;
            animation: fadeIn 0.15s ease-out;
        `;

        let isExpanded = false;

        const updateSummary = () => {
            const provider = this.selectedProvider ?? 'Google Gemini';
            const model = this.selectedModel ?? 'Default';
            aiSummary.textContent = `${provider}`;
            aiSummary.title = `${provider} • ${formatModelNameWithMultimodal(provider, model)}`;
        };

        const toggleAI = () => {
            isExpanded = !isExpanded;
            aiContent.style.display = isExpanded ? 'block' : 'none';
            aiToggleBtn.classList.toggle('active', isExpanded);
            aiToggleBtn.style.borderColor = isExpanded ? 'var(--ytc-accent)' : 'var(--ytc-border)';
            chevron.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        aiToggleBtn.addEventListener('click', toggleAI);
        aiToggleBtn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleAI();
            }
        });

        // Provider Selection
        const providerRow = aiContent.createDiv();

        const providerLabel = providerRow.createEl('label');
        providerLabel.textContent = 'AI PROVIDER';
        providerLabel.htmlFor = 'ytc-provider-select';
        providerLabel.style.cssText =
            'font-size: 0.7rem; font-weight: 600; margin-bottom: 6px; color: var(--ytc-text-muted); letter-spacing: 0.05em; display: block;';

        this.providerSelect = providerRow.createEl('select');
        this.providerSelect.id = 'ytc-provider-select';

        const providerOptions = [
            { value: 'Google Gemini', text: 'Google Gemini (Recommended)' },
            { value: 'OpenRouter', text: 'OpenRouter' },
            { value: 'Groq', text: 'Groq (Fastest)' },
            { value: 'Ollama Cloud', text: 'Ollama Cloud' },
            { value: 'Ollama', text: 'Ollama (Local)' },
        ];

        providerOptions.forEach(opt => {
            if (!this.providerSelect) return;
            const el = this.providerSelect.createEl('option');
            el.value = opt.value;
            el.textContent = opt.text;
        });
        this.providerSelect.value = this.selectedProvider ?? 'Google Gemini';

        // Model Selection
        const modelRow = aiContent.createDiv();
        modelRow.style.cssText = 'margin-top: 16px;';

        const modelLabel = modelRow.createEl('label');
        modelLabel.textContent = 'MODEL';
        modelLabel.htmlFor = 'ytc-model-select';
        modelLabel.style.cssText =
            'font-size: 0.7rem; font-weight: 600; color: var(--ytc-text-muted); letter-spacing: 0.05em; display: block; margin-bottom: 6px;';

        const modelInputGroup = modelRow.createDiv();
        modelInputGroup.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        this.modelSelect = modelInputGroup.createEl('select');
        this.modelSelect.id = 'ytc-model-select';
        this.modelSelect.style.cssText = `
            flex: 1;
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            font-size: 0.95rem;
            background: var(--background-primary);
            height: 42px;
            cursor: pointer;
        `;

        const refreshBtn = modelInputGroup.createEl('button', { cls: 'ytc-icon-btn' });
        refreshBtn.innerHTML = '🔄';
        refreshBtn.title = 'Refresh Models';
        refreshBtn.setAttribute('aria-label', 'Refresh Models');
        refreshBtn.onclick = async e => {
            e.stopPropagation();
            refreshBtn.innerHTML = '⏳';
            await this.fetchModelsForCurrentProvider();
            refreshBtn.innerHTML = '🔄';
            updateSummary();
        };

        const starBtn = modelInputGroup.createEl('button', { cls: 'ytc-icon-btn' });
        starBtn.innerHTML = '⭐';
        starBtn.title = 'Save as Default Preference';
        starBtn.setAttribute('aria-label', 'Save as Default Preference');
        starBtn.onclick = e => {
            e.stopPropagation();
            if (this.selectedModel) {
                UserPreferencesService.setPreference('preferredModel', this.selectedModel);
                new Notice('⭐ Model saved as default!');
            }
        };

        this.providerSelect.addEventListener('change', async () => {
            this.selectedProvider = this.providerSelect?.value ?? 'Google Gemini';
            await this.fetchModelsForCurrentProvider();
            updateSummary();
        });

        this.modelSelect.addEventListener('change', () => {
            this.selectedModel = this.modelSelect?.value;
            updateSummary();
        });

        updateSummary();

        const originalUpdateDropdown = this.updateModelDropdown.bind(this);
        this.updateModelDropdown = options => {
            originalUpdateDropdown(options);
            updateSummary();
        };

        // User Instructions Textarea — visible for ALL formats
        const userInstructionsWrapper = container.createDiv();
        userInstructionsWrapper.style.cssText = `margin-top: 8px;`;

        const userInstructionsLabel = userInstructionsWrapper.createEl('label');
        userInstructionsLabel.textContent = 'USER INSTRUCTIONS (optional)';
        userInstructionsLabel.style.cssText = `
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--ytc-text-muted);
            margin-bottom: 6px;
            letter-spacing: 0.05em;
            display: block;
        `;

        this.userInstructionsTextarea = userInstructionsWrapper.createEl('textarea');
        this.userInstructionsTextarea.placeholder = 'E.g., \'Focus on specific aspects...\', \'Include code examples\', \'Highlight the debate about...\'';
        this.userInstructionsTextarea.rows = 2;
        this.userInstructionsTextarea.setAttribute('aria-label', 'User Instructions');
        this.userInstructionsTextarea.style.cssText = `
            width: 100%;
            height: 60px;
            resize: vertical;
            font-size: 0.85rem;
            color: var(--ytc-text-secondary);
            background: var(--ytc-bg-input);
            border-radius: 8px;
            border: 1px solid var(--ytc-border);
            margin-top: 8px;
            padding: 8px 12px;
            font-family: inherit;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s ease;
        `;
        this.userInstructionsTextarea.addEventListener('input', () => {
            this.userInstructions = this.userInstructionsTextarea?.value ?? '';
        });
        this.userInstructionsTextarea.addEventListener('focus', () => {
            if (this.userInstructionsTextarea) {
                this.userInstructionsTextarea.style.borderColor = 'var(--ytc-accent)';
            }
        });
        this.userInstructionsTextarea.addEventListener('blur', () => {
            if (this.userInstructionsTextarea) {
                this.userInstructionsTextarea.style.borderColor = 'var(--ytc-border)';
            }
        });
    }

    /**
     * Update the format description text below the dropdown
     */
    private updateFormatDescription(): void {
        if (!this.formatDescriptionEl) return;
        const meta = FORMAT_META[this.format];
        this.formatDescriptionEl.textContent = meta?.description ?? '';
    }

    private videoPreviewContainer?: HTMLDivElement;
    private videoTitleEl?: HTMLDivElement;
    private videoDurationEl?: HTMLSpanElement;
    private videoChannelEl?: HTMLSpanElement;
    private providerStatusEl?: HTMLDivElement;

    private createVideoPreviewSection(parent: HTMLElement): void {
        this.videoPreviewContainer = parent.createDiv();
        this.videoPreviewContainer.style.cssText = `
            display: none;
            margin-top: 4px;
            padding: 6px;
            background: var(--background-secondary);
            border-radius: 4px;
            border: 1px solid var(--background-modifier-border);
        `;

        const previewContent = this.videoPreviewContainer.createDiv();
        previewContent.style.cssText = `
            display: flex;
            gap: 6px;
            align-items: center;
        `;

        this.thumbnailEl = previewContent.createEl('img');
        this.thumbnailEl.style.cssText = `
            width: 60px;
            height: 34px;
            border-radius: 3px;
            object-fit: cover;
            background: var(--background-modifier-border);
            flex-shrink: 0;
        `;
        this.thumbnailEl.alt = 'Video thumbnail';

        const metaContainer = previewContent.createDiv();
        metaContainer.style.cssText = `
            flex: 1;
            min-width: 0;
        `;

        this.videoTitleEl = metaContainer.createDiv();
        this.videoTitleEl.style.cssText = `
            font-weight: 500;
            font-size: 0.8rem;
            color: var(--text-normal);
            margin-bottom: 1px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        const metaRow = metaContainer.createDiv();
        metaRow.style.cssText = `
            display: flex;
            gap: 6px;
            font-size: 0.7rem;
            color: var(--text-muted);
        `;

        this.videoChannelEl = metaRow.createSpan();
        this.videoDurationEl = metaRow.createSpan();

        this.providerStatusEl = this.videoPreviewContainer.createDiv();
        this.providerStatusEl.style.cssText = `
            margin-top: 3px;
            padding: 3px 6px;
            background: var(--background-primary);
            border-radius: 3px;
            font-size: 0.8rem;
            color: var(--text-muted);
            display: none;
        `;
    }

    /**
     * Show video preview with thumbnail and metadata
     */
    private async showVideoPreview(videoId: string): Promise<void> {
        if (!this.videoPreviewContainer || !this.thumbnailEl) return;

        this.videoPreviewContainer.style.display = 'block';

        const skeletonAnim = `
            @keyframes ytc-skeleton-pulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.8; }
            }
        `;
        if (!document.getElementById('ytc-skeleton-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'ytc-skeleton-styles';
            styleEl.textContent = skeletonAnim;
            document.head.appendChild(styleEl);
        }

        this.thumbnailEl.style.background = 'var(--background-modifier-border)';
        this.thumbnailEl.style.animation = 'ytc-skeleton-pulse 1.5s ease-in-out infinite';
        this.thumbnailEl.src = '';

        if (this.videoTitleEl) {
            this.videoTitleEl.textContent = '████████████████';
            this.videoTitleEl.style.color = 'var(--background-modifier-border)';
            this.videoTitleEl.style.animation = 'ytc-skeleton-pulse 1.5s ease-in-out infinite';
        }
        if (this.videoChannelEl) {
            this.videoChannelEl.textContent = '████████';
            this.videoChannelEl.style.animation = 'ytc-skeleton-pulse 1.5s ease-in-out infinite';
        }
        if (this.videoDurationEl) {
            this.videoDurationEl.textContent = '██:██';
            this.videoDurationEl.style.animation = 'ytc-skeleton-pulse 1.5s ease-in-out infinite';
        }

        this.thumbnailEl.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        this.thumbnailEl.onload = () => {
            if (this.thumbnailEl) {
                this.thumbnailEl.style.animation = 'none';
            }
        };

        try {
            const response = await fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
            );
            if (response.ok) {
                const data = await response.json();
                if (this.videoTitleEl) {
                    this.videoTitleEl.textContent = data.title || 'Unknown Title';
                    this.videoTitleEl.style.color = 'var(--text-normal)';
                    this.videoTitleEl.style.animation = 'none';
                }
                if (this.videoChannelEl) {
                    this.videoChannelEl.textContent = `📺 ${data.author_name || 'Unknown Channel'}`;
                    this.videoChannelEl.style.animation = 'none';
                }
                if (this.videoDurationEl) {
                    this.videoDurationEl.textContent = '';
                    this.videoDurationEl.style.animation = 'none';
                }

                // Check history for this video
                this.checkHistoryForVideo(videoId);
            }
        } catch {
            if (this.videoTitleEl) {
                this.videoTitleEl.textContent = 'Video Preview';
                this.videoTitleEl.style.color = 'var(--text-normal)';
                this.videoTitleEl.style.animation = 'none';
            }
            if (this.videoChannelEl) this.videoChannelEl.style.animation = 'none';
            if (this.videoDurationEl) this.videoDurationEl.style.animation = 'none';
        }
    }

    /**
     * Check processing history and show indicator if video was previously processed
     */
    private checkHistoryForVideo(videoId: string): void {
        const history = this.options.historyService;
        if (!history) return;

        const previous = history.find(videoId);
        if (previous && this.providerStatusEl) {
            const date = new Date(previous.processedAt).toLocaleDateString();
            this.providerStatusEl.style.display = 'block';
            this.providerStatusEl.innerHTML = `<span style="color: var(--ytc-text-muted);">🕐 Previously processed (${previous.format}, ${date})</span>`;
        }
    }

    private hideVideoPreview(): void {
        if (this.videoPreviewContainer) {
            this.videoPreviewContainer.style.display = 'none';
        }
    }

    private updateProviderStatus(provider: string, status: string): void {
        if (this.providerStatusEl) {
            this.providerStatusEl.style.display = 'block';
            const providerSpan = `<span style="color: var(--ytc-accent);">🤖 ${provider}</span>`;
            this.providerStatusEl.innerHTML = `${providerSpan} — ${status}`;
        }
    }

    private fallbackToggle?: HTMLInputElement;

    private createFallbackToggle(parent: HTMLElement): void {
        const toggleRow = parent.createDiv();
        toggleRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 5px;
            padding: 4px 8px;
            background: var(--background-secondary);
            border-radius: 4px;
            font-size: 0.75rem;
        `;

        const labelContainer = toggleRow.createDiv();
        labelContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
        `;

        labelContainer.createSpan({ text: '🔄' });
        const label = labelContainer.createSpan({ text: 'Auto Fallback' });
        label.style.cssText = `
            color: var(--text-normal);
            font-weight: 500;
            font-size: 0.75rem;
        `;

        const hint = labelContainer.createSpan({ text: '(err)' });
        hint.style.cssText = `
            color: var(--text-muted);
            font-size: 0.7rem;
        `;

        const toggleContainer = toggleRow.createDiv();
        toggleContainer.style.cssText = `
            position: relative;
            width: 30px;
            height: 16px;
            flex-shrink: 0;
        `;

        this.fallbackToggle = toggleContainer.createEl('input', { type: 'checkbox' });
        this.fallbackToggle.checked = this.options.enableAutoFallback ?? true;
        this.autoFallbackEnabled = this.fallbackToggle.checked;
        this.fallbackToggle.style.cssText = `
            position: absolute;
            width: 30px;
            height: 16px;
            appearance: none;
            -webkit-appearance: none;
            background: var(--background-modifier-border);
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s ease;
            outline: none;
        `;

        const updateToggleStyle = () => {
            if (this.fallbackToggle?.checked) {
                this.fallbackToggle.style.background = 'var(--ytc-accent)';
                this.fallbackToggle.style.boxShadow = '0 0 10px rgba(45, 212, 191, 0.4)';
            } else if (this.fallbackToggle) {
                this.fallbackToggle.style.background = 'var(--ytc-border)';
                this.fallbackToggle.style.boxShadow = 'none';
            }
        };

        const knob = toggleContainer.createDiv();
        knob.style.cssText = `
            position: absolute;
            top: 2px;
            left: 2px;
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            transition: transform 0.2s ease;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;

        const updateKnob = () => {
            if (this.fallbackToggle?.checked) {
                knob.style.transform = 'translateX(14px)';
            } else {
                knob.style.transform = 'translateX(0)';
            }
        };

        updateToggleStyle();
        updateKnob();

        this.fallbackToggle.addEventListener('change', () => {
            this.autoFallbackEnabled = this.fallbackToggle?.checked ?? true;
            UserPreferencesService.updateLastUsed({
                autoFallback: this.autoFallbackEnabled,
            });
            updateToggleStyle();
            updateKnob();
        });
    }

    /**
     * Update the model dropdown options based on provider selection
     * Uses the pattern-based model formatter from model-formatter.ts
     */
    private updateModelDropdown(modelOptionsMap: Record<string, string[]>): void {
        if (!this.modelSelect || !this.providerSelect) return;

        const currentProvider = this.providerSelect.value;

        this.modelSelect.innerHTML = '<option value="">Loading models...</option>';
        this.modelSelect.disabled = true;

        let models: string[] = [];
        let sourceInfo = '';

        if (modelOptionsMap?.[currentProvider]) {
            models = modelOptionsMap[currentProvider] ?? [];
            sourceInfo = ' (live)';
        } else {
            const providerModels = PROVIDER_MODEL_OPTIONS[currentProvider];
            if (providerModels) {
                models = providerModels.map(m => (typeof m === 'string' ? m : m.name));
                sourceInfo = ' (cached)';
            } else {
                models = [];
            }
        }

        this.modelSelect.innerHTML = '';

        if (models.length > 0) {
            const countOption = this.modelSelect.createEl('option');
            countOption.value = '';
            countOption.textContent = `📋 ${models.length} models${sourceInfo}`;
            countOption.disabled = true;
            countOption.style.cssText = `
                font-weight: 600;
                color: var(--text-muted);
                font-size: 12px;
                background: var(--background-secondary);
            `;
        }

        // Use the centralized model formatter
        models.forEach(model => {
            if (!this.modelSelect) return;
            const option = this.modelSelect.createEl('option');
            option.value = model;
            option.textContent = formatModelNameWithMultimodal(currentProvider, model);
            option.style.cssText = `
                color: var(--text-normal);
                background: var(--background-primary);
            `;
        });

        this.modelSelect.disabled = false;

        let modelToSelect = '';
        const preferences = UserPreferencesService.loadPreferences();
        const providerKey = `lastModel_${currentProvider.replace(/\s+/g, '')}`;
        const lastProviderModel = (preferences as Record<string, unknown>)[providerKey] as string | undefined;

        if (lastProviderModel && models.includes(lastProviderModel)) {
            modelToSelect = lastProviderModel;
        } else if (this.selectedModel && models.includes(this.selectedModel)) {
            modelToSelect = this.selectedModel;
        } else if (models.length > 0) {
            modelToSelect = models[0] ?? '';
        }

        this.modelSelect.value = modelToSelect;
        this.selectedModel = modelToSelect;

        if (models.length > 0) {
            this.modelSelect.style.transition = 'background 0.3s ease';
            this.modelSelect.style.background = 'var(--background-modifier-hover)';
            setTimeout(() => {
                if (this.modelSelect) {
                    this.modelSelect.style.background = '';
                }
            }, 300);
        }
    }

    private createThemeToggle(): void {
        // Deprecated - theme toggle is now in the top bar
    }

    private applyTheme(isLight: boolean): void {
        this.modalEl?.classList.add('ytc-themed-modal');
        this.modalEl?.classList.toggle('ytc-modal-light', isLight);
        this.modalEl?.classList.toggle('ytc-modal-dark', !isLight);

        const existingStyle = document.getElementById('ytc-theme-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
    }

    private timerInterval?: number;
    private timerEl?: HTMLSpanElement;

    private createProgressSection(): void {
        this.progressContainer = this.contentEl.createDiv();
        this.progressContainer.setAttribute('role', 'region');
        this.progressContainer.setAttribute('aria-label', 'Processing progress');
        this.progressContainer.setAttribute('aria-live', 'polite');
        this.progressContainer.style.marginTop = '6px';
        this.progressContainer.style.display = 'none';

        const infoRow = this.progressContainer.createDiv();
        infoRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        `;

        this.progressText = infoRow.createDiv();
        this.progressText.id = 'progress-text';
        this.progressText.style.fontWeight = '500';
        this.progressText.style.fontSize = '13px';
        this.progressText.style.color = '#00b894';
        this.progressText.textContent = 'Processing...';

        this.timerEl = infoRow.createSpan();
        this.timerEl.style.cssText = `
            font-family: monospace;
            font-variant-numeric: tabular-nums;
            font-size: 12px;
            color: var(--ytc-text-muted);
        `;
        this.timerEl.textContent = '0.0s';

        const progressBarContainer = this.progressContainer.createDiv();
        progressBarContainer.setAttribute('role', 'progressbar');
        progressBarContainer.setAttribute('aria-valuenow', '0');
        progressBarContainer.setAttribute('aria-valuemin', '0');
        progressBarContainer.setAttribute('aria-valuemax', '100');
        progressBarContainer.setAttribute('aria-labelledby', 'progress-text');
        progressBarContainer.style.cssText = `
            width: 100%;
            height: 6px;
            background-color: var(--ytc-bg-tertiary);
            border-radius: 3px;
            overflow: hidden;
            position: relative;
        `;

        this.progressBar = progressBarContainer.createDiv();
        this.progressBar.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, var(--ytc-accent), #34d399);
            border-radius: 3px;
            width: 0%;
            transition: width 0.3s ease;
            position: relative;
        `;

        const shimmer = this.progressBar.createDiv();
        shimmer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background-image: linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.15) 25%,
                transparent 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.15) 50%,
                rgba(255, 255, 255, 0.15) 75%,
                transparent 75%,
                transparent
            );
            background-size: 20px 20px;
            animation: ytc-progress-stripe 1s linear infinite;
            opacity: 0.6;
        `;

        if (!document.getElementById('ytc-progress-anim')) {
            const style = document.createElement('style');
            style.id = 'ytc-progress-anim';
            style.textContent = `
                @keyframes ytc-progress-stripe {
                    0% { background-position: 0 0; }
                    100% { background-position: 20px 20px; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    private createActionButtons(): void {
        const container = this.contentEl.createDiv();
        container.style.cssText = `
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 12px;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid var(--ytc-border);
        `;

        const cancelBtn = container.createEl('button', { cls: 'ytc-action-btn ytc-ghost-btn' });
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.close());

        const spacer = container.createDiv();
        spacer.style.flex = '1';

        this.secondaryActionsRow = container.createDiv();
        this.secondaryActionsRow.style.cssText = `
            display: none;
            gap: 8px;
        `;

        this.copyPathButton = this.secondaryActionsRow.createEl('button', { cls: 'ytc-action-btn ytc-secondary-btn' });
        this.copyPathButton.innerHTML = '📋';
        this.copyPathButton.title = 'Copy Path';
        this.copyPathButton.style.width = '40px';
        this.copyPathButton.style.padding = '0';
        this.copyPathButton.addEventListener('click', () => this.handleCopyPath());

        this.openButton = this.secondaryActionsRow.createEl('button', { cls: 'ytc-action-btn ytc-secondary-btn' });
        this.openButton.innerHTML = '📄 Open';
        this.openButton.addEventListener('click', () => this.handleOpenFile());

        const processAnotherBtn = this.secondaryActionsRow.createEl('button', {
            cls: 'ytc-action-btn ytc-primary-btn',
        });
        processAnotherBtn.innerHTML = '🔄 New';
        processAnotherBtn.addEventListener('click', () => {
            this.showInputState();
        });
        this.processAnotherButton = processAnotherBtn;

        this.processButton = container.createEl('button', { cls: 'ytc-action-btn ytc-primary-btn' });
        this.processButton.innerHTML = `<span>✨</span> ${MESSAGES.MODALS.PROCESS}`;
        this.processButton.style.minWidth = '120px';
        this.processButton.addEventListener('click', () => this.handleProcess());

        this.updateProcessButtonState();
    }

    private showInputState(): void {
        if (this.processButton) {
            this.processButton.style.display = 'flex';
            this.processButton.disabled = false;
            this.processButton.innerHTML = `<span>✨</span> ${MESSAGES.MODALS.PROCESS}`;
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.style.display = 'none';
        }
        if (this.urlInput) {
            this.urlInput.disabled = false;
            this.urlInput.value = '';
            this.url = '';
        }
        if (this.headerEl) {
            this.headerEl.textContent = MESSAGES.MODALS.PROCESS_VIDEO;
        }
        if (this.userInstructionsTextarea) {
            this.userInstructionsTextarea.value = '';
            this.userInstructions = '';
        }
        this.processedFilePath = '';
        this.updateProcessButtonState();
        this.focusUrlInput();
    }

    private setupEventHandlers(): void {
        this.scope.register([], 'Enter', () => {
            if (this.processButton && !this.processButton.disabled) {
                this.processButton.click();
            }
            return false;
        });

        this.scope.register([], 'Escape', () => {
            this.close();
            return false;
        });

        this.scope.register(['Ctrl'], 'o', () => {
            if (this.openButton && this.openButton.style.display !== 'none') {
                void this.handleOpenFile();
            }
            return false;
        });

        this.scope.register(['Ctrl'], 'c', () => {
            if (document.activeElement !== this.urlInput && this.processedFilePath) {
                void this.handleCopyPath();
                return false;
            }
            return true;
        });

        this.scope.register(['Ctrl', 'Shift'], 'v', async () => {
            try {
                const clipText = await navigator.clipboard.readText();
                if (this.urlInput && ValidationUtils.isValidYouTubeUrl(clipText)) {
                    this.urlInput.value = clipText;
                    this.url = clipText;
                    this.updateProcessButtonState();
                    if (this.processButton && !this.processButton.disabled) {
                        this.processButton.click();
                    }
                }
            } catch {
                // Clipboard access denied
            }
            return false;
        });

        if (this.urlInput) {
            this.urlInput.addEventListener('input', () => {
                this.url = this.urlInput?.value ?? '';
                this.updateProcessButtonState();
            });
        }
    }

    private focusUrlInput(): void {
        if (this.urlInput) {
            this.urlInput.focus();
        }
    }

    private updateProcessButtonState(): void {
        if (!this.processButton) return;

        const trimmedUrl = this.url.trim();
        const isValid = ValidationUtils.isValidYouTubeUrl(trimmedUrl);

        this.processButton.disabled = !isValid || this.isProcessing;
        this.processButton.style.opacity = this.processButton.disabled ? '0.5' : '1';

        if (trimmedUrl.length === 0) {
            this.setValidationMessage('Paste a YouTube link to begin processing.', 'info');
            this.hideVideoPreview();
        } else if (isValid) {
            this.setValidationMessage('Ready to process this video.', 'success');
            const videoId = ValidationUtils.extractVideoId(trimmedUrl);
            if (videoId) {
                void this.showVideoPreview(videoId);
            }
        } else {
            this.setValidationMessage('Enter a valid YouTube video URL.', 'error');
            this.hideVideoPreview();
        }
    }

    private setValidationMessage(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        if (!this.validationMessage) return;

        this.validationMessage.textContent = message;

        let color = 'var(--ytc-text-muted)';
        if (type === 'error') {
            color = 'var(--ytc-error)';
        } else if (type === 'success') {
            color = 'var(--ytc-success)';
        }

        this.validationMessage.style.color = color;
    }

    /**
     * Handle process button click
     * Fix: use user's temperature setting, not formatConfig override
     */
    private async handleProcess(): Promise<void> {
        const trimmedUrl = this.url.trim();
        if (!trimmedUrl) {
            new Notice(MESSAGES.ERRORS.ENTER_URL);
            this.focusUrlInput();
            return;
        }

        if (!ValidationUtils.isValidYouTubeUrl(trimmedUrl)) {
            new Notice(MESSAGES.ERRORS.INVALID_URL);
            this.focusUrlInput();
            return;
        }

        try {
            this.showProcessingState();
            this.updateProgress(0, 'Starting...');

            this.updateProgress(25, 'Validating URL...');

            const videoId = ValidationUtils.extractVideoId(trimmedUrl);
            if (!videoId) {
                throw new Error('Could not extract YouTube video ID');
            }

            this.updateProgress(50, 'Fetching video data...');

            this.format = (this.formatSelect?.value as OutputFormat) ?? 'executive-summary';
            this.selectedProvider = this.providerSelect?.value;
            this.selectedModel = this.modelSelect?.value;

            const providerDisplayName = this.selectedProvider
                ? this.selectedProvider.charAt(0).toUpperCase() + this.selectedProvider.slice(1)
                : 'AI';
            this.updateProgress(75, `Processing with ${providerDisplayName}...`);

            const formatConfig = FORMAT_CONFIG[this.format] ?? FORMAT_CONFIG['executive-summary'];
            const maxTokens = this.options.defaultMaxTokens ?? formatConfig.recommendedMaxTokens;
            // Fix: use user's temperature setting instead of always overriding with formatConfig
            const temperature = this.options.defaultTemperature ?? formatConfig.temperatureHint;

            const filePath = await this.options.onProcess(
                trimmedUrl,
                this.format,
                this.selectedProvider,
                this.selectedModel,
                this.options.performanceMode ?? 'balanced',
                this.options.enableParallelProcessing ?? false,
                this.options.preferMultimodal ?? false,
                maxTokens,
                temperature,
                this.autoFallbackEnabled,
                this.userInstructions,
            );

            this.updateProgress(100, 'Complete!');

            this.processedFilePath = filePath;
            this.showCompletionState();
        } catch (error) {
            this.showErrorState(error as Error);
            ErrorHandler.handle(error as Error, 'YouTube URL processing');
        }
    }

    private showProcessingState(): void {
        this.isProcessing = true;
        if (this.progressContainer) {
            this.progressContainer.style.display = 'block';
        }
        if (this.urlInput) {
            this.urlInput.disabled = true;
        }
        if (this.processButton) {
            this.processButton.style.display = 'flex';
            this.processButton.disabled = true;
            this.processButton.innerHTML = '<span>⏳</span> Processing...';
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.style.display = 'none';
        }

        if (this.timerInterval) window.clearInterval(this.timerInterval);
        const startTime = Date.now();
        if (this.timerEl) this.timerEl.textContent = '0.0s';

        this.timerInterval = window.setInterval(() => {
            if (this.timerEl) {
                const elapsed = (Date.now() - startTime) / 1000;
                this.timerEl.textContent = `${elapsed.toFixed(1)}s`;
            }
        }, 100);
    }

    private updateProgress(percent: number, text: string): void {
        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = text;
        }
    }

    private showCompletionState(): void {
        this.isProcessing = false;
        if (this.timerInterval) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = undefined;
        }

        if (this.urlInput) {
            this.urlInput.disabled = false;
            this.urlInput.value = '';
            this.url = '';
        }

        if (this.processButton) {
            this.processButton.style.display = 'none';
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.style.display = 'flex';
        }

        if (this.headerEl) {
            this.headerEl.textContent = '✅ Video Processed Successfully!';
        }
        this.setValidationMessage('Note saved. You can open it now or process another video.', 'success');
        this.focusUrlInput();
    }

    private showErrorState(error: Error): void {
        this.isProcessing = false;
        if (this.timerInterval) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = undefined;
        }

        if (this.urlInput) {
            this.urlInput.disabled = false;
        }
        if (this.processButton) {
            this.processButton.disabled = false;
            this.processButton.textContent = MESSAGES.MODALS.PROCESS;
        }
        if (this.openButton) {
            this.openButton.style.display = 'none';
        }
        if (this.copyPathButton) {
            this.copyPathButton.style.display = 'none';
        }
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        if (this.headerEl) {
            this.headerEl.textContent = '❌ Processing Failed';
        }
        this.setValidationMessage(error.message, 'error');
    }

    private async handleOpenFile(): Promise<void> {
        if (this.processedFilePath && this.options.onOpenFile) {
            try {
                await this.options.onOpenFile(this.processedFilePath);
                this.close();
            } catch (error) {
                ErrorHandler.handle(error as Error, 'Opening file');
            }
        }
    }

    private async handleCopyPath(): Promise<void> {
        if (this.processedFilePath) {
            try {
                await navigator.clipboard.writeText(this.processedFilePath);
                if (this.copyPathButton) {
                    const originalText = this.copyPathButton.textContent;
                    this.copyPathButton.textContent = '✅ Copied!';
                    setTimeout(() => {
                        if (this.copyPathButton) {
                            this.copyPathButton.textContent = originalText;
                        }
                    }, 1500);
                }
            } catch (error) {
                ErrorHandler.handle(error as Error, 'Copying path to clipboard');
            }
        }
    }

    private setUrl(url: string): void {
        this.url = url;
        if (this.urlInput) {
            this.urlInput.value = url;
        }
        this.updateProcessButtonState();
    }

    private async handleSmartPaste(): Promise<void> {
        try {
            const text = await navigator.clipboard.readText();
            const trimmed = text.trim();

            if (ValidationUtils.isValidYouTubeUrl(trimmed)) {
                this.setUrl(trimmed);
                new Notice('YouTube URL detected and pasted!');
            } else {
                const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)/;
                const embedRegex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/;
                const ytMatch = trimmed.match(ytRegex);
                const embedMatch = trimmed.match(embedRegex);
                const urlMatch = ytMatch ?? embedMatch;
                if (urlMatch) {
                    const videoId = urlMatch[1];
                    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    this.setUrl(fullUrl);
                    new Notice('YouTube URL extracted from clipboard!');
                } else {
                    new Notice('No YouTube URL found in clipboard');
                }
            }

            if (this.processButton && !this.isProcessing && ValidationUtils.isValidYouTubeUrl(trimmed)) {
                this.processButton.focus();
            } else {
                this.focusUrlInput();
            }
        } catch {
            new Notice('Could not access clipboard');
        }
    }

    private setupKeyboardShortcuts(): void {
        this.scope.register(['Ctrl'], 'Enter', () => {
            if (this.processButton && !this.processButton.disabled) {
                this.processButton.click();
            }
            return false;
        });
    }

    onClose(): void {
        if (this.validationTimer) {
            clearTimeout(this.validationTimer);
        }
        super.onClose();
    }

    private validationTimer?: number;

    /**
     * Show processing history in a simple overlay
     */
    private showHistory(): void {
        const history = this.options.historyService;
        if (!history) {
            new Notice('Processing history not available');
            return;
        }

        const entries = history.getRecent(10);
        if (entries.length === 0) {
            new Notice('No processing history yet');
            return;
        }

        // Create a simple history overlay
        const overlay = document.createElement('div');
        overlay.className = 'ytc-history-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 12px;
            padding: 20px;
            z-index: 10000;
            min-width: 400px;
            max-width: 500px;
            max-height: 400px;
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        `;

        const header = overlay.createDiv();
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--background-modifier-border);
        `;
        header.createEl('h3', { text: '🕐 Recent Processing History' });

        const closeBtn = header.createEl('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 1.2rem;
            color: var(--text-muted);
            padding: 4px;
        `;

        entries.forEach(entry => {
            const item = overlay.createDiv();
            item.style.cssText = `
                padding: 8px;
                margin-bottom: 4px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.15s;
                border: 1px solid var(--background-modifier-border);
            `;
            item.onmouseenter = () => item.style.background = 'var(--background-secondary)';
            item.onmouseleave = () => item.style.background = 'transparent';

            const titleEl = item.createDiv();
            titleEl.style.cssText = `
                font-weight: 500;
                font-size: 0.85rem;
                color: var(--text-normal);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;
            titleEl.textContent = entry.title;

            const metaEl = item.createDiv();
            metaEl.style.cssText = `
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-top: 2px;
            `;
            const date = new Date(entry.processedAt).toLocaleDateString();
            const formatLabel = FORMAT_META[entry.format]?.label ?? entry.format;
            metaEl.textContent = `${formatLabel} · ${entry.provider} · ${date}`;

            // Click to open
            item.onclick = () => {
                if (this.options.onOpenFile) {
                    void this.options.onOpenFile(entry.filePath);
                }
                overlay.remove();
                bgOverlay.remove();
            };
        });

        const bgOverlay = document.createElement('div');
        bgOverlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.3);
            z-index: 9999;
        `;

        closeBtn.onclick = () => {
            overlay.remove();
            bgOverlay.remove();
        };
        bgOverlay.onclick = () => {
            overlay.remove();
            bgOverlay.remove();
        };

        document.body.appendChild(bgOverlay);
        document.body.appendChild(overlay);
    }
}
