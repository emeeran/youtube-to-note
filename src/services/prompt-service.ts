import { PromptService, VideoData, OutputFormat, PerformanceMode } from '../types';
import { ValidationUtils } from '../validation';

/**
 * Prompt generation service for AI processing
 */

interface AnalysisPromptOptions {
    videoData: VideoData;
    videoUrl: string;
    format?: OutputFormat;
    customPrompt?: string;
    transcript?: string;
    performanceMode?: PerformanceMode;
}

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

Extract insights from the content, focusing on practical information.
**MULTIMODAL INSTRUCTION:** Ensure the analysis is comprehensive by "watching" the video (processing visual and audio streams) to extract key insights, on-screen text, and non-verbal cues.`;

    private static readonly COMPREHENSIVE_BASE_TEMPLATE =
        `Analyze this YouTube video comprehensively:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

ANALYSIS INSTRUCTIONS:
1. Analyze the transcript content thoroughly
2. Extract key insights, themes, and practical information
3. Focus on action-oriented information with specific examples
4. Maintain accuracy and cite specific examples from the content ` +
        'when relevant' +
        `
5. **Multimodal Analysis:** Ensure the analysis is comprehensive by "watching" the video (processing visual and audio streams) to extract key insights, on-screen text, and non-verbal cues.`;

    /**
     * Create analysis prompt for YouTube video content with performance optimization
     */
    createAnalysisPrompt(options: AnalysisPromptOptions): string {
        const {
            videoData,
            videoUrl,
            format = 'detailed-guide',
            customPrompt,
            transcript,
            performanceMode = 'balanced',
        } = options;
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
            const truncatedTranscript =
                transcript.length > maxLength
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
            case '3c-concept':
                return this.create3CConceptPrompt(baseContent, videoUrl, performanceMode);
            case 'technical-analysis':
                return this.createTechnicalAnalysisPrompt(baseContent, videoUrl, performanceMode);
            case 'accelerated-learning':
                return this.createAcceleratedLearningPrompt(baseContent, videoUrl, performanceMode);
            case 'executive-briefing':
                return this.createExecutiveBriefingPrompt(baseContent, videoUrl, performanceMode);
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
    private createBriefPrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

# Rapid Insight Digest
You are a precision content analyst creating ultra-concise, high-value summaries that capture the essential insights from video content.

## MISSION
Extract the absolute core value from the video into a brief, actionable summary that delivers maximum information density with minimum fluff.

## ANALYTICAL FOCUS
- **Essential Value**: What is the single most important thing the viewer gains?
- **Actionable Intelligence**: Insights that can be immediately applied
- **Efficiency**: Maximum insight per word of summary
- **Clarity**: Complex concepts distilled to their essence

## DELIVERABLE STRUCTURE

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
type: youtube-note
format: brief
tags: [youtube, brief, rapid-insight]
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
</div>

---

## 🔥 Core Summary (Under 150 words)
**The essential value proposition and key insight:**
- **Primary Benefit**: What the viewer gains from this content
- **Core Message**: The fundamental concept or idea
- **Immediate Application**: How this can be used right away
- **Differentiator**: What makes this content unique or valuable

---

## 🎯 Power Takeaways (5 high-impact points)
**Concentrated insights for instant implementation:**
- **[Key Point 1]**: Specific, actionable insight with immediate relevance
- **[Key Point 2]**: Strategic or tactical advantage opportunity
- **[Key Point 3]**: Process improvement or efficiency gain
- **[Key Point 4]**: Resource or tool recommendation
- **[Key Point 5]**: Mindset shift or perspective change

---

## 📌 Rapid Application
**Next action items (pick 1-2 for immediate impact):**
- [ ] **[Action 1]**: Quick implementation step
- [ ] **[Action 2]**: Resource to explore or tool to try
- [ ] **[Action 3]**: Concept to research further

## QUALITY METRICS
- **Brevity**: Under 150 words for core summary
- **Actionability**: Each takeaway has clear implementation path
- **Value Density**: Every word delivers meaningful insight
- **Clarity**: Complex ideas expressed simply
- **Relevance**: Focus on immediately applicable insights

Deliver concentrated value now.`
        );
    }

    /**
     * Create transcript prompt: Summary + Full Transcript
     */
    private createTranscriptPrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

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
        <iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
        </div>

        ---

        ## 1. Summary
        [Under 250 words, distilling the core message and value of the video.]

        ## 2. Full Transcript
        [Cleaned up transcript content]

        **Formatting Rules:**
        - Remove time-stamps, filler words, and any unnecessary details.
        - Include external links and resources for further reading and viewing found in the content.
        - Use clear paragraph breaks for readability.`
        );
    }

    /**
     * Create 3C Concept prompt (Compress -> Compile -> Consolidate)
     */
    // eslint-disable-next-line max-lines-per-function
    private create3CConceptPrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

# 3C Protocol – Advanced Knowledge Distillation
You are an elite knowledge distillation specialist with expertise in cognitive science and learning optimization.

## MISSION
Transform the YouTube video into a **structured knowledge artifact** using the proven **3C Framework: Compress → Compile → Consolidate**.

## INPUT ANALYSIS
- Process both **audio content** (spoken words, emphasis, tone) and **visual elements** (demonstrations, slides, graphics)
- Prioritize **meaning and actionable insights** over literal transcription
- Identify **core concepts**, **supporting evidence**, and **practical applications**

## OUTPUT STRUCTURE

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
type: youtube-note
format: 3c-concept
tags: [youtube, 3c-concept, knowledge-distillation]
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
</div>

---

## 🔹 COMPRESS (Essential Extraction)
Synthesize the video into **8-10 high-impact insights**:
- **Core thesis**: What is the fundamental message or argument?
- **Key concepts**: 5-7 foundational ideas with precise definitions
- **Critical evidence**: Supporting data, examples, or proof points
- **Action triggers**: Moments that prompt behavioral change
- **Remove**: Redundancy, tangents, promotional content, and filler words

**Deliverable**: Concise, principle-based bullets that capture the essence.

---

## 🔸 COMPILE (Knowledge Assembly)
Transform compressed insights into **actionable intelligence**:
- **Frameworks**: Organized structures for understanding concepts
- **Workflows**: Sequential steps for implementation
- **Mental models**: Cognitive tools for decision-making
- **Connections**: Relationships between ideas and external concepts
- **Applications**: How to use this knowledge practically

**Deliverable**: Structured knowledge ready for implementation.

---

## 🔹 CONSOLIDATE (Retention & Transfer)
Optimize for **long-term retention and practical application**:
- **Master Mental Model**: A unifying framework that integrates all key concepts coherently
- **Recall Anchors**: 6-8 specific, challenging questions that test deep comprehension
- **Implementation Roadmap**: 4-6 concrete, measurable next steps with timelines
- **Cross-Reference Network**: Connections to related concepts, prior knowledge, and adjacent fields
- **Success Metrics**: Quantifiable indicators to measure application effectiveness and impact

### Transfer Acceleration:
- **Contextual Adaptation**: How to modify applications for different scenarios
- **Obstacle Navigation**: Anticipated challenges and proven mitigation strategies
- **Feedback Loops**: Methods for continuous refinement and improvement
- **Compound Effect Mapping**: How small changes create disproportionate results

**Deliverable**: Knowledge that rapidly transfers to long-term memory and consistently applies to real-world situations.

---

## COGNITIVE QUALITY STANDARDS
- **Precision**: Every concept serves the learning and application objectives
- **Hierarchy**: Clear, logical structure with explicit relationships between elements
- **Actionability**: Focus on knowledge that drives measurable behavioral change
- **Completeness**: Reader gains full cognitive value without requiring video access
- **Accessibility**: Complex ideas expressed with maximum clarity and minimum jargon
- **Verification**: All claims are grounded in provided content with transparency about uncertainties

## INTELLIGENCE QUALITY CONTROLS
- **Fidelity**: Maintain intellectual honesty and accuracy to source material
- **Bias Detection**: Flag assumptions, limitations, and potential blind spots
- **Evidence Grading**: Distinguish between proven facts, strong evidence, and speculation
- **Application Relevance**: Prioritize insights with clear practical utility
- **Cognitive Load**: Optimize for efficient processing and retention

## FINAL INTEGRATION CHECK
Before delivering, ensure:
- [ ] Each insight builds toward a coherent understanding
- [ ] Action steps are specific, measurable, and achievable
- [ ] Mental models are simple but powerful enough for broad application
- [ ] Questions probe deep understanding, not surface memorization
- [ ] The entire artifact can stand alone without the source video

Execute comprehensive knowledge distillation now.`
        );
    }

    /**
     * Create executive summary prompt (structured format with strategic insights)
     */
    // eslint-disable-next-line max-lines-per-function
    private createExecutiveSummaryPrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

# Executive Intelligence Report
You are a strategic intelligence analyst synthesizing critical insights from video content for executive decision-making.

## MISSION
Extract and synthesize the most strategically valuable information from the video into an executive-ready summary that enables rapid comprehension and actionable decision-making.

## ANALYTICAL FRAMEWORK
- **Strategic Lens**: Focus on implications for business, technology, or personal development
- **Evidence-Based**: Ground insights in specific data, examples, or demonstrations
- **Action-Oriented**: Emphasize practical applications and next steps
- **Risk/Reward**: Identify potential benefits and challenges

## DELIVERABLE STRUCTURE

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
  - strategic-insights
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; ` +
            `max-width: 100%; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" ` +
            'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen title="{{TITLE}}"></iframe>
</div>

---

## 🎯 Strategic Insights
**3-5 high-impact takeaways with immediate strategic value:**
- **[Insight Category]**: Specific, actionable intelligence with quantifiable impact
- **Business Implication**: How this affects competitive positioning or operational efficiency
- **Risk Factor**: Potential challenges or obstacles to consider
- **Opportunity Window**: Timing-sensitive opportunities or trends

---

## 📊 Executive Summary
> **Core Value Proposition:** [Central thesis and primary benefit]

**Strategic Analysis (200-250 words):**
- **Market Context**: How this content fits into broader industry trends
- **Competitive Advantage**: Unique insights that differentiate from common knowledge
- **Implementation Feasibility**: Practical considerations for adoption
- **Success Metrics**: How to measure the impact of applying these insights

---

## 🚀 Strategic Action Plan
**Priority initiatives for immediate consideration:**
- [ ] **[Strategic Initiative 1]**: Specific implementation with timeline and resources
- [ ] **[Strategic Initiative 2]**: Risk mitigation or opportunity capture strategy
- [ ] **[Strategic Initiative 3]**: Capability building or partnership opportunity
- [ ] **[Monitoring Item]**: Key indicators to track for success/failure

---

## 📚 Intelligence Repository

### **Cited Resources**
- **Technology/Tools**: Platforms, frameworks, or methodologies mentioned
- **Research/Data**: Studies, statistics, or evidence cited
- **Expert Sources**: Thought leaders, organizations, or institutions referenced
- **External Links**: Direct resources for deeper investigation

### **Strategic Expansion**
- **Adjacent Opportunities**: Related fields or applications worth exploring
- **Competitive Landscape**: How competitors might leverage similar insights
- **Future Trends**: Emerging developments that build on these concepts
- **Network Effects**: Communities, forums, or ecosystems for continued learning

## QUALITY ASSURANCE
- **Accuracy**: Verify all claims against provided content
- **Relevance**: Focus on insights with direct strategic application
- **Clarity**: Complex concepts explained for non-specialist executives
- **Independence**: Document stands alone without requiring video access
- **Actionability**: Every insight includes clear implementation guidance

Deliver comprehensive strategic intelligence now.`
        );
    }

    /**
     * Create tutorial prompt (Step-by-Step Guide)
     */
    private createDetailedGuidePrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

# Implementation Mastery Guide
You are a process optimization expert transforming instructional video content into a comprehensive, actionable implementation guide.

## MISSION
Convert the video content into a detailed, step-by-step tutorial that enables immediate implementation without requiring access to the original video.

## ANALYTICAL APPROACH
- **Process Decomposition**: Break down complex procedures into discrete, executable steps
- **Prerequisite Identification**: Identify required tools, knowledge, or resources
- **Failure Prevention**: Highlight common mistakes and how to avoid them
- **Verification Points**: Include checkpoints to confirm successful completion

## DELIVERABLE STRUCTURE

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
type: youtube-tutorial
format: tutorial
tags: [youtube, tutorial, implementation-guide]
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
</div>

---

## 📋 Core Summary
**Essential overview (200-250 words):**
- **Objective**: What this tutorial will help you accomplish
- **Scope**: What is covered and what is not
- **Expected Outcome**: What you will have achieved upon completion
- **Time Investment**: Estimated duration for full implementation

---

## 🛠️ Prerequisites & Preparation
**Before you begin, ensure you have:**
- **Tools Required**: Software, hardware, or physical tools needed
- **Knowledge Base**: Prerequisites or foundational concepts to understand
- **Environment Setup**: Configuration or preparation steps
- **Resources**: Links, templates, or materials to download beforehand

---

## 📝 Step-by-Step Implementation
**Sequential, actionable instructions:**

### Phase 1: Foundation Setup
1. **[Step Number]**: Detailed action with specific parameters
   - **Expected Result**: What success looks like at this stage
   - **Troubleshooting**: Common issues and solutions
   - **Alternative Path**: Different approaches for different contexts

### Phase 2: Core Implementation
2. **[Step Number]**: Next critical action with dependencies noted
   - **Verification**: How to confirm this step was successful
   - **Adjustments**: Variables that may need tweaking
   - **Integration**: How this connects to previous steps

### Phase 3: Optimization & Refinement
3. **[Step Number]**: Fine-tuning and enhancement procedures
   - **Quality Checks**: Validation methods to ensure optimal results
   - **Performance Indicators**: Metrics to monitor
   - **Scaling Considerations**: How to expand or adapt for different use cases

---

## ⚠️ Critical Success Factors
- **Common Pitfalls**: Mistakes that derail implementation
- **Key Decisions**: Points where choices significantly impact outcomes
- **Timing Considerations**: When certain actions should or shouldn't be taken
- **Resource Allocation**: How to distribute effort and attention effectively

---

## 📎 Resources & References
- **External Links**: Tools, documentation, or additional resources
- **Templates**: Downloadable assets or reusable components
- **Further Learning**: Advanced topics or related skills to develop
- **Community**: Forums or groups for ongoing support

## QUALITY STANDARDS
- **Actionability**: Every step is executable with available information
- **Completeness**: No gaps that require referencing the original video
- **Clarity**: Complex concepts explained in accessible terms
- **Verification**: Clear indicators of successful completion
- **Scalability**: Guidance for adapting to different contexts

Begin creating the comprehensive implementation guide now.`
        );
    }

    /**
     * Create Technical Video Analysis prompt
     */
    private createTechnicalAnalysisPrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

**Role:** You are a Senior Staff Engineer and Technical Lead.

**Task:** specific technical implementation details from the provided video transcript. Ignore engagement fluff (e.g., "Like and Subscribe," sponsor reads) and high-level theory unless necessary for context.

**1. The Tech Stack & Tools**
* List all languages, frameworks, libraries, and tools demonstrated or mentioned.
* Capture specific versions if stated (e.g., "Next.js 14" vs "Next.js 13").
* Note any hardware or environment configurations (e.g., "Running on AWS Lambda," "Local Docker setup").

**2. Architecture & System Design**
* Reconstruct the architecture described or drawn (whiteboard sessions) in the video.
* Identify specific design patterns used (e.g., CQRS, Event Sourcing, Singleton).
* Explain the data flow: How does data move from the client to the database?

**3. The "Code" (Implementation Details)**
* Extract specific commands, configuration settings, or code snippets mentioned.
* If actual code isn't provided in text, generate *accurate pseudo-code* based on the speaker's explanation of the logic.
* **Refactoring:** If the video shows a "Before vs. After" optimization, clearly describe the specific changes made.

**4. Engineering Trade-offs & "Hot Takes"**
* What specific problem is the creator trying to solve?
* Capture any "Hot Takes" or strong technical opinions (e.g., "Why I stopped using Redux").
* List the specific trade-offs mentioned (e.g., "This approach is faster but uses more memory").

**5. Reproduction Steps / Tutorial Guide**
* Convert the video into a concise, numbered step-by-step guide to reproduce the result.
* **Step 1:** [Action]
* **Step 2:** [Action]

**Output Format:** Technical, precise, and high-signal. Use code blocks for all commands and syntax.

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
type: youtube-note
format: technical-analysis
tags: [youtube, technical, engineering]
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
</div>

---
`
        );
    }

    /**
     * Create Accelerated Learning prompt
     */
    private createAcceleratedLearningPrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

**Role:** You are an expert instructional designer and "Super-Learning" coach.

**Task:** Analyze the provided video transcript and generate a comprehensive learning summary based on the **3C Protocol**.

**Constraint:** Aggressively filter out "YouTuber fluff" (intros, sponsor reads, "like and subscribe" reminders, and merchandise plugs). Focus strictly on the educational content.

**1. COMPRESS (Efficient Reduction)**
* **The 80/20 Rule:** What is the "Vital 20%" of this video that provides 80% of the value?
* **Mental Models & Visuals:** Describe the core analogies or metaphors the speaker uses. If they describe a specific visual or diagram to explain a concept, describe it clearly here.
* **Key Concept Definitions:** Define the core terms introduced in the video.

**2. COMPILE (Active Application)**
* **The "How-To" Checklist:** Convert the speaker's narrative into a numbered, step-by-step action plan.
* **Tools & Resources:** List every specific app, website, book, or hardware mentioned in the video.
* **The "Quiz" Mode:** Create 3 specific scenario-based questions that test if I actually understood the video's lesson (include the answers at the very bottom).

**3. CONSOLIDATE (Retention & Review)**
* **The Big Picture:** How does this video connect to broader topics in this niche?
* **The "Cheat Sheet":** Provide a bulleted summary of the "Golden Nuggets"—the exact facts or quotes worth memorizing.

**Output Format:** Educational, encouraging, and structured for quick study.

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
type: youtube-note
format: accelerated-learning
tags: [youtube, learning, education]
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
</div>

---
`
        );
    }

    /**
     * Create Executive Briefing prompt
     */
    private createExecutiveBriefingPrompt(
        baseContent: string,
        videoUrl: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return (
            `${baseContent}

**Role:** You are a Media Analyst and Strategy Consultant.

**Task:** Provide a high-level executive briefing of the provided video transcript.

**Constraint:** Treat this as intelligence gathering. Ignore engagement metrics and focus on the claims and facts.

**1. BLUF (Bottom Line Up Front)**
* **The Headline:** A 1-sentence summary of the video's main argument.
* **The Verdict:** If this is a review or analysis, what is the speaker's final verdict? (e.g., "Buy," "Sell," "Wait," "Broken").

**2. Strategic Insights & Market Impact**
* **The "So What?":** Why does this video matter to the industry? (e.g., "This product launch threatens Company X's market share").
* **Key Data Points:** Extract specific benchmarks, prices, dates, or statistics mentioned.
* **Competitor Landscape:** Who are the main competitors or alternatives mentioned.

**3. Critical Analysis (Hype Check)**
* **Bias Detection:** Does the transcript indicate this is a sponsored segment? Is the speaker overly optimistic or critical?
* **The "Hype vs. Reality" Check:** Strip away the excitement—what are the actual downsides or limitations mentioned (often hidden at the end)?

**4. Recommended Actions**
* Based on this video, what action should be taken? (e.g., "Adopt this tool," "Monitor this trend," "Avoid this product").

**Output Format:** Professional, objective, and scannable.

---
title: {{TITLE}}
source: ${videoUrl}
created: "${new Date().toISOString().split('T')[0]}"
type: youtube-note
format: executive-briefing
tags: [youtube, briefing, strategy]
video_id: "${videoId ?? 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
</div>

---
`
        );
    }

    /**
     * Create custom format prompt: adaptable analysis based on user instructions
     */
    // eslint-disable-next-line max-lines-per-function
    private createCustomFormatPrompt(
        baseContent: string,
        _videoData: VideoData,
        videoUrl: string,
        customInstructions?: string,
        _performanceMode: PerformanceMode = 'balanced',
    ): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        // Determine user instructions for custom template
        const userInstructions = customInstructions?.trim()
            ? `USER'S CUSTOM INSTRUCTIONS:\n${customInstructions}\n\n`
            : ''; // If no custom instructions, just an empty string

        return (
            `${baseContent}

You are an adaptive content analyst capable of providing customized analysis based on ` +
            "specific user requirements. Your task is to analyze content according to the user's " +
            `explicit instructions while maintaining high quality standards.

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
<iframe width="640" height="360" src="${embedUrl}" title="{{TITLE}}" frameborder="0" ` +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; ' +
            'picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" ' +
            `allowfullscreen></iframe>
</div>

---
`
        );
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

        let updatedContent = content.replace(/__AI_PROVIDER__/g, providerValue).replace(/__AI_MODEL__/g, modelValue);

        updatedContent = this.ensureFrontMatterValue(updatedContent, 'ai_provider', providerValue);
        updatedContent = this.ensureFrontMatterValue(updatedContent, 'ai_model', modelValue);

        return updatedContent;
    }

    private ensureFrontMatterValue(content: string, key: string, value: string): string {
        const pattern = new RegExp(`(${key}\\s*:\\s*)(["'])?([^"'\\n]*)(["'])?`, 'i');
        if (pattern.test(content)) {
            return content.replace(
                pattern,
                (_: string, prefix: string, openingQuote?: string, _existing?: string, closingQuote?: string) => {
                    const quote = (openingQuote ?? closingQuote) ? '"' : '';
                    return `${prefix}${quote}${value}${quote}`;
                },
            );
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
        return Boolean(prompt) && typeof prompt === 'string' && prompt.trim().length > 10 && prompt.length < 50000; // Reasonable upper limit
    }
}
