/* eslint-disable max-lines */
import { ErrorHandler } from './services/error-handler';
import { logger, LogLevel } from './services/logger';
import { MESSAGES } from './constants/index';
import { ModalManager } from './services/modal-manager';
import {
    AIResponse,
    AIService,
    PerformanceMode,
    ProcessStage,
    ProcessingOptions,
    ProcessingResult,
    TranscriptFailureReason,
    TranscriptSegment,
    VideoDataService,
    YouTubePluginSettings,
} from './types';
import { ServiceContainer } from './services/service-container';
import { UrlHandler, UrlDetectionResult } from './services/url-handler';
import { ValidationUtils } from './validation';
import { YouTubeSettingsTab } from './settings-tab';
import { YouTubeUrlModal } from './components/features/youtube';
import { ProcessingHistoryService, withPluginDataLock } from './services/processing-history';
import { SecureConfigService } from './secure-config';
import { MAX_TRANSCRIPT_CHARS } from './services/transcript-service';
import { Notice, Plugin, TFile } from 'obsidian';

const PLUGIN_PREFIX = 'ytp';

/**
 * A single processYouTubeVideo run: the shared {@link ProcessingOptions}
 * contract, plus the per-run knobs the modal used to pass positionally. The
 * extras are optional, so callers passing only the shared contract keep working.
 */
interface ProcessRunOptions extends ProcessingOptions {
    performanceMode?: PerformanceMode;
    maxTokens?: number;
    temperature?: number;
    enableAutoFallback?: boolean;
}

/**
 * Thrown (internally) when a run is aborted. Caught at the top of
 * processYouTubeVideo and turned into a clean result, not an error notice.
 */
class ProcessingCancelled extends Error {
    constructor() {
        super('Processing cancelled');
        this.name = 'ProcessingCancelled';
    }
}

/** User-facing copy per typed transcript failure, as distinct as the reasons. */
const TRANSCRIPT_FAILURE_MESSAGES: Record<TranscriptFailureReason, string> = {
    restricted: '🔒 Age/region restricted — YouTube will not serve captions for this video.',
    private: '🔒 This video is private, so its transcript is unavailable.',
    unavailable: '🔍 This video is unavailable — it may have been removed, or the link is wrong.',
    'no-captions': '🚫 No captions available for this video',
    network: '🌐 Network error while fetching the transcript. Check your connection and try again.',
    unknown: '⚠️ Transcript could not be fetched for this video.',
};

const NO_CAPTIONS_MESSAGE = TRANSCRIPT_FAILURE_MESSAGES['no-captions'];

const METADATA_ONLY_WARNING =
    'No captions available — the note was generated from video metadata only, so it may be thin.';

/**
 * Warning for the transcript *source* ceiling (transcript-service stops reading
 * segments past this many characters). Distinct from the per-format prompt
 * budget, which PromptService reports through `onTruncated` with real numbers.
 */
const transcriptSourceCapWarning = (limit: number): string =>
    `Transcript capped at the source ceiling of ${limit.toLocaleString()} characters — ` +
    'the analysis covers the first portion only.';

/** Warning for PromptService trimming the transcript to a format's budget. */
const transcriptTrimmedWarning = (info: { budget: number; originalLength: number }): string =>
    `Transcript trimmed to the first ${info.budget.toLocaleString()} of ` +
    `${info.originalLength.toLocaleString()} characters for this format.`;

/**
 * Per-provider failure reasons are shortened before they are joined into the
 * aggregate "All AI providers failed" message. Generous enough to keep e.g.
 * Ollama's full `ollama pull <model>` command intact, small enough that six
 * reasons stay readable in a Notice.
 */
const MAX_PROVIDER_REASON_CHARS = 240;
/** Hard ceiling for the joined aggregate message. */
const MAX_AGGREGATE_ERROR_CHARS = 1500;

/** Credential fields in plugin data, with the short label used in the redacted log. */
const SECRET_SETTING_KEYS: ReadonlyArray<[keyof YouTubePluginSettings, string]> = [
    ['geminiApiKey', 'gemini'],
    ['groqApiKey', 'groq'],
    ['ollamaApiKey', 'ollama'],
    ['huggingFaceApiKey', 'huggingFace'],
    ['openRouterApiKey', 'openRouter'],
];

/**
 * Summarize plugin data without logging a single value: which credentials are
 * set, plus the *names* (never the contents) of everything else stored.
 */
function redactPluginData(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== 'object') return {};

    const record = data as Record<string, unknown>;
    const keys: Record<string, boolean> = {};
    for (const [key, label] of SECRET_SETTING_KEYS) {
        const value = record[key];
        keys[label] = typeof value === 'string' && value.length > 0;
    }

    const known = new Set<string>(SECRET_SETTING_KEYS.map(([key]) => key as string));
    const otherKeys = Object.keys(record)
        .filter(name => !known.has(name))
        .sort();

    return {
        keys,
        useEnvironmentVariables: record['useEnvironmentVariables'] === true,
        otherKeys,
    };
}

const DEFAULT_SETTINGS: YouTubePluginSettings = {
    geminiApiKey: '',
    groqApiKey: '',
    ollamaApiKey: '',
    ollamaEndpoint: 'http://localhost:11434',
    huggingFaceApiKey: '',
    openRouterApiKey: '',
    outputPath: 'YouTube/Processed Videos',
    useEnvironmentVariables: false,
    environmentPrefix: 'YTC',
    performanceMode: 'balanced',
    enableAutoFallback: true,
    preferMultimodal: true,
    transcriptLanguage: '',
    includeTimestamps: true,
    warnOnDuplicates: true,
    persistTranscriptCache: false,
    customPrompts: {},
    defaultMaxTokens: 4096,
    defaultTemperature: 0.5,
};

export default class YoutubeClipperPlugin extends Plugin {
    private _settings: YouTubePluginSettings = DEFAULT_SETTINGS;
    private serviceContainer?: ServiceContainer;
    private ribbonIcon?: HTMLElement | null;
    private isUnloading = false;
    private operationCount = 0;
    private urlHandler?: UrlHandler;
    private modalManager?: ModalManager;
    private historyService?: ProcessingHistoryService;
    /** Controllers of runs that had no signal of their own, aborted on unload. */
    private readonly activeRunControllers = new Set<AbortController>();

    async onload(): Promise<void> {
        // Version comes from manifest.json — never hardcode it here.
        logger.info(`Initializing YoutubeClipper Plugin v${this.manifest.version}...`);

        try {
            await this.loadSettings();
            this.setupLogger();
            await this.initializeServices();
            this.registerUIComponents();
            this.setupUrlHandling();
            this.setupProtocolHandler();

            logger.plugin('Plugin loaded successfully');
        } catch (error) {
            logger.error('Failed to load plugin', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
            ErrorHandler.handle(error as Error, 'Plugin initialization');
            new Notice('Failed to load YoutubeClipper Plugin. Check console for details.');
        }
    }

    onunload(): void {
        logger.plugin('Unloading YoutubeClipper Plugin...');
        this.isUnloading = true;

        try {
            // Cancel in-flight runs so their fetches and writes stop immediately.
            for (const controller of this.activeRunControllers) {
                controller.abort();
            }
            this.activeRunControllers.clear();
            this.urlHandler?.clear();
            this.modalManager?.clear();
            this.serviceContainer?.clearServices();
            this.cleanupUIElements();

            logger.plugin('Plugin unloaded successfully');
        } catch (error) {
            logger.error('Error during plugin unload', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private setupLogger(): void {
        // Dev builds get debug-level logging; production keeps the INFO default.
        const isDev = process.env.NODE_ENV === 'development';
        logger.updateConfig({ level: isDev ? LogLevel.DEBUG : LogLevel.INFO });
    }

    private async initializeServices(): Promise<void> {
        // `manifest.dir` scopes the opt-in on-disk transcript cache to this plugin.
        this.serviceContainer = new ServiceContainer(this._settings, this.app, this.manifest.dir);
        this.modalManager = new ModalManager();
        this.urlHandler = new UrlHandler(this.app, this._settings, this.handleUrlDetection.bind(this));
        this.historyService = new ProcessingHistoryService(this);
        await this.historyService.loadAsync();
    }

    private setupUrlHandling(): void {
        if (!this.urlHandler) return;

        const urlHandler = this.urlHandler;

        // Register file creation handler
        this.registerEvent(
            this.app.vault.on('create', file => {
                if (file instanceof TFile) {
                    void this.safeOperation(() => urlHandler.handleFileCreate(file), 'Handle file create');
                }
            }),
        );

        // Register active leaf change handler
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                void this.safeOperation(() => urlHandler.handleActiveLeafChange(), 'Handle active leaf change');
            }),
        );
    }

    private setupProtocolHandler(): void {
        try {
            this.registerObsidianProtocolHandler('youtube-clipper', params => {
                // `params` is attacker-controlled (any web page can open the
                // obsidian:// URL) — never log it verbatim, the video id is enough.
                const raw = params.url ?? params.content ?? params.path ?? '';
                logger.info('[YT-Clipper] Protocol received', 'Plugin', {
                    videoId: ValidationUtils.extractVideoId(raw) ?? '',
                });
                this.urlHandler?.handleProtocol(params);
            });
            logger.info('[YT-Clipper] Protocol handler registered successfully', 'Plugin');
        } catch (error) {
            logger.error('[YT-Clipper] Protocol handler registration failed:', 'Plugin', { error });
            logger.debug('Protocol handler not available', 'Plugin');
        }
    }

    private registerUIComponents(): void {
        this.ribbonIcon = this.addRibbonIcon('youtube', 'Process YouTube Video', () => {
            logger.info('[YT-CLIPPER] Ribbon icon clicked', 'Plugin');
            void this.safeShowUrlModal();
        });

        logger.plugin('Ribbon icon set successfully');

        this.addCommand({
            id: `${PLUGIN_PREFIX}-process-youtube-video`,
            name: 'Process YouTube Video',
            callback: () => {
                logger.info('[YT-CLIPPER] Process command triggered', 'Plugin');
                void this.safeShowUrlModal();
            },
        });

        this.addSettingTab(
            new YouTubeSettingsTab(this.app, {
                plugin: this,
                onSettingsChange: this.handleSettingsChange.bind(this),
            }),
        );

        this.addCommand({
            id: `${PLUGIN_PREFIX}-open-url-from-clipboard`,
            name: 'YouTube Clipper: Open URL Modal (from clipboard)',
            callback: async () => {
                await this.handleClipboardUrl();
            },
        });

        this.addCommand({
            id: `${PLUGIN_PREFIX}-clear-transcript-cache`,
            name: 'Clear transcript cache',
            callback: async () => {
                if (!this.serviceContainer) {
                    return;
                }
                await this.serviceContainer.clearTranscriptCache();
                new Notice('🧹 Transcript cache cleared.');
                logger.plugin('Transcript cache cleared via command');
            },
        });
    }

    private cleanupUIElements(): void {
        if (this.ribbonIcon) {
            this.ribbonIcon.remove();
            this.ribbonIcon = null;
        }
    }

    private handleUrlDetection(result: UrlDetectionResult): void {
        logger.info('URL detected, opening modal', 'Plugin', {
            url: result.url,
            source: result.source,
            filePath: result.filePath,
        });
        void this.safeShowUrlModal(result.url);
    }

    private async handleClipboardUrl(): Promise<void> {
        try {
            if (!this.urlHandler) return;

            await this.urlHandler.handleClipboardUrl();

            // If no URL found in clipboard, prompt user
            // eslint-disable-next-line no-alert
            const manual = window.prompt('Paste YouTube URL to open in YouTube Clipper:');
            if (manual && ValidationUtils.isValidYouTubeUrl(manual.trim())) {
                void this.safeShowUrlModal(manual.trim());
            } else {
                new Notice('No valid YouTube URL provided.');
            }
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Open URL from clipboard');
        }
    }

    private async safeShowUrlModal(initialUrl?: string): Promise<void> {
        logger.debug('[YT-CLIPPER] safeShowUrlModal called', 'Plugin', {
            initialUrl,
            hasModalManager: !!this.modalManager,
            hasServiceContainer: !!this.serviceContainer,
            modalState: this.modalManager?.getState?.(),
        });

        if (!this.modalManager || !this.serviceContainer) {
            logger.error('[YT-CLIPPER] Cannot show modal - missing services', 'Plugin');
            return;
        }

        // Direct modal opening for reliability
        try {
            await this.openYouTubeUrlModal(initialUrl);
        } catch (error) {
            logger.error('[YT-CLIPPER] Failed to open modal:', 'Plugin', { error });
        }
    }

    // eslint-disable-next-line max-lines-per-function
    private async openYouTubeUrlModal(initialUrl?: string): Promise<void> {
        logger.debug('[YT-CLIPPER] openYouTubeUrlModal called', 'Plugin', { initialUrl });
        if (this.isUnloading) {
            logger.info('Plugin is unloading, ignoring modal request');
            return;
        }

        // eslint-disable-next-line max-lines-per-function
        try {
            if (!this.serviceContainer) return;

            const aiService = this.serviceContainer.aiService;
            const providers = aiService ? aiService.getProviderNames() : [];
            // Use cached models if available, modal will auto-fetch from API on open
            const modelOptionsMap: Record<string, string[]> = this._settings.modelOptionsCache ?? {};

            const modal = new YouTubeUrlModal(this.app, {
                onProcess: (url: string, runOptions?: ProcessingOptions) => this.processYouTubeVideo(url, runOptions),
                onOpenFile: this.openFileByPath.bind(this),
                ...(initialUrl && { initialUrl }),
                providers,
                defaultMaxTokens: this._settings.defaultMaxTokens,
                defaultTemperature: this._settings.defaultTemperature,
                modelOptions: modelOptionsMap,
                fetchModels: async () => {
                    try {
                        if (!this.serviceContainer) {
                            return modelOptionsMap;
                        }
                        const aiService = this.serviceContainer.aiService;
                        const map = await aiService.fetchLatestModels();
                        this._settings.modelOptionsCache = map;

                        await this.saveSettings();
                        return map;
                    } catch (error) {
                        return modelOptionsMap;
                    }
                },
                fetchModelsForProvider: async (provider: string, forceRefresh = false) => {
                    try {
                        if (!this.serviceContainer) {
                            return [];
                        }
                        const aiService = this.serviceContainer.aiService;
                        const models = await aiService.fetchLatestModelsForProvider(provider, forceRefresh);
                        if (models && models.length > 0) {
                            // Update model cache
                            this._settings.modelOptionsCache = {
                                ...this._settings.modelOptionsCache,
                                [provider]: models,
                            };

                            await this.saveSettings();
                        }
                        return models;
                    } catch (error) {
                        return [];
                    }
                },
                enableAutoFallback: this._settings.enableAutoFallback ?? true,
                onModalClosed: () => this.modalManager?.notifyClosed(),
            });

            if (!this.modalManager?.beginOpen()) {
                new Notice('📝 YouTube to Note is already open — finish or close that one first.');
                return;
            }
            modal.open();
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Opening YouTube URL modal');
        }
    }

    /**
     * Turn a YouTube URL into a note in the vault.
     *
     * Never throws: every outcome — success, failure and cancellation — comes
     * back as a {@link ProcessingResult} so the caller can render it.
     *
     * @param url YouTube video URL
     * @param options Per-run overrides, progress callback and abort signal
     */
    // eslint-disable-next-line max-lines-per-function, complexity
    async processYouTubeVideo(url: string, options: ProcessRunOptions = {}): Promise<ProcessingResult> {
        const {
            format = 'executive-summary',
            model,
            providerName,
            performanceMode,
            maxTokens,
            temperature,
            enableAutoFallback,
            userInstructions,
            onProgress,
            signal: externalSignal,
        } = options;

        if (this.isUnloading) {
            logger.warn('Plugin is unloading — ignoring video processing request', 'Plugin');
            return { success: false, error: 'Plugin is shutting down' };
        }

        // One controller per run. An external signal (modal close) aborts it;
        // with no external signal, onunload owns the abort instead.
        const controller = new AbortController();
        const signal = controller.signal;
        const onExternalAbort = () => controller.abort();
        if (externalSignal) {
            if (externalSignal.aborted) controller.abort();
            else externalSignal.addEventListener('abort', onExternalAbort);
        } else {
            this.activeRunControllers.add(controller);
        }

        const result: ProcessingResult = { success: false };
        const warnings: string[] = [];
        result.warnings = warnings;

        let userNotified = false;

        /** Throws once the run has been cancelled. */
        const assertLive = (): void => {
            if (signal.aborted) throw new ProcessingCancelled();
        };

        const progress = (stage: ProcessStage, detail?: string): void => {
            if (!onProgress) return;
            try {
                onProgress({ stage, detail });
            } catch (error) {
                logger.warn('Progress callback failed', 'Plugin', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        };

        try {
            assertLive();
            new Notice(MESSAGES.PROCESSING);

            const validation = ValidationUtils.validateSettings(this._settings as unknown as Record<string, unknown>);
            if (!validation.isValid) {
                throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`);
            }

            if (!this.serviceContainer) throw new Error('Service container not initialized');

            const { videoService, aiService, fileService, promptService } = this.serviceContainer;

            const videoId = videoService.extractVideoId(url);
            if (!videoId) {
                throw new Error(MESSAGES.ERRORS.VIDEO_ID_EXTRACTION);
            }

            // Duplicate check, before any AI work. Warn and continue — never block.
            const existing = this.historyService?.find(videoId);
            if (existing && this._settings.warnOnDuplicates !== false) {
                result.duplicateOfPath = existing.filePath;
                const processedOn = new Date(existing.processedAt);
                const when = Number.isNaN(processedOn.getTime()) ? 'an unknown date' : processedOn.toLocaleDateString();
                warnings.push(`This video was already processed on ${when} — a duplicate note may be created`);
                new Notice(`ℹ️ Duplicate: this video was already processed on ${when}.`);
            }

            progress('metadata', 'Fetching video metadata…');
            const videoData = await videoService.getVideoData(videoId, signal);
            assertLive();

            progress('transcript', 'Fetching transcript…');
            const transcript = await this.fetchTranscript(videoService, videoId, signal);
            assertLive();
            if (!transcript.ok) {
                result.error = transcript.error;
                return result;
            }
            if (!transcript.fullText) {
                warnings.push(METADATA_ONLY_WARNING);
            }
            if (transcript.truncated) {
                // The source ceiling fired inside the transcript service.
                result.transcriptTruncated = true;
                warnings.push(transcriptSourceCapWarning(MAX_TRANSCRIPT_CHARS));
            }

            // Segments are only handed over when timestamp links are enabled.
            const segments = this._settings.includeTimestamps !== false ? transcript.segments : undefined;

            // Set as soon as PromptService trims the transcript to this format's
            // budget — the real numbers, not a guess.
            const onTruncated = (info: { budget: number; originalLength: number }): void => {
                result.transcriptTruncated = true;
                warnings.push(transcriptTrimmedWarning(info));
            };

            progress('prompt', 'Building prompt…');
            const prompt = promptService.createAnalysisPrompt({
                videoData,
                videoUrl: url,
                format,
                transcript: transcript.fullText,
                segments,
                performanceMode: performanceMode ?? this._settings.performanceMode ?? 'balanced',
                providerName,
                userInstructions,
                customPrompts: this._settings.customPrompts,
                onTruncated,
            });

            // Per-request generation parameters travel with the request, so two
            // concurrent runs cannot clobber each other's provider state.
            const effectiveMaxTokens = maxTokens ?? this._settings.defaultMaxTokens;
            const effectiveTemperature = temperature ?? this._settings.defaultTemperature;

            logger.aiService('Processing video', {
                videoId,
                format,
                provider: providerName ?? 'Auto',
                model: model ?? 'Default',
                maxTokens: effectiveMaxTokens,
                temperature: effectiveTemperature,
            });

            progress('ai', 'Contacting AI providers…');
            const chain = this.buildProviderChain(
                providerName,
                aiService,
                enableAutoFallback ?? this._settings.enableAutoFallback ?? true,
            );
            const failedProviders: string[] = [];
            const failedReasons = new Map<string, string>();
            let aiResponse: AIResponse | undefined;
            let lastError: unknown;

            // A model override is provider-specific: the user's Gemini model name
            // must NOT be sent to Ollama/OpenRouter/etc. when the chain falls
            // back — each fallback provider uses its own default model.
            const [primaryProvider] = chain;
            const modelOverrideFor = (provider: string): string | undefined => {
                if (!model) return undefined;
                // Explicit selection: the override rides with the chosen provider.
                if (providerName) return provider === primaryProvider ? model : undefined;
                // Auto mode: only hand the model to a provider that actually
                // offers it (per its known model list) — otherwise a Gemini
                // model name would land on Groq and fail spuriously.
                const known = aiService.getProviderModels(provider);
                return Array.isArray(known) && known.includes(model) ? model : undefined;
            };

            // The fallback chain is driven here rather than inside the AI service
            // so each provider's failure can be attributed in the result.
            for (const name of chain) {
                assertLive();
                progress('ai', `Trying ${name}…`);
                try {
                    aiResponse = await aiService.processWith(name, prompt, modelOverrideFor(name), undefined, false, {
                        signal,
                        maxTokens: effectiveMaxTokens,
                        temperature: effectiveTemperature,
                    });
                    break;
                } catch (error) {
                    if (signal.aborted) throw new ProcessingCancelled();
                    failedProviders.push(name);
                    const message = (error instanceof Error ? error.message : String(error)).slice(
                        0,
                        MAX_PROVIDER_REASON_CHARS,
                    );
                    failedReasons.set(name, message);
                    lastError = error;
                    logger.warn('Provider failed — trying the next one', 'Plugin', {
                        provider: name,
                        error: message,
                    });
                }
            }

            if (!aiResponse) {
                // Surface WHY each provider failed, not just the last one's
                // message — the tail of the chain is usually the least
                // informative (e.g. local Ollama missing a model).
                const summary =
                    [...failedReasons.entries()].map(([name, message]) => `${name}: ${message}`).join(' · ') ||
                    'no provider was attempted';
                const error = lastError instanceof Error ? lastError : new Error('All AI providers failed');
                const full = `All AI providers failed — ${summary}`;
                // Cut on a word boundary so the tail never ends mid-word.
                const truncated =
                    full.length > MAX_AGGREGATE_ERROR_CHARS
                        ? `${full.slice(0, MAX_AGGREGATE_ERROR_CHARS).replace(/\s+\S*$/, '')}…`
                        : full;
                const enriched = new Error(truncated);
                logger.error('AI Processing failed', 'Plugin', { error: error.message, summary });
                result.failedProviders = failedProviders;
                result.error = enriched.message;
                userNotified = true;
                ErrorHandler.handleEnhanced(enriched, 'AI Processing');
                throw enriched;
            }

            logger.aiService('AI Response received', {
                provider: aiResponse.provider,
                model: aiResponse.model,
                contentLength: aiResponse.content?.length ?? 0,
            });

            result.providerUsed = aiResponse.provider;
            result.modelUsed = aiResponse.model;
            if (failedProviders.length > 0) {
                result.failedProviders = failedProviders;
                warnings.push(`⚠️ Fell back to ${aiResponse.provider} after ${failedProviders.join(', ')} failed.`);
            }

            progress('ai', 'Formatting note…');
            const formattedContent = promptService.processAIResponse(
                aiResponse.content,
                aiResponse.provider,
                aiResponse.model,
                format,
                videoData,
                url,
                segments,
            );

            progress('save', 'Saving note…');
            assertLive();
            const filePath = await fileService.saveToFile(videoData.title, formattedContent, this._settings.outputPath);

            // Record in processing history
            if (this.historyService) {
                await this.historyService.add({
                    videoId,
                    title: videoData.title,
                    url,
                    format,
                    provider: aiResponse.provider,
                    model: aiResponse.model,
                    filePath,
                    channelName: videoData.channelName,
                    duration: videoData.duration,
                });
            }

            new Notice(MESSAGES.SUCCESS(videoData.title));
            result.success = true;
            result.filePath = filePath;
            return result;
        } catch (error) {
            if (error instanceof ProcessingCancelled || signal.aborted) {
                logger.info('Video processing cancelled', 'Plugin', { url });
                return { ...result, error: 'Processing cancelled' };
            }

            const message = error instanceof Error ? error.message : String(error);
            logger.error('Video processing failed', 'Plugin', { error: message });
            if (!userNotified) {
                new Notice(`❌ ${message}`);
            }
            return { ...result, error: message };
        } finally {
            if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
            this.activeRunControllers.delete(controller);
        }
    }

    /**
     * Fetch a transcript, preferring the typed outcome API (which explains
     * *why* a transcript is missing) and falling back to the legacy
     * `{ fullText }` API when the service does not implement it.
     */
    // eslint-disable-next-line max-lines-per-function, complexity
    private async fetchTranscript(
        videoService: VideoDataService,
        videoId: string,
        signal?: AbortSignal,
    ): Promise<
        | { ok: true; fullText?: string; segments?: TranscriptSegment[]; truncated?: boolean }
        | { ok: false; error: string; reason?: TranscriptFailureReason }
    > {
        const language = this._settings.transcriptLanguage;

        if (typeof videoService.fetchTranscriptOutcome === 'function') {
            try {
                const outcome = await videoService.fetchTranscriptOutcome(videoId, language, signal);

                if (outcome.ok) {
                    const { fullText, segments, truncated } = outcome.transcript;
                    if (!fullText?.trim()) {
                        // Matches the legacy contract below: an empty transcript is
                        // "metadata only", not a failed run.
                        return { ok: true };
                    }
                    logger.info('Transcript fetched successfully', 'Plugin', {
                        videoId,
                        transcriptLength: fullText.length,
                        segments: segments.length,
                        truncated: truncated === true,
                    });
                    return { ok: true, fullText, segments, truncated: truncated === true };
                }

                const message = TRANSCRIPT_FAILURE_MESSAGES[outcome.reason];
                // A mid-fetch cancel often looks like a network failure to the
                // service — report cancellation, not a bogus failure notice.
                if (signal?.aborted) throw new ProcessingCancelled();
                logger.warn('Transcript unavailable', 'Plugin', {
                    videoId,
                    reason: outcome.reason,
                    detail: outcome.message,
                });
                new Notice(message);
                // A video without captions can still produce a metadata-only note
                // (and Gemini multimodal ingests it natively) — mirror the legacy
                // path instead of failing the run.
                if (outcome.reason === 'no-captions') {
                    return { ok: true };
                }
                return { ok: false, error: message, reason: outcome.reason };
            } catch (error) {
                if (error instanceof ProcessingCancelled || signal?.aborted) throw new ProcessingCancelled();
                logger.warn('Typed transcript fetch failed — falling back to legacy path', 'Plugin', {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Legacy path: `{ fullText } | null` — no segments, no typed failures.
        if (signal?.aborted) throw new ProcessingCancelled();
        try {
            if (!videoService.getTranscript) return { ok: true };

            const transcriptData = await videoService.getTranscript(videoId, language, signal);
            if (transcriptData?.fullText) {
                logger.info('Transcript fetched successfully', 'Plugin', {
                    videoId,
                    transcriptLength: transcriptData.fullText.length,
                });
                return { ok: true, fullText: transcriptData.fullText };
            }

            logger.warn('No transcript available — generating from metadata only', 'Plugin', { videoId });
            new Notice(NO_CAPTIONS_MESSAGE);
            return { ok: true };
        } catch (error) {
            if (error instanceof ProcessingCancelled || signal?.aborted) throw new ProcessingCancelled();
            logger.warn('Could not fetch transcript, continuing without it', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
            new Notice('Could not fetch transcript. Note will be based on metadata only.');
            return { ok: true };
        }
    }

    /**
     * Providers to try, in try order. Each `processWith` call runs with
     * fallback disabled so the failures stay attributable here instead of being
     * swallowed inside the AI service.
     */
    private buildProviderChain(
        providerName: string | undefined,
        aiService: AIService,
        enableFallback: boolean,
    ): string[] {
        const names = aiService.getProviderNames();
        if (!enableFallback) return providerName ? [providerName] : names.slice(0, 1);
        if (!providerName) return names;
        return [providerName, ...names.filter(name => name !== providerName)];
    }

    private async openFileByPath(filePath: string): Promise<void> {
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            const file = this.app.vault.getAbstractFileByPath(cleanPath);

            if (!file || !(file instanceof TFile)) {
                throw new Error(`File not found at path: ${cleanPath}`);
            }

            await this.openFileInNewTab(file);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Opening file by path');
            throw error;
        }
    }

    private async openFileInNewTab(file: TFile): Promise<void> {
        try {
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(file);
            this.app.workspace.setActiveLeaf(leaf);
            new Notice(`📂 Opened: ${file.name}`);
        } catch (error) {
            try {
                const currentLeaf = this.app.workspace.getLeaf(false);
                await currentLeaf.openFile(file);
                new Notice(`📂 Opened: ${file.name}`);
            } catch (fallbackError) {
                ErrorHandler.handle(fallbackError as Error, 'Opening file in current tab');
                new Notice(`Note saved as "${file.name}" but could not auto-open. Please open manually.`);
            }
        }
    }

    private async handleSettingsChange(newSettings: YouTubePluginSettings): Promise<void> {
        try {
            this._settings = { ...newSettings };
            await this.saveSettings();
            await this.serviceContainer?.updateSettings(this._settings);
            this.urlHandler?.updateSettings(this._settings);
        } catch (error) {
            ErrorHandler.handle(error as Error, 'Settings update');
            throw error;
        }
    }

    private async loadSettings(): Promise<void> {
        const loadedData = await this.loadData();
        // data.json holds plaintext API keys and processing history — log a
        // redacted summary, never the object itself.
        logger.debug('[YT-CLIPPER] Settings loaded from data.json:', 'Plugin', redactPluginData(loadedData));
        this._settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

        // Migrate any legacy obfuscated API keys to plaintext (one-time, idempotent).
        try {
            if (SecureConfigService.migrateApiKeys(this._settings)) {
                logger.info('Migrated legacy obfuscated API keys to plaintext', 'Plugin');
                await this.saveSettings();
            }
        } catch (error) {
            logger.warn('API key migration skipped', 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
        }

        logger.debug('[YT-CLIPPER] Settings after merge:', 'Plugin', redactPluginData(this._settings));
    }

    private async saveSettings(): Promise<void> {
        // Join the shared plugin-data lock: `saveData` round-trips the whole
        // data.json, so a settings write racing a history write would otherwise
        // resurrect stale history (or vice versa).
        await withPluginDataLock(() => this.saveData(this._settings));
    }

    private async safeOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T | null> {
        if (this.isUnloading) {
            logger.warn(`Attempted ${operationName} during plugin unload - skipping`, 'Plugin');
            return null;
        }

        const opId = ++this.operationCount;
        logger.info(`Starting operation ${opId}: ${operationName}`, 'Plugin');

        try {
            const result = await operation();
            logger.info(`Completed operation ${opId}: ${operationName}`, 'Plugin');
            return result;
        } catch (error) {
            logger.error(`Failed operation ${opId}: ${operationName}`, 'Plugin', {
                error: error instanceof Error ? error.message : String(error),
            });
            ErrorHandler.handle(error as Error, operationName);
            return null;
        }
    }

    getServiceContainer(): ServiceContainer | undefined {
        return this.serviceContainer;
    }

    // Expose services for testing and external access
    getUrlHandler(): UrlHandler | undefined {
        return this.urlHandler;
    }

    getModalManager(): ModalManager | undefined {
        return this.modalManager;
    }

    // Public method to get current settings
    getCurrentSettings(): YouTubePluginSettings {
        return { ...this._settings };
    }

    // Public getter for settings (used by settings tab)
    get settings(): YouTubePluginSettings {
        return this._settings;
    }
}
