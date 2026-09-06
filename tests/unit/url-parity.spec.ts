/**
 * URL intake parity probe.
 *
 * `isValidYouTubeUrl` gates whether the plugin offers to process a URL at all
 * (ribbon, clipboard, protocol handler, file watcher), while `extractVideoId`
 * decides what is actually fetched. The two must never disagree — and the
 * accepted set must cover every URL shape YouTube itself hands out.
 *
 * This spec found one gap, now covered by a dedicated pattern: `youtube.com/live/<id>`
 * (live streams and premieres) was rejected even though YouTube serves it.
 */

import { describe, it, expect } from '@jest/globals';
import { ValidationUtils } from '../../src/validation';

const ID = 'dQw4w9WgXcQ';

/** URL shapes YouTube serves, mapped to the id intake must extract. */
const ACCEPTED_SHAPES: Array<[string, string]> = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', ID],
    ['http://www.youtube.com/watch?v=dQw4w9WgXcQ', ID],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/watch?app=desktop&si=abc&v=dQw4w9WgXcQ&t=42', ID],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', ID],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=30', ID],
    ['m.youtube.com/watch?v=dQw4w9WgXcQ', ID],
    ['https://youtu.be/dQw4w9WgXcQ', ID],
    ['youtu.be/dQw4w9WgXcQ', ID],
    ['https://youtu.be/dQw4w9WgXcQ?si=share-token', ID],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ?start=30', ID],
    ['https://www.youtube.com/v/dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share', ID],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', ID],
    // Live streams and premieres use the /live/<id> form.
    ['https://www.youtube.com/live/dQw4w9WgXcQ', ID],
    ['https://www.youtube.com/live/dQw4w9WgXcQ?feature=share', ID],
    ['youtube.com/live/dQw4w9WgXcQ', ID],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234', ID],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', ID],
];

/** Things that must never be mistaken for a video. */
const REJECTED = [
    '',
    'not-a-url',
    'https://www.vimeo.com/12345',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=',
    'https://www.youtube.com/watch?v=shortid',
    'https://www.youtube.com/watch?v=waytoolongvideoId',
    'https://www.youtube.com/playlist?list=PL1234567890abcdefg',
    'https://www.youtube.com/feed/library',
];

describe('URL intake parity', () => {
    it.each(ACCEPTED_SHAPES)('extracts %s', (url, expected) => {
        expect(ValidationUtils.extractVideoId(url)).toBe(expected);
        expect(ValidationUtils.isValidYouTubeUrl(url)).toBe(true);
    });

    it.each(REJECTED)('rejects %s', url => {
        expect(ValidationUtils.extractVideoId(url)).toBeNull();
        expect(ValidationUtils.isValidYouTubeUrl(url)).toBe(false);
    });

    it.each(ACCEPTED_SHAPES.map(([url]) => url))(
        'never disagrees: extractVideoId and isValidYouTubeUrl agree on %s',
        url => {
            const id = ValidationUtils.extractVideoId(url);
            expect(ValidationUtils.isValidYouTubeUrl(url)).toBe(id !== null);
            if (id !== null) {
                expect(id).toMatch(/^[a-zA-Z0-9_-]{11}$/);
            }
        },
    );

    it('is stable across repeat calls (memoized cache does not poison results)', () => {
        const [accepted] = ACCEPTED_SHAPES[0] as [string, string];
        for (let index = 0; index < 3; index++) {
            expect(ValidationUtils.extractVideoId(accepted)).toBe(ID);
            expect(ValidationUtils.isValidYouTubeUrl(REJECTED[4] as string)).toBe(false);
        }
    });

    it('cleans zero-width characters out of pasted URLs', () => {
        const pasted = `https://youtu.be/${ID}​`;
        expect(ValidationUtils.extractVideoId(pasted)).toBe(ID);
    });
});
