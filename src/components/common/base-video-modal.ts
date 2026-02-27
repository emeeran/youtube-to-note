/**
 * Base Video Modal - Shared functionality for video processing modals
 *
 * Provides common UI components and state management for:
 * - Provider/model selection
 * - Format selection
 * - Progress tracking
 * - Processing state
 */

import { App, Notice } from 'obsidian';
import { BaseModal } from './base-modal';
import { OutputFormat } from '../../types';

/** Common options for video modals */
export interface BaseVideoModalOptions {
    providers?: string[];
    defaultProvider?: string;
    defaultModel?: string;
    modelOptions?: Record<string, string[]>;
    fetchModelsForProvider?: (provider: string, forceRefresh?: boolean) => Promise<string[]>;
}

/** Progress step for tracking */
export interface ProgressStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
}

/** CSS class constants */
const VIDEO_MODAL_CSS = {
    select: 'ytc-video-select',
    selectContainer: 'ytc-select-container',
    progressBar: 'ytc-progress-bar',
    progressFill: 'ytc-progress-fill',
    progressText: 'ytc-progress-text',
    progressSteps: 'ytc-progress-steps',
    stepItem: 'ytc-step-item',
    stepActive: 'ytc-step-active',
    stepCompleted: 'ytc-step-completed',
    stepError: 'ytc-step-error',
} as const;

/** Format options for video processing */
export const FORMAT_OPTIONS: Array<{ value: OutputFormat; label: string }> = [
    { value: 'executive-summary', label: 'Executive Summary' },
    { value: 'step-by-step-tutorial', label: 'Step-by-Step Tutorial' },
    { value: 'concise-summary', label: 'Concise Summary' },
    { value: 'technical-analysis', label: 'Technical Analysis' },
    { value: '3c-accelerated-learning', label: '3C Accelerated Learning' },
    { value: 'complete-transcription', label: 'Complete Transcription' },
];

/**
 * Base class for video processing modals
 */
export abstract class BaseVideoModal extends BaseModal {
    protected selectedProvider: string;
    protected selectedModel: string;
    protected selectedFormat: OutputFormat = 'executive-summary';
    protected isProcessing = false;
    protected progressSteps: ProgressStep[] = [];
    protected currentStepIndex = 0;

    // UI elements
    protected providerSelect?: HTMLSelectElement;
    protected modelSelect?: HTMLSelectElement;
    protected formatSelect?: HTMLSelectElement;
    protected progressContainer?: HTMLDivElement;
    protected progressBar?: HTMLDivElement;
    protected progressText?: HTMLDivElement;

    constructor(
        app: App,
        protected options: BaseVideoModalOptions,
    ) {
        super(app);
        this.selectedProvider = options.defaultProvider ?? '';
        this.selectedModel = options.defaultModel ?? '';
    }

    /**
     * Create provider dropdown
     */
    protected createProviderSelect(container: HTMLElement, label = 'Provider'): HTMLSelectElement {
        const wrapper = container.createDiv({ cls: VIDEO_MODAL_CSS.selectContainer });

        wrapper.createEl('label', {
            text: label,
            attr: { for: 'provider-select' },
        });

        const select = wrapper.createEl('select', {
            cls: VIDEO_MODAL_CSS.select,
            attr: { id: 'provider-select' },
        });

        const providers = this.options.providers ?? [];
        for (const provider of providers) {
            const option = select.createEl('option', {
                value: provider,
                text: provider,
            });
            if (provider === this.selectedProvider) {
                option.selected = true;
            }
        }

        select.addEventListener('change', () => {
            this.selectedProvider = select.value;
            this.onProviderChange(select.value);
        });

        this.providerSelect = select;
        return select;
    }

    /**
     * Create model dropdown
     */
    protected createModelSelect(container: HTMLElement, label = 'Model'): HTMLSelectElement {
        const wrapper = container.createDiv({ cls: VIDEO_MODAL_CSS.selectContainer });

        wrapper.createEl('label', {
            text: label,
            attr: { for: 'model-select' },
        });

        const select = wrapper.createEl('select', {
            cls: VIDEO_MODAL_CSS.select,
            attr: { id: 'model-select' },
        });

        this.updateModelOptions(select);
        this.modelSelect = select;
        return select;
    }

    /**
     * Create format dropdown
     */
    protected createFormatSelect(container: HTMLElement, label = 'Format'): HTMLSelectElement {
        const wrapper = container.createDiv({ cls: VIDEO_MODAL_CSS.selectContainer });

        wrapper.createEl('label', {
            text: label,
            attr: { for: 'format-select' },
        });

        const select = wrapper.createEl('select', {
            cls: VIDEO_MODAL_CSS.select,
            attr: { id: 'format-select' },
        });

        for (const format of FORMAT_OPTIONS) {
            const option = select.createEl('option', {
                value: format.value,
                text: format.label,
            });
            if (format.value === this.selectedFormat) {
                option.selected = true;
            }
        }

        select.addEventListener('change', () => {
            this.selectedFormat = select.value as OutputFormat;
        });

        this.formatSelect = select;
        return select;
    }

    /**
     * Update model options based on selected provider
     */
    protected updateModelOptions(select: HTMLSelectElement): void {
        select.empty();

        const models = this.options.modelOptions?.[this.selectedProvider] ?? [];
        for (const model of models) {
            const option = select.createEl('option', {
                value: model,
                text: model,
            });
            if (model === this.selectedModel) {
                option.selected = true;
            }
        }

        if (models.length === 0) {
            select.createEl('option', {
                value: '',
                text: 'No models available',
                attr: { disabled: 'true' },
            });
        }
    }

    /**
     * Create progress container
     */
    protected createProgressContainer(container: HTMLElement): HTMLDivElement {
        const progressContainer = container.createDiv({ cls: VIDEO_MODAL_CSS.progressBar });
        progressContainer.style.display = 'none';

        // Progress bar
        const progressBar = progressContainer.createDiv({ cls: VIDEO_MODAL_CSS.progressFill });
        progressBar.style.width = '0%';
        this.progressBar = progressBar;

        // Progress text
        const progressText = progressContainer.createDiv({ cls: VIDEO_MODAL_CSS.progressText });
        progressText.textContent = 'Ready';
        this.progressText = progressText;

        this.progressContainer = progressContainer;
        return progressContainer;
    }

    /**
     * Initialize progress steps
     */
    protected initProgressSteps(steps: Array<{ id: string; label: string }>): void {
        this.progressSteps = steps.map(step => ({
            ...step,
            status: 'pending' as const,
        }));
        this.currentStepIndex = 0;
    }

    /**
     * Update progress to a specific step
     */
    protected updateProgress(stepId: string, status: 'active' | 'completed' | 'error'): void {
        const stepIndex = this.progressSteps.findIndex(s => s.id === stepId);
        if (stepIndex === -1) return;

        // Mark previous steps as completed
        for (let i = 0; i < stepIndex; i++) {
            const step = this.progressSteps[i];
            if (step && (step.status === 'pending' || step.status === 'active')) {
                step.status = 'completed';
            }
        }

        // Update current step
        const currentStep = this.progressSteps[stepIndex];
        if (currentStep) {
            currentStep.status = status;
        }
        this.currentStepIndex = stepIndex;

        // Update UI
        this.renderProgress();
    }

    /**
     * Render progress UI
     */
    protected renderProgress(): void {
        if (!this.progressContainer || !this.progressBar || !this.progressText) return;

        // Calculate progress percentage
        const completedSteps = this.progressSteps.filter(s => s.status === 'completed').length;
        const totalSteps = this.progressSteps.length;
        const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
        }

        // Update text
        const currentStep = this.progressSteps[this.currentStepIndex];
        if (currentStep && this.progressText) {
            this.progressText.textContent = currentStep.label;
        }
    }

    /**
     * Show progress UI
     */
    protected showProgress(): void {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'block';
        }
    }

    /**
     * Hide progress UI
     */
    protected hideProgress(): void {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
    }

    /**
     * Set processing state
     */
    protected setProcessing(processing: boolean): void {
        this.isProcessing = processing;

        // Disable/enable interactive elements
        if (this.providerSelect) {
            this.providerSelect.disabled = processing;
        }
        if (this.modelSelect) {
            this.modelSelect.disabled = processing;
        }
        if (this.formatSelect) {
            this.formatSelect.disabled = processing;
        }
    }

    /**
     * Show notice message
     */
    protected showNotice(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        const prefix = type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
        new Notice(`${prefix}${message}`);
    }

    /**
     * Handle provider change - override in subclass
     */
    protected onProviderChange(provider: string): void {
        this.selectedProvider = provider;

        // Update model options
        if (this.modelSelect) {
            this.updateModelOptions(this.modelSelect);
        }

        // Fetch models if callback provided
        if (this.options.fetchModelsForProvider) {
            this.options
                .fetchModelsForProvider(provider)
                .then(models => {
                    if (models.length > 0 && this.modelSelect) {
                        this.options.modelOptions = {
                            ...this.options.modelOptions,
                            [provider]: models,
                        };
                        this.updateModelOptions(this.modelSelect);
                    }
                })
                .catch(() => {
                    // Ignore fetch errors
                });
        }
    }

    /**
     * Validate URL - common validation for video URLs
     */
    protected isValidVideoUrl(url: string): boolean {
        if (!url || url.trim().length === 0) return false;

        const youtubePatterns = [
            /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
            /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/v\/[\w-]+/,
        ];

        return youtubePatterns.some(pattern => pattern.test(url.trim()));
    }

    /**
     * Extract video ID from URL
     */
    protected extractVideoId(url: string): string | null {
        const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([\w-]+)/];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match?.[1]) {
                return match[1];
            }
        }

        return null;
    }
}
