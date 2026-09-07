/* eslint-disable max-lines */
import { BaseModal } from '../../common/base-modal';
import { ErrorHandler } from '../../../services/error-handler';
import { logger } from '../../../services/logger';
import { MESSAGES } from '../../../constants/index';
import { PROVIDER_MODEL_OPTIONS } from '../../../ai/api';
import { BatchItemResult, OutputFormat, ProcessingOptions, ProcessingResult, ProgressUpdate } from '../../../types';
import { UserPreferencesService } from '../../../services/user-preferences-service';
import { ValidationUtils } from '../../../validation';
import { FORMAT_META } from '../../../templates/format-templates';
import { formatModelNameWithMultimodal } from '../../../services/model-formatter';
import {
    BatchSummary,
    buildFailureRetry,
    EMPTY_PARSED_URLS,
    extractYouTubeUrls,
    firstCreatedFilePath,
    FORMAT_ORDER,
    formatAttribution,
    formatBatchSummary,
    formatReadyMessage,
    formatRetryLabel,
    hasTextSelection,
    isCancelledResult,
    isMultilineField,
    MAX_BATCH_URLS,
    ModalSubmission,
    noteNameFromPath,
    parseUrlInput,
    ParsedUrls,
    PROGRESS_STEPS,
    resolveProgressDetail,
    stepIndexForStage,
    summarizeBatch,
    withTimeout,
} from './youtube-modal-utils';
import { App, Notice, requestUrl } from 'obsidian';

/**
 * YouTube URL input modal component
 *
 * Runs one or many videos through the pipeline sequentially, reporting honest
 * (stage-driven) progress, and renders per-URL results with attribution.
 */

const PROCESS_BUTTON_HTML = [
    '<span class="ytc-btn-icon">✨</span>',
    `<span class="ytc-btn-label">${MESSAGES.MODALS.PROCESS}</span>`,
].join('');

/** The parts of a YouTube oEmbed answer the preview renders. */
interface PreviewMetadata {
    title?: string;
    author_name?: string;
}

export interface YouTubeUrlModalOptions {
    onProcess: (url: string, options?: ProcessingOptions) => Promise<ProcessingResult>;
    onOpenFile?: (filePath: string) => Promise<void>;
    /**
     * Called from the modal's onClose so the owner can release the single-modal
     * slot it claimed (see ModalManager). Without this, the flag set before
     * `open()` would never clear and every later open would look like a dupe.
     */
    onModalClosed?: () => void;
    initialUrl?: string;
    providers?: string[]; // available provider names
    modelOptions?: Record<string, string[]>; // mapping providerName -> models
    defaultMaxTokens?: number;
    defaultTemperature?: number;
    fetchModels?: () => Promise<Record<string, string[]>>;
    fetchModelsForProvider?: (provider: string, forceRefresh?: boolean) => Promise<string[]>;
    // Performance settings from plugin settings
    enableAutoFallback?: boolean;
}

export class YouTubeUrlModal extends BaseModal {
    /**
     * The one modal allowed to be on screen. Ribbon, command palette, clipboard
     * watcher and the obsidian:// handler can all race to open one, and stacked
     * modals fight over the same scope handlers.
     */
    private static activeInstance?: YouTubeUrlModal;

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
    private videoPreviewContainer?: HTMLDivElement;
    private providerSelect?: HTMLSelectElement;
    private modelSelect?: HTMLSelectElement;
    private selectedProvider?: string;
    private selectedModel?: string;
    private progressContainer?: HTMLDivElement;
    private progressBar?: HTMLDivElement;
    private progressBarTrack?: HTMLDivElement;
    private progressText?: HTMLDivElement;
    private validationMessage?: HTMLDivElement;
    private urlCountHint?: HTMLDivElement;
    private stageEls: HTMLElement[] = [];
    private resultContainer?: HTMLDivElement;
    private retryButton?: HTMLButtonElement;
    private copyErrorButton?: HTMLButtonElement;
    private clearInstructionsButton?: HTMLButtonElement;
    private userInstructionsTextarea?: HTMLTextAreaElement;
    private userInstructions = '';
    private isProcessing = false;
    private processedFilePath?: string;
    private timerInterval?: number;
    private timerEl?: HTMLSpanElement;
    private retryAllButton?: HTMLButtonElement;

    // Timers that outlive a single render must all be reachable from onClose,
    // otherwise they fire against a DOM that no longer exists.
    private pendingTimers = new Set<number>();
    private copyPathTimer?: number;
    private dropdownFlashTimer?: number;
    private previewDebounceTimer?: number;

    // Video preview state
    /** Monotonic id of the newest preview request; only it may render. */
    private previewRequestSeq = 0;
    /** Video whose preview is currently on screen (skips a redundant refetch). */
    private previewRenderedVideoId = '';

    // Run state
    private abortController?: AbortController;
    private results: BatchItemResult[] = [];
    private lastRun?: ModalSubmission;
    private runPrefix = '';
    private lastErrorMessage = '';

    // Format dropdown
    private formatSelect?: HTMLSelectElement;

    /** One oEmbed lookup per pause in typing — never one per keystroke. */
    private static readonly PREVIEW_DEBOUNCE_MS = 400;
    /** A preview request that hangs must not pin the modal's network stack. */
    private static readonly PREVIEW_TIMEOUT_MS = 10000;

    constructor(
        app: App,
        private options: YouTubeUrlModalOptions,
    ) {
        super(app);

        this.url = options.initialUrl ?? '';

        // Load smart defaults from user preferences
        const smartDefaults = UserPreferencesService.getSmartDefaultPerformanceSettings();
        const lastProvider = UserPreferencesService.getSmartDefaultProvider() ?? 'Google Gemini';
        const lastFormat = UserPreferencesService.getSmartDefaultFormat() ?? 'executive-summary';

        const preferredModel = UserPreferencesService.getPreference('preferredModel');
        const lastModel = UserPreferencesService.getPreference('lastModel');

        this.selectedProvider = lastProvider ?? 'Google Gemini';
        this.selectedModel = preferredModel ?? lastModel ?? 'gemini-2.5-pro';
        this.format = lastFormat;

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
        const incumbent = YouTubeUrlModal.activeInstance;
        if (incumbent && incumbent !== this) {
            // Ribbon, command palette and clipboard intake can all fire in the
            // same tick; a second modal would only fight over the first one's
            // scope handlers, so refuse it instead of stacking.
            logger.warn('[YT-CLIPPER] A YouTube modal is already open — ignoring duplicate open', 'Modal');
            new Notice('📝 YouTube to Note is already open — finish or close that one first.');
            // Obsidian is still mid-open() here, so the close has to wait for it
            // to finish before the backdrop can be torn down cleanly.
            this.later(() => this.close(), 0);
            return;
        }
        YouTubeUrlModal.activeInstance = this;

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
        iconSpan.innerHTML =
            '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" width="24" height="24"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a1a2e"/><stop offset="100%" stop-color="#16213e"/></linearGradient></defs><rect width="128" height="128" rx="24" fill="url(#bg)"/><g transform="translate(22, 16)"><rect width="60" height="76" rx="6" fill="#fff" opacity="0.95"/><rect x="8" y="12" width="44" height="3" rx="1.5" fill="#1a1a2e" opacity="0.5"/><rect x="8" y="22" width="36" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="32" width="40" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="42" width="30" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="52" width="38" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/><rect x="8" y="62" width="24" height="3" rx="1.5" fill="#1a1a2e" opacity="0.35"/></g><g transform="translate(72, 72)"><rect width="44" height="32" rx="10" fill="#FF0000"/><polygon points="18,8 18,24 32,16" fill="#fff"/></g></svg>';
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
        this.urlInput.placeholder = 'Paste YouTube URL(s) here...';
        this.urlInput.setAttribute('aria-label', 'YouTube URL Input');

        this.pasteButton = inputWrapper.createEl('button', { cls: 'ytc-paste-btn-integrated' });
        this.pasteButton.innerHTML = '📋 Paste';
        this.pasteButton.setAttribute('aria-label', 'Paste URL from clipboard');
        this.pasteButton.title = 'Paste from clipboard';

        this.pasteButton.addEventListener('click', e => {
            e.preventDefault();
            void this.handleSmartPaste();
        });

        this.urlCountHint = urlContainer.createDiv('ytc-url-count-hint');
        this.urlCountHint.setAttribute('aria-live', 'polite');

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

        FORMAT_ORDER.forEach(format => {
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

        this.createUserInstructionsSection(aiContent);
    }

    /**
     * User instructions survive across runs (so a retry or a follow-up video
     * keeps the same direction); they are only cleared explicitly, or when the
     * user starts over with a fresh video ("New").
     */
    private createUserInstructionsSection(aiContent: HTMLElement): void {
        const wrapper = aiContent.createDiv('ytc-user-instructions-wrapper');

        const headerRow = wrapper.createDiv('ytc-user-instructions-header');
        headerRow.style.display = 'flex';
        headerRow.style.alignItems = 'center';
        headerRow.style.justifyContent = 'space-between';

        const label = headerRow.createEl('label');
        label.textContent = 'USER INSTRUCTIONS (optional)';
        label.addClass('ytc-field-label');

        this.clearInstructionsButton = headerRow.createEl('button');
        this.clearInstructionsButton.type = 'button';
        this.clearInstructionsButton.textContent = '✖ Clear';
        this.clearInstructionsButton.title = 'Clear instructions';
        this.clearInstructionsButton.setAttribute('aria-label', 'Clear user instructions');
        this.clearInstructionsButton.style.cssText = [
            'background: none',
            'border: none',
            'cursor: pointer',
            'font-size: 11px',
            'color: var(--text-muted)',
            'padding: 0 2px',
        ].join(';');
        this.clearInstructionsButton.addEventListener('click', () => this.clearUserInstructions());

        this.userInstructionsTextarea = wrapper.createEl('textarea', {
            cls: 'ytc-user-instructions-textarea',
        });
        this.userInstructionsTextarea.placeholder =
            "E.g., 'Focus on specific aspects...', 'Include code examples', 'Highlight the debate about...'";
        this.userInstructionsTextarea.rows = 2;
        this.userInstructionsTextarea.setAttribute('aria-label', 'User Instructions');
        this.userInstructionsTextarea.addEventListener('input', () => {
            this.userInstructions = this.userInstructionsTextarea?.value ?? '';
            this.updateClearInstructionsVisibility();
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
        this.updateClearInstructionsVisibility();
    }

    private clearUserInstructions(): void {
        this.userInstructions = '';
        if (this.userInstructionsTextarea) {
            this.userInstructionsTextarea.value = '';
        }
        this.updateClearInstructionsVisibility();
    }

    private updateClearInstructionsVisibility(): void {
        if (this.clearInstructionsButton) {
            this.clearInstructionsButton.style.visibility = this.userInstructions.trim() ? 'visible' : 'hidden';
        }
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

        this.videoPreviewContainer.createDiv('ytc-provider-status');
    }

    /**
     * setTimeout that onClose can clear, so no callback ever writes to a modal
     * that has already gone away.
     */
    private later(callback: () => void, delayMs: number): number {
        const id = window.setTimeout(() => {
            this.pendingTimers.delete(id);
            callback();
        }, delayMs);
        this.pendingTimers.add(id);
        return id;
    }

    private cancelLater(id: number | undefined): void {
        if (id === undefined) return;
        window.clearTimeout(id);
        this.pendingTimers.delete(id);
    }

    private clearPendingTimers(): void {
        this.pendingTimers.forEach(id => window.clearTimeout(id));
        this.pendingTimers.clear();
    }

    /**
     * Show video preview with thumbnail and metadata.
     *
     * The thumbnail is a local, cheap image so it tracks the keystrokes; the
     * oEmbed lookup is debounced, token-guarded and time-capped so a slow
     * answer for an earlier video can never overwrite the current preview.
     */
    private showVideoPreview(videoId: string): void {
        if (!this.videoPreviewContainer || !this.thumbnailEl) return;

        this.videoPreviewContainer.classList.add('is-visible');

        // Clear placeholder state
        this.thumbnailEl.src = '';
        if (this.videoTitleEl) this.videoTitleEl.textContent = '';
        if (this.videoChannelEl) this.videoChannelEl.textContent = '';
        if (this.videoDurationEl) this.videoDurationEl.textContent = '';

        this.thumbnailEl.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        this.cancelLater(this.previewDebounceTimer);
        const token = ++this.previewRequestSeq;
        this.previewDebounceTimer = this.later(() => {
            this.previewDebounceTimer = undefined;
            if (token !== this.previewRequestSeq) return; // superseded while waiting
            void this.loadVideoPreview(videoId);
        }, YouTubeUrlModal.PREVIEW_DEBOUNCE_MS);
    }

    /**
     * Fetch the preview metadata over Obsidian's CORS-free `requestUrl`.
     * Never throws; a failure just leaves the thumbnail-only preview.
     */
    private async loadVideoPreview(videoId: string): Promise<void> {
        if (this.previewRenderedVideoId === videoId) return; // already on screen

        const token = this.previewRequestSeq;
        const isCurrent = () => token === this.previewRequestSeq;

        try {
            const response = await withTimeout(
                requestUrl({
                    url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
                    method: 'GET',
                    throw: false,
                }),
                YouTubeUrlModal.PREVIEW_TIMEOUT_MS,
            );

            // A newer keystroke owns the preview now — drop this stale answer.
            if (!isCurrent()) return;

            if (response.status === 200) {
                this.renderPreviewMetadata(videoId, response.json);
            } else {
                this.renderPreviewFallback(videoId);
            }
        } catch {
            if (isCurrent()) this.renderPreviewFallback(videoId);
        }
    }

    /** Fill in title + channel once the oEmbed answer is in. */
    private renderPreviewMetadata(videoId: string, data: PreviewMetadata): void {
        this.previewRenderedVideoId = videoId;
        if (this.videoTitleEl) {
            this.videoTitleEl.textContent = data.title ?? 'Unknown Title';
        }
        if (this.videoChannelEl) {
            this.videoChannelEl.textContent = `📺 ${data.author_name ?? 'Unknown Channel'}`;
        }
        if (this.videoDurationEl) {
            this.videoDurationEl.textContent = '';
        }
    }

    /** No metadata (bad status / request failure) — keep the thumbnail, say why. */
    private renderPreviewFallback(videoId: string): void {
        this.previewRenderedVideoId = videoId;
        if (this.videoTitleEl) {
            this.videoTitleEl.textContent = 'Video Preview';
        }
    }

    private hideVideoPreview(): void {
        this.previewRenderedVideoId = '';
        if (this.videoPreviewContainer) {
            this.videoPreviewContainer.classList.remove('is-visible');
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
            this.cancelLater(this.dropdownFlashTimer);
            this.dropdownFlashTimer = this.later(() => {
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

        this.createStageChecklist(this.progressContainer);

        const progressBarContainer = this.progressContainer.createDiv('ytc-progress-bar-track');
        progressBarContainer.setAttribute('role', 'progressbar');
        progressBarContainer.setAttribute('aria-valuemin', '0');
        progressBarContainer.setAttribute('aria-valuemax', '100');
        progressBarContainer.setAttribute('aria-labelledby', 'progress-text');

        this.progressBarTrack = progressBarContainer;
        this.progressBar = progressBarContainer.createDiv('ytc-progress-bar-fill');

        this.resultContainer = this.progressContainer.createDiv('ytc-progress-result');
    }

    /** '📡 Metadata → 📝 Transcript → 🧠 AI → 💾 Save' checklist, advanced by onProgress. */
    private createStageChecklist(parent: HTMLElement): void {
        const list = parent.createDiv('ytc-progress-stages');
        list.style.display = 'flex';
        list.style.gap = '10px';
        list.style.flexWrap = 'wrap';
        list.style.marginBottom = '6px';
        list.style.fontSize = '12px';

        this.stageEls = PROGRESS_STEPS.map(step => {
            const el = list.createSpan('ytc-progress-stage');
            el.setAttribute('data-step', step.key);
            el.textContent = `${step.icon} ${step.label}`;
            this.setStepState(el, 'pending');
            return el;
        });
    }

    private setStepState(el: HTMLElement, state: 'pending' | 'active' | 'done'): void {
        const styles: Record<typeof state, string> = {
            pending: 'color: var(--text-muted); opacity: 0.55; font-weight: 400;',
            active: 'color: var(--ytc-accent, #00b894); opacity: 1; font-weight: 600;',
            done: 'color: var(--text-muted); opacity: 0.9; font-weight: 400;',
        };
        el.style.cssText = styles[state];
    }

    private resetStageChecklist(): void {
        this.stageEls.forEach(el => this.setStepState(el, 'pending'));
    }

    /** Advance the checklist to `activeIndex`, marking earlier steps done. */
    private setActiveStep(activeIndex: number): void {
        this.stageEls.forEach((el, index) => {
            if (index < activeIndex) {
                this.setStepState(el, 'done');
                if (!el.textContent?.startsWith('✓')) el.textContent = `✓ ${el.textContent ?? ''}`;
            } else {
                this.setStepState(el, index === activeIndex ? 'active' : 'pending');
                if (index > activeIndex && el.textContent?.startsWith('✓')) {
                    el.textContent = el.textContent.replace('✓ ', '');
                }
            }
        });
    }

    private markAllStepsDone(): void {
        this.stageEls.forEach(el => {
            this.setStepState(el, 'done');
            if (!el.textContent?.startsWith('✓')) el.textContent = `✓ ${el.textContent ?? ''}`;
        });
    }

    private createActionButtons(): void {
        const container = this.contentEl.createDiv('ytc-actions-row');

        const cancelBtn = container.createEl('button', { cls: 'ytc-action-btn ytc-ghost-btn' });
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            if (this.isProcessing) {
                this.abortController?.abort();
            }
            this.close();
        });

        container.createDiv('ytc-actions-spacer');

        this.secondaryActionsRow = container.createDiv('ytc-secondary-actions');

        this.copyPathButton = this.secondaryActionsRow.createEl('button', {
            cls: 'ytc-action-btn ytc-secondary-btn ytc-icon-only-btn',
        });
        this.copyPathButton.innerHTML =
            '<span class="ytc-btn-icon">📋</span><span class="ytc-btn-label">Copy Path</span>';
        this.copyPathButton.title = 'Copy Path';
        this.copyPathButton.addEventListener('click', () => this.handleCopyPath());

        this.openButton = this.secondaryActionsRow.createEl('button', {
            cls: 'ytc-action-btn ytc-secondary-btn ytc-icon-only-btn',
        });
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
        this.processButton.innerHTML = PROCESS_BUTTON_HTML;
        this.processButton.addClass('ytc-process-btn');
        this.processButton.title = MESSAGES.MODALS.PROCESS;
        this.processButton.addEventListener('click', () => this.handleProcess());

        this.updateProcessButtonState();
    }

    private showInputState(): void {
        this.isProcessing = false;
        this.stopTimer();
        if (this.processButton) {
            this.processButton.classList.add('is-visible');
            this.processButton.disabled = false;
            this.processButton.innerHTML = PROCESS_BUTTON_HTML;
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
        if (this.progressContainer) {
            this.progressContainer.classList.remove('is-visible');
        }
        if (this.resultContainer) {
            this.resultContainer.empty();
        }
        this.retryButton = undefined;
        this.retryAllButton = undefined;
        this.copyErrorButton = undefined;
        this.lastErrorMessage = '';
        this.results = [];
        this.lastRun = undefined;
        this.processedFilePath = '';
        this.updateProcessButtonState();
        this.focusUrlInput();
    }

    private setupEventHandlers(): void {
        this.scope.register([], 'Enter', () => {
            // In a multi-line field Enter means "new line" — starting a run
            // instead would make the instructions box impossible to type in.
            if (isMultilineField(document.activeElement)) return true;

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
            // Selected text must stay copyable — only offer the note path when
            // there is nothing selected to copy instead.
            if (hasTextSelection()) return true;

            if (document.activeElement !== this.urlInput && this.processedFilePath) {
                void this.handleCopyPath();
                return false;
            }
            return true;
        });

        this.scope.register(['Ctrl', 'Shift'], 'v', async () => {
            try {
                const clipText = await navigator.clipboard.readText();
                const urls = extractYouTubeUrls(clipText);
                if (this.urlInput && urls.length > 0) {
                    this.setUrl(urls.join(' '));
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

        const parsed = parseUrlInput(this.url);
        const hasUrls = parsed.urls.length > 0;

        this.processButton.disabled = !hasUrls || this.isProcessing;
        this.processButton.style.opacity = this.processButton.disabled ? '0.5' : '1';

        this.updateUrlCountHint(parsed);

        if (this.url.trim().length === 0) {
            this.setValidationMessage('Paste a YouTube link to begin processing.', 'info');
            this.hideVideoPreview();
            return;
        }

        if (!hasUrls) {
            this.setValidationMessage('Enter a valid YouTube video URL.', 'error');
            this.hideVideoPreview();
            return;
        }

        this.setValidationMessage(formatReadyMessage(parsed), parsed.droppedCount > 0 ? 'error' : 'success');

        const videoId = ValidationUtils.extractVideoId(parsed.urls[0] ?? '');
        if (videoId) {
            this.showVideoPreview(videoId);
        }
    }

    /** Small live hint while typing, e.g. '🎬 3 videos detected — one at a time.' */
    private updateUrlCountHint(parsed: ParsedUrls): void {
        if (!this.urlCountHint) return;

        const parts: string[] = [];
        if (parsed.urls.length > 1) {
            parts.push(`🎬 ${parsed.urls.length} videos detected — they'll be processed one at a time.`);
        }
        if (parsed.invalidCount > 0 && this.url.trim().length > 0) {
            parts.push(`⚠️ ${parsed.invalidCount} entr${parsed.invalidCount === 1 ? 'y' : 'ies'} not recognized.`);
        }
        if (parsed.droppedCount > 0) {
            parts.push(`🚫 ${parsed.droppedCount} more over the ${MAX_BATCH_URLS}-video limit.`);
        }

        this.urlCountHint.textContent = parts.join(' ');
        this.urlCountHint.style.cssText = parts.length
            ? 'font-size: 12px; color: var(--text-muted); margin-top: 4px;'
            : '';
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
        if (this.isProcessing) return;

        const parsed = parseUrlInput(this.url);
        if (parsed.urls.length === 0) {
            new Notice(this.url.trim() ? MESSAGES.ERRORS.INVALID_URL : MESSAGES.ERRORS.ENTER_URL);
            this.focusUrlInput();
            return;
        }

        if (parsed.droppedCount > 0) {
            // Never silently shorten a batch the user pasted in good faith.
            new Notice(
                `🚫 ${MAX_BATCH_URLS}-video limit — ${parsed.droppedCount} URL${parsed.droppedCount === 1 ? '' : 's'} will not be processed.`,
            );
        }

        this.format = (this.formatSelect?.value as OutputFormat) ?? 'executive-summary';
        this.selectedProvider = this.providerSelect?.value;
        this.selectedModel = this.modelSelect?.value;

        const submission: ModalSubmission = {
            urls: parsed.urls,
            format: this.format,
            model: this.selectedModel,
            instructions: this.userInstructions,
        };
        this.lastRun = submission;

        await this.runSubmission(submission);
    }

    /**
     * Run every URL of a submission, one at a time, sharing the progress UI.
     *
     * `preserved` carries earlier successes into the run (a failures-only retry
     * passes them back in) so the batch view keeps showing what already saved.
     */
    private async runSubmission(submission: ModalSubmission, preserved: BatchItemResult[] = []): Promise<void> {
        this.abortController = new AbortController();
        this.results = [...preserved];
        this.processedFilePath = firstCreatedFilePath(preserved);
        this.runPrefix = submission.urls.length > 1 ? `1/${submission.urls.length}: ` : '';
        this.showProcessingState(submission.urls.length);

        for (let index = 0; index < submission.urls.length; index++) {
            if (await this.processNext(index, submission)) {
                this.showCancelledState();
                return;
            }
        }

        const firstFailure = this.results.find(item => !item.result.success);
        if (firstFailure) {
            // Whatever did succeed stays reachable (Open / Copy Path) from the
            // error view instead of being lost with the run.
            this.processedFilePath = firstCreatedFilePath(this.results);
            this.showErrorState(new Error(firstFailure.result.error ?? MESSAGES.ERRORS.AI_PROCESSING('failed')));
            return;
        }

        this.showCompletionState();
    }

    /** Runs the URL at `index`; returns true when the run was cancelled and must stop. */
    private async processNext(index: number, submission: ModalSubmission): Promise<boolean> {
        if (this.abortController?.signal.aborted) return true;

        const url = submission.urls[index];
        if (!url) return false;

        this.runPrefix = submission.urls.length > 1 ? `${index + 1}/${submission.urls.length}: ` : '';
        this.resetStageChecklist();

        const result = await this.processOne(url, submission);
        this.results.push({ url, result });

        return !result.success && this.isCancellation(result);
    }

    /** Never throws — a pipeline failure becomes a failed ProcessingResult. */
    private async processOne(url: string, submission: ModalSubmission): Promise<ProcessingResult> {
        try {
            return await this.options.onProcess(url, {
                format: submission.format,
                model: submission.model,
                userInstructions: submission.instructions,
                onProgress: update => this.handleProgressUpdate(update),
                signal: this.abortController?.signal,
            });
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private isCancellation(result: ProcessingResult): boolean {
        return isCancelledResult(result.error, this.abortController?.signal.aborted === true);
    }

    private handleProgressUpdate(update: ProgressUpdate): void {
        const stepIndex = stepIndexForStage(update.stage);
        this.setActiveStep(stepIndex);

        if (this.progressText) {
            this.progressText.textContent = `${this.runPrefix}${resolveProgressDetail(update)}`;
        }

        this.setProgressBar(stepIndex, update.percent);
    }

    /**
     * Stage-driven bar: it advances as stages complete. A numeric `percent` is
     * only used when the pipeline actually knows one — never invented here.
     */
    private setProgressBar(stepIndex: number, percent?: number): void {
        if (!this.progressBar) return;

        const known = typeof percent === 'number' && percent >= 0;
        const width = known ? Math.min(100, percent) : (stepIndex / PROGRESS_STEPS.length) * 100;
        this.progressBar.style.width = `${width}%`;

        if (this.progressBarTrack) {
            if (known) {
                this.progressBarTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
            } else {
                this.progressBarTrack.removeAttribute('aria-valuenow');
            }
        }
    }

    private showProcessingState(videoCount: number): void {
        this.isProcessing = true;
        if (this.progressContainer) {
            this.progressContainer.classList.add('is-visible');
        }
        if (this.resultContainer) {
            this.resultContainer.empty();
        }
        this.retryButton = undefined;
        this.retryAllButton = undefined;
        this.copyErrorButton = undefined;
        if (this.urlInput) {
            this.urlInput.disabled = true;
        }
        if (this.processButton) {
            this.processButton.classList.add('is-visible');
            this.processButton.disabled = true;
            this.processButton.innerHTML =
                '<span class="ytc-btn-icon">⏳</span><span class="ytc-btn-label">Processing...</span>';
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.classList.remove('is-visible');
        }
        if (this.headerEl && videoCount > 1) {
            this.headerEl.textContent = `⏳ Processing ${videoCount} videos…`;
        }

        this.resetStageChecklist();
        if (this.progressText) {
            this.progressText.textContent = `${this.runPrefix}Starting…`;
        }
        this.startTimer();
    }

    private startTimer(): void {
        this.stopTimer();
        const startTime = Date.now();
        if (this.timerEl) this.timerEl.textContent = '0.0s';

        this.timerInterval = window.setInterval(() => {
            if (this.timerEl) {
                const elapsed = (Date.now() - startTime) / 1000;
                this.timerEl.textContent = `${elapsed.toFixed(1)}s`;
            }
        }, 100);
    }

    private stopTimer(): void {
        if (this.timerInterval) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = undefined;
        }
    }

    private showCompletionState(): void {
        this.isProcessing = false;
        this.stopTimer();
        this.markAllStepsDone();
        this.setProgressBar(PROGRESS_STEPS.length, 100);

        if (this.urlInput) {
            this.urlInput.disabled = false;
            this.urlInput.value = '';
        }
        this.url = '';
        this.updateUrlCountHint(EMPTY_PARSED_URLS);

        if (this.processButton) {
            this.processButton.classList.remove('is-visible');
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.classList.add('is-visible');
        }

        const lastCreated = [...this.results].reverse().find(item => item.result.filePath)?.result.filePath;
        if (lastCreated) {
            this.processedFilePath = lastCreated;
        }

        if (this.headerEl) {
            this.headerEl.textContent =
                this.results.length > 1
                    ? `✅ ${this.results.length} Videos Processed!`
                    : '✅ Video Processed Successfully!';
        }

        if (this.results.length > 1) {
            this.setValidationMessage('Notes saved. Open any of them below or process more videos.', 'success');
        } else {
            this.setValidationMessage('Note saved. You can open it now or process another video.', 'success');
        }

        this.renderResultDetails();
        this.focusUrlInput();
    }

    /** Attribution, fallbacks, warnings and the batch list — muted, under the bar. */
    private renderResultDetails(): void {
        if (!this.resultContainer) return;
        this.resultContainer.empty();

        if (this.results.length > 1) {
            this.renderBatchSummary(this.resultContainer, summarizeBatch(this.results));
            const list = this.resultContainer.createDiv('ytc-batch-list');
            this.results.forEach((item, index) => this.renderBatchRow(list, item, index));
            return;
        }

        const item = this.results[0];
        if (item) {
            this.renderSuccessDetails(this.resultContainer, item.result);
        }
    }

    private renderBatchSummary(parent: HTMLElement, summary: BatchSummary): void {
        const line = parent.createDiv('ytc-batch-summary');
        line.textContent = formatBatchSummary(summary);
        line.style.cssText = 'font-size: 13px; font-weight: 600; margin: 8px 0 4px;';
    }

    private renderBatchRow(parent: HTMLElement, item: BatchItemResult, index: number): void {
        const row = parent.createDiv('ytc-batch-row');
        row.style.cssText = 'display: flex; align-items: baseline; gap: 6px; font-size: 12px; margin-top: 4px;';

        const result = item.result;
        const icon = !result.success ? '❌' : result.duplicateOfPath ? '⚠️' : '✅';
        const label = row.createSpan();
        label.style.flexShrink = '0';
        label.textContent = `${index + 1}. ${icon}`;

        if (result.success && result.filePath) {
            this.createNoteLink(row, result.filePath);
            const attribution = formatAttribution(result);
            if (attribution) {
                const meta = row.createSpan();
                meta.textContent = `· 🧠 ${attribution}`;
                meta.style.color = 'var(--text-muted)';
            }
        } else if (result.success) {
            const fallback = row.createSpan();
            fallback.textContent = 'Note created';
        } else {
            const failure = row.createSpan();
            failure.textContent = `${item.url} — ${result.error ?? 'Processing failed'}`;
            failure.style.color = 'var(--text-muted)';
        }

        if (result.duplicateOfPath) {
            const dup = row.createSpan();
            dup.style.color = 'var(--text-muted)';
            dup.appendText(' · 📑 earlier note: ');
            this.createNoteLink(row, result.duplicateOfPath, noteNameFromPath(result.duplicateOfPath));
        }

        result.warnings?.forEach(warning => this.createDetailLine(parent, `⚠️ ${warning}`));
    }

    private renderSuccessDetails(parent: HTMLElement, result: ProcessingResult): void {
        const details = parent.createDiv('ytc-result-details');

        const attribution = formatAttribution(result);
        if (attribution) {
            this.createDetailLine(details, `🧠 Generated with ${attribution}`);
        }

        if (result.failedProviders && result.failedProviders.length > 0) {
            this.createDetailLine(details, `↩️ Fell back from: ${result.failedProviders.join(', ')}`);
        }

        if (result.transcriptTruncated) {
            this.createDetailLine(details, '✂️ Transcript was truncated to fit the prompt budget');
        }

        result.warnings?.forEach(warning => this.createDetailLine(details, `⚠️ ${warning}`));

        if (result.duplicateOfPath) {
            const line = this.createDetailLine(details, '📑 Already processed before — new note created anyway');
            line.appendText(' ');
            this.createNoteLink(line, result.duplicateOfPath, noteNameFromPath(result.duplicateOfPath));
        }
    }

    private createDetailLine(parent: HTMLElement, text: string): HTMLDivElement {
        const line = parent.createDiv('ytc-detail-line');
        line.textContent = text;
        line.style.cssText = 'font-size: 12px; color: var(--text-muted); margin-top: 4px;';
        return line;
    }

    /** Clickable link to a note in the vault (opened through onOpenFile). */
    private createNoteLink(parent: HTMLElement, filePath: string, label?: string): void {
        const link = parent.createEl('a', { text: label ?? noteNameFromPath(filePath) });
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.title = filePath;
        link.style.cssText = 'cursor: pointer; text-decoration: underline;';
        const open = () => void this.openNote(filePath);
        link.addEventListener('click', open);
        link.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    }

    private async openNote(filePath: string): Promise<void> {
        if (!this.options.onOpenFile) return;
        try {
            await this.options.onOpenFile(filePath);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Opening file');
        }
    }

    private showErrorState(error: Error): void {
        this.isProcessing = false;
        this.stopTimer();
        this.lastErrorMessage = error.message;

        if (this.urlInput) {
            this.urlInput.disabled = false;
        }
        if (this.processButton) {
            this.processButton.disabled = false;
            this.processButton.style.opacity = '1';
            this.processButton.classList.add('is-visible');
            this.processButton.innerHTML = PROCESS_BUTTON_HTML;
        }
        if (this.openButton) {
            this.openButton.classList.remove('is-visible');
        }
        if (this.copyPathButton) {
            this.copyPathButton.classList.remove('is-visible');
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.classList.remove('is-visible');
        }
        if (this.progressContainer) {
            this.progressContainer.classList.add('is-visible');
        }
        if (this.headerEl) {
            this.headerEl.textContent = '❌ Processing Failed';
        }

        this.renderErrorDetails();
        this.setValidationMessage(error.message, 'error');
    }

    private renderErrorDetails(): void {
        if (!this.resultContainer) return;
        this.resultContainer.empty();

        const failures = this.results.filter(item => !item.result.success);

        if (failures.length < this.results.length) {
            // Partial successes stay visible — and clickable — above the failure,
            // so a batch that got halfway is never a dead end.
            this.renderBatchSummary(this.resultContainer, summarizeBatch(this.results));
            const list = this.resultContainer.createDiv('ytc-batch-list');
            this.results.forEach((item, index) => this.renderBatchRow(list, item, index));
        } else if (this.results.length > 1) {
            this.createDetailLine(this.resultContainer, `✅ 0 of ${this.results.length} finished before this failure.`);
        }

        const message = this.createDetailLine(this.resultContainer, `❌ ${this.lastErrorMessage}`);
        message.style.color = 'var(--text-error, #d63031)';

        const actions = this.resultContainer.createDiv('ytc-error-actions');
        actions.style.cssText = 'display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;';

        this.retryButton = actions.createEl('button', { cls: 'ytc-action-btn ytc-secondary-btn' });
        this.retryButton.innerHTML = [
            '<span class="ytc-btn-icon">🔄</span>',
            `<span class="ytc-btn-label">${formatRetryLabel(failures.length)}</span>`,
        ].join('');
        this.retryButton.title = 'Retry only the videos that failed — notes already created are kept';
        this.retryButton.addEventListener('click', () => void this.handleRetry());

        // A full re-run is only distinguishable from a retry when something
        // already succeeded; otherwise the two buttons would do the same thing.
        if (failures.length < this.results.length) {
            this.retryAllButton = actions.createEl('button', { cls: 'ytc-action-btn ytc-secondary-btn' });
            this.retryAllButton.innerHTML =
                '<span class="ytc-btn-icon">🔁</span><span class="ytc-btn-label">Retry all</span>';
            this.retryAllButton.title = 'Re-run every video, including the ones that already saved';
            this.retryAllButton.addEventListener('click', () => void this.handleRetryAll());
        }

        this.copyErrorButton = actions.createEl('button', { cls: 'ytc-action-btn ytc-secondary-btn' });
        this.copyErrorButton.innerHTML =
            '<span class="ytc-btn-icon">📋</span><span class="ytc-btn-label">Copy error</span>';
        this.copyErrorButton.title = 'Copy the error message';
        this.copyErrorButton.addEventListener('click', () => void this.handleCopyError());
    }

    /** Re-run only the failed URLs of the last run, keeping what already saved. */
    private async handleRetry(): Promise<void> {
        if (!this.lastRun || this.isProcessing) return;

        const submission = buildFailureRetry(this.lastRun, this.results);
        if (!submission) {
            new Notice('🎉 Nothing left to retry — every video already succeeded.');
            return;
        }

        this.applySubmissionToControls(submission);
        await this.runSubmission(
            submission,
            this.results.filter(item => item.result.success),
        );
    }

    /** Re-run the exact same submission (same URLs, format, model, instructions). */
    private async handleRetryAll(): Promise<void> {
        if (!this.lastRun || this.isProcessing || this.lastRun.urls.length === 0) return;
        this.applySubmissionToControls(this.lastRun);
        await this.runSubmission(this.lastRun);
    }

    private applySubmissionToControls(submission: ModalSubmission): void {
        this.format = submission.format;
        if (this.formatSelect) {
            this.formatSelect.value = submission.format;
        }
        this.userInstructions = submission.instructions;
        if (this.userInstructionsTextarea) {
            this.userInstructionsTextarea.value = submission.instructions;
        }
        this.updateClearInstructionsVisibility();
        if (submission.model && this.modelSelect) {
            this.modelSelect.value = submission.model;
            this.selectedModel = submission.model;
        }
    }

    private async handleCopyError(): Promise<void> {
        try {
            await navigator.clipboard.writeText(this.lastErrorMessage);
            this.flashButtonLabel(this.copyErrorButton, '✅ Copied!');
        } catch {
            if (this.copyErrorWithFallback()) {
                this.flashButtonLabel(this.copyErrorButton, '✅ Copied!');
            } else {
                new Notice('❌ Could not copy the error message');
            }
        }
    }

    /** Clipboard API fallback for environments where writeText is unavailable. */
    private copyErrorWithFallback(): boolean {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = this.lastErrorMessage;
            textarea.setAttribute('readonly', 'true');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand('copy');
            textarea.remove();
            return copied;
        } catch {
            return false;
        }
    }

    private flashButtonLabel(button: HTMLButtonElement | undefined, text: string): void {
        if (!button) return;
        const original = button.innerHTML;
        button.textContent = text;
        this.later(() => {
            if (button.isConnected) {
                button.innerHTML = original;
            }
        }, 1500);
    }

    private showCancelledState(): void {
        this.isProcessing = false;
        this.stopTimer();
        if (this.progressContainer) {
            this.progressContainer.classList.remove('is-visible');
        }
        if (this.urlInput) {
            this.urlInput.disabled = false;
        }
        if (this.processButton) {
            this.processButton.disabled = false;
            this.processButton.style.opacity = '1';
            this.processButton.innerHTML = PROCESS_BUTTON_HTML;
        }
        // Deliberately no error Notice — cancelling is not a failure.
        this.setValidationMessage('⏹️ Processing cancelled.', 'info');
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
                    this.cancelLater(this.copyPathTimer);
                    this.copyPathTimer = this.later(() => {
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

    /**
     * Paste from clipboard, pulling YouTube URLs out of surrounding prose
     * ('see https://youtu.be/x here') as well as plain single URLs.
     */
    private async handleSmartPaste(): Promise<void> {
        try {
            const text = await navigator.clipboard.readText();
            const urls = extractYouTubeUrls(text);

            if (urls.length === 0) {
                new Notice('No YouTube URL found in clipboard');
                this.focusUrlInput();
                return;
            }

            this.setUrl(urls.join(' '));

            const isExact = ValidationUtils.isValidYouTubeUrl(text.trim());
            if (isExact) {
                new Notice('YouTube URL detected and pasted!');
            } else if (urls.length === 1) {
                new Notice('YouTube URL extracted from clipboard!');
            } else {
                new Notice(`🎬 ${urls.length} YouTube URLs extracted from clipboard!`);
            }

            if (this.processButton && !this.isProcessing && this.processButton.disabled === false) {
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
        this.stopTimer();
        this.cancelLater(this.copyPathTimer);
        this.cancelLater(this.dropdownFlashTimer);
        this.cancelLater(this.previewDebounceTimer);
        this.clearPendingTimers();
        // Abort (and keep) the controller so an in-flight run stops instead of
        // marching on against a DOM that no longer exists.
        this.abortController?.abort();
        if (YouTubeUrlModal.activeInstance === this) {
            YouTubeUrlModal.activeInstance = undefined;
        }
        // Hand the single-modal slot back (ModalManager) before the DOM goes.
        this.options.onModalClosed?.();
        super.onClose();
    }
}
