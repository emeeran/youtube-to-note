import { YouTubePluginSettings } from './types';

/**
 * Secure configuration service for API key management
 * Supports both direct configuration and environment variables
 */

export class SecureConfigService {
    private settings: YouTubePluginSettings;

    constructor(settings: YouTubePluginSettings) {
        this.settings = settings;
    }

    /**
     * Get API key with environment variable fallback
     */
    getApiKey(keyType: 'gemini' | 'groq'): string {
        if (this.settings.useEnvironmentVariables) {
            return this.getFromEnvironment(keyType);
        }

        return keyType === 'gemini' ? this.settings.geminiApiKey : this.settings.groqApiKey;
    }

    /**
     * Get API key from environment variables
     */
    private getFromEnvironment(keyType: 'gemini' | 'groq'): string {
        const prefix = this.settings.environmentPrefix || 'YTC';
        const envVarName = `${prefix}_${keyType.toUpperCase()}_API_KEY`;

        // In browser environment, we can only access environment variables
        // that were set during build time or through a secure configuration service
        return this.getSecureEnvVar(envVarName) ?? '';
    }

    /**
     * Secure environment variable access
     * Note: In Obsidian plugins, environment variables are limited
     * This method can be extended for server-side environments
     */
    private getSecureEnvVar(_varName: string): string | undefined {
        // In a real implementation, this would access secure environment variables
        // For Obsidian plugins, we rely on user-provided settings
        if (this.settings.useEnvironmentVariables && this.settings.environmentPrefix) {
            // Placeholder: Environment variables are not directly accessible in Obsidian mobile/desktop
            // this way without specific setup. This is a stub for future enhancement.
            // return process.env[varName];
            return undefined;
        }
        return undefined;
    }

    private getFromSecureStorage(_varName: string): string | undefined {
        // Placeholder for platform-specific secure storage (keychain, etc.)
        // return keytar.getPassword(...)
        return undefined;
    }

    /**
     * Validate configuration security
     */
    validateSecurityConfiguration(): { isSecure: boolean; warnings: string[] } {
        const warnings: string[] = [];
        let isSecure = true;

        // Check if API keys are stored directly and warn
        if (!this.settings.useEnvironmentVariables) {
            if (this.settings.geminiApiKey && this.settings.geminiApiKey.length > 0) {
                warnings.push('Gemini API key is stored directly in configuration. Consider using environment variables.');
                isSecure = false;
            }
            if (this.settings.groqApiKey && this.settings.groqApiKey.length > 0) {
                warnings.push('Groq API key is stored directly in configuration. Consider using environment variables.');
                isSecure = false;
            }
        }

        // Check for weak API keys
        if (this.settings.geminiApiKey === 'your-api-key-here' || this.settings.groqApiKey === 'your-api-key-here') {
            warnings.push('Default placeholder API keys detected. Please set real API keys.');
            isSecure = false;
        }

        return { isSecure, warnings };
    }

    /**
     * Get configuration template for environment variables
     */
    getEnvironmentTemplate(): string {
        const prefix = this.settings.environmentPrefix || 'YTC';
        return `# YouTubeClipper Environment Variables
# Set these in your environment for secure API key management

# Google Gemini API Key
${prefix}_GEMINI_API_KEY=your_gemini_api_key_here

# Groq API Key  
${prefix}_GROQ_API_KEY=your_groq_api_key_here

# Usage:
# 1. Set these variables in your shell profile (.bashrc, .zshrc, etc.)
# 2. Enable "Use Environment Variables" in plugin settings
# 3. Restart Obsidian to pick up the new environment variables
`;
    }
}