/**
 * Unit tests for the proxy-free YouTube page parser and transcript helpers.
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
    parsePlayerResponse,
    extractCaptionTracks,
    selectCaptionTrack,
    extractVideoDetails,
    decodeEntities,
} from '../../../src/services/youtube-page';

jest.mock('../../../src/services/logger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('youtube-page', () => {
    describe('parsePlayerResponse', () => {
        it('extracts the embedded player response object', () => {
            const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify({ videoDetails: { title: 'Hi' } })};</script>`;
            const pr = parsePlayerResponse(html);
            expect(pr?.videoDetails?.title).toBe('Hi');
        });

        it('brace-balances correctly when strings contain braces and quotes', () => {
            const obj = { d: 'has } and { and "quotes" inside', n: 1 };
            const html = `junk ytInitialPlayerResponse = ${JSON.stringify(obj)};more("}")`;
            const pr = parsePlayerResponse(html);
            expect(pr).toEqual(obj);
        });

        it('returns null when the marker is absent', () => {
            expect(parsePlayerResponse('<html>no marker here</html>')).toBeNull();
        });

        it('returns null for malformed JSON', () => {
            const html = `ytInitialPlayerResponse = {not valid json};`;
            expect(parsePlayerResponse(html)).toBeNull();
        });
    });

    describe('extractCaptionTracks', () => {
        it('maps caption tracks flattening name and kind', () => {
            const pr = {
                captions: {
                    playerCaptionsTracklistRenderer: {
                        captionTracks: [
                            { baseUrl: 'https://x/1', languageCode: 'en', kind: 'asr' },
                            { baseUrl: 'https://x/2', languageCode: 'es', name: { simpleText: 'Spanish' } },
                        ],
                    },
                },
            };
            expect(extractCaptionTracks(pr)).toEqual([
                { baseUrl: 'https://x/1', languageCode: 'en', name: undefined, kind: 'asr' },
                { baseUrl: 'https://x/2', languageCode: 'es', name: 'Spanish', kind: undefined },
            ]);
        });

        it('returns [] when there are no caption tracks', () => {
            expect(extractCaptionTracks({})).toEqual([]);
            expect(extractCaptionTracks({ captions: {} })).toEqual([]);
        });
    });

    describe('selectCaptionTrack', () => {
        const enAsr = { baseUrl: 'a', languageCode: 'en', kind: 'asr' };
        const enManual = { baseUrl: 'b', languageCode: 'en' };
        const esManual = { baseUrl: 'c', languageCode: 'es' };

        it('prefers a manual track over asr within the requested language', () => {
            const tracks = [enAsr, { ...enManual }];
            expect(selectCaptionTrack(tracks, 'en')?.baseUrl).toBe('b');
        });

        it('honors an explicit non-English language preference', () => {
            expect(selectCaptionTrack([enAsr, esManual], 'es')?.baseUrl).toBe('c');
        });

        it('falls back to English when the requested language is unavailable', () => {
            expect(selectCaptionTrack([enAsr, esManual], 'fr')?.baseUrl).toBe('a');
        });

        it('returns undefined for an empty list', () => {
            expect(selectCaptionTrack([], 'en')).toBeUndefined();
        });

        it('defaults to English even when only an asr English track exists', () => {
            expect(selectCaptionTrack([esManual, enAsr])?.languageCode).toBe('en');
        });
    });

    describe('extractVideoDetails', () => {
        it('reads description, duration, title, channel, and publish date', () => {
            const pr = {
                videoDetails: {
                    shortDescription: 'desc &amp; more',
                    lengthSeconds: '123',
                    title: 'T',
                    author: 'Ch',
                },
                microformat: { playerMicroformatRenderer: { publishDate: '2024-01-02T00:00:00Z' } },
            };
            const details = extractVideoDetails(pr);
            expect(details).toEqual({
                description: 'desc & more',
                duration: 123,
                title: 'T',
                channelName: 'Ch',
                publishedAt: '2024-01-02',
            });
        });

        it('returns an empty object for missing details', () => {
            expect(extractVideoDetails({})).toEqual({});
        });
    });

    describe('decodeEntities', () => {
        it('decodes common HTML and unicode escape entities', () => {
            expect(decodeEntities('a&amp;b&lt;c&#39;d\\u2019e')).toBe("a&b<c'd’e");
        });
        it('returns empty for falsy input', () => {
            expect(decodeEntities('')).toBe('');
        });
    });
});
