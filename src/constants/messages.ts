
/**
 * User-facing messages and notifications
 */

export const MESSAGES = {
    PROCESSING: 'Processing YouTube video...',
    SUCCESS: (title: string) => `Successfully processed: ${title}`,
    OPENED_FILE: (filename: string) => `Opened: ${filename}`,

    ERRORS: {
        INVALID_URL: 'Invalid YouTube URL. Please provide a valid YouTube video URL ' +
            '(e.g., https://www.youtube.com/watch?v=VIDEO_ID)',
        MISSING_API_KEYS: 'No valid Gemini or Groq API key configured. ' +
            'Please set one in plugin settings.',
        GEMINI_INVALID_KEY: 'Gemini API key is invalid or missing. Please check your key.',
        GROQ_MODEL_NOT_FOUND: 'Groq API error: Model not found or you do not have access. ' +
            'Please check your API key and model name.',
        FETCH_VIDEO_DATA: (status: number) => `Failed to fetch video metadata: ${status}`,
        SAVE_FILE: (message: string) => `Failed to save file: ${message}`,
        AI_PROCESSING: (message: string) => `AI processing failed: ${message}`,
        FILE_NOT_EXISTS: 'File no longer exists',
        COULD_NOT_OPEN: (message: string) => `Could not open file: ${message}`,
        ENTER_URL: 'Please enter a YouTube URL',
        VIDEO_ID_EXTRACTION: 'Could not extract video ID from URL. Please check the URL format.',
        NETWORK_ERROR: 'Network error occurred. Please check your internet connection and try again.',
        TIMEOUT_ERROR: 'Request timed out. The server may be overloaded. Please try again.',
        CONNECTION_REFUSED: 'Could not connect to the AI service. Please check if the service is running.',
        INVALID_RESPONSE: 'Received an invalid response from the AI service. Please try again.',
        TRANSCRIPT_UNAVAILABLE: 'Video transcript is not available. ' +
            'This video may not have captions enabled.',
        VIDEO_PRIVATE: 'This video is private or unavailable. Please check the URL.',
        VIDEO_REGION_BLOCKED: 'This video is not available in your region.',
        // Quota and billing errors
        QUOTA_EXCEEDED: (provider: string) =>
            `${provider} API quota exceeded. Please check your plan and billing details, or try again later.`,
        RATE_LIMITED: (provider: string) =>
            `${provider} API rate limit reached. Please wait a moment and try again.`,
        BILLING_REQUIRED: (provider: string) =>
            `${provider} requires a paid plan. Please check your billing settings.`,
        CREDIT_EXHAUSTED: (provider: string) =>
            `${provider} API credits exhausted. Please top up your account or upgrade your plan.`,
        // Provider-specific guidance
        PROVIDER_UNAVAILABLE: (provider: string) =>
            `${provider} is currently unavailable. Try a different provider.`,
        MODEL_ACCESS_DENIED: (model: string, provider: string) =>
            `Access denied to model "${model}" on ${provider}. Check your API tier.`,
        CONTEXT_TOO_LONG: (provider: string) =>
            `Content too long for ${provider}. Try a shorter video or use a different format.`,
    },

    WARNINGS: {
        CORS_RESTRICTIONS: 'Description not available due to CORS restrictions',
        EXTRACTION_FAILED: 'Description extraction failed',
        AUTO_EXTRACTION: 'Video description could not be extracted automatically.',
        SLOW_PROCESSING: 'Processing is taking longer than expected. Please wait...',
        LARGE_TRANSCRIPT: 'This video has a long transcript. Processing may take a while.',
    },

    SUCCESS_MESSAGES: {
        NOTE_CREATED: 'Note created successfully!',
        PROCESSING_COMPLETE: 'Video processed successfully!',
        CLIPBOARD_COPIED: 'Path copied to clipboard',
        SETTINGS_SAVED: 'Settings saved',
    },

    MODALS: {
        YOUTUBE_PROCESSED: 'YouTube Video Processed',
        CONFIRM_OPEN: (filename: string) =>
            `Successfully processed YouTube video and saved as "${filename}". Would you like to open the note now?`,
        CLOSE_CONFIRMATION: 'Close without opening the note?',
        PROCESS_VIDEO: 'YouTube Clipper',
        YES_OPEN: 'Yes, open note',
        NO_THANKS: 'No, thanks',
        CANCEL: 'Cancel',
        PROCESS: 'Process',
    },

    PLACEHOLDERS: {
        YOUTUBE_URL: 'https://www.youtube.com/watch?v=...',
        GEMINI_KEY: 'AIza...',
        GROQ_KEY: 'gsk_...',
        OUTPUT_PATH: 'YouTube/Processed Videos',
    },

    HELP: {
        API_KEY_HELP: 'Get your API key from the provider\'s developer console',
        FORMAT_BRIEF: 'A concise summary with key points',
        FORMAT_EXECUTIVE: 'A comprehensive overview with main takeaways',
        FORMAT_DETAILED: 'An in-depth guide with full details and examples',
        FORMAT_CUSTOM: 'Use your own custom prompt template',
    },
} as const;
