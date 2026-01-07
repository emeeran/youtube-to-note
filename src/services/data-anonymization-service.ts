/**
 * Data Anonymization Service
 * Anonymize sensitive data for privacy
 */

export class DataAnonymizationService {
    private emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    private phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    private ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
    private creditCardPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
    private ipAddressPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

    /**
     * Anonymize email addresses
     */
    anonymizeEmail(text: string): string {
        return text.replace(this.emailPattern, (email) => {
            const [username, domain] = email.split('@');
            return `${username[0]}***@${domain}`;
        });
    }

    /**
     * Anonymize phone numbers
     */
    anonymizePhone(text: string): string {
        return text.replace(this.phonePattern, '***-***-****');
    }

    /**
     * Anonymize SSN
     */
    anonymizeSSN(text: string): string {
        return text.replace(this.ssnPattern, '***-**-****');
    }

    /**
     * Anonymize credit card numbers
     */
    anonymizeCreditCard(text: string): string {
        return text.replace(this.creditCardPattern, (match) => {
            const last4 = match.slice(-4);
            return `****-****-****-${last4}`;
        });
    }

    /**
     * Anonymize IP addresses
     */
    anonymizeIP(text: string): string {
        return text.replace(this.ipAddressPattern, 'x.x.x.x');
    }

    /**
     * Anonymize all PII
     */
    anonymizeAll(text: string): string {
        let result = text;
        result = this.anonymizeEmail(result);
        result = this.anonymizePhone(result);
        result = this.anonymizeSSN(result);
        result = this.anonymizeCreditCard(result);
        result = this.anonymizeIP(result);
        return result;
    }

    /**
     * Remove API keys from text
     */
    removeApiKeys(text: string): string {
        // Common API key patterns
        const apiKeyPatterns = [
            /AIza[A-Za-z0-9_-]{35}/g, // Google API keys
            /sk-[A-Za-z0-9]{48}/g, // Stripe keys
            /ghp_[A-Za-z0-9]{36}/g, // GitHub personal access tokens
            /[A-Za-z0-9]{32}/g, // Generic 32-char keys
        ];

        let result = text;
        for (const pattern of apiKeyPatterns) {
            result = result.replace(pattern, '[REDACTED_API_KEY]');
        }
        return result;
    }

    /**
     * Sanitize log output
     */
    sanitizeLog(data: any): any {
        if (typeof data === 'string') {
            return this.removeApiKeys(this.anonymizeAll(data));
        } else if (typeof data === 'object' && data !== null) {
            const sanitized: any = Array.isArray(data) ? [] : {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
                        sanitized[key] = '[REDACTED]';
                    } else {
                        sanitized[key] = this.sanitizeLog(data[key]);
                    }
                }
            }
            return sanitized;
        }
        return data;
    }
}

export const dataAnonymizationService = new DataAnonymizationService();
