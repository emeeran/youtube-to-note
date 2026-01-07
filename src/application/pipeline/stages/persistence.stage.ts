/**
 * Stage 5: Persistence
 * File writing, conflict detection, and cache updates
 */

import { BaseStage } from '../stage';
import { PipelineContext, StageOutput } from '../types';
import { logger } from '../../../services/logger';

export interface PersistenceInput {
  generatedContent: string;
  videoData: Record<string, unknown>;
  url: string;
  provider?: string;
  model?: string;
  outputPath?: string;
}

export interface PersistenceOutput extends StageOutput {
  filePath: string;
  fileSize: number;
  cacheUpdated: boolean;
  conflicts: string[];
}

interface FileServiceInterface {
    saveToFile(title: string, content: string, outputPath: string): Promise<string>;
}

interface CacheServiceInterface {
    set?(key: string, value: unknown, ttl?: number): void;
}

export class PersistenceStage extends BaseStage {
    readonly name = 'persistence';

    constructor(
    private fileService?: FileServiceInterface,
    private cacheService?: CacheServiceInterface
    ) {
        super();
    }

    async execute(context: PipelineContext): Promise<PersistenceOutput> {
        const input = context.input as PersistenceInput;

        if (!this.fileService) {
            throw new Error('File service not available');
        }

        const conflicts: string[] = [];

        // Generate file path
        const filePath = await this.generateFilePath(input);

        // Check for conflicts
        const conflictInfo = await this.checkForConflicts(filePath);
        if (conflictInfo) {
            conflicts.push(conflictInfo);
            // Handle conflict (rename, overwrite, etc.)
            // For now, we'll use a timestamped filename
            const timestamp = Date.now();
            const pathParts = filePath.split('/');
            const filename = pathParts.pop() ?? 'note.md';
            const nameWithoutExt = filename.replace('.md', '');
            const newFilename = `${nameWithoutExt}-${timestamp}.md`;
            pathParts.push(newFilename);
            filePath = pathParts.join('/');
        }

        // Format content with YAML frontmatter
        const formattedContent = this.formatContent(input);

        // Write file
        try {
            await this.fileService.saveToFile(
                input.videoData.title,
                formattedContent,
                input.outputPath ?? 'YouTube/Processed Videos'
            );
        } catch (error) {
            throw new Error(`Failed to save file: ${(error as Error).message}`);
        }

        // Calculate file size (approximate)
        const fileSize = formattedContent.length;

        // Update cache
        let cacheUpdated = false;
        if (this.cacheService) {
            try {
                await this.updateCache(input);
                cacheUpdated = true;
            } catch (error) {
                logger.warn('Failed to update cache:', 'PersistenceStage', { error });
            }
        }

        return {
            filePath,
            fileSize,
            cacheUpdated,
            conflicts,
        };
    }

    private async generateFilePath(input: PersistenceInput): Promise<string> {
        const outputPath = input.outputPath ?? 'YouTube/Processed Videos';
        const sanitizedTitle = this.sanitizeFilename(input.videoData.title);
        return `${outputPath}/${sanitizedTitle}.md`;
    }

    private sanitizeFilename(title: string): string {
    // Remove invalid characters
        return title
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 100);
    }

    private async checkForConflicts(_filePath: string): Promise<string | null> {
        // This would check if file already exists
        // For now, return null (no conflict detection)
        return null;
    }

    private formatContent(input: PersistenceInput): string {
        const { videoData, url, generatedContent, provider, model } = input;

        // Create YAML frontmatter
        const frontmatter = {
            title: videoData.title,
            tags: this.generateTags(videoData),
            youtube_url: url,
            video_id: this.extractVideoId(url),
            ...(provider ? { ai_provider: provider } : {}),
            ...(model ? { ai_model: model } : {}),
            date: new Date().toISOString(),
        };

        const yaml = this.toYaml(frontmatter);
        const content = generatedContent || 'No content generated';

        return `---\n${yaml}\n---\n\n${content}`;
    }

    private generateTags(videoData: Record<string, unknown>): string[] {
        const tags = ['youtube', 'video'];

        if (videoData.tags && Array.isArray(videoData.tags)) {
            tags.push(...videoData.tags.slice(0, 5) as string[]);
        }

        if (videoData.category) {
            tags.push(String(videoData.category));
        }

        return [...new Set(tags)]; // Remove duplicates
    }

    private extractVideoId(url: string): string {
        const match = url.match(/(?:[?&]v=|youtu\.be\/|\/embed\/)([\w-]{11})/);
        return match ? match[1] : '';
    }

    private toYaml(obj: Record<string, unknown>): string {
        const lines: string[] = [];

        for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
                lines.push(`${key}:`);
                value.forEach(v => lines.push(`  - "${v}"`));
            } else if (typeof value === 'string') {
                lines.push(`${key}: "${value}"`);
            } else {
                lines.push(`${key}: ${value}`);
            }
        }

        return lines.join('\n');
    }

    private async updateCache(input: PersistenceInput): Promise<void> {
        if (!this.cacheService) return;

        // Cache the generated content
        const cacheKey = `processed:${this.extractVideoId(input.url)}`;
        this.cacheService.set(cacheKey, {
            content: input.generatedContent,
            timestamp: Date.now(),
            provider: input.provider,
            model: input.model,
        });
    }

    canExecute(context: PipelineContext): boolean {
        const input = context.input as PersistenceInput;
        return !!(input?.generatedContent && input?.videoData);
    }

    getTimeout(): number {
        return 10000; // 10 seconds
    }
}
