/**
 * Unit tests for Security Audit Service
 */

import { SecurityAuditService, SecurityEventSeverity } from '../../../src/services/security-audit';

describe('SecurityAuditService', () => {
    let audit: SecurityAuditService;

    beforeEach(() => {
        // Create fresh instance for each test
        audit = new SecurityAuditService({
            maxEvents: 100,
            retentionMs: 3600000, // 1 hour
            alertThresholds: {
                maxDecryptionFailures: 3,
                maxSuspiciousAccess: 2,
                windowMs: 60000, // 1 minute
            },
        });
        // Clear any existing logs
        audit.clearLogs();
    });

    afterEach(() => {
        audit.clearLogs();
    });

    describe('log', () => {
        it('should log a security event', () => {
            audit.log('key_access', 'API key accessed', { keyType: 'geminiApiKey' });

            const events = audit.getRecentEvents(1);
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('key_access');
            expect(events[0].message).toBe('API key accessed');
        });

        it('should include severity', () => {
            audit.log('decryption_failure', 'Failed to decrypt', { severity: 'warning' });

            const events = audit.getRecentEvents(1);
            expect(events[0].severity).toBe('warning');
        });

        it('should include metadata', () => {
            audit.log('key_set', 'Key set', { metadata: { provider: 'gemini' } });

            const events = audit.getRecentEvents(1);
            expect(events[0].metadata).toEqual({ provider: 'gemini' });
        });

        it('should include timestamp', () => {
            const before = Date.now();
            audit.log('key_access', 'Test');
            const after = Date.now();

            const events = audit.getRecentEvents(1);
            expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
            expect(events[0].timestamp).toBeLessThanOrEqual(after);
        });
    });

    describe('convenience methods', () => {
        it('should log key access', () => {
            audit.logKeyAccess('geminiApiKey', true);

            const events = audit.getRecentEvents(1);
            expect(events[0].type).toBe('key_access');
            expect(events[0].keyType).toBe('geminiApiKey');
        });

        it('should log decryption failure', () => {
            audit.logDecryption(false, 'geminiApiKey', 'Invalid format');

            const events = audit.getRecentEvents(1);
            expect(events[0].type).toBe('decryption_failure');
            expect(events[0].severity).toBe('warning');
        });

        it('should log key set', () => {
            audit.logKeySet('geminiApiKey');

            const events = audit.getRecentEvents(1);
            expect(events[0].type).toBe('key_set');
        });

        it('should log key clear', () => {
            audit.logKeyClear('geminiApiKey');

            const events = audit.getRecentEvents(1);
            expect(events[0].type).toBe('key_clear');
        });

        it('should log migration', () => {
            audit.logMigration(true, 'geminiApiKey', 1, 2);

            const events = audit.getRecentEvents(1);
            expect(events[0].type).toBe('migration_success');
        });

        it('should log migration failure', () => {
            audit.logMigration(false, 'geminiApiKey', 1, 2);

            const events = audit.getRecentEvents(1);
            expect(events[0].type).toBe('migration_failure');
            expect(events[0].severity).toBe('error');
        });

        it('should log suspicious activity', () => {
            audit.logSuspiciousActivity('Multiple failed access attempts', { count: 5 });

            const events = audit.getRecentEvents(1);
            expect(events[0].type).toBe('suspicious_access');
            expect(events[0].severity).toBe('warning');
        });
    });

    describe('getRecentEvents', () => {
        it('should return limited number of events', () => {
            for (let i = 0; i < 10; i++) {
                audit.log('key_access', `Event ${i}`);
            }

            const events = audit.getRecentEvents(5);
            expect(events).toHaveLength(5);
        });

        it('should return most recent events', () => {
            for (let i = 0; i < 5; i++) {
                audit.log('key_access', `Event ${i}`);
            }

            const events = audit.getRecentEvents(2);
            expect(events[0].message).toBe('Event 3');
            expect(events[1].message).toBe('Event 4');
        });
    });

    describe('getEventsByType', () => {
        it('should filter events by type', () => {
            audit.log('key_access', 'Access 1');
            audit.log('decryption_failure', 'Failure 1');
            audit.log('key_access', 'Access 2');

            const accessEvents = audit.getEventsByType('key_access');
            expect(accessEvents).toHaveLength(2);

            const failureEvents = audit.getEventsByType('decryption_failure');
            expect(failureEvents).toHaveLength(1);
        });
    });

    describe('getEventsInWindow', () => {
        it('should return events within time window', async () => {
            audit.log('key_access', 'Recent');

            await new Promise(resolve => setTimeout(resolve, 100));

            audit.log('key_access', 'Newer');

            const recentEvents = audit.getEventsInWindow(50);
            expect(recentEvents).toHaveLength(1);
            expect(recentEvents[0].message).toBe('Newer');
        });
    });

    describe('getSummary', () => {
        it('should return summary statistics', () => {
            audit.log('key_access', 'Access 1');
            audit.log('key_access', 'Access 2');
            audit.log('decryption_failure', 'Failure 1');
            audit.logSuspiciousActivity('Suspicious');

            const summary = audit.getSummary();

            expect(summary.totalEvents).toBe(4);
            expect(summary.decryptionFailures).toBe(1);
            expect(summary.suspiciousActivities).toBe(1);
            expect(summary.recentActivity).toBe(true);
        });
    });

    describe('checkSecurityConcerns', () => {
        it('should detect excessive decryption failures', () => {
            audit.logDecryption(false, 'key1', 'Error 1');
            audit.logDecryption(false, 'key1', 'Error 2');
            audit.logDecryption(false, 'key1', 'Error 3');

            const concerns = audit.checkSecurityConcerns();
            expect(concerns.length).toBeGreaterThan(0);
            expect(concerns[0].concern).toContain('decryption failures');
        });

        it('should detect suspicious activities', () => {
            audit.logSuspiciousActivity('Activity 1');
            audit.logSuspiciousActivity('Activity 2');

            const concerns = audit.checkSecurityConcerns();
            expect(concerns.some(c => c.concern.includes('suspicious'))).toBe(true);
        });

        it('should return empty array when no concerns', () => {
            audit.log('key_access', 'Normal access');

            const concerns = audit.checkSecurityConcerns();
            expect(concerns).toHaveLength(0);
        });
    });

    describe('clearLogs', () => {
        it('should clear all events', () => {
            audit.log('key_access', 'Test');
            audit.clearLogs();

            const events = audit.getRecentEvents(10);
            expect(events).toHaveLength(0);
        });
    });

    describe('exportLogs', () => {
        it('should export logs as JSON string', () => {
            audit.log('key_access', 'Test event');

            const exported = audit.exportLogs();

            expect(typeof exported).toBe('string');
            expect(() => JSON.parse(exported)).not.toThrow();

            const parsed = JSON.parse(exported);
            expect(Array.isArray(parsed)).toBe(true);
        });
    });
});
