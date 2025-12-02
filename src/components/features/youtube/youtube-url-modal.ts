import { BaseModal } from './components/common';
import { ErrorHandler } from './services/error-handler';
import { MESSAGES } from './constants';
import { OutputFormat, PerformanceMode } from './types/types';
import { UserPreferencesService } from './services/user-preferences-service';
import { ValidationUtils } from './lib/utils-consolidated';
import { App, Notice } from 'obsidian';

/**
 * YouTube URL input modal component
 */


export interface YouTubeUrlModalOptions {
    onProcess: (url: string, format: OutputFormat, provider?: string, model?: string, customPrompt?: string, performanceMode?: PerformanceMode, enableParallel?: boolean, preferMultimodal?: boolean, maxTokens?: number, temperature?: number) => Promise<string>; // Return file path
    onOpenFile?: (filePath: string) => Promise<void>;
    initialUrl?: string;
    providers?: string[]; // available provider names
    modelOptions?: Record<string, string[]>; // mapping providerName -> models
    defaultProvider?: string;
    defaultModel?: string;
    defaultMaxTokens?: number;
    defaultTemperature?: number;
    fetchModels?: () => Promise<Record<string, string[]>>;
    // Performance settings from plugin settings
    performanceMode?: PerformanceMode;
    enableParallelProcessing?: boolean;
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

        // Set default provider and model values
        this.selectedProvider = 'Google Gemini';
        this.selectedModel = 'gemini-2.5-pro';

        // Track usage for smart suggestions
        UserPreferencesService.updateLastUsed({
            format: 'detailed-guide',
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
            this.pasteButton.style.background = 'var(--interactive-accent-hover)';
        });
        this.pasteButton.addEventListener('mouseleave', () => {
            this.pasteButton.style.background = 'var(--interactive-accent)';
        });

        // Focus effects
        this.urlInput.addEventListener('focus', () => {
            this.urlInput.style.borderColor = 'var(--interactive-accent)';
            this.urlInput.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
        });

        this.urlInput.addEventListener('blur', () => {
            this.urlInput.style.borderColor = 'var(--background-modifier-border)';
            this.urlInput.style.boxShadow = 'none';
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
    }

    /**
     * Create three dropdowns in a single row: Format, Provider, Model
     */
    private createDropDownRow(): void {
        const dropdownContainer = this.contentEl.createDiv();
        dropdownContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin: 12px 0;
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
            const optionEl = this.formatSelect.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        // Set default format selection
        this.formatSelect.value = 'executive-summary';

        // Update format when changed
        this.formatSelect.addEventListener('change', () => {
            this.format = this.formatSelect.value as OutputFormat;
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
            { value: 'Ollama', text: 'Ollama' }
        ];

        providerOptions.forEach(option => {
            const optionEl = this.providerSelect.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        // Set default provider selection
        this.providerSelect.value = 'Google Gemini';

        // Update provider when changed
        this.providerSelect.addEventListener('change', () => {
            this.selectedProvider = this.providerSelect.value;

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
                // Call the fetchModels function passed from main.ts
                if (this.options.fetchModels) {
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
            const optionEl = this.modelSelect.createEl('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        // Set default model selection
        this.modelSelect.value = 'gemini-2.5-pro';

        // Update model when changed
        this.modelSelect.addEventListener('change', () => {
            this.selectedModel = this.modelSelect.value;
        });
    }

    /**
     * Update the model dropdown options based on provider selection and fetched data
     */
    private updateModelDropdown(modelOptionsMap: Record<string, string[]>): void {
        if (!this.modelSelect || !this.providerSelect) return;

        // Clear existing options
        this.modelSelect.innerHTML = '';

        // Get the currently selected provider
        const currentProvider = this.providerSelect.value;

        // Get available models for the current provider
        let models: string[] = [];
        if (modelOptionsMap && modelOptionsMap[currentProvider]) {
            models = modelOptionsMap[currentProvider];
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
            const option = this.modelSelect.createEl('option');
            option.value = model;
            // Format model names to be more user-friendly
            option.textContent = this.formatModelName(model);
        });

        // Preserve the previously selected model if it's still available, otherwise use first option
        if (this.selectedModel && models.includes(this.selectedModel)) {
            this.modelSelect.value = this.selectedModel;
        } else if (models.length > 0) {
            this.modelSelect.value = models[0];
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
            margin: 8px 0 16px 0;
            padding: 0 4px;
        `;

        // Theme toggle wrapper
        const toggleWrapper = themeContainer.createDiv();
        toggleWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--background-secondary);
            padding: 6px 12px;
            border-radius: 20px;
            border: 1px solid var(--background-modifier-border);
            transition: all 0.3s ease;
        `;

        // Add hover effect
        toggleWrapper.addEventListener('mouseenter', () => {
            toggleWrapper.style.borderColor = 'var(--interactive-accent)';
            toggleWrapper.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.2)';
        });
        toggleWrapper.addEventListener('mouseleave', () => {
            toggleWrapper.style.borderColor = 'var(--background-modifier-border)';
            toggleWrapper.style.boxShadow = 'none';
        });

        // Sun icon for light mode
        const sunIcon = toggleWrapper.createSpan();
        sunIcon.innerHTML = '☀️';
        sunIcon.style.cssText = `
            font-size: 1.1rem;
            transition: all 0.3s ease;
            opacity: ${this.isLightTheme ? '1' : '0.5'};
        `;

        // Theme toggle switch
        const themeSwitch = toggleWrapper.createEl('input');
        themeSwitch.type = 'checkbox';
        themeSwitch.checked = this.isLightTheme;
        themeSwitch.style.cssText = `
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        `;

        // Toggle slider
        const slider = toggleWrapper.createDiv();
        slider.style.cssText = `
            position: relative;
            width: 44px;
            height: 24px;
            background: ${this.isLightTheme ? 'var(--interactive-accent)' : 'var(--text-muted)'};
            border-radius: 24px;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
        `;

        // Toggle knob
        const knob = slider.createDiv();
        knob.style.cssText = `
            position: absolute;
            height: 18px;
            width: 18px;
            left: ${this.isLightTheme ? '24px' : '3px'};
            bottom: 3px;
            background: white;
            border-radius: 50%;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;

        // Moon icon for dark mode
        const moonIcon = toggleWrapper.createSpan();
        moonIcon.innerHTML = '🌙';
        moonIcon.style.cssText = `
            font-size: 1.1rem;
            transition: all 0.3s ease;
            opacity: ${this.isLightTheme ? '0.5' : '1'};
        `;

        // Theme toggle functionality
        const updateTheme = (isLight: boolean) => {
            this.isLightTheme = isLight;
            themeSwitch.checked = isLight;

            // Update slider and knob
            slider.style.background = isLight ? 'var(--interactive-accent)' : 'var(--text-muted)';
            knob.style.left = isLight ? '24px' : '3px';

            // Update icons
            sunIcon.style.opacity = isLight ? '1' : '0.5';
            moonIcon.style.opacity = isLight ? '0.5' : '1';

            // Apply theme to modal
            this.applyTheme(isLight);

            // Store preference
            localStorage.setItem('ytc-theme-mode', isLight ? 'light' : 'dark');
        };

        // Event listeners
        slider.addEventListener('click', () => {
            updateTheme(!this.isLightTheme);
        });

        themeSwitch.addEventListener('change', () => {
            updateTheme(themeSwitch.checked);
        });

        // Store elements for potential cleanup
        this.themeElements = {
            slider,
            knob,
            sunIcon,
            moonIcon,
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

            // Light theme colors
            css += `.ytc-modal-light {`;
            css += `--ytc-bg-primary: #ffffff;`;
            css += `--ytc-bg-secondary: #f8f9fa;`;
            css += `--ytc-bg-tertiary: #e9ecef;`;
            css += `--ytc-text-primary: #212529;`;
            css += `--ytc-text-secondary: #6c757d;`;
            css += `--ytc-text-muted: #adb5bd;`;
            css += `--ytc-border: #dee2e6;`;
            css += `--ytc-accent: #0d6efd;`;
            css += `--ytc-accent-hover: #0b5ed7;`;
            css += `--ytc-success: #198754;`;
            css += `--ytc-warning: #ffc107;`;
            css += `--ytc-error: #dc3545;`;
            css += `--ytc-shadow: rgba(0, 0, 0, 0.1);`;
            css += `}`;

            // Dark theme colors (matching Obsidian dark theme)
            css += `.ytc-modal-dark {`;
            css += `--ytc-bg-primary: #1e1e1e;`;
            css += `--ytc-bg-secondary: #252526;`;
            css += `--ytc-bg-tertiary: #3c3c3c;`;
            css += `--ytc-text-primary: #ffffff;`;
            css += `--ytc-text-secondary: #e0e0e0;`;
            css += `--ytc-text-muted: #a0a0a0;`;
            css += `--ytc-border: #3c3c3c;`;
            css += `--ytc-accent: #4a9eff;`;
            css += `--ytc-accent-hover: #3a8eef;`;
            css += `--ytc-success: #4caf50;`;
            css += `--ytc-warning: #ff9800;`;
            css += `--ytc-error: #f44336;`;
            css += `--ytc-shadow: rgba(0, 0, 0, 0.3);`;
            css += `}`;

            themeStyle.innerHTML = css;
            document.head.appendChild(themeStyle);
        }

        // Apply theme class to modal
        this.modalEl?.classList.add('ytc-themed-modal');
        this.modalEl?.classList.toggle('ytc-modal-light', isLight);
        this.modalEl?.classList.toggle('ytc-modal-dark', !isLight);

        // Update dropdown styles to match theme
        if (this.formatSelect) {
            this.formatSelect.style.background = `var(--ytc-bg-primary)`;
            this.formatSelect.style.color = `var(--ytc-text-primary)`;
            this.formatSelect.style.borderColor = `var(--ytc-border)`;
        }

        if (this.providerSelect) {
            this.providerSelect.style.background = `var(--ytc-bg-primary)`;
            this.providerSelect.style.color = `var(--ytc-text-primary)`;
            this.providerSelect.style.borderColor = `var(--ytc-border)`;
        }

        if (this.modelSelect) {
            this.modelSelect.style.background = `var(--ytc-bg-primary)`;
            this.modelSelect.style.color = `var(--ytc-text-primary)`;
            this.modelSelect.style.borderColor = `var(--ytc-border)`;
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

        // URL input change
        if (this.urlInput) {
            this.urlInput.addEventListener('input', () => {
                this.url = this.urlInput.value;
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
        } else {
            this.setValidationMessage(
                isValid ? 'Ready to process this video.' : 'Enter a valid YouTube video URL.',
                isValid ? 'success' : 'error'
            );
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

            // Update progress to 75% (process with AI)
            this.updateProgress(75, 'Processing with AI...');

            // Set format, provider, and model based on dropdown selections
            this.format = this.formatSelect.value as OutputFormat;
            this.selectedProvider = this.providerSelect.value;
            this.selectedModel = this.modelSelect.value;

            // Call the process function
            const filePath = await this.options.onProcess(
                trimmedUrl,
                this.format,
                this.selectedProvider,
                this.selectedModel,
                this.format === 'custom' ? undefined : undefined,
                this.options.performanceMode || 'balanced',
                this.options.enableParallelProcessing || false,
                this.options.preferMultimodal || false,
                this.options.defaultMaxTokens || 4096,
                this.options.defaultTemperature || 0.5
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