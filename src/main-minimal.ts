import { directEnhancer } from './direct-enhancer';
import { SimpleYouTubeModal } from './components/features/youtube';
import { ValidationUtils } from './lib/utils-consolidated';
import { Notice, Plugin } from 'obsidian';


const DEFAULT_SETTINGS = {
    geminiApiKey: '',
    groqApiKey: '',
    outputPath: 'YouTube/Processed Videos',
    useEnvironmentVariables: false,
    environmentPrefix: 'YTC',
    performanceMode: 'balanced',
    enableParallelProcessing: true,
    preferMultimodal: true,
    defaultMaxTokens: 4096,
    defaultTemperature: 0.5
};

export default class YoutubeClipperPlugin extends Plugin {
    settings = DEFAULT_SETTINGS;
    isUnloading = false;

    constructor(app: App) {
        super(app);
    }

    async onload(): Promise<void> {
        
...');

        try {
            // Load settings with error handling
            await this.loadBasicSettings();

            // Add ribbon icon
            this.addRibbonIcon('film', 'Process YouTube Video', () => {
                this.openYouTubeModal();
            });

            // Add command
            this.addCommand({
                id: 'process-youtube-video',
                name: 'Process YouTube Video',
                callback: () => {
                    this.openYouTubeModal();
                }
            });

            // Initialize UI enhancer
            setTimeout(() => {
                try {
                    directEnhancer.forceEnhancement();
                    
} catch (error) {
                    
}
            }, 1000);

            // Add force enhance command
            this.addCommand({
                id: 'force-enhance-ui',
                name: 'YouTube Clipper: Force Enhanced UI',
                callback: () => {
                    directEnhancer.forceEnhancement();
                    new Notice('Enhanced UI applied');
                }
            });

            
new Notice('🎬 YouTube Clipper Plugin loaded!');

        } catch (error) {
            
new Notice('❌ Failed to load YouTube Clipper Plugin');
        }
    }

    onunload(): void {
        
this.isUnloading = true;

        try {
            directEnhancer.destroy();
            
} catch (error) {
            
}
    }

    private async loadBasicSettings(): Promise<void> {
        try {
            const loadedData = await this.loadData();
            this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
            
} catch (error) {
            
this.settings = { ...DEFAULT_SETTINGS };
        }
    }

    private async saveBasicSettings(): Promise<void> {
        try {
            await this.saveData(this.settings);
            
} catch (error) {
            
}
    }

    private openYouTubeModal(initialUrl?: string): void {
        if (this.isUnloading) {
            
return;
        }

        try {
            const modal = new SimpleYouTubeModal(this.app, {
                onProcess: async (url: string) => {
                    await this.processVideo(url);
                },
                ...(initialUrl && { initialUrl })
            });

            modal.open();
        } catch (error) {
            
new Notice('Failed to open YouTube Clipper modal');
        }
    }

    private async processVideo(url: string): Promise<void> {
        try {
            new Notice('🎬 Processing YouTube video...');

            // Basic validation
            if (!ValidationUtils.isValidYouTubeUrl(url)) {
                new Notice('❌ Please enter a valid YouTube URL');
                return;
            }

            // For now, just create a basic note
            const videoId = this.extractVideoId(url);
            const fileName = `YouTube-${videoId || Date.now()}.md`;
            const content = `# YouTube Video: ${url}

---

**URL:** ${url}
**Video ID:** ${videoId || 'Unknown'}
**Processed:** ${new Date().toISOString()}

## Summary

This video was processed using the YouTube Clipper plugin.

*Note: AI processing features require API keys to be configured in settings.*

---

*Processed by YouTube Clipper Plugin*`;

            const file = await this.app.vault.create(fileName, content);
            new Notice(`✅ Video processed successfully: ${file.basename}`);

            // Open the file
            await this.app.workspace.getLeaf(true).openFile(file);

        } catch (error) {
            
new Notice('❌ Failed to process video. Please check console for details.');
        }
    }

    private extractVideoId(url: string): string | null {
        try {
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
                /youtube\.com\/watch\?.*v=([^&\n?#]+)/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    // Expose UI enhancer for debugging
    getUIEnhancer() {
        return directEnhancer;
    }
}