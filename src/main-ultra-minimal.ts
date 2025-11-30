import { Notice, Plugin, Modal } from 'obsidian';

// Ultra-minimal YouTube Clipper Plugin
export default class YoutubeClipperPlugin extends Plugin {
    settings = {
        outputPath: 'YouTube/Processed Videos'
    };

    async onload(): Promise<void> {
        console.log('🎬 YouTube Clipper: Loading...');

        try {
            // Load settings with safety
            await this.safeLoadSettings();

            // Add a simple command first (no ribbon icon)
            this.addCommand({
                id: 'open-youtube-clipper',
                name: 'Open YouTube Clipper',
                callback: () => {
                    this.openModal();
                }
            });

            console.log('✅ YouTube Clipper: Loaded successfully!');
            new Notice('🎬 YouTube Clipper loaded!');

        } catch (error) {
            console.error('❌ YouTube Clipper: Failed to load:', error);
            new Notice('❌ YouTube Clipper failed to load');
        }
    }

    onunload(): void {
        console.log('🎬 YouTube Clipper: Unloaded');
    }

    private async safeLoadSettings(): Promise<void> {
        try {
            const data = await this.loadData();
            if (data && typeof data === 'object') {
                this.settings = { ...this.settings, ...data };
            }
        } catch (error) {
            console.warn('Settings load failed, using defaults:', error);
        }
    }

    private openModal(): void {
        try {
            const modal = new YouTubeModal(this.app);
            modal.open();
        } catch (error) {
            console.error('Failed to open modal:', error);
            new Notice('Failed to open modal');
        }
    }
}

// Ultra-minimal modal
class YouTubeModal extends Modal {
    private inputEl?: HTMLInputElement;

    constructor(app: App) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '🎬 YouTube Clipper' });

        const inputContainer = contentEl.createDiv();
        inputContainer.style.margin = '20px 0';

        const label = inputContainer.createEl('label', {
            text: 'YouTube URL: '
        });
        label.style.display = 'block';
        label.style.marginBottom = '8px';

        this.inputEl = inputContainer.createEl('input', {
            type: 'url',
            placeholder: 'https://www.youtube.com/watch?v=...'
        });
        this.inputEl.style.width = '100%';
        this.inputEl.style.padding = '8px';
        this.inputEl.style.border = '1px solid #ccc';
        this.inputEl.style.borderRadius = '4px';

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.textAlign = 'right';

        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel'
        });
        cancelButton.style.marginRight = '10px';
        cancelButton.onclick = () => this.close();

        const processButton = buttonContainer.createEl('button', {
            text: 'Process'
        });
        processButton.style.backgroundColor = '#007bff';
        processButton.style.color = 'white';
        processButton.style.padding = '8px 16px';
        processButton.style.border = 'none';
        processButton.style.borderRadius = '4px';
        processButton.style.cursor = 'pointer';
        processButton.onclick = () => this.processUrl();

        // Focus input
        if (this.inputEl) {
            this.inputEl.focus();
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }

    private processUrl(): void {
        const url = this.inputEl?.value?.trim();

        if (!url) {
            new Notice('Please enter a URL');
            return;
        }

        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            new Notice('Please enter a valid YouTube URL');
            return;
        }

        this.createNote(url);
        this.close();
    }

    private async createNote(url: string): Promise<void> {
        try {
            const videoId = this.extractVideoId(url);
            const fileName = `YouTube-${videoId || Date.now()}.md`;

            const content = `# YouTube Video\n\n**URL:** ${url}\n**Video ID:** ${videoId || 'Unknown'}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n## Notes\n\n*This video was processed using YouTube Clipper*\n\n---\n\n*Processed by: YouTube Clipper Plugin*`;

            const file = await this.app.vault.create(fileName, content);
            new Notice(`✅ Created note: ${file.basename}`);

            // Open the file
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.openFile(file);

        } catch (error) {
            console.error('Failed to create note:', error);
            new Notice('❌ Failed to create note');
        }
    }

    private extractVideoId(url: string): string | null {
        try {
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }
}