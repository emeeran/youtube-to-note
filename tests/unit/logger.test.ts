/**
 * Logger unit tests
 */

import { Logger, LogLevel, logger } from '../../src/services/logger';

describe('Logger', () => {
    let testLogger: Logger;

    beforeEach(() => {
        testLogger = Logger.getInstance({
            level: LogLevel.DEBUG,
            enableConsole: false,
            enableFile: false,
            maxLogEntries: 10
        });
        testLogger.clearLogs();
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const logger1 = Logger.getInstance();
            const logger2 = Logger.getInstance();
            expect(logger1).toBe(logger2);
        });

        it('should create new instance with config only once', () => {
            const logger1 = Logger.getInstance({ level: LogLevel.ERROR });
            const logger2 = Logger.getInstance({ level: LogLevel.DEBUG });
            expect(logger1).toBe(logger2);
            expect(logger1.getConfig().level).toBe(LogLevel.ERROR); // Keeps first config
        });
    });

    describe('log levels', () => {
        it('should respect log level hierarchy', () => {
            const loggerWithError = Logger.getInstance({ level: LogLevel.ERROR, enableConsole: false });

            loggerWithError.debug('debug message');
            loggerWithError.info('info message');
            loggerWithError.warn('warn message');
            loggerWithError.error('error message');

            const logs = loggerWithError.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].level).toBe(LogLevel.ERROR);
            expect(logs[0].message).toBe('error message');
        });

        it('should filter logs by level', () => {
            testLogger.debug('debug');
            testLogger.info('info');
            testLogger.warn('warn');
            testLogger.error('error');

            const errorLogs = testLogger.getLogs(LogLevel.ERROR);
            expect(errorLogs).toHaveLength(1);
            expect(errorLogs[0].message).toBe('error');

            const warnLogs = testLogger.getLogs(LogLevel.WARN);
            expect(warnLogs).toHaveLength(2);
            expect(warnLogs.map(l => l.message)).toEqual(['warn', 'error']);
        });

        it('should filter logs by context', () => {
            testLogger.info('message1', 'Context1');
            testLogger.info('message2', 'Context2');
            testLogger.info('message3', 'Context1');

            const context1Logs = testLogger.getLogs(undefined, 'Context1');
            expect(context1Logs).toHaveLength(2);
            expect(context1Logs.map(l => l.message)).toEqual(['message1', 'message3']);

            const context2Logs = testLogger.getLogs(undefined, 'Context2');
            expect(context2Logs).toHaveLength(1);
            expect(context2Logs[0].message).toBe('message2');
        });
    });

    describe('log entry structure', () => {
        it('should create log entries with correct structure', () => {
            const testData = { key: 'value' };
            testLogger.info('test message', 'test context', testData);

            const logs = testLogger.getLogs();
            expect(logs).toHaveLength(1);

            const log = logs[0];
            expect(log.timestamp).toBeInstanceOf(Date);
            expect(log.level).toBe(LogLevel.INFO);
            expect(log.message).toBe('test message');
            expect(log.context).toBe('test context');
            expect(log.data).toEqual(testData);
        });
    });

    describe('log entry limits', () => {
        it('should limit the number of log entries', () => {
            const loggerWithLimit = Logger.getInstance({ maxLogEntries: 3, enableConsole: false });
            loggerWithLimit.clearLogs();

            loggerWithLimit.info('message1');
            loggerWithLimit.info('message2');
            loggerWithLimit.info('message3');
            loggerWithLimit.info('message4');

            const logs = loggerWithLimit.getLogs();
            expect(logs).toHaveLength(3);
            expect(logs.map(l => l.message)).toEqual(['message2', 'message3', 'message4']);
        });
    });

    describe('configuration', () => {
        it('should update configuration', () => {
            expect(testLogger.getConfig().level).toBe(LogLevel.DEBUG);

            testLogger.updateConfig({ level: LogLevel.WARN });
            expect(testLogger.getConfig().level).toBe(LogLevel.WARN);

            testLogger.setLevel(LogLevel.ERROR);
            expect(testLogger.getConfig().level).toBe(LogLevel.ERROR);
        });

        it('should clone config object when getting', () => {
            const config1 = testLogger.getConfig();
            const config2 = testLogger.getConfig();
            expect(config1).not.toBe(config2); // Different objects
            expect(config1).toEqual(config2); // Same values
        });
    });

    describe('convenience methods', () => {
        it('should provide convenience methods for common contexts', () => {
            testLogger.plugin('plugin message', { data: 'test' });
            testLogger.aiService('ai message');
            testLogger.videoService('video message');
            testLogger.fileService('file message');
            testLogger.modal('modal message');
            testLogger.performance('performance message');

            const logs = testLogger.getLogs();
            expect(logs).toHaveLength(6);

            expect(logs[0].context).toBe('Plugin');
            expect(logs[0].message).toBe('plugin message');
            expect(logs[0].data).toEqual({ data: 'test' });

            expect(logs[1].context).toBe('AIService');
            expect(logs[2].context).toBe('VideoService');
            expect(logs[3].context).toBe('FileService');
            expect(logs[4].context).toBe('Modal');
            expect(logs[5].context).toBe('Performance');
        });
    });

    describe('clearing logs', () => {
        it('should clear all logs', () => {
            testLogger.info('message1');
            testLogger.info('message2');
            expect(testLogger.getLogs()).toHaveLength(2);

            testLogger.clearLogs();
            expect(testLogger.getLogs()).toHaveLength(0);
        });
    });
});

describe('Global logger instance', () => {
    it('should export a singleton logger instance', () => {
        expect(logger).toBeInstanceOf(Logger);
    });
});