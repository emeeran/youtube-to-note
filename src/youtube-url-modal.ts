/**
 * YouTube URL input modal component
 */

import { App, Notice } from 'obsidian';
import { BaseModal } from './base-modal';
import { MESSAGES } from './messages';
import { PROVIDER_MODEL_OPTIONS, AI_MODELS } from './api';
import { ValidationUtils } from './validation';
import { ErrorHandler } from './services/error-handler';
import { UserPreferencesService } from './services/user-preferences-service';
import { OutputFormat, PerformanceMode } from './types/types';

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

    // Advanced settings drawer state
    private isDrawerOpen = false;
    private drawerToggle?: HTMLButtonElement;
    private drawerContainer?: HTMLDivElement;
    private drawerContent?: HTMLDivElement;

    // Performance settings
    private performanceMode: PerformanceMode = 'balanced';
    private enableParallelProcessing = false;
    private preferMultimodal = false;
    private performanceModeSelect?: HTMLSelectElement;
    private parallelToggle?: HTMLInputElement;
    private multimodalToggle?: HTMLInputElement;

    // Model parameters
    private maxTokens: number = 4096;
    private temperature: number = 0.5;
    private maxTokensSlider?: HTMLInputElement;
    private maxTokensValue?: HTMLSpanElement;
    private temperatureSlider?: HTMLInputElement;
    private temperatureValue?: HTMLSpanElement;

    // Performance optimization: debounced validation
    private validationTimer?: number;
    private lastValidUrl?: string;
    private lastValidResult?: boolean;

    // Theme state
    private isDarkMode = false;
    private themeElements?: {
        slider: HTMLDivElement;
        knob: HTMLDivElement;
        sunIcon: HTMLSpanElement;
        moonIcon: HTMLSpanElement;
        updateTheme: (isDark: boolean) => void;
    };

    constructor(
        app: App,
        private options: YouTubeUrlModalOptions
    ) {
        super(app);

        this.url = options.initialUrl || '';

        // Load smart defaults from user preferences
        const smartDefaults = UserPreferencesService.getSmartDefaultPerformanceSettings();
        const smartModelParams = UserPreferencesService.getSmartDefaultModelParameters();

        // Initialize performance settings with smart defaults
        this.performanceMode = options.performanceMode || smartDefaults.mode;
        this.enableParallelProcessing = options.enableParallelProcessing !== undefined ? options.enableParallelProcessing : smartDefaults.parallel;
        this.preferMultimodal = options.preferMultimodal !== undefined ? options.preferMultimodal : smartDefaults.multimodal;

        // Initialize model parameters with smart defaults
        this.maxTokens = options.defaultMaxTokens || smartModelParams.maxTokens;
        this.temperature = options.defaultTemperature || smartModelParams.temperature;

        // Track usage for smart suggestions
        UserPreferencesService.updateLastUsed({
            format: 'detailed-guide',
            provider: options.defaultProvider,
            model: options.defaultModel,
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            performanceMode: this.performanceMode,
            parallelProcessing: this.enableParallelProcessing,
            multimodal: this.preferMultimodal
        });

        // Initialize theme from localStorage
        const savedTheme = localStorage.getItem('ytc-theme-mode');
        this.isDarkMode = savedTheme !== 'light'; // Default to dark
        console.log('Theme initialized:', { savedTheme, isDarkMode: this.isDarkMode });
    }

    onOpen(): void {
        this.createModalContent();
        this.setupEventHandlers();
        this.setupKeyboardShortcuts();

        // Show user insights for enhanced experience
        this.showUserInsights();

        // If an initial URL was provided, validate and focus the appropriate control
        if (this.options.initialUrl) {
            // Prevent cycles - if the URL is already being processed, don't reprocess
            if (this.url.trim() === this.options.initialUrl.trim()) {
                console.debug('YouTubeUrlModal: Same URL already set, preventing cycle');
            } else {
                this.setUrl(this.options.initialUrl);
            }

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
     * Create streamlined modal content
     */
    private createModalContent(): void {
        this.headerEl = this.createHeader(MESSAGES.MODALS.PROCESS_VIDEO);
        this.createThemeToggle();
        this.createStreamlinedUrlSection();
        this.createQuickFormatSection();
        this.createAdvancedSettingsDrawer();
        this.createProgressSection();
        this.createActionButtons();
    }

    /**
     * Create theme toggle component
     */
    private createThemeToggle(): void {
        // Theme toggle container
        const themeContainer = this.contentEl.createDiv();
        themeContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            align-items: center;
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
            padding: 8px 16px;
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
            opacity: ${this.isDarkMode ? '0.5' : '1'};
        `;

        // Theme toggle switch
        const themeSwitch = toggleWrapper.createEl('input');
        themeSwitch.type = 'checkbox';
        themeSwitch.checked = this.isDarkMode;
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
            background: ${this.isDarkMode ? 'var(--interactive-accent)' : 'var(--text-muted)'};
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
            left: ${this.isDarkMode ? '24px' : '3px'};
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
            opacity: ${this.isDarkMode ? '1' : '0.5'};
        `;

        // Theme toggle functionality
        const updateTheme = (isDark: boolean) => {
            this.isDarkMode = isDark;
            themeSwitch.checked = isDark;

            // Update slider and knob
            slider.style.background = isDark ? 'var(--interactive-accent)' : 'var(--text-muted)';
            knob.style.left = isDark ? '24px' : '3px';

            // Update icons
            sunIcon.style.opacity = isDark ? '0.5' : '1';
            moonIcon.style.opacity = isDark ? '1' : '0.5';

            // Apply theme to modal
            this.applyTheme(isDark);

            // Store preference
            localStorage.setItem('ytc-theme-mode', isDark ? 'dark' : 'light');
        };

        // Event listeners
        slider.addEventListener('click', () => {
            updateTheme(!this.isDarkMode);
        });

        themeSwitch.addEventListener('change', () => {
            updateTheme(themeSwitch.checked);
        });

        // Store elements for cleanup
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
    private applyTheme(isDark: boolean): void {
        // Add custom CSS variables for light theme
        if (!document.getElementById('ytc-theme-styles')) {
            const themeStyle = document.createElement('style');
            themeStyle.id = 'ytc-theme-styles';
            let css = '';

            // Light theme colors
            css += `.ytc-modal-light {`;
            css += `--ytc-bg-primary: #fafbfc;`;
            css += `--ytc-bg-secondary: #f1f5f9;`;
            css += `--ytc-bg-tertiary: #e2e8f0;`;
            css += `--ytc-text-primary: #1e293b;`;
            css += `--ytc-text-secondary: #475569;`;
            css += `--ytc-text-muted: #64748b;`;
            css += `--ytc-border: #e2e8f0;`;
            css += `--ytc-accent: #3b82f6;`;
            css += `--ytc-accent-hover: #2563eb;`;
            css += `--ytc-accent-light: #eff6ff;`;
            css += `--ytc-success: #10b981;`;
            css += `--ytc-warning: #f59e0b;`;
            css += `--ytc-error: #ef4444;`;
            css += `--ytc-shadow: rgba(15, 23, 42, 0.08);`;
            css += `}`;

            // Dark theme colors
            css += `.ytc-modal-dark {`;
            css += `--ytc-bg-primary: #0f172a;`;
            css += `--ytc-bg-secondary: #1e293b;`;
            css += `--ytc-bg-tertiary: #334155;`;
            css += `--ytc-text-primary: #f8fafc;`;
            css += `--ytc-text-secondary: #e2e8f0;`;
            css += `--ytc-text-muted: #94a3b8;`;
            css += `--ytc-border: #334155;`;
            css += `--ytc-accent: #60a5fa;`;
            css += `--ytc-accent-hover: #3b82f6;`;
            css += `--ytc-accent-light: #1e3a8a;`;
            css += `--ytc-success: #34d399;`;
            css += `--ytc-warning: #fbbf24;`;
            css += `--ytc-error: #f87171;`;
            css += `--ytc-shadow: rgba(0, 0, 0, 0.3);`;
            css += `}`;

            themeStyle.innerHTML = css;
            document.head.appendChild(themeStyle);
        }

        // Apply theme class to modal
        this.modalEl?.classList.add('ytc-themed-modal');
        this.modalEl?.classList.toggle('ytc-modal-light', !isDark);
        this.modalEl?.classList.toggle('ytc-modal-dark', isDark);

        // Update modal title
        if (this.headerEl) {
            this.headerEl.style.color = 'var(--ytc-text-primary)';
            this.headerEl.style.background = 'var(--ytc-gradient-surface)';
            this.headerEl.style.borderBottom = `1px solid var(--ytc-border)';
            this.headerEl.style.fontWeight = '600';
            this.headerEl.style.padding = '20px 24px';
            this.headerEl.style.boxShadow = '0 2px 8px var(--ytc-shadow)';
        }
    }

    /**
     * Create streamlined URL section with integrated quick actions
     */
    private createStreamlinedUrlSection(): void {
        const urlContainer = this.contentEl.createDiv();
        urlContainer.className = 'ytc-streamlined-url-section';
        urlContainer.style.margin = '16px 0';
        urlContainer.style.position = 'relative';

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
        this.urlInput.placeholder = '🎬 Paste YouTube URL here...';
        this.urlInput.style.cssText = `
            flex: 1;
            padding: 14px 16px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 12px;
            font-size: 1rem;
            background: var(--background-primary);
            color: var(--text-normal);
            transition: all 0.3s ease;
            outline: none;
        `;

        // Inline paste button
        const pasteBtn = inputWrapper.createEl('button');
        pasteBtn.innerHTML = '📋';
        pasteBtn.style.cssText = `
            padding: 12px;
            background: var(--interactive-accent);
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: all 0.2s ease;
            min-width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        pasteBtn.addEventListener('click', () => this.handleSmartPaste());
        pasteBtn.addEventListener('mouseenter', () => {
            pasteBtn.style.transform = 'scale(1.05)';
            pasteBtn.style.background = 'var(--interactive-accent-hover)';
        });
        pasteBtn.addEventListener('mouseleave', () => {
            pasteBtn.style.transform = 'scale(1)';
            pasteBtn.style.background = 'var(--interactive-accent)';
        });

        // Focus effects
        this.urlInput.addEventListener('focus', () => {
            this.urlInput.style.borderColor = 'var(--interactive-accent)';
            this.urlInput.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.1)';
        });

        this.urlInput.addEventListener('blur', () => {
            this.urlInput.style.borderColor = 'var(--background-modifier-border)';
            this.urlInput.style.boxShadow = 'none';
        });

        // Video metadata preview container
        this.metadataContainer = urlContainer.createDiv();
        this.metadataContainer.className = 'yt-preview-metadata';
        this.metadataContainer.style.cssText = `
            margin-top: 12px;
            padding: 16px;
            background: linear-gradient(135deg, var(--background-secondary), var(--background-primary));
            border-radius: 10px;
            border: 1px solid var(--background-modifier-border);
            display: none;
            animation: slideDown 0.3s ease-out;
        `;

        const metadataContent = this.metadataContainer.createDiv();
        metadataContent.style.cssText = 'display: flex; gap: 12px; align-items: center;';

        // Video icon
        const videoIcon = metadataContent.createSpan();
        videoIcon.textContent = '🎥';
        videoIcon.style.cssText = 'font-size: 1.5rem;';

        const textContent = metadataContent.createDiv();
        textContent.style.flex = '1';

        const titleEl = textContent.createDiv();
        titleEl.className = 'yt-preview-title';
        titleEl.style.cssText = 'font-weight: 600; margin-bottom: 4px; color: var(--text-normal);';

        const channelEl = textContent.createDiv();
        channelEl.className = 'yt-preview-channel';
        channelEl.style.cssText = 'font-size: 0.85rem; color: var(--text-muted);';
    }

    /**
     * Create quick format selection with visual pills
     */
    private createQuickFormatSection(): void {
        const formatContainer = this.contentEl.createDiv();
        formatContainer.className = 'ytc-quick-format-section';
        formatContainer.style.cssText = `
            margin: 20px 0;
        `;

        const label = formatContainer.createDiv();
        label.textContent = '📝 Output Format';
        label.style.cssText = `
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--text-normal);
            font-size: 0.95rem;
        `;

        const pillsContainer = formatContainer.createDiv();
        pillsContainer.style.cssText = `
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        `;

        const formats = [
            { id: 'executive-summary', icon: '📋', label: 'Executive', desc: 'Quick insights' },
            { id: 'detailed-guide', icon: '📖', label: 'Detailed', desc: 'Comprehensive analysis' },
            { id: 'brief', icon: '⚡', label: 'Brief', desc: 'Key points only' }
        ];

        formats.forEach((format, index) => {
            const pill = pillsContainer.createEl('button');
            pill.className = 'ytc-format-pill';
            pill.setAttribute('data-format', format.id);
            pill.innerHTML = `
                <span style="font-size: 1.2rem; margin-right: 6px;">${format.icon}</span>
                <div style="text-align: left;">
                    <div style="font-weight: 600; font-size: 0.9rem;">${format.label}</div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">${format.desc}</div>
                </div>
            `;

            // Styling
            pill.style.cssText = `
                padding: 12px 16px;
                background: var(--background-secondary);
                border: 2px solid var(--background-modifier-border);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 140px;
                text-align: left;
                font-size: 0.85rem;
                color: var(--text-normal);
            `;

            // Set default selection
            if (format.id === 'detailed-guide') {
                pill.style.borderColor = 'var(--interactive-accent)';
                pill.style.background = 'var(--interactive-accent)';
                pill.style.color = 'white';
                this.format = format.id as OutputFormat;
            }

            // Hover and selection effects
            pill.addEventListener('mouseenter', () => {
                if (!pill.style.borderColor.includes('var(--interactive-accent)')) {
                    pill.style.borderColor = 'var(--interactive-accent)';
                    pill.style.transform = 'translateY(-2px)';
                    pill.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.2)';
                }
            });

            pill.addEventListener('mouseleave', () => {
                if (!pill.style.borderColor.includes('var(--interactive-accent)') || pill.style.background === 'var(--interactive-accent)') {
                    pill.style.transform = 'translateY(0)';
                    pill.style.boxShadow = 'none';
                }
            });

            pill.addEventListener('click', () => {
                // Reset all pills
                pillsContainer.querySelectorAll('button').forEach(p => {
                    const btn = p as HTMLButtonElement;
                    btn.style.borderColor = 'var(--background-modifier-border)';
                    btn.style.background = 'var(--background-secondary)';
                    btn.style.color = 'var(--text-normal)';
                });

                // Highlight selected pill
                pill.style.borderColor = 'var(--interactive-accent)';
                pill.style.background = 'var(--interactive-accent)';
                pill.style.color = 'white';

                this.format = format.id as OutputFormat;
                this.updateProcessButtonState();
            });
        });

        // Add custom prompt option
        const customPill = pillsContainer.createEl('button');
        customPill.innerHTML = `
            <span style="font-size: 1.2rem; margin-right: 6px;">🎨</span>
            <div style="text-align: left;">
                <div style="font-weight: 600; font-size: 0.9rem;">Custom</div>
                <div style="font-size: 0.75rem; opacity: 0.8;">Your own prompt</div>
            </div>
        `;

        customPill.style.cssText = pillsContainer.children[0]!.getAttribute('style') || '';

        customPill.addEventListener('click', () => {
            // Reset format pills
            pillsContainer.querySelectorAll('button').forEach(p => {
                const btn = p as HTMLButtonElement;
                btn.style.borderColor = 'var(--background-modifier-border)';
                btn.style.background = 'var(--background-secondary)';
                btn.style.color = 'var(--text-normal)';
            });

            customPill.style.borderColor = 'var(--interactive-accent)';
            customPill.style.background = 'var(--interactive-accent)';
            customPill.style.color = 'white';

            this.format = 'custom';
            this.updateProcessButtonState();
            this.createCustomPromptSection();
        });
    }

    /**
     * Create compact performance and speed settings section
     */
    private createPerformanceSection(): void {
        const container = this.contentEl.createDiv();
        container.className = 'ytc-performance-section';
        container.style.marginTop = '12px';
        container.style.padding = '10px';
        container.style.backgroundColor = 'var(--background-secondary)';
        container.style.borderRadius = '6px';
        container.style.border = '1px solid var(--interactive-accent)';

        // Compact header
        const headerContainer = container.createDiv();
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.marginBottom = '10px';

        const sectionHeader = headerContainer.createEl('h3');
        sectionHeader.textContent = '⚡ Performance';
        sectionHeader.style.margin = '0';
        sectionHeader.style.fontSize = '0.9rem';
        sectionHeader.style.fontWeight = '600';
        sectionHeader.style.color = 'var(--text-accent)';
        sectionHeader.style.display = 'flex';
        sectionHeader.style.alignItems = 'center';
        sectionHeader.style.gap = '6px';

        // Compact performance mode selection
        const modeContainer = container.createDiv();
        modeContainer.style.marginBottom = '8px';

        this.performanceModeSelect = modeContainer.createEl('select');
        this.performanceModeSelect.style.width = '100%';
        this.performanceModeSelect.style.padding = '6px 8px';
        this.performanceModeSelect.style.borderRadius = '4px';
        this.performanceModeSelect.style.border = '1px solid var(--background-modifier-border)';
        this.performanceModeSelect.style.backgroundColor = 'var(--background-primary)';
        this.performanceModeSelect.style.color = 'var(--text-normal)';
        this.performanceModeSelect.style.fontSize = '0.85rem';
        this.performanceModeSelect.style.cursor = 'pointer';

        // Compact options
        const fastOption = this.performanceModeSelect.createEl('option');
        fastOption.value = 'fast';
        fastOption.textContent = '⚡ Fast (10-30s)';

        const balancedOption = this.performanceModeSelect.createEl('option');
        balancedOption.value = 'balanced';
        balancedOption.textContent = '⚖️ Balanced (30-60s)';

        const qualityOption = this.performanceModeSelect.createEl('option');
        qualityOption.value = 'quality';
        qualityOption.textContent = '🎯 Quality (60-120s)';

        this.performanceModeSelect.value = this.performanceMode;
        this.performanceModeSelect.addEventListener('change', () => {
            this.performanceMode = this.performanceModeSelect!.value as PerformanceMode;
            this.handlePerformanceSettingsChange();
        });

        // Compact toggles
        const togglesContainer = container.createDiv();
        togglesContainer.style.display = 'flex';
        togglesContainer.style.gap = '16px';
        togglesContainer.style.marginTop = '6px';

        // Compact parallel toggle
        const parallelContainer = togglesContainer.createDiv();
        const parallelLabel = parallelContainer.createEl('label');
        parallelLabel.style.display = 'flex';
        parallelLabel.style.alignItems = 'center';
        parallelLabel.style.gap = '4px';
        parallelLabel.style.fontSize = '0.8rem';
        parallelLabel.style.cursor = 'pointer';
        parallelLabel.style.color = 'var(--text-normal)';

        const parallelToggle = parallelLabel.createEl('input');
        parallelToggle.type = 'checkbox';
        parallelToggle.id = 'parallel-toggle';
        parallelToggle.checked = this.enableParallelProcessing;
        parallelToggle.addEventListener('change', () => {
            this.enableParallelProcessing = parallelToggle.checked;
            this.handlePerformanceSettingsChange();
        });

        parallelLabel.appendChild(document.createTextNode('🔄 Parallel'));
        parallelContainer.appendChild(parallelLabel);

        // Compact multimodal toggle
        const multimodalContainer = togglesContainer.createDiv();
        const multimodalLabel = multimodalContainer.createEl('label');
        multimodalLabel.style.display = 'flex';
        multimodalLabel.style.alignItems = 'center';
        multimodalLabel.style.gap = '4px';
        multimodalLabel.style.fontSize = '0.8rem';
        multimodalLabel.style.cursor = 'pointer';
        multimodalLabel.style.color = 'var(--text-normal)';

        const multimodalToggle = multimodalLabel.createEl('input');
        multimodalToggle.type = 'checkbox';
        multimodalToggle.id = 'multimodal-toggle';
        multimodalToggle.checked = this.preferMultimodal;
        multimodalToggle.addEventListener('change', () => {
            this.preferMultimodal = multimodalToggle.checked;
            this.handlePerformanceSettingsChange();
        });

        multimodalLabel.appendChild(document.createTextNode('🎥 Multimodal'));
        multimodalContainer.appendChild(multimodalLabel);
    }

    /**
     * Create enhanced performance toggle component
     */
    private createPerformanceToggle(container: HTMLElement, id: string, icon: string, label: string, checked: boolean, onChange: (checked: boolean) => void, description: string): void {
        const toggleContainer = container.createDiv();
        toggleContainer.style.padding = '12px';
        toggleContainer.style.backgroundColor = 'var(--background-primary)';
        toggleContainer.style.borderRadius = '6px';
        toggleContainer.style.border = '1px solid var(--background-modifier-border)';
        toggleContainer.style.transition = 'all 0.2s ease';
        toggleContainer.style.cursor = 'pointer';

        const toggleHeader = toggleContainer.createDiv();
        toggleHeader.style.display = 'flex';
        toggleHeader.style.alignItems = 'center';
        toggleHeader.style.justifyContent = 'space-between';
        toggleHeader.style.marginBottom = '4px';

        const labelContainer = toggleHeader.createEl('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.alignItems = 'center';
        labelContainer.style.gap = '8px';

        const iconSpan = labelContainer.createEl('span');
        iconSpan.textContent = icon;
        iconSpan.style.fontSize = '1rem';

        const labelText = labelContainer.createEl('span');
        labelText.textContent = label;
        labelText.style.fontWeight = '500';
        labelText.style.color = 'var(--text-normal)';

        const toggle = toggleContainer.createEl('input');
        toggle.type = 'checkbox';
        toggle.id = id;
        toggle.checked = checked;
        toggle.style.width = '20px';
        toggle.style.height = '20px';
        toggle.style.cursor = 'pointer';

        const descriptionText = toggleContainer.createEl('div');
        descriptionText.textContent = description;
        descriptionText.style.fontSize = '0.8rem';
        descriptionText.style.color = 'var(--text-muted)';
        descriptionText.style.marginTop = '4px';
        descriptionText.style.lineHeight = '1.3';

        // Add hover effects
        toggleContainer.addEventListener('mouseenter', () => {
            toggleContainer.style.backgroundColor = 'var(--background-modifier-hover)';
            toggleContainer.style.borderColor = 'var(--interactive-accent)';
            toggleContainer.style.transform = 'translateY(-2px)';
            toggleContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        });

        toggleContainer.addEventListener('mouseleave', () => {
            toggleContainer.style.backgroundColor = 'var(--background-primary)';
            toggleContainer.style.borderColor = 'var(--background-modifier-border)';
            toggleContainer.style.transform = 'translateY(0)';
            toggleContainer.style.boxShadow = 'none';
        });

        toggle.addEventListener('change', () => onChange(toggle.checked));
    }

    /**
     * Add performance preview with mode descriptions
     */
    private addPerformancePreview(container: HTMLElement): void {
        const previewContainer = container.createDiv();
        previewContainer.style.marginTop = '16px';
        previewContainer.style.padding = '12px';
        previewContainer.style.backgroundColor = 'var(--background-modifier-hover)';
        previewContainer.style.borderRadius = '6px';
        previewContainer.style.border = '1px dashed var(--interactive-accent)';

        const previewTitle = previewContainer.createEl('div');
        previewTitle.textContent = '📋 Current Configuration';
        previewTitle.style.fontWeight = '600';
        previewTitle.style.marginBottom = '8px';
        previewTitle.style.color = 'var(--text-accent)';

        const previewText = previewContainer.createEl('div');
        previewText.className = 'ytc-performance-preview';
        previewText.style.fontSize = '0.85rem';
        previewText.style.lineHeight = '1.4';
        previewText.style.color = 'var(--text-muted)';
        this.updatePerformancePreview(previewText);
    }

    /**
     * Update performance preview text
     */
    private updatePerformancePreview(previewElement: HTMLDivElement): void {
        const modeText = this.performanceMode === 'fast' ? '⚡ Fast Mode' :
                      this.performanceMode === 'balanced' ? '⚖️ Balanced Mode' : '🎯 Quality Mode';
        const parallelText = this.enableParallelProcessing ? '🔄 Enabled' : '⏸️ Disabled';
        const multimodalText = this.preferMultimodal ? '🎥 Enabled' : '📄 Text Only';

        previewElement.innerHTML = `
            <strong>Mode:</strong> ${modeText}<br>
            <strong>Parallel Processing:</strong> ${parallelText}<br>
            <strong>Multimodal Analysis:</strong> ${multimodalText}
        `;
    }

    /**
     * Add subtle animation when performance mode changes
     */
    private addPerformanceModeAnimation(): void {
        const previewElement = document.querySelector('.ytc-performance-preview') as HTMLDivElement;
        if (previewElement) {
            previewElement.style.transition = 'all 0.3s ease';
            previewElement.style.transform = 'scale(1.02)';
            setTimeout(() => {
                previewElement.style.transform = 'scale(1)';
            }, 200);
        }
    }

    /**
     * Handle performance settings change
     */
    private async handlePerformanceSettingsChange(): Promise<void> {
        if (this.options.onPerformanceSettingsChange) {
            await this.options.onPerformanceSettingsChange(
                this.performanceMode,
                this.enableParallelProcessing,
                this.preferMultimodal
            );
        }
    }

    private createProviderSelectionSection(): void {
        const container = this.contentEl.createDiv();
        container.style.marginTop = '10px';
        const label = container.createEl('label', { text: 'AI Provider & Model:' });
        label.setAttribute('for', 'ytc-provider-select');

        const row = container.createDiv();
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';

        // Provider select with accessibility
        this.providerSelect = document.createElement('select');
        this.providerSelect.id = 'ytc-provider-select';
        this.providerSelect.setAttribute('aria-label', 'AI Provider');
        this.providerSelect.style.flex = '1';
        this.providerSelect.style.padding = '6px';
        this.providerSelect.style.borderRadius = '6px';
        this.providerSelect.style.border = '1px solid var(--background-modifier-border)';
        row.appendChild(this.providerSelect);

        // Model select with accessibility
        this.modelSelect = document.createElement('select');
        this.modelSelect.id = 'ytc-model-select';
        this.modelSelect.setAttribute('aria-label', 'AI Model');
        this.modelSelect.style.width = '220px';
        this.modelSelect.style.padding = '6px';
        this.modelSelect.style.borderRadius = '6px';
        this.modelSelect.style.border = '1px solid var(--background-modifier-border)';
        row.appendChild(this.modelSelect);

        // Populate providers if provided via options
        const providers = this.options.providers || [];
        const modelOptions = this.options.modelOptions || {};

        // Add an explicit 'Auto (fallback order)' option
        const autoOpt = document.createElement('option');
        autoOpt.value = '';
        autoOpt.text = 'Auto (fallback)';
        this.providerSelect.appendChild(autoOpt);

        providers.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.text = p;
            this.providerSelect!.appendChild(opt);
        });

        // Refresh models button
        const refreshBtn = this.createInlineButton(row, 'Refresh models', () => {
            void this.handleRefreshModels();
        });

        // Inline spinner next to refresh button
        this.refreshSpinner = document.createElement('span');
        this.refreshSpinner.style.display = 'none';
        this.refreshSpinner.style.marginLeft = '8px';
        this.refreshSpinner.style.width = '16px';
        this.refreshSpinner.style.height = '16px';
        this.refreshSpinner.style.border = '2px solid var(--background-modifier-border)';
        this.refreshSpinner.style.borderTop = '2px solid var(--interactive-accent)';
        this.refreshSpinner.style.borderRadius = '50%';
        this.refreshSpinner.style.animation = 'ytp-spin 1s linear infinite';
        row.appendChild(this.refreshSpinner);

        // Wire change handler
        this.providerSelect.addEventListener('change', () => {
            this.selectedProvider = this.providerSelect!.value || undefined;
            this.populateModelsForProvider(this.selectedProvider || '', modelOptions, this.options.defaultModel);
        });

        // Set defaults
        if (this.options.defaultProvider) {
            this.providerSelect.value = this.options.defaultProvider;
            this.selectedProvider = this.options.defaultProvider;
        }

        // Populate models for initial provider selection (or empty)
        this.populateModelsForProvider(this.selectedProvider || '', modelOptions, this.options.defaultModel);
    }

    private async handleRefreshModels(): Promise<void> {
        if (!this.options.fetchModels) {
            this.setValidationMessage('Model refresh not available.', 'error');
            return;
        }

        this.setValidationMessage('Refreshing model lists…', 'info');
        // show spinner
        if (this.refreshSpinner) this.refreshSpinner.style.display = 'inline-block';
        // disable refresh to avoid double clicks
        try {
            const map = await this.options.fetchModels();
            // update provider list if changed
            const providers = Object.keys(map);
            if (this.providerSelect) {
                // preserve current selection
                const current = this.providerSelect.value;
                this.providerSelect.innerHTML = '';
                const autoOpt = document.createElement('option');
                autoOpt.value = '';
                autoOpt.text = 'Auto (fallback)';
                this.providerSelect.appendChild(autoOpt);
                providers.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.text = p;
                    this.providerSelect!.appendChild(opt);
                });
                if (current && Array.from(this.providerSelect.options).some(o => o.value === current)) {
                    this.providerSelect.value = current;
                    this.selectedProvider = current;
                }
            }

            // update modelOptions and repopulate for selected provider
            const modelOptions = map;
            this.populateModelsForProvider(this.selectedProvider || '', modelOptions, this.options.defaultModel);
            this.setValidationMessage('Model lists refreshed.', 'success');
        } catch (error) {
            this.setValidationMessage('Failed to refresh models. Using cached options.', 'error');
        } finally {
            if (this.refreshSpinner) this.refreshSpinner.style.display = 'none';
        }
    }

    private populateModelsForProvider(providerName: string, modelOptions: Record<string, string[]>, defaultModel?: string): void {
        if (!this.modelSelect) return;
        // Clear existing
        this.modelSelect.innerHTML = '';

        const models = modelOptions[providerName] || [];
        if (models.length === 0) {
            // Add a single option indicating provider default
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = 'Default model';
            this.modelSelect.appendChild(opt);
            this.selectedModel = '';
            return;
        }

        models.forEach((m) => {
            const opt = document.createElement('option');
            opt.value = m;
            // If we have metadata in PROVIDER_MODEL_OPTIONS, show a small badge
            let label = m;
            try {
                const providerModels = PROVIDER_MODEL_OPTIONS[providerName] || [] as any[];
                const match = providerModels.find(pm => {
                    const name = typeof pm === 'string' ? pm : (pm && pm.name ? pm.name : '');
                    return String(name).toLowerCase() === String(m).toLowerCase();
                }) as any | undefined;
                if (match && match.supportsAudioVideo) {
                    label = `${m}  🎥`; // small camera emoji indicates multimodal-capable
                    opt.title = 'Supports multimodal audio/video tokens';
                }
            } catch (err) {
                // ignore and fall back to plain label
            }
            opt.text = label;
            this.modelSelect!.appendChild(opt);
        });

        if (defaultModel && models.includes(defaultModel)) {
            this.modelSelect.value = defaultModel;
            this.selectedModel = defaultModel;
        } else {
            this.modelSelect.selectedIndex = 0;
            this.selectedModel = this.modelSelect.value;
        }

        this.modelSelect.addEventListener('change', () => {
            this.selectedModel = this.modelSelect!.value;
        });
    }

    /**
     * Create URL input section
     */
    private createUrlInputSection(): void {
        const container = this.contentEl.createDiv();
        const label = container.createEl('label', { text: 'YouTube URL:' });
        label.setAttribute('for', 'ytc-url-input');
        
        const inputRow = container.createDiv();
        inputRow.style.display = 'flex';
        inputRow.style.gap = '8px';
        inputRow.style.alignItems = 'center';
        
        this.urlInput = this.createInput(
            inputRow,
            'url',
            MESSAGES.PLACEHOLDERS.YOUTUBE_URL + ' (Press Enter to process)'
        );
        this.urlInput.id = 'ytc-url-input';
        this.urlInput.setAttribute('aria-label', 'YouTube URL');
        this.urlInput.setAttribute('aria-describedby', 'ytc-url-hint');
        this.urlInput.style.flex = '1';
        this.urlInput.style.transition = 'border-color 0.2s ease, box-shadow 0.2s ease';
        
        this.pasteButton = this.createInlineButton(inputRow, 'Paste', () => {
            void this.handlePasteFromClipboard();
        });
        this.pasteButton.setAttribute('aria-label', 'Paste YouTube URL from clipboard');
        
        this.clearButton = this.createInlineButton(inputRow, 'Clear', () => {
            this.handleClearUrl();
        });
        this.clearButton.setAttribute('aria-label', 'Clear YouTube URL input');
        
        // Set initial value if provided
        if (this.options.initialUrl) {
            this.urlInput.value = this.options.initialUrl;
            this.url = this.options.initialUrl;
        }

        // Update URL state on input
        this.urlInput.addEventListener('input', (e) => {
            this.url = (e.target as HTMLInputElement).value;
            this.updateProcessButtonState();
            this.updateQuickActionsState();
        });

        this.validationMessage = container.createDiv();
        this.validationMessage.id = 'ytc-url-hint';
        this.validationMessage.style.marginTop = '6px';
        this.validationMessage.style.fontSize = '0.85rem';
        this.validationMessage.style.color = 'var(--text-muted)';
        this.validationMessage.setAttribute('role', 'status');
        this.setValidationMessage('Paste a YouTube link to begin processing.', 'info');

    // Preview container (thumbnail + metadata)
    const preview = container.createDiv();
    preview.style.display = 'flex';
    preview.style.gap = '8px';
    preview.style.alignItems = 'center';
    preview.style.marginTop = '6px';

    this.thumbnailEl = preview.createEl('img');
    this.thumbnailEl.setAttribute('aria-label', 'Video thumbnail');
    this.thumbnailEl.style.width = '90px';
    this.thumbnailEl.style.height = '50px';
    this.thumbnailEl.style.objectFit = 'cover';
    this.thumbnailEl.style.borderRadius = '4px';
    this.thumbnailEl.style.display = 'none';

    this.metadataContainer = preview.createDiv();
    this.metadataContainer.setAttribute('aria-label', 'Video metadata');
    this.metadataContainer.style.display = 'none';
    this.metadataContainer.style.fontSize = '0.9rem';
    this.metadataContainer.style.color = 'var(--text-normal)';
    this.metadataContainer.createDiv({ cls: 'yt-preview-title' });
    this.metadataContainer.createDiv({ cls: 'yt-preview-channel' });

        this.setUrlInputState('idle');
        this.updateQuickActionsState();
    }

    /**
     * Create compact format selection section
     */
    private createFormatSelectionSection(): void {
        const container = this.contentEl.createDiv();
        container.className = 'ytc-format-section';
        container.style.marginTop = '12px';
        container.style.padding = '8px';
        container.style.backgroundColor = 'var(--background-secondary)';
        container.style.borderRadius = '6px';
        container.style.border = '1px solid var(--background-modifier-border)';

        const label = container.createEl('label', { text: '📝 Format' });
        label.id = 'format-group-label';
        label.style.display = 'block';
        label.style.marginBottom = '8px';
        label.style.fontSize = '0.9rem';
        label.style.fontWeight = '600';
        label.style.color = 'var(--text-normal)';

        const radioContainer = container.createDiv();
        radioContainer.setAttribute('role', 'group');
        radioContainer.setAttribute('aria-labelledby', 'format-group-label');
        radioContainer.style.display = 'grid';
        radioContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
        radioContainer.style.gap = '8px';
        
        // Compact radio button creation
        try {
            this.createCompactFormatRadio(radioContainer, 'executive-radio', 'executive-summary', 'Executive', '', this.format === 'executive-summary');
            this.createCompactFormatRadio(radioContainer, 'tutorial-radio', 'detailed-guide', 'Tutorial', '', this.format === 'detailed-guide');
            this.createCompactFormatRadio(radioContainer, 'brief-radio', 'brief', 'Brief', '', this.format === 'brief');
            this.createCompactFormatRadio(radioContainer, 'custom-radio', 'custom', 'Custom', '', this.format === 'custom');
        } catch (error) {
            console.error('Error creating compact format radio buttons:', error);
            // Fallback to old method if compact method fails
            this.createFormatRadio(radioContainer, 'executive-radio', 'executive-summary', 'Executive', 'Quick insights with action items', this.format === 'executive-summary');
            this.createFormatRadio(radioContainer, 'tutorial-radio', 'detailed-guide', 'Tutorial', '📚 Step-by-step walkthrough', this.format === 'detailed-guide');
            this.createFormatRadio(radioContainer, 'brief-radio', 'brief', 'Brief', '📋 Key points and takeaways', this.format === 'brief');
            this.createFormatRadio(radioContainer, 'custom-radio', 'custom', 'Custom', '✏️ Your custom analysis', this.format === 'custom');
        }

        // Create custom prompt textarea container (initially hidden)
        this.customPromptContainer = container.createDiv();
        this.customPromptContainer.style.marginTop = '12px';
        this.customPromptContainer.style.padding = '12px';
        this.customPromptContainer.style.backgroundColor = 'var(--background-modifier-hover)';
        this.customPromptContainer.style.borderRadius = '4px';
        this.customPromptContainer.style.display = 'none';
        
        const customPromptLabel = this.customPromptContainer.createEl('label', {
            text: 'Custom Prompt (this session only):'
        });
        customPromptLabel.setAttribute('for', 'custom-prompt-input');
        customPromptLabel.style.display = 'block';
        customPromptLabel.style.marginBottom = '6px';
        customPromptLabel.style.fontWeight = '600';
        customPromptLabel.style.fontSize = '0.95rem';

        this.customPromptInput = this.customPromptContainer.createEl('textarea');
        this.customPromptInput.id = 'custom-prompt-input';
        this.customPromptInput.setAttribute('aria-label', 'Custom AI prompt');
        this.customPromptInput.setAttribute('placeholder', 'Enter your custom prompt here. Available placeholders: __VIDEO_TITLE__, __VIDEO_DESCRIPTION__, __VIDEO_URL__');
        this.customPromptInput.style.width = '100%';
        this.customPromptInput.style.height = '100px';
        this.customPromptInput.style.padding = '8px';
        this.customPromptInput.style.fontFamily = 'monospace';
        this.customPromptInput.style.fontSize = '12px';
        this.customPromptInput.style.border = '1px solid var(--background-modifier-border)';
        this.customPromptInput.style.borderRadius = '4px';
        this.customPromptInput.style.resize = 'vertical';
        this.customPromptInput.style.marginBottom = '6px';

        const helpText = this.customPromptContainer.createEl('small');
        helpText.textContent = 'Placeholders: __VIDEO_TITLE__, __VIDEO_DESCRIPTION__, __VIDEO_URL__, __VIDEO_ID__, __EMBED_URL__, __DATE__, __TIMESTAMP__';
        helpText.style.display = 'block';
        helpText.style.marginTop = '4px';
        helpText.style.color = 'var(--text-muted)';
        helpText.style.fontSize = '11px';
    }

    /**
     * Create enhanced format radio button
     */
    private createFormatRadio(container: HTMLElement, id: string, value: string, title: string, description: string, isChecked: boolean): void {
        const radioContainer = container.createDiv();
        radioContainer.style.padding = '12px';
        radioContainer.style.border = '2px solid var(--background-modifier-border)';
        radioContainer.style.borderRadius = '8px';
        radioContainer.style.backgroundColor = 'var(--background-primary)';
        radioContainer.style.cursor = 'pointer';
        radioContainer.style.transition = 'all 0.2s ease';
        radioContainer.style.textAlign = 'center';

        const radio = radioContainer.createEl('input');
        radio.type = 'radio';
        radio.name = 'outputFormat';
        radio.value = value;
        radio.id = id;
        radio.checked = isChecked;
        radio.style.marginBottom = '8px';

        const icon = radioContainer.createEl('div');
        icon.style.fontSize = '1.5rem';
        icon.style.marginBottom = '4px';

        // Set icon based on format type
        if (value === 'executive-summary') {
            icon.textContent = '🎯';
        } else if (value === 'detailed-guide') {
            icon.textContent = '📚';
        } else if (value === 'brief') {
            icon.textContent = '📋';
        } else if (value === 'custom') {
            icon.textContent = '✏️';
        }

        const titleElement = radioContainer.createEl('div');
        titleElement.textContent = title;
        titleElement.style.fontWeight = '600';
        titleElement.style.fontSize = '0.9rem';
        titleElement.style.marginBottom = '2px';

        const descElement = radioContainer.createEl('div');
        descElement.textContent = description;
        descElement.style.fontSize = '0.75rem';
        descElement.style.color = 'var(--text-muted)';

        // Add hover and selection effects
        if (isChecked) {
            radioContainer.style.borderColor = 'var(--interactive-accent)';
            radioContainer.style.backgroundColor = 'var(--interactive-accent-hover)';
        }

        radioContainer.addEventListener('mouseenter', () => {
            radioContainer.style.borderColor = 'var(--interactive-accent)';
            radioContainer.style.transform = 'translateY(-2px)';
            radioContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        });

        radioContainer.addEventListener('mouseleave', () => {
            if (!radio.checked) {
                radioContainer.style.borderColor = 'var(--background-modifier-border)';
                radioContainer.style.transform = 'translateY(0)';
                radioContainer.style.boxShadow = 'none';
            }
        });

        radio.addEventListener('change', (e) => {
            if ((e.target as HTMLInputElement).checked) {
                this.format = value as OutputFormat;

                // Update all radio containers
                const allContainers = container.querySelectorAll('div');
                allContainers.forEach((containerEl: Element) => {
                    const divEl = containerEl as HTMLDivElement;
                    divEl.style.borderColor = 'var(--background-modifier-border)';
                    divEl.style.backgroundColor = 'var(--background-primary)';
                });

                radioContainer.style.borderColor = 'var(--interactive-accent)';
                radioContainer.style.backgroundColor = 'var(--interactive-accent-hover)';

                // Handle custom prompt visibility
                if (this.customPromptContainer) {
                    if (value === 'custom') {
                        this.customPromptContainer.style.display = 'block';
                        this.customPromptInput?.focus();
                    } else {
                        this.customPromptContainer.style.display = 'none';
                    }
                }
            }
        });

        // Click container to select radio
        radioContainer.addEventListener('click', () => {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        });
    }

    /**
     * Create compact format radio button
     */
    private createCompactFormatRadio(container: HTMLElement, id: string, value: string, title: string, icon: string, isChecked: boolean): void {
        const radioContainer = container.createDiv();
        radioContainer.style.padding = '8px 4px';
        radioContainer.style.border = '1px solid var(--background-modifier-border)';
        radioContainer.style.borderRadius = '4px';
        radioContainer.style.backgroundColor = 'var(--background-primary)';
        radioContainer.style.cursor = 'pointer';
        radioContainer.style.transition = 'all 0.2s ease';
        radioContainer.style.textAlign = 'center';

        const radio = radioContainer.createEl('input');
        radio.type = 'radio';
        radio.name = 'outputFormat';
        radio.value = value;
        radio.id = id;
        radio.checked = isChecked;
        radio.style.marginBottom = '4px';

        // Only show icon if it exists
        if (icon) {
            const iconEl = radioContainer.createEl('div');
            iconEl.textContent = icon;
            iconEl.style.fontSize = '1.2rem';
            iconEl.style.marginBottom = '2px';
        }

        const titleElement = radioContainer.createEl('div');
        titleElement.textContent = title;
        titleElement.style.fontWeight = '500';
        titleElement.style.fontSize = '0.8rem';

        // Add hover and selection effects
        if (isChecked) {
            radioContainer.style.borderColor = 'var(--interactive-accent)';
            radioContainer.style.backgroundColor = 'var(--interactive-accent-hover)';
        }

        radioContainer.addEventListener('mouseenter', () => {
            radioContainer.style.borderColor = 'var(--interactive-accent)';
            radioContainer.style.transform = 'translateY(-1px)';
        });

        radioContainer.addEventListener('mouseleave', () => {
            if (!radio.checked) {
                radioContainer.style.borderColor = 'var(--background-modifier-border)';
                radioContainer.style.transform = 'translateY(0)';
            }
        });

        radio.addEventListener('change', (e) => {
            if ((e.target as HTMLInputElement).checked) {
                this.format = value as OutputFormat;

                // Update all radio containers
                const allContainers = container.querySelectorAll('div');
                allContainers.forEach((containerEl: Element) => {
                    const divEl = containerEl as HTMLDivElement;
                    divEl.style.borderColor = 'var(--background-modifier-border)';
                    divEl.style.backgroundColor = 'var(--background-primary)';
                });

                radioContainer.style.borderColor = 'var(--interactive-accent)';
                radioContainer.style.backgroundColor = 'var(--interactive-accent-hover)';

                // Handle custom prompt visibility
                if (this.customPromptContainer) {
                    if (value === 'custom') {
                        this.customPromptContainer.style.display = 'block';
                        this.customPromptInput?.focus();
                    } else {
                        this.customPromptContainer.style.display = 'none';
                    }
                }
            }
        });

        // Click container to select radio
        radioContainer.addEventListener('click', () => {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        });
    }

    
    
    /**
     * Create model parameters section with sliders for max tokens and temperature
     */
    private createModelParametersSection(): void {
        const container = this.contentEl.createDiv();
        container.className = 'ytc-model-params-section';
        container.style.marginTop = '16px';
        container.style.padding = '16px';
        container.style.backgroundColor = 'var(--background-secondary)';
        container.style.borderRadius = '8px';
        container.style.border = '1px solid var(--background-modifier-border-hover)';
        container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

        // Header
        const headerContainer = container.createDiv();
        headerContainer.className = 'ytc-model-params-header';
        headerContainer.style.display = 'flex';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.marginBottom = '16px';

        const sectionHeader = headerContainer.createEl('h3');
        sectionHeader.textContent = '⚙️ Model Parameters';
        sectionHeader.style.margin = '0';
        sectionHeader.style.fontSize = '1rem';
        sectionHeader.style.fontWeight = '600';
        sectionHeader.style.color = 'var(--text-normal)';
        sectionHeader.style.display = 'flex';
        sectionHeader.style.alignItems = 'center';
        sectionHeader.style.gap = '8px';

        const description = headerContainer.createDiv();
        description.className = 'ytc-model-params-description';
        description.textContent = 'Fine-tune AI model behavior for optimal results';
        description.style.fontSize = '0.75rem';
        description.style.color = 'var(--text-muted)';
        description.style.fontWeight = '400';

        // Max Tokens Slider
        const maxTokensContainer = container.createDiv();
        maxTokensContainer.className = 'ytc-slider-container';
        maxTokensContainer.style.marginBottom = '20px';

        const maxTokensHeader = maxTokensContainer.createDiv();
        maxTokensHeader.className = 'ytc-slider-header';
        maxTokensHeader.style.display = 'flex';
        maxTokensHeader.style.alignItems = 'center';
        maxTokensHeader.style.justifyContent = 'space-between';
        maxTokensHeader.style.marginBottom = '8px';

        const maxTokensLabel = maxTokensHeader.createEl('label');
        maxTokensLabel.textContent = 'Max Tokens';
        maxTokensLabel.className = 'ytc-slider-label';
        maxTokensLabel.style.fontSize = '0.9rem';
        maxTokensLabel.style.fontWeight = '600';
        maxTokensLabel.style.color = 'var(--text-normal)';
        maxTokensLabel.style.margin = '0';
        maxTokensLabel.style.display = 'flex';
        maxTokensLabel.style.alignItems = 'center';
        maxTokensLabel.style.gap = '6px';

        const maxTokensInfo = maxTokensHeader.createSpan();
        maxTokensInfo.className = 'ytc-slider-info';
        maxTokensInfo.textContent = 'Controls response length';
        maxTokensInfo.style.fontSize = '0.75rem';
        maxTokensInfo.style.color = 'var(--text-muted)';
        maxTokensInfo.style.fontWeight = '400';

        const maxTokensRow = maxTokensContainer.createDiv();
        maxTokensRow.className = 'ytc-slider-row';
        maxTokensRow.style.display = 'flex';
        maxTokensRow.style.alignItems = 'center';
        maxTokensRow.style.gap = '12px';
        maxTokensRow.style.padding = '12px';
        maxTokensRow.style.backgroundColor = 'var(--background-primary)';
        maxTokensRow.style.borderRadius = '6px';
        maxTokensRow.style.border = '1px solid var(--background-modifier-border)';

        // Create slider container for better control
        const sliderContainer = maxTokensRow.createDiv();
        sliderContainer.style.position = 'relative';
        sliderContainer.style.flex = '1';
        sliderContainer.style.height = '32px';
        sliderContainer.style.display = 'flex';
        sliderContainer.style.alignItems = 'center';

        this.maxTokensSlider = sliderContainer.createEl('input') as HTMLInputElement;
        this.maxTokensSlider.type = 'range';
        this.maxTokensSlider.min = '256';
        this.maxTokensSlider.max = '8192';
        this.maxTokensSlider.step = '256';
        this.maxTokensSlider.value = this.maxTokens.toString();
        this.maxTokensSlider.className = 'ytc-model-slider';
        this.maxTokensSlider.style.flex = '1';
        this.maxTokensSlider.style.margin = '0 8px';

        this.maxTokensValue = maxTokensRow.createDiv();
        this.maxTokensValue.className = 'ytc-slider-value';
        this.maxTokensValue.textContent = this.maxTokens.toString();
        this.maxTokensValue.style.fontSize = '0.9rem';
        this.maxTokensValue.style.fontWeight = '700';
        this.maxTokensValue.style.color = 'var(--text-accent)';
        this.maxTokensValue.style.minWidth = '70px';
        this.maxTokensValue.style.textAlign = 'center';
        this.maxTokensValue.style.padding = '6px 12px';
        this.maxTokensValue.style.backgroundColor = 'var(--background-secondary)';
        this.maxTokensValue.style.borderRadius = '4px';
        this.maxTokensValue.style.border = '1px solid var(--background-modifier-border)';

        // Temperature Slider
        const temperatureContainer = container.createDiv();
        temperatureContainer.className = 'ytc-slider-container';
        temperatureContainer.style.marginBottom = '8px';

        const temperatureHeader = temperatureContainer.createDiv();
        temperatureHeader.className = 'ytc-slider-header';
        temperatureHeader.style.display = 'flex';
        temperatureHeader.style.alignItems = 'center';
        temperatureHeader.style.justifyContent = 'space-between';
        temperatureHeader.style.marginBottom = '8px';

        const temperatureLabel = temperatureHeader.createEl('label');
        temperatureLabel.textContent = 'Temperature';
        temperatureLabel.className = 'ytc-slider-label';
        temperatureLabel.style.fontSize = '0.9rem';
        temperatureLabel.style.fontWeight = '600';
        temperatureLabel.style.color = 'var(--text-normal)';
        temperatureLabel.style.margin = '0';
        temperatureLabel.style.display = 'flex';
        temperatureLabel.style.alignItems = 'center';
        temperatureLabel.style.gap = '6px';

        const temperatureInfo = temperatureHeader.createSpan();
        temperatureInfo.className = 'ytc-slider-info';
        temperatureInfo.textContent = 'Controls creativity level';
        temperatureInfo.style.fontSize = '0.75rem';
        temperatureInfo.style.color = 'var(--text-muted)';
        temperatureInfo.style.fontWeight = '400';

        const temperatureRow = temperatureContainer.createDiv();
        temperatureRow.className = 'ytc-slider-row';
        temperatureRow.style.display = 'flex';
        temperatureRow.style.alignItems = 'center';
        temperatureRow.style.gap = '12px';
        temperatureRow.style.padding = '12px';
        temperatureRow.style.backgroundColor = 'var(--background-primary)';
        temperatureRow.style.borderRadius = '6px';
        temperatureRow.style.border = '1px solid var(--background-modifier-border)';

        const tempSliderContainer = temperatureRow.createDiv();
        tempSliderContainer.style.position = 'relative';
        tempSliderContainer.style.flex = '1';
        tempSliderContainer.style.height = '32px';
        tempSliderContainer.style.display = 'flex';
        tempSliderContainer.style.alignItems = 'center';

        this.temperatureSlider = tempSliderContainer.createEl('input') as HTMLInputElement;
        this.temperatureSlider.type = 'range';
        this.temperatureSlider.min = '0';
        this.temperatureSlider.max = '2';
        this.temperatureSlider.step = '0.1';
        this.temperatureSlider.value = this.temperature.toString();
        this.temperatureSlider.className = 'ytc-model-slider';
        this.temperatureSlider.style.flex = '1';
        this.temperatureSlider.style.margin = '0 8px';

        this.temperatureValue = temperatureRow.createDiv();
        this.temperatureValue.className = 'ytc-slider-value';
        this.temperatureValue.textContent = this.temperature.toFixed(1);
        this.temperatureValue.style.fontSize = '0.9rem';
        this.temperatureValue.style.fontWeight = '700';
        this.temperatureValue.style.color = 'var(--text-accent)';
        this.temperatureValue.style.minWidth = '60px';
        this.temperatureValue.style.textAlign = 'center';
        this.temperatureValue.style.padding = '6px 12px';
        this.temperatureValue.style.backgroundColor = 'var(--background-secondary)';
        this.temperatureValue.style.borderRadius = '4px';
        this.temperatureValue.style.border = '1px solid var(--background-modifier-border)';

        // Temperature scale labels
        const tempScale = temperatureRow.createDiv();
        tempScale.className = 'ytc-temp-scale';
        tempScale.style.fontSize = '0.75rem';
        tempScale.style.color = 'var(--text-muted)';
        tempScale.style.fontWeight = '500';
        tempScale.style.display = 'flex';
        tempScale.style.justifyContent = 'space-between';
        tempScale.style.padding = '0 12px';
        tempScale.style.width = '100%';
        tempScale.style.marginTop = '8px';
        tempScale.innerHTML = '<span style="text-align: left;">0.0</span><span style="text-align: center;">Precise</span><span style="text-align: center;">Balanced</span><span style="text-align: center;">Creative</span><span style="text-align: right;">2.0</span>';

        // Add comprehensive CSS styling
        this.addSliderStyling();

        // Add event listeners
        this.maxTokensSlider.addEventListener('input', (e) => {
            this.maxTokens = parseInt((e.target as HTMLInputElement).value);
            this.maxTokensValue!.textContent = this.maxTokens.toString();
        });

        this.temperatureSlider.addEventListener('input', (e) => {
            this.temperature = parseFloat((e.target as HTMLInputElement).value);
            this.temperatureValue!.textContent = this.temperature.toFixed(1);
        });
    }

    /**
     * Add comprehensive CSS styling for sliders
     */
    private addSliderStyling(): void {
        const style = document.createElement('style');
        style.textContent = `
            .ytc-model-slider {
                -webkit-appearance: none;
                appearance: none;
                background: transparent;
                cursor: pointer;
                width: 100%;
                height: 4px;
                outline: none;
                position: relative;
                z-index: 1;
            }

            .ytc-model-slider::-webkit-slider-track {
                background: var(--interactive-normal);
                height: 4px;
                border-radius: 2px;
            }

            .ytc-model-slider::-moz-range-track {
                background: var(--interactive-normal);
                height: 4px;
                border-radius: 2px;
                border: none;
            }

            .ytc-model-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--interactive-accent);
                cursor: pointer;
                border: 3px solid var(--background-primary);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                margin-top: -7px;
                position: relative;
                z-index: 2;
                transition: all 0.2s ease;
            }

            .ytc-model-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: var(--interactive-accent);
                cursor: pointer;
                border: 3px solid var(--background-primary);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                position: relative;
                z-index: 2;
                transition: all 0.2s ease;
            }

            .ytc-model-slider:hover::-webkit-slider-thumb {
                background: var(--interactive-accent-hover);
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .ytc-model-slider:hover::-moz-range-thumb {
                background: var(--interactive-accent-hover);
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .ytc-model-slider:focus {
                outline: none;
            }

            .ytc-model-slider:focus::-webkit-slider-thumb {
                border-color: var(--interactive-accent);
                box-shadow: 0 0 0 3px var(--interactive-accent), 0 2px 8px rgba(0,0,0,0.3);
            }

            .ytc-model-slider:focus::-moz-range-thumb {
                border-color: var(--interactive-accent);
                box-shadow: 0 0 0 3px var(--interactive-accent), 0 2px 8px rgba(0,0,0,0.3);
            }

            .ytc-slider-row {
                transition: all 0.2s ease;
            }

            .ytc-slider-row:hover {
                border-color: var(--interactive-accent);
                box-shadow: 0 2px 12px rgba(0,0,0,0.1);
            }

            .ytc-slider-value {
                transition: all 0.2s ease;
                font-variant-numeric: tabular-nums;
            }

            .ytc-model-params-section:hover {
                border-color: var(--interactive-accent);
                box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            }

            .ytc-temp-scale span {
                flex: 1;
                text-align: center;
                position: relative;
            }

            .ytc-temp-scale span::before {
                content: '';
                position: absolute;
                bottom: -4px;
                left: 0;
                right: 0;
                height: 1px;
                background: var(--background-modifier-border);
            }

            .ytc-temp-scale span:first-child::before {
                left: 50%;
            }

            .ytc-temp-scale span:last-child::before {
                right: 50%;
            }

            /* Dark theme adjustments */
            body.theme-dark .ytc-slider-row {
                background: var(--background-primary-alt);
            }

            body.theme-dark .ytc-slider-value {
                background: var(--background-primary-alt);
            }

            /* High contrast theme adjustments */
            body.theme-high-contrast .ytc-model-slider {
                background: var(--text-normal);
            }

            body.theme-high-contrast .ytc-model-slider::-webkit-slider-track {
                background: var(--text-muted);
            }

            body.theme-high-contrast .ytc-model-slider::-webkit-slider-thumb {
                background: var(--text-accent);
                border-color: var(--background-primary);
            }
        `;

        if (!document.querySelector('style[data-ytc-model-params]')) {
            style.setAttribute('data-ytc-model-params', 'true');
            document.head.appendChild(style);
        }
    }

    /**
     * Create streamlined advanced settings drawer
     */
    private createAdvancedSettingsDrawer(): void {
        // Add custom CSS for enhanced styling
        this.addEnhancedStyles();

        // Main drawer container
        const drawerContainer = this.contentEl.createDiv();
        drawerContainer.className = 'ytc-streamlined-drawer';
        drawerContainer.style.cssText = `
            margin: 20px 0;
            border-radius: 16px;
            background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.2);
            overflow: hidden;
            transition: all 0.3s ease;
            border: 1px solid var(--interactive-accent);
        `;

        // Streamlined drawer toggle button
        this.drawerToggle = drawerContainer.createEl('button');
        this.drawerToggle.className = 'ytc-drawer-toggle-streamlined';
        this.drawerToggle.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.3rem;">⚙️</span>
                    <span style="font-weight: 600; font-size: 0.95rem; color: white;">AI Settings</span>
                    <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">ADVANCED</span>
                </div>
                <div class="drawer-chevron" style="
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: rotate(0deg);
                    color: white;
                    font-size: 0.9rem;
                ">▶</div>
            </div>
        `;

        this.drawerToggle.style.cssText = `
            width: 100%;
            padding: 16px 24px;
            background: transparent;
            border: none;
            border-radius: 0;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            color: white;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        `;

        // Click handler
        this.drawerToggle.addEventListener('click', (e) => {
            this.createRippleEffect(e, this.drawerToggle);
            this.toggleDrawer();
        });

        // Drawer content with smooth animations
        this.drawerContent = drawerContainer.createDiv();
        this.drawerContent.className = 'ytc-drawer-content-streamlined';
        this.drawerContent.style.cssText = `
            max-height: 0px;
            opacity: 0;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            background: var(--background-primary);
            backdrop-filter: blur(20px);
            border-top: 1px solid var(--background-modifier-border);
        `;

        // Inner content with compact layout
        const innerContent = this.drawerContent.createDiv();
        innerContent.style.cssText = `
            padding: 32px;
            display: flex;
            flex-direction: column;
            gap: 32px;
            max-height: 600px;
            overflow-y: auto;
        `;

        // Streamlined sections (2x2 grid)
        const gridContainer = innerContent.createDiv();
        gridContainer.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        `;

        // Left column
        const leftColumn = gridContainer.createDiv();
        leftColumn.style.cssText = 'display: flex; flex-direction: column; gap: 24px;';

        // Right column
        const rightColumn = gridContainer.createDiv();
        rightColumn.style.cssText = 'display: flex; flex-direction: column; gap: 24px;';

        // Streamlined sections
        this.createStreamlinedProviderSection(leftColumn);
        this.createStreamlinedControlsSection(leftColumn);
        this.createStreamlinedPerformanceSection(rightColumn);
        this.createStreamlinedTipsSection(rightColumn);
    }

    /**
     * Add enhanced CSS styles
     */
    private addEnhancedStyles(): void {
        if (!document.getElementById('ytc-enhanced-styles')) {
            const style = document.createElement('style');
            style.id = 'ytc-enhanced-styles';
            style.textContent = `
                .ytc-enhanced-drawer {
                    --gradient-1: var(--interactive-accent);
                    --gradient-2: var(--interactive-accent-hover);
                    --accent-rgb: 99, 102, 241;
                }

                .ytc-drawer-toggle-enhanced::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s;
                }

                .ytc-drawer-toggle-enhanced:hover::before {
                    left: 100%;
                }

                .ytc-input-enhanced, .ytc-select-enhanced {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                }

                .ytc-input-enhanced:hover, .ytc-select-enhanced:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: var(--interactive-accent);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .ytc-input-enhanced:focus, .ytc-select-enhanced:focus {
                    outline: none;
                    border-color: var(--interactive-accent);
                    background: rgba(255,255,255,0.1);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }

                .ytc-section-card {
                    background: rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                }

                .ytc-section-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                    border-color: var(--interactive-accent);
                }

                .ytc-slider-enhanced {
                    -webkit-appearance: none;
                    appearance: none;
                    background: linear-gradient(to right, var(--interactive-accent) 0%, var(--interactive-accent) var(--value, 50%), var(--interactive-normal) var(--value, 50%), var(--interactive-normal) 100%);
                    border-radius: 10px;
                    height: 8px;
                    outline: none;
                    transition: all 0.3s ease;
                }

                .ytc-slider-enhanced::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: var(--interactive-accent);
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                }

                .ytc-slider-enhanced::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
                }

                .ytc-badge {
                    background: var(--interactive-accent);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    display: inline-block;
                    margin-left: 8px;
                }

                @keyframes fadeInScale {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .ytc-fade-in {
                    animation: fadeInScale 0.4s ease-out;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create provider selection section
     */
    private createProviderSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.className = 'ytc-section-card ytc-fade-in';
        section.style.animationDelay = '0.1s';

        const header = section.createDiv();
        header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;';

        const title = header.createEl('h4');
        title.textContent = '🤖 AI Provider';
        title.style.cssText = 'margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-normal);';

        const badge = header.createSpan();
        badge.className = 'ytc-badge';
        badge.textContent = 'AI';

        this.providerDropdown = section.createEl('select');
        this.providerDropdown.className = 'ytc-select-enhanced';
        this.providerDropdown.style.cssText = `
            width: 100%;
            padding: 12px;
            border-radius: 8px;
            font-size: 0.9rem;
            color: var(--text-normal);
        `;

        this.options.providers.forEach(provider => {
            const option = this.providerDropdown.createEl('option');
            option.value = provider;
            option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
        });

        // Add provider info
        const info = section.createDiv();
        info.style.cssText = 'margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);';
        info.textContent = 'Select your preferred AI provider for video processing';
    }

    /**
     * Create model selection section
     */
    private createModelSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.className = 'ytc-section-card ytc-fade-in';
        section.style.animationDelay = '0.2s';

        const header = section.createDiv();
        header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;';

        const title = header.createEl('h4');
        title.textContent = '🧠 AI Model';
        title.style.cssText = 'margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-normal);';

        const refreshBtn = header.createEl('button');
        refreshBtn.innerHTML = '🔄 Refresh';
        refreshBtn.style.cssText = `
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.3s ease;
        `;

        this.modelDropdown = section.createEl('select');
        this.modelDropdown.className = 'ytc-select-enhanced';
        this.modelDropdown.style.cssText = `
            width: 100%;
            padding: 12px;
            border-radius: 8px;
            font-size: 0.9rem;
            color: var(--text-normal);
        `;

        // Add model options with descriptions
        const models = [
            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Latest & most capable' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', desc: 'Balanced performance' },
            { value: 'gpt-4', label: 'GPT-4', desc: 'High quality analysis' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', desc: 'Fast processing' }
        ];

        models.forEach(model => {
            const option = this.modelDropdown.createEl('option');
            option.value = model.value;
            option.textContent = `${model.label} - ${model.desc}`;
        });
    }

    /**
     * Create advanced controls section
     */
    private createAdvancedControlsSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.className = 'ytc-section-card ytc-fade-in';
        section.style.animationDelay = '0.3s';

        const title = section.createEl('h4');
        title.textContent = '⚙️ Advanced Controls';
        title.style.cssText = 'margin: 0 0 20px 0; font-size: 1rem; font-weight: 600; color: var(--text-normal);';

        // Max Tokens
        const tokensControl = section.createDiv();
        tokensControl.style.cssText = 'margin-bottom: 20px;';

        const tokensLabel = tokensControl.createDiv();
        tokensLabel.innerHTML = '📊 Max Tokens: <span style="color: var(--interactive-accent); font-weight: 600;">4096</span>';
        tokensLabel.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 500;';

        this.maxTokensSlider = tokensControl.createEl('input');
        this.maxTokensSlider.type = 'range';
        this.maxTokensSlider.min = '256';
        this.maxTokensSlider.max = '8192';
        this.maxTokensSlider.step = '256';
        this.maxTokensSlider.value = '4096';
        this.maxTokensSlider.className = 'ytc-slider-enhanced';
        this.maxTokensSlider.style.cssText = 'width: 100%;';

        this.maxTokensSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            (tokensLabel.querySelector('span') as HTMLSpanElement).textContent = value;
            this.maxTokensSlider.style.setProperty('--value', `${(parseInt(value) - 256) / (8192 - 256) * 100}%`);
        });

        // Temperature
        const tempControl = section.createDiv();

        const tempLabel = tempControl.createDiv();
        tempLabel.innerHTML = '🌡️ Temperature: <span style="color: var(--interactive-accent); font-weight: 600;">0.5</span>';
        tempLabel.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 500;';

        this.temperatureSlider = tempControl.createEl('input');
        this.temperatureSlider.type = 'range';
        this.temperatureSlider.min = '0';
        this.temperatureSlider.max = '2';
        this.temperatureSlider.step = '0.1';
        this.temperatureSlider.value = '0.5';
        this.temperatureSlider.className = 'ytc-slider-enhanced';
        this.temperatureSlider.style.cssText = 'width: 100%;';

        this.temperatureSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            (tempLabel.querySelector('span') as HTMLSpanElement).textContent = value;
            this.temperatureSlider.style.setProperty('--value', `${(parseFloat(value) / 2) * 100}%`);
        });

        // Initialize slider values
        this.maxTokensSlider.style.setProperty('--value', '50%');
        this.temperatureSlider.style.setProperty('--value', '25%');
    }

    /**
     * Create enhanced performance section for drawer
     */
    private createEnhancedPerformanceSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.className = 'ytc-section-card ytc-fade-in';
        section.style.animationDelay = '0.4s';

        const title = section.createEl('h4');
        title.textContent = '⚡ Performance';
        title.style.cssText = 'margin: 0 0 16px 0; font-size: 1rem; font-weight: 600; color: var(--text-normal);';

        // Performance mode selector
        const perfContainer = section.createDiv();
        perfContainer.style.cssText = 'margin-bottom: 16px;';

        const perfLabel = perfContainer.createDiv();
        perfLabel.textContent = 'Performance Mode:';
        perfLabel.style.cssText = 'margin-bottom: 8px; font-weight: 500;';

        const perfOptions = ['Fast', 'Balanced', 'Quality'];
        const perfButtons = perfContainer.createDiv();
        perfButtons.style.cssText = 'display: flex; gap: 8px;';

        perfOptions.forEach((option, index) => {
            const btn = perfButtons.createEl('button');
            btn.textContent = option;
            btn.style.cssText = `
                flex: 1;
                padding: 8px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.8rem;
            `;

            if (index === 1) btn.style.background = 'var(--interactive-accent)';

            btn.addEventListener('click', () => {
                perfButtons.querySelectorAll('button').forEach(b => {
                    b.style.background = 'rgba(255,255,255,0.05)';
                });
                btn.style.background = 'var(--interactive-accent)';
            });
        });

        // Additional settings
        const settingsContainer = section.createDiv();

        const settings = [
            { label: 'Enable parallel processing', checked: true },
            { label: 'Prefer multimodal analysis', checked: true },
            { label: 'Use smart defaults', checked: false }
        ];

        settings.forEach(setting => {
            const settingItem = settingsContainer.createDiv();
            settingItem.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px;';

            const checkbox = settingItem.createEl('input');
            checkbox.type = 'checkbox';
            checkbox.checked = setting.checked;
            checkbox.style.cssText = 'margin-right: 8px; cursor: pointer;';

            const label = settingItem.createEl('label');
            label.textContent = setting.label;
            label.style.cssText = 'cursor: pointer; font-size: 0.85rem;';
        });
    }

    /**
     * Create streamlined provider section
     */
    private createStreamlinedProviderSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.style.cssText = `
            background: var(--background-secondary);
            border-radius: 16px;
            padding: 20px;
            border: 1px solid var(--background-modifier-border);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        `;

        // Add hover effect
        section.addEventListener('mouseenter', () => {
            section.style.borderColor = 'var(--interactive-accent)';
            section.style.transform = 'translateY(-2px)';
            section.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
        });
        section.addEventListener('mouseleave', () => {
            section.style.borderColor = 'var(--background-modifier-border)';
            section.style.transform = 'translateY(0)';
            section.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        });

        const header = section.createDiv();
        header.innerHTML = '<span style="font-size: 1.2rem; margin-right: 8px;">🤖</span>AI Provider & Model';
        header.style.cssText = 'font-weight: 600; margin-bottom: 16px; color: var(--text-normal);';

        // Provider label
        const providerLabel = section.createEl('label');
        providerLabel.textContent = 'AI Provider';
        providerLabel.style.cssText = `
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text-normal);
            font-size: 0.9rem;
        `;

        // Provider dropdown
        this.providerDropdown = section.createEl('select');
        this.providerDropdown.setAttribute('aria-label', 'AI Provider');
        this.providerDropdown.style.cssText = `
            width: 100%;
            padding: 14px 40px 14px 12px;
            border: 2px solid var(--background-modifier-border);
            border-radius: 10px;
            margin-bottom: 16px;
            font-size: 0.95rem;
            font-weight: 500;
            background: var(--background-primary) url('data:image/svg+xml;utf8,<svg fill="%23888888" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>') no-repeat right 10px center;
            background-size: 20px;
            color: var(--text-normal);
            transition: all 0.3s ease;
            cursor: pointer;
            appearance: none;
        `;

        // Add option styling for better visibility using inline styles
        this.providerDropdown.style.cssText += `
            -webkit-appearance: none;
            -moz-appearance: none;
        `;

        this.providerDropdown.className = 'ytc-provider-select';

        // Add provider options with better labels
        if (this.options.providers && this.options.providers.length > 0) {
            this.options.providers.forEach(provider => {
                const option = this.providerDropdown.createEl('option');
                option.value = provider;
                option.textContent = this.formatProviderName(provider);
                option.style.cssText = 'background: var(--background-primary); color: var(--text-normal); font-weight: 500;';
                if (provider === this.options.defaultProvider) {
                    option.selected = true;
                }
            });
        } else {
            // Fallback providers if options is empty
            const fallbackProviders = ['gemini', 'groq'];
            fallbackProviders.forEach(provider => {
                const option = this.providerDropdown.createEl('option');
                option.value = provider;
                option.textContent = this.formatProviderName(provider);
                option.style.cssText = 'background: var(--background-primary); color: var(--text-normal); font-weight: 500;';
                if (provider === 'gemini') {
                    option.selected = true;
                }
            });
        }

        // Model label
        const modelLabel = section.createEl('label');
        modelLabel.textContent = 'AI Model';
        modelLabel.style.cssText = providerLabel.style.cssText;

        // Model dropdown
        this.modelDropdown = section.createEl('select');
        this.modelDropdown.setAttribute('aria-label', 'AI Model');
        this.modelDropdown.style.cssText = this.providerDropdown.style.cssText;
        this.modelDropdown.style.marginBottom = '0';
        this.modelDropdown.className = 'ytc-model-select';

        // Add model options with better labels
        const models = [
            { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Latest)' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ];

        models.forEach(model => {
            const option = this.modelDropdown.createEl('option');
            option.value = model.value;
            option.textContent = model.label;
            option.style.cssText = 'background: var(--background-primary); color: var(--text-normal); font-weight: 500;';
            if (model.value === this.options.defaultModel) {
                option.selected = true;
            }
        });

        // Focus effects
        [this.providerDropdown, this.modelDropdown].forEach(dropdown => {
            dropdown.addEventListener('focus', () => {
                dropdown.style.borderColor = 'var(--interactive-accent)';
                dropdown.style.outline = 'none';
            });
            dropdown.addEventListener('blur', () => {
                dropdown.style.borderColor = 'var(--background-modifier-border)';
            });
        });
    }

    /**
     * Create streamlined controls section
     */
    private createStreamlinedControlsSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.style.cssText = `
            background: var(--background-secondary);
            border-radius: 16px;
            padding: 20px;
            border: 1px solid var(--background-modifier-border);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        `;

        // Add hover effect
        section.addEventListener('mouseenter', () => {
            section.style.borderColor = 'var(--interactive-accent)';
            section.style.transform = 'translateY(-2px)';
            section.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
        });
        section.addEventListener('mouseleave', () => {
            section.style.borderColor = 'var(--background-modifier-border)';
            section.style.transform = 'translateY(0)';
            section.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        });

        const header = section.createDiv();
        header.innerHTML = '<span style="font-size: 1.2rem; margin-right: 8px;">⚙️</span>Model Parameters';
        header.style.cssText = 'font-weight: 600; margin-bottom: 20px; color: var(--text-normal);';

        // Max Tokens
        const tokensControl = section.createDiv();
        tokensControl.style.cssText = 'margin-bottom: 20px;';

        const tokensLabel = tokensControl.createDiv();
        tokensLabel.innerHTML = '📊 Max Tokens: <span style="color: var(--interactive-accent); font-weight: 600;">4096</span>';
        tokensLabel.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 500; font-size: 0.9rem;';

        this.maxTokensSlider = tokensControl.createEl('input');
        this.maxTokensSlider.type = 'range';
        this.maxTokensSlider.min = '256';
        this.maxTokensSlider.max = '8192';
        this.maxTokensSlider.step = '256';
        this.maxTokensSlider.value = '4096';
        this.maxTokensSlider.className = 'ytc-slider-enhanced';
        this.maxTokensSlider.style.cssText = 'width: 100%; height: 6px;';

        this.maxTokensSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            (tokensLabel.querySelector('span') as HTMLSpanElement).textContent = value;
            this.maxTokensSlider.style.setProperty('--value', `${(parseInt(value) - 256) / (8192 - 256) * 100}%`);
        });

        // Temperature
        const tempControl = section.createDiv();

        const tempLabel = tempControl.createDiv();
        tempLabel.innerHTML = '🌡️ Temperature: <span style="color: var(--interactive-accent); font-weight: 600;">0.5</span>';
        tempLabel.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 500; font-size: 0.9rem;';

        this.temperatureSlider = tempControl.createEl('input');
        this.temperatureSlider.type = 'range';
        this.temperatureSlider.min = '0';
        this.temperatureSlider.max = '2';
        this.temperatureSlider.step = '0.1';
        this.temperatureSlider.value = '0.5';
        this.temperatureSlider.className = 'ytc-slider-enhanced';
        this.temperatureSlider.style.cssText = 'width: 100%; height: 6px;';

        this.temperatureSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            (tempLabel.querySelector('span') as HTMLSpanElement).textContent = value;
            this.temperatureSlider.style.setProperty('--value', `${(parseFloat(value) / 2) * 100}%`);
        });

        // Initialize slider values
        this.maxTokensSlider.style.setProperty('--value', '50%');
        this.temperatureSlider.style.setProperty('--value', '25%');
    }

    /**
     * Create streamlined performance section
     */
    private createStreamlinedPerformanceSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.style.cssText = `
            background: var(--background-secondary);
            border-radius: 16px;
            padding: 20px;
            border: 1px solid var(--background-modifier-border);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        `;

        // Add hover effect
        section.addEventListener('mouseenter', () => {
            section.style.borderColor = 'var(--interactive-accent)';
            section.style.transform = 'translateY(-2px)';
            section.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
        });
        section.addEventListener('mouseleave', () => {
            section.style.borderColor = 'var(--background-modifier-border)';
            section.style.transform = 'translateY(0)';
            section.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        });

        const header = section.createDiv();
        header.innerHTML = '<span style="font-size: 1.2rem; margin-right: 8px;">⚡</span>Performance';
        header.style.cssText = 'font-weight: 600; margin-bottom: 16px; color: var(--text-normal);';

        // Performance mode selector
        const modes = ['Fast', 'Balanced', 'Quality'];
        const modeButtons = section.createDiv();
        modeButtons.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';

        modes.forEach((mode, index) => {
            const btn = modeButtons.createEl('button');
            btn.textContent = mode;
            btn.style.cssText = `
                flex: 1;
                padding: 10px;
                border: 2px solid var(--background-modifier-border);
                background: var(--background-primary);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.85rem;
                font-weight: 500;
                color: var(--text-normal);
            `;

            if (index === 1) {
                btn.style.borderColor = 'var(--interactive-accent)';
                btn.style.background = 'var(--interactive-accent)';
                btn.style.color = 'white';
            }

            btn.addEventListener('click', () => {
                modeButtons.querySelectorAll('button').forEach(b => {
                    b.style.borderColor = 'var(--background-modifier-border)';
                    b.style.background = 'var(--background-primary)';
                    b.style.color = 'var(--text-normal)';
                });
                btn.style.borderColor = 'var(--interactive-accent)';
                btn.style.background = 'var(--interactive-accent)';
                btn.style.color = 'white';
            });
        });

        // Toggle switches
        const toggles = [
            { label: 'Parallel processing', checked: true },
            { label: 'Multimodal analysis', checked: true }
        ];

        toggles.forEach(toggle => {
            const toggleItem = section.createDiv();
            toggleItem.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;';

            const label = toggleItem.createEl('label');
            label.textContent = toggle.label;
            label.style.cssText = 'font-size: 0.9rem; cursor: pointer;';

            const switchContainer = toggleItem.createDiv();
            switchContainer.style.cssText = 'position: relative; width: 48px; height: 24px;';

            const checkbox = switchContainer.createEl('input');
            checkbox.type = 'checkbox';
            checkbox.checked = toggle.checked;
            checkbox.style.cssText = 'opacity: 0; width: 0; height: 0;';

            const slider = switchContainer.createDiv();
            slider.style.cssText = `
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: ${toggle.checked ? 'var(--interactive-accent)' : 'var(--background-modifier-border)'};
                transition: 0.4s;
                border-radius: 24px;
            `;

            const sliderKnob = slider.createDiv();
            sliderKnob.style.cssText = `
                position: absolute;
                height: 18px;
                width: 18px;
                left: ${toggle.checked ? '26px' : '3px'};
                bottom: 3px;
                background-color: white;
                transition: 0.4s;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;

            checkbox.addEventListener('change', () => {
                slider.style.backgroundColor = checkbox.checked ? 'var(--interactive-accent)' : 'var(--background-modifier-border)';
                sliderKnob.style.left = checkbox.checked ? '26px' : '3px';
            });
        });
    }

    /**
     * Create streamlined tips section
     */
    private createStreamlinedTipsSection(container: HTMLElement): void {
        const section = container.createDiv();
        section.style.cssText = `
            background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
            border-radius: 16px;
            padding: 20px;
            color: white;
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
        `;

        const header = section.createDiv();
        header.innerHTML = '<span style="font-size: 1.2rem; margin-right: 8px;">💡</span>Pro Tips';
        header.style.cssText = 'font-weight: 600; margin-bottom: 16px; color: white;';

        const tips = [
            '⌨️ Press <kbd>Ctrl+Enter</kbd> to process instantly',
            '🎯 Use "Detailed" for comprehensive analysis',
            '⚡ Enable "Fast" mode for quick results',
            '🤖 Gemini 2.5 Pro offers the best quality'
        ];

        tips.forEach(tip => {
            const tipItem = section.createDiv();
            tipItem.innerHTML = tip;
            tipItem.style.cssText = 'margin-bottom: 12px; font-size: 0.85rem; line-height: 1.4; opacity: 0.95;';
        });
    }

    /**
     * Create ripple effect for buttons
     */
    private createRippleEffect(event: MouseEvent, button: HTMLElement): void {
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255,255,255,0.6);
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';

        button.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    }

    /**
     * Streamlined drawer toggle with smooth animations
     */
    private toggleDrawer(): void {
        this.isDrawerOpen = !this.isDrawerOpen;
        const chevron = this.drawerToggle.querySelector('.drawer-chevron') as HTMLElement;

        if (this.isDrawerOpen) {
            // Open drawer
            this.drawerContent.style.maxHeight = '700px';
            this.drawerContent.style.opacity = '1';

            if (chevron) chevron.style.transform = 'rotate(90deg)';

            // Smooth scroll to top of drawer
            setTimeout(() => {
                this.drawerContent.scroll({ top: 0, behavior: 'smooth' });
            }, 100);

        } else {
            // Close drawer
            this.drawerContent.style.maxHeight = '0px';
            this.drawerContent.style.opacity = '0';

            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }

    
    /**
     * Create provider selection section for drawer (modified version)
     */
    private createProviderSelectionSectionForDrawer(container: HTMLElement): void {
        const sectionContainer = container.createDiv();
        sectionContainer.style.padding = '12px';
        sectionContainer.style.backgroundColor = 'var(--background-secondary)';
        sectionContainer.style.borderRadius = '6px';
        sectionContainer.style.border = '1px solid var(--background-modifier-border)';

        const label = sectionContainer.createEl('label', { text: '🤖 AI Provider & Model:' });
        label.setAttribute('for', 'ytc-provider-select');
        label.style.display = 'block';
        label.style.marginBottom = '8px';
        label.style.fontWeight = '500';
        label.style.color = 'var(--text-normal)';

        const row = sectionContainer.createDiv();
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.alignItems = 'center';

        // Provider select
        this.providerSelect = document.createElement('select');
        this.providerSelect.id = 'ytc-provider-select';
        this.providerSelect.setAttribute('aria-label', 'AI Provider');
        this.providerSelect.style.flex = '1';
        this.providerSelect.style.padding = '4px 8px';
        this.providerSelect.style.borderRadius = '4px';
        this.providerSelect.style.border = '1px solid var(--background-modifier-border)';
        row.appendChild(this.providerSelect);

        // Model select
        this.modelSelect = document.createElement('select');
        this.modelSelect.setAttribute('aria-label', 'AI Model');
        this.modelSelect.style.flex = '1';
        this.modelSelect.style.padding = '4px 8px';
        this.modelSelect.style.borderRadius = '4px';
        this.modelSelect.style.border = '1px solid var(--background-modifier-border)';
        row.appendChild(this.modelSelect);

        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄';
        refreshBtn.style.padding = '4px 8px';
        refreshBtn.style.borderRadius = '4px';
        refreshBtn.style.border = '1px solid var(--background-modifier-border)';
        refreshBtn.style.cursor = 'pointer';
        refreshBtn.setAttribute('aria-label', 'Refresh model list');
        refreshBtn.addEventListener('click', () => this.handleRefreshModels());
        row.appendChild(refreshBtn);

        // Refresh spinner
        this.refreshSpinner = document.createElement('span');
        this.refreshSpinner.textContent = '⏳';
        this.refreshSpinner.style.display = 'none';
        this.refreshSpinner.style.marginLeft = '4px';
        row.appendChild(this.refreshSpinner);

        // Setup provider/model event handlers
        this.setupProviderModelHandlers();
    }

    /**
     * Create model parameters section for drawer (modified version)
     */
    private createModelParametersSectionForDrawer(container: HTMLElement): void {
        const paramsContainer = container.createDiv();
        paramsContainer.className = 'ytc-model-params-section';
        paramsContainer.style.padding = '12px';
        paramsContainer.style.backgroundColor = 'var(--background-secondary)';
        paramsContainer.style.borderRadius = '6px';
        paramsContainer.style.border = '1px solid var(--background-modifier-border)';

        const header = paramsContainer.createEl('h4');
        header.textContent = '⚙️ Model Parameters';
        header.style.margin = '0 0 12px 0';
        header.style.fontSize = '0.95rem';
        header.style.color = 'var(--text-normal)';

        // Max Tokens
        const maxTokensContainer = paramsContainer.createDiv();
        maxTokensContainer.style.marginBottom = '12px';

        const maxTokensLabel = maxTokensContainer.createDiv();
        maxTokensLabel.textContent = 'Max Tokens: ' + this.maxTokens;
        maxTokensLabel.style.fontSize = '0.85rem';
        maxTokensLabel.style.fontWeight = '500';
        maxTokensLabel.style.marginBottom = '6px';
        maxTokensLabel.style.color = 'var(--text-normal)';

        this.maxTokensSlider = document.createElement('input');
        this.maxTokensSlider.type = 'range';
        this.maxTokensSlider.min = '256';
        this.maxTokensSlider.max = '8192';
        this.maxTokensSlider.step = '256';
        this.maxTokensSlider.value = this.maxTokens.toString();
        this.maxTokensSlider.style.width = '100%';
        this.maxTokensSlider.style.height = '4px';
        this.maxTokensSlider.className = 'ytc-model-slider';
        maxTokensContainer.appendChild(this.maxTokensSlider);

        this.maxTokensValue = document.createElement('span');
        this.maxTokensValue.textContent = this.maxTokens.toString();
        this.maxTokensValue.style.fontSize = '0.8rem';
        this.maxTokensValue.style.fontWeight = '600';
        this.maxTokensValue.style.color = 'var(--text-accent)';
        this.maxTokensValue.style.marginLeft = '8px';
        maxTokensContainer.appendChild(this.maxTokensValue);

        // Temperature
        const tempContainer = paramsContainer.createDiv();

        const tempLabel = tempContainer.createDiv();
        tempLabel.textContent = 'Temperature: ' + this.temperature.toFixed(1);
        tempLabel.style.fontSize = '0.85rem';
        tempLabel.style.fontWeight = '500';
        tempLabel.style.marginBottom = '6px';
        tempLabel.style.color = 'var(--text-normal)';

        this.temperatureSlider = document.createElement('input');
        this.temperatureSlider.type = 'range';
        this.temperatureSlider.min = '0';
        this.temperatureSlider.max = '2';
        this.temperatureSlider.step = '0.1';
        this.temperatureSlider.value = this.temperature.toString();
        this.temperatureSlider.style.width = '100%';
        this.temperatureSlider.style.height = '4px';
        this.temperatureSlider.className = 'ytc-model-slider';
        tempContainer.appendChild(this.temperatureSlider);

        this.temperatureValue = document.createElement('span');
        this.temperatureValue.textContent = this.temperature.toFixed(1);
        this.temperatureValue.style.fontSize = '0.8rem';
        this.temperatureValue.style.fontWeight = '600';
        this.temperatureValue.style.color = 'var(--text-accent)';
        this.temperatureValue.style.marginLeft = '8px';
        tempContainer.appendChild(this.temperatureValue);

        // Scale labels
        const scaleContainer = paramsContainer.createDiv();
        scaleContainer.style.display = 'flex';
        scaleContainer.style.justifyContent = 'space-between';
        scaleContainer.style.fontSize = '0.75rem';
        scaleContainer.style.color = 'var(--text-muted)';
        scaleContainer.style.marginTop = '4px';
        scaleContainer.createSpan({ text: 'Precise' });
        scaleContainer.createSpan({ text: 'Creative' });

        // Add slider event handlers
        this.setupSliderEventHandlers();
    }

    /**
     * Create progress section
     */
    private createProgressSection(): void {
        // Clean up existing progress container if it exists
        if (this.progressContainer) {
            this.progressContainer.remove();
            this.progressSteps = [];
        }

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
        progressBarContainer.style.height = '6px';
        progressBarContainer.style.backgroundColor = 'var(--background-modifier-border)';
        progressBarContainer.style.borderRadius = '3px';
        progressBarContainer.style.overflow = 'hidden';
        
        // Progress bar
        this.progressBar = progressBarContainer.createDiv();
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = 'var(--text-accent)';
        this.progressBar.style.borderRadius = '3px';
        this.progressBar.style.width = '0%';
        this.progressBar.style.transition = 'width 0.3s ease';

        const stepList = this.progressContainer.createEl('ol');
        stepList.setAttribute('aria-label', 'Processing steps');
        stepList.style.marginTop = '12px';
        stepList.style.paddingLeft = '20px';
        stepList.style.fontSize = '0.9rem';
        stepList.style.color = 'var(--text-normal)';

        const labels = [
            'Validate URL',
            'Fetch video info',
            'Run AI analysis',
            'Save note'
        ];

        this.progressSteps = labels.map((label, index) => {
            const item = stepList.createEl('li');
            item.setAttribute('role', 'status');
            item.style.marginBottom = '4px';
            item.textContent = `○ ${label}`;
            return { label, element: item };
        });
    }

    /**
     * Create action buttons with accessibility
     */
    private createActionButtons(): void {
        const container = this.createButtonContainer();

        // Cancel button
        const cancelBtn = this.createButton(
            container,
            MESSAGES.MODALS.CANCEL,
            false,
            () => this.close()
        );
        cancelBtn.setAttribute('aria-label', 'Cancel video processing');

        // Process button
        this.processButton = this.createButton(
            container,
            MESSAGES.MODALS.PROCESS,
            true,
            () => this.handleProcess()
        );
        this.processButton.setAttribute('aria-label', 'Process YouTube video');

        // Open button (hidden initially)
        this.openButton = this.createButton(
            container,
            'Open Note',
            true,
            () => this.handleOpenFile()
        );
        this.openButton.setAttribute('aria-label', 'Open the processed note');
        this.openButton.style.display = 'none';

        this.updateProcessButtonState();
    }

    /**
     * Create button container for action buttons
     */
    private createButtonContainer(): HTMLElement {
        const container = this.contentEl.createDiv();
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.gap = '12px';
        container.style.marginTop = '20px';
        container.style.padding = '0 16px';
        container.style.borderTop = '1px solid var(--background-modifier-border)';
        container.style.backgroundColor = 'var(--background-primary)';
        return container;
    }

    /**
     * Create a button with consistent styling
     */
    private createButton(container: HTMLElement, text: string, isPrimary: boolean = false, onClick?: () => void): HTMLButtonElement {
        const button = container.createEl('button');
        button.textContent = text;
        button.style.padding = '8px 16px';
        button.style.borderRadius = '6px';
        button.style.border = '1px solid';
        button.style.cursor = 'pointer';
        button.style.fontSize = '0.9rem';
        button.style.fontWeight = '500';
        button.style.transition = 'all 0.2s ease';

        if (isPrimary) {
            button.style.backgroundColor = 'var(--interactive-accent)';
            button.style.color = 'var(--text-on-accent)';
            button.style.borderColor = 'var(--interactive-accent)';
        } else {
            button.style.backgroundColor = 'var(--background-secondary)';
            button.style.color = 'var(--text-normal)';
            button.style.borderColor = 'var(--background-modifier-border)';
        }

        button.addEventListener('mouseenter', () => {
            if (isPrimary) {
                button.style.backgroundColor = 'var(--interactive-accent-hover)';
            } else {
                button.style.backgroundColor = 'var(--background-modifier-hover)';
                button.style.borderColor = 'var(--interactive-accent)';
            }
        });

        button.addEventListener('mouseleave', () => {
            if (isPrimary) {
                button.style.backgroundColor = 'var(--interactive-accent)';
                button.style.color = 'var(--text-on-accent)';
                button.style.borderColor = 'var(--interactive-accent)';
            } else {
                button.style.backgroundColor = 'var(--background-secondary)';
                button.style.color = 'var(--text-normal)';
                button.style.borderColor = 'var(--background-modifier-border)';
            }
        });

        if (onClick) {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    /**
     * Set up event handlers
     */
    private setupEventHandlers(): void {
        this.setupKeyHandlers(
            () => this.handleProcess(),
            () => this.close()
        );

        // Set up retry handler for quota errors
        window.addEventListener('yt-clipper-retry-processing', this.handleRetry);
    }

    /**
     * Focus on URL input
     */
    private focusUrlInput(): void {
        if (this.urlInput) {
            this.focusElement(this.urlInput);
        }
    }

    /**
     * Update process button enabled state (optimized with debouncing and memoization)
     */
    private updateProcessButtonState(): void {
        if (!this.processButton) return;

        if (this.isProcessing) {
            return;
        }

        const trimmedUrl = this.url.trim();

        if (this.processButton && this.processButton.textContent !== MESSAGES.MODALS.PROCESS && trimmedUrl.length >= 0) {
            this.processButton.textContent = MESSAGES.MODALS.PROCESS;
        }
        
        // Memoize validation result for same URL (avoid repeated expensive validation)
        if (trimmedUrl === this.lastValidUrl) {
            const isValid = this.lastValidResult!;
            this.processButton.disabled = !isValid;
            this.processButton.style.opacity = isValid ? '1' : '0.5';
            if (trimmedUrl.length === 0) {
                this.setValidationMessage('Paste a YouTube link to begin processing.', 'info');
                this.setUrlInputState('idle');
            } else {
                this.setValidationMessage(
                    isValid ? 'Ready to process this video.' : 'Enter a valid YouTube video URL.',
                    isValid ? 'success' : 'error'
                );
                this.setUrlInputState(isValid ? 'valid' : 'invalid');
            }
            this.updateQuickActionsState();
            return;
        }
        
        // Debounced validation for better UX and performance
        if (this.validationTimer) {
            clearTimeout(this.validationTimer);
        }
        
        this.validationTimer = window.setTimeout(() => {
            const isValid = ValidationUtils.isValidYouTubeUrl(trimmedUrl);
            this.lastValidUrl = trimmedUrl;
            this.lastValidResult = isValid;
            
            this.processButton!.disabled = !isValid;
            this.processButton!.style.opacity = isValid ? '1' : '0.5';

            if (trimmedUrl.length === 0) {
                this.setValidationMessage('Paste a YouTube link to begin processing.', 'info');
                this.setUrlInputState('idle');
            } else {
                this.setValidationMessage(
                    isValid ? 'Ready to process this video.' : 'Enter a valid YouTube video URL.',
                    isValid ? 'success' : 'error'
                );
                this.setUrlInputState(isValid ? 'valid' : 'invalid');
            }
            this.updateQuickActionsState();
                // If URL is valid, fetch a lightweight preview (thumbnail + title)
                if (isValid) {
                    void this.maybeFetchPreview(trimmedUrl);
                } else {
                    this.clearPreview();
                }
        }, 300); // 300ms debounce
    }

    /**
     * Validate URL input (simplified - used by debounced handler)
     */
    private isUrlValid(): boolean {
        return ValidationUtils.isValidYouTubeUrl(this.url.trim());
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

        if (!this.isUrlValid()) {
            new Notice(MESSAGES.ERRORS.INVALID_URL);
            this.focusUrlInput();
            return;
        }

        try {
            // If user explicitly selected Google Gemini and chose a model that
            // does not support multimodal audio/video tokens, but the URL is a
            // YouTube video, suggest switching to a multimodal-capable model.
            if (this.selectedProvider === 'Google Gemini' && this.selectedModel && this.isUrlValid()) {
                try {
                    const models = PROVIDER_MODEL_OPTIONS['Google Gemini'] || [] as any[];
                    const match = models.find(m => {
                        const name = typeof m === 'string' ? m : (m && m.name ? m.name : '');
                        return String(name).toLowerCase() === String(this.selectedModel || '').toLowerCase();
                    }) as any | undefined;

                    const supportsAudioVideo = !!(match && match.supportsAudioVideo);
                    if (!supportsAudioVideo) {
                        // Recommend a multimodal-capable model (prefer configured default)
                        const recommended = (models.find(m => (m && m.supportsAudioVideo)) || { name: AI_MODELS.GEMINI }).name;
                        // Use custom styled confirmation modal instead of native confirm()
                        const shouldSwitch = await this.showConfirmationModal(
                            'Multimodal Model Recommended',
                            `The selected model (${this.selectedModel}) may not support multimodal analysis.\n\nWould you like to switch to a multimodal-capable model (${recommended}) for better video analysis?`,
                            'Switch to Multimodal',
                            'Keep Current Model',
                            false
                        );
                        if (shouldSwitch) {
                            // Ensure the recommended model exists in the current modelSelect; if not, add it
                            if (this.modelSelect) {
                                const exists = Array.from(this.modelSelect.options).some(o => o.value === recommended);
                                if (!exists) {
                                    const opt = document.createElement('option');
                                    opt.value = recommended;
                                    opt.text = recommended;
                                    this.modelSelect.appendChild(opt);
                                }
                                this.modelSelect.value = recommended;
                                this.selectedModel = recommended;
                            } else {
                                this.selectedModel = recommended;
                            }
                        }
                    }
                } catch (err) {
                    // Non-fatal: fall back to default behavior
                    console.warn('[YouTubeUrlModal] model recommendation failed', err);
                }
            }
            this.showProcessingState();
            this.setStepState(0, 'active');
            
            // Start processing with progress updates
            this.updateProgress(20, 'Validating YouTube URL...');
            await new Promise(resolve => setTimeout(resolve, 500));
            this.setStepState(0, 'complete');
            this.setStepState(1, 'active');
            
            this.updateProgress(40, 'Extracting video data...');
            await new Promise(resolve => setTimeout(resolve, 500));
            this.setStepState(1, 'complete');
            this.setStepState(2, 'active');
            
            this.updateProgress(60, 'Analyzing video content...');
            
            // Call the actual processing function (pass provider/model selection and performance settings)
            const customPrompt = this.format === 'custom' ? this.customPromptInput?.value : undefined;
            const filePath = await this.options.onProcess(
                trimmedUrl,
                this.format,
                this.selectedProvider,
                this.selectedModel,
                customPrompt,
                this.performanceMode,
                this.enableParallelProcessing,
                this.preferMultimodal,
                this.maxTokens,
                this.temperature
            );
            this.setStepState(2, 'complete');
            this.setStepState(3, 'active');
            
            this.updateProgress(80, 'Generating note...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            this.updateProgress(100, 'Complete!');
            this.setStepState(3, 'complete');
            
            // Store the file path and show completion state
            this.processedFilePath = filePath;
            this.showCompletionState();
            
        } catch (error) {
            this.flagActiveStepAsError();
            this.showErrorState(error as Error);
            ErrorHandler.handle(error as Error, 'YouTube URL processing');
        }
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
     * Show processing state
     */
    private showProcessingState(): void {
        this.isProcessing = true;
        this.setValidationMessage('Processing video. This may take a moment...', 'info');
        this.resetProgressSteps();
        
        // Show progress section
        if (this.progressContainer) {
            this.progressContainer.style.display = 'block';
        }
        
        // Disable inputs and process button
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

        this.setUrlInputState('idle');
        this.updateQuickActionsState();
    }

    /**
     * Show completion state
     */
    private showCompletionState(): void {
        this.isProcessing = false;

        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }

        if (this.urlInput) {
            this.urlInput.disabled = false;
            // Clear the URL to prepare for next video and prevent cycles
            this.urlInput.value = '';
            this.url = '';
        }
        if (this.processButton) {
            this.processButton.disabled = false;
            this.processButton.textContent = 'Process Another';
            this.processButton.style.display = 'inline-block';
            this.processButton.style.opacity = '1';
        }
        if (this.openButton) {
            this.openButton.style.display = 'inline-block';
        }

        if (this.headerEl) {
            this.headerEl.textContent = '✅ Video Processed Successfully!';
        }

        this.setValidationMessage("Note saved to today's folder. You can open it now or process another video.", 'success');
        this.focusUrlInput();
        this.updateQuickActionsState();
        this.setUrlInputState('idle'); // Reset to idle since we cleared the URL
    }

    /**
     * Show error state
     */
    private showErrorState(error: Error): void {
        this.isProcessing = false;
        
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }

        if (this.urlInput) {
            this.urlInput.disabled = false;
        }
        if (this.processButton) {
            this.processButton.disabled = false;
            this.processButton.textContent = MESSAGES.MODALS.PROCESS;
            this.processButton.style.display = 'inline-block';
        }
        if (this.openButton) {
            this.openButton.style.display = 'none';
        }

        if (this.headerEl) {
            this.headerEl.textContent = '❌ Processing Failed';
        }

        this.setValidationMessage(error.message, 'error');
        this.updateQuickActionsState();
        this.setUrlInputState(this.url.trim().length > 0 ? 'invalid' : 'idle');
    }

    /**
     * Update progress bar and text
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
     * Set initial URL value
     */
    setUrl(url: string): void {
        // Prevent cycles - don't set the same URL again
        if (this.url.trim() === url.trim()) {
            console.debug('YouTubeUrlModal: setUrl called with same URL, preventing cycle');
            return;
        }

        this.url = url;
        if (this.urlInput) {
            this.urlInput.value = url;
            this.updateProcessButtonState();
            this.updateQuickActionsState();
            const trimmed = url.trim();
            if (trimmed.length === 0) {
                this.setUrlInputState('idle');
            } else {
                this.setUrlInputState(ValidationUtils.isValidYouTubeUrl(trimmed) ? 'valid' : 'invalid');
            }
        }
    }

    /**
     * Clean up resources when modal is closed
     */
    onClose(): void {
        // Clean up validation timer
        if (this.validationTimer) {
            clearTimeout(this.validationTimer);
            this.validationTimer = undefined;
        }

        // Clean up progress container and steps
        if (this.progressContainer) {
            this.progressContainer.remove();
            this.progressContainer = undefined;
        }
        this.progressSteps = [];

        // Clean up retry event listener
        window.removeEventListener('yt-clipper-retry-processing', this.handleRetry);

        // Clean up keyboard shortcuts
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = undefined;
        }

        // Call parent cleanup
        super.onClose();
    }

    private handleRetry = (): void => {
        if (this.processButton && !this.processButton.disabled) {
            this.handleProcess();
        }
    };

    /**
     * Get current URL value
     */
    getUrl(): string {
        return this.url;
    }

    private resetProgressSteps(): void {
        this.currentStepIndex = 0;
        if (this.progressSteps.length === 0) {
            return;
        }

        this.progressSteps.forEach((step) => {
            step.element.textContent = `○ ${step.label}`;
        });
    }

    private setStepState(index: number, state: StepState): void {
        const target = this.progressSteps[index];
        if (!target) {
            return;
        }

        const prefix = this.getStepPrefix(state);
        target.element.textContent = `${prefix} ${target.label}`;

        if (state === 'active') {
            this.currentStepIndex = index;
        } else if (state === 'complete' && this.currentStepIndex === index) {
            this.currentStepIndex = Math.min(index + 1, this.progressSteps.length - 1);
        }
    }

    private flagActiveStepAsError(): void {
        if (this.progressSteps.length === 0) {
            return;
        }

        this.setStepState(this.currentStepIndex, 'error');
    }

    private getStepPrefix(state: StepState): string {
        switch (state) {
            case 'active':
                return '●';
            case 'complete':
                return '✔';
            case 'error':
                return '⚠';
            default:
                return '○';
        }
    }

    private createInlineButton(container: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
        const button = container.createEl('button', { text: label });
        button.style.padding = '6px 12px';
        button.style.fontSize = '0.85rem';
        button.style.borderRadius = '6px';
        button.style.border = '1px solid var(--background-modifier-border)';
        button.style.backgroundColor = 'var(--background-primary)';
        button.style.color = 'var(--text-normal)';
        button.style.cursor = 'pointer';
        button.style.transition = 'background-color 0.2s ease';
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'var(--background-modifier-hover)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'var(--background-primary)';
        });
        button.addEventListener('click', onClick);
        return button;
    }

    private async handlePasteFromClipboard(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        if (!navigator.clipboard || !navigator.clipboard.readText) {
            this.setValidationMessage('Clipboard access is not available in this environment.', 'error');
            new Notice('Clipboard access is not available.');
            return;
        }

        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                this.setValidationMessage('Clipboard is empty. Copy a YouTube URL first.', 'info');
                return;
            }

            const trimmed = text.trim();
            this.url = trimmed;
            if (this.urlInput) {
                this.urlInput.value = trimmed;
            }
            this.lastValidUrl = undefined;
            this.updateProcessButtonState();
            this.updateQuickActionsState();

            const isValid = ValidationUtils.isValidYouTubeUrl(trimmed);
            this.setValidationMessage(
                isValid ? 'Ready to process this video.' : 'Enter a valid YouTube video URL.',
                isValid ? 'success' : 'error'
            );
            this.setUrlInputState(isValid ? 'valid' : 'invalid');
            if (this.processButton && !this.isProcessing && isValid) {
                this.processButton.focus();
            } else {
                this.focusUrlInput();
            }
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Reading clipboard', false);
            this.setValidationMessage('Could not read from clipboard. Paste manually instead.', 'error');
            new Notice('Could not read from clipboard.');
        }
    }

    private handleClearUrl(): void {
        if (this.isProcessing) {
            return;
        }

        this.url = '';
        if (this.urlInput) {
            this.urlInput.value = '';
        }
        this.lastValidUrl = undefined;
        this.updateProcessButtonState();
        this.updateQuickActionsState();
        this.setValidationMessage('Paste a YouTube link to begin processing.', 'info');
        this.setUrlInputState('idle');
        this.focusUrlInput();
    }

    private updateQuickActionsState(): void {
        const hasUrl = this.url.trim().length > 0;
        if (this.clearButton) {
            this.clearButton.disabled = !hasUrl || this.isProcessing;
            this.clearButton.style.opacity = this.clearButton.disabled ? '0.5' : '1';
        }
        if (this.pasteButton) {
            this.pasteButton.disabled = this.isProcessing;
            this.pasteButton.style.opacity = this.pasteButton.disabled ? '0.5' : '1';
        }
    }

    private setUrlInputState(state: 'idle' | 'valid' | 'invalid'): void {
        if (!this.urlInput) {
            return;
        }

        let borderColor = 'var(--background-modifier-border)';
        let boxShadow = 'none';

        if (state === 'valid') {
            borderColor = 'var(--text-accent)';
            boxShadow = '0 0 0 1px var(--text-accent)';
        } else if (state === 'invalid') {
            borderColor = 'var(--text-error)';
            boxShadow = '0 0 0 1px var(--text-error)';
        }

        this.urlInput.style.borderColor = borderColor;
        this.urlInput.style.boxShadow = boxShadow;
    }

    private setValidationMessage(message: string, type: 'info' | 'error' | 'success'): void {
        if (!this.validationMessage) {
            return;
        }

        this.validationMessage.textContent = message;

        let color = 'var(--text-muted)';
        if (type === 'error') {
            color = 'var(--text-error)';
        } else if (type === 'success') {
            color = 'var(--text-accent)';
        } else {
            color = 'var(--text-muted)';
        }

        this.validationMessage.style.color = color;
    }

    /**
     * Try to fetch a lightweight preview for the provided YouTube URL using oEmbed.
     */
    private async maybeFetchPreview(url: string): Promise<void> {
        if (this.fetchInProgress) return;
        if (!url) return;
        if (this.lastValidUrl === url && this.thumbnailEl && this.thumbnailEl.style.display === 'block') {
            return; // already fetched for this URL
        }

        this.setFetchingState(true);
        try {
            const meta = await this.fetchVideoPreview(url);
            if (meta) {
                this.showPreview(meta);
            } else {
                this.clearPreview();
            }
        } catch (error) {
            // silently clear preview on failure, keep UX responsive
            this.clearPreview();
        } finally {
            this.setFetchingState(false);
        }
    }

    private setFetchingState(isFetching: boolean): void {
        this.fetchInProgress = isFetching;
        if (this.processButton) {
            // disable processing while fetching preview
            this.processButton.disabled = isFetching || !(this.lastValidResult ?? false);
            this.processButton.style.opacity = this.processButton.disabled ? '0.5' : '1';
        }
        if (this.validationMessage) {
            if (isFetching) this.setValidationMessage('Fetching preview...', 'info');
            else if (this.lastValidResult) this.setValidationMessage('Ready to process this video.', 'success');
            else this.setValidationMessage('Enter a valid YouTube video URL.', 'error');
        }
    }

    private async fetchVideoPreview(url: string): Promise<{ title: string; author: string; thumbnail: string } | null> {
        try {
            const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const res = await fetch(oembed);
            if (!res.ok) return null;
            const data = await res.json();
            return {
                title: data.title || '',
                author: data.author_name || '',
                thumbnail: data.thumbnail_url || ''
            };
        } catch (error) {
            return null;
        }
    }

    private showPreview(meta: { title: string; author: string; thumbnail: string }): void {
        if (!this.thumbnailEl || !this.metadataContainer) return;
        if (meta.thumbnail) {
            this.thumbnailEl.src = meta.thumbnail;
            this.thumbnailEl.style.display = 'block';
        } else {
            this.thumbnailEl.style.display = 'none';
        }

        // populate metadata fields (structure created earlier)
        const titleEl = this.metadataContainer.querySelector('.yt-preview-title') as HTMLDivElement;
        const channelEl = this.metadataContainer.querySelector('.yt-preview-channel') as HTMLDivElement;
        if (titleEl) {
            titleEl.textContent = meta.title;
            titleEl.style.fontWeight = '600';
            titleEl.style.marginBottom = '4px';
        }
        if (channelEl) {
            channelEl.textContent = meta.author;
            channelEl.style.color = 'var(--text-muted)';
            channelEl.style.fontSize = '0.85rem';
        }

        this.metadataContainer.style.display = 'block';
    }

    private clearPreview(): void {
        if (this.thumbnailEl) {
            this.thumbnailEl.src = '';
            this.thumbnailEl.style.display = 'none';
        }
        if (this.metadataContainer) {
            const titleEl = this.metadataContainer.querySelector('.yt-preview-title') as HTMLDivElement;
            const channelEl = this.metadataContainer.querySelector('.yt-preview-channel') as HTMLDivElement;
            if (titleEl) titleEl.textContent = '';
            if (channelEl) channelEl.textContent = '';
            this.metadataContainer.style.display = 'none';
        }
    }

    /**
     * Setup keyboard shortcuts for enhanced productivity
     */
    private setupKeyboardShortcuts(): void {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept shortcuts when typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Ctrl/Cmd + Enter: Process video
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (this.processButton && !this.processButton.disabled) {
                    this.processButton.click();
                }
            }

            // Ctrl/Cmd + D: Toggle drawer
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                if (this.drawerToggle) {
                    this.drawerToggle.click();
                }
            }

            // Escape: Close modal
            if (e.key === 'Escape') {
                this.close();
            }

            // Ctrl/Cmd + K: Focus URL input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.focusUrlInput();
            }

            // Alt + 1/2/3: Quick format selection
            if (e.altKey) {
                if (e.key === '1') {
                    e.preventDefault();
                    this.selectFormat('executive-summary');
                } else if (e.key === '2') {
                    e.preventDefault();
                    this.selectFormat('detailed-guide');
                } else if (e.key === '3') {
                    e.preventDefault();
                    this.selectFormat('brief');
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Store handler for cleanup
        this.keydownHandler = handleKeyDown;
    }

    /**
     * Show user insights and recommendations
     */
    private showUserInsights(): void {
        const insights = UserPreferencesService.getUserInsights();

        // Only show insights for users with some usage
        if (insights.usageLevel === 'light') {
            return;
        }

        // Create insights panel
        const insightsPanel = this.contentEl.createDiv();
        insightsPanel.className = 'ytc-insights-panel';
        insightsPanel.style.cssText = `
            background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideDown 0.3s ease-out;
        `;

        const icon = insightsPanel.createSpan();
        icon.textContent = '💡';
        icon.style.fontSize = '1.2rem';

        const content = insightsPanel.createDiv();
        content.style.flex = '1';

        const title = content.createDiv();
        title.textContent = 'Smart Suggestions';
        title.style.fontWeight = '600';
        title.style.marginBottom = '4px';

        const suggestions = content.createDiv();
        suggestions.style.opacity = '0.9';
        suggestions.style.fontSize = '0.8rem';

        // Generate personalized suggestions
        const suggestionTexts = [];

        if (insights.favoriteFormat !== 'detailed-guide') {
            suggestionTexts.push(`Try ${insights.favoriteFormat.replace('-', ' ')} format`);
        }

        if (insights.usageLevel === 'heavy' && insights.recommendations.length > 0) {
            suggestionTexts.push(insights.recommendations[0]);
        }

        if (suggestionTexts.length > 0) {
            suggestions.textContent = suggestionTexts.join(' • ');

            // Auto-hide after 8 seconds
            setTimeout(() => {
                insightsPanel.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(() => insightsPanel.remove(), 300);
            }, 8000);
        } else {
            insightsPanel.remove();
        }

        // Add slide animations
        if (!document.getElementById('ytc-insights-animations')) {
            const animStyle = document.createElement('style');
            animStyle.id = 'ytc-insights-animations';
            animStyle.textContent = `
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideUp {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(animStyle);
        }
    }

    /**
     * Select format programmatically
     */
    private selectFormat(format: OutputFormat): void {
        const formatButtons = this.contentEl.querySelectorAll('.ytc-format-button');
        formatButtons.forEach(button => {
            const buttonFormat = button.getAttribute('data-format');
            if (buttonFormat === format) {
                (button as HTMLButtonElement).click();
            }
        });
    }

    /**
     * Enhanced paste functionality with smart URL detection
     */
    private async handleSmartPaste(): Promise<void> {
        try {
            const text = await navigator.clipboard.readText();
            const trimmed = text.trim();

            // Check if it's a YouTube URL
            if (ValidationUtils.isValidYouTubeUrl(trimmed)) {
                this.setUrl(trimmed);
                new Notice('YouTube URL detected and pasted!');

                // Auto-focus process button if URL is valid
                if (this.processButton && !this.processButton.disabled) {
                    setTimeout(() => this.processButton?.focus(), 100);
                }
            } else {
                // Try to extract YouTube URL from text
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
        } catch (error) {
            console.error('Failed to read clipboard:', error);
            new Notice('Failed to access clipboard');
        }
    }

    /**
     * Add quick action buttons for common tasks
     */
    private addQuickActions(): void {
        const quickActionsContainer = this.contentEl.createDiv();
        quickActionsContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        `;

        // Paste from clipboard button
        const pasteBtn = quickActionsContainer.createEl('button');
        pasteBtn.innerHTML = '📋 Paste URL';
        pasteBtn.style.cssText = `
            padding: 6px 12px;
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.2s ease;
        `;

        pasteBtn.addEventListener('click', () => this.handleSmartPaste());
        pasteBtn.addEventListener('mouseenter', () => {
            pasteBtn.style.background = 'var(--background-modifier-hover)';
        });
        pasteBtn.addEventListener('mouseleave', () => {
            pasteBtn.style.background = 'var(--background-secondary)';
        });

        // Clear URL button
        const clearBtn = quickActionsContainer.createEl('button');
        clearBtn.innerHTML = '🗑️ Clear';
        clearBtn.style.cssText = pasteBtn.style.cssText;

        clearBtn.addEventListener('click', () => {
            this.setUrl('');
            this.focusUrlInput();
        });
        clearBtn.addEventListener('mouseenter', () => {
            clearBtn.style.background = 'var(--background-modifier-hover)';
        });
        clearBtn.addEventListener('mouseleave', () => {
            clearBtn.style.background = 'var(--background-secondary)';
        });

        // Keyboard shortcuts help button
        const helpBtn = quickActionsContainer.createEl('button');
        helpBtn.innerHTML = '⌨️ Shortcuts';
        helpBtn.style.cssText = pasteBtn.style.cssText;

        helpBtn.addEventListener('click', () => {
            this.showShortcutsHelp();
        });
        helpBtn.addEventListener('mouseenter', () => {
            helpBtn.style.background = 'var(--background-modifier-hover)';
        });
        helpBtn.addEventListener('mouseleave', () => {
            helpBtn.style.background = 'var(--background-secondary)';
        });
    }

    /**
     * Show keyboard shortcuts help modal
     */
    private showShortcutsHelp(): void {
        const helpContent = `
            <h4>⌨️ Keyboard Shortcuts</h4>
            <div style="display: grid; gap: 8px; margin-top: 12px;">
                <div><kbd>Ctrl/Cmd + Enter</kbd> - Process video</div>
                <div><kbd>Ctrl/Cmd + D</kbd> - Toggle advanced settings</div>
                <div><kbd>Ctrl/Cmd + K</kbd> - Focus URL input</div>
                <div><kbd>Alt + 1</kbd> - Select Executive Summary</div>
                <div><kbd>Alt + 2</kbd> - Select Detailed Guide</div>
                <div><kbd>Alt + 3</kbd> - Select Brief format</div>
                <div><kbd>Escape</kbd> - Close modal</div>
            </div>
            <p style="margin-top: 12px; font-size: 0.8rem; opacity: 0.8;">
                Press <kbd>Escape</kbd> or click outside to close this help.
            </p>
        `;

        new Notice('Keyboard shortcuts: Ctrl+Enter to process, Ctrl+D for settings, Alt+1/2/3 for formats', 8000);
    }

    /**
     * Format provider name for display
     */
    private formatProviderName(provider: string): string {
        const providerNames: Record<string, string> = {
            'gemini': 'Google Gemini',
            'groq': 'Groq',
            'openai': 'OpenAI',
            'anthropic': 'Anthropic Claude'
        };
        return providerNames[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1);
    }

    // Store keydown handler for cleanup
    private keydownHandler?: (e: KeyboardEvent) => void;
}
