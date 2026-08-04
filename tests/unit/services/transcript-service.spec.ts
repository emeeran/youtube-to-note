/**
 * Unit tests for YouTubeTranscriptService.
 * The youtube-page module is mocked at the boundary so we exercise caption
 * selection, error handling, and XML parsing in isolation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { YouTubeTranscriptService } from '../../../src/services/transcript-service';
import * as youtubePage from '../../../src/services/youtube-page';

jest.mock('../../../src/services/youtube-page', () => ({
    fetchPlayerResponse: jest.fn(),
    extractCaptionTracks: jest.fn(),
    selectCaptionTrack: jest.fn(),
    fetchCaptionContent: jest.fn(),
    // Identity keeps assertions predictable; real decoding is tested elsewhere.
    decodeEntities: (s: string) => s,
}));
jest.mock('../../../src/services/logger', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const fetchPlayerResponse = jest.mocked(youtubePage.fetchPlayerResponse);
const extractCaptionTracks = jest.mocked(youtubePage.extractCaptionTracks);
const selectCaptionTrack = jest.mocked(youtubePage.selectCaptionTrack);
const fetchCaptionContent = jest.mocked(youtubePage.fetchCaptionContent);

describe('YouTubeTranscriptService', () => {
    let service: YouTubeTranscriptService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new YouTubeTranscriptService();
        fetchPlayerResponse.mockResolvedValue({} as never);
        extractCaptionTracks.mockReturnValue([{ baseUrl: 'https://caption/en', languageCode: 'en' }] as never);
        selectCaptionTrack.mockReturnValue({
            baseUrl: 'https://caption/en',
            languageCode: 'en',
            kind: undefined,
        } as never);
    });

    it('returns a transcript parsed from caption XML', async () => {
        fetchCaptionContent.mockResolvedValue(
            '<transcript><text start="0.5" dur="1.5">hello world</text></transcript>',
        );
        const t = await service.getTranscript('dQw4w9WgXcQ');
        expect(t).not.toBeNull();
        expect(t?.fullText).toBe('hello world');
        expect(t?.language).toBe('en');
        expect(t?.segments[0]?.start).toBe(0.5);
        expect(t?.segments[0]?.duration).toBe(1.5);
    });

    it('also parses the srv3 <t s="" d=""> element shape', async () => {
        fetchCaptionContent.mockResolvedValue('<timedtext><body><t s="1.0" d="2.0">srv three</t></body></timedtext>');
        const t = await service.getTranscript('dQw4w9WgXcQ');
        expect(t?.fullText).toBe('srv three');
        expect(t?.segments[0]?.start).toBe(1.0);
        expect(t?.segments[0]?.duration).toBe(2.0);
    });

    it('returns null when there are no caption tracks', async () => {
        extractCaptionTracks.mockReturnValue([] as never);
        const t = await service.getTranscript('abcdefghijk');
        expect(t).toBeNull();
    });

    it('returns null when the player response cannot be parsed', async () => {
        fetchPlayerResponse.mockResolvedValue(null as never);
        const t = await service.getTranscript('abcdefghijk');
        expect(t).toBeNull();
    });

    it('returns null when the caption payload is empty', async () => {
        fetchCaptionContent.mockResolvedValue('<transcript></transcript>');
        const t = await service.getTranscript('abcdefghijk');
        expect(t).toBeNull();
    });

    it('returns null (instead of throwing) when fetching throws', async () => {
        fetchPlayerResponse.mockRejectedValue(new Error('network') as never);
        const t = await service.getTranscript('abcdefghijk');
        expect(t).toBeNull();
    });

    it('throws on empty video id', async () => {
        await expect(service.getTranscript('')).rejects.toThrow('Video ID is required');
    });

    it('passes the preferred language to track selection', async () => {
        fetchCaptionContent.mockResolvedValue('<transcript><text start="0" dur="1">hola</text></transcript>');
        await service.getTranscript('abcdefghijk', 'es');
        expect(selectCaptionTrack.mock.calls[0]?.[1]).toBe('es');
    });
});
