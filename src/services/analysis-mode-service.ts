/**
 * Specialized Analysis Modes Service
 * Different analysis modes for different content types
 */

export type AnalysisMode = 'general' | 'code-tutorial' | 'interview' | 'educational' | 'review';

export interface AnalysisPrompt {
    mode: AnalysisMode;
    systemPrompt: string;
    userPrompt: string;
    outputFormat: string;
}

export class AnalysisModeService {
    private prompts: Map<AnalysisMode, AnalysisPrompt> = new Map();

    constructor() {
        this.initializePrompts();
    }

    private initializePrompts(): void {
        this.prompts.set('code-tutorial', {
            mode: 'code-tutorial',
            systemPrompt: 'You are an expert at analyzing programming tutorials and extracting code snippets and explanations.',
            userPrompt: `Analyze this video transcript and extract:
1. Main programming concepts covered
2. All code snippets with syntax highlighting
3. Step-by-step explanations
4. Best practices mentioned
5. Common pitfalls to avoid

Format the output as a structured programming guide.`,
            outputFormat: 'structured-guide',
        });

        this.prompts.set('interview', {
            mode: 'interview',
            systemPrompt: 'You are an expert at analyzing interview content and extracting key insights.',
            userPrompt: `Analyze this interview transcript and extract:
1. Key quotes and insights
2. Main topics discussed
3. Important takeaways
4. Notable moments
5. Action items mentioned

Organize by topic and speaker.`,
            outputFormat: 'topic-based',
        });

        this.prompts.set('educational', {
            mode: 'educational',
            systemPrompt: 'You are an expert at analyzing educational content and creating learning summaries.',
            userPrompt: `Analyze this educational content and extract:
1. Learning objectives
2. Key concepts explained
3. Examples provided
4. Questions raised
5. Further reading/suggestions

Format as a comprehensive study guide.`,
            outputFormat: 'study-guide',
        });

        this.prompts.set('review', {
            mode: 'review',
            systemPrompt: 'You are an expert at analyzing reviews and extracting opinions.',
            userPrompt: `Analyze this review and extract:
1. Overall verdict
2. Pros and cons
3. Key features discussed
4. Rating criteria
5. Comparison to alternatives

Format as a structured review.`,
            outputFormat: 'structured-review',
        });

        this.prompts.set('general', {
            mode: 'general',
            systemPrompt: 'You are a helpful assistant that summarizes video content accurately.',
            userPrompt: 'Summarize the main points of this video transcript.',
            outputFormat: 'summary',
        });
    }

    getPrompt(mode: AnalysisMode): AnalysisPrompt {
        return this.prompts.get(mode) || this.prompts.get('general')!;
    }

    analyzeWithMode(transcript: string, mode: AnalysisMode): string {
        const prompt = this.getPrompt(mode);
        return `${prompt.systemPrompt}\n\n${prompt.userPrompt}\n\nTranscript:\n${transcript}`;
    }

    detectMode(transcript: string, title: string): AnalysisMode {
        const text = (`${title} ${transcript}`).toLowerCase();

        if (this.hasCodeKeywords(text)) return 'code-tutorial';
        if (this.hasInterviewKeywords(text)) return 'interview';
        if (this.hasEducationalKeywords(text)) return 'educational';
        if (this.hasReviewKeywords(text)) return 'review';

        return 'general';
    }

    private hasCodeKeywords(text: string): boolean {
        const keywords = ['code', 'function', 'variable', 'class', 'programming', 'api', 'debug', 'compile', 'syntax'];
        return keywords.some(kw => text.includes(kw));
    }

    private hasInterviewKeywords(text: string): boolean {
        const keywords = ['interview', 'guest', 'host', 'question', 'answer', 'discuss', 'conversation'];
        return keywords.some(kw => text.includes(kw));
    }

    private hasEducationalKeywords(text: string): boolean {
        const keywords = ['learn', 'tutorial', 'lesson', 'course', 'study', 'explain', 'teach', 'concept'];
        return keywords.some(kw => text.includes(kw));
    }

    private hasReviewKeywords(text: string): boolean {
        const keywords = ['review', 'rating', 'recommend', 'verdict', 'pros', 'cons', 'comparison'];
        return keywords.some(kw => text.includes(kw));
    }
}

export const analysisModeService = new AnalysisModeService();
