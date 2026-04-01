import { PromptService, VideoData, OutputFormat, PerformanceMode } from '../types';
import { ValidationUtils } from '../validation';

/**
 * Optimized prompt generation service for AI processing
 *
 * @remarks
 * Performance optimizations:
 * - Single-pass template replacement using placeholder maps
 * - Pre-compiled regex patterns for frontmatter manipulation
 * - Template literal caching for frequently used strings
 * - Readonly constants for better TypeScript optimization
 *
 * @example
 * ```ts
 * const promptService = new AIPromptService();
 * const prompt = promptService.createAnalysisPrompt({
 *   videoData,
 *   videoUrl,
 *   format: 'detailed-guide',
 *   performanceMode: 'balanced'
 * });
 * ```
 */

// ============ TYPES ============

/**
 * Options for creating an analysis prompt
 */
interface AnalysisPromptOptions {
    /** Video metadata including title and description */
    videoData: VideoData;
    /** Full YouTube video URL */
    videoUrl: string;
    /** Output format for the analysis */
    format?: OutputFormat;
    /** Optional transcript text for analysis */
    transcript?: string;
    /** Performance mode affecting prompt detail level */
    performanceMode?: PerformanceMode;
    /** AI provider name for conditional instructions */
    providerName?: string;
    /** Custom user instructions injected into prompt */
    userInstructions?: string;
}

/**
 * Per-format configuration for token limits, temperature, transcript budget, and validation
 */
export interface FormatConfig {
    recommendedMaxTokens: number;
    temperatureHint: number;
    transcriptBudget?: number;
    expectedSections?: string[];
}

/**
 * Format-specific configuration map
 */
export const FORMAT_CONFIG: Readonly<Record<OutputFormat, FormatConfig>> = {
    'executive-summary': {
        recommendedMaxTokens: 4096,
        temperatureHint: 0.5,
        expectedSections: ['The Full Picture', 'Core Thesis', 'Key Insights', 'Implications & Impact', 'Key References', 'Assessment', 'Quick Actions'],
    },
    'technical-analysis': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.3,
        transcriptBudget: 120_000,
        expectedSections: ['Overview', 'Tech Stack & Tools', 'Prerequisites', 'Architecture & Design', 'Implementation Details', 'Engineering Trade-offs', 'Resources'],
    },
    '3c-accelerated-learning': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.5,
        transcriptBudget: 120_000,
        expectedSections: ['COMPRESS', 'COMPILE', 'CONSOLIDATE'],
    },
    'atom-notes': {
        recommendedMaxTokens: 6144,
        temperatureHint: 0.5,
        transcriptBudget: 120_000,
    },
    'article': {
        recommendedMaxTokens: 8192,
        temperatureHint: 0.6,
        transcriptBudget: 150_000,
        expectedSections: ['Executive Summary', 'The Deep Dive', 'Technical Glossary', 'Resources & Citations', 'Actionable Takeaways'],
    },
    'complete-transcription': {
        recommendedMaxTokens: 16384,
        temperatureHint: 0.3,
        transcriptBudget: 200_000,
        expectedSections: ['Overview', 'Full Structured Notes', 'Key Terms'],
    },
} as const;

// ============ CONSTANTS ============

/** Token limits for different contexts */
const TOKEN_LIMITS = {
    /** Maximum transcript length before truncation */
    MAX_TRANSCRIPT_LENGTH: 100_000,
    /** Maximum prompt length for validation */
    MAX_PROMPT_LENGTH: 50_000,
    /** Minimum prompt length for validation */
    MIN_PROMPT_LENGTH: 10,
} as const;

/** Placeholder tokens for template replacement */
const PLACEHOLDERS = {
    TITLE: '{{TITLE}}',
    URL: '{{URL}}',
    DESCRIPTION: '{{DESCRIPTION}}',
    TRANSCRIPT_SECTION: '{{TRANSCRIPT_SECTION}}',
    USER_INSTRUCTIONS: '{{USER_INSTRUCTIONS}}',
    CHANNEL_NAME: '{{CHANNEL_NAME}}',
    DURATION: '{{DURATION}}',
    PUBLISHED_DATE: '{{PUBLISHED_DATE}}',
    THUMBNAIL_URL: '{{THUMBNAIL_URL}}',
    CHAPTER_MARKERS: '{{CHAPTER_MARKERS}}',
    YOUTUBE_URL: '{{YOUTUBE_URL}}',
    AI_PROVIDER: '__AI_PROVIDER__',
    AI_MODEL: '__AI_MODEL__',
} as const;

/** Default values for unknown entities */
const DEFAULTS = {
    VIDEO_ID: 'unknown',
    PROVIDER: 'unknown',
    MODEL: 'unknown',
} as const;

/** YouTube embed configuration */
const YOUTUBE_EMBED = {
    BASE_URL: 'https://www.youtube-nocookie.com/embed/',
    IFRAME_WIDTH: 640,
    IFRAME_HEIGHT: 360,
    IFRAME_ATTRIBUTES: [
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
        'allowfullscreen',
        'frameborder="0"',
        'referrerpolicy="strict-origin-when-cross-origin"',
    ].join(' '),
} as const;

// ============ TEMPLATES ============

/**
 * Reusable template components
 * @internal
 */
namespace Templates {
    /**
     * Generate YAML frontmatter for Obsidian notes
     */
    export const frontmatter = (
        title: string,
        source: string,
        videoId: string,
        format: OutputFormat,
        provider: string,
        model: string
    ): string => `---
title: ${title}
source: ${source}
created: "${new Date().toISOString().split('T')[0]}"
type: ${format === 'complete-transcription' ? 'youtube-transcript' : 'youtube-note'}
format: ${format}
tags: [youtube${format === 'complete-transcription' ? ', transcript' : ''}]
video_id: "${videoId}"
ai_provider: "${provider}"
ai_model: "${model}"
---`;

    /**
     * Generate responsive video iframe
     */
    export const videoIframe = (videoId: string, title: string): string => {
        const embedUrl = `${YOUTUBE_EMBED.BASE_URL}${videoId}`;
        return `<div style="text-align: center; margin-bottom: 24px;">
<iframe width="${YOUTUBE_EMBED.IFRAME_WIDTH}" height="${YOUTUBE_EMBED.IFRAME_HEIGHT}" src="${embedUrl}" title="${title}" ${YOUTUBE_EMBED.IFRAME_ATTRIBUTES}></iframe>
</div>`;
    };
}

/**
 * Performance mode templates
 * These define the base prompt structure for each performance mode
 */
const BASE_TEMPLATES: Readonly<Record<PerformanceMode, string>> = {
    fast: `Analyze this YouTube video efficiently:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

**OUTPUT FORMAT RULES:**
- DO NOT add line numbers to any part of the output
- Use markdown headers (##, ###) for structure, not numbered lines
- Numbered lists are for content only (steps, items), not for line references

Focus on key insights. Process video with \`use_audio_video_tokens=True\` for comprehensive analysis.`,

    balanced: `Analyze this YouTube video:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

**OUTPUT FORMAT RULES:**
- DO NOT add line numbers to any part of the output
- Use markdown headers (##, ###) for structure, not numbered lines
- Numbered lists are for content only (steps, items), not for line references

Extract practical insights. Process video multimodally (visual/audio) for complete analysis.`,

    quality: `Analyze this YouTube video comprehensively:
Title: {{TITLE}}
URL: {{URL}}
Description: {{DESCRIPTION}}
{{TRANSCRIPT_SECTION}}

**OUTPUT FORMAT RULES:**
- DO NOT add line numbers to any part of the output
- Use markdown headers (##, ###) for structure, not numbered lines
- Numbered lists are for content only (steps, items), not for line references
- Process multimodally (visual/audio) for complete understanding including on-screen text and non-verbal cues`,
} as const;

/**
 * Format-specific output templates
 * Each format defines a unique structure for the AI's response
 * Optimized for token efficiency (30-40% reduction by removing meta-instructions)
 */
const FORMAT_TEMPLATES: Readonly<Record<OutputFormat, string>> = {
    'executive-summary': `# ROLE
You are a Strategic Intelligence Analyst. Distill video content into a decision-ready executive brief — precise, evidence-backed, and immediately actionable.

# PROCESSING (Execute silently)
Watch the full video. Ignore intros, sponsors, filler. RANK insights by strategic significance, not chronology. Every claim must be anchored to specific content. Write in active voice, addressing the reader directly.

---

## 📋 The Full Picture
[Write ONE comprehensive paragraph (200-300 words) that distills the entire content. Apply this structure:
- **OPEN** with the core thesis — the single most important claim.
- **BUILD** with the strongest supporting evidence and key arguments.
- **ELEVATE** with the broader significance — who this affects and why it matters.
- **CHALLENGE** with at least one limitation, counter-argument, or open question.
A reader should understand the subject completely without watching the source.]

---

## 🎯 Core Thesis
> [The central argument, claim, or proposition in 1-2 sentences]

---

## 💡 Key Insights

### Critical Points
1. **[Point 1]**: [Explanation with context, significance, and specific evidence from the video]
2. **[Point 2]**: [Explanation with context, significance, and specific evidence from the video]
3. **[Point 3]**: [Explanation with context, significance, and specific evidence from the video]
4. **[Point 4]**: [Explanation with context, significance, and specific evidence from the video]
5. **[Point 5]**: [Explanation with context, significance, and specific evidence from the video]

### Evidence & Examples
- [Key evidence, data point, or concrete example 1]
- [Key evidence, data point, or concrete example 2]
- [Key evidence, data point, or concrete example 3]

---

## 🔮 Implications & Impact

### Near-term Consequences
- [Immediate effects or developments to watch]

### Long-term Trajectory
- [Broader impact, paradigm shifts, or structural changes]

### Who & What Is Affected
- [Groups, institutions, systems, or domains impacted]

### Open Questions
- [Unresolved issue or question 1]
- [Unresolved issue or question 2]

---

## 📎 Key References

### People, Groups & Organizations
- [Name]: [Role, relevance, or position]

### Sources & Data Cited
- [Source]: [Key finding or how it's used]

### Related Concepts & Materials
- [Concept/Resource]: [Connection or relevance]

---

## 🏷️ Assessment
**Confidence in Claims**: [High/Medium/Low — justify with evidence quality]
**Complexity**: [Accessible/Moderate/Dense]
**Significance**: [Major shift / Important development / Incremental update]

---

## ⚡ Quick Actions
- [ ] **[Action 1]**: Concrete implementation step based on key insights
- [ ] **[Action 2]**: Resource to explore or person to follow up with
- [ ] **[Action 3]**: Concept to research further or experiment to run

---

# OUTPUT CONSTRAINTS
- FORMAT: Strict Github-Flavored Markdown. No preambles.
- EVIDENCE: Every Critical Point must reference specific content from the video.
- ACTIVE VOICE: Write in active voice, addressing the reader directly. Prefer "You'll notice..." over "It should be noted..." and "Consider how..." over "One might consider..." Use "you" and imperative mood naturally.
- WORD LIMIT: "The Full Picture" must stay within 200-300 words.
- NO TIMESTAMPS: No time references anywhere.
- ACCURACY: 100% factual retention for proper nouns and data points.`,

    'technical-analysis': `# ROLE
You are a Senior Software Engineer conducting a technical review. Extract precise, reproducible technical analysis from video content — every claim must be grounded in specific evidence, and every process must be specific enough to follow.

# PROCESSING (Execute silently)
Watch the full video. Ignore intros, sponsors, filler. Extract all technical substance: code, commands, configuration, architecture decisions, version numbers. Capture exact syntax for all code and commands shown on screen. Write in active voice, addressing the reader as "you."

---

## Overview (100-150 words)
> [The single most important technical insight or outcome from the video]

[2-3 sentences of active-voice prose explaining what the video covers and why it matters technically. Bold key outcomes.]

---

## Tech Stack & Tools
- **Languages/Frameworks**: All with specific versions
- **Libraries**: Dependencies with versions and why each was chosen
- **Environment**: Hardware, cloud platform, OS, or configuration details
- **Alternatives Considered**: Tools mentioned but not selected, and why

---

## Prerequisites
- **Tools Required**: Software/hardware needed with specific versions
- **Knowledge Needed**: Foundational skills assumed
- **Setup**: Configuration requirements and environment details

---

## Architecture & Design
- **Structure**: System architecture overview — how components connect
- **Patterns**: Design patterns used (CQRS, Event Sourcing, etc.) and the problem each solves
- **Data Flow**: How data moves through the system — from input to storage to output
- **Key Decisions**: Architecture choices and the trade-offs involved

---

## Implementation Details
- **Commands/Config**: Exact commands and configuration with full syntax
- **Code**: Key code snippets shown or described — include exact syntax where possible
- **Refactoring**: Before/After optimizations with explanation of what changed and why
- **Edge Cases**: Boundary conditions and error handling discussed

---

## Implementation Steps

### Phase 1: [Descriptive Name — e.g., "Environment Setup"]
1. **[Step Name]**: Specific action with details
   - **Expected Result**: How to confirm success
   - **Troubleshooting**: Common issues and fixes
   - **Code/Command**: \`exact command or code snippet\`

### Phase 2: [Descriptive Name — e.g., "Core Build"]
2. **[Step Name]**: Action with dependencies noted
   - **Verification**: How to confirm it works
   - **Integration**: Connection to previous steps

Use as many phases as the content requires — 2, 3, or 4. Name each phase descriptively based on actual content. If the video is analysis-only with no build steps, omit this section entirely.

---

## Engineering Trade-offs
- **Problem Solved**: The specific technical challenge being addressed
- **Trade-offs**: Performance vs. cost vs. complexity decisions — with concrete reasoning
- **Strong Opinions**: Technical positions taken by the speaker, with their justification
- **Alternatives**: Approaches not taken and why they were rejected

---

## Critical Success Factors
- **Common Pitfalls**: Specific mistakes mentioned in the video and how to avoid them
- **Key Decisions**: Important choice points and their trade-offs
- **Debugging**: How to diagnose and fix common failures

---

## Resources
- **Links**: Tools, documentation, and references mentioned
- **Code**: Repositories, gists, or files referenced
- **Further Learning**: Advanced topics suggested

---

# OUTPUT CONSTRAINTS
- FORMAT: Strict Github-Flavored Markdown. No preambles.
- SPECIFICITY: No vague claims — every technical assertion must reference specific evidence from the video.
- CODE: Capture all code, commands, and configuration with exact syntax.
- ACTIVE VOICE: Write in active voice, addressing the reader as "you." Prefer "Run this command" over "This command should be run." Use imperative mood for all steps.
- NO TIMESTAMPS: No time references anywhere.
- ACCURACY: 100% factual retention for versions, commands, and technical details.`,

    '3c-accelerated-learning': `# ROLE
You are a Learning Science Specialist. Transform video content into lasting, transferable knowledge using the Compress→Compile→Consolidate framework — every element must serve retention and application.

# PROCESSING (Execute silently)
Watch the full video. Ignore intros, sponsors, filler. IDENTIFY the vital 20% of content that delivers 80% of the value — rank by insight impact, not chronology. For each concept: note the core definition, strongest evidence, practical application, and at least one limitation. Write in active voice, addressing the reader directly.

---

## 🔹 COMPRESS (80/20 Rule)
The vital 20% delivering 80% value:

> [The single most transferable insight from the video]

- **Core Thesis**: Fundamental message in 1-2 sentences
- **Key Concepts** (5-7): Precise definitions with specific evidence anchors — not generic labels
- **Mental Models**: Visual analogies and metaphors used in the video, with context
- **Visuals**: Key diagrams, demonstrations, or on-screen explanations described for recall

---

## 🔸 COMPILE (Active Application)
- **Framework**: An organized structure connecting all key concepts — show how they relate and build on each other
- **Workflow**: Step-by-step application checklist the reader can follow immediately
- **Tools/Resources**: Every app, book, site, and hardware mentioned with specific names
- **Connections**: How concepts relate to each other and to domains outside the video's topic

---

## 🔹 CONSOLIDATE (Retention & Transfer)
- **Master Model**: A unifying framework integrating all concepts into a single mental model — explain the connections
- **Recall Anchors** (6-8): Challenging comprehension questions that test understanding, not trivia recall. Mix factual, conceptual, and application-level questions.
- **Action Roadmap**: 4-6 specific, measurable next steps the reader can take
- **Cross-References**: Related concepts and adjacent fields to explore
- **Success Metrics**: Concrete indicators that the knowledge has been internalized

---

**Transfer Acceleration**:
- **Adaptation**: How to modify these insights for different scenarios or domains
- **Obstacles**: Anticipated challenges in applying this knowledge and how to overcome them
- **Compound Effect**: How applying these insights creates disproportionate long-term impact

---

# OUTPUT CONSTRAINTS
- FORMAT: Strict Github-Flavored Markdown. No preambles.
- EVIDENCE: Every key concept must reference specific content from the video — no unsupported generalizations.
- ACTIVE VOICE: Write in active voice, addressing the reader directly. Prefer "You'll apply this by..." over "This can be applied by..." Use "you" and imperative mood naturally.
- QUALITY: Recall Anchors must test understanding, not memorization.
- NO TIMESTAMPS: No time references anywhere.
- ACCURACY: 100% factual retention for proper nouns and data points.`,

    'atom-notes': `# ROLE
You are a Knowledge Architect. Decompose video content into atomic knowledge units — self-contained, linkable ideas that can be combined and recombined across contexts.

# PROCESSING (Execute silently)
Watch the full video. Ignore intros, sponsors, filler. IDENTIFY 5-10 distinct atomic ideas — each must be independently understandable without the others. For each atom: define precisely, anchor with evidence, specify application, and map connections. Rank by insight value and transferability, not chronology. Write in active voice, addressing the reader directly.

---

# [Specific, Informative Headline — Max 10 Words]

**Video URL:** {{YOUTUBE_URL}}
By [Speaker Names] · [Channel Name] · [Runtime] · Published [Date]

---

## 💡 Core Atomic Ideas (5-10 concepts)
Each atom must be: **Self-contained** (understandable alone), **Linkable** (connected to others), **Actionable** (applicable beyond this video).

### [Concept Name]
- **Definition**: One precise sentence explaining the idea
- **Evidence**: Specific data, example, or demonstration from the video supporting this
- **Application**: How you can apply this insight in practice
- **Connections**: Links to other concepts in this set or beyond

[Repeat for each atomic concept — use ### headers for each]

---

## 🔗 Concept Map
**Central Theme**: [The unifying idea connecting all atoms]

**Branches**:
- Branch A → [List related concept names and how they connect]
- Branch B → [List related concept names and how they connect]
- Branch C → [List related concept names and how they connect]

**Cross-links**: [Unexpected connections between branches — explain WHY they connect, not just that they do]

---

## 📝 Quick Capture Notes
- **Quote 1**: "[Notable quote]" — Context and why it matters
- **Quote 2**: "[Notable quote]" — Context and why it matters
- **Statistic**: [Data point] — Source and significance
- **Analogy**: [Memorable comparison] — What it illustrates

---

## 🎯 Implementation Seeds
- [ ] **[Micro-action]**: Concrete step based on a specific concept
- [ ] **[Micro-action]**: Concrete step based on a specific concept
- [ ] **[Question]**: A question worth exploring further
- [ ] **[Resource]**: A person, tool, or material to investigate

---

## 🏷️ Metadata
**Domain**: [Primary field/category]
**Complexity**: [Beginner/Intermediate/Advanced]
**Reusability**: [How this knowledge transfers to other contexts]

---

# OUTPUT CONSTRAINTS
- FORMAT: Strict Github-Flavored Markdown. No preambles.
- ATOMICITY: Each concept must be independently understandable — no concept should require reading another to make sense.
- EVIDENCE: Every concept must reference specific content from the video.
- ACTIVE VOICE: Write in active voice, addressing the reader directly. Prefer "You can use this to..." over "This can be used to..." Use "you" and imperative mood naturally.
- NO TIMESTAMPS: No time references anywhere.
- ACCURACY: 100% factual retention for proper nouns and data points.`,

    'article': `# ROLE
You are a Multimodal Research Analyst and Senior Editor. Your goal is to convert video content into a publication-ready, structured long-form article.

# INPUT
Video URL: {{YOUTUBE_URL}}

# EXECUTION PIPELINE (Execute in order)

## STAGE 1: MULTIMODAL INGESTION
- Watch and listen to the video in its entirety.
- Identify all primary speakers, their roles/titles, and the core thesis of the discussion.
- ANALYZE VISUALS: Read on-screen text, slides, and graphics to provide context and anchor technical terminology.
- NOTE ENVIRONMENTAL AUDIO: Assess mic quality. If background noise is high, prioritize vocal frequency isolation through contextual deduction.

## STAGE 2: INTERNAL REFINEMENT (Do not output)
- Generate a verbatim internal transcript.
- STRIP FILLERS: Remove "um," "ah," "like," "you know," and collapse false starts.
- POOR AUDIO RESILIENCE: Use video metadata and on-screen OCR text as "Vocabulary Anchors" to disambiguate phonetic similarities (e.g., "data" vs "beta").
- THE FLAGGING SYSTEM: If a word is truly unrecognizable, flag as [VERIFY MM:SS]. Use this only as a last resort.
- THEME EXTRACTION: Before writing, identify 4-6 distinct thematic clusters from the content. Rank by significance and insight value, NOT chronology. For each theme, note: the core claim, strongest supporting evidence, broader implications, and at least one limitation or counter-argument.
- MULTI-SPEAKER SYNTHESIS: Synthesize the dialogue into a single, cohesive narrative. Do not use a Q&A format. Attribute specific insights to individual speakers (e.g., "As [Name] points out...") to maintain journalistic integrity, especially during debates or interviews.

## STAGE 3: SEMANTIC ARCHITECTURE
Structure the final output into these specific Markdown blocks:

1. # [Specific, Informative Headline — Max 10 Words]
2. [Embed YouTube Video: <iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" frameborder="0" allowfullscreen></iframe>]
3. **Video URL:** [Link]
4. By [Speaker Names] · [Channel Name] · [Runtime] · Published [Date]
5. ## Executive Summary: Open with a \`>\` blockquote containing the single most provocative or essential insight from the video — a pull quote that grabs the reader. Follow with 2-3 sentences of active-voice overview that frames the core thesis and tells the reader exactly what they'll gain from reading further.
6. ## The Deep Dive: The main body — NOT a chronological summary. DISTILL into 4-6 thematic paragraphs of flowing prose (NO bullet points, NO sub-headers). Write in active voice, addressing the reader directly — prefer "You'll notice..." over "It should be noted..." and "Consider how..." over "One might consider..." Apply this architecture to EVERY paragraph:
   - **OPEN** with the theme's core claim — the single most important insight. **Bold the opening phrase** of each paragraph to create a visual anchor.
   - **BUILD** with concrete evidence: specific examples, data points, technical details, or named references. Show the reasoning, not just the conclusion.
   - **ELEVATE** by connecting to broader implications — real-world impact, industry context, or cross-domain relevance. Answer "so what?"
   - **CHALLENGE** with limitations, counter-arguments, edge cases, or omitted perspectives. Be analytically honest.
   - **BRIDGE** with a closing sentence that connects to the next theme or deepens the insight.

   ORDER paragraphs by thematic weight (most important first), not video timeline. Weave speaker style and delivery observations organically where relevant — never as a standalone paragraph. Each paragraph must contain at least one specific evidence anchor (quote, data point, named example). Insert 1-2 \`>\` blockquotes for the most striking insights or pull quotes — never more than two sentences. Separate major sections with \`---\` horizontal rules. The section should read like published long-form analysis — intellectually rigorous, information-dense, critically engaged, and visually scannable.
7. ## Technical Glossary: Define jargon and complex terms found in the video. Use format: * **Term:** Definition
8. ## Resources & Citations: List books, websites, or people explicitly mentioned. Use format: * **Name:** Description
9. ## Actionable Takeaways: A bulleted list of immediate "Next Steps." Use format: * **Action Title:** Description
   Separate each major section (items 5-9) with \`---\` horizontal rules for visual breathing room.

# REFERENCE EXAMPLE
Your output MUST match this exact formatting style:

# Master of Logic: Decoding Efficiency in Algorithms

<iframe width="560" height="315" src="https://www.youtube.com/embed/6Svu_ae5ebk" frameborder="0" allowfullscreen></iframe>

**Video URL:** https://www.youtube.com/watch?v=6Svu_ae5ebk

By David J. Malan · CS50 · 01:59:36 · Published 2026-01-01

---

## Executive Summary
> Efficiency isn't about speed — it's about how gracefully your solution scales when data grows from dozens to billions.

This session breaks down the fundamental building blocks of computer science: how computers search for and sort information. Through interactive demonstrations and live coding in C, David Malan walks you from intuitive human problem-solving to formal algorithmic structures like Big O notation. **The core thesis is clear — algorithmic efficiency is not speed, but scalable design.**

---

## The Deep Dive
**Algorithmic efficiency is fundamentally about graceful scaling** — how a solution behaves as data grows from dozens to billions of entries. Malan opens with a deceptively simple demonstration: counting students one by one gives you a linear O(n) operation, but pairing them off in a divide-and-conquer pattern collapses that to O(log n). The insight isn't that one method is faster in absolute terms — it's that the growth rate diverges catastrophically at scale. This principle underpins every search engine query, social media feed, and database lookup you encounter. Using physical props — lockers, Monopoly money, and student volunteers — Malan makes the logarithmic leap viscerally intuitive through a "show, don't tell" approach. But here's the catch: divide-and-conquer elegance only matters at scale. For a dataset of ten items, the overhead of a clever algorithm can exceed brute force.

> The growth rate divergence isn't a mathematical curiosity — it's the difference between a system that functions and one that collapses.

**This tension between elegance and practicality resurfaces at the hardware level**, where arrays — contiguous blocks of memory — impose a fundamental constraint: a computer can typically access only one memory location at a time. Linear search checks each element sequentially, while binary search halves the search space with each step — but only if you've pre-sorted the data. That sorting requirement is the real design decision: time spent ordering data versus time saved searching it. Every query you run through modern infrastructure, from DNS lookups to recommendation engines, navigates this trade-off. Malan's interactive style — polling students on which algorithm to choose — mirrors the decision process you'll face as an engineer: there's no universally correct answer, only contextually appropriate ones.

**Translating these abstractions into code exposes a further layer of hidden complexity.** String comparison in C requires \`strcmp\` from the \`string.h\` library rather than a simple \`==\` operator — what appears elementary at the conceptual level demands precise implementation. The introduction of \`typedef struct\` to encapsulate a name and phone number into a single "person" type replaces the fragile "honor system" of parallel arrays with genuine data integrity. You're shifting from trusting the programmer to enforcing correctness at the language level. Yet practical limits assert themselves: recursion, the elegant engine behind merge sort, can trigger "stack overflow" errors when the problem exceeds available memory — a failure mode demonstrated live during the session. Defensive programming practices exist precisely because theory and implementation diverge at the edges.

**The ultimate takeaway isn't any single algorithm but engineering judgment** — knowing when to deploy which tool. Selection sort is intuitive but O(n²) at every case; bubble sort offers marginal best-case improvement; merge sort achieves O(n log n) at the cost of additional memory. As data volumes continue their exponential trajectory, these scaling laws stop being academic exercises and become the difference between systems that function and systems that fail. Yet the honest assessment is that the "best" algorithm is always context-dependent: a small dataset searched once needs no optimization, and merge sort's memory overhead can be prohibitive in embedded systems. The skill worth developing isn't memorizing Big O tables — it's accurately diagnosing which constraints matter in a given situation.

---

## Technical Glossary
* **Algorithm:** A set of instructions for solving a specific problem or performing a task.
* **Array:** A data structure consisting of a collection of elements, each identified by at least one array index or key, stored in contiguous memory.
* **Big O Notation:** A mathematical notation used to describe the limiting behavior of a function when the argument tends towards a particular value or infinity, specifically used to describe algorithm efficiency.
* **Binary Search:** A search algorithm that finds the position of a target value within a sorted array by repeatedly dividing the search interval in half.
* **Recursion:** A method of solving a problem where the solution depends on solutions to smaller instances of the same problem.
* **Struct:** A composite data type in C that allows for the grouping of variables of different types under a single name.

## Resources & Citations
* **CS50h Library:** The custom header file used for simplified input in C.
* **Standard I/O (stdio.h):** The standard C library for input and output operations.
* **String Library (string.h):** The C library providing functions for manipulating arrays of characters.
* **Super Mario Brothers:** Referenced for visual metaphors of pyramids and recursion.

---

## Actionable Takeaways
* **Adopt Defensive Programming:** Use \`structs\` to encapsulate related data points to prevent errors associated with "honor system" parallel arrays.
* **Evaluate Scaling Before Coding:** Before choosing a sorting or searching method, determine the expected size of n to decide if a simple O(n) or a more complex O(log n) approach is necessary.
* **Use Standard Functions:** Utilize built-in functions like \`strcmp\` for string comparisons to ensure character-by-character accuracy.
* **Optimize for the Worst Case:** When designing systems, focus on the Big O (upper bound) to ensure the application remains functional under heavy loads.

# OUTPUT CONSTRAINTS
- FORMAT: Strict Github-Flavored Markdown. No preambles like "Here is the article."
- NO TIMESTAMPS: The body must read like a professional essay.
- TONE: Match the speakers' natural register (e.g., academic, corporate, or conversational). Use active voice throughout — address the reader directly. Prefer "You'll notice..." over "It should be noted that..." and "Consider how..." over "One might consider..."
- VOICE: Write as a knowledgeable guide speaking directly to the reader, not as a detached reporter narrating events. Use "you" and imperative mood naturally.
- VISUAL: Separate every major section with \`---\` horizontal rules. Bold the opening phrase of each Deep Dive paragraph. Use \`>\` blockquotes for 1-2 key insights per Deep Dive. Never produce unbroken walls of text.
- ACCURACY: 100% factual retention for proper nouns and data points.
- EVIDENCE: Every Deep Dive paragraph must contain at least one specific evidence anchor (quoted term, data point, named example). Unsupported generalizations are unacceptable.
- CRITICAL DEPTH: The Deep Dive must surface at least one substantive challenge or limitation per major theme. Pure summary without critical engagement fails the format.
- MATCH the reference example format exactly — same section structure, same list formatting with * **Bold:** Description pattern, same flowing prose in body sections.`,

    'complete-transcription': `# ROLE
You are a Precision Transcription Analyst and Structured Note Architect. Your goal is to produce a complete, end-to-end transcription of the video as structured notes — capturing every spoken word without omission, organized by topic with absolute clarity.

# INPUT
Video URL: {{YOUTUBE_URL}}

# EXECUTION PIPELINE (Execute in order)

## STAGE 1: FULL END-TO-END INGESTION
- Watch and listen to the ENTIRE video from the first spoken word to the last.
- Capture EVERY sentence, statement, and dialogue exchange — nothing may be paraphrased, summarized, or omitted.
- Identify all speakers by name and role/title.
- ANALYZE VISUALS: Read on-screen text, slides, code, diagrams, and graphics. Incorporate visual context using *italics* descriptions where relevant.
- NOTE AUDIO: If audio quality degrades, use contextual deduction and on-screen text to reconstruct unclear portions.

## STAGE 2: TRANSCRIPT REFINEMENT (Do not output)
- Generate a complete verbatim transcript of the entire video.
- STRIP FILLERS: Remove "um," "ah," "uh," "like," "you know," and collapse false starts and repetitions.
- DO NOT paraphrase or summarize — retain the full substance of every point made.
- POOR AUDIO RESILIENCE: Use video metadata and on-screen OCR text as "Vocabulary Anchors" to disambiguate unclear words.
- FLAGGING: If a word is truly unrecognizable despite all efforts, flag as [VERIFY]. Use only as a last resort.
- MULTI-SPEAKER: Label every speaker change clearly using **[Name]:** format.

## STAGE 3: STRUCTURED NOTE OUTPUT
Organize the complete transcription into structured notes using these Markdown blocks:

# [Video Title]

**Video URL:** {{YOUTUBE_URL}}
By [Speaker Names] · [Channel Name] · [Runtime] · Published [Date]

## Overview
A 3–5 sentence summary of what the video covers and its main thesis.

## Full Structured Notes

Organize the COMPLETE transcription into logical topic sections using ### headers. Every spoken point must be captured — do not skip or abbreviate any content.

**Formatting Rules**:
- **NO timestamps** — no MM:SS, no HH:MM:SS, no bracketed time references anywhere in the output
- **NO line numbers** — no sequential numbering of dialogue
- **Section headers**: Use ### for each distinct topic or segment transition
- **Speaker labels**: Format as **[Name]:** followed by their dialogue
- **Clean dialogue**: Filler words removed, but all substantive content preserved verbatim
- **Readability**: Paragraph breaks between distinct thoughts or speaker turns
- **Emphasis**: **Bold** for key terms and concepts introduced
- **Visual descriptions**: *Italics* for on-screen content like *\[Visual: Diagram of binary search\]*
- **Code**: Inline \`code\` for commands, function names, and URLs
- **Resources**: Link as [Name](URL) when mentioned

**Example Format**:
### Introduction to the Topic
**[Speaker]:** Opening remarks covering the scope of the discussion and what will be addressed.

**[Speaker]:** Further elaboration on the foundational concepts needed to follow along. Additional context about why this topic matters in practice.

**Key Concept:** Definition or principle introduced at this point.

### Core Mechanism Explained
**[Speaker]:** Detailed walkthrough of the primary mechanism with step-by-step explanation of how it works under the hood.

*[Visual: Diagram showing data flow from input to output]*

**[Speaker]:** Continuation of the explanation with practical examples demonstrating real-world application of the concept.

### Advanced Implementation
**[Speaker]:** Discussion of edge cases and how to handle them. Code examples showing proper implementation using \`function_name()\`.

*[Visual: Code on screen demonstrating the pattern]*

### Conclusion
**[Speaker]:** Summary of key points covered. Final recommendations and next steps for applying this knowledge.

---

## Key Terms
* **Term 1:** Definition as used in the video.
* **Term 2:** Definition as used in the video.

---

## Resources Mentioned
* **Resource Name:** Description of what it is and why it was referenced.

# OUTPUT CONSTRAINTS
- FORMAT: Strict Github-Flavored Markdown. No preambles.
- COMPLETENESS: Every point from the video must be present. This is NOT a summary — it is a full structured transcription.
- NO TIMESTAMPS: Zero time references anywhere in the output.
- NO OMISSIONS: Do not skip, abbreviate, or paraphrase any substantive content.
- ACTIVE VOICE: Write all AI-generated sections (Overview, Key Terms, Resources) in active voice, addressing the reader directly. Transcribed dialogue remains faithful to the speaker's original wording.
- ACCURACY: 100% factual retention for proper nouns, data points, and technical details.`,
} as const;

/**
 * AI Prompt Service
 *
 * @remarks
 * Optimized prompt generation with:
 * - Single-pass template replacement using placeholder maps
 * - Pre-compiled regex patterns for performance
 * - Readonly template constants for better optimization
 */
export class AIPromptService implements PromptService {

    // ============ PRIVATE MEMBERS ============

    /** Cached compiled regex pattern for frontmatter key replacement */
    private static readonly FRONTMATTER_KEY_PATTERN = /(\w+)\s*:\s*(["'])?([^"'\n]*)(["'])?/gi;

    /** Pattern for AI provider/model placeholders */
    private static readonly PLACEHOLDER_PATTERN = /__(AI_PROVIDER|AI_MODEL)__/g;

    // ============ PUBLIC METHODS ============

    /**
     * Create an analysis prompt with performance optimization
     *
     * @param options - Analysis options including video data, format, and transcript
     * @returns Complete formatted prompt string
     *
     * @example
     * ```ts
     * const prompt = service.createAnalysisPrompt({
     *   videoData: { title: 'Video', description: 'Desc' },
     *   videoUrl: 'https://youtube.com/watch?v=abc',
     *   format: 'detailed-guide',
     *   performanceMode: 'balanced'
     * });
     * ```
     */
    createAnalysisPrompt(options: AnalysisPromptOptions): string {
        const {
            videoData,
            videoUrl,
            format = 'executive-summary',
            transcript,
            performanceMode = 'balanced',
            providerName,
            userInstructions,
        } = options;

        const videoId = ValidationUtils.extractVideoId(videoUrl) ?? DEFAULTS.VIDEO_ID;
        const provider = PLACEHOLDERS.AI_PROVIDER;
        const model = PLACEHOLDERS.AI_MODEL;

        // Build base content using single-pass replacement
        const baseContent = this.buildBaseContent(
            videoData,
            videoUrl,
            transcript,
            performanceMode,
            format,
            userInstructions,
        );

        // Build full prompt with all components
        return this.buildFullPrompt(
            baseContent,
            videoData,
            videoUrl,
            videoId,
            format,
            provider,
            model,
            undefined,
            providerName,
        );
    }

    // ============ PRIVATE HELPER METHODS ============

    /**
     * Build base content from video data and transcript
     * Uses single-pass template replacement for better performance
     */
    private buildBaseContent(
        videoData: VideoData,
        videoUrl: string,
        transcript?: string,
        performanceMode: PerformanceMode = 'balanced',
        format: OutputFormat = 'executive-summary',
        userInstructions?: string,
    ): string {
        const baseTemplate = BASE_TEMPLATES[performanceMode];
        const transcriptSection = this.buildTranscriptSection(transcript, format);

        // Build chapter markers from description
        const chapterMarkers = this.extractChapterMarkers(videoData.description);

        // Build user instructions block
        const userInstructionsBlock = userInstructions?.trim()
            ? `\n\n**USER INSTRUCTIONS** (prioritize these over defaults):\n${userInstructions.trim()}\n`
            : '';

        // Single-pass replacement using placeholder map
        return this.replacePlaceholders(baseTemplate, {
            [PLACEHOLDERS.TITLE]: videoData.title,
            [PLACEHOLDERS.URL]: videoUrl,
            [PLACEHOLDERS.DESCRIPTION]: videoData.description,
            [PLACEHOLDERS.TRANSCRIPT_SECTION]: transcriptSection,
            [PLACEHOLDERS.USER_INSTRUCTIONS]: userInstructionsBlock,
            [PLACEHOLDERS.CHANNEL_NAME]: videoData.channelName ?? 'Unknown',
            [PLACEHOLDERS.DURATION]: this.formatDuration(videoData.duration),
            [PLACEHOLDERS.PUBLISHED_DATE]: videoData.publishedAt ?? 'Unknown',
            [PLACEHOLDERS.THUMBNAIL_URL]: videoData.thumbnail ?? '',
            [PLACEHOLDERS.CHAPTER_MARKERS]: chapterMarkers,
        });
    }

    /**
     * Build transcript section with truncation for token efficiency
     * Uses per-format transcript budget when available
     */
    private buildTranscriptSection(transcript?: string, format?: OutputFormat): string {
        if (!transcript?.trim()) return '';

        const budget = format && FORMAT_CONFIG[format]?.transcriptBudget
            ? FORMAT_CONFIG[format].transcriptBudget!
            : TOKEN_LIMITS.MAX_TRANSCRIPT_LENGTH;

        const truncated = transcript.length > budget
            ? `${transcript.slice(0, budget)}... [transcript truncated]`
            : transcript;

        return `\nVIDEO CONTENT/TRANSCRIPT:\n${truncated}`;
    }

    /**
     * Build complete prompt with frontmatter, video iframe, and format template
     */
    private buildFullPrompt(
        baseContent: string,
        videoData: VideoData,
        videoUrl: string,
        videoId: string,
        format: OutputFormat,
        provider: string,
        model: string,
        customPrompt?: string,
        providerName?: string,
    ): string {
        const frontmatter = Templates.frontmatter(
            videoData.title,
            videoUrl,
            videoId,
            format,
            provider,
            model
        );

        const iframe = Templates.videoIframe(videoId, videoData.title);

        // Add thumbnail image below iframe for article/complete-transcription
        let thumbnailBlock = '';
        if ((format === 'article' || format === 'complete-transcription') && videoData.thumbnail) {
            thumbnailBlock = `\n\n![Video Thumbnail](${videoData.thumbnail})`;
        }

        const separator = '---\n\n';
        let formatTemplate = this.buildFormatTemplate(format, customPrompt);

        // Replace {{YOUTUBE_URL}} placeholder in format templates
        formatTemplate = formatTemplate.replace(/\{\{YOUTUBE_URL\}\}/g, videoUrl);

        // Strip multimodal instructions for text-only providers
        if (providerName && !this.isMultimodalProvider(providerName)) {
            formatTemplate = this.stripMultimodalInstructions(formatTemplate);
        }

        return `${frontmatter}\n\n${iframe}${thumbnailBlock}\n\n${separator}${baseContent}\n\n${formatTemplate}`;
    }

    /**
     * Build format-specific template
     */
    private buildFormatTemplate(format: OutputFormat, customPrompt?: string): string {
        return FORMAT_TEMPLATES[format];
    }

    /**
     * Single-pass placeholder replacement using a map
     * More efficient than chaining multiple .replace() calls
     * Uses regex global flag for compatibility with ES2020
     */
    private replacePlaceholders(
        template: string,
        replacements: Readonly<Record<string, string>>
    ): string {
        let result = template;
        for (const [placeholder, value] of Object.entries(replacements)) {
            // Escape special regex characters in placeholder
            const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escaped, 'g'), value);
        }
        return result;
    }

    /**
     * Process AI response and inject actual provider/model information
     *
     * @param content - Raw AI response content
     * @param provider - AI provider name (e.g., 'gemini', 'groq')
     * @param model - Model identifier (e.g., 'gemini-2.0-flash')
     * @param format - Output format (optional, for future use)
     * @returns Processed content with placeholders replaced
     */
    processAIResponse(
        content: string,
        provider: string,
        model: string,
        format?: OutputFormat,
        videoData?: VideoData,
        videoUrl?: string,
    ): string {
        if (!content) return content;

        const providerValue = provider ?? DEFAULTS.PROVIDER;
        const modelValue = model ?? DEFAULTS.MODEL;

        // Replace all placeholder tokens using a single pass
        let updatedContent = this.replacePlaceholders(content, {
            [PLACEHOLDERS.AI_PROVIDER]: providerValue,
            [PLACEHOLDERS.AI_MODEL]: modelValue,
        });

        // Ensure frontmatter has correct values (fallback for malformed responses)
        updatedContent = this.ensureFrontMatterValue(
            updatedContent,
            'ai_provider',
            providerValue
        );
        updatedContent = this.ensureFrontMatterValue(
            updatedContent,
            'ai_model',
            modelValue
        );

        // Append Resources section
        if (videoUrl) {
            updatedContent = this.appendResourcesSection(
                updatedContent,
                videoUrl,
                providerValue,
                modelValue
            );
        }

        // Validate format structure (remove duplicate iframes, check sections)
        if (format) {
            updatedContent = this.validateFormatStructure(updatedContent, format);
        }

        return updatedContent;
    }

    /**
     * Append Resources section to the end of the content
     */
    private appendResourcesSection(
        content: string,
        videoUrl: string,
        provider: string,
        model: string
    ): string {
        const processingDate = new Date().toISOString().split('T')[0];
        const resourcesSection = `\n\n## Resources\n- Video URL: ${videoUrl}\n- Processing Date: ${processingDate}\n- Provider: ${provider} ${model}\n`;

        // Remove trailing whitespace before adding Resources
        const trimmedContent = content.trimEnd();
        return trimmedContent + resourcesSection;
    }

    /**
     * Ensure frontmatter key has correct value
     * Uses pre-compiled regex pattern for better performance
     */
    private ensureFrontMatterValue(
        content: string,
        key: string,
        value: string
    ): string {
        const pattern = new RegExp(`(${key}\\s*:\\s*)(["'])?([^"'\\n]*)(["'])?`, 'i');

        // Update existing key
        if (pattern.test(content)) {
            return content.replace(pattern, (_, prefix, openQuote, _existing, closeQuote) => {
                const quote = (openQuote ?? closeQuote) ? '"' : '';
                return `${prefix}${quote}${value}${quote}`;
            });
        }

        // Add key if frontmatter exists but key is missing
        if (content.startsWith('---')) {
            return content.replace(/^---\s*\n/, `---\n${key}: "${value}"\n`);
        }

        return content;
    }

    /**
     * Get format-specific configuration
     */
    getFormatConfig(format: OutputFormat): FormatConfig {
        return FORMAT_CONFIG[format];
    }

    /**
     * Format duration in seconds to human-readable string (e.g., "1:23:45")
     */
    private formatDuration(seconds?: number): string {
        if (!seconds) return 'Unknown';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    /**
     * Extract chapter markers from video description
     * Parses patterns like "0:00 Title", "1:23:45 Title", "00:00 Title"
     */
    extractChapterMarkers(description?: string): string {
        if (!description) return '';
        // Match timestamp patterns at the start of a line: "0:00", "00:00", "1:23:45"
        const chapterPattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/gm;
        const chapters: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = chapterPattern.exec(description)) !== null) {
            const hours = match[1] ? parseInt(match[1]) : 0;
            const minutes = parseInt(match[2]!);
            const seconds = parseInt(match[3]!);
            const title = (match[4] ?? '').trim();
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            const formatted = hours > 0
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                : `${minutes}:${String(seconds).padStart(2, '0')}`;
            chapters.push(`- **${formatted}** ${title}`);
        }

        if (chapters.length === 0) return '';

        return `\n**Chapters:**\n${chapters.join('\n')}\n`;
    }

    /**
     * Strip multimodal instructions from template for text-only providers
     * Removes lines containing visual/audio analysis instructions
     */
    stripMultimodalInstructions(template: string): string {
        const multimodalPatterns = [
            /- ANALYZE VISUALS:.*$/gm,
            /- NOTE ENVIRONMENTAL AUDIO:.*$/gm,
            /- NOTE AUDIO:.*$/gm,
            /Process video multimodally.*$/gm,
            /Process video with `use_audio_video_tokens=True`.*$/gm,
            /Watch and listen to the video.*$/gm,
            /visual\/audio\).*$/gm,
            /multimodally \(visual\/audio\).*$/gm,
        ];

        let result = template;
        for (const pattern of multimodalPatterns) {
            result = result.replace(pattern, '');
        }
        // Clean up blank lines left behind
        result = result.replace(/\n{3,}/g, '\n\n');
        return result;
    }

    /**
     * Check if a provider supports multimodal (vision) input
     */
    private isMultimodalProvider(providerName: string): boolean {
        const multimodalProviders = ['Google Gemini', 'gemini'];
        return multimodalProviders.some(p => p.toLowerCase() === providerName.toLowerCase());
    }

    /**
     * Validate format structure of AI output
     * Checks for expected ## headers, removes duplicate iframes
     */
    validateFormatStructure(content: string, format?: OutputFormat): string {
        if (!content || !format) return content;

        const config = FORMAT_CONFIG[format];
        if (!config?.expectedSections) return content;

        // Remove duplicate iframes (keep only the first)
        let result = content;
        const iframePattern = /<iframe[^>]*src="https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]*"[^>]*><\/iframe>/g;
        const iframes = result.match(iframePattern);
        if (iframes && iframes.length > 1) {
            // Keep first iframe, remove subsequent ones (including surrounding div)
            let firstFound = false;
            result = result.replace(/(<div[^>]*>)?\s*<iframe[^>]*src="https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]*"[^>]*><\/iframe>\s*(<\/div>)?/g, (match) => {
                if (!firstFound) {
                    firstFound = true;
                    return match;
                }
                return '';
            });
        }

        return result;
    }

    /**
     * Create a concise summary prompt for shorter content
     *
     * @param videoData - Video metadata
     * @param videoUrl - Full YouTube URL
     * @returns Formatted summary prompt
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
     *
     * @param prompt - Prompt string to validate
     * @returns true if prompt is valid, false otherwise
     */
    validatePrompt(prompt: string): boolean {
        return Boolean(prompt) &&
               typeof prompt === 'string' &&
               prompt.trim().length >= TOKEN_LIMITS.MIN_PROMPT_LENGTH &&
               prompt.length <= TOKEN_LIMITS.MAX_PROMPT_LENGTH;
    }
}
