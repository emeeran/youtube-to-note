
/**
 * Logger service for structured logging with different levels
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SILENT = 4
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
    enableFile: boolean;
    maxLogEntries: number;
    enableTimestamps: boolean;
}

export class Logger {
    private static instance: Logger;
    private logs: LogEntry[] = [];
    private config: LoggerConfig;

    private constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            maxLogEntries: 1000,
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

    /**
     * Reset the singleton instance (for testing only)
     */
    public static resetInstance(): void {
        Logger.instance = undefined as unknown as Logger;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.config.level;
    }

    private formatMessage(entry: LogEntry): string {
        const levelStr = LogLevel[entry.level].padEnd(5);
        const timestamp = this.config.enableTimestamps
            ? `[${entry.timestamp.toISOString()}] `
            : '';
        const context = entry.context ? ` [${entry.context}]` : '';
        const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';

        return `${timestamp}${levelStr}${context} ${entry.message}${data}`;
    }

    private addLogEntry(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            context,
            data,
        };

        this.logs.push(entry);

        // Keep logs under max limit
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs = this.logs.slice(-this.config.maxLogEntries);
        }

        // Output to console if enabled
        if (this.config.enableConsole) {
            const formattedMessage = this.formatMessage(entry);

            switch (level) {
                case LogLevel.DEBUG:

                    break;
                case LogLevel.INFO:

                    break;
                case LogLevel.WARN:

                    break;
                case LogLevel.ERROR:

                    break;
            }
        }
    }

    public debug(message: string, context?: string, data?: Record<string, unknown>): void {
        this.addLogEntry(LogLevel.DEBUG, message, context, data);
    }

    public info(message: string, context?: string, data?: Record<string, unknown>): void {
        this.addLogEntry(LogLevel.INFO, message, context, data);
    }

    public warn(message: string, context?: string, data?: Record<string, unknown>): void {
        this.addLogEntry(LogLevel.WARN, message, context, data);
    }

    public error(message: string, context?: string, data?: Record<string, unknown>): void {
        this.addLogEntry(LogLevel.ERROR, message, context, data);
    }

    public getLogs(level?: LogLevel, context?: string): LogEntry[] {
        let filteredLogs = this.logs;

        if (level !== undefined) {
            filteredLogs = filteredLogs.filter(log => log.level === level);
        }

        if (context) {
            filteredLogs = filteredLogs.filter(log => log.context === context);
        }

        return filteredLogs;
    }

    public clearLogs(): void {
        this.logs = [];
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

    public videoService(message: string, data?: Record<string, unknown>): void {
        this.info(message, 'VideoService', data);
    }

    public fileService(message: string, data?: Record<string, unknown>): void {
        this.info(message, 'FileService', data);
    }

    public modal(message: string, data?: Record<string, unknown>): void {
        this.info(message, 'Modal', data);
    }

    public performance(message: string, data?: Record<string, unknown>): void {
        this.debug(message, 'Performance', data);
    }
}

// Export singleton instance for easy usage
export const logger = Logger.getInstance();