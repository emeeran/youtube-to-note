/**
 * Batch Video Processing Modal
 * Allows processing multiple YouTube videos at once
 */

import { App } from 'obsidian';
import { BaseVideoModal, BaseVideoModalOptions } from '../../common/base-video-modal';
import { OutputFormat } from '../../../types';

export interface BatchProcessingOptions extends BaseVideoModalOptions {
    onProcess: (urls: string[], format: OutputFormat, provider?: string, model?: string) => Promise<string[]>;
    onOpenFile?: (filePath: string) => Promise<void>;
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

export class BatchVideoModal extends BaseVideoModal {
    private urls: BatchItem[] = [];
    private urlInput!: HTMLTextAreaElement;
    private itemsContainer!: HTMLElement;
    private batchProgressContainer!: HTMLElement;
    private processButton!: HTMLButtonElement;

    constructor(
        app: App,
        private batchOptions: BatchProcessingOptions,
    ) {
        super(app, {
            providers: batchOptions.providers,
            defaultProvider: batchOptions.defaultProvider,
            defaultModel: batchOptions.defaultModel,
            modelOptions: batchOptions.modelOptionsMap,
        });
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

        // Options (using base class methods)
        this.createOptions();

        // Items list
        this.createItemsList();

        // Progress section
        this.createProgressSection();

        // Action buttons
        this.createActionButtons();
    }

    // eslint-disable-next-line max-lines-per-function
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
            .ytc-select-container {
                margin-bottom: 12px;
            }
            .ytc-select-container label {
                display: block;
                margin-bottom: 4px;
                font-weight: 500;
            }
            .ytc-video-select {
                width: 100%;
                padding: 8px;
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-secondary);
            }
        `;
        this.contentEl.appendChild(style);
    }

    private createUrlInput(): void {
        const container = this.contentEl.createDiv({ cls: 'ytc-batch-input-container' });

        this.urlInput = container.createEl('textarea', {
            cls: 'ytc-batch-textarea',
            attr: {
                placeholder:
                    'https://youtube.com/watch?v=video1\nhttps://youtube.com/watch?v=video2\nhttps://youtu.be/video3',
            },
        });

        this.urlInput.addEventListener('input', () => this.parseUrls());
        this.urlInput.addEventListener('paste', () => {
            setTimeout(() => this.parseUrls(), 0);
        });
    }

    private createOptions(): void {
        const container = this.contentEl.createDiv({ cls: 'ytc-batch-options' });

        // Format selection using base class dropdown
        this.createFormatSelect(container, 'Output Format');

        // Provider selection using base class dropdown
        this.createProviderSelect(container, 'AI Provider');

        // Model selection using base class dropdown
        this.createModelSelect(container, 'Model');
    }

    private createItemsList(): void {
        this.itemsContainer = this.contentEl.createDiv({ cls: 'ytc-batch-items' });
        this.itemsContainer.style.display = 'none';
    }

    private createProgressSection(): void {
        this.batchProgressContainer = this.contentEl.createDiv({ cls: 'ytc-batch-progress' });

        const progressBar = this.batchProgressContainer.createDiv({ cls: 'ytc-batch-progress-bar' });
        progressBar.createDiv({ cls: 'ytc-batch-progress-fill' });

        this.batchProgressContainer.createDiv({ cls: 'ytc-batch-progress-text' });
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
            if (this.isValidVideoUrl(url)) {
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
            if (!item) continue;
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
            case 'pending':
                return '⏳';
            case 'processing':
                return '🔄';
            case 'completed':
                return '✅';
            case 'failed':
                return '❌';
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

        this.setProcessing(true);
        this.updateProcessButton();
        this.batchProgressContainer.classList.add('visible');

        const progressFill = this.batchProgressContainer.querySelector('.ytc-batch-progress-fill') as HTMLElement;
        const progressText = this.batchProgressContainer.querySelector('.ytc-batch-progress-text') as HTMLElement;

        let completed = 0;
        const total = this.urls.length;

        try {
            // Process one by one to show progress
            for (let i = 0; i < this.urls.length; i++) {
                if (!this.urls[i]) continue;
                this.urls[i]!.status = 'processing';
                this.renderItems();

                progressText.textContent = `Processing ${i + 1} of ${total}...`;
                progressFill.style.width = `${(i / total) * 100}%`;

                try {
                    const results = await this.batchOptions.onProcess(
                        [this.urls[i]!.url],
                        this.selectedFormat,
                        this.selectedProvider,
                        this.selectedModel,
                    );

                    this.urls[i]!.status = 'completed';
                    this.urls[i]!.result = results[0];
                    completed++;
                } catch (error) {
                    this.urls[i]!.status = 'failed';
                    this.urls[i]!.error = error instanceof Error ? error.message : String(error);
                }

                this.renderItems();
                progressFill.style.width = `${((i + 1) / total) * 100}%`;
            }

            progressText.textContent = `Completed: ${completed}/${total} videos processed`;

            if (completed === total) {
                this.showNotice(`Successfully processed ${completed} videos!`, 'success');
            } else {
                this.showNotice(`Processed ${completed}/${total} videos. Some failed.`, 'error');
            }
        } catch (error) {
            this.showNotice(
                `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
                'error',
            );
        } finally {
            this.setProcessing(false);
            this.updateProcessButton();
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
