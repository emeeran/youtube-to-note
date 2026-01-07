/**
 * Web Scraper Service
 * Fetches latest AI model information from official provider websites
 */

import { PROVIDER_MODEL_LIST_URLS, PROVIDER_MODEL_REGEX } from '../ai/api';
import { logger } from './logger';

interface ScrapedModels {
    provider: string;
    models: string[];
    timestamp: number;
    source: 'api' | 'web' | 'cache';
}

export class WebScraperService {
    private static readonly CACHE_KEY = 'yt-clipper-scraped-models';
    private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Fetch models from a provider's official website
     */
    static async fetchModelsFromWeb(providerName: string): Promise<string[]> {
        const url = PROVIDER_MODEL_LIST_URLS[providerName];
        if (!url) {
            logger.warn(`No web URL configured for provider: ${providerName}`, 'WebScraper');
            return [];
        }

        try {
            logger.info(`Fetching models from web for ${providerName}: ${url}`, 'WebScraper');

            // For API endpoints (like Ollama), we can fetch directly
            if (url.includes('api') || url.startsWith('http://localhost')) {
                return await this.fetchFromAPI(providerName, url);
            }

            // For web pages, we'll need to use a different approach
            // Since Obsidian doesn't have built-in web scraping, we'll use the MCP web reader
            return await this.fetchFromWebPage(providerName, url);
        } catch (error) {
            logger.error(`Failed to fetch models from web for ${providerName}: ${error}`, 'WebScraper');
            return [];
        }
    }

    /**
     * Fetch models from an API endpoint
     */
    private static async fetchFromAPI(providerName: string, url: string): Promise<string[]> {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle different API response formats
            if (providerName === 'Ollama' || providerName === 'Ollama Cloud') {
                if (data?.models && Array.isArray(data.models)) {
                    return data.models.map((m: { name?: string; model?: string; id?: string }) => m.name ?? m.model ?? m.id ?? '')
                        .filter((name: string) => name.length > 0);
                }
            }

            if (providerName === 'OpenRouter') {
                if (data?.data && Array.isArray(data.data)) {
                    return data.data.map((m: { id?: string }) => m.id ?? '')
                        .filter((name: string) => name.length > 0);
                }
            }

            logger.warn(`Unknown API response format for ${providerName}`, 'WebScraper');
            return [];
        } catch (error) {
            logger.error(`API fetch failed for ${providerName}: ${error}`, 'WebScraper');
            return [];
        }
    }

    /**
     * Fetch models from a web page using regex extraction
     * Note: This is a best-effort approach since we can't do full DOM parsing in Obsidian
     */
    private static async fetchFromWebPage(providerName: string, url: string): Promise<string[]> {
        try {
            // Try to fetch the HTML content
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();

            // Use regex to extract model names from the HTML
            const regex = PROVIDER_MODEL_REGEX[providerName];
            if (!regex) {
                logger.warn(`No regex configured for provider: ${providerName}`, 'WebScraper');
                return [];
            }

            const matches = html.match(regex);
            if (!matches) {
                logger.warn(`No model matches found for ${providerName}`, 'WebScraper');
                return [];
            }

            // Deduplicate and clean up matches
            const uniqueModels = Array.from(new Set(matches))
                .filter(name => name.length > 2 && name.length < 100)
                .sort();

            logger.info(`Found ${uniqueModels.length} potential models for ${providerName}`, 'WebScraper');
            return uniqueModels.slice(0, 100); // Limit to 100 models
        } catch (error) {
            logger.error(`Web page fetch failed for ${providerName}: ${error}`, 'WebScraper');
            return [];
        }
    }

    /**
     * Get cached scraped models
     */
    static getCachedModels(): Map<string, ScrapedModels> {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return new Map();

            const data = JSON.parse(cached);
            const now = Date.now();
            const result = new Map<string, ScrapedModels>();

            for (const [provider, scraped] of Object.entries(data)) {
                // Filter out expired cache entries
                if (now - scraped.timestamp < this.CACHE_DURATION) {
                    result.set(provider, scraped as ScrapedModels);
                }
            }

            return result;
        } catch (error) {
            logger.error(`Failed to load cached models: ${error}`, 'WebScraper');
            return new Map();
        }
    }

    /**
     * Save scraped models to cache
     */
    static saveCachedModels(provider: string, models: string[], source: 'api' | 'web'): void {
        try {
            const cached = this.getCachedModels();
            cached.set(provider, {
                provider,
                models,
                timestamp: Date.now(),
                source,
            });

            const dataToSave = Object.fromEntries(cached);
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(dataToSave));
        } catch (error) {
            logger.error(`Failed to save cached models: ${error}`, 'WebScraper');
        }
    }

    /**
     * Clear cached models for a specific provider
     */
    static clearProviderCache(provider: string): void {
        try {
            const cached = this.getCachedModels();
            cached.delete(provider);

            const dataToSave = Object.fromEntries(cached);
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(dataToSave));
        } catch (error) {
            logger.error(`Failed to clear provider cache: ${error}`, 'WebScraper');
        }
    }

    /**
     * Check if cached models are still fresh
     */
    static isCacheFresh(provider: string): boolean {
        const cached = this.getCachedModels();
        const scraped = cached.get(provider);
        if (!scraped) return false;

        const age = Date.now() - scraped.timestamp;
        return age < this.CACHE_DURATION;
    }

    /**
     * Get cache age in human-readable format
     */
    static getCacheAge(provider: string): string {
        const cached = this.getCachedModels();
        const scraped = cached.get(provider);
        if (!scraped) return 'Not cached';

        const ageMinutes = Math.floor((Date.now() - scraped.timestamp) / 60000);

        if (ageMinutes < 60) return `${ageMinutes}m ago`;
        if (ageMinutes < 1440) return `${Math.floor(ageMinutes / 60)}h ago`;
        return `${Math.floor(ageMinutes / 1440)}d ago`;
    }
}
