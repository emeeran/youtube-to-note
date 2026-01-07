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
        if (customPrompt?.trim()) {
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
        if (transcript?.trim()) {
            // Truncate very long transcripts to avoid token limits
            const maxLength = 8000;
            const truncatedTranscript = transcript.length > maxLength
                ? `${transcript.substring(0, maxLength)}... [transcript truncated]`
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
            case 'transcript':
                return this.createTranscriptPrompt(baseContent, videoUrl, performanceMode);
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
     * Create a brief prompt: Summary + Key Takeaways
     */
    private createBriefPrompt(baseContent: string, videoUrl: string, performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return `${baseContent}

        OUTPUT FORMAT - BRIEF SUMMARY:

        Provide a two-part output following this EXACT structure:

        ---
        title: {{TITLE}}
        source: ${videoUrl}
        created: "${new Date().toISOString().split('T')[0]}"
        type: youtube-note
        format: brief
        tags: [youtube, brief]
        video_id: "${videoId || 'unknown'}"
        ai_provider: "__AI_PROVIDER__"
        ai_model: "__AI_MODEL__"
        ---

        <div style="text-align: center; margin-bottom: 24px;">
        <iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>

        ---

        ## Summary
        [Under 250 words, distilling the core message and value of the video.]

        ## Key Takeaways
        - [Takeaway 1]
        - [Takeaway 2]
        - [Takeaway 3]
        - [Takeaway 4]
        - [Takeaway 5]

        **Formatting Rules:**
        - Remove time-stamps, filler words, and any unnecessary details.
        - Include external links and resources for further reading and viewing.`;
    }

    /**
     * Create transcript prompt: Summary + Full Transcript
     */
    private createTranscriptPrompt(baseContent: string, videoUrl: string, performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return `${baseContent}

        OUTPUT FORMAT - TRANSCRIPT NOTE:

        Provide a two-part output following this EXACT structure:

        ---
        title: {{TITLE}}
        source: ${videoUrl}
        created: "${new Date().toISOString().split('T')[0]}"
        type: youtube-transcript
        format: transcript
        tags: [youtube, transcript]
        video_id: "${videoId || 'unknown'}"
        ai_provider: "__AI_PROVIDER__"
        ai_model: "__AI_MODEL__"
        ---

        <div style="text-align: center; margin-bottom: 24px;">
        <iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>

        ---

        ## 1. Summary
        [Under 250 words, distilling the core message and value of the video.]

        ## 2. Full Transcript
        [Cleaned up transcript content]

        **Formatting Rules:**
        - Remove time-stamps, filler words, and any unnecessary details.
        - Include external links and resources for further reading and viewing found in the content.
        - Use clear paragraph breaks for readability.`;
    }

    /**
     * Create executive summary prompt (structured format with strategic insights)
     */
    private createExecutiveSummaryPrompt(baseContent: string, videoUrl: string, performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return `${baseContent}

OUTPUT FORMAT - EXECUTIVE SUMMARY:

Create a comprehensive executive summary following this EXACT template:

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

---

# 📊 Executive Summary

[2-3 paragraph summary capturing the core message and key insights. Focus on the main value proposition and critical takeaways.]

Key concepts include:

- **[Concept 1]:** [Brief definition/explanation]
- **[Concept 2]:** [Brief definition/explanation]
- **[Concept 3]:** [Brief definition/explanation]

To implement these insights, consider the following recommendations, risks, and priority actions:

1. **[Action 1]:** [Description]
2. **[Action 2]:** [Description]
3. **[Action 3]:** [Description]
4. **[Action 4]:** [Description]

> **💡 Focus:** Strategic value over narrative recap - prioritize actionable insights.

---

## 🎯 Key Strategic Insights

### 🔧 Technical Strategy
**[One sentence strategic technical insight]**

### 💡 Design Thinking
**[One sentence strategic design insight]**

### 📚 Continuous Learning
**[One sentence strategic learning insight]**

---

## 🚀 Action Plan & Implementation

### ⚡ Immediate (0-30 days)
- **Action:** [Specific immediate action]
- **Success Metric:** [Measurable criteria]

### 📈 Short-term (1-3 months)
- **Action:** [Specific short-term action]
- **Success Metric:** [Measurable criteria]

### 🎯 Mid-term (3-6 months)
- **Action:** [Specific mid-term action]
- **Success Metric:** [Measurable criteria]

### 🔮 Long-term (6+ months)
- **Action:** [Specific long-term action]
- **Success Metric:** [Measurable criteria]

> **✅ Requirement:** Each action item must include clear, measurable success criteria.

---

## 📚 Curated Resources & References

### 🎥 Primary Sources
- **Original Video:** [Watch on YouTube](${videoUrl})
- **Channel:** [Channel Name](https://youtube.com/channel/[channel-id])

### 🛠️ Key Tools & Technologies
- **[Tool/Technology 1]:** [Brief description]
- **[Tool/Technology 2]:** [Brief description]
- **[Tool/Technology 3]:** [Brief description]

### 📖 Official Documentation
- **[Resource 1]:** [Link]
- **[Resource 2]:** [Link]

### 🌟 Further Reading
- **[Article 1]:** [Link]
- **[Article 2]:** [Link]

IMPORTANT INSTRUCTIONS:
- Executive Summary should be 2-3 paragraphs (~250 words)
- Extract 3 key concepts with clear definitions
- Provide 4 prioritized action items
- Create 3 strategic insights (Technical Strategy, Design Thinking, Continuous Learning)
- Develop a 4-phase action plan with measurable success metrics for each phase
- Include relevant resources (tools, documentation, further reading) with actual links when mentioned in the content
- Use emojis to make sections visually distinct and scannable
- Focus on strategic value and actionable insights over narrative recap`;
    }

    /**
     * Create tutorial prompt (Step-by-Step Guide)
     */
    private createDetailedGuidePrompt(baseContent: string, videoUrl: string, performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return `${baseContent}

        OUTPUT FORMAT - TUTORIAL / STEP-BY-STEP GUIDE:

        Provide a two-part output following this EXACT structure:

        ---
        title: {{TITLE}}
        source: ${videoUrl}
        created: "${new Date().toISOString().split('T')[0]}"
        type: youtube-tutorial
        format: tutorial
        tags: [youtube, tutorial]
        video_id: "${videoId || 'unknown'}"
        ai_provider: "__AI_PROVIDER__"
        ai_model: "__AI_MODEL__"
        ---

        <div style="text-align: center; margin-bottom: 24px;">
        <iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>

        ---

        ## 1. Summary
        [Under 250 words, distilling the core message and value of the video.]

        ## 2. Step-by-Step Guide
        [A sequential, detailed, and actionable tutorial that stands alone.]

        **Formatting Rules:**
        - Remove time-stamps, filler words, and any unnecessary details.
        - Include external links and resources for further reading and viewing.`;
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
