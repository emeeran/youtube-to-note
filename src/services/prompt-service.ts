import { PromptService, VideoData, OutputFormat, PerformanceMode, TranscriptSegment } from '../types';
import { ValidationUtils } from '../validation';
import { FORMAT_TEMPLATES, FORMAT_META } from '../templates/format-templates';
import { FORMAT_CONFIG, FormatConfig } from '../templates/format-config';
import { escapeYamlScalar, generateFrontmatter, generateVideoIframe } from '../templates';

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
    /**
     * Per-format prompt overrides. A non-empty entry replaces that format's
     * built-in template body (metadata + transcript + shared rules still apply).
     */
    customPrompts?: Partial<Record<OutputFormat, string>>;
    /**
     * Timed transcript segments. Their presence is the "timestamps enabled"
     * signal: callers omit them when `includeTimestamps` is off.
     */
    segments?: TranscriptSegment[];
    /**
     * Called when the prompt service trimmed the transcript to a format's
     * budget, so the caller can surface real truncation info (which budget,
     * how much was cut) instead of guessing.
     */
    onTruncated?: (info: { budget: number; originalLength: number }) => void;
}

// Re-export FormatConfig for backward compatibility
export type { FormatConfig };
export { FORMAT_CONFIG };

// ============ CONSTANTS ============

/** Token limits for different contexts */
const TOKEN_LIMITS = {
    /** Default transcript budget when a format doesn't define its own */
    MAX_TRANSCRIPT_LENGTH: 100_000,
} as const;

/** Placeholder tokens for template replacement */
const PLACEHOLDERS = {
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

// ============ TIMESTAMP HELPERS ============

/**
 * Format seconds as a clickable timestamp label: MM:SS, switching to HH:MM:SS
 * once the video passes one hour. Invalid input collapses to 00:00.
 */
export const formatTimestamp = (seconds: number): string => {
    const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const two = (n: number) => String(n).padStart(2, '0');
    return hours > 0 ? `${hours}:${two(minutes)}:${two(secs)}` : `${two(minutes)}:${two(secs)}`;
};

/**
 * Append a `t=<seconds>` deep link to a YouTube URL, coping with URLs that have
 * no query string yet (`youtu.be/<id>`).
 */
export const withTimestampParam = (videoUrl: string, seconds: number): string =>
    `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}t=${Math.max(0, Math.floor(seconds))}`;

/**
 * Strip line breaks and control characters from a value interpolated into a
 * markdown body line, so a hostile URL / provider string cannot break the note
 * out of its section or forge extra lines.
 */
const sanitizeInlineText = (value: string): string =>
    String(value ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Escape markdown link syntax in caption text so a transcript line cannot
 * forge a link or a heading inside the generated note.
 */
const escapeMarkdownText = (value: string): string =>
    sanitizeInlineText(value)
        .replace(/([[\]])/g, '\\$1')
        .replace(/^(\s*)(#{1,6}\s)/, '$1\\$2');

/**
 * Build the deterministic `## Timestamped Transcript` section from caption
 * segments. Used for the complete-transcription format, where the index must
 * be exact rather than model-reconstructed.
 */
export const buildTimestampedSection = (videoUrl: string, segments: TranscriptSegment[]): string => {
    const lines = segments
        .filter(segment => segment && typeof segment.start === 'number')
        .map(segment => {
            const start = Math.max(0, Math.floor(segment.start));
            return `- [${formatTimestamp(start)}](${withTimestampParam(videoUrl, start)}) ${escapeMarkdownText(
                segment.text,
            )}`;
        });

    if (lines.length === 0) return '';

    return `\n## Timestamped Transcript\n\n${lines.join('\n')}\n`;
};

// ============ SHARED PROMPT BLOCKS ============

/**
 * Rules shared by every format (and every custom prompt). Kept in ONE place —
 * they used to be duplicated across per-mode base templates AND every format
 * template's [CONSTRAINTS] line, drifting apart over time.
 */
const SHARED_OUTPUT_RULES = `**OUTPUT FORMAT RULES:**
- Output Obsidian-flavored Markdown only: no preambles ("Sure, here is…"), no sign-off, and never wrap the response in code fences.
- When a structure skeleton is given, follow it exactly: replace every [bracketed placeholder] with real content and delete leftover instruction lines.
- Ground every claim in the video content below. If the video doesn't cover what a section needs, write "Not covered in the video." — never invent facts, names, numbers, versions, or quotes.
- Do not number, label, or annotate transcript lines; numbered lists are for genuinely ordered content only.
- No YAML frontmatter, no video embed markup, and no "Source" section — the plugin adds those automatically.
- If the transcript ends with "[transcript truncated]", analyze only what is present; do not invent an ending.
- Write in the video's language (default: English).`;

/**
 * Per-mode guidance appended to the metadata block. The quality-mode line is
 * worded so `stripMultimodalInstructions` can remove it for text-only
 * providers — keep that coupling in mind when editing it.
 */
const MODE_HINTS: Readonly<Record<PerformanceMode, string>> = {
    fast: '*Mode: fast — prioritize the highest-value insights; keep the output tight.*',
    balanced: '',
    quality:
        'Process video multimodally (visual/audio) for complete understanding including on-screen text and non-verbal cues.',
} as const;

// ============ SERVICE ============

/**
 * Everything buildFullPrompt needs, packed as one object so the helper stays
 * under the max-params lint ceiling.
 */
interface FullPromptContext {
    dataSection: string;
    videoUrl: string;
    format: OutputFormat;
    providerName?: string;
    customPrompts?: Partial<Record<OutputFormat, string>>;
    segments?: TranscriptSegment[];
}

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

    /**
     * The "No timestamps." clause baked into every format template's
     * [CONSTRAINTS] line. Removed whenever timestamp links are enabled, since
     * it would otherwise contradict the timestamp instruction.
     */
    private static readonly TIMESTAMPS_DISABLED_PATTERN = /\s*No timestamps[^.]*\./g;

    /** Heading the deterministic timestamp section is inserted before. */
    private static readonly SOURCE_HEADING = '\n## Source';

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
            customPrompts,
            segments,
        } = options;

        // Build the data section (metadata + transcript + instructions)
        const dataSection = this.buildDataSection(
            videoData,
            videoUrl,
            transcript,
            performanceMode,
            format,
            userInstructions,
        );

        // Build full prompt with all components
        return this.buildFullPrompt({
            dataSection,
            videoUrl,
            format,
            providerName,
            customPrompts,
            segments,
        });
    }

    // ============ PRIVATE HELPER METHODS ============

    /**
     * Build the data section: metadata + transcript + user instructions.
     * Placed LAST in the prompt (role and output contract come first) so the
     * model's attention lands on the source material right before generation.
     */
    private buildDataSection(
        videoData: VideoData,
        videoUrl: string,
        transcript?: string,
        performanceMode: PerformanceMode = 'balanced',
        format: OutputFormat = 'executive-summary',
        userInstructions?: string,
    ): string {
        const transcriptSection = this.buildTranscriptSection(transcript, format);
        const chapterMarkers = this.extractChapterMarkers(videoData.description);
        const modeHint = MODE_HINTS[performanceMode] ? `\n${MODE_HINTS[performanceMode]}` : '';

        const userInstructionsBlock = userInstructions?.trim()
            ? `\n\n**USER INSTRUCTIONS** (prioritize these over defaults):\n${userInstructions.trim()}\n`
            : '';

        const lines = [
            '**VIDEO METADATA**',
            `- Title: ${videoData.title}`,
            `- Channel: ${videoData.channelName ?? 'Unknown'}`,
            `- Duration: ${this.formatDuration(videoData.duration)}`,
            `- Published: ${videoData.publishedAt ?? 'Unknown'}`,
            `- URL: ${videoUrl}`,
            `- Description: ${videoData.description || 'None'}`,
        ];
        if (chapterMarkers) {
            lines.push(chapterMarkers.trimEnd());
        }

        const dataSection = lines.join('\n');
        return `${dataSection}${modeHint}\n\n${transcriptSection.trimStart()}${userInstructionsBlock}`;
    }

    /**
     * Build transcript section with truncation for token efficiency
     * Uses per-format transcript budget when available
     */
    private buildTranscriptSection(transcript?: string, format?: OutputFormat): string {
        if (!transcript?.trim()) return '';

        const budget =
            format && FORMAT_CONFIG[format]?.transcriptBudget
                ? FORMAT_CONFIG[format].transcriptBudget!
                : TOKEN_LIMITS.MAX_TRANSCRIPT_LENGTH;

        const truncated =
            transcript.length > budget ? `${transcript.slice(0, budget)}... [transcript truncated]` : transcript;

        return `\nVIDEO CONTENT/TRANSCRIPT:\n${truncated}`;
    }

    /**
     * Build the complete prompt.
     *
     * Layout (role-first, data-last):
     *   1. format template  — role, output skeleton, format constraints
     *   2. timestamp links  — when enabled
     *   3. shared rules     — grounding, no preambles, no invented content
     *   4. data section     — metadata + transcript + user instructions
     *
     * Frontmatter / iframe / thumbnail / Source block are deliberately NOT in
     * the prompt: they contain nothing the model needs, and `processAIResponse`
     * assembles them deterministically after generation — so the model can't
     * mangle the frontmatter or waste tokens echoing placeholders.
     */
    private buildFullPrompt(context: FullPromptContext): string {
        const { dataSection, videoUrl, format, providerName, customPrompts, segments } = context;

        // Segments are only passed when settings.includeTimestamps is on. The
        // complete-transcription format is excluded: its timestamp index is
        // generated deterministically in processAIResponse, so the model is left
        // under its "No timestamps." constraint rather than invited to guess.
        const citeTimestamps = Boolean(segments?.length) && format !== 'complete-transcription';
        let template = this.resolveFormatTemplate(format, customPrompts);

        // Replace {{YOUTUBE_URL}} placeholder in format templates (built-in and custom alike)
        template = this.replacePlaceholders(template, { [PLACEHOLDERS.YOUTUBE_URL]: videoUrl });

        // Timestamp links contradict the templates' "No timestamps." constraint,
        // so drop that clause whenever the feature is on.
        if (citeTimestamps) {
            template = template.replace(AIPromptService.TIMESTAMPS_DISABLED_PATTERN, '');
            template = template.replace(/\s+$/, '');
        }

        const parts: string[] = [template];

        // Centralized timestamp-link instruction (see settings.includeTimestamps)
        if (citeTimestamps) {
            parts.push(this.buildTimestampInstruction(videoUrl));
        }

        parts.push(SHARED_OUTPUT_RULES);
        parts.push(dataSection);

        let prompt = parts.join('\n\n');

        // Strip multimodal instructions for text-only providers — applied to the
        // whole prompt so mode hints strip cleanly too.
        if (providerName && !this.isMultimodalProvider(providerName)) {
            prompt = this.stripMultimodalInstructions(prompt);
        }

        return prompt;
    }

    /**
     * Pick the prompt body for a format: the user's custom prompt when present,
     * otherwise the built-in template. Metadata, transcript and the shared
     * formatting rules live in `baseContent`, so a custom prompt keeps the
     * output parseable by `processAIResponse`.
     */
    private resolveFormatTemplate(format: OutputFormat, customPrompts?: Partial<Record<OutputFormat, string>>): string {
        const custom = customPrompts?.[format]?.trim();
        if (custom) return custom;
        return this.buildFormatTemplate(format);
    }

    /**
     * Instruction appended to the prompt whenever timestamp links are enabled.
     * Centralized here so every format cites moments the same way.
     */
    private buildTimestampInstruction(videoUrl: string): string {
        // Short URLs (`youtu.be/<id>`) have no query string to append to.
        const joiner = videoUrl.includes('?') ? '&' : '?';
        return [
            '',
            '**TIMESTAMP LINKS** (required):',
            `- Cite key claims as clickable links in the form \`[MM:SS](${videoUrl}${joiner}t=SECONDS)\`.`,
            '- Use ONLY the segment start times supplied with the transcript — never invent or estimate one.',
            '- Label MM:SS, switching to HH:MM:SS once past one hour.',
            '- Add one wherever a reader would want to jump: each insight, quote, command or step.',
        ].join('\n');
    }

    /**
     * Build format-specific template
     */
    private buildFormatTemplate(format: OutputFormat): string {
        return FORMAT_TEMPLATES[format];
    }

    /**
     * Single-pass placeholder replacement using a map
     */
    private replacePlaceholders(template: string, replacements: Readonly<Record<string, string>>): string {
        let result = template;
        for (const [placeholder, value] of Object.entries(replacements)) {
            const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escaped, 'g'), value);
        }
        return result;
    }

    /**
     * Assemble the finished note from the raw AI response.
     *
     * The model is never trusted with structural elements: frontmatter, the
     * video embed, the thumbnail, and the Source attribution are all generated
     * HERE, deterministically, from known-good values — so a misbehaving model
     * cannot mangle YAML, drop the embed, or forge attribution.
     */
    processAIResponse(
        content: string,
        provider: string,
        model: string,
        format?: OutputFormat,
        videoData?: VideoData,
        videoUrl?: string,
        segments?: TranscriptSegment[],
    ): string {
        if (!content) return content;

        const providerValue = provider ?? DEFAULTS.PROVIDER;
        const modelValue = model ?? DEFAULTS.MODEL;

        // Replace any placeholder tokens (custom prompts may still reference them)
        let updatedContent = this.replacePlaceholders(content, {
            [PLACEHOLDERS.AI_PROVIDER]: providerValue,
            [PLACEHOLDERS.AI_MODEL]: modelValue,
        });

        // Deterministic note header: frontmatter + embed (+ thumbnail for
        // long-form formats). Skipped when the content already carries
        // frontmatter — then only the ai_* values below are corrected in place.
        if (format && videoData && videoUrl && !this.hasFrontMatter(updatedContent)) {
            const videoId = ValidationUtils.extractVideoId(videoUrl) ?? DEFAULTS.VIDEO_ID;
            const frontmatter = generateFrontmatter(
                videoData.title,
                videoUrl,
                videoId,
                format,
                providerValue,
                modelValue,
                videoData,
            );
            const iframe = generateVideoIframe(videoId, videoData.title);
            let header = `${frontmatter}\n\n${iframe}`;
            if ((format === 'article' || format === 'complete-transcription') && videoData.thumbnail) {
                header += `\n\n![Video Thumbnail](${videoData.thumbnail})`;
            }
            updatedContent = `${header}\n\n${updatedContent.trimStart()}`;
        }

        // Frontmatter safety net (also repairs custom-prompt outputs that made
        // their own frontmatter).
        updatedContent = this.ensureFrontMatterValue(updatedContent, 'ai_provider', providerValue);
        updatedContent = this.ensureFrontMatterValue(updatedContent, 'ai_model', modelValue);

        // Append Resources section ONLY if the format doesn't already have one
        if (videoUrl && format) {
            const config = FORMAT_CONFIG[format];
            if (!config?.hasBuiltInResources) {
                updatedContent = this.appendResourcesSection(updatedContent, videoUrl, providerValue, modelValue);
            }
        }

        // Deterministic Source attribution — appended before the timestamp
        // index so the index lands directly above it.
        if (videoUrl && !updatedContent.includes('\n## Source')) {
            updatedContent = this.appendSourceSection(updatedContent, videoUrl, providerValue, modelValue);
        }

        // Deterministic timestamp index for full transcriptions — built here, from
        // the real caption timings, rather than trusting the model to recall them.
        if (format === 'complete-transcription' && videoUrl && segments?.length) {
            updatedContent = this.insertTimestampedSection(updatedContent, videoUrl, segments);
        }

        // Validate format structure (remove duplicate iframes, check sections)
        if (format) {
            updatedContent = this.validateFormatStructure(updatedContent, format);
        }

        return updatedContent;
    }

    /**
     * True when content already opens with a YAML frontmatter block
     * (`---` … `---`), so the deterministic header must not be prepended.
     */
    private hasFrontMatter(content: string): boolean {
        return /^\s*---\s*\n[\s\S]*?\n---/.test(content);
    }

    /**
     * Append the canonical Source attribution block. Values are sanitized so a
     * hostile provider/model string cannot forge extra lines or sections.
     */
    private appendSourceSection(content: string, videoUrl: string, provider: string, model: string): string {
        const processingDate = new Date().toISOString().split('T')[0];
        const sourceSection =
            '\n\n## Source\n\n' +
            '> [!info] Attribution\n' +
            `> **Video**: ${sanitizeInlineText(videoUrl)}\n` +
            `> **Generated by**: ${sanitizeInlineText(`${provider} / ${model}`)}\n` +
            `> **Generated on**: ${processingDate}\n`;
        return content.trimEnd() + sourceSection;
    }

    /**
     * Insert the deterministic timestamped transcript section just before the
     * attribution block, or append it when no `## Source` heading exists.
     */
    private insertTimestampedSection(content: string, videoUrl: string, segments: TranscriptSegment[]): string {
        const section = buildTimestampedSection(videoUrl, segments);
        if (!section) return content;

        const sourceAt = content.lastIndexOf(AIPromptService.SOURCE_HEADING);
        if (sourceAt <= 0) return `${content.trimEnd()}\n${section}`;

        return `${content.slice(0, sourceAt).trimEnd()}\n${section}${content.slice(sourceAt)}`;
    }

    /**
     * Append Resources section to the end of the content
     */
    private appendResourcesSection(content: string, videoUrl: string, provider: string, model: string): string {
        const processingDate = new Date().toISOString().split('T')[0];
        // URL / provider strings are remote-controlled: flatten them so they
        // cannot break out of the list or forge additional lines.
        const resourcesSection =
            '\n\n## Resources\n' +
            `- Video URL: ${sanitizeInlineText(videoUrl)}\n` +
            `- Processing Date: ${processingDate}\n` +
            `- Provider: ${sanitizeInlineText(`${provider} ${model}`)}\n`;

        const trimmedContent = content.trimEnd();
        return trimmedContent + resourcesSection;
    }

    /**
     * Ensure frontmatter key has the given value. Values are written as YAML
     * double-quoted scalars (JSON encoding) so a provider/model string coming
     * back from the network cannot break out of the frontmatter or inject keys.
     */
    private ensureFrontMatterValue(content: string, key: string, value: string): string {
        const safeValue = escapeYamlScalar(value);
        const pattern = new RegExp(`(${key}\\s*:\\s*)(["'])?([^"'\\n]*)(["'])?`, 'i');

        if (pattern.test(content)) {
            return content.replace(pattern, (_match, prefix) => `${prefix}${safeValue}`);
        }

        if (content.startsWith('---')) {
            return content.replace(/^---\s*\n/, `---\n${key}: ${safeValue}\n`);
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
            const formatted =
                hours > 0
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
            'openrouter', // GPT-4o, Claude 3.5, etc. via OpenRouter
            'ollama cloud', // Vision models via Ollama
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
        const iframePattern =
            /<iframe[^>]*src="https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]*"[^>]*><\/iframe>/g;
        const iframes = result.match(iframePattern);
        if (iframes && iframes.length > 1) {
            let firstFound = false;
            result = result.replace(
                /(<div[^>]*>)?\s*<iframe[^>]*src="https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]*"[^>]*><\/iframe>\s*(<\/div>)?/g,
                match => {
                    if (!firstFound) {
                        firstFound = true;
                        return match;
                    }
                    return '';
                },
            );
        }

        return result;
    }
}
