import { PromptService, VideoData, OutputFormat, PerformanceMode } from '../types';
import { ValidationUtils } from '../validation';

/**
 * Prompt generation service for AI processing
 */


export class AIPromptService implements PromptService {
    // Optimized prompt templates for different performance modes
    private static readonly COMPACT_BASE_TEMPLATE = `Analyze this YouTube video:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

Focus on extracting the key information and insights.`;

    private static readonly BALANCED_BASE_TEMPLATE = `Analyze this YouTube video:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

Extract insights from the content, focusing on practical information.`;

    private static readonly COMPREHENSIVE_BASE_TEMPLATE = `Analyze this YouTube video comprehensively:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

ANALYSIS INSTRUCTIONS:
1. Analyze the transcript content thoroughly
2. Extract key insights, themes, and practical information
3. Focus on action-oriented information with specific examples
4. Maintain accuracy and cite specific examples from the content when relevant`;

    /**
     * Create analysis prompt for YouTube video content with performance optimization
     */
    createAnalysisPrompt(
        videoData: VideoData,
        videoUrl: string,
        format: OutputFormat = 'detailed-guide',
        customPrompt?: string,
        transcript?: string,
        performanceMode: PerformanceMode = 'balanced'
    ): string {
        // Use custom prompt if provided
        if (customPrompt && customPrompt.trim()) {
            return this.applyCustomPrompt(customPrompt, videoData, videoUrl);
        }

        // Select base template based on performance mode
        let baseTemplate: string;
        switch (performanceMode) {
            case 'fast':
                baseTemplate = AIPromptService.COMPACT_BASE_TEMPLATE;
                break;
            case 'quality':
                baseTemplate = AIPromptService.COMPREHENSIVE_BASE_TEMPLATE;
                break;
            default:
                baseTemplate = AIPromptService.BALANCED_BASE_TEMPLATE;
        }

        // Build transcript section
        let transcriptSection = '';
        if (transcript && transcript.trim()) {
            // Truncate very long transcripts to avoid token limits
            const maxLength = 8000;
            const truncatedTranscript = transcript.length > maxLength
                ? transcript.substring(0, maxLength) + '... [transcript truncated]'
                : transcript;
            transcriptSection = `VIDEO CONTENT/TRANSCRIPT:\n${truncatedTranscript}`;
        }

        // Fast string replacement
        const baseContent = baseTemplate
            .replace('{{TITLE}}', videoData.title)
            .replace('{{URL}}', videoUrl)
            .replace('{{DESCRIPTION}}', videoData.description)
            .replace('{{TRANSCRIPT_SECTION}}', transcriptSection);

        // Create format-specific prompt
        switch (format) {
            case 'executive-summary':
                return this.createExecutiveSummaryPrompt(baseContent, videoUrl, performanceMode);
            case 'brief':
                return this.createBriefPrompt(baseContent, videoUrl, performanceMode);
            case 'detailed-guide':
            default:
                return this.createDetailedGuidePrompt(baseContent, videoUrl, performanceMode);
        }
    }

    /**
     * Apply custom prompt template with placeholder substitution
     */
    private applyCustomPrompt(customPrompt: string, videoData: VideoData, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;
        
        return customPrompt
            .replace(/__VIDEO_TITLE__/g, videoData.title || 'Unknown Video')
            .replace(/__VIDEO_DESCRIPTION__/g, videoData.description || 'No description available')
            .replace(/__VIDEO_URL__/g, videoUrl)
            .replace(/__VIDEO_ID__/g, videoId || 'unknown')
            .replace(/__EMBED_URL__/g, embedUrl)
            .replace(/__DATE__/g, new Date().toISOString().split('T')[0] ?? '')
            .replace(/__TIMESTAMP__/g, new Date().toISOString());
    }

    /**
     * Create a brief prompt: short description plus resources list
     */
    private createBriefPrompt(baseContent: string, videoUrl: string, performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return `${baseContent}

        OUTPUT FORMAT - BRIEF DESCRIPTION + RESOURCES:

        Use this EXACT template:

        ---
        title: {Video Title}
        source: ${videoUrl}
        created: "${new Date().toISOString().split('T')[0]}"
        modified: "${new Date().toISOString().split('T')[0]}"
        description: "One short paragraph (3-4 sentences) summarizing the video"
        type: youtube-note
        format: brief
        tags:
          - youtube
          - brief
        status: processed
        duration: "[Extract video duration]"
        channel: "[Extract channel name]"
        video_id: "${videoId || 'unknown'}"
        processing_date: "${new Date().toISOString()}"
    ai_provider: "__AI_PROVIDER__"
    ai_model: "__AI_MODEL__"
        ---

        <iframe width="640" height="360" src="${embedUrl}" title="{Video Title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

        ---

        ## Brief Description
        [Provide a concise 3-4 sentence description that captures the core message of the video]

        ## Key Takeaways
        - **[Takeaway 1]**: [Core insight or lesson from the video]
        - **[Takeaway 2]**: [Core insight or lesson from the video]
        - **[Takeaway 3]**: [Core insight or lesson from the video]

        ## Quick Actions
        1. **[Immediate Action]**: [Specific action you can take right away]
        2. **[Next Step]**: [Follow-up action to apply what you learned]

        ## Resources
        - **Original Video:** [Watch on YouTube](${videoUrl})
        - **Channel:** [Creator's Channel](https://youtube.com/channel/[extract-channel-id])
        - **Top resources mentioned or related (links):**
          - [Resource 1]
          - [Resource 2]
          - [Resource 3]

        IMPORTANT: Keep the Brief Description short and focused. Provide 2-3 high-quality resource links that help the reader explore the topic further. Action items should be simple and immediately applicable.`;
    }

    /**
     * Create executive summary prompt (≤250 words, tech/developer focused)
     */
    private createExecutiveSummaryPrompt(baseContent: string, videoUrl: string, performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return `${baseContent}

OUTPUT FORMAT - EXECUTIVE SUMMARY (≤250 words):

Create a concise executive summary following this EXACT template:

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
modified: "${new Date().toISOString().split('T')[0]}"
type: youtube-note
format: executive-summary
tags:
  - youtube
  - executive-summary
video_id: "${videoId || 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

# Executive Summary

[Provide a 2-3 paragraph summary (max 250 words total) that captures the core message and key insights. Focus on the main value proposition and critical takeaways. Use clear, professional language.]

# Key Points

- **[Point 1]**: [Brief explanation]
- **[Point 2]**: [Brief explanation]
- **[Point 3]**: [Brief explanation]
- **[Point 4]**: [Brief explanation]
- **[Point 5]**: [Brief explanation]

# Action Items

1. **[Immediate Action]**: [What can be applied right away]
2. **[Strategic Initiative]**: [Longer-term implementation]
3. **[Follow-up Required]**: [What needs further research]

# Notes

[Additional context, technical considerations, or observations that add value to the summary]

IMPORTANT INSTRUCTIONS:
- Keep the Executive Summary under 250 words total
- Focus on actionable insights and practical value
- Prioritize technical/developer perspectives when relevant
- Use bullet points for readability
- Be specific and concrete, not vague
- Include timestamps for key insights when available`;
    }

    /**
     * Create detailed guide prompt
     */
    private createDetailedGuidePrompt(baseContent: string, videoUrl: string, performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;
        
        return `${baseContent}

        OUTPUT FORMAT - EFFICIENT STEP-BY-STEP TUTORIAL:

        Create a concise step-by-step tutorial following this structure:

        ---
        title: {{TITLE}}
        source: ${videoUrl}
        created: "${new Date().toISOString().split('T')[0]}"
        type: youtube-tutorial
        format: step-by-step
        tags: [youtube, tutorial, implementation, practical]
        status: processed
        channel: "[Extract channel name]"
        video_id: "${videoId || 'unknown'}"
        ai_provider: "__AI_PROVIDER__"
        ai_model: "__AI_MODEL__"
        ---

        <div style="text-align: center; margin-bottom: 24px;">
        <iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>

        ---

        # [Title] - Practical Tutorial

        ## Overview
        **Goal:** [Main learning objective]
        **Duration:** [Estimated time]
        **Level:** [Difficulty]

        **Video:** [{{TITLE}}](${videoUrl})

        ## Prerequisites
        - [Requirement 1]
        - [Requirement 2]
        - [Requirement 3]

        ## Step-by-Step Guide

        ### Step 1: [Action/Setup]
        **Objective:** [Clear goal]

        **Actions:**
        1. [Specific instruction]
        2. [Follow-up instruction]
        3. [Verification step]

        ✅ **Success:** [How to confirm it worked]

        ### Step 2: [Core Implementation]
        **Objective:** [Clear goal]

        [Continue with remaining steps...]

        ### Step 3: [Final Touches]
        **Objective:** [Clear goal]

        ## Learning Outcomes
        Upon completion, you will:
- [Achieved skill 1]
- [Achieved skill 2]
- [Achieved skill 3]

        ## Required Tools
        - **[Tool/Resource 1]:** [Where to get it]
        - **[Tool/Resource 2]:** [Where to get it]

        ## Pro Tips
        💡 **Tip 1:** [Key insight from video]
        💡 **Tip 2:** [Best practice]
        ⚠️ **Avoid:** [Common mistake]

        ## Verification
        **Final Check:** [How to verify complete success]
        **Expected Result:** [What you should see/accomplish]

              *Generated from YouTube video content*`;
    }

    /**
     * Process AI response and inject provider information
     */
    processAIResponse(content: string, provider: string, model: string, format?: OutputFormat): string {
        if (!content) {
            return content;
        }

        const providerValue = provider || 'unknown';
        const modelValue = model || 'unknown';

        let updatedContent = content
            .replace(/__AI_PROVIDER__/g, providerValue)
            .replace(/__AI_MODEL__/g, modelValue);

        updatedContent = this.ensureFrontMatterValue(updatedContent, 'ai_provider', providerValue);
        updatedContent = this.ensureFrontMatterValue(updatedContent, 'ai_model', modelValue);

        return updatedContent;
    }

    private ensureFrontMatterValue(content: string, key: string, value: string): string {
        const pattern = new RegExp(`(${key}\\s*:\\s*)(["'])?([^"'\\n]*)(["'])?`, 'i');
        if (pattern.test(content)) {
            return content.replace(pattern, (_, prefix: string, openingQuote?: string, _existing?: string, closingQuote?: string) => {
                const quote = openingQuote || closingQuote ? '"' : '';
                return `${prefix}${quote}${value}${quote}`;
            });
        }

        if (content.startsWith('---')) {
            return content.replace(/^---\s*\n/, `---\n${key}: "${value}"\n`);
        }

        return content;
    }

    /**
     * Create a summary prompt for shorter content
     */
    createSummaryPrompt(videoData: VideoData, videoUrl: string): string {
        return `Create a concise summary for this YouTube video:

        Title: ${videoData.title}
        URL: ${videoUrl}
        Description: ${videoData.description}

        Please provide:
        1. A 2-paragraph summary (max 250 words)
        2. 3-5 key takeaways
        3. Main actionable insights

        Format as markdown with clear headings.`;
    }

    /**
     * Validate prompt length and content
     */
    validatePrompt(prompt: string): boolean {
        return Boolean(prompt) && 
               typeof prompt === 'string' && 
               prompt.trim().length > 10 && 
               prompt.length < 50000; // Reasonable upper limit
    }
}
