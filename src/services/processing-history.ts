/**
 * Processing history service
 * Tracks processed videos to prevent re-processing and enable history-based features.
 * Persists to plugin data via the main plugin's loadData/saveData mechanism.
 */

import { OutputFormat } from '../types';
import { Plugin } from 'obsidian';

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
 * Serializes every data.json read-modify-write cycle performed here.
 *
 * `loadData()` / `saveData()` round-trip the *whole* plugin data file, so two
 * concurrent cycles can interleave as read → read → write → write and the
 * loser's write silently reverts the winner's changes (a history write landing
 * after a settings write would resurrect stale settings). Chaining a shared
 * promise makes each cycle run to completion before the next one starts.
 */
let writeLock: Promise<void> = Promise.resolve();

/**
 * Enqueue `task` on the plugin-data lock. Exported so any other writer of
 * plugin data (e.g. the plugin's `saveSettings`) can join the same queue
 * instead of racing it.
 */
export function withPluginDataLock<T>(task: () => Promise<T>): Promise<T> {
    const run = writeLock.then(task, task);
    // Keep the chain alive regardless of success/failure of this task.
    writeLock = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

/**
 * Manages processing history for the plugin
 */
export class ProcessingHistoryService {
    private entries: HistoryEntry[] = [];
    private plugin: Plugin;
    private loadingPromise?: Promise<void>;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        // Kick off loading immediately; callers can also await loadAsync().
        this.loadingPromise = this.loadAsync();
    }

    /**
     * Load history from plugin data. Memoized so the load runs exactly once
     * even if the constructor and the plugin's onload both trigger it, and so
     * that add() can safely await completion before writing.
     */
    async loadAsync(): Promise<void> {
        if (!this.loadingPromise) {
            this.loadingPromise = this.performLoad();
        }
        return this.loadingPromise;
    }

    private async performLoad(): Promise<void> {
        try {
            await withPluginDataLock(async () => {
                const data = (await this.plugin.loadData()) as Record<string, unknown> | null;
                if (data?.[STORAGE_KEY] && Array.isArray(data[STORAGE_KEY])) {
                    this.entries = data[STORAGE_KEY] as HistoryEntry[];
                }
            });
        } catch {
            this.entries = [];
        }
    }

    /**
     * Save history to plugin data
     */
    private async save(): Promise<void> {
        try {
            await withPluginDataLock(async () => {
                const data = ((await this.plugin.loadData()) as Record<string, unknown> | null) ?? {};
                data[STORAGE_KEY] = this.entries;
                await this.plugin.saveData(data);
            });
        } catch {
            // Ignore
        }
    }

    /**
     * Add a new history entry
     */
    async add(entry: Omit<HistoryEntry, 'processedAt'>): Promise<void> {
        // Ensure the in-memory entries have been loaded before we read-modify-write,
        // otherwise an early add() could persist an empty history over the real one.
        await this.loadAsync();

        const fullEntry: HistoryEntry = {
            ...entry,
            processedAt: new Date().toISOString(),
        };

        // Remove any existing entry for the same video+format
        this.entries = this.entries.filter(e => !(e.videoId === entry.videoId && e.format === entry.format));

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
