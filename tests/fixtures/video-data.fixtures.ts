/**
 * Test fixtures for video data: URL lists used by intake specs.
 */

export const VALID_YOUTUBE_URLS = {
    STANDARD: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    SHORT: 'https://youtu.be/dQw4w9WgXcQ',
    EMBED: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    SHORTS: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    WITH_PARAMS: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    MOBILE: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
};

export const INVALID_YOUTUBE_URLS = {
    MALFORMED: 'https://www.youtube.com/watch',
    MISSING_ID: 'https://www.youtube.com/watch?v=',
    WRONG_DOMAIN: 'https://www.vimeo.com/12345',
    NOT_URL: 'not-a-url',
    EMPTY: '',
};
