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
            // Truncate very long transcripts to avoid token limits (increased for large context models)
            const maxLength = 100000;
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
            case 'custom':
                // For custom format, pass the user's custom prompt into the custom template
                return this.createCustomFormatPrompt(baseContent, videoData, videoUrl, customPrompt, performanceMode);
            case 'detailed-guide':
            default:
                return this.createDetailedGuidePrompt(baseContent, videoUrl, performanceMode);
        }
    }

    /**
     * Create a brief prompt: Summary + Key Takeaways
     */
    private createBriefPrompt(baseContent: string, videoUrl: string, _performanceMode: PerformanceMode = 'balanced'): string {
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
        video_id: "${videoId ?? 'unknown'}"
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
    private createTranscriptPrompt(baseContent: string, videoUrl: string, _performanceMode: PerformanceMode = 'balanced'): string {
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
        video_id: "${videoId ?? 'unknown'}"
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
    private createExecutiveSummaryPrompt(baseContent: string, videoUrl: string, _performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return `${baseContent}

You are an expert content analyst specializing in creating executive transcripts. Your task is to analyze video content and provide a comprehensive yet refined output.

**Your Analysis Process:**
1. Carefully review the entire video content, including spoken words, visual elements, and context
2. Identify the core message, key arguments, and primary value propositions
3. Extract 3-5 most impactful insights or takeaways
4. Identify concrete actionable items for the audience
5. Note all external resources, links, or references mentioned and suggest relevant additional resources

**Required Output Format:**

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
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen title="{{TITLE}}"></iframe>
</div>

---

### 🔑 Key Takeaways
Present 3-5 bulleted insights that capture the most important points:
- **[Takeaway Title]**: Clear, specific insight with supporting detail or context
- Prioritize insights that are actionable or decision-enabling
- Include relevant data, quotes, or specific details when applicable
- Ensure each takeaway stands alone and provides immediate value

---

### 📋 Summary
> **Core Message:** [The central thesis or main point of the content]

Provide a concise summary (under 250 words) covering:
- **Key Arguments**: Primary supporting points and reasoning presented
- **Value Proposition**: What viewers gain from this content and why it matters
- **Context**: Intended audience, use case, and relevance
- **Conclusion**: Overall significance or implications

---

### 🚀 Actionable Items
List concrete actions the audience can take based on this content:
- [ ] **[Action 1]**: Specific step, strategy, or implementation
- [ ] **[Action 2]**: Decision or change to consider
- [ ] **[Action 3]**: Next step for learning or implementation
- [ ] **[Action 4]**: Habit, practice, or framework to adopt

*(If no explicit actions mentioned, derive implied actions from the content)*


---

### 📚 Resources

**Mentioned in Content:**
- URLs and websites referenced
- Books, articles, or papers cited
- Tools, software, or platforms discussed
- People, companies, or organizations named

**Suggested for Further Exploration:**
- Related content that expands on key topics
- Foundational resources for beginners
- Advanced materials for deeper understanding
- Community resources, forums, or documentation
- Complementary tools or alternatives

**Quality Standards:**
- Maintain the speaker's voice and intent while improving clarity
- Ensure accuracy in technical details and proper nouns
- Create a document that can be read independently without the video
- Preserve important context that might be lost in pure transcription
- Make actionable items specific and realistic`;
    }

    /**
     * Create tutorial prompt (Step-by-Step Guide)
     */
    private createDetailedGuidePrompt(baseContent: string, videoUrl: string, _performanceMode: PerformanceMode = 'balanced'): string {
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
        video_id: "${videoId ?? 'unknown'}"
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
     * Create custom format prompt: adaptable analysis based on user instructions
     */
    private createCustomFormatPrompt(baseContent: string, _videoData: VideoData, videoUrl: string, customInstructions?: string, _performanceMode: PerformanceMode = 'balanced'): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        // Determine user instructions for custom template
        const userInstructions = customInstructions?.trim()
            ? `USER'S CUSTOM INSTRUCTIONS:\n${customInstructions}\n\n`
            : ''; // If no custom instructions, just an empty string

        return `${baseContent}

You are an adaptive content analyst capable of providing customized analysis based on specific user requirements. Your task is to analyze content according to the user's explicit instructions while maintaining high quality standards.

**Your Analysis Process:**
1. Carefully read and understand the custom requirements provided
2. Identify the specific analysis type, depth, and format needed
3. Determine appropriate structure and level of detail
4. Extract relevant information aligned with the custom objectives

**Default Output Format (if no custom format specified):**

### ANALYSIS OVERVIEW
- Purpose of this analysis
- Methodology or approach used
- Scope and limitations

### CUSTOM CONTENT
${userInstructions}
[Deliver analysis according to user specifications, which may include:]
- Summaries, transcripts, or distillations
- Specific sections or topic breakdowns
- Comparative analysis or synthesis
- Technical deep-dives or explanations
- Audience-specific adaptations
- Industry or domain-focused insights

### SUPPLEMENTARY INFORMATION
If relevant, include:
- External links and resources
- Related content or context
- Recommendations for further exploration
- Clarifications or caveats

**Adaptation Guidelines:**
- **Format Flexibility**: Adjust structure to match user needs (narrative, outline, Q&A, etc.)
- **Depth Control**: Scale detail level from high-level overview to comprehensive deep-dive
- **Audience Tuning**: Adapt language and complexity for specified audience
- **Purpose Alignment**: Optimize output for stated use case (learning, decision-making, reference, etc.)
- **Custom Filtering**: Include/exclude specific types of information as requested

**Quality Standards:**
- Confirm understanding of custom requirements if ambiguous
- Maintain accuracy and objectivity regardless of format
- Preserve citations and attributions
- Flag when custom requirements conflict with content availability
- Suggest alternative approaches if original request isn't feasible

**Usage Note:**
When using this template, provide clear custom instructions such as:
- Desired output format and structure
- Specific focus areas or exclusions
- Target audience and expertise level
- Intended use case or application
- Length constraints or expansion needs

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
type: youtube-custom
format: custom
tags: [youtube, custom]
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

---
`;
    }

    /**
     * Process AI response and inject provider information
     */
    processAIResponse(content: string, provider: string, model: string, _format?: OutputFormat): string {
        if (!content) {
            return content;
        }

        const providerValue = provider ?? 'unknown';
        const modelValue = model ?? 'unknown';

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
                const quote = openingQuote ?? closingQuote ? '"' : '';
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
