import { App, Modal, Notice } from 'obsidian';

/**
 * Simple YouTube URL modal placeholder
 * Basic functionality without enhanced UI
 */


export interface SimpleYouTubeModalOptions {
    onProcess: (url: string) => Promise<void>;
    initialUrl?: string;
}

export class SimpleYouTubeModal extends Modal {
    private urlInput?: HTMLInputElement;
    private processButton?: HTMLButtonElement;

    constructor(
        app: App,
        private options: SimpleYouTubeModalOptions
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Add modal class for direct enhancer
        this.modalEl.classList.add('ytc-modal', 'modal');
        contentEl.classList.add('ytc-modal-content', 'modal-content');

        contentEl.createEl('h2', {
            text: '🎬 YouTube Video Processor',
            cls: 'ytc-modal-header modal-title'
        });

        const urlContainer = contentEl.createDiv();
        urlContainer.style.margin = '16px 0';

        urlContainer.createEl('label', { text: 'YouTube URL:' });

        this.urlInput = urlContainer.createEl('input', {
            type: 'url',
            placeholder: 'https://www.youtube.com/watch?v=...',
            value: this.options.initialUrl || '',
            cls: 'ytc-modal-input'
        });

        this.urlInput.style.width = '100%';
        this.urlInput.style.padding = '8px';
        this.urlInput.style.marginTop = '8px';

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';

        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'ytc-modal-button'
        });
        cancelButton.onclick = () => this.close();

        this.processButton = buttonContainer.createEl('button', {
            text: 'Process Video',
            cls: 'ytc-modal-button mod-cta'
        });
        this.processButton.onclick = () => this.handleProcess();

        // Focus on input
        this.urlInput.focus();
        this.urlInput.select();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }

    private async handleProcess(): Promise<void> {
        const url = this.urlInput?.value?.trim();

        if (!url) {
            new Notice('Please enter a YouTube URL');
            return;
        }

        // Basic URL validation
        if (!url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
            new Notice('Please enter a valid YouTube URL');
            return;
        }

        // Disable button and show loading
        if (this.processButton) {
            this.processButton.disabled = true;
            this.processButton.textContent = 'Processing...';
        }

        try {
            await this.options.onProcess(url);
            this.close();
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Re-enable button
            if (this.processButton) {
                this.processButton.disabled = false;
                this.processButton.textContent = 'Process Video';
            }
        }
    }
}