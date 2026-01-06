/**
 * Plugin-to-Plugin Integration Service
 */

export interface PluginIntegration {
    name: string;
    enabled: boolean;
    available: boolean;
}

export class PluginIntegrationManager {
    private integrations: Map<string, PluginIntegration> = new Map();

    constructor(private app: any) {
        this.detectIntegrations();
    }

    private detectIntegrations(): void {
        // Detect Dataview
        this.integrations.set('dataview', {
            name: 'Dataview',
            enabled: false,
            available: this.hasPlugin('dataview'),
        });

        // Detect Templater
        this.integrations.set('templater', {
            name: 'Templater',
            enabled: false,
            available: this.hasPlugin('templater-obsidian'),
        });

        // Detect Kanban
        this.integrations.set('kanban', {
            name: 'Kanban',
            enabled: false,
            available: this.hasPlugin('obsidian-kanban'),
        });
    }

    private hasPlugin(pluginId: string): boolean {
        return this.app?.plugins?.plugins?.hasOwnProperty(pluginId) || false;
    }

    enableIntegration(name: string): boolean {
        const integration = this.integrations.get(name);
        if (integration?.available) {
            integration.enabled = true;
            return true;
        }
        return false;
    }

    disableIntegration(name: string): void {
        const integration = this.integrations.get(name);
        if (integration) {
            integration.enabled = false;
        }
    }

    /**
     * Add Dataview metadata to note
     */
    addDataviewMetadata(videoData: any): string {
        const integration = this.integrations.get('dataview');
        if (!integration?.enabled) {
            return '';
        }

        return `---
type: video
source: youtube
videoId: ${videoData.videoId}
title: "${videoData.title}"
author: "${videoData.author}"
duration: ${videoData.duration}
publishedAt: ${videoData.publishedAt}
tags: [${videoData.tags?.join(', ') || ''}]
processedAt: "${new Date().toISOString()}"
---`;
    }

    /**
     * Process note with Templater
     */
    async processWithTemplater(content: string, variables: Record<string, any>): Promise<string> {
        const integration = this.integrations.get('templater');
        if (!integration?.enabled) {
            return content;
        }

        const templater = this.app.plugins.plugins['templater-obsidian'];
        if (!templater) {
            return content;
        }

        try {
            return await templater.templater.parse_templates({ content, target_path: '', run_mode: 0 }, variables);
        } catch (error) {
            console.error('Templater processing error:', error);
            return content;
        }
    }

    /**
     * Add Kanban board entry
     */
    addKanbanEntry(videoData: any): string {
        const integration = this.integrations.get('kanban');
        if (!integration?.enabled) {
            return '';
        }

        return `### Kanban\n\n- [ ] Review: ${videoData.title}\n\t[Video Link](${videoData.url})\n`;
    }

    getAvailableIntegrations(): PluginIntegration[] {
        return Array.from(this.integrations.values());
    }

    getIntegration(name: string): PluginIntegration | undefined {
        return this.integrations.get(name);
    }
}

export class PluginAPI {
    private callbacks: Map<string, Set<Function>> = new Map();

    on(event: string, callback: Function): () => void {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, new Set());
        }
        this.callbacks.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
            this.callbacks.get(event)?.delete(callback);
        };
    }

    emit(event: string, data: any): void {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(data);
                } catch (error) {
                    console.error(`Error in event callback for '${event}':`, error);
                }
            });
        }
    }

    /**
     * Process video and emit event
     */
    async processVideo(url: string, options?: any): Promise<any> {
        // This would integrate with actual video processing
        this.emit('video-processing-started', { url, options });

        // Simulate processing
        const result = { url, processed: true };

        this.emit('video-processing-completed', result);
        return result;
    }
}

export const pluginAPI = new PluginAPI();
