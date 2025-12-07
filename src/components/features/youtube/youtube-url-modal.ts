import { BaseModal } from '../../common/base-modal';
import { ErrorHandler } from '../../../services/error-handler';
import { MESSAGES } from '../../../constants/index';
import { OutputFormat, PerformanceMode } from '../../../types';
import { UserPreferencesService } from '../../../services/user-preferences-service';
import { ValidationUtils } from '../../../validation';
import { App, Notice } from 'obsidian';

/**
 * YouTube URL input modal component
 */


export interface YouTubeUrlModalOptions {
    onProcess: (url: string, format: OutputFormat, provider?: string, model?: string, customPrompt?: string, performanceMode?: PerformanceMode, enableParallel?: boolean, preferMultimodal?: boolean, maxTokens?: number, temperature?: number, enableAutoFallback?: boolean) => Promise<string>; // Return file path
    onOpenFile?: (filePath: string) => Promise<void>;
    initialUrl?: string;
    providers?: string[]; // available provider names
    modelOptions?: Record<string, string[]>; // mapping providerName -> models
    defaultProvider?: string;
    defaultModel?: string;
    defaultMaxTokens?: number;
    defaultTemperature?: number;
    fetchModels?: () => Promise<Record<string, string[]>>;
    fetchModelsForProvider?: (provider: string) => Promise<string[]>;
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

    // Format, Provider, and Model dropdowns
    private formatSelect?: HTMLSelectElement;

    // Theme state
    private isLightTheme = false;
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
        
        // Check for user-set preferred model, falling back to last used
        const preferredModel = UserPreferencesService.getPreference('preferredModel');
        const lastModel = UserPreferencesService.getPreference('lastModel');

        // Set default provider and model values based on user history
        // Preferred settings take priority over last used
        this.selectedProvider = lastProvider || 'Google Gemini';
        this.selectedModel = preferredModel || lastModel || 'gemini-2.5-pro';
        this.format = lastFormat;

        // Track usage for smart suggestions (will be updated again on actual processing)
        UserPreferencesService.updateLastUsed({
            format: lastFormat,
            provider: this.selectedProvider,
            model: this.selectedModel,
            maxTokens: options.defaultMaxTokens || 4096,
            temperature: options.defaultTemperature || 0.5,
            performanceMode: smartDefaults.mode,
            parallelProcessing: smartDefaults.parallel,
            multimodal: smartDefaults.multimodal
        });
    }

    onOpen(): void {
        console.log("[YT-CLIPPER] YouTubeUrlModal.onOpen called");
        this.createModalContent();
        this.setupEventHandlers();
        this.setupKeyboardShortcuts();

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
    }

    /**
     * Create streamlined modal content with compact UI
     */
    private createModalContent(): void {
        this.headerEl = this.createHeader(MESSAGES.MODALS.PROCESS_VIDEO);
        this.createThemeToggle(); // Add theme toggle at the top
        this.createCompactUrlSection();
        this.createDropDownRow();
        this.createProgressSection();
        this.createActionButtons();
        
        // Apply theme immediately on modal open
        this.applyTheme(this.isLightTheme);
    }

    /**
     * Create compact URL section with paste button
     */
    private createCompactUrlSection(): void {
        const urlContainer = this.contentEl.createDiv();
        urlContainer.style.cssText = `
            margin: 16px 0;
            position: relative;
        `;

        // URL input with inline actions
        const inputWrapper = urlContainer.createDiv();
        inputWrapper.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        // URL input
        this.urlInput = inputWrapper.createEl('input');
        this.urlInput.type = 'url';
        this.urlInput.placeholder = 'Paste YouTube URL here...';
        this.urlInput.style.cssText = `
            flex: 1;
            padding: 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            transition: all 0.2s ease;
            outline: none;
        `;

        // Paste button
        this.pasteButton = inputWrapper.createEl('button');
        this.pasteButton.innerHTML = '📋';
        this.pasteButton.style.cssText = `
            padding: 8px 12px;
            background: var(--interactive-accent);
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s ease;
            color: white;
        `;

        this.pasteButton.addEventListener('click', () => this.handleSmartPaste());
        this.pasteButton.addEventListener('mouseenter', () => {
            if (this.pasteButton) this.pasteButton.style.background = 'var(--interactive-accent-hover)';
        });
        this.pasteButton.addEventListener('mouseleave', () => {
            if (this.pasteButton) this.pasteButton.style.background = 'var(--interactive-accent)';
        });

        // Focus effects
        this.urlInput.addEventListener('focus', () => {
            if (this.urlInput) {
                this.urlInput.style.borderColor = 'var(--interactive-accent)';
                this.urlInput.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
            }
        });

        this.urlInput.addEventListener('blur', () => {
            if (this.urlInput) {
                this.urlInput.style.borderColor = 'var(--background-modifier-border)';
                this.urlInput.style.boxShadow = 'none';
            }
        });

        // Validation message container
        this.validationMessage = urlContainer.createDiv();
        this.validationMessage.style.cssText = `
            margin-top: 6px;
            padding: 6px;
            font-size: 0.8rem;
            color: var(--text-muted);
            border-radius: 4px;
        `;

        // Video preview container (hidden by default)
        this.createVideoPreviewSection(urlContainer);
    }

    /**
     * Create video preview section with thumbnail and metadata
     */
    private videoPreviewContainer?: HTMLDivElement;
    private videoTitleEl?: HTMLDivElement;
    private videoDurationEl?: HTMLSpanElement;
    private videoChannelEl?: HTMLSpanElement;
    private providerStatusEl?: HTMLDivElement;

    private createVideoPreviewSection(parent: HTMLElement): void {
        this.videoPreviewContainer = parent.createDiv();
        this.videoPreviewContainer.style.cssText = `
            display: none;
            margin-top: 12px;
            padding: 12px;
            background: var(--background-primary);
            border-radius: 10px;
            border: 1px solid var(--background-modifier-border);
        `;

        const previewContent = this.videoPreviewContainer.createDiv();
        previewContent.style.cssText = `
            display: flex;
            gap: 12px;
            align-items: flex-start;
        `;

        // Thumbnail
        this.thumbnailEl = previewContent.createEl('img');
        this.thumbnailEl.style.cssText = `
            width: 120px;
            height: 68px;
            border-radius: 6px;
            object-fit: cover;
            background: var(--background-modifier-border);
        `;
        this.thumbnailEl.alt = 'Video thumbnail';

        // Metadata container
        const metaContainer = previewContent.createDiv();
        metaContainer.style.cssText = `
            flex: 1;
            min-width: 0;
        `;

        this.videoTitleEl = metaContainer.createDiv();
        this.videoTitleEl.style.cssText = `
            font-weight: 600;
            font-size: 0.9rem;
            color: var(--text-normal);
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        const metaRow = metaContainer.createDiv();
        metaRow.style.cssText = `
            display: flex;
            gap: 12px;
            font-size: 0.8rem;
            color: var(--text-muted);
        `;

        this.videoChannelEl = metaRow.createSpan();
        this.videoDurationEl = metaRow.createSpan();

        // Provider status (shown during processing)
        this.providerStatusEl = this.videoPreviewContainer.createDiv();
        this.providerStatusEl.style.cssText = `
            margin-top: 8px;
            padding: 6px 10px;
            background: var(--background-secondary);
            border-radius: 6px;
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
            this.providerStatusEl.innerHTML = `<span style="color: var(--text-accent);">🤖 ${provider}</span> — ${status}`;
        }
    }

    /**
     * Create three dropdowns in a single row: Format, Provider, Model
     */
    private createDropDownRow(): void {
        const dropdownContainer = this.contentEl.createDiv();
        dropdownContainer.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            margin: 16px 0;
            align-items: end;
        `;

        // Format dropdown
        const formatContainer = dropdownContainer.createDiv();
        formatContainer.style.cssText = `
            flex: 1;
        `;

        const formatLabel = formatContainer.createDiv();
        formatLabel.textContent = 'Format';
        formatLabel.style.cssText = `
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        this.formatSelect = formatContainer.createEl('select');
        this.formatSelect.style.cssText = `
            width: 100%;
            padding: 10px 14px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            min-height: 40px;
        `;

        // Add format options
        const formatOptions = [
            { value: 'executive-summary', text: '1. Executive' },
            { value: 'detailed-guide', text: '2. Comprehensive' },
            { value: 'brief', text: '3. Brief' },
            { value: 'custom', text: '4. Custom' }
        ];

        formatOptions.forEach(option => {
            const optionEl = this.formatSelect!.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        // Set default format selection - use last used or smart default
        const smartFormat = UserPreferencesService.getSmartDefaultFormat();
        this.formatSelect!.value = smartFormat;
        this.format = smartFormat;

        // Update format when changed
        this.formatSelect!.addEventListener('change', () => {
            this.format = this.formatSelect?.value as OutputFormat ?? 'executive-summary';
            this.toggleCustomPromptVisibility();
        });

        // Provider dropdown
        const providerContainer = dropdownContainer.createDiv();
        providerContainer.style.cssText = `
            flex: 1;
        `;

        const providerLabel = providerContainer.createDiv();
        providerLabel.textContent = 'Provider';
        providerLabel.style.cssText = `
            font-weight: 500;
            margin-bottom: 6px;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        this.providerSelect = providerContainer.createEl('select');
        this.providerSelect.style.cssText = `
            width: 100%;
            padding: 10px 14px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            min-height: 40px;
        `;

        // Add provider options
        const providerOptions = [
            { value: 'Google Gemini', text: 'Google' },
            { value: 'Groq', text: 'Groq' },
            { value: 'Hugging Face', text: 'HuggingFace' },
            { value: 'OpenRouter', text: 'OpenRouter' },
            { value: 'Ollama', text: 'Ollama' }
        ];

        providerOptions.forEach(option => {
            const optionEl = this.providerSelect!.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        // Set default provider selection - use last used or smart default
        const smartProvider = UserPreferencesService.getSmartDefaultProvider() || 'Google Gemini';
        this.providerSelect!.value = smartProvider;
        this.selectedProvider = smartProvider;

        // Update provider when changed
        this.providerSelect!.addEventListener('change', () => {
            this.selectedProvider = this.providerSelect?.value;

            // Update the model dropdown to show models for the selected provider
            // Use the cached model options if available
            if (this.options.modelOptions) {
                this.updateModelDropdown(this.options.modelOptions);
            }
        });

        // Model dropdown with refresh button container
        const modelContainer = dropdownContainer.createDiv();
        modelContainer.style.cssText = `
            flex: 1;
            position: relative;
        `;

        const modelLabelRow = modelContainer.createDiv();
        modelLabelRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        `;

        const modelLabel = modelLabelRow.createDiv();
        modelLabel.textContent = 'Model';
        modelLabel.style.cssText = `
            font-weight: 500;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        // Create refresh button
        const refreshBtn = modelLabelRow.createEl('button');
        refreshBtn.innerHTML = '🔄';
        refreshBtn.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            font-size: 0.9rem;
            padding: 2px 4px;
            border-radius: 4px;
            opacity: 0.7;
            transition: opacity 0.2s, background 0.2s;
        `;

        refreshBtn.addEventListener('mouseenter', () => {
            refreshBtn.style.opacity = '1';
            refreshBtn.style.background = 'var(--background-modifier-hover)';
        });

        refreshBtn.addEventListener('mouseleave', () => {
            refreshBtn.style.opacity = '0.7';
            refreshBtn.style.background = 'none';
        });

        refreshBtn.addEventListener('click', async () => {
            refreshBtn.innerHTML = '⏳'; // Loading indicator
            refreshBtn.style.opacity = '0.5';
            refreshBtn.style.cursor = 'wait';

            try {
                const currentProvider = this.selectedProvider || 'Google Gemini';
                
                // Try provider-specific fetch first (faster)
                if (this.options.fetchModelsForProvider) {
                    const models = await this.options.fetchModelsForProvider(currentProvider);
                    if (models && models.length > 0) {
                        // Update just this provider's models
                        const updatedOptions = { ...this.options.modelOptions, [currentProvider]: models };
                        this.updateModelDropdown(updatedOptions);
                        new Notice(`Updated ${models.length} models for ${currentProvider}`);
                    } else {
                        new Notice('No models found. Using defaults.');
                    }
                } else if (this.options.fetchModels) {
                    // Fallback to fetching all providers
                    const modelOptionsMap = await this.options.fetchModels();
                    this.updateModelDropdown(modelOptionsMap);
                    new Notice('Model list updated!');
                }
            } catch (error) {
                new Notice('Failed to refresh models. Using cached options.');
            } finally {
                refreshBtn.innerHTML = '🔄';
                refreshBtn.style.opacity = '0.7';
                refreshBtn.style.cursor = 'pointer';
            }
        });

        // Create "Set Default" button
        const setDefaultBtn = modelLabelRow.createEl('button');
        setDefaultBtn.innerHTML = '⭐';
        setDefaultBtn.title = 'Set current selections as default';
        setDefaultBtn.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            font-size: 0.9rem;
            padding: 2px 4px;
            border-radius: 4px;
            opacity: 0.7;
            transition: opacity 0.2s, background 0.2s;
            margin-left: 2px;
        `;

        setDefaultBtn.addEventListener('mouseenter', () => {
            setDefaultBtn.style.opacity = '1';
            setDefaultBtn.style.background = 'var(--background-modifier-hover)';
        });

        setDefaultBtn.addEventListener('mouseleave', () => {
            setDefaultBtn.style.opacity = '0.7';
            setDefaultBtn.style.background = 'none';
        });

        setDefaultBtn.addEventListener('click', () => {
            const currentFormat = this.formatSelect?.value as OutputFormat;
            const currentProvider = this.providerSelect?.value;
            const currentModel = this.modelSelect?.value;

            // Save as preferred defaults
            UserPreferencesService.setPreference('preferredFormat', currentFormat);
            UserPreferencesService.setPreference('preferredProvider', currentProvider);
            UserPreferencesService.setPreference('preferredModel', currentModel);

            // Also update last used
            UserPreferencesService.updateLastUsed({
                format: currentFormat,
                provider: currentProvider,
                model: currentModel,
            });

            // Visual feedback
            const originalText = setDefaultBtn.innerHTML;
            setDefaultBtn.innerHTML = '✅';
            new Notice(`Default set: ${currentFormat} / ${currentProvider} / ${currentModel?.split('/').pop() || currentModel}`);
            
            setTimeout(() => {
                setDefaultBtn.innerHTML = originalText;
            }, 1500);
        });

        this.modelSelect = modelContainer.createEl('select');
        this.modelSelect.style.cssText = `
            width: 100%;
            padding: 10px 14px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            min-height: 40px;
        `;

        // Add model options
        const modelOptions = [
            { value: 'gemini-2.5-pro', text: 'Gemini Pro 2.5' },
            { value: 'gemini-2.5-flash', text: 'Gemini Flash 2.5' },
            { value: 'gemini-1.5-pro', text: 'Gemini Pro 1.5' },
            { value: 'gemini-1.5-flash', text: 'Gemini Flash 1.5' },
            { value: 'qwen3-coder:480b-cloud', text: 'Qwen3-Coder 480B Cloud' },
            { value: 'llama3.2', text: 'Llama 3.2' },
            { value: 'llama3.1', text: 'Llama 3.1' },
            { value: 'mistral', text: 'Mistral' },
            { value: 'gemma2', text: 'Gemma 2' },
            { value: 'phi3', text: 'Phi 3' }
        ];

        modelOptions.forEach(option => {
            const optionEl = this.modelSelect!.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        // Set default model selection
        this.modelSelect!.value = 'gemini-2.5-pro';

        // Update model when changed
        this.modelSelect!.addEventListener('change', () => {
            this.selectedModel = this.modelSelect?.value;
        });

        // Auto Fallback toggle row
        this.createFallbackToggle(this.contentEl);

        // Custom prompt input container (hidden by default)
        this.createCustomPromptSection(this.contentEl);
    }

    /**
     * Create custom prompt input section
     */
    private customPrompt = '';

    private createCustomPromptSection(parent: HTMLElement): void {
        this.customPromptContainer = parent.createDiv();
        this.customPromptContainer.style.cssText = `
            display: none;
            margin-top: 12px;
            padding: 12px;
            background: var(--background-secondary);
            border-radius: 8px;
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
            margin-bottom: 8px;
        `;

        const labelContainer = labelRow.createDiv();
        labelContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        labelContainer.createSpan({ text: '✏️' });
        const label = labelContainer.createSpan({ text: 'Custom Prompt' });
        label.style.cssText = `
            font-weight: 600;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        const hint = labelRow.createSpan({ text: 'Describe how you want the video summarized' });
        hint.style.cssText = `
            color: var(--text-muted);
            font-size: 0.75rem;
        `;

        this.customPromptInput = this.customPromptContainer.createEl('textarea');
        this.customPromptInput.placeholder = 'e.g., "Summarize this video as a step-by-step tutorial with code examples" or "Extract all key quotes and insights"';
        this.customPromptInput.style.cssText = `
            width: 100%;
            min-height: 80px;
            padding: 10px 12px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--background-primary);
            color: var(--text-normal);
            resize: vertical;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            font-family: inherit;
            line-height: 1.5;
        `;

        this.customPromptInput.addEventListener('focus', () => {
            this.customPromptInput!.style.borderColor = 'var(--ytc-accent, #0d9488)';
            this.customPromptInput!.style.boxShadow = '0 0 0 2px rgba(13, 148, 136, 0.1)';
        });

        this.customPromptInput.addEventListener('blur', () => {
            this.customPromptInput!.style.borderColor = 'var(--background-modifier-border)';
            this.customPromptInput!.style.boxShadow = 'none';
        });

        this.customPromptInput.addEventListener('input', () => {
            this.customPrompt = this.customPromptInput?.value ?? '';
        });

        // Character count
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
     * Create auto fallback toggle
     */
    private autoFallbackEnabled = true;
    private fallbackToggle?: HTMLInputElement;

    private createFallbackToggle(parent: HTMLElement): void {
        const toggleRow = parent.createDiv();
        toggleRow.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 12px;
            padding: 8px 12px;
            background: var(--background-secondary);
            border-radius: 8px;
            font-size: 0.85rem;
        `;

        const labelContainer = toggleRow.createDiv();
        labelContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        labelContainer.createSpan({ text: '🔄' });
        const label = labelContainer.createSpan({ text: 'Auto Fallback' });
        label.style.cssText = `
            color: var(--text-normal);
            font-weight: 500;
        `;

        const hint = labelContainer.createSpan({ text: '(try next provider on failure)' });
        hint.style.cssText = `
            color: var(--text-muted);
            font-size: 0.8rem;
        `;

        // Toggle switch container
        const toggleContainer = toggleRow.createDiv();
        toggleContainer.style.cssText = `
            position: relative;
            width: 44px;
            height: 24px;
        `;

        this.fallbackToggle = toggleContainer.createEl('input', { type: 'checkbox' });
        this.fallbackToggle.checked = this.options.enableAutoFallback ?? true;
        this.autoFallbackEnabled = this.fallbackToggle.checked;
        this.fallbackToggle.style.cssText = `
            position: absolute;
            width: 44px;
            height: 24px;
            appearance: none;
            -webkit-appearance: none;
            background: var(--background-modifier-border);
            border-radius: 12px;
            cursor: pointer;
            transition: background 0.2s ease;
            outline: none;
        `;

        // Toggle knob styling via pseudo-element simulation
        const updateToggleStyle = () => {
            if (this.fallbackToggle?.checked) {
                this.fallbackToggle.style.background = 'var(--ytc-accent, #0d9488)';
            } else {
                this.fallbackToggle!.style.background = 'var(--background-modifier-border)';
            }
        };

        // Create toggle knob
        const knob = toggleContainer.createDiv();
        knob.style.cssText = `
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: transform 0.2s ease;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        `;

        const updateKnob = () => {
            if (this.fallbackToggle?.checked) {
                knob.style.transform = 'translateX(20px)';
            } else {
                knob.style.transform = 'translateX(0)';
            }
        };

        updateToggleStyle();
        updateKnob();

        this.fallbackToggle.addEventListener('change', () => {
            this.autoFallbackEnabled = this.fallbackToggle?.checked ?? true;
            updateToggleStyle();
            updateKnob();
        });
    }

    /**
     * Update the model dropdown options based on provider selection and fetched data
     */
    private updateModelDropdown(modelOptionsMap: Record<string, string[]>): void {
        if (!this.modelSelect || !this.providerSelect) return;

        // Clear existing options
        if (!this.modelSelect || !this.providerSelect) return;
        this.modelSelect.innerHTML = '';

        // Get the currently selected provider
        const currentProvider = this.providerSelect.value;

        // Get available models for the current provider
        let models: string[] = [];
        if (modelOptionsMap && modelOptionsMap[currentProvider]) {
            models = modelOptionsMap[currentProvider] ?? [];
        } else {
            // Fallback to static options if not available in dynamic map
            switch(currentProvider) {
                case 'Google Gemini':
                    models = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
                    break;
                case 'Groq':
                    models = ['llama-4-maverick-17b-128e-instruct', 'llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
                    break;
                case 'Ollama':
                    models = ['qwen3-coder:480b-cloud', 'llama3.2', 'llama3.1', 'mistral', 'mixtral', 'gemma2', 'phi3', 'qwen2', 'command-r'];
                    break;
                default:
                    models = [];
            }
        }

        // Add models to dropdown with friendly names
        models.forEach(model => {
            const option = this.modelSelect!.createEl('option');
            option.value = model;
            // Format model names to be more user-friendly
            option.textContent = this.formatModelName(model);
        });

        // Preserve the previously selected model if it's still available, otherwise use first option
        if (this.selectedModel && models.includes(this.selectedModel)) {
            this.modelSelect.value = this.selectedModel;
        } else if (models.length > 0) {
            this.modelSelect.value = models[0] ?? '';
            this.selectedModel = models[0];
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
        if (modelName === 'llama-4-maverick-17b-128e-instruct') return 'Llama 4 Maverick 17B';
        if (modelName === 'llama-4-scout-17b-16e-instruct') return 'Llama 4 Scout 17B';
        if (modelName === 'llama-3.3-70b-versatile') return 'Llama 3.3 70B';
        if (modelName === 'llama-3.1-8b-instant') return 'Llama 3.1 8B';

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
            updateTheme
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
            css += `.ytc-modal-light {`;
            css += `--ytc-bg-primary: #fafbfc;`;
            css += `--ytc-bg-secondary: #f0f2f5;`;
            css += `--ytc-bg-tertiary: #e4e7eb;`;
            css += `--ytc-bg-input: #ffffff;`;
            css += `--ytc-text-primary: #1a1d21;`;
            css += `--ytc-text-secondary: #4a5568;`;
            css += `--ytc-text-muted: #718096;`;
            css += `--ytc-border: #d1d5db;`;
            css += `--ytc-border-focus: #0f766e;`;
            css += `--ytc-accent: #0d9488;`;
            css += `--ytc-accent-hover: #0f766e;`;
            css += `--ytc-accent-gradient: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);`;
            css += `--ytc-success: #10b981;`;
            css += `--ytc-warning: #f59e0b;`;
            css += `--ytc-error: #ef4444;`;
            css += `--ytc-shadow: rgba(0, 0, 0, 0.08);`;
            css += `--ytc-shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.12);`;
            css += `--ytc-glow: 0 0 20px rgba(13, 148, 136, 0.25);`;
            css += `}`;

            // Dark theme colors - refined dark palette
            css += `.ytc-modal-dark {`;
            css += `--ytc-bg-primary: #3f4042ff;`;
            css += `--ytc-bg-secondary: #3f4042ff;`;
            css += `--ytc-bg-tertiary: #3f4042ff;`;
            css += `--ytc-bg-input: #16171a;`;
            css += `--ytc-text-primary: #f4f4f5;`;
            css += `--ytc-text-secondary: #a1a1aa;`;
            css += `--ytc-text-muted: #71717a;`;
            css += `--ytc-border: #3f3f46;`;
            css += `--ytc-border-focus: #14b8a6;`;
            css += `--ytc-accent: #14b8a6;`;
            css += `--ytc-accent-hover: #0d9488;`;
            css += `--ytc-accent-gradient: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);`;
            css += `--ytc-success: #22c55e;`;
            css += `--ytc-warning: #eab308;`;
            css += `--ytc-error: #ef4444;`;
            css += `--ytc-shadow: rgba(0, 0, 0, 0.4);`;
            css += `--ytc-shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.5);`;
            css += `--ytc-glow: 0 0 30px rgba(20, 184, 166, 0.25);`;
            css += `}`;

            // Modal container styling
            css += `.ytc-themed-modal .modal-content {`;
            css += `background: var(--ytc-bg-secondary) !important;`;
            css += `border-radius: 16px !important;`;
            css += `border: 1px solid var(--ytc-border) !important;`;
            css += `box-shadow: var(--ytc-shadow-lg), var(--ytc-glow) !important;`;
            css += `padding: 24px !important;`;
            css += `max-width: 520px !important;`;
            css += `}`;

            // Header styling
            css += `.ytc-themed-modal .ytc-modal-header {`;
            css += `background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%) !important;`;
            css += `-webkit-background-clip: text !important;`;
            css += `-webkit-text-fill-color: transparent !important;`;
            css += `background-clip: text !important;`;
            css += `font-size: 1.5rem !important;`;
            css += `font-weight: 700 !important;`;
            css += `margin-bottom: 20px !important;`;
            css += `text-align: center !important;`;
            css += `width: 100% !important;`;
            css += `display: block !important;`;
            css += `}`;

            // Input field styling
            css += `.ytc-themed-modal input[type="url"], .ytc-themed-modal input[type="text"] {`;
            css += `background: var(--ytc-bg-input) !important;`;
            css += `border: 2px solid var(--ytc-border) !important;`;
            css += `border-radius: 10px !important;`;
            css += `color: var(--ytc-text-primary) !important;`;
            css += `transition: all 0.2s ease !important;`;
            css += `}`;
            css += `.ytc-themed-modal input:focus {`;
            css += `border-color: var(--ytc-border-focus) !important;`;
            css += `box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.2) !important;`;
            css += `}`;

            // Select dropdown styling
            css += `.ytc-themed-modal select {`;
            css += `background: var(--ytc-bg-input) !important;`;
            css += `border: 1px solid var(--ytc-border) !important;`;
            css += `border-radius: 8px !important;`;
            css += `color: var(--ytc-text-primary) !important;`;
            css += `transition: all 0.2s ease !important;`;
            css += `}`;
            css += `.ytc-themed-modal select:hover {`;
            css += `border-color: var(--ytc-accent) !important;`;
            css += `}`;

            // Button styling
            css += `.ytc-themed-modal button {`;
            css += `border-radius: 8px !important;`;
            css += `font-weight: 500 !important;`;
            css += `transition: all 0.2s ease !important;`;
            css += `}`;

            // Primary button (Process)
            css += `.ytc-themed-modal .mod-cta, .ytc-themed-modal button[style*="interactive-accent"] {`;
            css += `background: var(--ytc-accent-gradient) !important;`;
            css += `border: none !important;`;
            css += `color: white !important;`;
            css += `box-shadow: 0 4px 14px rgba(21, 196, 190, 0.35) !important;`;
            css += `}`;
            css += `.ytc-themed-modal .mod-cta:hover {`;
            css += `transform: translateY(-1px) !important;`;
            css += `box-shadow: 0 6px 20px rgba(21, 196, 190, 0.45) !important;`;
            css += `}`;

            // Labels styling
            css += `.ytc-themed-modal [style*="font-weight: 500"] {`;
            css += `color: var(--ytc-text-secondary) !important;`;
            css += `}`;

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

        // Update dropdown styles to match theme
        if (this.formatSelect) {
            this.formatSelect.style.background = `var(--ytc-bg-input)`;
            this.formatSelect.style.color = `var(--ytc-text-primary)`;
            this.formatSelect.style.borderColor = `var(--ytc-border)`;
        }

        if (this.providerSelect) {
            this.providerSelect.style.background = `var(--ytc-bg-input)`;
            this.providerSelect.style.color = `var(--ytc-text-primary)`;
            this.providerSelect.style.borderColor = `var(--ytc-border)`;
        }

        if (this.modelSelect) {
            this.modelSelect.style.background = `var(--ytc-bg-input)`;
            this.modelSelect.style.color = `var(--ytc-text-primary)`;
            this.modelSelect.style.borderColor = `var(--ytc-border)`;
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
     * Create progress section to display real-time progress
     */
    private createProgressSection(): void {
        this.progressContainer = this.contentEl.createDiv();
        this.progressContainer.setAttribute('role', 'region');
        this.progressContainer.setAttribute('aria-label', 'Processing progress');
        this.progressContainer.setAttribute('aria-live', 'polite');
        this.progressContainer.style.marginTop = '16px';
        this.progressContainer.style.display = 'none';

        // Progress text
        this.progressText = this.progressContainer.createDiv();
        this.progressText.id = 'progress-text';
        this.progressText.style.marginBottom = '8px';
        this.progressText.style.fontWeight = '500';
        this.progressText.style.color = 'var(--text-accent)';
        this.progressText.textContent = 'Processing video...';

        // Progress bar container
        const progressBarContainer = this.progressContainer.createDiv();
        progressBarContainer.setAttribute('role', 'progressbar');
        progressBarContainer.setAttribute('aria-valuenow', '0');
        progressBarContainer.setAttribute('aria-valuemin', '0');
        progressBarContainer.setAttribute('aria-valuemax', '100');
        progressBarContainer.setAttribute('aria-labelledby', 'progress-text');
        progressBarContainer.style.width = '100%';
        progressBarContainer.style.height = '10px';
        progressBarContainer.style.backgroundColor = 'var(--background-modifier-border)';
        progressBarContainer.style.borderRadius = '5px';
        progressBarContainer.style.overflow = 'hidden';

        // Progress bar
        this.progressBar = progressBarContainer.createDiv();
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = 'var(--interactive-accent)';
        this.progressBar.style.borderRadius = '5px';
        this.progressBar.style.width = '0%';
        this.progressBar.style.transition = 'width 0.3s ease';
    }

    /**
     * Create action buttons with accessibility
     */
    private createActionButtons(): void {
        const container = this.contentEl.createDiv();
        container.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--background-modifier-border);
        `;

        // Cancel button
        const cancelBtn = container.createEl('button');
        cancelBtn.textContent = MESSAGES.MODALS.CANCEL;
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            background: var(--background-secondary);
            color: var(--text-normal);
            transition: all 0.2s ease;
        `;

        cancelBtn.addEventListener('click', () => this.close());

        // Process button
        this.processButton = container.createEl('button');
        this.processButton.textContent = MESSAGES.MODALS.PROCESS;
        this.processButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            transition: all 0.2s ease;
        `;

        this.processButton.addEventListener('click', () => this.handleProcess());

        // Open Note button (hidden initially)
        this.openButton = container.createEl('button');
        this.openButton.textContent = 'Open Note';
        this.openButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            background: var(--interactive-accent);
            color: var(--text-on-accent);
            transition: all 0.2s ease;
        `;

        this.openButton.style.display = 'none';
        this.openButton.addEventListener('click', () => this.handleOpenFile());

        // Copy Path button (hidden initially)
        this.copyPathButton = container.createEl('button');
        this.copyPathButton.textContent = '📋 Copy Path';
        this.copyPathButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            background: var(--background-secondary);
            color: var(--text-normal);
            transition: all 0.2s ease;
            margin-left: 8px;
        `;
        this.copyPathButton.style.display = 'none';
        this.copyPathButton.addEventListener('click', () => this.handleCopyPath());

        // Initial state update
        this.updateProcessButtonState();
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

        let color = 'var(--text-muted)';
        if (type === 'error') {
            color = 'var(--text-error)';
        } else if (type === 'success') {
            color = 'var(--text-accent)';
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
        if (this.processButton) {
            this.processButton.disabled = false;
            this.processButton.textContent = 'Process Another';
            this.processButton.style.display = 'inline-block';
        }
        if (this.openButton) {
            this.openButton.style.display = 'inline-block';
        }
        if (this.copyPathButton) {
            this.copyPathButton.style.display = 'inline-block';
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
}