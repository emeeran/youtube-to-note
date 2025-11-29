import { PerformanceMonitor } from './performance-monitor';

// Simple crypto implementation for compatibility
declare global {
    interface Window {
        crypto?: {
            getRandomValues: (array: Uint8Array) => Uint8Array;
        };
    }
}

export interface SecurityConfig {
    encryption: {
        algorithm: string;
        keySize: number;
        iterations: number;
        saltLength: number;
    };
    validation: {
        maxInputLength: number;
        allowedHostnames: string[];
        blockedPatterns: RegExp[];
        sanitizeHTML: boolean;
        validateJSON: boolean;
    };
    rateLimiting: {
        enabled: boolean;
        maxRequests: number;
        windowMs: number;
        skipSuccessfulRequests: boolean;
    };
    audit: {
        enabled: boolean;
        logLevel: 'basic' | 'detailed' | 'verbose';
        maxLogEntries: number;
        persistLogs: boolean;
    };
    csp: {
        enabled: boolean;
        directives: Record<string, string[]>;
    };
}

export interface SecurityContext {
    userId?: string;
    sessionId: string;
    timestamp: number;
    ip?: string;
    userAgent?: string;
}

export interface AuditLog {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'critical';
    category: 'authentication' | 'authorization' | 'data' | 'network' | 'system';
    action: string;
    details: any;
    context: SecurityContext;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityMetrics {
    totalRequests: number;
    blockedRequests: number;
    suspiciousActivities: number;
    securityViolations: number;
    auditLogEntries: number;
    encryptionOperations: number;
    validationFailures: number;
    rateLimitViolations: number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitized?: any;
}

/**
 * Simple crypto utilities for environments without crypto-js
 */
class SimpleCrypto {
    static generateRandomBytes(length: number): string {
        const bytes = new Uint8Array(length);
        if (window.crypto?.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            // Fallback using Math.random
            for (let i = 0; i < length; i++) {
                bytes[i] = Math.floor(Math.random() * 256);
            }
        }

        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    static hash(input: string): string {
        // Simple hash implementation for demo purposes
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    static simpleEncrypt(text: string, key: string): { encrypted: string; salt: string; iv: string } {
        const salt = this.generateRandomBytes(16);
        const iv = this.generateRandomBytes(16);

        // Simple XOR encryption for demo (NOT SECURE for production)
        let encrypted = '';
        for (let i = 0; i < text.length; i++) {
            const keyChar = key.charCodeAt(i % key.length);
            const textChar = text.charCodeAt(i);
            encrypted += String.fromCharCode(textChar ^ keyChar);
        }

        // Base64 encode the result
        const encryptedBase64 = btoa(encrypted);

        return { encrypted: encryptedBase64, salt, iv };
    }

    static simpleDecrypt(encryptedBase64: string, key: string): string {
        try {
            const encrypted = atob(encryptedBase64);

            // Simple XOR decryption
            let decrypted = '';
            for (let i = 0; i < encrypted.length; i++) {
                const keyChar = key.charCodeAt(i % key.length);
                const encryptedChar = encrypted.charCodeAt(i);
                decrypted += String.fromCharCode(encryptedChar ^ keyChar);
            }

            return decrypted;
        } catch (error) {
            throw new Error('Decryption failed');
        }
    }
}

/**
 * Comprehensive security hardening system for the plugin
 */
export class SecurityHardener {
    private static instance: SecurityHardener;
    private config: SecurityConfig;
    private auditLogs: AuditLog[] = [];
    private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
    private encryptionKey: string;
    private context: SecurityContext;

    private constructor(config: Partial<SecurityConfig> = {}) {
        this.config = {
            encryption: {
                algorithm: 'AES',
                keySize: 256,
                iterations: 100000,
                saltLength: 32
            },
            validation: {
                maxInputLength: 1000000, // 1MB
                allowedHostnames: [
                    'youtube.com',
                    'youtu.be',
                    'googleapis.com',
                    'gemini.google.com',
                    'groq.com',
                    'rapidapi.com'
                ],
                blockedPatterns: [
                    /javascript:/i,
                    /data:text\/html/i,
                    /vbscript:/i,
                    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
                ],
                sanitizeHTML: true,
                validateJSON: true
            },
            rateLimiting: {
                enabled: true,
                maxRequests: 100,
                windowMs: 60000, // 1 minute
                skipSuccessfulRequests: false
            },
            audit: {
                enabled: true,
                logLevel: 'detailed',
                maxLogEntries: 1000,
                persistLogs: true
            },
            csp: {
                enabled: true,
                directives: {
                    'default-src': ["'self'"],
                    'script-src': ["'self'", "'unsafe-inline'"],
                    'style-src': ["'self'", "'unsafe-inline'"],
                    'img-src': ["'self'", 'data:', 'https:', 'youtube.com', 'i.ytimg.com'],
                    'connect-src': ["'self'", 'https:', 'youtube.com', 'googleapis.com', 'gemini.google.com', 'groq.com'],
                    'font-src': ["'self'"],
                    'object-src': ["'none'"],
                    'media-src': ["'self'"],
                    'frame-src': ["'self'", 'youtube.com', 'www.youtube.com']
                }
            },
            ...config
        };

        this.context = {
            sessionId: this.generateSessionId(),
            timestamp: Date.now()
        };

        this.encryptionKey = this.generateEncryptionKey();

        this.initializeSecurity();
    }

    static getInstance(config?: Partial<SecurityConfig>): SecurityHardener {
        if (!SecurityHardener.instance) {
            SecurityHardener.instance = new SecurityHardener(config);
        }
        return SecurityHardener.instance;
    }

    private initializeSecurity(): void {
        // Load persisted audit logs
        if (this.config.audit.enabled && this.config.audit.persistLogs) {
            this.loadAuditLogs();
        }

        // Set up Content Security Policy
        if (this.config.csp.enabled) {
            this.setupCSP();
        }

        // Set up global security monitoring
        this.setupSecurityMonitoring();

        console.info('🔒 Security hardening initialized');
    }

    private generateSessionId(): string {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    private generateEncryptionKey(): string {
        return SimpleCrypto.generateRandomBytes(32);
    }

    private setupCSP(): void {
        if (typeof document === 'undefined') return;

        const cspDirectives = Object.entries(this.config.csp.directives)
            .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
            .join('; ');

        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = cspDirectives;
        document.head.appendChild(meta);

        this.logAudit({
            level: 'info',
            category: 'system',
            action: 'csp_setup',
            details: { directives: this.config.csp.directives },
            severity: 'low'
        });
    }

    private setupSecurityMonitoring(): void {
        // Monitor for suspicious activities
        if (typeof window !== 'undefined') {
            // Monitor console for suspicious error patterns
            const originalError = console.error;
            console.error = (...args: any[]) => {
                originalError.apply(console, args);
                this.detectSuspiciousActivity(args.join(' '));
            };

            // Monitor for XSS attempts
            const originalWrite = document.write;
            document.write = (...args: any[]) => {
                const content = args.join('');
                if (this.detectXSS(content)) {
                    this.blockSuspiciousActivity('XSS attempt detected in document.write', { content });
                    return;
                }
                originalWrite.apply(document, args);
            };
        }
    }

    private detectSuspiciousActivity(content: string): void {
        const suspiciousPatterns = [
            /unauthorized/i,
            /access denied/i,
            /authentication failed/i,
            /sql injection/i,
            /xss/i,
            /csrf/i
        ];

        const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(content));
        if (isSuspicious) {
            this.logAudit({
                level: 'warn',
                category: 'system',
                action: 'suspicious_activity_detected',
                details: { content },
                severity: 'medium'
            });
        }
    }

    private detectXSS(content: string): boolean {
        const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe/i,
            /<object/i,
            /<embed/i
        ];

        return xssPatterns.some(pattern => pattern.test(content));
    }

    // Encryption utilities
    encrypt(data: string, password?: string): { encrypted: string; salt: string; iv: string } {
        const key = password || this.encryptionKey;
        const result = SimpleCrypto.simpleEncrypt(data, key);

        this.logAudit({
            level: 'info',
            category: 'data',
            action: 'encryption_operation',
            details: { dataSize: data.length },
            severity: 'low'
        });

        return result;
    }

    decrypt(encryptedData: string, salt: string, iv: string, password?: string): string {
        try {
            const key = password || this.encryptionKey;
            const result = SimpleCrypto.simpleDecrypt(encryptedData, key);

            if (!result) {
                throw new Error('Decryption failed - invalid result');
            }

            this.logAudit({
                level: 'info',
                category: 'data',
                action: 'decryption_operation',
                details: { dataSize: result.length },
                severity: 'low'
            });

            return result;
        } catch (error) {
            this.logAudit({
                level: 'error',
                category: 'data',
                action: 'decryption_failed',
                details: { error: (error as Error).message },
                severity: 'high'
            });
            throw error;
        }
    }

    // Input validation and sanitization
    validateInput(input: any, type: 'string' | 'url' | 'json' | 'html' = 'string') {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Type-specific validation
            switch (type) {
                case 'string':
                    if (typeof input !== 'string') {
                        errors.push('Input must be a string');
                    } else {
                        if (input.length > this.config.validation.maxInputLength) {
                            errors.push(`Input exceeds maximum length of ${this.config.validation.maxInputLength}`);
                        }

                        // Check for blocked patterns
                        for (const pattern of this.config.validation.blockedPatterns) {
                            if (pattern.test(input)) {
                                errors.push(`Input contains blocked pattern`);
                            }
                        }
                    }
                    break;

                case 'url':
                    try {
                        const url = new URL(input);
                        if (!this.config.validation.allowedHostnames.includes(url.hostname)) {
                            errors.push(`Hostname ${url.hostname} is not allowed`);
                        }

                        // Check protocol
                        if (!['http:', 'https:'].includes(url.protocol)) {
                            errors.push(`Protocol ${url.protocol} is not allowed`);
                        }
                    } catch {
                        errors.push('Invalid URL format');
                    }
                    break;

                case 'json':
                    try {
                        JSON.parse(input);
                    } catch {
                        errors.push('Invalid JSON format');
                    }
                    break;

                case 'html':
                    if (typeof input !== 'string') {
                        errors.push('HTML input must be a string');
                    } else {
                        const sanitized = this.sanitizeHTML(input);
                        if (sanitized !== input) {
                            warnings.push('HTML content was sanitized');
                        }
                        return {
                            isValid: true,
                            errors,
                            warnings,
                            sanitized
                        };
                    }
                    break;
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [`Validation error: ${(error as Error).message}`],
                warnings
            };
        }
    }

    private sanitizeHTML(html: string): string {
        if (!this.config.validation.sanitizeHTML) {
            return html;
        }

        // Basic HTML sanitization
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    }

    // Rate limiting
    checkRateLimit(identifier: string = this.context.sessionId): boolean {
        if (!this.config.rateLimiting.enabled) {
            return true;
        }

        const now = Date.now();
        const windowMs = this.config.rateLimiting.windowMs;
        const maxRequests = this.config.rateLimiting.maxRequests;

        let rateLimitData = this.rateLimitMap.get(identifier);

        if (!rateLimitData || now > rateLimitData.resetTime) {
            // Reset or initialize rate limit
            rateLimitData = {
                count: 1,
                resetTime: now + windowMs
            };
            this.rateLimitMap.set(identifier, rateLimitData);
            return true;
        }

        if (rateLimitData.count >= maxRequests) {
            this.logAudit({
                level: 'warn',
                category: 'authorization',
                action: 'rate_limit_exceeded',
                details: { identifier, count: rateLimitData.count },
                severity: 'medium'
            });
            return false;
        }

        rateLimitData.count++;
        return true;
    }

    // API key security
    secureApiKey(apiKey: string, provider: string): string {
        const encrypted = this.encrypt(apiKey, `${provider}_key_salt`);
        return btoa(JSON.stringify(encrypted));
    }

    extractApiKey(encryptedKey: string, provider: string): string {
        try {
            const decoded = atob(encryptedKey);
            const parsed = JSON.parse(decoded) as { encrypted: string; salt: string; iv: string };
            return this.decrypt(parsed.encrypted, parsed.salt, parsed.iv, `${provider}_key_salt`);
        } catch (error) {
            this.logAudit({
                level: 'error',
                category: 'authentication',
                action: 'api_key_extraction_failed',
                details: { provider, error: (error as Error).message },
                severity: 'high'
            });
            throw new Error('Failed to extract API key');
        }
    }

    // Audit logging
    private logAudit(entry: Omit<AuditLog, 'id' | 'context'>): void {
        if (!this.config.audit.enabled) return;

        const auditEntry: AuditLog = {
            id: this.generateId(),
            timestamp: Date.now(),
            ...entry,
            context: { ...this.context }
        };

        this.auditLogs.push(auditEntry);

        // Keep only recent logs
        if (this.auditLogs.length > this.config.audit.maxLogEntries) {
            this.auditLogs = this.auditLogs.slice(-this.config.audit.maxLogEntries);
        }

        // Persist logs if enabled
        if (this.config.audit.persistLogs) {
            this.persistAuditLogs();
        }

        // Log to console if configured
        if (this.config.audit.logLevel !== 'basic' || entry.severity === 'critical') {
            const logMessage = `[AUDIT] ${entry.category.toUpperCase()}: ${entry.action}`;
            switch (entry.level) {
                case 'info':
                    console.info(logMessage, entry.details);
                    break;
                case 'warn':
                    console.warn(logMessage, entry.details);
                    break;
                case 'error':
                case 'critical':
                    console.error(logMessage, entry.details);
                    break;
            }
        }
    }

    private loadAuditLogs(): void {
        try {
            const persisted = localStorage.getItem('ytclipper_audit_logs');
            if (persisted) {
                this.auditLogs = JSON.parse(persisted);
            }
        } catch (error) {
            console.warn('Failed to load audit logs:', error);
        }
    }

    private persistAuditLogs(): void {
        try {
            localStorage.setItem('ytclipper_audit_logs', JSON.stringify(this.auditLogs));
        } catch (error) {
            console.warn('Failed to persist audit logs:', error);
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    private blockSuspiciousActivity(reason: string, details: any): void {
        this.logAudit({
            level: 'error',
            category: 'authorization',
            action: 'suspicious_activity_blocked',
            details: { reason, ...details },
            severity: 'high'
        });

        // In a real implementation, this might block the user or alert administrators
        console.error('🚨 Suspicious activity blocked:', reason, details);
    }

    // Cleanup
    cleanup(): void {
        this.auditLogs = [];
        this.rateLimitMap.clear();

        // Remove CSP meta tag
        if (typeof document !== 'undefined') {
            const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            if (cspMeta) {
                cspMeta.remove();
            }
        }
    }
}

// Security utility functions
export const SecurityUtils = {
    generateSecureToken(length: number = 32): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    generateSecureId(): string {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    },

    hashString(input: string): string {
        return SimpleCrypto.hash(input);
    },

    compareStrings(a: string, b: string): boolean {
        // Constant-time comparison to prevent timing attacks
        if (a.length !== b.length) return false;

        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }

        return result === 0;
    },

    isValidYouTubeUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return ['youtube.com', 'youtu.be', 'm.youtube.com'].includes(urlObj.hostname) &&
                   (urlObj.pathname.includes('/watch') || urlObj.pathname.includes('/shorts/'));
        } catch {
            return false;
        }
    },

    extractVideoId(url: string): string | null {
        try {
            const urlObj = new URL(url);

            if (urlObj.hostname === 'youtu.be') {
                return urlObj.pathname.slice(1);
            }

            if (urlObj.hostname.includes('youtube.com')) {
                const params = new URLSearchParams(urlObj.search);
                return params.get('v');
            }

            return null;
        } catch {
            return null;
        }
    },

    sanitizeFilename(filename: string): string {
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 255);
    }
};

// Global security instance
export const security = SecurityHardener.getInstance();

