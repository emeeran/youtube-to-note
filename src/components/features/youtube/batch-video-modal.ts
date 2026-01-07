/**
 * Batch Video Processing Modal
 * Allows processing multiple YouTube videos at once
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import { OutputFormat } from '../../../types';
import { ValidationUtils } from '../../../validation';

export interface BatchProcessingOptions {
    onProcess: (urls: string[], format: OutputFormat, provider?: string, model?: string) => Promise<string[]>;
    providers: string[];
    defaultProvider: string;
    defaultModel: string;
    modelOptionsMap: Record<string, string[]>;
}

interface BatchItem {
    url: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: string;
    error?: string;
}

export class BatchVideoModal extends Modal {
    private urls: BatchItem[] = [];
    private urlInput!: HTMLTextAreaElement;
    private itemsContainer!: HTMLElement;
    private progressContainer!: HTMLElement;
    private processButton!: HTMLButtonElement;
    private selectedFormat: OutputFormat = 'executive-summary';
    private selectedProvider: string;
    private selectedModel: string;
    private isProcessing = false;

    constructor(
        app: App,
        private options: BatchProcessingOptions
    ) {
        super(app);
        this.selectedProvider = options.defaultProvider;
        this.selectedModel = options.defaultModel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ytc-batch-modal');

        // Add custom styles
        this.addStyles();

        // Title
        contentEl.createEl('h2', {
            text: '📦 Batch Video Processing',
            cls: 'ytc-batch-title',
        });

        // Description
        contentEl.createEl('p', {
            text: 'Enter YouTube URLs (one per line) to process multiple videos at once.',
            cls: 'ytc-batch-description',
        });

        // URL Input Area
        this.createUrlInput();

        // Options
        this.createOptions();

        // Items list
        this.createItemsList();

        // Progress section
        this.createProgressSection();

        // Action buttons
        this.createActionButtons();
    }

    private addStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .ytc-batch-modal {
                padding: 20px;
                min-width: 500px;
            }
            .ytc-batch-title {
                margin: 0 0 8px 0;
                font-size: 1.4em;
            }
            .ytc-batch-description {
                color: var(--text-muted);
                margin-bottom: 16px;
            }
            .ytc-batch-textarea {
                width: 100%;
                min-height: 120px;
                padding: 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                background: var(--background-secondary);
                color: var(--text-normal);
                font-family: var(--font-monospace);
                font-size: 13px;
                resize: vertical;
            }
            .ytc-batch-textarea:focus {
                border-color: var(--interactive-accent);
                outline: none;
            }
            .ytc-batch-items {
                max-height: 200px;
                overflow-y: auto;
                margin: 16px 0;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
            }
            .ytc-batch-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid var(--background-modifier-border);
                gap: 8px;
            }
            .ytc-batch-item:last-child {
                border-bottom: none;
            }
            .ytc-batch-item-status {
                width: 20px;
                text-align: center;
            }
            .ytc-batch-item-url {
                flex: 1;
                font-size: 12px;
                color: var(--text-muted);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .ytc-batch-item-remove {
                cursor: pointer;
                color: var(--text-muted);
                opacity: 0.6;
            }
            .ytc-batch-item-remove:hover {
                color: var(--text-error);
                opacity: 1;
            }
            .ytc-batch-progress {
                margin: 16px 0;
                display: none;
            }
            .ytc-batch-progress.visible {
                display: block;
            }
            .ytc-batch-progress-bar {
                height: 8px;
                background: var(--background-modifier-border);
                border-radius: 4px;
                overflow: hidden;
            }
            .ytc-batch-progress-fill {
                height: 100%;
                background: var(--interactive-accent);
                transition: width 0.3s ease;
            }
            .ytc-batch-progress-text {
                text-align: center;
                font-size: 12px;
                color: var(--text-muted);
                margin-top: 4px;
            }
            .ytc-batch-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 16px;
            }
            .ytc-batch-btn {
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                border: none;
            }
            .ytc-batch-btn-primary {
                background: var(--interactive-accent);
                color: white;
            }
            .ytc-batch-btn-primary:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .ytc-batch-btn-secondary {
                background: var(--background-secondary);
                color: var(--text-normal);
                border: 1px solid var(--background-modifier-border);
            }
            .ytc-batch-options {
                margin: 16px 0;
            }
        `;
        this.contentEl.appendChild(style);
    }

    private createUrlInput(): void {
        const container = this.contentEl.createDiv({ cls: 'ytc-batch-input-container' });

        this.urlInput = container.createEl('textarea', {
            cls: 'ytc-batch-textarea',
            attr: {
                placeholder: 'https://youtube.com/watch?v=video1\nhttps://youtube.com/watch?v=video2\nhttps://youtu.be/video3',
            },
        });

        this.urlInput.addEventListener('input', () => this.parseUrls());
        this.urlInput.addEventListener('paste', () => {
            setTimeout(() => this.parseUrls(), 0);
        });
    }

    private createOptions(): void {
        const container = this.contentEl.createDiv({ cls: 'ytc-batch-options' });

        // Format selection
        new Setting(container)
            .setName('Output Format')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('executive-summary', 'Executive Summary')
                    .addOption('step-by-step-tutorial', 'Step-by-Step Tutorial')
                    .addOption('brief', 'Brief Overview')
                    .setValue(this.selectedFormat)
                    .onChange((value: OutputFormat) => {
                        this.selectedFormat = value;
                    });
            });

        // Provider selection
        new Setting(container)
            .setName('AI Provider')
            .addDropdown(dropdown => {
                this.options.providers.forEach(provider => {
                    dropdown.addOption(provider, provider);
                });
                dropdown
                    .setValue(this.selectedProvider)
                    .onChange(value => {
                        this.selectedProvider = value;
                    });
            });
    }

    private createItemsList(): void {
        this.itemsContainer = this.contentEl.createDiv({ cls: 'ytc-batch-items' });
        this.itemsContainer.style.display = 'none';
    }

    private createProgressSection(): void {
        this.progressContainer = this.contentEl.createDiv({ cls: 'ytc-batch-progress' });

        const progressBar = this.progressContainer.createDiv({ cls: 'ytc-batch-progress-bar' });
        progressBar.createDiv({ cls: 'ytc-batch-progress-fill' });

        this.progressContainer.createDiv({ cls: 'ytc-batch-progress-text' });
    }

    private createActionButtons(): void {
        const container = this.contentEl.createDiv({ cls: 'ytc-batch-actions' });

        // Cancel button
        const cancelBtn = container.createEl('button', {
            text: 'Cancel',
            cls: 'ytc-batch-btn ytc-batch-btn-secondary',
        });
        cancelBtn.addEventListener('click', () => this.close());

        // Process button
        this.processButton = container.createEl('button', {
            text: 'Process All',
            cls: 'ytc-batch-btn ytc-batch-btn-primary',
        });
        this.processButton.disabled = true;
        this.processButton.addEventListener('click', () => this.processVideos());
    }

    private parseUrls(): void {
        const text = this.urlInput.value;
        const lines = text.split('\n').filter(line => line.trim());

        this.urls = [];

        for (const line of lines) {
            const url = line.trim();
            if (ValidationUtils.isValidYouTubeUrl(url)) {
                this.urls.push({
                    url,
                    status: 'pending',
                });
            }
        }

        this.renderItems();
        this.updateProcessButton();
    }

    private renderItems(): void {
        this.itemsContainer.empty();

        if (this.urls.length === 0) {
            this.itemsContainer.style.display = 'none';
            return;
        }

        this.itemsContainer.style.display = 'block';

        for (let i = 0; i < this.urls.length; i++) {
            const item = this.urls[i];
            const itemEl = this.itemsContainer.createDiv({ cls: 'ytc-batch-item' });

            // Status icon
            const statusEl = itemEl.createSpan({ cls: 'ytc-batch-item-status' });
            statusEl.textContent = this.getStatusIcon(item.status);

            // URL (truncated)
            const urlEl = itemEl.createSpan({ cls: 'ytc-batch-item-url' });
            urlEl.textContent = item.url;
            urlEl.title = item.url;

            // Remove button (only if not processing)
            if (!this.isProcessing) {
                const removeEl = itemEl.createSpan({
                    cls: 'ytc-batch-item-remove',
                    text: '✕',
                });
                removeEl.addEventListener('click', () => this.removeItem(i));
            }
        }
    }

    private getStatusIcon(status: BatchItem['status']): string {
        switch (status) {
            case 'pending': return '⏳';
            case 'processing': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
        }
    }

    private removeItem(index: number): void {
        this.urls.splice(index, 1);
        this.renderItems();
        this.updateProcessButton();
    }

    private updateProcessButton(): void {
        this.processButton.disabled = this.urls.length === 0 || this.isProcessing;
        this.processButton.textContent = this.isProcessing
            ? 'Processing...'
            : `Process ${this.urls.length} Video${this.urls.length !== 1 ? 's' : ''}`;
    }

    private async processVideos(): Promise<void> {
        if (this.urls.length === 0 || this.isProcessing) return;

        this.isProcessing = true;
        this.updateProcessButton();
        this.progressContainer.classList.add('visible');

        const progressFill = this.progressContainer.querySelector('.ytc-batch-progress-fill') as HTMLElement;
        const progressText = this.progressContainer.querySelector('.ytc-batch-progress-text') as HTMLElement;

        let completed = 0;
        const total = this.urls.length;

        try {
            // Process one by one to show progress
            for (let i = 0; i < this.urls.length; i++) {
                this.urls[i].status = 'processing';
                this.renderItems();

                progressText.textContent = `Processing ${i + 1} of ${total}...`;
                progressFill.style.width = `${((i) / total) * 100}%`;

                try {
                    const results = await this.options.onProcess(
                        [this.urls[i].url],
                        this.selectedFormat,
                        this.selectedProvider,
                        this.selectedModel
                    );

                    this.urls[i].status = 'completed';
                    this.urls[i].result = results[0];
                    completed++;
                } catch (error) {
                    this.urls[i].status = 'failed';
                    this.urls[i].error = error instanceof Error ? error.message : String(error);
                }

                this.renderItems();
                progressFill.style.width = `${((i + 1) / total) * 100}%`;
            }

            progressText.textContent = `Completed: ${completed}/${total} videos processed`;

            if (completed === total) {
                new Notice(`✅ Successfully processed ${completed} videos!`);
            } else {
                new Notice(`⚠️ Processed ${completed}/${total} videos. Some failed.`);
            }

        } catch (error) {
            new Notice(`❌ Batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.isProcessing = false;
            this.updateProcessButton();
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
