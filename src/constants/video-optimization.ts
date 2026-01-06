/**
 * Video analysis optimization strategies
 */

export interface VideoAnalysisStrategy {
    name: string;
    description: string;
    maxVideoLength: number;
    requiresTranscript: boolean;
    chunkProcessing: boolean;
    priorityLevel: number;
    estimatedTimeReduction: number;
}

export const ANALYSIS_STRATEGIES: Record<string, VideoAnalysisStrategy> = {
    'transcript-only': {
        name: 'Transcript Analysis',
        description: 'Use YouTube transcript only (fastest)',
        maxVideoLength: 1800,
        requiresTranscript: true,
        chunkProcessing: false,
        priorityLevel: 1,
        estimatedTimeReduction: 70,
    },
    'metadata-first': {
        name: 'Metadata-First',
        description: 'Analyze title and description first',
        maxVideoLength: 300,
        requiresTranscript: false,
        chunkProcessing: false,
        priorityLevel: 1,
        estimatedTimeReduction: 80,
    },
    'comprehensive': {
        name: 'Comprehensive Analysis',
        description: 'Full video analysis with multimodal processing',
        maxVideoLength: Infinity,
        requiresTranscript: false,
        chunkProcessing: false,
        priorityLevel: 3,
        estimatedTimeReduction: 0,
    },
};
