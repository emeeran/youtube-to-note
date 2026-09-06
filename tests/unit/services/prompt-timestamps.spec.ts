/**
 * Unit tests for the timestamp helpers in AIPromptService's module
 * (formatTimestamp / withTimestampParam / buildTimestampedSection) and for the
 * custom-prompt + frontmatter-escaping paths of createAnalysisPrompt /
 * processAIResponse.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
    AIPromptService,
    buildTimestampedSection,
    formatTimestamp,
    withTimestampParam,
} from '../../../src/services/prompt-service';
import { TranscriptSegment, VideoData } from '../../../src/types';

jest.mock('../../../src/services/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

const VIDEO_URL = 'https://www.youtube.com/watch?v=abc12345678';

const videoData: VideoData = {
    title: 'Test Video',
    description: 'A description',
    channelName: 'Channel',
};

const segments: TranscriptSegment[] = [
    { start: 0, duration: 3, text: 'Welcome back' },
    { start: 65, duration: 4, text: 'Today we build [a thing]' },
    { start: 3671, duration: 5, text: 'Final thoughts' },
];

describe('formatTimestamp', () => {
    it('formats minutes and seconds under one hour', () => {
        expect(formatTimestamp(0)).toBe('00:00');
        expect(formatTimestamp(5)).toBe('00:05');
        expect(formatTimestamp(65)).toBe('01:05');
    });

    it('switches to HH:MM:SS past one hour', () => {
        expect(formatTimestamp(3600)).toBe('1:00:00');
        expect(formatTimestamp(3671)).toBe('1:01:11');
    });

    it('collapses invalid input to 00:00', () => {
        expect(formatTimestamp(Number.NaN)).toBe('00:00');
        expect(formatTimestamp(-12)).toBe('00:00');
        expect(formatTimestamp(4.9)).toBe('00:04');
    });
});

describe('withTimestampParam', () => {
    it('appends &t= when the URL already has a query', () => {
        expect(withTimestampParam(VIDEO_URL, 65)).toBe(`${VIDEO_URL}&t=65`);
    });

    it('appends ?t= when the URL has no query', () => {
        expect(withTimestampParam('https://youtu.be/abc12345678', 65)).toBe('https://youtu.be/abc12345678?t=65');
    });
});

describe('buildTimestampedSection', () => {
    it('builds one clickable link per segment', () => {
        const section = buildTimestampedSection(VIDEO_URL, segments);
        expect(section).toContain('## Timestamped Transcript');
        expect(section).toContain(`- [00:00](${VIDEO_URL}&t=0) Welcome back`);
        expect(section).toContain(`- [01:05](${VIDEO_URL}&t=65)`);
        expect(section).toContain(`- [1:01:11](${VIDEO_URL}&t=3671) Final thoughts`);
    });

    it('escapes markdown link syntax inside caption text', () => {
        const section = buildTimestampedSection(VIDEO_URL, segments);
        expect(section).toContain('\\[a thing\\]');
        expect(section).not.toContain('[a thing]');
    });

    it('returns an empty string when there is nothing to render', () => {
        expect(buildTimestampedSection(VIDEO_URL, [])).toBe('');
    });
});

describe('AIPromptService timestamps and custom prompts', () => {
    const service = new AIPromptService();

    it('appends the timestamp instruction when segments are provided', () => {
        const prompt = service.createAnalysisPrompt({
            videoData,
            videoUrl: VIDEO_URL,
            format: 'quick-notes',
            transcript: 'Some content',
            segments,
        });
        expect(prompt).toContain('**TIMESTAMP LINKS**');
        expect(prompt).not.toContain('No timestamps.');
    });

    it('omits the timestamp instruction when segments are absent', () => {
        const prompt = service.createAnalysisPrompt({
            videoData,
            videoUrl: VIDEO_URL,
            format: 'quick-notes',
            transcript: 'Some content',
        });
        expect(prompt).not.toContain('**TIMESTAMP LINKS**');
        expect(prompt).toContain('No timestamps.');
    });

    it('keeps the no-timestamps constraint for complete-transcription, whose index is generated deterministically', () => {
        const prompt = service.createAnalysisPrompt({
            videoData,
            videoUrl: VIDEO_URL,
            format: 'complete-transcription',
            transcript: 'Some content',
            segments,
        });
        expect(prompt).not.toContain('**TIMESTAMP LINKS**');
        expect(prompt).toContain('No timestamps.');
    });

    it('uses a non-empty custom prompt instead of the built-in template', () => {
        const prompt = service.createAnalysisPrompt({
            videoData,
            videoUrl: VIDEO_URL,
            format: 'quick-notes',
            transcript: 'Some content',
            customPrompts: { 'quick-notes': 'Summarize in exactly three bullets for {{YOUTUBE_URL}}.' },
        });
        expect(prompt).toContain('Summarize in exactly three bullets');
        expect(prompt).toContain(`for ${VIDEO_URL}.`);
        expect(prompt).not.toContain('[SYSTEM]: Knowledge Distiller');
        // Metadata + transcript + shared rules still surround the custom body.
        expect(prompt).toContain('VIDEO CONTENT/TRANSCRIPT');
        expect(prompt).toContain('**OUTPUT FORMAT RULES:**');
    });

    it('falls back to the built-in template for a blank custom prompt', () => {
        const prompt = service.createAnalysisPrompt({
            videoData,
            videoUrl: VIDEO_URL,
            format: 'quick-notes',
            transcript: 'Some content',
            customPrompts: { 'quick-notes': '   ' },
        });
        expect(prompt).toContain('[SYSTEM]: Knowledge Distiller');
    });

    it('escapes provider/model values written into the frontmatter', () => {
        const note = service.processAIResponse(
            '---\nai_provider: "x"\nai_model: "y"\n---\n\nBody text',
            'Provider "with" quotes:\nand a newline',
            'model: [1]',
            'quick-notes',
            videoData,
            VIDEO_URL,
        );
        expect(note).toContain(`ai_provider: ${JSON.stringify('Provider "with" quotes:\nand a newline')}`);
        expect(note).toContain(`ai_model: ${JSON.stringify('model: [1]')}`);
    });

    it('flattens remote-controlled values in the Resources section', () => {
        const note = service.processAIResponse(
            'Body text',
            'Provider',
            'model',
            'quick-notes',
            videoData,
            'https://www.youtube.com/watch?v=abc12345678\nInjected line',
        );
        expect(note).toContain('- Video URL: https://www.youtube.com/watch?v=abc12345678 Injected line');
        expect(note).not.toContain('abc12345678\nInjected line');
    });

    it('inserts the deterministic timestamp index before the attribution block', () => {
        const note = service.processAIResponse(
            '---\nai_provider: "x"\n---\n\n## Structured Transcript\n\nTranscribed dialogue\n\n## Source\n\n> [!info] Attribution\n> **Video**: x',
            'Provider',
            'model',
            'complete-transcription',
            videoData,
            VIDEO_URL,
            segments,
        );
        const transcriptAt = note.indexOf('## Timestamped Transcript');
        const sourceAt = note.indexOf('## Source');
        expect(transcriptAt).toBeGreaterThan(-1);
        expect(transcriptAt).toBeLessThan(sourceAt);
        expect(note).toContain(`[01:05](${VIDEO_URL}&t=65)`);
        // Other formats keep the model's own output untouched.
        const quickNote = service.processAIResponse('Body', 'P', 'm', 'quick-notes', videoData, VIDEO_URL, segments);
        expect(quickNote).not.toContain('## Timestamped Transcript');
    });
});
