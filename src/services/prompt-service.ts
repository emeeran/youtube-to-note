import { PromptService, VideoData, OutputFormat, PerformanceMode } from '../types';
import { ValidationUtils } from '../validation';
import { FORMAT_TEMPLATES, FORMAT_META } from '../templates/format-templates';
import { FORMAT_CONFIG, FormatConfig } from '../templates/format-config';
import { generateFrontmatter, generateVideoIframe } from '../templates';

/**
 * Optimized prompt generation service for AI processing
 *
 * Imports templates and config from dedicated modules for maintainability.
 * To customize output formats, edit src/templates/format-templates.ts.
 * To adjust token/temperature settings, edit src/templates/format-config.ts.
 */

// ============ TYPES ============

/**
 * Options for creating an analysis prompt
 */
interface AnalysisPromptOptions {
    /** Video metadata including title and description */
    videoData: VideoData;
    /** Full YouTube video URL */
    videoUrl: string;
    /** Output format for the analysis */
    format?: OutputFormat;
    /** Optional transcript text for analysis */
    transcript?: string;
    /** Performance mode affecting prompt detail level */
    performanceMode?: PerformanceMode;
    /** AI provider name for conditional instructions */
    providerName?: string;
    /** Custom user instructions injected into prompt */
    userInstructions?: string;
}

// Re-export FormatConfig for backward compatibility
export type { FormatConfig };
export { FORMAT_CONFIG };

// ============ CONSTANTS ============

/** Token limits for different contexts */
const TOKEN_LIMITS = {
    /** Maximum transcript length before truncation */
    MAX_TRANSCRIPT_LENGTH: 100_000,
    /** Maximum prompt length for validation */
    MAX_PROMPT_LENGTH: 50_000,
    /** Minimum prompt length for validation */
    MIN_PROMPT_LENGTH: 10,
} as const;

/** Placeholder tokens for template replacement */
const PLACEHOLDERS = {
    TITLE: '{{TITLE}}',
    URL: '{{URL}}',
    DESCRIPTION: '{{DESCRIPTION}}',
    TRANSCRIPT_SECTION: '{{TRANSCRIPT_SECTION}}',
    USER_INSTRUCTIONS: '{{USER_INSTRUCTIONS}}',
    CHANNEL_NAME: '{{CHANNEL_NAME}}',
    DURATION: '{{DURATION}}',
    PUBLISHED_DATE: '{{PUBLISHED_DATE}}',
    THUMBNAIL_URL: '{{THUMBNAIL_URL}}',
    CHAPTER_MARKERS: '{{CHAPTER_MARKERS}}',
    YOUTUBE_URL: '{{YOUTUBE_URL}}',
    AI_PROVIDER: '__AI_PROVIDER__',
    AI_MODEL: '__AI_MODEL__',
} as const;

/** Default values for unknown entities */
const DEFAULTS = {
    VIDEO_ID: 'unknown',
    PROVIDER: 'unknown',
    MODEL: 'unknown',
} as const;

// ============ BASE TEMPLATES ============

/**
 * Performance mode templates
 * These define the base prompt structure for each performance mode
 */
const BASE_TEMPLATES: Readonly<Record<PerformanceMode, string>> = {
    fast: `Analyze this YouTube video efficiently:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

**OUTPUT FORMAT RULES:**
- DO NOT add line numbers to any part of the output
- Use markdown headers (##, ###) for structure, not numbered lines
- Numbered lists are for content only (steps, items), not for line references

Focus on key insights. Process video with \`use_audio_video_tokens=True\` for comprehensive analysis.`,

    balanced: `Analyze this YouTube video:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

**OUTPUT FORMAT RULES:**
- DO NOT add line numbers to any part of the output
- Use markdown headers (##, ###) for structure, not numbered lines
- Numbered lists are for content only (steps, items), not for line references

Extract practical insights. Process video multimodally (visual/audio) for complete analysis.`,

    quality: `Analyze this YouTube video comprehensively:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

**OUTPUT FORMAT RULES:**
- DO NOT add line numbers to any part of the output
- Use markdown headers (##, ###) for structure, not numbered lines
- Numbered lists are for content only (steps, items), not for line references
- Process multimodally (visual/audio) for complete understanding including on-screen text and non-verbal cues`,
} as const;

// ============ SERVICE ============

/**
 * AI Prompt Service
 *
 * @remarks
 * Optimized prompt generation with:
 * - Single-pass template replacement using placeholder maps
 * - Pre-compiled regex patterns for performance
 * - Readonly template constants for better optimization
 */
export class AIPromptService implements PromptService {

    // ============ PRIVATE MEMBERS ============

    /** Cached compiled regex pattern for frontmatter key replacement */
    private static readonly FRONTMATTER_KEY_PATTERN = /(\w+)\s*:\s*(["'])?([^"'\n]*)(["'])?/gi;

    /** Pattern for AI provider/model placeholders */
    private static readonly PLACEHOLDER_PATTERN = /__(AI_PROVIDER|AI_MODEL)__/g;

    // ============ PUBLIC METHODS ============

    /**
     * Create an analysis prompt with performance optimization
     */
    createAnalysisPrompt(options: AnalysisPromptOptions): string {
        const {
            videoData,
            videoUrl,
            format = 'executive-summary',
            transcript,
            performanceMode = 'balanced',
            providerName,
            userInstructions,
        } = options;

        const videoId = ValidationUtils.extractVideoId(videoUrl) ?? DEFAULTS.VIDEO_ID;
        const provider = PLACEHOLDERS.AI_PROVIDER;
        const model = PLACEHOLDERS.AI_MODEL;

        // Build base content using single-pass replacement
        const baseContent = this.buildBaseContent(
            videoData,
            videoUrl,
            transcript,
            performanceMode,
            format,
            userInstructions,
        );

        // Build full prompt with all components
        return this.buildFullPrompt(
            baseContent,
            videoData,
            videoUrl,
            videoId,
            format,
            provider,
            model,
            undefined,
            providerName,
        );
    }

    // ============ PRIVATE HELPER METHODS ============

    /**
     * Build base content from video data and transcript
     * Uses single-pass template replacement for better performance
     */
    private buildBaseContent(
        videoData: VideoData,
        videoUrl: string,
        transcript?: string,
        performanceMode: PerformanceMode = 'balanced',
        format: OutputFormat = 'executive-summary',
        userInstructions?: string,
    ): string {
        const baseTemplate = BASE_TEMPLATES[performanceMode];
        const transcriptSection = this.buildTranscriptSection(transcript, format);

        // Build chapter markers from description
        const chapterMarkers = this.extractChapterMarkers(videoData.description);

        // Build user instructions block
        const userInstructionsBlock = userInstructions?.trim()
            ? `\n\n**USER INSTRUCTIONS** (prioritize these over defaults):\n${userInstructions.trim()}\n`
            : '';

        // Single-pass replacement using placeholder map
        return this.replacePlaceholders(baseTemplate, {
            [PLACEHOLDERS.TITLE]: videoData.title,
            [PLACEHOLDERS.URL]: videoUrl,
            [PLACEHOLDERS.DESCRIPTION]: videoData.description,
            [PLACEHOLDERS.TRANSCRIPT_SECTION]: transcriptSection,
            [PLACEHOLDERS.USER_INSTRUCTIONS]: userInstructionsBlock,
            [PLACEHOLDERS.CHANNEL_NAME]: videoData.channelName ?? 'Unknown',
            [PLACEHOLDERS.DURATION]: this.formatDuration(videoData.duration),
            [PLACEHOLDERS.PUBLISHED_DATE]: videoData.publishedAt ?? 'Unknown',
            [PLACEHOLDERS.THUMBNAIL_URL]: videoData.thumbnail ?? '',
            [PLACEHOLDERS.CHAPTER_MARKERS]: chapterMarkers,
        });
    }

    /**
     * Build transcript section with truncation for token efficiency
     * Uses per-format transcript budget when available
     */
    private buildTranscriptSection(transcript?: string, format?: OutputFormat): string {
        if (!transcript?.trim()) return '';

        const budget = format && FORMAT_CONFIG[format]?.transcriptBudget
            ? FORMAT_CONFIG[format].transcriptBudget!
            : TOKEN_LIMITS.MAX_TRANSCRIPT_LENGTH;

        const truncated = transcript.length > budget
            ? `${transcript.slice(0, budget)}... [transcript truncated]`
            : transcript;

        return `\nVIDEO CONTENT/TRANSCRIPT:\n${truncated}`;
    }

    /**
     * Build complete prompt with frontmatter, video iframe, and format template
     */
    private buildFullPrompt(
        baseContent: string,
        videoData: VideoData,
        videoUrl: string,
        videoId: string,
        format: OutputFormat,
        provider: string,
        model: string,
        customPrompt?: string,
        providerName?: string,
    ): string {
        // Enriched frontmatter with video metadata
        const frontmatter = generateFrontmatter(
            videoData.title,
            videoUrl,
            videoId,
            format,
            provider,
            model,
            videoData,
        );

        const iframe = generateVideoIframe(videoId, videoData.title);

        // Add thumbnail image for article/complete-transcription
        let thumbnailBlock = '';
        if ((format === 'article' || format === 'complete-transcription') && videoData.thumbnail) {
            thumbnailBlock = `\n\n![Video Thumbnail](${videoData.thumbnail})`;
        }

        const separator = '---\n\n';
        let formatTemplate = this.buildFormatTemplate(format, customPrompt);

        // Replace {{YOUTUBE_URL}} placeholder in format templates
        formatTemplate = formatTemplate.replace(/\{\{YOUTUBE_URL\}\}/g, videoUrl);

        // Strip multimodal instructions for text-only providers
        if (providerName && !this.isMultimodalProvider(providerName)) {
            formatTemplate = this.stripMultimodalInstructions(formatTemplate);
        }

        return `${frontmatter}\n\n${iframe}${thumbnailBlock}\n\n${separator}${baseContent}\n\n${formatTemplate}`;
    }

    /**
     * Build format-specific template
     */
    private buildFormatTemplate(format: OutputFormat, customPrompt?: string): string {
        return FORMAT_TEMPLATES[format];
    }

    /**
     * Single-pass placeholder replacement using a map
     */
    private replacePlaceholders(
        template: string,
        replacements: Readonly<Record<string, string>>
    ): string {
        let result = template;
        for (const [placeholder, value] of Object.entries(replacements)) {
            const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escaped, 'g'), value);
        }
        return result;
    }

    /**
     * Process AI response and inject actual provider/model information
     */
    processAIResponse(
        content: string,
        provider: string,
        model: string,
        format?: OutputFormat,
        videoData?: VideoData,
        videoUrl?: string,
    ): string {
        if (!content) return content;

        const providerValue = provider ?? DEFAULTS.PROVIDER;
        const modelValue = model ?? DEFAULTS.MODEL;

        // Replace all placeholder tokens using a single pass
        let updatedContent = this.replacePlaceholders(content, {
            [PLACEHOLDERS.AI_PROVIDER]: providerValue,
            [PLACEHOLDERS.AI_MODEL]: modelValue,
        });

        // Ensure frontmatter has correct values (fallback for malformed responses)
        updatedContent = this.ensureFrontMatterValue(
            updatedContent,
            'ai_provider',
            providerValue
        );
        updatedContent = this.ensureFrontMatterValue(
            updatedContent,
            'ai_model',
            modelValue
        );

        // Append Resources section ONLY if the format doesn't already have one
        if (videoUrl && format) {
            const config = FORMAT_CONFIG[format];
            if (!config?.hasBuiltInResources) {
                updatedContent = this.appendResourcesSection(
                    updatedContent,
                    videoUrl,
                    providerValue,
                    modelValue
                );
            }
        }

        // Validate format structure (remove duplicate iframes, check sections)
        if (format) {
            updatedContent = this.validateFormatStructure(updatedContent, format);
        }

        return updatedContent;
    }

    /**
     * Append Resources section to the end of the content
     */
    private appendResourcesSection(
        content: string,
        videoUrl: string,
        provider: string,
        model: string
    ): string {
        const processingDate = new Date().toISOString().split('T')[0];
        const resourcesSection = `\n\n## Resources\n- Video URL: ${videoUrl}\n- Processing Date: ${processingDate}\n- Provider: ${provider} ${model}\n`;

        const trimmedContent = content.trimEnd();
        return trimmedContent + resourcesSection;
    }

    /**
     * Ensure frontmatter key has correct value
     */
    private ensureFrontMatterValue(
        content: string,
        key: string,
        value: string
    ): string {
        const pattern = new RegExp(`(${key}\\s*:\\s*)(["'])?([^"'\\n]*)(["'])?`, 'i');

        if (pattern.test(content)) {
            return content.replace(pattern, (_, prefix, openQuote, _existing, closeQuote) => {
                const quote = (openQuote ?? closeQuote) ? '"' : '';
                return `${prefix}${quote}${value}${quote}`;
            });
        }

        if (content.startsWith('---')) {
            return content.replace(/^---\s*\n/, `---\n${key}: "${value}"\n`);
        }

        return content;
    }

    /**
     * Get format-specific configuration
     */
    getFormatConfig(format: OutputFormat): FormatConfig {
        return FORMAT_CONFIG[format];
    }

    /**
     * Get format metadata (label and description)
     */
    getFormatMeta(format: OutputFormat): { label: string; description: string } {
        return FORMAT_META[format];
    }

    /**
     * Format duration in seconds to human-readable string (e.g., "1:23:45")
     */
    private formatDuration(seconds?: number): string {
        if (!seconds) return 'Unknown';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    /**
     * Extract chapter markers from video description
     */
    extractChapterMarkers(description?: string): string {
        if (!description) return '';
        const chapterPattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/gm;
        const chapters: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = chapterPattern.exec(description)) !== null) {
            const hours = match[1] ? parseInt(match[1]) : 0;
            const minutes = parseInt(match[2]!);
            const seconds = parseInt(match[3]!);
            const title = (match[4] ?? '').trim();
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            const formatted = hours > 0
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                : `${minutes}:${String(seconds).padStart(2, '0')}`;
            chapters.push(`- **${formatted}** ${title}`);
        }

        if (chapters.length === 0) return '';

        return `\n**Chapters:**\n${chapters.join('\n')}\n`;
    }

    /**
     * Strip multimodal instructions from template for text-only providers
     */
    stripMultimodalInstructions(template: string): string {
        const multimodalPatterns = [
            /- ANALYZE VISUALS:.*$/gm,
            /- NOTE ENVIRONMENTAL AUDIO:.*$/gm,
            /- NOTE AUDIO:.*$/gm,
            /Process video multimodally.*$/gm,
            /Process video with `use_audio_video_tokens=True`.*$/gm,
            /Watch and listen to the video.*$/gm,
            /visual\/audio\).*$/gm,
            /multimodally \(visual\/audio\).*$/gm,
        ];

        let result = template;
        for (const pattern of multimodalPatterns) {
            result = result.replace(pattern, '');
        }
        result = result.replace(/\n{3,}/g, '\n\n');
        return result;
    }

    /**
     * Check if a provider supports multimodal (vision) input
     * Recognizes all known multimodal-capable providers
     */
    private isMultimodalProvider(providerName: string): boolean {
        const lower = providerName.toLowerCase();
        const multimodalProviders = [
            'google gemini',
            'gemini',
            'openrouter',        // GPT-4o, Claude 3.5, etc. via OpenRouter
            'ollama cloud',      // Vision models via Ollama
        ];
        return multimodalProviders.some(p => lower === p || lower.includes(p));
    }

    /**
     * Validate format structure of AI output
     * Checks for expected ## headers, removes duplicate iframes
     */
    validateFormatStructure(content: string, format?: OutputFormat): string {
        if (!content || !format) return content;

        const config = FORMAT_CONFIG[format];
        if (!config?.expectedSections) return content;

        // Remove duplicate iframes (keep only the first)
        let result = content;
        const iframePattern = /<iframe[^>]*src="https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]*"[^>]*><\/iframe>/g;
        const iframes = result.match(iframePattern);
        if (iframes && iframes.length > 1) {
            let firstFound = false;
            result = result.replace(/(<div[^>]*>)?\s*<iframe[^>]*src="https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]*"[^>]*><\/iframe>\s*(<\/div>)?/g, (match) => {
                if (!firstFound) {
                    firstFound = true;
                    return match;
                }
                return '';
            });
        }

        return result;
    }

    /**
     * Validate prompt length and content
     */
    validatePrompt(prompt: string): boolean {
        return Boolean(prompt) &&
               typeof prompt === 'string' &&
               prompt.trim().length >= TOKEN_LIMITS.MIN_PROMPT_LENGTH &&
               prompt.length <= TOKEN_LIMITS.MAX_PROMPT_LENGTH;
    }
}
