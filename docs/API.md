# YouTube Clipper API Documentation

> Complete API reference for the YouTube Clipper Obsidian plugin

## Table of Contents

- [Overview](#overview)
- [Core Classes](#core-classes)
- [Types and Interfaces](#types-and-interfaces)
- [AI Provider APIs](#ai-provider-apis)
- [Security APIs](#security-apis)
- [Performance APIs](#performance-apis)
- [Events](#events)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)

---

## Overview

The YouTube Clipper API provides programmatic access to all plugin functionality, including video processing, AI provider management, security features, and performance monitoring.

### Basic Usage

```typescript
import { YouTubeClipperAPI } from 'youtube-clipper-api';

// Initialize the API
const api = new YouTubeClipperAPI();

// Process a video
const result = await api.processVideo({
  url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  format: 'executive-summary',
  provider: 'gemini'
});

console.log('Generated note:', result.filePath);
```

---

## Core Classes

### YouTubeClipperAPI

The main API class that provides access to all plugin functionality.

```typescript
class YouTubeClipperAPI {
  constructor(config?: APIConfig)

  // Video processing
  async processVideo(options: VideoProcessingOptions): Promise<ProcessingResult>
  async processBatch(options: BatchProcessingOptions): Promise<ProcessingResult[]>
  async processParallel(videos: VideoProcessingOptions[]): Promise<ProcessingResult[]>

  // Configuration
  async getConfiguration(): Promise<YouTubePluginSettings>
  async updateConfiguration(settings: Partial<YouTubePluginSettings>): Promise<void>
  validateConfiguration(): ValidationResult

  // AI Providers
  async getAvailableProviders(): Promise<string[]>
  async getProviderModels(provider: string): Promise<string[]>
  async testProvider(provider: string): Promise<ProviderTestResult>

  // Utilities
  async extractVideoId(url: string): Promise<string | null>
  async getVideoMetadata(videoId: string): Promise<VideoData>

  // Performance
  getMetrics(): PerformanceMetrics
  async exportMetrics(): Promise<string>
  clearCache(): void

  // Security
  async setMasterPassword(password: string): Promise<void>
  async changeMasterPassword(oldPassword: string, newPassword: string): Promise<void>
  isSecureStorageEnabled(): boolean
}
```

#### Constructor

```typescript
constructor(config?: APIConfig)
```

**Parameters:**
- `config` (optional): Configuration object for the API

**APIConfig Interface:**
```typescript
interface APIConfig {
  defaultProvider?: string
  defaultFormat?: OutputFormat
  enableCaching?: boolean
  enableLogging?: boolean
  timeout?: number
}
```

**Example:**
```typescript
const api = new YouTubeClipperAPI({
  defaultProvider: 'gemini',
  defaultFormat: 'executive-summary',
  enableCaching: true,
  timeout: 30000
});
```

### VideoProcessingService

Handles video processing operations with advanced features.

```typescript
class VideoProcessingService {
  async processVideo(options: VideoProcessingOptions): Promise<ProcessingResult>
  async processBatch(options: BatchProcessingOptions): Promise<ProcessingResult[]>
  async processParallel(videos: VideoProcessingOptions[]): Promise<ProcessingResult[]>
  async retryFailedProcessing(failedResults: ProcessingResult[]): Promise<ProcessingResult[]>

  // Queue management
  addToQueue(options: VideoProcessingOptions): string
  removeFromQueue(queueId: string): boolean
  getQueueStatus(): QueueStatus

  // Progress tracking
  onProgress(callback: (progress: ProcessingProgress) => void): void
  getProgress(videoId: string): ProcessingProgress | null
}
```

### AIServiceManager

Manages multiple AI providers and routing.

```typescript
class AIServiceManager {
  async processWithProvider(provider: string, options: AIProcessingOptions): Promise<AIResponse>
  async processWithFallback(providers: string[], options: AIProcessingOptions): Promise<AIResponse>
  async processParallel(providers: string[], options: AIProcessingOptions): Promise<AIResponse[]>

  // Provider management
  addProvider(name: string, provider: AIProviderStrategy): void
  removeProvider(name: string): void
  getProvider(name: string): AIProviderStrategy | null
  listProviders(): string[]

  // Load balancing
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void
  getProviderHealth(provider: string): Promise<ProviderHealthStatus>
}
```

---

## Types and Interfaces

### VideoProcessingOptions

Configuration for processing a single video.

```typescript
interface VideoProcessingOptions {
  // Required
  url: string                    // YouTube video URL
  format: OutputFormat          // Analysis format

  // Optional
  customPrompt?: string         // Custom analysis prompt
  provider?: string             // AI provider to use
  model?: string               // Specific model to use
  outputPath?: string           // Custom output path
  maxTokens?: number           // Token limit for AI response
  temperature?: number         // Creativity level (0.0-1.0)
  timeout?: number             // Request timeout in milliseconds

  // Advanced options
  priority?: 'low' | 'normal' | 'high'
  retryCount?: number
  enableCache?: boolean
  metadata?: Record<string, any>
}
```

**OutputFormat Type:**
```typescript
type OutputFormat =
  | 'executive-summary'    // ≤250 words
  | 'detailed-guide'      // ≤8000 words
  | 'brief'              // ≤100 words
  | 'custom'             // Based on custom prompt
  | 'transcript'         // Full transcript
  | 'key-points'         // Bullet points
  | 'action-items'       // Actionable steps
```

### ProcessingResult

Result of video processing operation.

```typescript
interface ProcessingResult {
  // Status
  success: boolean
  error?: string

  // Output
  filePath?: string           // Path to generated note
  content?: string           // Generated content

  // Video information
  videoId?: string            // YouTube video ID
  videoData?: VideoData       // Extracted metadata

  // Processing information
  processingTime?: number     // Time in milliseconds
  provider?: string           // AI provider used
  model?: string              // Model used
  format?: OutputFormat       // Format used

  // Caching
  cacheHit?: boolean         // Was result served from cache

  // Retry information
  attemptCount?: number       // Number of attempts made

  // Timestamps
  startTime?: number         // Processing start time
  endTime?: number           // Processing end time
}
```

### BatchProcessingOptions

Configuration for processing multiple videos.

```typescript
interface BatchProcessingOptions {
  videos: VideoProcessingOptions[]

  // Batch options
  maxConcurrency?: number     // Maximum parallel processes (default: 3)
  continueOnError?: boolean   // Continue processing if one fails
  combineResults?: boolean    // Combine all results into single file

  // Output options
  outputDirectory?: string    // Directory for batch output
  filenameTemplate?: string   // Template for filenames

  // Progress
  onProgress?: (progress: BatchProgress) => void
  onComplete?: (results: ProcessingResult[]) => void
}
```

### VideoData

Metadata extracted from YouTube video.

```typescript
interface VideoData {
  // Basic information
  videoId: string
  title: string
  description: string

  // Video details
  duration: number            // Duration in seconds
  publishDate: string         // ISO 8601 date string
  channelId: string          // Channel ID
  channelTitle: string       // Channel name

  // Media information
  thumbnailUrl: string        // Thumbnail URL
  tags: string[]             // Video tags
  category: string           // Video category

  // Engagement
  viewCount: number          // View count
  likeCount: number          // Like count
  commentCount: number       // Comment count

  // Language
  language: string           // Video language
  defaultLanguage: string    // Default audio language

  // Availability
  embeddable: boolean        // Can be embedded
  publicStatsViewable: boolean // Statistics are public

  // Content details
  contentRating: string      // Content rating
  definition: string         // Video definition (hd, sd)
  caption: string           // Caption availability

  // Custom data
  customData?: Record<string, any>
}
```

### YouTubePluginSettings

Main plugin configuration interface.

```typescript
interface YouTubePluginSettings {
  // AI Provider Configuration
  geminiApiKey?: string
  groqApiKey?: string
  ollamaApiKey?: string
  defaultProvider?: string

  // Security
  useSecureStorage?: boolean
  masterPasswordHash?: string
  useEnvironmentVariables?: boolean
  environmentPrefix?: string

  // Processing
  outputPath?: string
  defaultFormat?: OutputFormat
  customPrompts?: Record<OutputFormat, string>

  // Performance
  performanceMode?: PerformanceMode
  enableParallelProcessing?: boolean
  enableCaching?: boolean
  maxConcurrentProcesses?: number

  // AI Parameters
  defaultMaxTokens?: number
  defaultTemperature?: number

  // Timeouts
  customTimeouts?: CustomTimeoutSettings

  // UI Preferences
  showProgressModal?: boolean
  autoOpenGeneratedNotes?: boolean
  confirmBeforeOverwrite?: boolean
}
```

---

## AI Provider APIs

### AIProviderStrategy

Base class for AI provider implementations.

```typescript
abstract class AIProviderStrategy {
  abstract readonly name: string
  abstract readonly model: string
  abstract readonly capabilities: AIProviderCapabilities

  // Core processing
  abstract process(prompt: string): Promise<string>
  abstract processMultimodal(content: MultimodalContent): Promise<string>

  // Configuration
  abstract setModel(model: string): void
  abstract setMaxTokens(tokens: number): void
  abstract setTemperature(temperature: number): void
  abstract setTimeout(timeout: number): void

  // Capabilities
  abstract getCapabilities(): AIProviderCapabilities
  abstract getAvailableModels(): Promise<string[]>
  abstract validateConfiguration(): boolean

  // Health
  abstract healthCheck(): Promise<ProviderHealthStatus>
}
```

### GeminiProvider

Google Gemini AI provider implementation.

```typescript
class GeminiProvider extends AIProviderStrategy {
  readonly name = 'Google Gemini'
  readonly model = 'gemini-2.5-pro'

  constructor(apiKey: string, model?: string, timeout?: number)

  // Core functionality
  async process(prompt: string): Promise<string>
  async processMultimodal(content: MultimodalContent): Promise<string>

  // Gemini-specific features
  async processVideo(videoData: VideoData, options?: VideoProcessingOptions): Promise<string>
  async generateCode(prompt: string, language?: string): Promise<string>
  async analyzeCode(code: string, language?: string): Promise<CodeAnalysis>

  // Configuration
  setSafetySettings(settings: SafetySettings): void
  setGenerationConfig(config: GenerationConfig): void
}

interface MultimodalContent {
  text: string
  images?: ImageContent[]
  videos?: VideoContent[]
  audio?: AudioContent[]
}

interface SafetySettings {
  harassment: SafetyThreshold
  hateSpeech: SafetyThreshold
  sexuallyExplicit: SafetyThreshold
  dangerousContent: SafetyThreshold
}

type SafetyThreshold = 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE'
```

### GroqProvider

Groq AI provider implementation.

```typescript
class GroqProvider extends AIProviderStrategy {
  readonly name = 'Groq'
  readonly model = 'llama-3.3-70b-versatile'

  constructor(apiKey: string, model?: string, timeout?: number)

  // Core functionality
  async process(prompt: string): Promise<string>

  // Groq-specific features
  async processWithTools(prompt: string, tools: Tool[]): Promise<ToolCallResponse>
  async streamProcess(prompt: string): Promise<AsyncIterable<string>>

  // Model management
  async getAvailableModels(): Promise<string[]>
  async switchModel(model: string): Promise<void>

  // Performance
  async benchmarkModel(model: string): Promise<BenchmarkResult>
}

interface Tool {
  name: string
  description: string
  parameters: ToolParameters
}

interface ToolCallResponse {
  response: string
  toolCalls: ToolCall[]
}
```

### OllamaProvider

Local Ollama provider implementation.

```typescript
class OllamaProvider extends AIProviderStrategy {
  readonly name = 'Ollama'
  readonly model = 'llama3.2'

  constructor(endpoint?: string, model?: string, timeout?: number)

  // Core functionality
  async process(prompt: string): Promise<string>

  // Ollama-specific features
  async processChat(messages: ChatMessage[]): Promise<string>
  async generateEmbedding(text: string): Promise<number[]>

  // Model management
  async listLocalModels(): Promise<LocalModel[]>
  async pullModel(model: string): Promise<void>
  async deleteModel(model: string): Promise<void>

  // System management
  async getSystemInfo(): Promise<SystemInfo>
  async checkHealth(): Promise<OllamaHealthStatus>
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
}

interface LocalModel {
  name: string
  size: number
  modifiedAt: string
  digest: string
}
```

---

## Security APIs

### SecureStorage

Encrypted storage for sensitive data.

```typescript
class SecureStorage {
  constructor(masterPassword: string)

  // Encryption/Decryption
  encrypt(data: string): string
  decrypt(encryptedData: string): string

  // Settings management
  encryptSettings(settings: Partial<YouTubePluginSettings>): EncryptedSettings
  decryptSettings(encryptedSettings: EncryptedSettings): Partial<YouTubePluginSettings>

  // Validation
  validateEncryptionKey(): boolean
  static generateMasterPassword(): string
  static validatePassword(password: string): ValidationResult
}

interface EncryptedSettings {
  encryptedGeminiApiKey?: string
  encryptedGroqApiKey?: string
  encryptedOllamaApiKey?: string
  encryptionVersion: number
  useEnvironmentVariables: boolean
  environmentPrefix: string
}
```

### InputValidator

Input validation and sanitization.

```typescript
class InputValidator {
  // URL validation
  static validateYouTubeURL(url: string): ValidationResult

  // Content validation
  static sanitizeUserInput(input: string, maxLength?: number): ValidationResult
  static sanitizeHTML(html: string): ValidationResult
  static detectMaliciousContent(input: string): ValidationResult

  // API key validation
  static validateAPIKey(apiKey: string, provider: string): ValidationResult

  // File validation
  static validateFilePath(filePath: string): ValidationResult
  static validateFileName(fileName: string, maxLength?: number): ValidationResult

  // Prompt validation
  static validatePrompt(prompt: string, maxLength?: number): ValidationResult

  // Rate limiting
  static validateRateLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number,
    storage?: Map<string, number[]>
  ): ValidationResult
}

interface ValidationResult {
  isValid: boolean
  sanitizedValue?: string
  error?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}
```

---

## Performance APIs

### PerformanceMonitor

Performance monitoring and metrics.

```typescript
class PerformanceMonitor {
  // Timing
  startTiming(operationName: string, category?: string): string
  end(timerId: string, metadata?: any): void

  // Metrics
  getMetrics(): PerformanceMetrics
  getOperationMetrics(operationName: string): OperationMetrics[]
  exportMetrics(): string

  // Health checks
  checkPerformanceHealth(): HealthCheckResult
  getSlowOperations(threshold?: number): SlowOperation[]

  // Monitoring
  enableRealTimeMonitoring(): void
  disableRealTimeMonitoring(): void
  startProfiling(operationName: string): void
  stopProfiling(): ProfileResult
}

interface PerformanceMetrics {
  totalOperations: number
  averageTime: number
  slowOperations: number
  errorRate: number
  cacheHitRate: number
  memoryUsage: number
  uptime: number
}

interface OperationMetrics {
  name: string
  count: number
  averageTime: number
  minTime: number
  maxTime: number
  errorCount: number
  lastExecuted: string
}
```

### IntelligentCache

Advanced caching system with LRU eviction and compression.

```typescript
class IntelligentCache<T = any> {
  constructor(config?: CacheConfig)

  // Basic operations
  get(key: string): T | null
  set(key: string, value: T, ttl?: number): void
  delete(key: string): boolean
  has(key: string): boolean
  clear(): void

  // Advanced operations
  getWithFallback(key: string, fallback: () => Promise<T>): Promise<T>
  setWithCompression(key: string, value: T, ttl?: number): void

  // Statistics
  getStats(): CacheStats
  exportCache(): string
  importCache(data: string): void

  // Memory management
  setSizeLimit(size: number): void
  setTTLLimit(ttl: number): void
  forceCleanup(): void
}

interface CacheConfig {
  maxSize?: number
  defaultTTL?: number
  compressionThreshold?: number
  enableMetrics?: boolean
  cleanupInterval?: number
}

interface CacheStats {
  size: number
  maxSize: number
  hitRate: number
  missCount: number
  hitCount: number
  memoryUsage: number
  oldestEntry?: string
  newestEntry?: string
}
```

---

## Events

### Event System

The plugin emits various events that you can listen to.

```typescript
// Get event emitter
const eventEmitter = api.getEventEmitter();

// Listen to events
eventEmitter.on('video:process-start', (data) => {
  console.log('Processing started:', data.videoId);
});

eventEmitter.on('video:process-complete', (result) => {
  console.log('Processing complete:', result.filePath);
});

eventEmitter.on('video:error', (error) => {
  console.error('Processing error:', error);
});
```

### Available Events

#### Video Processing Events

```typescript
// Processing started
eventEmitter.on('video:process-start', (data: {
  videoId: string
  url: string
  format: OutputFormat
  provider: string
}) => void);

// Progress update
eventEmitter.on('video:progress', (progress: {
  videoId: string
  progress: number    // 0-100
  stage: string       // Current processing stage
  message?: string    // Status message
}) => void);

// Processing completed
eventEmitter.on('video:process-complete', (result: ProcessingResult) => void);

// Processing failed
eventEmitter.on('video:error', (error: {
  videoId: string
  error: string
  provider: string
  retryable: boolean
}) => void);
```

#### Configuration Events

```typescript
// Settings changed
eventEmitter.on('settings:changed', (changes: {
  oldSettings: YouTubePluginSettings
  newSettings: YouTubePluginSettings
  changedKeys: string[]
}) => void);

// Provider added/removed
eventEmitter.on('provider:added', (provider: {
  name: string
  capabilities: AIProviderCapabilities
}) => void);

eventEmitter.on('provider:removed', (provider: {
  name: string
}) => void);
```

---

## Usage Examples

### Basic Video Processing

```typescript
import { YouTubeClipperAPI } from 'youtube-clipper-api';

const api = new YouTubeClipperAPI();

// Process a video with default settings
const result = await api.processVideo({
  url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  format: 'executive-summary'
});

if (result.success) {
  console.log('Generated note:', result.filePath);
  console.log('Processing time:', result.processingTime, 'ms');
} else {
  console.error('Processing failed:', result.error);
}
```

### Custom Prompt Processing

```typescript
const customPrompt = `
Analyze this YouTube video as if you're creating content for a technical blog:
1. Extract key technical concepts
2. Identify practical applications
3. Note any tools or technologies mentioned
4. Suggest related topics for readers

Focus on making the content educational and actionable for developers.
`;

const result = await api.processVideo({
  url: 'https://youtube.com/watch?v=tech-video-id',
  format: 'custom',
  customPrompt: customPrompt,
  provider: 'gemini',
  maxTokens: 4000
});
```

### Batch Processing

```typescript
const videos = [
  {
    url: 'https://youtube.com/watch?v=video1',
    format: 'executive-summary' as const,
    provider: 'gemini'
  },
  {
    url: 'https://youtube.com/watch?v=video2',
    format: 'detailed-guide' as const,
    provider: 'groq'
  },
  {
    url: 'https://youtube.com/watch?v=video3',
    format: 'brief' as const,
    provider: 'gemini'
  }
];

// Process with progress tracking
const results = await api.processBatch({
  videos: videos,
  maxConcurrency: 2,
  onProgress: (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total}`);
    console.log(`Current: ${progress.currentVideo}`);
  },
  onComplete: (results) => {
    const successful = results.filter(r => r.success).length;
    console.log(`Completed: ${successful}/${results.length} videos`);
  }
});
```

---

## Error Handling

### Error Types

```typescript
// Base error class
class YouTubeClipperError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'YouTubeClipperError';
  }
}

// Specific error types
class ValidationError extends YouTubeClipperError {
  constructor(message: string, public field: string) {
    super(message, 'VALIDATION_ERROR', 'medium');
    this.name = 'ValidationError';
  }
}

class APIError extends YouTubeClipperError {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number
  ) {
    super(message, 'API_ERROR', 'high', statusCode !== 401);
    this.name = 'APIError';
  }
}
```

### Error Handling Patterns

```typescript
// Try-catch with specific error handling
try {
  const result = await api.processVideo(options);
  return result;
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed for field:', error.field);
  } else if (error instanceof APIError) {
    console.error('API error with provider:', error.provider);
    if (error.retryable) {
      // Implement retry logic
      return await retryProcessing(options);
    }
  } else {
    console.error('Unexpected error:', error);
  }
  throw error;
}
```

---

## Support

For additional API documentation and support:

- **GitHub Repository:** [youtube-clipper](https://github.com/meeransethi/youtube-clipper)
- **Documentation:** [docs.youtube-clipper.com](https://docs.youtube-clipper.com)
- **Issues:** [GitHub Issues](https://github.com/meeransethi/youtube-clipper/issues)
- **Discussions:** [GitHub Discussions](https://github.com/meeransethi/youtube-clipper/discussions)

---

*API documentation version: 1.3.5*
*Last updated: December 2024*