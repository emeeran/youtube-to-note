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
}

export class YouTubeUrlModal extends BaseModal {
    private url = '';
    private format: OutputFormat = 'executive-summary';
    private headerEl?: HTMLHeadingElement;
    private urlInput?: HTMLInputElement;
    private pasteButton?: HTMLButtonElement;
    private processButton?: HTMLButtonElement;
    private openButton?: HTMLButtonElement;
    private copyPathButton?: HTMLButtonElement;
    private secondaryActionsRow?: HTMLDivElement;
    private thumbnailEl?: HTMLImageElement;
    private videoTitleEl?: HTMLDivElement;
    private videoChannelEl?: HTMLSpanElement;
    private videoDurationEl?: HTMLSpanElement;
    private providerStatusEl?: HTMLDivElement;
    private videoPreviewContainer?: HTMLDivElement;
    private fetchInProgress = false;
    private providerSelect?: HTMLSelectElement;
    private modelSelect?: HTMLSelectElement;
    private selectedProvider?: string;
    private selectedModel?: string;
    private progressContainer?: HTMLDivElement;
    private progressBar?: HTMLDivElement;
    private progressText?: HTMLDivElement;
    private validationMessage?: HTMLDivElement;
    private userInstructionsTextarea?: HTMLTextAreaElement;
    private userInstructions = '';
    private isProcessing = false;
    private processedFilePath?: string;
    private autoFallbackEnabled = true;
    private timerInterval?: number;
    private timerEl?: HTMLSpanElement;
    private validationTimer?: number;

    // Format dropdown
    private formatSelect?: HTMLSelectElement;

    constructor(
        app: App,
        private options: YouTubeUrlModalOptions,
    ) {
        super(app);

        this.url = options.initialUrl ?? '';

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

            // Apply light mode by default
            this.modalEl?.classList.add('ytc-themed-modal', 'ytc-modal-light');

            this.createTopBar();
            this.createUrlSection();
            this.createSettingsSection();
            this.createProgressSection();
            this.createActionButtons();

            this.updateModelDropdown(this.options.modelOptions ?? {});
        } catch (error) {
            logger.error('[YT-CLIPPER] Error in createModalContent:', 'Modal', { error });
            throw error;
        }
    }

    /**
     * Create top bar with title only
     */
    private createTopBar(): void {
        const topBar = this.contentEl.createDiv('ytc-top-bar');

        const title = topBar.createEl('h2');
        const iconSpan = title.createSpan({ cls: 'ytc-title-icon' });
        iconSpan.innerHTML = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" width="24" height="24"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a1a2e"/><stop offset="100%" stop-color="#16213e"/></linearGradient></defs><rect width="128" height="128" rx="24" fill="url(#bg)"/><g transform="translate(22, 16)"><rect width="60" height="76" rx="6" fill="#fff" opacity="0.95"/><rect x="8" y="12" width="44" height="3" rx="1.5" fill="#1a1a2e" opacity="0.5"/><rect x="8" y="22" width="36" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="32" width="40" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="42" width="30" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="52" width="38" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="62" width="24" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/></g><g transform="translate(72, 72)"><rect width="44" height="32" rx="10" fill="#FF0000"/><polygon points="18,8 18,24 32,16" fill="#fff"/></g></svg>`;
        title.appendText(' YouTube to Note');
        this.headerEl = title;

        // Theme toggle
        const themeBtn = topBar.createEl('button', { cls: 'ytc-theme-toggle' });
        themeBtn.innerHTML = '☀️';
        themeBtn.title = 'Toggle light/dark theme';
        themeBtn.setAttribute('aria-label', 'Toggle theme');

        let isDark = false;
        themeBtn.addEventListener('click', () => {
            isDark = !isDark;
            this.modalEl?.classList.toggle('ytc-modal-dark', isDark);
            this.modalEl?.classList.toggle('ytc-modal-light', !isDark);
            themeBtn.innerHTML = isDark ? '☀️' : '🌙';
        });
    }

    /**
     * Create URL input section
     */
    private createUrlSection(): void {
        const urlContainer = this.contentEl.createDiv('ytc-url-section');

        const inputWrapper = urlContainer.createDiv('ytc-input-group');

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

        this.validationMessage = urlContainer.createDiv('ytc-validation-message');
        this.validationMessage.setAttribute('aria-live', 'polite');

        this.createVideoPreviewSection(urlContainer);
    }

    /**
     * Create Settings Section (Format + Collapsible AI Config)
     */
    private createSettingsSection(): void {
        const container = this.contentEl.createDiv('ytc-settings-section');

        // Controls Row (Output Format + AI Toggle)
        const controlsRow = container.createDiv('ytc-controls-row');

        // 1. Output Format (Left)
        const formatWrapper = controlsRow.createDiv();
        formatWrapper.style.flex = '1';

        const formatLabel = formatWrapper.createEl('label');
        formatLabel.textContent = 'OUTPUT FORMAT';
        formatLabel.htmlFor = 'ytc-format-select';
        formatLabel.addClass('ytc-field-label');

        this.formatSelect = formatWrapper.createEl('select');
        this.formatSelect.id = 'ytc-format-select';

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
            optionEl.title = meta.description;
        });

        this.formatSelect.value = this.format;
        this.formatSelect.addEventListener('change', () => {
            this.format = (this.formatSelect?.value as OutputFormat) ?? 'executive-summary';
            UserPreferencesService.setPreference('lastFormat', this.format);
        });

        // 2. AI Config Toggle (Right)
        const aiToggleWrapper = controlsRow.createDiv();
        aiToggleWrapper.style.flex = '1';

        const aiLabel = aiToggleWrapper.createEl('label');
        aiLabel.textContent = 'AI CONFIGURATION';
        aiLabel.addClass('ytc-field-label');

        const aiToggleBtn = aiToggleWrapper.createDiv('ytc-ai-toggle-btn');
        aiToggleBtn.setAttribute('role', 'button');
        aiToggleBtn.setAttribute('tabindex', '0');

        const aiSummary = aiToggleBtn.createDiv('ytc-ai-summary');

        const chevron = aiToggleBtn.createDiv('ytc-ai-chevron');
        chevron.innerHTML =
            '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1L5 5L9 1"/></svg>';

        // Provider — always visible, below the controls row
        const providerRow = container.createDiv('ytc-provider-row');

        const providerLabel = providerRow.createEl('label');
        providerLabel.textContent = 'AI PROVIDER';
        providerLabel.htmlFor = 'ytc-provider-select';
        providerLabel.addClass('ytc-field-label');

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

        // Collapsible content (model + instructions)
        const aiContent = container.createDiv('ytc-ai-content');

        let isExpanded = false;

        const updateSummary = () => {
            const provider = this.selectedProvider ?? 'Google Gemini';
            const model = this.selectedModel ?? 'Default';
            aiSummary.textContent = `${provider}`;
            aiSummary.title = `${provider} • ${formatModelNameWithMultimodal(provider, model)}`;
        };

        const toggleAI = () => {
            isExpanded = !isExpanded;
            aiContent.classList.toggle('is-visible', isExpanded);
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

        // Model Selection (inside collapsible content)
        const modelRow = aiContent.createDiv('ytc-model-row');

        const modelLabel = modelRow.createEl('label');
        modelLabel.textContent = 'MODEL';
        modelLabel.htmlFor = 'ytc-model-select';
        modelLabel.addClass('ytc-field-label');

        const modelInputGroup = modelRow.createDiv('ytc-model-input-group');

        this.modelSelect = modelInputGroup.createEl('select');
        this.modelSelect.id = 'ytc-model-select';
        this.modelSelect.addClass('ytc-model-select');

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

        // User Instructions Textarea (inside AI config)
        const userInstructionsWrapper = aiContent.createDiv('ytc-user-instructions-wrapper');

        const userInstructionsLabel = userInstructionsWrapper.createEl('label');
        userInstructionsLabel.textContent = 'USER INSTRUCTIONS (optional)';
        userInstructionsLabel.addClass('ytc-field-label');

        this.userInstructionsTextarea = userInstructionsWrapper.createEl('textarea', {
            cls: 'ytc-user-instructions-textarea',
        });
        this.userInstructionsTextarea.placeholder =
            "E.g., 'Focus on specific aspects...', 'Include code examples', 'Highlight the debate about...'";
        this.userInstructionsTextarea.rows = 2;
        this.userInstructionsTextarea.setAttribute('aria-label', 'User Instructions');
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

    private createVideoPreviewSection(parent: HTMLElement): void {
        this.videoPreviewContainer = parent.createDiv('ytc-video-preview');

        const previewContent = this.videoPreviewContainer.createDiv('ytc-video-preview-content');

        this.thumbnailEl = previewContent.createEl('img', { cls: 'ytc-video-preview-thumb' });
        this.thumbnailEl.alt = 'Video thumbnail';

        const metaContainer = previewContent.createDiv('ytc-video-preview-meta');

        this.videoTitleEl = metaContainer.createDiv('ytc-video-preview-title');

        const metaRow = metaContainer.createDiv('ytc-video-preview-meta-row');

        this.videoChannelEl = metaRow.createSpan();
        this.videoDurationEl = metaRow.createSpan();

        this.providerStatusEl = this.videoPreviewContainer.createDiv('ytc-provider-status');
    }

    /**
     * Show video preview with thumbnail and metadata
     */
    private async showVideoPreview(videoId: string): Promise<void> {
        if (!this.videoPreviewContainer || !this.thumbnailEl) return;

        this.videoPreviewContainer.classList.add('is-visible');

        // Clear placeholder state
        this.thumbnailEl.src = '';
        if (this.videoTitleEl) this.videoTitleEl.textContent = '';
        if (this.videoChannelEl) this.videoChannelEl.textContent = '';
        if (this.videoDurationEl) this.videoDurationEl.textContent = '';

        this.thumbnailEl.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        try {
            const response = await fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
            );
            if (response.ok) {
                const data = await response.json();
                if (this.videoTitleEl) {
                    this.videoTitleEl.textContent = data.title || 'Unknown Title';
                }
                if (this.videoChannelEl) {
                    this.videoChannelEl.textContent = `📺 ${data.author_name || 'Unknown Channel'}`;
                }
                if (this.videoDurationEl) {
                    this.videoDurationEl.textContent = '';
                }
            }
        } catch {
            if (this.videoTitleEl) {
                this.videoTitleEl.textContent = 'Video Preview';
            }
        }
    }

    private hideVideoPreview(): void {
        if (this.videoPreviewContainer) {
            this.videoPreviewContainer.classList.remove('is-visible');
        }
    }

    private updateProviderStatus(provider: string, status: string): void {
        if (this.providerStatusEl) {
            this.providerStatusEl.classList.add('is-visible');
            const providerSpan = `<span style="color: var(--ytc-accent);">🤖 ${provider}</span>`;
            this.providerStatusEl.innerHTML = `${providerSpan} — ${status}`;
        }
    }

    /**
     * Update the model dropdown options based on provider selection
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

    private createProgressSection(): void {
        this.progressContainer = this.contentEl.createDiv('ytc-progress-container');
        this.progressContainer.setAttribute('role', 'region');
        this.progressContainer.setAttribute('aria-label', 'Processing progress');
        this.progressContainer.setAttribute('aria-live', 'polite');

        const infoRow = this.progressContainer.createDiv('ytc-progress-info-row');

        this.progressText = infoRow.createDiv('ytc-progress-text');
        this.progressText.id = 'progress-text';
        this.progressText.textContent = 'Processing...';

        this.timerEl = infoRow.createSpan('ytc-progress-timer');
        this.timerEl.textContent = '0.0s';

        const progressBarContainer = this.progressContainer.createDiv('ytc-progress-bar-track');
        progressBarContainer.setAttribute('role', 'progressbar');
        progressBarContainer.setAttribute('aria-valuenow', '0');
        progressBarContainer.setAttribute('aria-valuemin', '0');
        progressBarContainer.setAttribute('aria-valuemax', '100');
        progressBarContainer.setAttribute('aria-labelledby', 'progress-text');

        this.progressBar = progressBarContainer.createDiv('ytc-progress-bar-fill');
    }

    private createActionButtons(): void {
        const container = this.contentEl.createDiv('ytc-actions-row');

        const cancelBtn = container.createEl('button', { cls: 'ytc-action-btn ytc-ghost-btn' });
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.close());

        const spacer = container.createDiv('ytc-actions-spacer');

        this.secondaryActionsRow = container.createDiv('ytc-secondary-actions');

        this.copyPathButton = this.secondaryActionsRow.createEl('button', { cls: 'ytc-action-btn ytc-secondary-btn ytc-icon-only-btn' });
        this.copyPathButton.innerHTML = '<span class="ytc-btn-icon">📋</span><span class="ytc-btn-label">Copy Path</span>';
        this.copyPathButton.title = 'Copy Path';
        this.copyPathButton.addEventListener('click', () => this.handleCopyPath());

        this.openButton = this.secondaryActionsRow.createEl('button', { cls: 'ytc-action-btn ytc-secondary-btn ytc-icon-only-btn' });
        this.openButton.innerHTML = '<span class="ytc-btn-icon">📄</span><span class="ytc-btn-label">Open</span>';
        this.openButton.title = 'Open';
        this.openButton.addEventListener('click', () => this.handleOpenFile());

        const processAnotherBtn = this.secondaryActionsRow.createEl('button', {
            cls: 'ytc-action-btn ytc-primary-btn ytc-icon-only-btn',
        });
        processAnotherBtn.innerHTML = '<span class="ytc-btn-icon">🔄</span><span class="ytc-btn-label">New</span>';
        processAnotherBtn.title = 'Process New';
        processAnotherBtn.addEventListener('click', () => {
            this.showInputState();
        });

        this.processButton = container.createEl('button', { cls: 'ytc-action-btn ytc-primary-btn ytc-icon-only-btn' });
        this.processButton.innerHTML = `<span class="ytc-btn-icon">✨</span><span class="ytc-btn-label">${MESSAGES.MODALS.PROCESS}</span>`;
        this.processButton.addClass('ytc-process-btn');
        this.processButton.title = MESSAGES.MODALS.PROCESS;
        this.processButton.addEventListener('click', () => this.handleProcess());

        this.updateProcessButtonState();
    }

    private showInputState(): void {
        if (this.processButton) {
            this.processButton.classList.add('is-visible');
            this.processButton.disabled = false;
            this.processButton.innerHTML = `<span class="ytc-btn-icon">✨</span><span class="ytc-btn-label">${MESSAGES.MODALS.PROCESS}</span>`;
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.classList.remove('is-visible');
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
        this.validationMessage.classList.remove(
            'ytc-validation-error',
            'ytc-validation-success',
            'ytc-validation-info',
        );

        if (type === 'error') {
            this.validationMessage.classList.add('ytc-validation-error');
        } else if (type === 'success') {
            this.validationMessage.classList.add('ytc-validation-success');
        } else {
            this.validationMessage.classList.add('ytc-validation-info');
        }
    }

    /**
     * Handle process button click
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
            this.progressContainer.classList.add('is-visible');
        }
        if (this.urlInput) {
            this.urlInput.disabled = true;
        }
        if (this.processButton) {
            this.processButton.classList.add('is-visible');
            this.processButton.disabled = true;
            this.processButton.innerHTML = '<span class="ytc-btn-icon">⏳</span><span class="ytc-btn-label">Processing...</span>';
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.classList.remove('is-visible');
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
            this.processButton.classList.remove('is-visible');
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.classList.add('is-visible');
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
            this.openButton.classList.remove('is-visible');
        }
        if (this.copyPathButton) {
            this.copyPathButton.classList.remove('is-visible');
        }
        if (this.progressContainer) {
            this.progressContainer.classList.remove('is-visible');
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
}
