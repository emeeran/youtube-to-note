/**
 * AI Service (Refactored)
 * Maintains backward compatibility while delegating to new AI Orchestrator
 */

import { AIProvider, AIResponse, YouTubePluginSettings } from '../types';
import { AIOrchestrator } from '../domain/ai';

/**
 * AI Service facade - delegates to AIOrchestrator
 * This maintains backward compatibility with existing code
 */
export class AIService {
  private orchestrator: AIOrchestrator;

  constructor(providers: AIProvider[], settings: YouTubePluginSettings) {
    this.orchestrator = new AIOrchestrator(providers, settings);
  }

  async process(prompt: string, images?: (string | ArrayBuffer)[]): Promise<AIResponse> {
    return await this.orchestrator.process(prompt, images);
  }

  async processWith(
    providerName: string,
    prompt: string,
    overrideModel?: string,
    images?: (string | ArrayBuffer)[],
    enableFallback: boolean = true
  ): Promise<AIResponse> {
    return await this.orchestrator.processWith(
      providerName,
      prompt,
      overrideModel,
      images,
      enableFallback
    );
  }

  updateSettings(newSettings: YouTubePluginSettings): void {
    this.orchestrator.updateSettings(newSettings);
  }

  getProviderModels(providerName: string): string[] {
    return this.orchestrator.getProviderModels(providerName);
  }

  async fetchLatestModels(): Promise<Record<string, string[]>> {
    return await this.orchestrator.fetchLatestModels();
  }

  async fetchLatestModelsForProvider(providerName: string, bypassCache?: boolean): Promise<string[]> {
    return await this.orchestrator.fetchLatestModelsForProvider(providerName, bypassCache);
  }

  hasAvailableProviders(): boolean {
    return this.orchestrator.hasAvailableProviders();
  }

  getProviderNames(): string[] {
    return this.orchestrator.getProviderNames();
  }

  addProvider(provider: AIProvider): void {
    this.orchestrator.addProvider(provider);
  }

  removeProvider(providerName: string): boolean {
    return this.orchestrator.removeProvider(providerName);
  }

  getPerformanceMetrics(): any {
    return this.orchestrator.getPerformanceMetrics();
  }

  cleanup(): void {
    this.orchestrator.cleanup();
  }

  // Expose internal orchestrator for advanced use cases
  get internalOrchestrator(): AIOrchestrator {
    return this.orchestrator;
  }
}
