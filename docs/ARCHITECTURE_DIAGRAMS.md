# YT-Clipper Architecture Diagrams

## System Architecture Overview

```mermaid
graph TB
    User[User] --> UI[Presentation Layer]
    UI --> Application[Application Layer]
    Application --> Domain[Domain Layer]
    Application --> Infrastructure[Infrastructure Layer]

    Domain --> AI[AI Services]
    Domain --> Video[Video Services]
    Domain --> Content[Content Services]

    Infrastructure --> Cache[Caching Layer]
    Infrastructure --> HTTP[HTTP Client]
    Infrastructure --> FileSystem[File System]

    UI --> Core[Core Plugin]
    Core --> Lifecycle[Lifecycle Manager]
    Core --> Registry[UI Registry]
```

## 5-Stage Pipeline Architecture

```mermaid
graph LR
    Input[Input] --> S1[Stage 1: Ingestion]
    S1 --> S2[Stage 2: Validation]
    S2 --> S3[Stage 3: Enrichment]
    S3 --> S4[Stage 4: Processing]
    S4 --> S5[Stage 5: Persistence]
    S5 --> Output[Output]

    style S1 fill:#e1f5fe
    style S2 fill:#fff3e0
    style S3 fill:#f3e5f5
    style S4 fill:#e8f5e9
    style S5 fill:#fce4ec
```

## Pipeline Stage Details

### Stage 1: Ingestion
```mermaid
graph TD
    A[Raw Input] --> B{Detect Source}
    B -->|Clipboard| C[Extract URL]
    B -->|Protocol| C
    B -->|File Monitor| C
    B -->|Extension| C
    B -->|Manual| C
    C --> D[Add Metadata]
    D --> E[Output: URL + Source]
```

### Stage 2: Validation
```mermaid
graph TD
    A[URL] --> B{Valid Format?}
    B -->|No| C[Error: Invalid URL]
    B -->|Yes| D[Extract Video ID]
    D --> E{Video ID Found?}
    E -->|No| C
    E -->|Yes| F[Sanitize URL]
    F --> G{Config Valid?}
    G -->|No| H[Warning: No API Keys]
    G -->|Yes| I[Output: Validated]
```

### Stage 3: Enrichment
```mermaid
graph TD
    A[Video ID] --> B{Cache Hit?}
    B -->|Yes| C[Return Cached]
    B -->|No| D[Fetch Metadata]
    D --> E[Fetch Transcript]
    E --> F[Generate Thumbnail URL]
    F --> G[Cache Results]
    G --> H[Output: Enriched Data]
```

### Stage 4: Processing
```mermaid
graph TD
    A[Video Data] --> B[Create Prompt]
    B --> C[Select Provider]
    C --> D[Execute AI Call]
    D --> E{Success?}
    E -->|Yes| F[Format Response]
    E -->|No| G{Try Fallback?}
    G -->|Yes| H[Try Next Model]
    H --> D
    G -->|No| I[Try Next Provider]
    I --> D
    F --> J[Output: Generated Content]
```

### Stage 5: Persistence
```mermaid
graph TD
    A[Content] --> B[Generate File Path]
    B --> C{File Exists?}
    C -->|Yes| D[Add Timestamp]
    C -->|No| E[Use Original]
    D --> F[Format with YAML]
    E --> F
    F --> G[Write to Vault]
    G --> H[Update Cache]
    H --> I[Output: File Path]
```

## AI Service Architecture

```mermaid
graph TB
    AIService[AIService Facade] --> Orchestrator[AI Orchestrator]
    Orchestrator --> ProviderMgr[Provider Manager]
    Orchestrator --> Fallback[Fallback Strategy]

    ProviderMgr --> Providers[AI Providers]
    Providers --> Gemini[Gemini]
    Providers --> Groq[Groq]
    Providers --> Ollama[Ollama]
    Providers --> HF[HuggingFace]
    Providers --> OR[OpenRouter]

    Fallback --> ModelFallback[Model Fallback]
    Fallback --> ProviderFallback[Provider Fallback]

    style AIService fill:#e3f2fd
    style Orchestrator fill:#bbdefb
    style ProviderMgr fill:#90caf9
    style Fallback fill:#81d4fa
```

## Component Architecture

```mermaid
graph TB
    subgraph "Presentation Layer"
        Modal[YouTubeUrlModal]
        Batch[BatchVideoModal]
        Settings[SettingsTab]
        Components[Reusable Components]
    end

    subgraph "Application Layer"
        Pipeline[Pipeline Orchestrator]
        UseCases[Use Cases]
        Adapters[Adapters]
    end

    subgraph "Domain Layer"
        AI[AI Domain]
        Video[Video Domain]
        Content[Content Domain]
    end

    Modal --> Components
    Modal --> UseCases
    Batch --> UseCases
    Settings --> Core

    UseCases --> Pipeline
    Adapters --> AI
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant M as Modal
    participant P as Pipeline
    participant AI as AI Service
    participant FS as File System

    U->>M: Input URL
    M->>P: execute(url)

    P->>P: Stage 1: Ingestion
    P->>P: Stage 2: Validation
    P->>P: Stage 3: Enrichment
    P->>AI: Stage 4: Processing
    AI-->>P: Generated Content
    P->>FS: Stage 5: Persistence
    FS-->>P: File Path

    P-->>M: Result
    M-->>U: Success Notice
```

## Directory Structure

```
src/
├── core/                          # Core plugin management
│   ├── lifecycle.ts               # Load/unload handling
│   └── registry.ts                # UI registration
│
├── domain/                        # Business logic
│   ├── ai/                        # AI domain
│   │   ├── ai-orchestrator.ts     # Main AI orchestration
│   │   ├── provider-manager.ts    # Provider management
│   │   └── fallback-strategy.ts   # Fallback logic
│   ├── video/                     # Video domain
│   └── content/                   # Content domain
│
├── infrastructure/                # External services
│   ├── persistence/               # Data persistence
│   ├── http/                      # HTTP client
│   └── observability/             # Logging & metrics
│
├── presentation/                  # UI layer
│   ├── modals/                    # Modal components
│   ├── settings/                  # Settings UI
│   └── components/                # Reusable UI components
│       ├── url-input.component.ts
│       └── progress-indicator.component.ts
│
├── application/                   # Application services
│   ├── pipeline/                  # 5-stage pipeline
│   │   ├── orchestrator.ts
│   │   ├── stages/
│   │   └── middleware.ts
│   ├── adapters/                  # Compatibility adapters
│   └── use-cases/                 # Business use cases
│
└── shared/                        # Shared utilities
    ├── types/                     # Type definitions
    ├── utils/                     # Utilities
    └── constants/                 # Constants
```

## Deployment Architecture

```mermaid
graph LR
    Dev[Development] --> Git[Git Repository]
    Git --> Test[Testing Branch]
    Test --> Main[Main Branch]
    Main --> Release[Release Tag]
    Release --> Plugin[Obsidian Plugin Release]

    style Dev fill:#e8f5e9
    style Test fill:#fff3e0
    style Main fill:#e3f2fd
    style Release fill:#f3e5f5
    style Plugin fill:#fce4ec
```

## Performance Optimization Architecture

```mermaid
graph TB
    subgraph "Optimization Layers"
        Cache[Caching Layer]
        Parallel[Parallel Processing]
        Pool[Service Pooling]
    end

    Cache --> LRU[LRU Cache]
    Cache --> TTL[TTL-based Expiration]

    Parallel --> Racing[Provider Racing]
    Parallel --> Concurrent[Concurrent Operations]

    Pool --> Services[Service Reuse]
    Pool --> Cleanup[Auto Cleanup]

    style Cache fill:#c8e6c9
    style Parallel fill:#fff59d
    style Pool fill:#ce93d8
```

## Error Handling Architecture

```mermaid
graph TD
    Error[Error Occurred] --> Handler[Error Handler]
    Handler --> Logger[Log Error]
    Handler --> Notice[Show User Notice]
    Handler --> Recovery{Can Recover?}

    Recovery -->|Yes| Fallback[Try Fallback]
    Recovery -->|No| Fail[Graceful Failure]

    Fallback --> Success{Success?}
    Success -->|Yes| Continue[Continue Processing]
    Success -->|No| Fail

    style Error fill:#ef5350
    style Handler fill:#ffa726
    style Recovery fill:#66bb6a
    style Fail fill:#ef5350
```

## Testing Architecture

```mermaid
graph TB
    subgraph "Test Suite"
        Unit[Unit Tests]
        Integration[Integration Tests]
        Visual[Visual Regression Tests]
        E2E[E2E Tests]
        Load[Load Tests]
    end

    Unit --> Coverage[Coverage Report]
    Integration --> Metrics[Test Metrics]
    Visual --> Screenshots[Screen Shots]
    Load --> Performance[Performance Report]

    style Unit fill:#42a5f5
    style Integration fill:#26c6da
    style Visual fill:#ab47bc
    style E2E fill:#ef5350
    style Load fill:#ffa726
```

## Migration Path

```mermaid
graph LR
    Old[Legacy Code] --> Refactor[Refactor]
    Refactor --> Test[Test]
    Test --> Verify[Verify UI Preserved]
    Verify --> Commit[Commit Changes]
    Commit --> Merge[Merge to Main]

    style Old fill:#bdbdbd
    style Refactor fill:#81c784
    style Test fill:#64b5f6
    style Verify fill:#9575cd
    style Commit fill:#f06292
    style Merge fill:#4db6ac
```
