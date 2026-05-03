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
    lines.push(`title: ${title}`);
    lines.push(`source: ${source}`);
    lines.push(`created: "${today}"`);
    lines.push(`type: ${isTranscript ? 'youtube-transcript' : isQuick ? 'youtube-quick-note' : 'youtube-note'}`);
    lines.push(`format: ${format}`);
    lines.push(`tags: [${tags.join(', ')}]`);
    lines.push(`video_id: "${videoId}"`);
    lines.push(`ai_provider: "${provider}"`);
    lines.push(`ai_model: "${model}"`);

    // Enriched metadata
    if (videoData?.channelName) {
        lines.push(`channel: "${videoData.channelName}"`);
    }
    if (videoData?.duration) {
        lines.push(`duration: ${videoData.duration}`);
    }
    if (videoData?.publishedAt) {
        lines.push(`published: "${videoData.publishedAt}"`);
    }

    lines.push('---');
    return lines.join('\n');
};

/**
 * Generate responsive video iframe embed
 */
export const generateVideoIframe = (videoId: string, title: string): string => {
    const embedUrl = `${YOUTUBE_EMBED.BASE_URL}${videoId}`;
    return `<div style="text-align: center; margin-bottom: 24px;">
<iframe width="${YOUTUBE_EMBED.IFRAME_WIDTH}" height="${YOUTUBE_EMBED.IFRAME_HEIGHT}" src="${embedUrl}" title="${title}" ${YOUTUBE_EMBED.IFRAME_ATTRIBUTES}></iframe>
</div>`;
};
