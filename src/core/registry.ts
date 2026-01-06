/**
 * Plugin Registry
 * Handles registration of UI components, commands, and event handlers
 */

import { Plugin, WorkspaceLeaf } from 'obsidian';
import { YouTubeSettingsTab } from '../settings-tab';
import { YouTubeUrlModal, BatchVideoModal } from '../components/features/youtube';
import { YouTubePluginSettings } from '../types';

export interface RegistrationConfig {
  plugin: Plugin;
  settings: YouTubePluginSettings;
  onShowUrlModal: (url?: string) => Promise<void>;
  onOpenBatchModal: () => Promise<void>;
  onOpenClipboardUrl: () => Promise<void>;
  onSettingsChange: (newSettings: YouTubePluginSettings) => Promise<void>;
  getModalManager: () => any;
  getServiceContainer: () => any;
  saveSettings: () => Promise<void>;
}

export class PluginRegistry {
    private ribbonIcons: HTMLElement[] = [];

    constructor(private config: RegistrationConfig) {}

    /**
   * Register all UI components
   */
    registerAll(): void {
        this.registerRibbonIcons();
        this.registerCommands();
        this.registerSettingsTab();
    }

    /**
   * Register ribbon icons
   */
    private registerRibbonIcons(): void {
        const { plugin, onShowUrlModal, onOpenBatchModal } = this.config;

        // Main processing icon
        const mainIcon = plugin.addRibbonIcon('film', 'Process YouTube Video', () => {
            console.log('[YT-CLIPPER] Ribbon icon clicked');
            void onShowUrlModal();
        });
        this.ribbonIcons.push(mainIcon);

        // Batch processing icon
        const batchIcon = plugin.addRibbonIcon('layers', 'Batch Process YouTube Videos', () => {
            void onOpenBatchModal();
        });
        this.ribbonIcons.push(batchIcon);
    }

    /**
   * Register commands
   */
    private registerCommands(): void {
        const { plugin, onShowUrlModal, onOpenClipboardUrl, onOpenBatchModal } = this.config;

        // Process YouTube Video command
        plugin.addCommand({
            id: 'ytp-process-youtube-video',
            name: 'Process YouTube Video',
            callback: () => {
                console.log('[YT-CLIPPER] Process YouTube Video command');
                void onShowUrlModal();
            },
        });

        // Open URL from clipboard command
        plugin.addCommand({
            id: 'ytp-open-url-from-clipboard',
            name: 'YouTube Clipper: Open URL Modal (from clipboard)',
            callback: async () => {
                await onOpenClipboardUrl();
            },
        });

        // Batch process command
        plugin.addCommand({
            id: 'ytp-batch-process',
            name: 'YouTube Clipper: Batch Process Videos',
            callback: () => {
                void onOpenBatchModal();
            },
        });
    }

    /**
   * Register settings tab
   */
    private registerSettingsTab(): void {
        const { plugin, onSettingsChange } = this.config;

        plugin.addSettingTab(new YouTubeSettingsTab(plugin.app, {
            plugin,
            onSettingsChange,
        }));
    }

    /**
   * Cleanup registered components
   */
    cleanup(): void {
    // Remove ribbon icons
        this.ribbonIcons.forEach(icon => {
            icon.remove();
        });
        this.ribbonIcons = [];
    }

    /**
   * Get registered ribbon icons count
   */
    getRibbonIconsCount(): number {
        return this.ribbonIcons.length;
    }
}

export { PluginRegistry as UIRegistry };
