/**
 * `processAIResponse` end-to-end for the three formats no other suite assembles:
 * `technical-analysis`, `3c-accelerated-learning` and `atom-notes`.
 *
 * What is pinned here is the deterministic half of note assembly — the part the
 * model is never trusted with:
 *   - the header (YAML frontmatter + embed) is prepended, with per-format type/tags
 *   - the Resources section follows `FORMAT_CONFIG[format].hasBuiltInResources`
 *   - a Resources/Source section the model already wrote is never duplicated
 *   - a custom-prompt body still gets the same deterministic header
 */

import { describe, it, expect } from '@jest/globals';

import { AIPromptService } from '../../../src/services/prompt-service';
import { FORMAT_CONFIG } from '../../../src/templates/format-config';
import type { OutputFormat, VideoData } from '../../../src/types';

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VIDEO_ID = 'dQw4w9WgXcQ';
const PROVIDER = 'Groq';
const MODEL = 'llama-3.3-70b-versatile';

const VIDEO_DATA: VideoData = {
    title: 'Test Video Title',
    description: 'A test video',
    channelName: 'Test Channel',
    duration: 600,
    publishedAt: '2024-01-01',
};

/** Model output in the shape each format's template asks for. */
const SAMPLE_OUTPUT: Record<OutputFormat, string> = {
    'technical-analysis': [
        '## Technical Overview',
        '',
        '> [!summary] Core Technical Insight',
        '> A single-process plugin is enough here.',
        '',
        'The pipeline is service-oriented and never throws at its caller.',
    ].join('\n'),
    '3c-accelerated-learning': [
        '## COMPRESS — The Vital 20%',
        '',
        '**Central Thesis**: Space repetition beats rereading.',
        '',
        '## CONNECT — Build Understanding',
        '',
        '**How They Connect**: Retrieval strengthens the memory trace.',
        '',
        '## COMPOUND — Build Systems',
        '',
        '- Review on day 1, 3 and 7.',
    ].join('\n'),
    'atom-notes': [
        '## Atomic Ideas',
        '',
        '> [!note] Atom 1: Spaced repetition',
        '> **Definition**: Reviewing at increasing intervals beats cramming.',
    ].join('\n'),
    'executive-summary': '## Executive Summary\n\nBody text',
    article: '## Executive Summary\n\nBody text',
    'complete-transcription': '## Overview\n\nBody text',
    'quick-notes': '## TL;DR\n\nBody text',
};

/** Frontmatter of an assembled note, as a plain key/value map. */
function parseFrontmatter(note: string): Record<string, string> {
    const lines = note.split('\n');
    expect(lines[0]).toBe('---');
    const end = lines.indexOf('---', 1);
    expect(end).toBeGreaterThan(0);

    const parsed: Record<string, string> = {};
    for (const line of lines.slice(1, end)) {
        const match = /^([A-Za-z_][A-Za-z0-9_]*): (.*)$/.exec(line);
        expect(match).not.toBeNull();
        const [, key, rawValue] = match!;
        let value = rawValue ?? '';
        if (value.startsWith('"')) value = JSON.parse(value) as string;
        else if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
        parsed[key!] = value;
    }
    return parsed;
}

/** Count `## heading` occurrences, case-insensitively. */
function countHeadings(note: string, heading: string): number {
    return note.match(new RegExp(`^##\\s*${heading}\\b`, 'gim'))?.length ?? 0;
}

describe('processAIResponse — resource semantics per format', () => {
    const service = new AIPromptService();

    it('declares which formats own a Resources section', () => {
        // The three formats under test sit on both sides of this flag, which is
        // what the specs below pin.
        expect(FORMAT_CONFIG['technical-analysis'].hasBuiltInResources).toBe(true);
        expect(FORMAT_CONFIG['3c-accelerated-learning'].hasBuiltInResources).toBe(false);
        expect(FORMAT_CONFIG['atom-notes'].hasBuiltInResources).toBe(false);
    });
});

describe('processAIResponse — technical-analysis', () => {
    const service = new AIPromptService();
    const format: OutputFormat = 'technical-analysis';

    function process(content: string): string {
        return service.processAIResponse(content, PROVIDER, MODEL, format, VIDEO_DATA, VIDEO_URL);
    }

    it('prepends the deterministic header and closes with one Source block', () => {
        const note = process(SAMPLE_OUTPUT[format]);

        const frontmatter = parseFrontmatter(note);
        expect(frontmatter.title).toBe(VIDEO_DATA.title);
        expect(frontmatter.source).toBe(VIDEO_URL);
        expect(frontmatter.format).toBe(format);
        expect(frontmatter.type).toBe('youtube-note');
        expect(frontmatter.tags).toBe('youtube');
        expect(frontmatter.video_id).toBe(VIDEO_ID);
        expect(frontmatter.ai_provider).toBe(PROVIDER);
        expect(frontmatter.ai_model).toBe(MODEL);

        // The body follows the header, unchanged.
        expect(note).toContain('## Technical Overview');
        expect(note.indexOf('<iframe')).toBeGreaterThan(-1);
        expect(note.indexOf('<iframe')).toBeLessThan(note.indexOf('## Technical Overview'));

        expect(countHeadings(note, 'source')).toBe(1);
        expect(note).toContain('**Generated by**: Groq / llama-3.3-70b-versatile');
    });

    it('adds no Resources section: the built-in template owns it', () => {
        const note = process(SAMPLE_OUTPUT[format]);

        expect(countHeadings(note, 'resources')).toBe(0);
        // The canonical generated list is never injected for this format.
        expect(note).not.toContain('- Video URL:');
    });

    it('does not duplicate a Resources section the model emitted on its own', () => {
        const note = process(`${SAMPLE_OUTPUT[format]}\n\n## Resources\n\n- Docs: https://example.com`);

        expect(countHeadings(note, 'resources')).toBe(1);
        expect(note).toContain('- Docs: https://example.com');
    });
});

describe('processAIResponse — 3c-accelerated-learning', () => {
    const service = new AIPromptService();
    const format: OutputFormat = '3c-accelerated-learning';

    function process(content: string): string {
        return service.processAIResponse(content, PROVIDER, MODEL, format, VIDEO_DATA, VIDEO_URL);
    }

    it('prepends the header, then appends Resources before a single Source block', () => {
        const note = process(SAMPLE_OUTPUT[format]);

        const frontmatter = parseFrontmatter(note);
        expect(frontmatter.format).toBe(format);
        expect(frontmatter.type).toBe('youtube-note');
        expect(note).toContain('## COMPRESS — The Vital 20%');

        // hasBuiltInResources is false, so the canonical Resources list is added.
        expect(countHeadings(note, 'resources')).toBe(1);
        expect(note).toContain('## Resources\n- Video URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(note).toContain('- Processing Date:');

        // Both generated blocks appear exactly once, Resources first.
        expect(countHeadings(note, 'source')).toBe(1);
        expect(note.indexOf('## Resources')).toBeGreaterThan(-1);
        expect(note.indexOf('## Resources')).toBeLessThan(note.indexOf('## Source'));
    });

    it('keeps the model-attributed provider in the generated sections', () => {
        const note = process(SAMPLE_OUTPUT[format]);

        expect(note).toContain('- Provider: Groq llama-3.3-70b-versatile');
        expect(note).toContain('> **Generated by**: Groq / llama-3.3-70b-versatile');
    });

    it('does not duplicate a Resources section the model already wrote', () => {
        const note = process(`${SAMPLE_OUTPUT[format]}\n\n## resources\n\n- Existing link`);

        expect(countHeadings(note, 'resources')).toBe(1);
        expect(note).toContain('- Existing link');
        expect(note).not.toContain('- Video URL:');
    });

    it('does not duplicate a Source section the model already wrote', () => {
        const note = process(`${SAMPLE_OUTPUT[format]}\n\n## Source\n\n> [!info] My own attribution`);

        expect(countHeadings(note, 'source')).toBe(1);
        expect(note).toContain('My own attribution');
        expect(note).not.toContain('**Generated by**');
    });
});

describe('processAIResponse — atom-notes', () => {
    const service = new AIPromptService();
    const format: OutputFormat = 'atom-notes';

    function process(content: string): string {
        return service.processAIResponse(content, PROVIDER, MODEL, format, VIDEO_DATA, VIDEO_URL);
    }

    it('prepends the header and appends the Resources list it has no template for', () => {
        const note = process(SAMPLE_OUTPUT[format]);

        const frontmatter = parseFrontmatter(note);
        expect(frontmatter.format).toBe(format);
        expect(frontmatter.type).toBe('youtube-note');
        expect(note).toContain('## Atomic Ideas');

        expect(countHeadings(note, 'resources')).toBe(1);
        expect(note).toContain('- Video URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(countHeadings(note, 'source')).toBe(1);
    });

    it('leaves a model-written Resources heading alone, whatever its casing', () => {
        const note = process(`${SAMPLE_OUTPUT[format]}\n\n## RESOURCES\n\n- Existing link`);

        expect(countHeadings(note, 'resources')).toBe(1);
        expect(note).toContain('- Existing link');
        expect(note).not.toContain('- Processing Date:');
    });
});

describe('processAIResponse — custom prompt overrides', () => {
    const service = new AIPromptService();
    const format: OutputFormat = 'atom-notes';

    /** What a custom prompt's body turns into once the model answers it. */
    function processCustomOutput(content: string): string {
        return service.processAIResponse(content, PROVIDER, MODEL, format, VIDEO_DATA, VIDEO_URL);
    }

    it('still builds the deterministic header for a custom-prompt body', () => {
        const note = processCustomOutput('Just answer the user question, no sections.');

        const frontmatter = parseFrontmatter(note);
        expect(frontmatter.format).toBe(format);
        expect(frontmatter.video_id).toBe(VIDEO_ID);
        expect(note).toContain('<iframe');
        expect(countHeadings(note, 'resources')).toBe(1);
        expect(countHeadings(note, 'source')).toBe(1);
    });

    it('substitutes provider/model placeholders a custom prompt still references', () => {
        // The tokens the prompt layer actually substitutes (`__AI_PROVIDER__`,
        // not `{{AI_PROVIDER}}`) — a custom prompt can rely on them.
        const note = processCustomOutput('Processed by __AI_PROVIDER__ with __AI_MODEL__.');

        expect(note).toContain('Processed by Groq with llama-3.3-70b-versatile.');
        expect(note).not.toContain('__AI_PROVIDER__');
    });

    it('repairs the ai_* keys of frontmatter a custom prompt emitted, adding no second header', () => {
        const custom = [
            '---',
            'title: "My own note"',
            '---',
            '',
            'Body only.',
            '',
            '## Source',
            '',
            '> my attribution',
        ].join('\n');
        const note = processCustomOutput(custom);

        // No second frontmatter block, no embed, no duplicated Source.
        expect(note.match(/^---$/gm)).toHaveLength(2);
        expect(note).not.toContain('<iframe');
        expect(countHeadings(note, 'source')).toBe(1);
        expect(note).toContain('title: "My own note"');
        // The safety net wrote the real attribution into the existing block.
        expect(note.indexOf('ai_provider: "Groq"')).toBeGreaterThan(-1);
        expect(note.indexOf('ai_provider: "Groq"')).toBeLessThan(note.indexOf('Body only.'));
    });
});
