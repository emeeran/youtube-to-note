/**
 * Test fixtures for video data
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

export const MOCK_VIDEO_DATA = {
    SHORT_VIDEO: {
        videoId: 'short-video-id',
        url: 'https://www.youtube.com/watch?v=short-video-id',
        title: 'Short Test Video',
        author: 'Test Channel',
        description: 'A short test video',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 120, // 2 minutes
        publishedAt: '2024-01-01T00:00:00Z',
        transcript: 'This is a short transcript for testing.',
    },
    LONG_VIDEO: {
        videoId: 'long-video-id',
        url: 'https://www.youtube.com/watch?v=long-video-id',
        title: 'Long Test Video',
        author: 'Test Channel',
        description: 'A long test video for extensive testing',
        thumbnail: 'https://example.com/thumb-long.jpg',
        duration: 3600, // 1 hour
        publishedAt: '2024-01-01T00:00:00Z',
        transcript: 'A'.repeat(10000), // Long transcript
    },
    NO_TRANSCRIPT: {
        videoId: 'no-transcript-id',
        url: 'https://www.youtube.com/watch?v=no-transcript-id',
        title: 'Video Without Transcript',
        author: 'Test Channel',
        description: 'A video without available transcript',
        thumbnail: 'https://example.com/thumb-no.jpg',
        duration: 600,
        publishedAt: '2024-01-01T00:00:00Z',
        transcript: '',
    },
};

export const MOCK_API_RESPONSES = {
    GEMINI_SUCCESS: {
        candidates: [{
            content: {
                parts: [{
                    text: 'Generated summary content from Gemini',
                }],
            },
        }],
        usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 200,
            totalTokenCount: 300,
        },
    },
    GROQ_SUCCESS: {
        choices: [{
            message: {
                content: 'Generated summary content from Groq',
            },
        }],
        usage: {
            prompt_tokens: 100,
            completion_tokens: 200,
            total_tokens: 300,
        },
    },
    OLLAMA_SUCCESS: {
        response: 'Generated summary content from Ollama',
        prompt_eval_count: 100,
        eval_count: 200,
    },
    ERROR_RATE_LIMIT: {
        error: {
            message: 'Rate limit exceeded',
            code: 'rate_limit_exceeded',
        },
    },
    ERROR_INVALID_KEY: {
        error: {
            message: 'Invalid API key',
            code: 'invalid_api_key',
        },
    },
};

export const MOCK_TRANSCRIPTS = {
    ENGLISH: `This is the first sentence of the transcript.
This is the second sentence with more content.
The third sentence provides additional details.
Finally, the fourth sentence concludes the transcript.`,
    CODE_TUTORIAL: `In this tutorial, we'll learn about functions.
Here's an example function:
function example() { return true; }
Now let's break down how this works.
The function returns a boolean value.`,
    INTERVIEW: `Interviewer: Welcome to the show.
Guest: Thank you for having me.
Interviewer: Let's start with your background.
Guest: I've been working in this field for 10 years.
Interviewer: That's impressive. Tell us more.`,
    EDUCATIONAL: `Welcome to today's lesson on mathematics.
First, let's review basic concepts.
Then we'll move to advanced topics.
Finally, we'll practice with examples.`,
};
