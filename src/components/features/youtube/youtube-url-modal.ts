import { BaseModal } from '../../common/base-modal';
import { ErrorHandler } from '../../../services/error-handler';
import { MESSAGES } from '../../../constants/index';
import { PROVIDER_MODEL_OPTIONS } from '../../../ai/api';
import { OutputFormat, PerformanceMode } from '../../../types';
import { UserPreferencesService, UserPreferences } from '../../../services/user-preferences-service';
import { ValidationUtils } from '../../../validation';
import { App, Notice } from 'obsidian';

/**
 * YouTube URL input modal component
 */

export interface YouTubeUrlModalOptions {
    onProcess: (url: string, format: OutputFormat, provider?: string, model?: string, customPrompt?: string, performanceMode?: PerformanceMode, enableParallel?: boolean, preferMultimodal?: boolean, maxTokens?: number, temperature?: number, enableAutoFallback?: boolean) => Promise<string>; // Return file path
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
    onPerformanceSettingsChange?: (performanceMode: PerformanceMode, enableParallel: boolean, preferMultimodal: boolean) => Promise<void>;
}

type StepState = 'pending' | 'active' | 'complete' | 'error';

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
    private progressSteps: { label: string; element: HTMLLIElement }[] = [];
    private currentStepIndex = 0;
    private isProcessing = false;
    private processedFilePath?: string;
    private customPromptInput?: HTMLTextAreaElement;
    private customPromptContainer?: HTMLDivElement;
    private refreshButton?: HTMLButtonElement;

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
        private options: YouTubeUrlModalOptions
    ) {
        super(app);

        this.url = options.initialUrl || '';

        // Initialize theme from localStorage
        const savedTheme = localStorage.getItem('ytc-theme-mode');
        this.isLightTheme = savedTheme === 'light'; // Default to dark if not set

        // Load smart defaults from user preferences
        const smartDefaults = UserPreferencesService.getSmartDefaultPerformanceSettings();
        const smartModelParams = UserPreferencesService.getSmartDefaultModelParameters();
        const lastProvider = UserPreferencesService.getSmartDefaultProvider();
        const lastFormat = UserPreferencesService.getSmartDefaultFormat();
        const smartAutoFallback = UserPreferencesService.getSmartDefaultAutoFallback();

        // Check for user-set preferred model, falling back to last used
        const preferredModel = UserPreferencesService.getPreference('preferredModel');
        const lastModel = UserPreferencesService.getPreference('lastModel');

        // Set default provider and model values based on user history
        // Preferred settings take priority over last used
        this.selectedProvider = lastProvider || 'Google Gemini';
        this.selectedModel = preferredModel || lastModel || 'gemini-2.5-pro';
        this.format = lastFormat;
        this.autoFallbackEnabled = smartAutoFallback;

        // Track usage for smart suggestions (will be updated again on actual processing)
        UserPreferencesService.updateLastUsed({
            format: lastFormat,
            provider: this.selectedProvider,
            model: this.selectedModel,
            maxTokens: options.defaultMaxTokens || 4096,
            temperature: options.defaultTemperature || 0.5,
            performanceMode: smartDefaults.mode,
            parallelProcessing: smartDefaults.parallel,
            multimodal: smartDefaults.multimodal,
        });
    }

    onOpen(): void {
        console.log('[YT-CLIPPER] YouTubeUrlModal.onOpen called');
        try {
            this.createModalContent();
            console.log('[YT-CLIPPER] Modal content created');
            this.setupEventHandlers();
            console.log('[YT-CLIPPER] Event handlers set up');
            this.setupKeyboardShortcuts();
            console.log('[YT-CLIPPER] Keyboard shortcuts set up');

            // Automatically fetch fresh models for the current provider on modal open
            this.fetchModelsForCurrentProvider();

            // If an initial URL was provided, validate and focus the appropriate control
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
            console.error('[YT-CLIPPER] Error in onOpen:', error);
            throw error;
        }
    }

    /**
     * Automatically fetch models for the current provider when modal opens
     * Always bypasses cache to get fresh models from API
     */
    private async fetchModelsForCurrentProvider(): Promise<void> {
        if (!this.options.fetchModelsForProvider || !this.selectedProvider) return;

        try {
            console.log('[YT-CLIPPER] Fetching models for provider:', this.selectedProvider);
            // Always bypass cache on modal open to get fresh models
            const models = await this.options.fetchModelsForProvider(this.selectedProvider, true);
            console.log('[YT-CLIPPER] Fetched models:', models?.length || 0);
            if (models && models.length > 0) {
                const updatedOptions = { ...this.options.modelOptions, [this.selectedProvider]: models };
                this.options.modelOptions = updatedOptions;
                this.updateModelDropdown(updatedOptions);
                console.log('[YT-CLIPPER] Updated dropdown with', models.length, 'models');
            } else {
                console.warn('[YT-CLIPPER] No models returned from API, using fallback');
                // Still update with whatever we got (empty array) to trigger fallback
                this.updateModelDropdown(this.options.modelOptions);
            }
        } catch (error) {
            // Log error and still try to update dropdown
            console.error('[YT-CLIPPER] Auto-fetch models failed:', error);
            console.warn('[YT-CLIPPER] Falling back to cached or static models');
            this.updateModelDropdown(this.options.modelOptions);
        }
    }

    /**
     * Create modal content
     */
    private createModalContent(): void {
        console.log('[YT-CLIPPER] createModalContent starting');
        try {
            this.headerEl = this.createHeader(MESSAGES.MODALS.PROCESS_VIDEO);
            console.log('[YT-CLIPPER] Header created');
            this.createUrlSection();
            console.log('[YT-CLIPPER] URL section created');
            this.createDropdownRow();
            console.log('[YT-CLIPPER] Dropdown row created');
            // Initialize dropdowns with current values
            this.updateModelDropdown(this.options.modelOptions);
            console.log('[YT-CLIPPER] Model dropdown initialized');
            this.createIconsRow();
            console.log('[YT-CLIPPER] Icons row created');
            this.createProgressSection();
            console.log('[YT-CLIPPER] Progress section created');
            this.createActionButtons();
            console.log('[YT-CLIPPER] Action buttons created');

            // Apply theme immediately on modal open
            this.applyTheme(this.isLightTheme);
            console.log('[YT-CLIPPER] Theme applied');
        } catch (error) {
            console.error('[YT-CLIPPER] Error in createModalContent:', error);
            throw error;
        }
    }

    /**
     * Create URL input section
     */
    private createUrlSection(): void {
        const urlContainer = this.contentEl.createDiv();
        urlContainer.style.cssText = `
            margin: 12px 0;
            position: relative;
        `;

        const inputWrapper = urlContainer.createDiv();
        inputWrapper.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        this.urlInput = inputWrapper.createEl('input');
        this.urlInput.type = 'url';
        this.urlInput.placeholder = 'Paste YouTube URL...';
        this.urlInput.style.cssText = `
            flex: 1;
            padding: 10px 14px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 15px;
            background: var(--background-primary);
            color: var(--text-normal);
            transition: all 0.15s ease;
            outline: none;
            height: 40px;
        `;

        this.pasteButton = inputWrapper.createEl('button');
        this.pasteButton.innerHTML = '📋';
        this.pasteButton.style.cssText = `
            padding: 0;
            background: var(--interactive-accent);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
            color: white;
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        this.pasteButton.addEventListener('click', () => this.handleSmartPaste());
        this.pasteButton.addEventListener('mouseenter', () => {
            this.pasteButton.style.transform = 'scale(1.05)';
        });
        this.pasteButton.addEventListener('mouseleave', () => {
            this.pasteButton.style.transform = 'scale(1)';
        });

        this.urlInput.addEventListener('focus', () => {
            if (this.urlInput) {
                this.urlInput.style.borderColor = 'var(--interactive-accent)';
                this.urlInput.style.boxShadow = '0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2)';
            }
        });

        this.urlInput.addEventListener('blur', () => {
            if (this.urlInput) {
                this.urlInput.style.borderColor = 'var(--background-modifier-border)';
                this.urlInput.style.boxShadow = 'none';
            }
        });

        this.validationMessage = urlContainer.createDiv();
        this.validationMessage.style.cssText = `
            margin-top: 6px;
            padding: 6px 10px;
            font-size: 13px;
            color: var(--text-success);
            border-radius: 4px;
        `;

        this.createVideoPreviewSection(urlContainer);
    }

    /**
     * Create provider dropdown section
     */
    private createProviderSection(): void {
        const providerContainer = this.contentEl.createDiv();
        providerContainer.style.cssText = `
            margin: 12px 0;
        `;

        const label = providerContainer.createDiv();
        label.textContent = 'AI Provider';
        label.style.cssText = `
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        this.providerSelect = providerContainer.createEl('select');
        this.providerSelect.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
        `;

        const providerOptions = [
            { value: 'Google Gemini', text: 'Google' },
            { value: 'Groq', text: 'Groq' },
            { value: 'Hugging Face', text: 'HuggingFace' },
            { value: 'OpenRouter', text: 'OpenRouter' },
            { value: 'Ollama', text: 'Ollama' },
            { value: 'Ollama Cloud', text: 'OllamaCloud' },
        ];

        providerOptions.forEach(option => {
            const optionEl = this.providerSelect!.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            optionEl.style.cssText = `
                color: #000000;
                background: #ffffff;
            `;
        });

        this.providerSelect.addEventListener('change', async () => {
            this.selectedProvider = this.providerSelect?.value || 'Google Gemini';
            // Update model dropdown when provider changes
            this.updateModelDropdown(this.options.modelOptions);
        });
    }

    /**
     * Create model dropdown section
     */
    private createModelSection(): void {
        const modelContainer = this.contentEl.createDiv();
        modelContainer.style.cssText = `
            margin: 12px 0;
        `;

        const labelRow = modelContainer.createDiv();
        labelRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        `;

        const label = labelRow.createDiv();
        label.textContent = 'AI Model';
        label.style.cssText = `
            font-weight: 600;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        // Action buttons for model management
        const actionButtons = labelRow.createDiv();
        actionButtons.style.cssText = `
            display: flex;
            gap: 6px;
        `;

        this.refreshButton = actionButtons.createEl('button');
        this.refreshButton.innerHTML = '🔄';
        this.refreshButton.title = 'Refresh models';
        this.refreshButton.style.cssText = `
            padding: 4px 8px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85rem;
        `;

        this.refreshButton.addEventListener('click', async () => {
            const isForceRefresh = false;
            this.refreshButton.innerHTML = '⏳';
            this.refreshButton.style.opacity = '0.5';

            try {
                const currentProvider = this.selectedProvider || 'Google Gemini';
                const dynamicProviders = ['OpenRouter', 'Hugging Face', 'Ollama', 'Ollama Cloud', 'Groq', 'OllamaCloud'];
                const isDynamicProvider = dynamicProviders.includes(currentProvider);

                if (this.options.fetchModelsForProvider) {
                    const models = await this.options.fetchModelsForProvider(currentProvider, isForceRefresh);
                    if (models && models.length > 0) {
                        const updatedOptions = { ...this.options.modelOptions, [currentProvider]: models };
                        this.updateModelDropdown(updatedOptions);
                    }
                }
            } finally {
                this.refreshButton.innerHTML = '🔄';
                this.refreshButton.style.opacity = '1';
            }
        });

        const setDefaultBtn = actionButtons.createEl('button');
        setDefaultBtn.textContent = 'Set Default';
        setDefaultBtn.style.cssText = `
            padding: 4px 8px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75rem;
        `;

        setDefaultBtn.addEventListener('click', () => {
            const currentModel = this.modelSelect?.value;
            if (currentModel) {
                UserPreferencesService.setPreference('defaultModel', currentModel);
                const originalText = setDefaultBtn.textContent;
                setDefaultBtn.textContent = '✓ Saved';
                setTimeout(() => {
                    setDefaultBtn.textContent = originalText;
                }, 1500);
            }
        });

        this.modelSelect = modelContainer.createEl('select');
        this.modelSelect.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
        `;

        this.modelSelect.addEventListener('change', () => {
            this.selectedModel = this.modelSelect?.value;
        });
    }

    /**
     * Create format dropdown section
     */
    private createFormatSection(): void {
        const formatContainer = this.contentEl.createDiv();
        formatContainer.style.cssText = `
            margin: 12px 0;
        `;

        const label = formatContainer.createDiv();
        label.textContent = 'Output Format';
        label.style.cssText = `
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        this.formatSelect = formatContainer.createEl('select');
        this.formatSelect.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
        `;

        const formatOptions = [
            { value: 'executive-summary', text: '📊 Executive Summary' },
            { value: 'detailed-guide', text: '📖 Comprehensive Guide' },
            { value: 'brief', text: '⚡ Brief Summary' },
            { value: 'custom', text: '✏️ Custom Format' },
        ];

        formatOptions.forEach(option => {
            const optionEl = this.formatSelect!.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            optionEl.style.cssText = `
                color: #000000;
                background: #ffffff;
            `;
        });

        this.formatSelect.value = this.format;

        this.formatSelect.addEventListener('change', () => {
            this.format = this.formatSelect?.value as OutputFormat ?? 'executive-summary';
            this.toggleCustomPromptVisibility();
            UserPreferencesService.setPreference('lastFormat', this.format);
        });
    }

    /**
     * Create horizontal 3-column dropdown row (Format, Provider, Model)
     */
    private createDropdownRow(): void {
        const dropdownRow = this.contentEl.createDiv();
        dropdownRow.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            margin: 16px 0 12px 0;
            padding: 0;
        `;

        // Format dropdown
        const formatContainer = dropdownRow.createDiv();
        this.formatSelect = formatContainer.createEl('select');
        this.formatSelect.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
            transition: all 0.15s ease;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            padding-right: 30px;
        `;

        const formatOptions = [
            { value: 'executive-summary', text: '📊 Executive' },
            { value: 'detailed-guide', text: '📖 Detailed' },
            { value: 'brief', text: '⚡ Brief' },
            { value: 'custom', text: '✏️ Custom' },
        ];

        formatOptions.forEach(option => {
            const optionEl = this.formatSelect.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        this.formatSelect.value = this.format;
        this.formatSelect.addEventListener('change', () => {
            this.format = this.formatSelect?.value as OutputFormat ?? 'executive-summary';
            this.toggleCustomPromptVisibility();
            UserPreferencesService.setPreference('lastFormat', this.format);
        });

        // Provider dropdown
        const providerContainer = dropdownRow.createDiv();
        this.providerSelect = providerContainer.createEl('select');
        this.providerSelect.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
            transition: all 0.15s ease;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            padding-right: 30px;
        `;

        const providerOptions = [
            { value: 'Google Gemini', text: '🔵 Gemini' },
            { value: 'Groq', text: '⚡ Groq' },
            { value: 'Hugging Face', text: '🤗 HuggingFace' },
            { value: 'OpenRouter', text: '🔀 OpenRouter' },
            { value: 'Ollama', text: '🦙 Ollama' },
            { value: 'Ollama Cloud', text: '☁️ Ollama Cloud' },
        ];

        providerOptions.forEach(option => {
            const optionEl = this.providerSelect.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        this.providerSelect.value = this.selectedProvider;
        this.providerSelect.addEventListener('change', async () => {
            this.selectedProvider = this.providerSelect?.value || 'Google Gemini';

            // Update model dropdown when provider changes
            this.updateModelDropdown(this.options.modelOptions);

            // Auto-fetch models for the new provider
            if (this.options.fetchModelsForProvider) {
                try {
                    const models = await this.options.fetchModelsForProvider(this.selectedProvider, false);
                    if (models && models.length > 0) {
                        const updatedOptions = { ...this.options.modelOptions, [this.selectedProvider]: models };
                        this.options.modelOptions = updatedOptions;
                        this.updateModelDropdown(updatedOptions);
                    }
                } catch (error) {
                    console.warn('[YT-CLIPPER] Auto-fetch for provider change failed:', error);
                }
            }
        });

        // Model dropdown
        const modelContainer = dropdownRow.createDiv();
        const modelWrapper = modelContainer.createDiv();
        modelWrapper.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
        `;

        this.modelSelect = modelWrapper.createEl('select');
        this.modelSelect.style.cssText = `
            flex: 1;
            padding: 10px 32px 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
            transition: all 0.15s ease;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
        `;

        this.modelSelect.addEventListener('change', () => {
            this.selectedModel = this.modelSelect?.value;
        });
    }

    /**
     * Create icons row with actions
     */
    private createIconsRow(): void {
        const iconsRow = this.contentEl.createDiv();
        iconsRow.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin: 8px 0 12px 0;
            padding: 8px;
            background: var(--background-secondary);
            border-radius: 8px;
        `;

        // Theme toggle
        const themeBtn = iconsRow.createEl('button');
        themeBtn.innerHTML = this.isLightTheme ? '🌙' : '☀️';
        themeBtn.style.cssText = `
            padding: 6px 10px;
            background: transparent;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.7;
            transition: all 0.2s ease;
        `;
        themeBtn.title = 'Toggle theme';
        themeBtn.addEventListener('mouseenter', () => { themeBtn.style.opacity = '1'; themeBtn.style.background = 'var(--background-modifier-hover)'; });
        themeBtn.addEventListener('mouseleave', () => { themeBtn.style.opacity = '0.7'; themeBtn.style.background = 'transparent'; });
        themeBtn.addEventListener('click', () => {
            this.isLightTheme = !this.isLightTheme;
            this.applyTheme(this.isLightTheme);
            localStorage.setItem('ytc-theme-mode', this.isLightTheme ? 'light' : 'dark');
            themeBtn.innerHTML = this.isLightTheme ? '🌙' : '☀️';
        });

        // Refresh button with loading state
        const refreshBtn = iconsRow.createEl('button');
        refreshBtn.innerHTML = '🔄';
        this.refreshButton = refreshBtn;
        refreshBtn.style.cssText = `
            padding: 6px 10px;
            background: transparent;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.7;
            transition: all 0.2s ease;
        `;
        refreshBtn.title = 'Fetch latest models from provider';
        refreshBtn.addEventListener('mouseenter', () => { refreshBtn.style.opacity = '1'; refreshBtn.style.background = 'var(--background-modifier-hover)'; });
        refreshBtn.addEventListener('mouseleave', () => { refreshBtn.style.opacity = '0.7'; refreshBtn.style.background = 'transparent'; });
        refreshBtn.addEventListener('click', async () => {
            if (this.fetchInProgress) return;

            refreshBtn.style.opacity = '0.5';
            refreshBtn.innerHTML = '⏳';
            this.fetchInProgress = true;

            // Show loading in model dropdown
            if (this.modelSelect) {
                this.modelSelect.disabled = true;
                this.modelSelect.innerHTML = '<option value="">🔄 Fetching models...</option>';
            }

            try {
                if (this.options.fetchModelsForProvider && this.selectedProvider) {
                    const models = await this.options.fetchModelsForProvider(this.selectedProvider, true);

                    // Update the options map
                    const updatedOptions = { ...this.options.modelOptions, [this.selectedProvider]: models };
                    this.options.modelOptions = updatedOptions;

                    // Refresh the dropdown with new models
                    this.updateModelDropdown(updatedOptions);

                    new Notice(`✅ Fetched ${models.length} models for ${this.selectedProvider}`);
                }
            } catch (error) {
                // Restore dropdown on error
                if (this.modelSelect) {
                    this.modelSelect.disabled = false;
                }
                new Notice(`❌ Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                refreshBtn.innerHTML = '🔄';
                refreshBtn.style.opacity = '0.7';
                this.fetchInProgress = false;
            }
        });

        // Star/Save preference
        const starBtn = iconsRow.createEl('button');
        starBtn.innerHTML = '⭐';
        starBtn.style.cssText = `
            padding: 6px 10px;
            background: transparent;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.7;
            transition: all 0.2s ease;
        `;
        starBtn.title = 'Save as default';
        starBtn.addEventListener('mouseenter', () => { starBtn.style.opacity = '1'; starBtn.style.background = 'var(--background-modifier-hover)'; });
        starBtn.addEventListener('mouseleave', () => { starBtn.style.opacity = '0.7'; starBtn.style.background = 'transparent'; });
        starBtn.addEventListener('click', () => {
            if (this.selectedModel) {
                UserPreferencesService.setPreference('preferredModel', this.selectedModel);
                new Notice('⭐ Model saved as preference!');
            }
        });

        // Separator
        const sep1 = iconsRow.createSpan();
        sep1.textContent = '|';
        sep1.style.cssText = `color: var(--text-faint); font-size: 12px; opacity: 0.5;`;

        // Batch button
        const batchBtn = iconsRow.createEl('button');
        batchBtn.innerHTML = '📦 Batch';
        batchBtn.style.cssText = `
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        `;
        batchBtn.title = 'Process multiple videos';
        batchBtn.addEventListener('mouseenter', () => {
            batchBtn.style.transform = 'translateY(-1px)';
            batchBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });
        batchBtn.addEventListener('mouseleave', () => {
            batchBtn.style.transform = 'translateY(0)';
            batchBtn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
        });
        batchBtn.addEventListener('click', () => {
            if (this.options.onOpenBatchModal) {
                this.options.onOpenBatchModal();
            }
        });

        // Separator
        const sep2 = iconsRow.createSpan();
        sep2.textContent = '|';
        sep2.style.cssText = `color: var(--text-faint); font-size: 12px; opacity: 0.5;`;

        // Auto-fallback toggle
        const toggleWrapper = iconsRow.createDiv();
        toggleWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
        `;

        const toggleLabel = toggleWrapper.createSpan();
        toggleLabel.textContent = 'Auto';
        toggleLabel.style.cssText = `font-size: 11px; color: var(--text-muted); font-weight: 500;`;

        const toggleSwitch = toggleWrapper.createDiv();
        toggleSwitch.style.cssText = `
            position: relative;
            width: 36px;
            height: 20px;
            background: #00b894;
            border-radius: 10px;
            cursor: pointer;
            transition: background 0.2s ease;
        `;

        const toggleKnob = toggleSwitch.createDiv();
        toggleKnob.style.cssText = `
            position: absolute;
            top: 2px;
            left: 18px;
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            transition: transform 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;

        let isToggled = true;
        toggleSwitch.addEventListener('click', () => {
            isToggled = !isToggled;
            if (isToggled) {
                toggleSwitch.style.background = '#00b894';
                toggleKnob.style.transform = 'translateX(0)';
                this.autoFallbackEnabled = true;
            } else {
                toggleSwitch.style.background = 'var(--background-modifier-border)';
                toggleKnob.style.transform = 'translateX(-16px)';
                this.autoFallbackEnabled = false;
            }
            UserPreferencesService.updateLastUsed({
                autoFallback: this.autoFallbackEnabled,
            });
        });
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

        // Thumbnail (ultra compact)
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

        // Metadata container (ultra compact)
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

        // Provider status (shown during processing, ultra compact)
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

        // Show container with loading skeleton animation
        this.videoPreviewContainer.style.display = 'block';

        // Add skeleton loading styles
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

        // Show loading skeleton for thumbnail
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

        // Load thumbnail
        this.thumbnailEl.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        this.thumbnailEl.onload = () => {
            if (this.thumbnailEl) {
                this.thumbnailEl.style.animation = 'none';
            }
        };

        // Fetch video metadata (using oEmbed)
        try {
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
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
     * Hide video preview
     */
    private hideVideoPreview(): void {
        if (this.videoPreviewContainer) {
            this.videoPreviewContainer.style.display = 'none';
        }
    }

    /**
     * Update provider status during processing
     */
    private updateProviderStatus(provider: string, status: string): void {
        if (this.providerStatusEl) {
            this.providerStatusEl.style.display = 'block';
            this.providerStatusEl.innerHTML = `<span style="color: var(--ytc-accent);">🤖 ${provider}</span> — ${status}`;
        }
    }

    /**
     * Create custom prompt section
     */
    private customPrompt = '';

    private createCustomPromptSection(parent: HTMLElement): void {
        this.customPromptContainer = parent.createDiv();
        this.customPromptContainer.style.cssText = `
            display: none;
            margin-top: 5px;
            padding: 8px;
            background: var(--background-secondary);
            border-radius: 4px;
            border: 1px solid var(--background-modifier-border);
            animation: ytc-slide-down 0.2s ease-out;
        `;

        // Add animation keyframes
        if (!document.getElementById('ytc-custom-prompt-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'ytc-custom-prompt-styles';
            styleEl.textContent = `
                @keyframes ytc-slide-down {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(styleEl);
        }

        const labelRow = this.customPromptContainer.createDiv();
        labelRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
        `;

        const labelContainer = labelRow.createDiv();
        labelContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
        `;

        labelContainer.createSpan({ text: '✏️' });
        const label = labelContainer.createSpan({ text: 'Custom Prompt' });
        label.style.cssText = `
            font-weight: 600;
            color: var(--text-normal);
            font-size: 0.8rem;
        `;

        const hint = labelRow.createSpan({ text: 'Describe your summary' });
        hint.style.cssText = `
            color: var(--text-muted);
            font-size: 0.7rem;
        `;

        this.customPromptInput = this.customPromptContainer.createEl('textarea');
        this.customPromptInput.placeholder = 'e.g., "Step-by-step tutorial with code examples"';
        this.customPromptInput.style.cssText = `
            width: 100%;
            min-height: 60px;
            padding: 6px 8px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            font-size: 0.8rem;
            background: var(--background-primary);
            color: var(--text-normal);
            resize: vertical;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            font-family: inherit;
            line-height: 1.4;
        `;

        this.customPromptInput.addEventListener('focus', () => {
            this.customPromptInput!.style.borderColor = 'var(--interactive-accent)';
            this.customPromptInput!.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)';
        });

        this.customPromptInput.addEventListener('blur', () => {
            this.customPromptInput!.style.borderColor = 'var(--background-modifier-border)';
            this.customPromptInput!.style.boxShadow = 'none';
        });

        this.customPromptInput.addEventListener('input', () => {
            this.customPrompt = this.customPromptInput?.value ?? '';
        });

        // Character count (ultra compact)
        const charCount = this.customPromptContainer.createDiv();
        charCount.style.cssText = `
            text-align: right;
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 4px;
        `;
        charCount.textContent = '0 characters';

        this.customPromptInput.addEventListener('input', () => {
            const length = this.customPromptInput?.value.length ?? 0;
            charCount.textContent = `${length} character${length !== 1 ? 's' : ''}`;
        });
    }

    /**
     * Toggle custom prompt visibility based on format selection
     */
    private toggleCustomPromptVisibility(): void {
        if (this.customPromptContainer) {
            if (this.format === 'custom') {
                this.customPromptContainer.style.display = 'block';
                // Focus the input after a brief delay for animation
                setTimeout(() => {
                    this.customPromptInput?.focus();
                }, 100);
            } else {
                this.customPromptContainer.style.display = 'none';
            }
        }
    }

    /**
     * Create ultra-compact auto fallback toggle
     */
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

        // Ultra-compact toggle switch container
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

        // Toggle knob styling via pseudo-element simulation
        const updateToggleStyle = () => {
            if (this.fallbackToggle?.checked) {
                this.fallbackToggle.style.background = 'var(--ytc-accent)';
                this.fallbackToggle.style.boxShadow = '0 0 10px rgba(45, 212, 191, 0.4)';
            } else {
                this.fallbackToggle!.style.background = 'var(--ytc-border)';
                this.fallbackToggle!.style.boxShadow = 'none';
            }
        };

        // Create ultra-compact toggle knob
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

            // Save auto-fallback preference to last used
            UserPreferencesService.updateLastUsed({
                autoFallback: this.autoFallbackEnabled,
            });

            updateToggleStyle();
            updateKnob();
        });
    }

    /**
     * Update the model dropdown options based on provider selection and fetched data
     * This is called dynamically when models are fetched from the web/API
     */
    private updateModelDropdown(modelOptionsMap: Record<string, string[]>): void {
        if (!this.modelSelect || !this.providerSelect) return;

        // Get the currently selected provider
        const currentProvider = this.providerSelect.value;

        // Show loading state in dropdown
        const currentValue = this.modelSelect.value;
        this.modelSelect.innerHTML = '<option value="">Loading models...</option>';
        this.modelSelect.disabled = true;

        // Get available models for the current provider
        let models: string[] = [];
        let sourceInfo = '';

        if (modelOptionsMap?.[currentProvider]) {
            models = modelOptionsMap[currentProvider] ?? [];
            sourceInfo = ' (live)';
        } else {
            // Fallback to PROVIDER_MODEL_OPTIONS (single source of truth)
            const providerModels = PROVIDER_MODEL_OPTIONS[currentProvider];
            if (providerModels) {
                models = providerModels.map(m => typeof m === 'string' ? m : m.name);
                sourceInfo = ' (cached)';
            } else {
                models = [];
            }
        }

        // Clear and populate dropdown
        this.modelSelect.innerHTML = '';

        // Add model count indicator as first option (disabled)
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

        // Add models to dropdown with friendly names
        models.forEach(model => {
            const option = this.modelSelect!.createEl('option');
            option.value = model;

            // Format model names to be more user-friendly
            const formattedName = this.formatModelName(model);
            const isMultimodal = this.isMultimodalModel(currentProvider, model);

            // Add multimodal indicator
            option.textContent = isMultimodal ? `👁️ ${formattedName}` : formattedName;

            // Add title for multimodal models
            if (isMultimodal) {
                option.title = `${formattedName} - Supports vision and multimodal analysis`;
            }

            // Ensure proper text color
            option.style.cssText = `
                color: var(--text-normal);
                background: var(--background-primary);
            `;
        });

        // Re-enable dropdown
        this.modelSelect.disabled = false;

        // Try to find the best model to select:
        // 1. Try to use the last used model for this provider
        // 2. Fall back to the previously selected model if it's still available
        // 3. Otherwise use the first available model
        let modelToSelect = '';

        // Get last used model for this specific provider
        const preferences = UserPreferencesService.loadPreferences();
        const providerKey = `lastModel_${currentProvider.replace(/\s+/g, '')}` as keyof UserPreferences;
        const lastProviderModel = (preferences as any)[providerKey] as string;

        if (lastProviderModel && models.includes(lastProviderModel)) {
            modelToSelect = lastProviderModel;
        } else if (this.selectedModel && models.includes(this.selectedModel)) {
            modelToSelect = this.selectedModel;
        } else if (models.length > 0) {
            modelToSelect = models[0] ?? '';
        }

        this.modelSelect.value = modelToSelect;
        this.selectedModel = modelToSelect;

        // Visual feedback - flash the dropdown to show it was updated
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

    /**
     * Format model names to be more user-friendly
     */
    private formatModelName(modelName: string): string {
        // Handle special cases for better naming
        if (modelName === 'gemini-2.5-pro') return 'Gemini Pro 2.5';
        if (modelName === 'gemini-2.5-flash') return 'Gemini Flash 2.5';
        if (modelName === 'gemini-1.5-pro') return 'Gemini Pro 1.5';
        if (modelName === 'gemini-1.5-flash') return 'Gemini Flash 1.5';
        if (modelName === 'qwen3-coder:480b-cloud') return 'Qwen3-Coder 480B Cloud';

        // DeepSeek v3.2 Models (NEW)
        if (modelName === 'deepseek-v3.2') return 'DeepSeek v3.2';
        if (modelName === 'deepseek-v3.2:latest') return 'DeepSeek v3.2 (Latest)';
        if (modelName === 'deepseek-v3.2:32b') return 'DeepSeek v3.2 32B';
        if (modelName === 'deepseek-v3.2:70b') return 'DeepSeek v3.2 70B';
        if (modelName === 'deepseek-v3.2:instruct') return 'DeepSeek v3.2 Instruct';
        if (modelName === 'deepseek-v3.2:coder') return 'DeepSeek v3.2 Coder';

        // Official Groq Models (December 2024)
        if (modelName === 'llama-3.1-8b-instant') return 'Llama 3.1 8B Instant ⚡';
        if (modelName === 'llama-3.1-8b-instruct') return 'Llama 3.1 8B';
        if (modelName === 'llama-3.1-70b-instruct') return 'Llama 3.1 70B';
        if (modelName === 'llama-3.1-405b-instruct') return 'Llama 3.1 405B';

        // Mixtral Models
        if (modelName === 'mixtral-8x7b-instruct-v0.1') return 'Mixtral 8x7B Instruct v0.1';
        if (modelName === 'mixtral-8x22b-instruct-v0.1') return 'Mixtral 8x22B Instruct v0.1';

        // Gemma Models
        if (modelName === 'gemma2-9b-it') return 'Gemma 2 9B IT';
        if (modelName === 'gemma-7b-it') return 'Gemma 7B IT';

        // DeepSeek Models
        if (modelName === 'deepseek-r1-distill-llama-70b') return 'DeepSeek R1 Distill 70B';
        if (modelName === 'deepseek-coder-v2-lite-instruct') return 'DeepSeek Coder V2 Lite';

        // Specialized Models
        if (modelName === 'llama-guard-3-8b') return 'Llama Guard 3 8B';
        if (modelName === 'code-llama-34b-instruct') return 'Code Llama 34B';

        // Mixtral series
        if (modelName === 'mixtral-8x7b-32768') return 'Mixtral 8x7B 32K';
        if (modelName === 'mixtral-8x7b-instruct-v0.1') return 'Mixtral 8x7B Instruct v0.1';

        // Gemma series
        if (modelName === 'gemma-7b-it') return 'Gemma 7B IT';
        if (modelName === 'gemma2-9b-it') return 'Gemma 2 9B IT';

        // Llama 2 series
        if (modelName === 'llama2-70b-4096') return 'Llama 2 70B 4K';
        if (modelName === 'llama2-70b-chat') return 'Llama 2 70B Chat';
        if (modelName === 'llama2-13b-chat') return 'Llama 2 13B Chat';
        if (modelName === 'llama2-7b-chat') return 'Llama 2 7B Chat';

        // Multimodal Vision Models
        if (modelName === 'llama-3.2-11b-vision-instruct') return 'Llama 3.2 11B Vision 👁️';
        if (modelName === 'llama-3.2-90b-vision-instruct') return 'Llama 3.2 90B Vision 👁️';
        if (modelName === 'llama3.2-vision') return 'Llama 3.2 Vision 👁️';
        if (modelName === 'llava') return 'LLaVA 👁️';
        if (modelName === 'llava-llama3') return 'LLaVA Llama 3 👁️';
        if (modelName === 'bakllava') return 'BakLLaVA 👁️';
        if (modelName === 'moondream') return 'MoonDream 👁️';
        if (modelName === 'nvidia-llama3-1-vision') return 'NVIDIA Llama 3.1 Vision 👁️';
        if (modelName === 'qwen2-vl') return 'Qwen 2 VL 👁️';
        if (modelName === 'phi3-vision') return 'Phi 3 Vision 👁️';
        if (modelName === 'fuyu-8b') return 'Fuyu 8B 👁️';
        if (modelName === 'pixtral-12b') return 'Pixtral 12B 👁️';
        if (modelName === 'qwen/qwen2-vl-7b-instruct') return 'Qwen 2 VL 7B 👁️';
        if (modelName === 'qwen/qwen2-vl-2b-instruct') return 'Qwen 2 VL 2B 👁️';
        if (modelName === 'microsoft/phi-3.5-vision-instruct') return 'Phi 3.5 Vision 👁️';
        if (modelName === 'google/paligemma-3b-mix-448') return 'PaliGemma 3B 👁️';
        if (modelName === 'huggingfacem4/idefics2-8b') return 'Idefics 2 8B 👁️';

        // Multimodal Provider Models
        if (modelName === 'anthropic/claude-3.5-sonnet') return 'Claude 3.5 Sonnet 👁️';
        if (modelName === 'anthropic/claude-3.5-haiku') return 'Claude 3.5 Haiku 👁️';
        if (modelName === 'openai/gpt-4o') return 'GPT-4o 👁️';
        if (modelName === 'openai/gpt-4o-mini') return 'GPT-4o Mini 👁️';
        if (modelName === 'google/gemini-2.0-flash-exp') return 'Gemini 2.0 Flash Experimental 👁️';

        // Default fallback: capitalize first letter and replace dashes/underscores with spaces
        return modelName.charAt(0).toUpperCase() + modelName.slice(1).replace(/[-_]/g, ' ');
    }

    /**
     * Create theme toggle component (light/dark mode)
     */
    private createThemeToggle(): void {
        const themeContainer = this.contentEl.createDiv();
        themeContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            margin: 4px 0 8px 0;
        `;

        // Minimal theme toggle - just a clickable icon
        const toggleBtn = themeContainer.createDiv();
        toggleBtn.style.cssText = `
            cursor: pointer;
            font-size: 1rem;
            opacity: 0.6;
            transition: opacity 0.2s ease;
            padding: 4px;
        `;
        toggleBtn.innerHTML = this.isLightTheme ? '☀️' : '🌙';
        toggleBtn.title = this.isLightTheme ? 'Switch to dark mode' : 'Switch to light mode';

        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.opacity = '1';
        });
        toggleBtn.addEventListener('mouseleave', () => {
            toggleBtn.style.opacity = '0.6';
        });

        // Theme toggle functionality
        const updateTheme = (isLight: boolean) => {
            this.isLightTheme = isLight;
            toggleBtn.innerHTML = isLight ? '☀️' : '🌙';
            toggleBtn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
            this.applyTheme(isLight);
            localStorage.setItem('ytc-theme-mode', isLight ? 'light' : 'dark');
        };

        // Click to toggle
        toggleBtn.addEventListener('click', () => {
            updateTheme(!this.isLightTheme);
        });

        // Store for cleanup
        this.themeElements = {
            slider: toggleBtn,
            knob: toggleBtn,
            sunIcon: toggleBtn,
            moonIcon: toggleBtn,
            updateTheme,
        };
    }

    /**
     * Apply theme to modal
     */
    private applyTheme(isLight: boolean): void {
        // Add custom CSS variables for light theme
        if (!document.getElementById('ytc-theme-styles')) {
            const themeStyle = document.createElement('style');
            themeStyle.id = 'ytc-theme-styles';
            let css = '';

            // Light theme colors - refined warm palette
            css += '.ytc-modal-light {';
            css += '--ytc-bg-primary: #fafbfc;';
            css += '--ytc-bg-secondary: #f0f2f5;';
            css += '--ytc-bg-tertiary: #e4e7eb;';
            css += '--ytc-bg-input: #ffffff;';
            css += '--ytc-text-primary: #1a1d21;';
            css += '--ytc-text-secondary: #4a5568;';
            css += '--ytc-text-muted: #718096;';
            css += '--ytc-border: #d1d5db;';
            css += '--ytc-border-focus: #0f766e;';
            css += '--ytc-accent: #0d9488;';
            css += '--ytc-accent-hover: #0f766e;';
            css += '--ytc-accent-gradient: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);';
            css += '--ytc-success: #10b981;';
            css += '--ytc-warning: #f59e0b;';
            css += '--ytc-error: #ef4444;';
            css += '--ytc-shadow: rgba(0, 0, 0, 0.08);';
            css += '--ytc-shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.12);';
            css += '--ytc-glow: 0 0 20px rgba(13, 148, 136, 0.25);';
            css += '}';

            // Dark theme colors - premium dark palette with depth
            css += '.ytc-modal-dark {';
            css += '--ytc-bg-primary: #1a1b1e;';
            css += '--ytc-bg-secondary: #25262b;';
            css += '--ytc-bg-tertiary: #2c2e33;';
            css += '--ytc-bg-input: #141517;';
            css += '--ytc-text-primary: #ebedf0;';
            css += '--ytc-text-secondary: #a8adb5;';
            css += '--ytc-text-muted: #6b7280;';
            css += '--ytc-border: #3f444e;';
            css += '--ytc-border-focus: #2dd4bf;';
            css += '--ytc-accent: #2dd4bf;';
            css += '--ytc-accent-hover: #14b8a6;';
            css += '--ytc-accent-gradient: linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%);';
            css += '--ytc-success: #34d399;';
            css += '--ytc-warning: #fbbf24;';
            css += '--ytc-error: #fb7185;';
            css += '--ytc-shadow: rgba(0, 0, 0, 0.5);';
            css += '--ytc-shadow-lg: 0 10px 50px rgba(0, 0, 0, 0.65);';
            css += '--ytc-glow: 0 0 40px rgba(45, 212, 191, 0.3);';
            css += '}';

            // Modal container styling
            css += '.ytc-themed-modal .modal-content {';
            css += 'background: var(--ytc-bg-secondary) !important;';
            css += 'border-radius: 12px !important;';
            css += 'border: 1px solid var(--ytc-border) !important;';
            css += 'box-shadow: var(--ytc-shadow-lg), 0 0 0 1px rgba(255,255,255,0.05), var(--ytc-glow) !important;';
            css += 'padding: 20px !important;';
            css += 'max-width: 520px !important;';
            css += '}';

            // Header styling
            css += '.ytc-themed-modal .ytc-modal-header {';
            css += 'background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%) !important;';
            css += '-webkit-background-clip: text !important;';
            css += '-webkit-text-fill-color: transparent !important;';
            css += 'background-clip: text !important;';
            css += 'font-size: 1.5rem !important;';
            css += 'font-weight: 700 !important;';
            css += 'margin-bottom: 20px !important;';
            css += 'text-align: center !important;';
            css += 'width: 100% !important;';
            css += 'display: block !important;';
            css += '}';

            // Input field styling
            css += '.ytc-themed-modal input[type="url"], .ytc-themed-modal input[type="text"] {';
            css += 'background: var(--ytc-bg-input) !important;';
            css += 'border: 1px solid var(--ytc-border) !important;';
            css += 'border-radius: 6px !important;';
            css += 'color: var(--ytc-text-primary) !important;';
            css += 'transition: all 0.2s ease !important;';
            css += '}';
            css += '.ytc-themed-modal input:hover {';
            css += 'border-color: #525863 !important;';
            css += '}';
            css += '.ytc-themed-modal input:focus {';
            css += 'border-color: var(--ytc-border-focus) !important;';
            css += 'box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.15), 0 0 20px rgba(45, 212, 191, 0.1) !important;';
            css += 'outline: none !important;';
            css += '}';

            // Select dropdown styling
            css += '.ytc-themed-modal select {';
            css += 'background: var(--ytc-bg-input) !important;';
            css += 'border: 1px solid var(--ytc-border) !important;';
            css += 'border-radius: 6px !important;';
            css += 'color: var(--ytc-text-primary) !important;';
            css += 'transition: all 0.2s ease !important;';
            css += '}';
            css += '.ytc-themed-modal select:hover {';
            css += 'border-color: #525863 !important;';
            css += '}';
            css += '.ytc-themed-modal select:focus {';
            css += 'border-color: var(--ytc-border-focus) !important;';
            css += 'box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.15) !important;';
            css += 'outline: none !important;';
            css += '}';
            css += '.ytc-themed-modal select option {';
            css += 'background: var(--ytc-bg-secondary) !important;';
            css += 'color: #000000 !important;';
            css += 'padding: 4px 8px !important;';
            css += '}';

            // Button styling
            css += '.ytc-themed-modal button {';
            css += 'border-radius: 6px !important;';
            css += 'font-weight: 500 !important;';
            css += 'transition: all 0.2s ease !important;';
            css += '}';
            css += '.ytc-themed-modal button:hover {';
            css += 'transform: translateY(-1px) !important;';
            css += '}';

            // Primary button (Process)
            css += '.ytc-themed-modal .mod-cta, .ytc-themed-modal button[style*="interactive-accent"] {';
            css += 'background: var(--ytc-accent-gradient) !important;';
            css += 'border: none !important;';
            css += 'color: white !important;';
            css += 'box-shadow: 0 4px 15px rgba(45, 212, 191, 0.35), 0 0 20px rgba(45, 212, 191, 0.15) !important;';
            css += '}';
            css += '.ytc-themed-modal .mod-cta:hover {';
            css += 'transform: translateY(-2px) !important;';
            css += 'box-shadow: 0 6px 25px rgba(45, 212, 191, 0.45), 0 0 30px rgba(45, 212, 191, 0.25) !important;';
            css += '}';

            // Labels styling
            css += '.ytc-themed-modal [style*="font-weight: 500"] {';
            css += 'color: var(--ytc-text-secondary) !important;';
            css += '}';

            // Textarea styling
            css += '.ytc-themed-modal textarea {';
            css += 'background: var(--ytc-bg-input) !important;';
            css += 'border: 1px solid var(--ytc-border) !important;';
            css += 'border-radius: 6px !important;';
            css += 'color: var(--ytc-text-primary) !important;';
            css += 'transition: all 0.2s ease !important;';
            css += '}';
            css += '.ytc-themed-modal textarea:hover {';
            css += 'border-color: #525863 !important;';
            css += '}';
            css += '.ytc-themed-modal textarea:focus {';
            css += 'border-color: var(--ytc-border-focus) !important;';
            css += 'box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.15) !important;';
            css += 'outline: none !important;';
            css += '}';

            // Scrollbar styling
            css += '.ytc-themed-modal ::-webkit-scrollbar {';
            css += 'width: 8px !important;';
            css += '}';
            css += '.ytc-themed-modal ::-webkit-scrollbar-track {';
            css += 'background: var(--ytc-bg-primary) !important;';
            css += 'border-radius: 4px !important;';
            css += '}';
            css += '.ytc-themed-modal ::-webkit-scrollbar-thumb {';
            css += 'background: var(--ytc-border) !important;';
            css += 'border-radius: 4px !important;';
            css += '}';
            css += '.ytc-themed-modal ::-webkit-scrollbar-thumb:hover {';
            css += 'background: #525863 !important;';
            css += '}';

            themeStyle.innerHTML = css;
            document.head.appendChild(themeStyle);
        }

        // Apply theme class to modal
        this.modalEl?.classList.add('ytc-themed-modal');
        this.modalEl?.classList.toggle('ytc-modal-light', isLight);
        this.modalEl?.classList.toggle('ytc-modal-dark', !isLight);

        // Apply background to modal content
        if (this.contentEl) {
            this.contentEl.style.background = 'var(--ytc-bg-secondary)';
            this.contentEl.style.borderRadius = '16px';
        }

        // Update dropdown styles to match theme - use explicit colors for visibility
        if (this.formatSelect) {
            this.formatSelect.style.background = isLight ? '#ffffff' : '#1e1e1e';
            this.formatSelect.style.color = isLight ? '#1a1d21' : '#ebedf0';
            this.formatSelect.style.borderColor = isLight ? '#d1d5db' : '#3f444e';
        }

        if (this.providerSelect) {
            this.providerSelect.style.background = isLight ? '#ffffff' : '#1e1e1e';
            this.providerSelect.style.color = isLight ? '#1a1d21' : '#ebedf0';
            this.providerSelect.style.borderColor = isLight ? '#d1d5db' : '#3f444e';
        }

        if (this.modelSelect) {
            this.modelSelect.style.background = isLight ? '#ffffff' : '#1e1e1e';
            this.modelSelect.style.color = isLight ? '#1a1d21' : '#ebedf0';
            this.modelSelect.style.borderColor = isLight ? '#d1d5db' : '#3f444e';
        }

        // Update URL input
        if (this.urlInput) {
            this.urlInput.style.background = 'var(--ytc-bg-input)';
            this.urlInput.style.color = 'var(--ytc-text-primary)';
            this.urlInput.style.borderColor = 'var(--ytc-border)';
        }

        // Update other UI elements
        if (this.headerEl) {
            this.headerEl.style.color = 'var(--ytc-text-primary)';
        }

        if (this.progressText) {
            this.progressText.style.color = 'var(--ytc-text-primary)';
        }
    }

    /**
     * Create ultra-compact progress section
     */
    private createProgressSection(): void {
        this.progressContainer = this.contentEl.createDiv();
        this.progressContainer.setAttribute('role', 'region');
        this.progressContainer.setAttribute('aria-label', 'Processing progress');
        this.progressContainer.setAttribute('aria-live', 'polite');
        this.progressContainer.style.marginTop = '6px';
        this.progressContainer.style.display = 'none';

        // Progress text (ultra compact)
        this.progressText = this.progressContainer.createDiv();
        this.progressText.id = 'progress-text';
        this.progressText.style.marginBottom = '6px';
        this.progressText.style.fontWeight = '500';
        this.progressText.style.fontSize = '14px';
        this.progressText.style.color = '#00b894';
        this.progressText.textContent = 'Processing with Google Gemini...';

        // Progress bar container
        const progressBarContainer = this.progressContainer.createDiv();
        progressBarContainer.setAttribute('role', 'progressbar');
        progressBarContainer.setAttribute('aria-valuenow', '0');
        progressBarContainer.setAttribute('aria-valuemin', '0');
        progressBarContainer.setAttribute('aria-valuemax', '100');
        progressBarContainer.setAttribute('aria-labelledby', 'progress-text');
        progressBarContainer.style.width = '100%';
        progressBarContainer.style.height = '6px';
        progressBarContainer.style.backgroundColor = '#e0e0e0';
        progressBarContainer.style.borderRadius = '3px';
        progressBarContainer.style.overflow = 'hidden';

        // Progress bar
        this.progressBar = progressBarContainer.createDiv();
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = '#00b894';
        this.progressBar.style.borderRadius = '3px';
        this.progressBar.style.width = '0%';
        this.progressBar.style.transition = 'width 0.3s ease';
    }

    /**
     * Create action buttons - compact and organized
     */
    private createActionButtons(): void {
        // Main action container
        const container = this.contentEl.createDiv();
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--background-modifier-border);
        `;

        // Primary action row (Process)
        const primaryRow = container.createDiv();
        primaryRow.style.cssText = `
            display: flex;
            gap: 10px;
        `;

        this.processButton = primaryRow.createEl('button');
        this.processButton.textContent = MESSAGES.MODALS.PROCESS;
        this.processButton.style.cssText = `
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        `;
        this.processButton.addEventListener('click', () => this.handleProcess());

        // Secondary actions row (initially hidden)
        const secondaryRow = container.createDiv();
        secondaryRow.style.cssText = `
            display: none;
            gap: 8px;
        `;
        this.secondaryActionsRow = secondaryRow;

        // Process Another button
        const processAnotherBtn = secondaryRow.createEl('button');
        processAnotherBtn.innerHTML = '🔄 Process Another';
        processAnotherBtn.style.cssText = `
            flex: 1;
            padding: 10px 16px;
            border: 1px solid var(--interactive-accent);
            border-radius: 7px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            background: transparent;
            color: var(--interactive-accent);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        `;
        processAnotherBtn.addEventListener('click', () => {
            this.showInputState();
        });
        this.processAnotherButton = processAnotherBtn;

        // Open Note button
        this.openButton = secondaryRow.createEl('button');
        this.openButton.innerHTML = '📄 Open Note';
        this.openButton.style.cssText = `
            flex: 1;
            padding: 10px 16px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 7px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            background: var(--background-secondary);
            color: var(--text-normal);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        `;
        this.openButton.addEventListener('click', () => this.handleOpenFile());

        // Copy Path button
        this.copyPathButton = secondaryRow.createEl('button');
        this.copyPathButton.innerHTML = '📋 Copy';
        this.copyPathButton.style.cssText = `
            padding: 10px 14px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 7px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            background: var(--background-secondary);
            color: var(--text-normal);
            transition: all 0.2s ease;
        `;
        this.copyPathButton.addEventListener('click', () => this.handleCopyPath());

        // Cancel button (always visible but smaller)
        const cancelBtn = container.createEl('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            background: transparent;
            color: var(--text-muted);
            transition: all 0.2s ease;
            align-self: flex-end;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'var(--background-modifier-hover)';
            cancelBtn.style.color = 'var(--text-normal)';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'transparent';
            cancelBtn.style.color = 'var(--text-muted)';
        });
        cancelBtn.addEventListener('click', () => this.close());

        this.updateProcessButtonState();
    }

    /**
     * Show input state (for "Process Another")
     */
    private showInputState(): void {
        if (this.processButton) {
            this.processButton.style.display = 'flex';
            this.processButton.disabled = false;
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.style.display = 'none';
        }
        if (this.urlInput) {
            this.urlInput.disabled = false;
            this.urlInput.value = '';
            this.url = '';
        }
        if (this.openButton) {
            this.openButton.style.display = 'none';
        }
        if (this.copyPathButton) {
            this.copyPathButton.style.display = 'none';
        }
        if (this.headerEl) {
            this.headerEl.textContent = MESSAGES.MODALS.PROCESS_VIDEO;
        }
        this.processedFilePath = '';
        this.updateProcessButtonState();
        this.focusUrlInput();
    }

    /**
     * Show completion state with secondary actions
     */
    private showCompletionState(): void {
        if (this.processButton) {
            this.processButton.style.display = 'none';
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.style.display = 'flex';
        }
        if (this.openButton) {
            this.openButton.style.display = 'flex';
        }
        if (this.copyPathButton) {
            this.copyPathButton.style.display = 'flex';
        }
    }

    /**
     * Set up event handlers for the modal
     */
    private setupEventHandlers(): void {
        // Key handlers for Enter and Escape
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

        // Ctrl+O to open processed file
        this.scope.register(['Ctrl'], 'o', () => {
            if (this.openButton && this.openButton.style.display !== 'none') {
                this.handleOpenFile();
            }
            return false;
        });

        // Ctrl+C when not in input to copy path
        this.scope.register(['Ctrl'], 'c', () => {
            // Only copy path if not in input field and file is processed
            if (document.activeElement !== this.urlInput && this.processedFilePath) {
                this.handleCopyPath();
                return false;
            }
            return true; // Allow default copy behavior in input
        });

        // Ctrl+V to paste and auto-process
        this.scope.register(['Ctrl', 'Shift'], 'v', async () => {
            try {
                const clipText = await navigator.clipboard.readText();
                if (this.urlInput && ValidationUtils.isValidYouTubeUrl(clipText)) {
                    this.urlInput.value = clipText;
                    this.url = clipText;
                    this.updateProcessButtonState();
                    // Auto-trigger process if valid
                    if (this.processButton && !this.processButton.disabled) {
                        this.processButton.click();
                    }
                }
            } catch {
                // Clipboard access denied - ignore
            }
            return false;
        });

        // URL input change
        if (this.urlInput) {
            this.urlInput.addEventListener('input', () => {
                this.url = this.urlInput?.value ?? '';
                this.updateProcessButtonState();
            });
        }
    }

    /**
     * Focus on URL input
     */
    private focusUrlInput(): void {
        if (this.urlInput) {
            this.urlInput.focus();
        }
    }

    /**
     * Update process button enabled state
     */
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
            // Show video preview
            const videoId = ValidationUtils.extractVideoId(trimmedUrl);
            if (videoId) {
                void this.showVideoPreview(videoId);
            }
        } else {
            this.setValidationMessage('Enter a valid YouTube video URL.', 'error');
            this.hideVideoPreview();
        }
    }

    /**
     * Set validation message
     */
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

            // Update progress to 25% (validate URL)
            this.updateProgress(25, 'Validating URL...');

            // Extract video ID
            const videoId = ValidationUtils.extractVideoId(trimmedUrl);
            if (!videoId) {
                throw new Error('Could not extract YouTube video ID');
            }

            // Update progress to 50% (fetch video data)
            this.updateProgress(50, 'Fetching video data...');

            // Set format, provider, and model based on dropdown selections
            this.format = (this.formatSelect?.value as OutputFormat) ?? 'executive-summary';
            this.selectedProvider = this.providerSelect?.value;
            this.selectedModel = this.modelSelect?.value;

            // Update progress to 75% (process with AI) - show provider name
            const providerDisplayName = this.selectedProvider
                ? this.selectedProvider.charAt(0).toUpperCase() + this.selectedProvider.slice(1)
                : 'AI';
            this.updateProgress(75, `Processing with ${providerDisplayName}...`);

            // Call the process function
            const filePath = await this.options.onProcess(
                trimmedUrl,
                this.format,
                this.selectedProvider,
                this.selectedModel,
                this.format === 'custom' ? this.customPrompt : undefined,
                this.options.performanceMode || 'balanced',
                this.options.enableParallelProcessing || false,
                this.options.preferMultimodal || false,
                this.options.defaultMaxTokens || 4096,
                this.options.defaultTemperature || 0.5,
                this.autoFallbackEnabled
            );

            // Update progress to 100% (complete)
            this.updateProgress(100, 'Complete!');

            this.processedFilePath = filePath;
            this.showCompletionState();
        } catch (error) {
            this.showErrorState(error as Error);
            ErrorHandler.handle(error as Error, 'YouTube URL processing');
        }
    }

    /**
     * Show processing state
     */
    private showProcessingState(): void {
        this.isProcessing = true;
        if (this.progressContainer) {
            this.progressContainer.style.display = 'block';
        }
        if (this.urlInput) {
            this.urlInput.disabled = true;
        }
        if (this.processButton) {
            this.processButton.disabled = true;
            this.processButton.textContent = 'Processing...';
        }
        if (this.openButton) {
            this.openButton.style.display = 'none';
        }
        if (this.copyPathButton) {
            this.copyPathButton.style.display = 'none';
        }
    }

    /**
     * Update progress bar and text in real-time
     */
    private updateProgress(percent: number, text: string): void {
        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = text;
        }
    }

    /**
     * Show completion state
     */
    private showCompletionState(): void {
        this.isProcessing = false;
        if (this.urlInput) {
            this.urlInput.disabled = false;
            this.urlInput.value = '';
            this.url = '';
        }
        // Use the new layout - hide process button, show secondary actions
        if (this.processButton) {
            this.processButton.style.display = 'none';
        }
        if (this.secondaryActionsRow) {
            this.secondaryActionsRow.style.display = 'flex';
        }
        if (this.openButton) {
            this.openButton.style.display = 'flex';
        }
        if (this.copyPathButton) {
            this.copyPathButton.style.display = 'flex';
        }
        if (this.headerEl) {
            this.headerEl.textContent = '✅ Video Processed Successfully!';
        }
        this.setValidationMessage('Note saved. You can open it now or process another video.', 'success');
        this.focusUrlInput();
    }

    /**
     * Show error state
     */
    private showErrorState(error: Error): void {
        this.isProcessing = false;
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

    /**
     * Handle open file button click
     */
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

    /**
     * Handle copy path button click
     */
    private async handleCopyPath(): Promise<void> {
        if (this.processedFilePath) {
            try {
                await navigator.clipboard.writeText(this.processedFilePath);
                // Show brief feedback
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

    /**
     * Set URL value
     */
    private setUrl(url: string): void {
        this.url = url;
        if (this.urlInput) {
            this.urlInput.value = url;
        }
        this.updateProcessButtonState();
    }

    /**
     * Enhanced paste functionality with smart URL detection
     */
    private async handleSmartPaste(): Promise<void> {
        try {
            const text = await navigator.clipboard.readText();
            const trimmed = text.trim();

            if (ValidationUtils.isValidYouTubeUrl(trimmed)) {
                this.setUrl(trimmed);
                new Notice('YouTube URL detected and pasted!');
            } else {
                const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
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
        } catch (error) {

            new Notice('Could not access clipboard');
        }
    }

    /**
     * Setup keyboard shortcuts for enhanced productivity
     */
    private setupKeyboardShortcuts(): void {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (this.processButton && !this.processButton.disabled) {
                    this.processButton.click();
                }
            }

            if (e.key === 'Escape') {
                this.close();
            }
        };

        this.scope.register(['Ctrl'], 'Enter', () => {
            if (this.processButton && !this.processButton.disabled) {
                this.processButton.click();
            }
            return false; // Prevent default behavior
        });
    }

    /**
     * Clean up resources when modal is closed
     */
    onClose(): void {
        if (this.validationTimer) {
            clearTimeout(this.validationTimer);
        }
        super.onClose();
    }

    // Additional properties for debouncing
    private validationTimer?: number;

    /**
     * Get cache status for a provider
     */
    private getCacheStatus(provider: string): { isCached: boolean; ageMinutes?: number } {
        const dynamicProviders = ['OpenRouter', 'Hugging Face', 'Ollama', 'Ollama Cloud'];

        if (!dynamicProviders.includes(provider)) {
            return { isCached: false }; // Static providers
        }

        // In a real implementation, you would check actual cache timestamps
        // For now, return a placeholder - this could be enhanced by passing cache info
        return { isCached: true, ageMinutes: 15 }; // Placeholder
    }

    /**
     * Check if model supports multimodal capabilities
     */
    private isMultimodalModel(provider: string, model: string): boolean {
        // Known multimodal model patterns
        const multimodalPatterns = [
            'vision', 'vl', 'v-', 'multimodal', 'pixtral', 'fuyu', 'llava', 'moondream',
            'gemini-2.5', 'gemini-2.0', 'claude-3.5', 'gpt-4o', 'phi-3.5-vision', 'qwen2-vl',
        ];

        // Check if model name contains any multimodal indicators
        return multimodalPatterns.some(pattern =>
            model.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Check if provider is using cached models
     */
    private isUsingCachedModels(provider: string): boolean {
        return this.getCacheStatus(provider).isCached;
    }

    /**
     * Update refresh button tooltip based on selected provider
     */
    private updateRefreshButtonTooltip(): void {
        if (this.refreshButton) {
            const currentProvider = this.selectedProvider || 'Google Gemini';
            const dynamicProviders = ['OpenRouter', 'Hugging Face', 'Ollama', 'Ollama Cloud'];

            if (dynamicProviders.includes(currentProvider)) {
                this.refreshButton.title = 'Refresh models (Shift+Click to force refresh and bypass cache)';
            } else {
                this.refreshButton.title = 'Refresh models (static list)';
            }
        }
    }
}