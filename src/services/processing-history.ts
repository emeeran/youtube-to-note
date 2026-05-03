/**
 * Processing history service
 * Tracks processed videos to prevent re-processing and enable history-based features.
 * Persists to plugin data via the main plugin's loadData/saveData mechanism.
 */

import { OutputFormat } from '../types';
import { App, Plugin } from 'obsidian';

export interface HistoryEntry {
    videoId: string;
    title: string;
    url: string;
    format: OutputFormat;
    provider: string;
    model: string;
    filePath: string;
    processedAt: string; // ISO date
    channelName?: string;
    duration?: number;
}

const MAX_HISTORY_ENTRIES = 200;
const STORAGE_KEY = 'ytc-processing-history';

/**
 * Manages processing history for the plugin
 */
export class ProcessingHistoryService {
    private entries: HistoryEntry[] = [];
    private plugin: Plugin;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.load();
    }

    /**
     * Load history from plugin data
     */
    private load(): void {
        try {
            const data = (this.plugin as { loadData(): Promise<unknown> | unknown }).loadData;
            if (typeof data === 'function') {
                // loadData is async, but we call it sync in constructor
                // The plugin should call loadAsync() after construction
            }
        } catch {
            // Ignore
        }
    }

    /**
     * Async load — call after construction
     */
    async loadAsync(): Promise<void> {
        try {
            const data = await this.plugin.loadData() as Record<string, unknown> | null;
            if (data?.[STORAGE_KEY] && Array.isArray(data[STORAGE_KEY])) {
                this.entries = data[STORAGE_KEY] as HistoryEntry[];
            }
        } catch {
            this.entries = [];
        }
    }

    /**
     * Save history to plugin data
     */
    private async save(): Promise<void> {
        try {
            const data = (await this.plugin.loadData()) as Record<string, unknown> | null ?? {};
            data[STORAGE_KEY] = this.entries;
            await this.plugin.saveData(data);
        } catch {
            // Ignore
        }
    }

    /**
     * Add a new history entry
     */
    async add(entry: Omit<HistoryEntry, 'processedAt'>): Promise<void> {
        const fullEntry: HistoryEntry = {
            ...entry,
            processedAt: new Date().toISOString(),
        };

        // Remove any existing entry for the same video+format
        this.entries = this.entries.filter(
            e => !(e.videoId === entry.videoId && e.format === entry.format)
        );

        // Prepend (newest first)
        this.entries.unshift(fullEntry);

        // Trim to max size
        if (this.entries.length > MAX_HISTORY_ENTRIES) {
            this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES);
        }

        await this.save();
    }

    /**
     * Find a previously processed entry for a video
     */
    find(videoId: string, format?: OutputFormat): HistoryEntry | undefined {
        if (format) {
            return this.entries.find(e => e.videoId === videoId && e.format === format);
        }
        return this.entries.find(e => e.videoId === videoId);
    }

    /**
     * Check if a video has been processed before
     */
    hasBeenProcessed(videoId: string): boolean {
        return this.entries.some(e => e.videoId === videoId);
    }

    /**
     * Get all history entries (newest first)
     */
    getAll(): HistoryEntry[] {
        return [...this.entries];
    }

    /**
     * Get recent entries
     */
    getRecent(count = 10): HistoryEntry[] {
        return this.entries.slice(0, count);
    }

    /**
     * Clear all history
     */
    async clear(): Promise<void> {
        this.entries = [];
        await this.save();
    }
}
