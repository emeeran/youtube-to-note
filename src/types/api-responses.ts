/**
 * Type definitions for API responses across different providers
 */

/** Base JSON object type for unknown API responses */
export type JsonObject = Record<string, unknown>;

/** Generic API error response */
export interface ApiErrorResponse {
    error?: {
        message?: string;
        code?: number | string;
        status?: string;
        details?: unknown[];
    };
    message?: string;
}

/** Gemini API request body structure */
export interface GeminiRequestBody {
    contents: Array<{
        parts: Array<{
            text?: string;
            fileData?: {
                fileUri: string;
                mimeType: string;
            };
        }>;
    }>;
    generationConfig: {
        temperature: number;
        maxOutputTokens: number;
        candidateCount: number;
    };
    systemInstruction?: {
        parts: Array<{
            text: string;
        }>;
    };
}

/** Gemini API response structure */
export interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
        finishReason: string;
        index?: number;
    }>;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}

/** Groq/OpenAI-compatible API request body */
export interface OpenAICompatibleRequestBody {
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    temperature: number;
    max_tokens: number;
    stream?: boolean;
}

/** Groq/OpenAI-compatible API response */
export interface OpenAICompatibleResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
        index: number;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/** Ollama API request body for generate endpoint */
export interface OllamaGenerateRequestBody {
    model: string;
    prompt: string;
    stream: boolean;
    options: {
        temperature: number;
        num_predict: number;
    };
}

/** Ollama API request body for chat endpoint */
export interface OllamaChatRequestBody {
    model: string;
    messages: Array<{
        role: string;
        content: string;
        images?: string[];
    }>;
    stream: boolean;
    options: {
        temperature: number;
        num_predict: number;
    };
}

/** Ollama API response for generate endpoint */
export interface OllamaGenerateResponse {
    model: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
}

/** Ollama API response for chat endpoint */
export interface OllamaChatResponse {
    model: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    load_duration?: number;
}

/** Ollama models list response */
export interface OllamaModelsResponse {
    models: Array<{
        name: string;
        modified_at: string;
        size?: number;
        id?: string;
    }>;
}

/** Hugging Face API request body */
export interface HuggingFaceRequestBody {
    inputs: string;
    parameters?: {
        temperature?: number;
        max_new_tokens?: number;
        top_p?: number;
        do_sample?: boolean;
    };
    options?: {
        use_cache?: boolean;
        wait_for_model?: boolean;
    };
}

/** Hugging Face API response */
export interface HuggingFaceResponse {
    generated_text?: string;
    error?: string;
}

/** YouTube metadata response */
export interface YouTubeMetadataResponse {
    title: string;
    author_name: string;
    author_url: string;
    type: string;
    version: string;
    provider_name: string;
    provider_url: string;
    thumbnail_url: string;
    thumbnail_width: number;
    thumbnail_height: number;
    html?: string;
    width?: number;
    height?: number;
}

/** Generic video metadata from external sources */
export interface VideoMetadata {
    title: string;
    description?: string;
    author?: string;
    duration?: number;
    uploadDate?: string;
    thumbnailUrl?: string;
    viewCount?: number;
    tags?: string[];
}

/** Batch processing result */
export interface BatchProcessingResult {
    success: boolean;
    processed: number;
    failed: number;
    results: Array<{
        url: string;
        success: boolean;
        filePath?: string;
        error?: string;
    }>;
}

/** Pipeline stage context */
export interface PipelineContext {
    videoUrl: string;
    videoData?: VideoMetadata;
    transcript?: string;
    options?: {
        format: string;
        useMultimodal: boolean;
        customPrompt?: string;
    };
    metadata?: Record<string, unknown>;
}

/** Middleware context */
export interface MiddlewareContext {
    request: {
        url: string;
        headers?: Record<string, string>;
        body?: unknown;
    };
    response?: {
        status: number;
        headers?: Record<string, string>;
        body?: unknown;
    };
    metadata?: Record<string, unknown>;
}

/** Retry options */
export interface RetryOptions {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: string[];
}

/** Circuit breaker state */
export interface CircuitBreakerState {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime?: number;
    nextAttemptTime?: number;
}

/** Cache entry */
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    ttl?: number;
}

/** Performance metrics */
export interface PerformanceData {
    duration: number;
    timestamp: number;
    operation: string;
    success: boolean;
    metadata?: Record<string, unknown>;
}

/** Service health status */
export interface ServiceHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: number;
    responseTime?: number;
    errorRate?: number;
}

/** Provider model list response */
export interface ProviderModelsResponse {
    provider: string;
    models: Array<{
        name: string;
        displayName?: string;
        supportsAudioVideo?: boolean;
        contextLength?: number;
    }>;
    timestamp: number;
}

/** Ollama model from API response */
export interface OllamaModel {
    name: string;
    id?: string;
    model?: string;
    modified_at?: string;
    size?: number;
}

/** OpenRouter model from API response */
export interface OpenRouterModel {
    id: string;
    name?: string;
    context_length?: number;
    pricing?: {
        prompt?: string;
        completion?: string;
    };
}

/** Hugging Face model from API response */
export interface HuggingFaceModel {
    id: string;
    modelId?: string;
    disabled?: boolean;
    private?: boolean;
}

/** Groq model from API response */
export interface GroqModel {
    id: string;
    name?: string;
    owned_by?: string;
}

/** Gemini model from API response */
export interface GeminiModel {
    name: string;
    id?: string;
    displayName?: string;
    description?: string;
}
