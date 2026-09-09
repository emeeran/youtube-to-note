/**
 * Logger service for structured logging with different levels
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4,
}

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: string;
    data?: Record<string, unknown>;
}

export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableTimestamps: boolean;
}

export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;

    private constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableTimestamps: true,
            ...config,
        };
    }

    public static getInstance(config?: Partial<LoggerConfig>): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.config.level;
    }

    private formatMessage(entry: LogEntry): string {
        const levelStr = LogLevel[entry.level].padEnd(5);
        const timestamp = this.config.enableTimestamps ? `[${entry.timestamp.toISOString()}] ` : '';
        const context = entry.context ? ` [${entry.context}]` : '';
        const data = entry.data ? ` ${this.stringifyLogData(entry.data)}` : '';

        return `${timestamp}${levelStr}${context} ${entry.message}${data}`;
    }

    /**
     * JSON for the log line. A hostile payload (e.g. a live `TFile`, circular
     * via `parent.children`) must never throw past logging — callers log
     * inside error handlers where a throw would abort the very operation
     * being reported.
     */
    private stringifyLogData(data: Record<string, unknown>): string {
        try {
            return JSON.stringify(data);
        } catch {
            return '<unserializable log data>';
        }
    }

    private log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            context,
            data,
        };

        if (this.config.enableConsole) {
            const formattedMessage = this.formatMessage(entry);

            switch (level) {
                case LogLevel.DEBUG:
                    console.debug(formattedMessage);
                    break;
                case LogLevel.INFO:
                    console.log(formattedMessage);
                    break;
                case LogLevel.WARN:
                    console.warn(formattedMessage);
                    break;
                case LogLevel.ERROR:
                    console.error(formattedMessage);
                    break;
            }
        }
    }

    public debug(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.DEBUG, message, context, data);
    }

    public info(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.INFO, message, context, data);
    }

    public warn(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.WARN, message, context, data);
    }

    public error(message: string, context?: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.ERROR, message, context, data);
    }

    public setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    public getConfig(): LoggerConfig {
        return { ...this.config };
    }

    public updateConfig(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // Convenience methods for common contexts
    public plugin(message: string, data?: Record<string, unknown>): void {
        this.info(message, 'Plugin', data);
    }

    public aiService(message: string, data?: Record<string, unknown>): void {
        this.info(message, 'AIService', data);
    }
}

export const logger = Logger.getInstance();
