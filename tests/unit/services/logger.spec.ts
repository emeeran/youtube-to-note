/**
 * Logger regression specs: a hostile log payload must never throw past
 * logging — the file-watcher intake used to die exactly this way when a live
 * `TFile` (circular via `parent.children`) hit JSON.stringify.
 *
 * Jest buffers console output and flushes the whole buffer through whichever
 * spy is active last, so every assertion scopes to its own test's unique
 * line instead of trusting spy call counts or ordering.
 */

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { Logger, LogLevel } from '../../../src/services/logger';

function formattedLines(spy: jest.Spied<typeof console.log>): string[] {
    return spy.mock.calls.map(call => String(call[0]));
}

describe('Logger payload serialization', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not throw when log data is circular', () => {
        const logger = Logger.getInstance();
        logger.updateConfig({ level: LogLevel.DEBUG });
        const file: Record<string, unknown> = { name: 'clip.md' };
        const parent: Record<string, unknown> = { name: 'folder', children: [file] };
        file['parent'] = parent;

        expect(() => logger.info('circular-payload line', 'UrlHandler', { file })).not.toThrow();
    });

    it('emits a placeholder instead of the unserializable payload', () => {
        const logger = Logger.getInstance();
        logger.updateConfig({ level: LogLevel.DEBUG, enableTimestamps: false });
        const data: Record<string, unknown> = {};
        data['self'] = data;

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        logger.info('placeholder-probe line', 'Ctx', data);

        const own = formattedLines(logSpy).find(line => line.includes('placeholder-probe line'));
        expect(own).toBeDefined();
        expect(own).toContain('<unserializable log data>');
    });

    it('still serializes plain payloads normally', () => {
        const logger = Logger.getInstance();
        logger.updateConfig({ level: LogLevel.DEBUG, enableTimestamps: false });
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

        logger.info('plain-probe line', 'Ctx', { filePath: 'a.md' });

        const own = formattedLines(logSpy).find(line => line.includes('plain-probe line'));
        expect(own).toBeDefined();
        expect(own).toContain('"filePath":"a.md"');
        expect(own).not.toContain('<unserializable log data>');
    });
});
