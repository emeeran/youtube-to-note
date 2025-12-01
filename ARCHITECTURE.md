# YT-Clipper Plugin Architecture

## Overview

YT-Clipper is an Obsidian plugin that transforms YouTube videos into structured, actionable notes using AI-powered analysis. The plugin is built with a modular, service-oriented architecture that prioritizes maintainability, security, and performance.

## Core Architecture

### Service-Oriented Design

The plugin uses a **Service Container** pattern that manages all core services through dependency injection:

```
YoutubeClipperPlugin (Main)
├── ServiceContainer (DI Container)
│   ├── AIService (AI Provider Management)
│   ├── VideoDataService (YouTube Data Extraction)
│   ├── FileService (Obsidian File Operations)
│   ├── CacheService (Performance Optimization)
│   └── PromptService (AI Prompt Engineering)
├── UrlHandler (URL Detection & Processing)
├── ModalManager (UI State Management)
├── Logger (Structured Logging)
├── EncryptionService (Security)
└── PerformanceMonitor (Metrics)
```

### Key Architectural Patterns

1. **Dependency Injection**: ServiceContainer manages all service lifecycles
2. **Factory Pattern**: AI providers are created dynamically based on configuration
3. **Observer Pattern**: Event-driven architecture for UI and file system changes
4. **Strategy Pattern**: Multiple processing formats and performance modes
5. **Repository Pattern**: Abstraction for data access and caching

# Architecture Reference

The full architecture narrative now lives under `docs/ARCHITECTURE.md`. That document consolidates the previous root-level write-up plus the deep-dive maintained in `docs/`, covering:

- Layered system diagram (UI, DI container, services, providers, integrations)
- Component responsibilities for modals, settings surfaces, and Chrome extension hooks
- Service-level contracts (AI, prompt, file, video metadata, retry, cache, logger, encryption)
- Provider adapters (Gemini, Groq, optional Ollama/local providers) and selection logic
- Data flow + error handling patterns, including retry backoff and performance monitoring
- Security considerations for API key handling, file access, and helper bridge deployments

👉 **Go to [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** for the authoritative diagram set, sequence descriptions, and implementation notes referenced by contributors and release engineering checklists.
   ├── Video ID extraction
   └── Duplicate detection

3. Video Data Fetching (VideoDataService)
   ├── Metadata retrieval
   ├── Transcript extraction
   └── Thumbnail fetching

4. AI Processing (AIService)
   ├── Provider selection
   ├── Prompt engineering (PromptService)
   ├── Parallel/sequential processing
   └── Response validation

5. Content Generation (PromptService)
   ├── Format-specific processing
   ├── Template application
   └── Markdown formatting

6. File Operations (FileService)
   ├── Path generation
   ├── File creation
   └── Conflict prevention

7. UI Updates
   ├── Success notifications
   ├── File opening
   └── State cleanup
```

### Settings Management Flow

```
1. Settings Load
   ├── Default settings merge
   ├── Encryption key validation
   └── API key decryption

2. Settings Validation
   ├── Format validation
   ├── Security checks
   └── Dependency verification

3. Service Initialization
   ├── AI provider setup
   ├── Cache initialization
   └── Performance monitoring

4. Runtime Updates
   ├── Real-time configuration changes
   ├── Service re-initialization
   └── State synchronization
```

## Security Architecture

### API Key Management
- **Storage**: Encrypted using AES-GCM with PBKDF2 key derivation
- **Key Rotation**: Supported with automatic re-encryption
- **Backup**: Automatic secure backups before major operations
- **Validation**: Encryption validation on startup

### Input Validation
- **URL Validation**: Comprehensive YouTube URL format checking
- **Content Sanitization**: AI response processing and sanitization
- **Path Validation**: File path traversal protection
- **API Response Validation**: Structured error handling

### Threat Mitigation
- **Rate Limiting**: Built-in retry logic with exponential backoff
- **Error Handling**: Comprehensive error catching and reporting
- **Data Isolation**: Temporary file cleanup and conflict prevention
- **Secure Defaults**: Secure-by-default configuration

## Performance Architecture

### Caching Strategy
- **Memory Cache**: LRU cache for frequently accessed data
- **Model Cache**: Cached AI model information
- **Response Cache**: Configurable response caching
- **Cache Invalidation**: Smart invalidation based on TTL and usage

### Parallel Processing
- **Provider Racing**: Multiple AI providers race for fastest response
- **Concurrent Operations**: Non-blocking I/O operations
- **Resource Management**: Connection pooling and rate limiting
- **Performance Modes**: Fast/Balanced/Quality presets

### Monitoring & Metrics
- **Operation Tracking**: Detailed performance metrics
- **Threshold Alerts**: Configurable performance warnings
- **Statistical Analysis**: Historical performance data
- **Resource Monitoring**: Memory and CPU usage tracking

## Error Handling Architecture

### Retry Logic
- **Exponential Backoff**: Intelligent retry with jitter
- **Provider Failover**: Automatic switching between AI providers
- **Circuit Breaker**: Temporary provider disabling on repeated failures
- **Error Classification**: Distinguish between retryable and fatal errors

### Error Recovery
- **Graceful Degradation**: Fallback to alternative providers
- **State Recovery**: Automatic state cleanup on errors
- **User Feedback**: Clear error messages and suggested actions
- **Error Reporting**: Comprehensive error logging and context

## Testing Architecture

### Test Organization
```
tests/
├── unit/           # Unit tests for individual services
├── integration/    # Integration tests for service interactions
├── e2e/           # End-to-end tests for complete workflows
└── fixtures/      # Test data and mock configurations
```

### Testing Strategy
- **Unit Tests**: Individual service testing with mocked dependencies
- **Integration Tests**: Service interaction testing
- **Performance Tests**: Load testing and performance benchmarking
- **Security Tests**: Encryption and validation testing

## Configuration Architecture

### Settings Schema
```typescript
interface YouTubePluginSettings {
    // API Configuration
    geminiApiKey: string;
    groqApiKey: string;

    // Processing Configuration
    outputPath: string;
    performanceMode: 'fast' | 'balanced' | 'quality';
    enableParallelProcessing: boolean;
    preferMultimodal: boolean;

    // Security Configuration
    useEnvironmentVariables: boolean;
    environmentPrefix: string;

    // Customization
    customPrompts: Record<OutputFormat, string>;
    customTimeouts: CustomTimeoutSettings;

    // Caching
    modelOptionsCache: Record<string, string[]>;
}
```

### Configuration Management
- **Schema Validation**: Type-safe configuration with validation
- **Migration Support**: Automatic settings migration between versions
- **Environment Variables**: Support for environment-based configuration
- **Security Settings**: Encrypted storage for sensitive configuration

## Future Architecture Considerations

### Scalability
- **Plugin System**: Extensible architecture for additional features
- **Provider Support**: Easy addition of new AI providers
- **Format Support**: Extensible output format system
- **Multi-vault Support**: Cross-vault functionality

### Maintainability
- **Service Interfaces**: Clear contracts between services
- **Event System**: Decoupled communication between components
- **Configuration System**: Flexible and extensible configuration
- **Documentation**: Comprehensive API and architecture documentation

This architecture provides a solid foundation for the YT-Clipper plugin, ensuring it remains maintainable, secure, and performant as it evolves.