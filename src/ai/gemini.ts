import { API_ENDPOINTS, AI_MODELS, PROVIDER_MODEL_OPTIONS } from '../constants/index';
import { BaseAIProvider } from './base';
import { MESSAGES } from '../constants/index';
import type { GeminiRequestBody, GeminiResponse } from '../types/api-responses';
import type { ProviderModelEntry } from '../constants/index';
import { formatQuotaError } from './error-utils';

/**
 * Google Gemini AI provider implementation
 */

export class GeminiProvider extends BaseAIProvider {
    readonly name = 'Google Gemini';

    constructor(apiKey: string, model?: string, timeout?: number) {
        super(apiKey, model ?? AI_MODELS.GEMINI, timeout);
    }

    // eslint-disable-next-line complexity, max-lines-per-function
    async process(prompt: string): Promise<string> {
        try {
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error(MESSAGES.ERRORS.GEMINI_INVALID_KEY);
            }

            const endpoint = `${API_ENDPOINTS.GEMINI_BASE}/${this.model}:generateContent`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: this.createHeaders(),
                body: JSON.stringify(this.createRequestBody(prompt)),
            });

            // Handle specific Gemini errors with better messages
            if (response.status === 400) {
                const errorData = (await this.safeJsonParse(response)) as any;
                const errorMessage = errorData?.error?.message || 'Bad request';
                throw new Error(`Gemini API error: ${errorMessage}. Try checking the model configuration.`);
            }

            if (response.status === 401) {
                throw new Error(MESSAGES.ERRORS.GEMINI_INVALID_KEY);
            }

            if (response.status === 403) {
                const errorData = (await this.safeJsonParse(response)) as any;
                const errorMessage = errorData?.error?.message || '';
                if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('billing')) {
                    throw new Error(formatQuotaError(errorMessage, 'Gemini'));
                }
                throw new Error('Gemini API access denied. Please verify your API key has access to this model.');
            }

            if (response.status === 429) {
                const errorData = (await this.safeJsonParse(response)) as any;
                const errorMessage = errorData?.error?.message || errorData?.message || '';
                throw new Error(formatQuotaError(errorMessage, 'Gemini'));
            }

            if (!response.ok) {
                await this.handleAPIError(response);
            }

            const data = (await response.json()) as GeminiResponse;

            // Enhanced response validation
            if (!data.candidates?.length) {
                throw new Error('No response candidates returned from Gemini API');
            }

            if (data.candidates[0]!.finishReason === 'SAFETY') {
                throw new Error('Response blocked by Gemini safety filters. Try rephrasing.');
            }

            if (
                !this.validateResponse(data as unknown as Record<string, unknown>, [
                    'candidates',
                    '0',
                    'content',
                    'parts',
                    '0',
                    'text',
                ])
            ) {
                throw new Error('Invalid response format from Gemini API');
            }

            return this.extractContent(data as unknown as Record<string, unknown>);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`Gemini processing failed: ${error}`);
        }
    }

    protected createHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            // Send the key via header rather than the URL query string, where it
            // can leak into logs / referers.
            'x-goog-api-key': this.apiKey,
        };
    }

    // eslint-disable-next-line max-lines-per-function
    protected createRequestBody(prompt: string): any {
        // Detect YouTube prompts by scanning for common markers instead of brittle literals
        const normalizedPrompt = prompt.toLowerCase();
        const isVideoAnalysis =
            normalizedPrompt.includes('youtube video') ||
            normalizedPrompt.includes('youtu.be/') ||
            normalizedPrompt.includes('youtube.com/');

        const baseConfig: GeminiRequestBody = {
            contents: [
                {
                    parts: [{ text: prompt }],
                },
            ],
            generationConfig: {
                temperature: this._temperature,
                maxOutputTokens: this._maxTokens,
                candidateCount: 1,
            },
        };

        // Enable multimodal analysis for YouTube videos only when the chosen Gemini model
        // is known to support audio/video input. We both attach the video as a `fileData`
        // part (so Gemini ingests the actual YouTube video) and add a system instruction.
        if (isVideoAnalysis) {
            const currentModelName = String(this.model ?? '').toLowerCase();
            const modelSupportsAudioVideo =
                (PROVIDER_MODEL_OPTIONS['Google Gemini'] ?? ([] as ProviderModelEntry[])).some(m => {
                    const name = typeof m === 'string' ? m : (m?.name ?? '');
                    return (
                        String(name).toLowerCase() === currentModelName &&
                        (typeof m === 'string' ? false : Boolean(m.supportsAudioVideo))
                    );
                }) || /^gemini-(1\.5|2\.\d|flash|pro)/.test(currentModelName);

            const videoConfig: GeminiRequestBody & {
                systemInstruction: { parts: Array<{ text: string }> };
            } = {
                ...baseConfig,
                systemInstruction: {
                    parts: [
                        {
                            text:
                                'You are an expert video content analyzer. ' +
                                'Provide comprehensive, multimodal analysis using:\n' +
                                '• AUDIO STREAM: transcribe spoken content, identify speakers, ' +
                                'capture tone/emphasis/emotion\n' +
                                '• VIDEO STREAM: analyze visual elements, text overlays, diagrams, ' +
                                'slides, gestures, scene changes, demonstrations\n' +
                                '• INTEGRATED INSIGHTS: synthesize audio and visual data\n\n' +
                                'Prioritize accuracy in transcription, extract key concepts shown ' +
                                'visually, and note timing relationships between audio and visuals.',
                        },
                    ],
                },
            };

            // Attach the actual YouTube video so Gemini can watch/listen to it.
            // Gemini ingests public YouTube URLs natively via FileData.
            if (modelSupportsAudioVideo) {
                const youtubeUrl = this.extractYouTubeUrl(prompt);
                if (youtubeUrl) {
                    videoConfig.contents[0]!.parts.push({
                        fileData: { fileUri: youtubeUrl, mimeType: 'video/mp4' },
                    });
                }
            }

            // If the prompt contains a Google Cloud Storage URI (gs://...), attach it
            // as a FileData part for additional video analysis capability.
            const gcsMatch = prompt.match(/(gs:\/\/[\w-./]+\.(?:mp4|mov|mkv|webm))/i);
            if (gcsMatch?.[1]) {
                videoConfig.contents.push({
                    parts: [{ fileData: { fileUri: gcsMatch[1], mimeType: 'video/mp4' } }],
                });
            }

            return videoConfig;
        }

        return baseConfig;
    }

    /**
     * Extract a clean YouTube watch URL from a prompt, if present.
     */
    private extractYouTubeUrl(prompt: string): string | null {
        const match = prompt.match(
            /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[A-Za-z0-9_-]{11}/,
        );
        return match?.[0] ?? null;
    }

    protected extractContent(response: Record<string, unknown>): string {
        const content = (response.candidates as GeminiResponse['candidates'])[0]?.content?.parts[0]?.text;
        return content ? content.trim() : '';
    }

    /** Live-fetch available model ids from Gemini's list endpoint. */
    async listModels(): Promise<string[]> {
        const response = await fetch(`${API_ENDPOINTS.GEMINI_BASE}?pageSize=200`, {
            method: 'GET',
            headers: this.createHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Gemini models request failed: ${response.status}`);
        }
        const data = (await response.json()) as {
            models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
        };
        return (data.models ?? [])
            .filter(
                m =>
                    Array.isArray(m.supportedGenerationMethods) &&
                    m.supportedGenerationMethods.includes('generateContent'),
            )
            .map(m => (m.name ?? '').replace(/^models\//, ''))
            .filter((name): name is string => name.length > 0);
    }
}
