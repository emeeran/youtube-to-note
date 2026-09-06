/**
 * Frontmatter generation for Obsidian notes
 *
 * Generates YAML frontmatter enriched with video metadata,
 * aligned with the vault's wiki schema where applicable.
 */

import { OutputFormat, VideoData } from '../types';

/** YouTube embed configuration */
const YOUTUBE_EMBED = {
    BASE_URL: 'https://www.youtube-nocookie.com/embed/',
    IFRAME_WIDTH: 640,
    IFRAME_HEIGHT: 360,
    IFRAME_ATTRIBUTES: [
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
        'allowfullscreen',
        'frameborder="0"',
        'referrerpolicy="strict-origin-when-cross-origin"',
    ].join(' '),
} as const;

/**
 * Quote a value as a YAML double-quoted scalar.
 * Video metadata (title, channel, model names...) comes from the network, so it
 * must not be able to break out of the frontmatter or inject extra keys.
 * JSON string encoding is a safe YAML double-quoted scalar encoding.
 */
export const escapeYamlScalar = (value: string): string => JSON.stringify(String(value ?? ''));

/**
 * Escape a value for use inside a double-quoted HTML attribute.
 */
const escapeHtmlAttr = (value: string): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

/**
 * Generate YAML frontmatter for Obsidian notes
 * Includes enriched metadata: channel, duration, published date
 */
export const generateFrontmatter = (
    title: string,
    source: string,
    videoId: string,
    format: OutputFormat,
    provider: string,
    model: string,
    videoData?: VideoData,
): string => {
    const today = new Date().toISOString().split('T')[0];
    const isTranscript = format === 'complete-transcription';
    const isQuick = format === 'quick-notes';
    const tags = ['youtube'];
    if (isTranscript) tags.push('transcript');
    if (isQuick) tags.push('quick-note');

    const lines: string[] = ['---'];
    lines.push(`title: ${escapeYamlScalar(title)}`);
    lines.push(`source: ${escapeYamlScalar(source)}`);
    lines.push(`created: "${today}"`);
    lines.push(`type: ${isTranscript ? 'youtube-transcript' : isQuick ? 'youtube-quick-note' : 'youtube-note'}`);
    lines.push(`format: ${format}`);
    lines.push(`tags: [${tags.join(', ')}]`);
    lines.push(`video_id: ${escapeYamlScalar(videoId)}`);
    lines.push(`ai_provider: ${escapeYamlScalar(provider)}`);
    lines.push(`ai_model: ${escapeYamlScalar(model)}`);

    // Enriched metadata
    if (videoData?.channelName) {
        lines.push(`channel: ${escapeYamlScalar(videoData.channelName)}`);
    }
    if (videoData?.duration) {
        lines.push(`duration: ${videoData.duration}`);
    }
    if (videoData?.publishedAt) {
        lines.push(`published: ${escapeYamlScalar(videoData.publishedAt)}`);
    }

    lines.push('---');
    return lines.join('\n');
};

/**
 * Generate responsive video iframe embed
 */
export const generateVideoIframe = (videoId: string, title: string): string => {
    const embedUrl = `${YOUTUBE_EMBED.BASE_URL}${escapeHtmlAttr(videoId)}`;
    const { IFRAME_WIDTH, IFRAME_HEIGHT, IFRAME_ATTRIBUTES } = YOUTUBE_EMBED;
    const iframeOpenTag = [
        '<iframe',
        `width="${IFRAME_WIDTH}"`,
        `height="${IFRAME_HEIGHT}"`,
        `src="${embedUrl}"`,
        `title="${escapeHtmlAttr(title)}"`,
        IFRAME_ATTRIBUTES,
    ].join(' ');
    return `<div style="text-align: center; margin-bottom: 24px;">
${iframeOpenTag}></iframe>
</div>`;
};
