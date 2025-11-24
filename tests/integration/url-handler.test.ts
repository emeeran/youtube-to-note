/**
 * URL Handler integration tests
 */

import { UrlHandler } from '../../src/services/url-handler';
import { YouTubePluginSettings } from '../../src/types/types';
import { TFile } from 'obsidian';

// Mock Obsidian App
const mockApp = {
    vault: {
        read: jest.fn(),
        getAbstractFileByPath: jest.fn()
    },
    workspace: {
        getActiveFile: jest.fn()
    }
} as any;

// Mock TFile
const createMockFile = (path: string, name: string, content: string, ctime: number = Date.now()): TFile => ({
    path,
    name,
    stat: { ctime, mtime: ctime, size: content.length },
    extension: 'md'
} as any);

describe('UrlHandler Integration', () => {
    let urlHandler: UrlHandler;
    let mockOnUrlDetected: jest.Mock;
    let mockSettings: YouTubePluginSettings;

    beforeEach(() => {
        mockOnUrlDetected = jest.fn();
        mockSettings = {
            geminiApiKey: '',
            groqApiKey: '',
            outputPath: 'YouTube/Processed Videos',
            useEnvironmentVariables: false,
            environmentPrefix: 'YTC',
            performanceMode: 'balanced',
            enableParallelProcessing: true,
            preferMultimodal: true
        };

        urlHandler = new UrlHandler(mockApp, mockSettings, mockOnUrlDetected);
        jest.clearAllMocks();
    });

    describe('temp file detection', () => {
        it('should detect file with note marker as temp file', async () => {
            const content = '<!-- ytc-extension:youtube-clipper -->\nhttps://youtube.com/watch?v=test123';
            const file = createMockFile('test.md', 'test.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://youtube.com/watch?v=test123',
                source: 'create',
                filePath: 'test.md',
                file,
                content
            });
        });

        it('should detect file with YouTube Clip prefix as temp file', async () => {
            const content = 'https://youtube.com/watch?v=test456';
            const file = createMockFile('YouTube Clip - Test Video.md', 'YouTube Clip - Test Video.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://youtube.com/watch?v=test456',
                source: 'create',
                filePath: 'YouTube Clip - Test Video.md',
                file,
                content
            });
        });

        it('should detect new small file with only YouTube URL as temp file', async () => {
            const content = 'https://youtu.be/abc123';
            const file = createMockFile('temp.md', 'temp.md', content, Date.now() - 1000); // 1 second old

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://youtu.be/abc123',
                source: 'create',
                filePath: 'temp.md',
                file,
                content
            });
        });

        it('should not detect file in output path as temp file', async () => {
            const content = 'https://youtube.com/watch?v=test789';
            const file = createMockFile('YouTube/Processed Videos/processed.md', 'processed.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });

        it('should not detect old file as temp file', async () => {
            const content = 'https://youtube.com/watch?v=old123';
            const file = createMockFile('old.md', 'old.md', content, Date.now() - 10000); // 10 seconds old

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('URL extraction', () => {
        it('should extract YouTube URL from content', async () => {
            const content = '<!-- ytc-extension:youtube-clipper -->\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ';
            const file = createMockFile('test.md', 'test.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                source: 'create',
                filePath: 'test.md',
                file,
                content
            });
        });

        it('should extract youtu.be short URL', async () => {
            const content = 'https://youtu.be/dQw4w9WgXcQ';
            const file = createMockFile('YouTube Clip - Short.md', 'YouTube Clip - Short.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://youtu.be/dQw4w9WgXcQ',
                source: 'create',
                filePath: 'YouTube Clip - Short.md',
                file,
                content
            });
        });

        it('should not extract invalid URLs', async () => {
            const content = 'https://example.com/not-youtube';
            const file = createMockFile('invalid.md', 'invalid.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('active leaf change handling', () => {
        it('should handle active leaf change with temp file', async () => {
            const content = '<!-- ytc-extension:youtube-clipper -->\nhttps://youtube.com/watch?v=active123';
            const file = createMockFile('active.md', 'active.md', content);

            mockApp.workspace.getActiveFile.mockReturnValue(file);
            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleActiveLeafChange();

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://youtube.com/watch?v=active123',
                source: 'active-leaf',
                filePath: 'active.md',
                file,
                content
            });
        });

        it('should not process already handled files', async () => {
            const content = '<!-- ytc-extension:youtube-clipper -->\nhttps://youtube.com/watch?v=handled123';
            const file = createMockFile('handled.md', 'handled.md', content);

            mockApp.workspace.getActiveFile.mockReturnValue(file);
            mockApp.vault.read.mockResolvedValue(content);

            // Process once
            await urlHandler.handleActiveLeafChange();
            expect(mockOnUrlDetected).toHaveBeenCalledTimes(1);

            // Try to process again
            await urlHandler.handleActiveLeafChange();
            expect(mockOnUrlDetected).toHaveBeenCalledTimes(1); // Still only called once
        });
    });

    describe('protocol handling', () => {
        it('should handle protocol parameters with URL', () => {
            const params = { url: 'https://youtube.com/watch?v=protocol123' };

            urlHandler.handleProtocol(params);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://youtube.com/watch?v=protocol123',
                source: 'protocol'
            });
        });

        it('should handle protocol parameters with content', () => {
            const params = { content: 'https://youtu.be/protocol456' };

            urlHandler.handleProtocol(params);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://youtu.be/protocol456',
                source: 'protocol'
            });
        });

        it('should handle protocol parameters with path', () => {
            const params = { path: 'https://www.youtube.com/watch?v=protocol789' };

            urlHandler.handleProtocol(params);

            expect(mockOnUrlDetected).toHaveBeenCalledWith({
                url: 'https://www.youtube.com/watch?v=protocol789',
                source: 'protocol'
            });
        });

        it('should ignore invalid protocol URLs', () => {
            const params = { url: 'https://example.com/invalid' };

            urlHandler.handleProtocol(params);

            expect(mockOnUrlDetected).not.toHaveBeenCalled();
        });
    });

    describe('deduplication and debouncing', () => {
        it('should debounce rapid URL detections', async () => {
            const content = '<!-- ytc-extension:youtube-clipper -->\nhttps://youtube.com/watch?v=debounce123';
            const file = createMockFile('debounce.md', 'debounce.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            // Trigger multiple file create events rapidly
            await urlHandler.handleFileCreate(file);
            await urlHandler.handleFileCreate(file);
            await urlHandler.handleFileCreate(file);

            // Should only be called once due to debouncing
            expect(mockOnUrlDetected).toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanup', () => {
        it('should clear all state', async () => {
            const content = '<!-- ytc-extension:youtube-clipper -->\nhttps://youtube.com/watch?v=cleanup123';
            const file = createMockFile('cleanup.md', 'cleanup.md', content);

            mockApp.vault.read.mockResolvedValue(content);

            await urlHandler.handleFileCreate(file);
            expect(mockOnUrlDetected).toHaveBeenCalled();

            urlHandler.clear();

            // Should be able to process the same URL again
            mockApp.vault.read.mockResolvedValue(content);
            await urlHandler.handleFileCreate(file);

            expect(mockOnUrlDetected).toHaveBeenCalledTimes(2);
        });
    });

    describe('settings update', () => {
        it('should update settings', () => {
            const newSettings = { ...mockSettings, outputPath: 'New/Path' };

            urlHandler.updateSettings(newSettings);

            // Settings are used internally, so we can't easily test this without accessing private state
            // But we can verify no errors are thrown
            expect(() => urlHandler.updateSettings(newSettings)).not.toThrow();
        });
    });
});