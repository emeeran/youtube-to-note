/**
 * Enhanced Logging System
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    context?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export class Logger {
    private static instance: Logger;
    private logLevel: LogLevel = LogLevel.INFO;
    private logs: LogEntry[] = [];
    private maxLogs: number = 1000;

    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    setMaxLogs(max: number): void {
        this.maxLogs = max;
        this.trimLogs();
    }

    debug(message: string, context?: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, context, metadata);
    }

    info(message: string, context?: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context, metadata);
    }

    warn(message: string, context?: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context, metadata);
    }

    error(message: string, context?: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, context, metadata);
    }

    private log(level: LogLevel, message: string, context?: string, metadata?: Record<string, any>): void {
        if (level < this.logLevel) return;

        const entry: LogEntry = {
            level,
            message,
            context,
            timestamp: new Date(),
            metadata,
        };

        this.logs.push(entry);
        this.trimLogs();

        // Console output
        const levelName = LogLevel[level];
        const prefix = context ? `[${context}]` : '';
        const messageStr = `${prefix} ${message}`;

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(`[DEBUG]${messageStr}`, metadata || '');
                break;
            case LogLevel.INFO:
                console.info(`[INFO]${messageStr}`, metadata || '');
                break;
            case LogLevel.WARN:
                console.warn(`[WARN]${messageStr}`, metadata || '');
                break;
            case LogLevel.ERROR:
                console.error(`[ERROR]${messageStr}`, metadata || '');
                break;
        }
    }

    private trimLogs(): void {
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }

    getLogs(level?: LogLevel): LogEntry[] {
        if (level !== undefined) {
            return this.logs.filter(log => log.level >= level);
        }
        return [...this.logs];
    }

    clearLogs(): void {
        this.logs = [];
    }
}

// Export singleton instance
export const logger = Logger.getInstance();
