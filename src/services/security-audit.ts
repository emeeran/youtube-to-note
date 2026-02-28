/**
 * Security audit logging service
 *
 * Tracks security-related events for monitoring and analysis:
 * - API key access attempts
 * - Failed decryption attempts
 * - Suspicious patterns
 * - Key rotation history
 */

import { logger } from './logger';

/** Security event types */
export type SecurityEventType =
    | 'key_access'
    | 'key_set'
    | 'key_clear'
    | 'decryption_success'
    | 'decryption_failure'
    | 'migration_success'
    | 'migration_failure'
    | 'suspicious_access'
    | 'rate_limit_exceeded';

/** Security event severity */
export type SecurityEventSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Security event record */
export interface SecurityEvent {
    type: SecurityEventType;
    timestamp: number;
    severity: SecurityEventSeverity;
    keyType?: string;
    provider?: string;
    message: string;
    metadata?: Record<string, unknown>;
}

/** Security audit configuration */
export interface SecurityAuditConfig {
    maxEvents: number;
    retentionMs: number;
    alertThresholds: {
        maxDecryptionFailures: number;
        maxSuspiciousAccess: number;
        windowMs: number;
    };
}

/** Default security audit configuration */
const DEFAULT_CONFIG: SecurityAuditConfig = {
    maxEvents: 1000,
    retentionMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    alertThresholds: {
        maxDecryptionFailures: 5,
        maxSuspiciousAccess: 3,
        windowMs: 60 * 60 * 1000, // 1 hour
    },
};

/**
 * Security audit service for tracking security events
 */
export class SecurityAuditService {
    private static instance: SecurityAuditService | null = null;
    private events: SecurityEvent[] = [];
    private config: SecurityAuditConfig;
    private storageKey = 'ytc_security_audit';

    private constructor(config: Partial<SecurityAuditConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.loadEvents();
    }

    /**
     * Get singleton instance
     */
    static getInstance(config?: Partial<SecurityAuditConfig>): SecurityAuditService {
        if (!SecurityAuditService.instance) {
            SecurityAuditService.instance = new SecurityAuditService(config);
        }
        return SecurityAuditService.instance;
    }

    /**
     * Log a security event
     */
    log(
        type: SecurityEventType,
        message: string,
        options?: {
            severity?: SecurityEventSeverity;
            keyType?: string;
            provider?: string;
            metadata?: Record<string, unknown>;
        },
    ): void {
        const event: SecurityEvent = {
            type,
            timestamp: Date.now(),
            severity: options?.severity ?? this.getDefaultSeverity(type),
            keyType: options?.keyType,
            provider: options?.provider,
            message,
            metadata: options?.metadata,
        };

        this.events.push(event);
        this.pruneEvents();
        this.saveEvents();
        this.checkAlertThresholds(event);
    }

    /**
     * Log API key access
     */
    logKeyAccess(keyType: string, success: boolean, provider?: string): void {
        this.log(
            success ? 'key_access' : 'decryption_failure',
            success ? `API key accessed: ${keyType}` : `Failed to access API key: ${keyType}`,
            {
                severity: success ? 'info' : 'warning',
                keyType,
                provider,
            },
        );
    }

    /**
     * Log key set operation
     */
    logKeySet(keyType: string, provider?: string): void {
        this.log('key_set', `API key set: ${keyType}`, {
            severity: 'info',
            keyType,
            provider,
        });
    }

    /**
     * Log key clear operation
     */
    logKeyClear(keyType: string): void {
        this.log('key_clear', `API key cleared: ${keyType}`, {
            severity: 'info',
            keyType,
        });
    }

    /**
     * Log decryption attempt
     */
    logDecryption(success: boolean, keyType?: string, error?: string): void {
        this.log(
            success ? 'decryption_success' : 'decryption_failure',
            success ? 'Key decryption successful' : `Key decryption failed: ${error ?? 'Unknown error'}`,
            {
                severity: success ? 'info' : 'warning',
                keyType,
                metadata: success ? undefined : { error },
            },
        );
    }

    /**
     * Log migration attempt
     */
    logMigration(success: boolean, keyType: string, fromVersion: number, toVersion: number): void {
        this.log(
            success ? 'migration_success' : 'migration_failure',
            success
                ? `Key migrated from v${fromVersion} to v${toVersion}`
                : `Key migration failed from v${fromVersion} to v${toVersion}`,
            {
                severity: success ? 'info' : 'error',
                keyType,
                metadata: { fromVersion, toVersion },
            },
        );
    }

    /**
     * Log suspicious activity
     */
    logSuspiciousActivity(description: string, metadata?: Record<string, unknown>): void {
        this.log('suspicious_access', description, {
            severity: 'warning',
            metadata,
        });
    }

    /**
     * Get recent events
     */
    getRecentEvents(count = 50): SecurityEvent[] {
        return this.events.slice(-count);
    }

    /**
     * Get events by type
     */
    getEventsByType(type: SecurityEventType): SecurityEvent[] {
        return this.events.filter(e => e.type === type);
    }

    /**
     * Get events within time window
     */
    getEventsInWindow(windowMs: number): SecurityEvent[] {
        const cutoff = Date.now() - windowMs;
        return this.events.filter(e => e.timestamp >= cutoff);
    }

    /**
     * Get security summary
     */
    getSummary(): {
        totalEvents: number;
        decryptionFailures: number;
        suspiciousActivities: number;
        recentActivity: boolean;
        lastEvent?: SecurityEvent;
        } {
        const recentWindow = 60 * 60 * 1000; // 1 hour
        const recentEvents = this.getEventsInWindow(recentWindow);

        return {
            totalEvents: this.events.length,
            decryptionFailures: this.getEventsByType('decryption_failure').length,
            suspiciousActivities: this.getEventsByType('suspicious_access').length,
            recentActivity: recentEvents.length > 0,
            lastEvent: this.events[this.events.length - 1],
        };
    }

    /**
     * Check for security concerns
     */
    checkSecurityConcerns(): Array<{ concern: string; severity: SecurityEventSeverity; recommendation: string }> {
        const concerns: Array<{ concern: string; severity: SecurityEventSeverity; recommendation: string }> = [];
        const windowMs = this.config.alertThresholds.windowMs;
        const recentEvents = this.getEventsInWindow(windowMs);

        // Check for excessive decryption failures
        const decryptionFailures = recentEvents.filter(e => e.type === 'decryption_failure').length;
        if (decryptionFailures >= this.config.alertThresholds.maxDecryptionFailures) {
            concerns.push({
                concern: `${decryptionFailures} decryption failures in the last hour`,
                severity: 'warning',
                recommendation: 'Consider re-entering your API keys to ensure they are correctly stored.',
            });
        }

        // Check for suspicious activities
        const suspiciousActivities = recentEvents.filter(e => e.type === 'suspicious_access').length;
        if (suspiciousActivities >= this.config.alertThresholds.maxSuspiciousAccess) {
            concerns.push({
                concern: `${suspiciousActivities} suspicious access patterns detected`,
                severity: 'critical',
                recommendation: 'Review your API key security and consider rotating keys.',
            });
        }

        return concerns;
    }

    /**
     * Clear all audit logs
     */
    clearLogs(): void {
        this.events = [];
        this.saveEvents();
    }

    /**
     * Export logs for analysis
     */
    exportLogs(): string {
        return JSON.stringify(this.events, null, 2);
    }

    /**
     * Get default severity for event type
     */
    private getDefaultSeverity(type: SecurityEventType): SecurityEventSeverity {
        const severityMap: Record<SecurityEventType, SecurityEventSeverity> = {
            key_access: 'info',
            key_set: 'info',
            key_clear: 'info',
            decryption_success: 'info',
            decryption_failure: 'warning',
            migration_success: 'info',
            migration_failure: 'error',
            suspicious_access: 'warning',
            rate_limit_exceeded: 'warning',
        };
        return severityMap[type] ?? 'info';
    }

    /**
     * Prune old events to stay within limits
     */
    private pruneEvents(): void {
        const cutoff = Date.now() - this.config.retentionMs;

        // Remove old events
        this.events = this.events.filter(e => e.timestamp >= cutoff);

        // Remove excess events (keep most recent)
        if (this.events.length > this.config.maxEvents) {
            this.events = this.events.slice(-this.config.maxEvents);
        }
    }

    /**
     * Check alert thresholds and log warnings
     */
    private checkAlertThresholds(event: SecurityEvent): void {
        const windowMs = this.config.alertThresholds.windowMs;
        const recentEvents = this.getEventsInWindow(windowMs);

        if (event.type === 'decryption_failure') {
            const failures = recentEvents.filter(e => e.type === 'decryption_failure').length;
            if (failures === this.config.alertThresholds.maxDecryptionFailures) {
                logger.warn(`${failures} decryption failures detected in the last hour`, 'Security');
            }
        }

        if (event.type === 'suspicious_access') {
            const suspicious = recentEvents.filter(e => e.type === 'suspicious_access').length;
            if (suspicious >= this.config.alertThresholds.maxSuspiciousAccess) {
                logger.error(`${suspicious} suspicious access patterns detected`, 'Security');
            }
        }
    }

    /**
     * Load events from storage
     */
    private loadEvents(): void {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored) as unknown[];
                if (Array.isArray(parsed)) {
                    this.events = parsed as SecurityEvent[];
                }
            }
        } catch {
            // Ignore errors, start fresh
            this.events = [];
        }
    }

    /**
     * Save events to storage
     */
    private saveEvents(): void {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.events));
        } catch {
            // Storage might be full, try to prune more aggressively
            this.events = this.events.slice(-100);
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.events));
            } catch {
                logger.warn('Failed to save audit logs', 'Security');
            }
        }
    }
}

// Export convenience function
export const securityAudit = SecurityAuditService.getInstance();
