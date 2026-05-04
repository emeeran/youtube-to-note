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
