import { logger } from './logger';
import { App, TFile } from 'obsidian';
import { ValidationUtils } from '../validation';
import { YouTubePluginSettings } from '../types';

/**
 * URL handling service for detecting and processing YouTube URLs from various sources
 */

export interface UrlDetectionResult {
    url: string;
    source: 'create' | 'active-leaf' | 'protocol' | 'clipboard';
    filePath?: string;
    file?: TFile;
    content?: string;
}

export interface UrlHandlerConfig {
    noteMarker: string;
    urlHandlerDelay: number;
    maxHandledFiles: number;
    tempFileAgeThreshold: number;
}

export class UrlHandler {
    private handledTempFiles: Set<string> = new Set();
    private pendingUrls: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        private app: App,
        private settings: YouTubePluginSettings,
        private onUrlDetected: (result: UrlDetectionResult) => void,
        private config: UrlHandlerConfig = {
            noteMarker: '<!-- ytc-extension:youtube-clipper -->',
            urlHandlerDelay: 500,
            maxHandledFiles: 100,
            tempFileAgeThreshold: 5000,
        }
    ) {}

    /**
     * Check if a file is a temporary YouTube clipper file
     */
    // eslint-disable-next-line complexity
    private isTempFile(file: TFile, content: string): boolean {
        try {
            // 1. Contains the hidden marker (most reliable)
            if (content?.includes(this.config.noteMarker)) {
                logger.debug('File identified as temp file via marker', 'UrlHandler', {
                    filePath: file.path,
                    hasMarker: true,
                });
                return true;
            }

            // 2. File name matches the Chrome extension pattern
            if (file.name?.startsWith('YouTube Clip -')) {
                logger.debug('File identified as temp file via name', 'UrlHandler', {
                    filePath: file.path,
                    fileName: file.name,
                });
                return true;
            }

            // 3. Content is ONLY a YouTube URL and file is very new/small AND NOT in output path
            const trimmedContent = content.trim();
            const lines = trimmedContent.split('\n').filter(line => line.trim().length > 0);
            const firstLine = lines[0] ?? '';
            const isUrlOnly = lines.length === 1 && ValidationUtils.isValidYouTubeUrl(firstLine);

            if (isUrlOnly && content.length < 200) {
                const fileAge = Date.now() - file.stat.ctime;
                const isInOutputPath = file.path.includes(this.settings.outputPath);

                if (fileAge < this.config.tempFileAgeThreshold && !isInOutputPath) {
                    logger.debug('File identified as temp file via content analysis', 'UrlHandler', {
                        filePath: file.path,
                        fileAge,
                        isInOutputPath,
                        contentLength: content.length,
                    });
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Error checking if file is temp file', 'UrlHandler', {
                filePath: file.path,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Extract YouTube URL from file content
     */
    private extractUrl(content: string): string | null {
        try {
            if (content?.includes(this.config.noteMarker)) {
                const url = content.replace(this.config.noteMarker, '').trim();
                return ValidationUtils.isValidYouTubeUrl(url) ? url : null;
            }

            // Try to find the first YouTube URL anywhere in the content
            const trimmed = content.trim();
            const ytRegex = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{6,}/i;
            const ytbeRegex = /https?:\/\/(?:www\.)?youtu\.be\/[A-Za-z0-9_-]{6,}/i;
            const match = trimmed.match(ytRegex) ?? trimmed.match(ytbeRegex);

            if (match?.[1]) {
                const url = match[1].trim();
                return ValidationUtils.isValidYouTubeUrl(url) ? url : null;
            }

            return null;
        } catch (error) {
            logger.error('Error extracting URL from content', 'UrlHandler', {
                error: error instanceof Error ? error.message : String(error),
                contentLength: content.length,
            });
            return null;
        }
    }

    /**
     * Safely handle detected URL with deduplication and debouncing
     */
    private handleUrlSafely(result: UrlDetectionResult): void {
        logger.info('URL detected, processing safely', 'UrlHandler', {
            url: result.url,
            source: result.source,
            filePath: result.filePath,
        });

        // Additional safety check: only process if this appears to be a temp file
        if (result.file && result.content && !this.isTempFile(result.file, result.content)) {
            logger.warn('URL rejected - not in temp file', 'UrlHandler', {
                url: result.url,
                filePath: result.filePath,
            });
            return;
        }

        // Check if URL already handled
        if (this.handledTempFiles.has(result.url)) {
            logger.debug('URL already handled, skipping', 'UrlHandler', { url: result.url });
            return;
        }

        // Cancel any pending handler for this URL
        if (this.pendingUrls.has(result.url)) {
            logger.debug('Cancelling pending handler for URL', 'UrlHandler', { url: result.url });
            clearTimeout(this.pendingUrls.get(result.url));
        }

        // Mark as handled immediately to prevent duplicates
        this.handledTempFiles.add(result.url);
        if (result.filePath) {
            this.handledTempFiles.add(result.filePath);
        }

        // Debounce to handle rapid-fire events
        const timeout = setTimeout(() => {
            logger.info('Processing URL after debounce', 'UrlHandler', { url: result.url });
            this.onUrlDetected(result);
            this.pendingUrls.delete(result.url);

            // Clean up old entries to prevent memory leaks
            this.cleanupHandledFiles();
        }, this.config.urlHandlerDelay);

        this.pendingUrls.set(result.url, timeout);
    }

    /**
     * Clean up old handled file entries to prevent memory leaks
     */
    private cleanupHandledFiles(): void {
        if (this.handledTempFiles.size > this.config.maxHandledFiles) {
            const entries = Array.from(this.handledTempFiles);
            // Keep only the most recent entries
            this.handledTempFiles.clear();
            entries.slice(-Math.floor(this.config.maxHandledFiles / 2)).forEach(entry => {
                this.handledTempFiles.add(entry);
            });
            logger.debug('Cleaned up handled temp files', 'UrlHandler', {
                oldSize: entries.length,
                newSize: this.handledTempFiles.size,
            });
        }
    }

    /**
     * Handle file creation event
     */
    public async handleFileCreate(file: TFile): Promise<void> {
        try {
            // Use duck typing instead of instanceof for better testability
            if (!file?.path || !file.stat) return;

            const content = await this.app.vault.read(file);

            // Check if this is a temporary file
            if (!this.isTempFile(file, content)) {
                logger.debug('Ignoring non-temp file in create handler', 'UrlHandler', {
                    filePath: file.path,
                });
                return;
            }

            // Extract URL
            const url = this.extractUrl(content);
            if (!url) {
                logger.debug('No URL extracted from temp file', 'UrlHandler', {
                    filePath: file.path,
                });
                return;
            }

            const result: UrlDetectionResult = {
                url,
                source: 'create',
                filePath: file.path,
                file,
                content,
            };

            logger.info('CREATE EVENT - detected temp note', 'UrlHandler', { ...result });
            this.handleUrlSafely(result);

        } catch (error) {
            logger.error('Error handling file create', 'UrlHandler', {
                filePath: file.path,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Handle active leaf change event
     */
    public async handleActiveLeafChange(): Promise<void> {
        try {
            const file = this.app.workspace.getActiveFile();
            if (!file) return;

            // Ensure we have a TFile, not TAbstractFile
            if (!('stat' in file) || !('basename' in file) || !('extension' in file)) {
                return;
            }

            if (this.handledTempFiles.has(file.path)) return;

            const content = await this.app.vault.read(file);

            // Check if this is a temporary file
            if (!this.isTempFile(file, content)) {
                logger.debug('Ignoring non-temp file in active leaf handler', 'UrlHandler', {
                    filePath: file.path,
                });
                return;
            }

            // Extract URL
            const url = this.extractUrl(content);
            if (!url) {
                logger.debug('No URL extracted from temp file in active leaf', 'UrlHandler', {
                    filePath: file.path,
                });
                return;
            }

            const result: UrlDetectionResult = {
                url,
                source: 'active-leaf',
                filePath: file.path,
                file,
                content,
            };

            logger.info('ACTIVE-LEAF-CHANGE EVENT - detected temp note', 'UrlHandler', { ...result });
            this.handleUrlSafely(result);

        } catch (error) {
            logger.error('Error handling active leaf change', 'UrlHandler', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Handle protocol handler invocation
     */
    public handleProtocol(params: Record<string, string>): void {
        try {
            const url = params.url ?? params.content ?? params.path ?? '';
            if (url && ValidationUtils.isValidYouTubeUrl(url)) {
                const result: UrlDetectionResult = {
                    url,
                    source: 'protocol',
                };

                logger.info('Protocol handler received valid URL', 'UrlHandler', { ...result });

                // Defer into the plugin main loop
                setTimeout(() => {
                    this.onUrlDetected(result);
                }, 200);
            } else {
                logger.debug('Protocol handler received no valid URL', 'UrlHandler', { params });
            }
        } catch (error) {
            logger.error('Error in protocol handler', 'UrlHandler', {
                params,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Handle clipboard URL
     */
    public async handleClipboardUrl(): Promise<void> {
        try {
            // Try clipboard first
            let text = '';
            try {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                if (navigator?.clipboard?.readText) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    text = (await navigator.clipboard.readText()) ?? '';
                }
            } catch (error) {
                logger.debug('Could not read clipboard', 'UrlHandler', {
                    error: error instanceof Error ? error.message : String(error),
                });
                text = '';
            }

            if (text && ValidationUtils.isValidYouTubeUrl(text.trim())) {
                const result: UrlDetectionResult = {
                    url: text.trim(),
                    source: 'clipboard',
                };

                logger.info('URL found in clipboard', 'UrlHandler', { ...result });
                this.onUrlDetected(result);
                return;
            }

            // No valid URL on clipboard - return null to let caller handle prompting
            logger.debug('No valid YouTube URL in clipboard', 'UrlHandler');
        } catch (error) {
            logger.error('Error handling clipboard URL', 'UrlHandler', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Clear all handled URLs and pending operations
     */
    public clear(): void {
        // Clear all pending timeouts
        this.pendingUrls.forEach(timeout => clearTimeout(timeout));
        this.pendingUrls.clear();

        // Clear handled URLs
        this.handledTempFiles.clear();

        logger.info('URL handler cleared', 'UrlHandler');
    }

    /**
     * Update settings
     */
    public updateSettings(settings: YouTubePluginSettings): void {
        this.settings = settings;
        logger.debug('URL handler settings updated', 'UrlHandler');
    }
}