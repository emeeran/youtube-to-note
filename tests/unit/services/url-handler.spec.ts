/**
 * Unit tests for URL Handler service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { UrlHandler, UrlHandlerConfig } from '../../../src/services/url-handler';
import { TFile } from 'obsidian';
import { YouTubePluginSettings } from '../../../src/types';
import { VALID_YOUTUBE_URLS, INVALID_YOUTUBE_URLS } from '@tests/fixtures';
import { flushPromises, delay } from '@tests/utils/test-helpers';

// Mock dependencies
jest.mock('../../../src/services/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

// Mock ValidationUtils
jest.mock('../../../src/validation', () => ({
    ValidationUtils: {
        isValidYouTubeUrl: jest.fn((url: string) => {
            return url.includes('youtube.com') || url.includes('youtu.be');
        }),
    },
}));

describe('UrlHandler', () => {
    let mockApp: {
        vault: { read: jest.Mock };
        workspace: { getActiveFile: jest.Mock };
    };
    let mockSettings: YouTubePluginSettings;
    let mockOnUrlDetected: jest.Mock;
    let urlHandler: UrlHandler;
    let config: UrlHandlerConfig;

    beforeEach(() => {
        // Mock App with vault and workspace
        mockApp = {
            vault: {
                read: jest.fn(),
            },
            workspace: {
                getActiveFile: jest.fn(),
            },
        };

        mockSettings = {
            outputPath: '/YouTube Notes',
        } as YouTubePluginSettings;

        mockOnUrlDetected = jest.fn();

        config = {
            noteMarker: '<!-- ytc-extension:youtube-clipper -->',
            urlHandlerDelay: 100, // Shorter for tests
            maxHandledFiles: 10,
            tempFileAgeThreshold: 5000,
        };

        urlHandler = new UrlHandler(
            mockApp,
            mockSettings,
            mockOnUrlDetected,
            config
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
        urlHandler.clear();
    });

    describe('Constructor', () => {
        it('should initialize with default config', () => {
            expect(urlHandler).toBeDefined();
        });

        it('should accept custom config', () => {
            const customConfig: UrlHandlerConfig = {
                noteMarker: 'custom-marker',
                urlHandlerDelay: 200,
                maxHandledFiles: 50,
                tempFileAgeThreshold: 10000,
            };

            const handler = new UrlHandler(
                mockApp,
                mockSettings,
                mockOnUrlDetected,
                customConfig
            );

            expect(handler).toBeDefined();
        });
    });

    describe('handleFileCreate', () => {
        it('should detect and handle temp file with marker', async () => {
            const mockFile = {
                path: '/test/YouTube Clip - video.md',
                name: 'YouTube Clip - video.md',
                stat: { ctime: Date.now() },
            } as TFile;

            const content = `<!-- ytc-extension:youtube-clipper -->\n${VALID_YOUTUBE_URLS.STANDARD}`;
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(mockFile);
            await flushPromises();

            // Should not call onUrlDetected immediately due to debounce
            expect(mockOnUrlDetected).not.toHaveBeenCalled();

            // Wait for debounce delay
            await delay(150);
            await flushPromises();

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: VALID_YOUTUBE_URLS.STANDARD,
                source: 'create',
                filePath: mockFile.path,
                file: mockFile,
                content,
            });
        });

        it('should detect temp file by name pattern', async () => {
            const mockFile = {
                path: '/test/YouTube Clip - dQw4w9WgXcQ.md',
                name: 'YouTube Clip - dQw4w9WgXcQ.md',
                stat: { ctime: Date.now() },
            } as TFile;

            const content = VALID_YOUTUBE_URLS.STANDARD;
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(mockFile);
            await delay(150);

            expect(mockOnUrlDetected).toHaveBeenCalled();
        });

        it('should ignore non-temp files', async () => {
            const mockFile = {
                path: '/test/My Notes.md',
                name: 'My Notes.md',
                stat: { ctime: Date.now() },
            } as TFile;

            // Add more content so it's not URL-only, and make it older
            const content = `${VALID_YOUTUBE_URLS.STANDARD}\n\n# My Notes\n\nSome additional content here.`;
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(mockFile);
            await delay(150);

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should handle file read errors gracefully', async () => {
            const mockFile = {
                path: '/test/error.md',
                name: 'error.md',
                stat: { ctime: Date.now() },
            } as TFile;

            mockApp.vault.read.mockRejectedValue(new Error('Read error'));

            await expect(urlHandler.handleFileCreate(mockFile)).resolves.not.toThrow();
            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should reject URLs from old files', async () => {
            const oldFile = {
                path: '/test/Old File.md',
                name: 'Old File.md',
                stat: { ctime: Date.now() - 10000 }, // Older than threshold
            } as TFile;

            const content = VALID_YOUTUBE_URLS.STANDARD;
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(oldFile);
            await delay(150);

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('handleActiveLeafChange', () => {
        it('should detect temp file when active leaf changes', async () => {
            const mockFile = {
                path: '/test/YouTube Clip - video.md',
                name: 'YouTube Clip - video.md',
                stat: { ctime: Date.now() },
                basename: 'YouTube Clip - video',
                extension: 'md',
            } as TFile;

            mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
            mockApp.vault.read.mockResolvedValue(
                `<!-- ytc-extension:youtube-clipper -->\n${VALID_YOUTUBE_URLS.STANDARD}`
            );

            await urlHandler.handleActiveLeafChange();
            await delay(150);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: VALID_YOUTUBE_URLS.STANDARD,
                source: 'active-leaf',
                filePath: mockFile.path,
                file: mockFile,
                content: expect.any(String),
            });
        });

        it('should ignore when no active file', async () => {
            mockApp.workspace.getActiveFile.mockReturnValue(null);

            await urlHandler.handleActiveLeafChange();

            expect(mockApp.vault.read).not.toHaveBeenCalled();
        });

        it('should skip already handled files', async () => {
            const mockFile = {
                path: '/test/YouTube Clip - video.md',
                name: 'YouTube Clip - video.md',
                stat: { ctime: Date.now() },
                basename: 'YouTube Clip - video',
                extension: 'md',
            } as TFile;

            mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
            mockApp.vault.read.mockResolvedValue(
                `<!-- ytc-extension:youtube-clipper -->\n${VALID_YOUTUBE_URLS.STANDARD}`
            );

            // First call
            await urlHandler.handleActiveLeafChange();
            await delay(150);

            // Second call - should skip
            await urlHandler.handleActiveLeafChange();
            await delay(150);

            expect(mockOnUrlDetected).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleProtocol', () => {
        it('should handle valid URL from protocol', () => {
            urlHandler.handleProtocol({ url: VALID_YOUTUBE_URLS.STANDARD });

            // Wait for deferred execution
            return delay(300).then(() => {
                expect(mockOnUrlDetected).toHaveBeenCalledWith({
                    url: VALID_YOUTUBE_URLS.STANDARD,
                    source: 'protocol',
                });
            });
        });

        it('should handle URL from content param', () => {
            urlHandler.handleProtocol({ content: VALID_YOUTUBE_URLS.SHORT });

            return delay(300).then(() => {
                expect(mockOnUrlDetected).toHaveBeenCalledWith({
                    url: VALID_YOUTUBE_URLS.SHORT,
                    source: 'protocol',
                });
            });
        });

        it('should ignore invalid URL in protocol', () => {
            urlHandler.handleProtocol({ url: INVALID_YOUTUBE_URLS.NOT_URL });

            return delay(300).then(() => {
                expect(mockOnUrlDetected).not.toHaveBeenCalled();
            });
        });

        it('should handle missing params gracefully', () => {
            expect(() => {
                urlHandler.handleProtocol({});
            }).not.toThrow();
        });
    });

    describe('handleClipboardUrl', () => {
        beforeEach(() => {
            // Mock navigator.clipboard
            Object.assign(navigator, {
                clipboard: {
                    readText: jest.fn(),
                },
            });
        });

        it('should read and validate URL from clipboard', async () => {
            (navigator.clipboard.readText as jest.Mock).mockResolvedValue(VALID_YOUTUBE_URLS.STANDARD);

            await urlHandler.handleClipboardUrl();

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: VALID_YOUTUBE_URLS.STANDARD,
                source: 'clipboard',
            });
        });

        it('should ignore invalid URL in clipboard', async () => {
            (navigator.clipboard.readText as jest.Mock).mockResolvedValue(INVALID_YOUTUBE_URLS.NOT_URL);

            await urlHandler.handleClipboardUrl();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should handle clipboard read errors', async () => {
            (navigator.clipboard.readText as jest.Mock).mockRejectedValue(new Error('Clipboard denied'));

            await expect(urlHandler.handleClipboardUrl()).resolves.not.toThrow();
            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should handle empty clipboard', async () => {
            (navigator.clipboard.readText as jest.Mock).mockResolvedValue('');

            await urlHandler.handleClipboardUrl();

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('clear', () => {
        it('should clear all handled URLs and pending operations', async () => {
            const mockFile = {
                path: '/test/YouTube Clip - video.md',
                name: 'YouTube Clip - video.md',
                stat: { ctime: Date.now() },
            } as TFile;

            mockApp.vault.read.mockResolvedValue(
                `<!-- ytc-extension:youtube-clipper -->\n${VALID_YOUTUBE_URLS.STANDARD}`
            );

            await urlHandler.handleFileCreate(mockFile);

            // Clear before debounce completes
            urlHandler.clear();
            await delay(150);

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('updateSettings', () => {
        it('should update settings', () => {
            const newSettings = {
                ...mockSettings,
                outputPath: '/New Path',
            };

            urlHandler.updateSettings(newSettings);

            // Should not throw
            expect(urlHandler).toBeDefined();
        });
    });

    describe('Deduplication', () => {
        it('should not process the same URL twice', async () => {
            const mockFile1 = {
                path: '/test/YouTube Clip - video1.md',
                name: 'YouTube Clip - video1.md',
                stat: { ctime: Date.now() },
            } as TFile;

            const mockFile2 = {
                path: '/test/YouTube Clip - video2.md',
                name: 'YouTube Clip - video2.md',
                stat: { ctime: Date.now() },
            } as TFile;

            const content = `<!-- ytc-extension:youtube-clipper -->\n${VALID_YOUTUBE_URLS.STANDARD}`;
            mockApp.vault.read.mockResolvedValue(content);

            // First file
            await urlHandler.handleFileCreate(mockFile1);

            // Second file with same URL
            await urlHandler.handleFileCreate(mockFile2);

            await delay(150);

            // Should only call once due to deduplication
            expect(mockOnUrlDetected).toHaveBeenCalledTimes(1);
        });
    });

    describe('Debouncing', () => {
        it('should debounce rapid file create events', async () => {
            const mockFile = {
                path: '/test/YouTube Clip - video.md',
                name: 'YouTube Clip - video.md',
                stat: { ctime: Date.now() },
            } as TFile;

            mockApp.vault.read.mockResolvedValue(
                `<!-- ytc-extension:youtube-clipper -->\n${VALID_YOUTUBE_URLS.STANDARD}`
            );

            // Trigger multiple times rapidly
            await urlHandler.handleFileCreate(mockFile);
            await urlHandler.handleFileCreate(mockFile);
            await urlHandler.handleFileCreate(mockFile);

            await delay(150);

            // Should only call once
            expect(mockOnUrlDetected).toHaveBeenCalledTimes(1);
        });
    });
});
