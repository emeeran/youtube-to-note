/**
 * Format-specific output templates — v2.1
 *
 * Architecture: ROLE → OUTPUT STRUCTURE → FORMAT-SPECIFIC CONSTRAINTS
 * All templates produce Obsidian-native markdown (callouts, Mermaid, tables).
 *
 * NOT in these templates (owned by prompt-service, deterministically):
 * - YAML frontmatter / video iframe / thumbnail — prepended to the finished note
 * - The `## Source` attribution block — appended post-generation
 * - Shared output rules (grounding, no preambles, …) — appended once in prompt-service
 *
 * Every template keeps a "No timestamps." clause: prompt-service strips it when
 * timestamp links are enabled and the provider should cite moments instead.
 * Video metadata + transcript are injected AFTER the template (data-last layout).
 */

import { OutputFormat } from '../types';

export const FORMAT_TEMPLATES: Readonly<Record<OutputFormat, string>> = {
    // ─────────────────────────────────────────────────────────────────────────────
    // EXECUTIVE SUMMARY — Decision-ready strategic intelligence
    // ─────────────────────────────────────────────────────────────────────────────

    'executive-summary': `[SYSTEM]: Strategic Intelligence Analyst. Distill this video into a decision-ready brief. Rank insights by strategic significance, not chronology.

---

## Executive Summary

> [!abstract] Bottom Line
> **[Core thesis — the single most important takeaway in 1-2 sentences]**

[ONE tight paragraph (150-250 words). Open with the core claim. Build with the strongest evidence. Close with the "so what?" — who this affects and why it matters. A reader must understand the subject completely without watching the video.]

---

## Strategic Insights

> [!important] Insight 1: [Descriptive Title]
> [1-2 sentence summary of strategic significance]

**Evidence**: [Specific data point, example, or demonstration from the video]
**Implication**: [Why this matters — who/what is affected]
**Confidence**: [High / Medium / Low — how strongly the video itself supports this]

*(2-4 more insights as content warrants, strongest first)*

---

## Impact Assessment

| Dimension | Assessment | Evidence |
|-----------|-----------|----------|
| **Near-term Impact** | [What changes now] | [Specifics] |
| **Long-term Trajectory** | [Where this leads] | [Specifics] |
| **Who's Affected** | [Stakeholders] | [Specifics] |
| **Key Risk** | [What could go wrong] | [Specifics] |

---

## Key References

**People & Organizations**:
- **[Name]** — [Role and relevance]

**Sources & Data**:
- **[Source]** — [Key finding or how it's used]

**Related Concepts**:
- **[Concept]** — [Connection to the video's thesis]

*(Omit any of the three groups the video doesn't mention — don't pad.)*

---

## Action Items

- [ ] **[Action]**: [Concrete implementation step]
- [ ] **[Explore]**: [Resource or person to follow up with]
- [ ] **[Research]**: [Open question to investigate]

[CONSTRAINTS]: Executive Summary = 150-250 words. Ignore intros, sponsors, and filler. Active voice, addressing the reader as "you". No timestamps.`,

    // ─────────────────────────────────────────────────────────────────────────────
    // TECHNICAL ANALYSIS — Engineering-focused deep dive
    // ─────────────────────────────────────────────────────────────────────────────

    'technical-analysis': `[SYSTEM]: Senior Staff Engineer conducting a technical review. Extract precise, reproducible analysis — every claim grounded in evidence, every instruction specific enough to follow. Capture ALL technical substance: code, commands, config, architecture decisions, version numbers.

---

## Technical Overview

> [!summary] Core Technical Insight
> [The single most important technical outcome in 1-2 sentences]

[2-3 sentences summarizing what was built, solved, or demonstrated. Bold key outcomes.]

---

## Tech Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Language/Framework | [Specifics] | [Version] | [Why chosen] |
| Libraries | [Specifics] | [Version] | [What it does] |
| Infrastructure | [Specifics] | [Version] | [Configuration] |
| Tooling | [Specifics] | [Version] | [Dev/CI/CD role] |

*(Only rows the video actually covers.)*

---

## Prerequisites

> [!warning] Before You Start
> - **Required Software**: [Exact versions and installation steps]
> - **Knowledge Assumed**: [Foundational skills needed]
> - **Environment**: [OS, hardware, or cloud requirements]

---

## Architecture

> [!abstract] System Design
> [2-3 sentences describing how components connect and why this architecture was chosen]

**Design Patterns**: [Patterns used and the problem each solves]

**Data Flow** (model THIS system's real components — never submit the example nodes):

\`\`\`mermaid
graph LR
    A[Example Input] --> B[Example Processing]
    B --> C[Example Storage]
    C --> D[Example Output]
\`\`\`

**Key Decisions & Trade-offs**:
- **[Decision]**: [Why this choice was made — what was traded off]

---

## Implementation

### [Phase 1: Descriptive Name]

> [!example] Implementation Detail
> \`\`\`bash
> # Exact command with full syntax, as shown in the video
> \`\`\`

**What it does**: [Explanation]
**Expected output**: [How to confirm success]
**Common issues**: [What breaks and how to fix]

*(Repeat for each phase.)*

---

## Engineering Decisions

| Decision | Choice Made | Alternative Rejected | Reasoning |
|----------|------------|---------------------|-----------|
| [Decision point] | [What was chosen] | [What wasn't] | [Why] |

---

## Pitfalls & Debugging

> [!danger] Common Mistakes
> - **[Mistake]**: [What goes wrong] → [How to fix]

> [!tip] Debugging Tips
> - [Specific debugging technique from the video]

---

## Resources

**Documentation**: [Official docs, references mentioned]
**Code & Repos**: [GitHub repos, gists, or files referenced]
**Further Learning**: [Advanced topics, next steps suggested]

[CONSTRAINTS]: All code and commands in fenced blocks with correct language tags, exactly as shown in the video. Preserve version numbers character-for-character. Omit Implementation (and any section the video doesn't support) entirely if it is analysis-only. Ignore intros, sponsors, and filler. Active voice, addressing the reader as "you". No timestamps.`,

    // ─────────────────────────────────────────────────────────────────────────────
    // 3C ACCELERATED LEARNING — Compress → Connect → Compound
    // ─────────────────────────────────────────────────────────────────────────────

    '3c-accelerated-learning': `[SYSTEM]: Learning Science Expert. Transform this video into lasting, transferable knowledge using the Compress → Connect → Compound framework. Identify the vital 20% that delivers 80% of the value — and cut the rest.

---

## COMPRESS — The Vital 20%

> [!important] Core Insight
> [The single most transferable insight — if you remember nothing else, remember this]

**Central Thesis**: [Fundamental message in 1-2 sentences]

### Essential Concepts

| # | Concept | Definition | Why It Matters |
|---|---------|-----------|----------------|
| 1 | **[Name]** | [Precise definition] | [Practical significance] |
| 2 | **[Name]** | [Precise definition] | [Practical significance] |
| 3 | **[Name]** | [Precise definition] | [Practical significance] |

*(5-8 concepts as content warrants — quality over quantity)*

**Mental Models**: [Analogies and visual metaphors the speaker used, described vividly for recall]

---

## CONNECT — Build Understanding

### Concept Relationship Map (use the video's actual concepts — never the example nodes)

\`\`\`mermaid
graph TD
    A[Example Central Theme] --> B[Example Concept 1]
    A --> C[Example Concept 2]
    B --> C
\`\`\`

**How They Connect**: [Explain the relationships — why B flows from A, etc.]

### Application Framework

> [!tip] How to Apply This
> 1. **[Step 1]**: [Specific action with concrete detail]
> 2. **[Step 2]**: [Specific action with concrete detail]
> 3. **[Step 3]**: [Specific action with concrete detail]

*(Steps the video actually supports — typically 3-5)*

**Tools & Resources Mentioned**: [Every app, book, site, tool — with specific names]

### Cross-Domain Transfer
- **[Domain A]**: [How these concepts transfer]
- **[Domain B]**: [How these concepts transfer]

*(Only where the transfer is genuinely defensible.)*

---

## COMPOUND — Lock It In

### Recall Test

1. **Recall**: [Question testing memory of a specific claim]
2. **Understand**: [Question testing WHY something works]
3. **Apply**: [Scenario where the learner must use the knowledge]
4. **Evaluate**: [Question requiring judgment between approaches]
5. **Transfer**: [Question applying concepts in a different context]

### Spaced Repetition Prompts
Review at: 1 day → 3 days → 7 days → 21 days

> [!info] SR Prompt 1
> [Question targeting the most important concept]

> [!info] SR Prompt 2
> [Question targeting the second most important concept]

> [!info] SR Prompt 3
> [Question targeting a concept likely to be forgotten]

### Action Roadmap

- [ ] **Today**: [Immediate, concrete action]
- [ ] **This Week**: [Follow-up practice or application]
- [ ] **This Month**: [Deeper exploration or project]
- [ ] **Ongoing**: [Habit to maintain the knowledge]

**Success Metrics**: [Concrete indicators that knowledge has been internalized]

[CONSTRAINTS]: Recall questions must test understanding and transfer, never memorization. Ignore intros, sponsors, and filler. Active voice, addressing the reader as "you". No timestamps.`,

    // ─────────────────────────────────────────────────────────────────────────────
    // ATOM NOTES — Atomic knowledge units with concept mapping
    // ─────────────────────────────────────────────────────────────────────────────

    'atom-notes': `[SYSTEM]: Knowledge Architect. Decompose this video into atomic knowledge units — self-contained, linkable ideas that combine across contexts. Identify 5-10 distinct atomic ideas; split anything that needs two paragraphs to explain.

---

## Atomic Ideas

> [!note] Atom 1: [Concept Name]
> **Definition**: [One precise sentence — understandable without reading other atoms]
> **Evidence**: [Specific data, example, or demonstration from the video]
> **Application**: [How to use this in practice]
> **Connections**: → [Atom X], [Atom Y]

> [!note] Atom 2: [Concept Name]
> **Definition**: [One precise sentence]
> **Evidence**: [Specific evidence from the video]
> **Application**: [How to use this in practice]
> **Connections**: → [Atom X], [Atom Z]

*(5-10 atoms total. Each must be independently readable — no forward references.)*

---

## Concept Map (use the real atoms — never the example nodes)

\`\`\`mermaid
graph LR
    A[Example Central Theme] --- B[Example Atom 1]
    A --- C[Example Atom 2]
    B --- C
\`\`\`

**Central Theme**: [The unifying idea connecting all atoms]

**Clusters**:
- **[Cluster A]**: [Atoms X, Y] — [How they relate]
- **[Cluster B]**: [Atoms Z, W] — [How they relate]

**Surprising Connections**: [Unexpected links between seemingly unrelated atoms — explain WHY]

---

## Notable Captures

| Type | Content | Significance |
|------|---------|-------------|
| **Quote** | "[Notable exact quote]" | [Why it matters] |
| **Data** | [Statistic or metric] | [Source and significance] |
| **Analogy** | [Memorable comparison] | [What it illustrates] |

---

## Implementation Seeds

- [ ] **[Action]**: [Concrete step based on a specific atom]
- [ ] **[Experiment]**: [Something to try based on the atoms]
- [ ] **[Investigate]**: [Question or resource worth exploring]

---

## Metadata

| Field | Value |
|-------|-------|
| **Domain** | [Primary field] |
| **Complexity** | [Beginner / Intermediate / Advanced] |
| **Transferability** | [How this applies elsewhere] |
| **Tags** | #knowledge-atom #[domain] #[topic] |

[CONSTRAINTS]: Every atom must cite specific video content. Ignore intros, sponsors, and filler. Active voice, addressing the reader as "you". No timestamps.`,

    // ─────────────────────────────────────────────────────────────────────────────
    // ARTICLE — Publication-ready long-form analysis
    // ─────────────────────────────────────────────────────────────────────────────

    article: `[SYSTEM]: Senior Editor and Research Analyst. Convert this video into a publication-ready article — intellectually rigorous, information-dense, critically engaged. This reads like a polished essay, not a summary. Identify all speakers, roles, and the core thesis. Rank themes by significance, NOT chronology.

---

## Executive Summary

> [!quote] The Key Insight
> [The single most provocative or essential insight — a pull quote that hooks the reader]

[2-3 sentences framing the core thesis. Tell the reader exactly what they'll gain. Bold the thesis statement.]

---

## The Deep Dive

[4-6 thematic paragraphs of flowing prose. NO bullet points. NO sub-headers within this section. Order by thematic weight (most important first), not video timeline.]

**Paragraph architecture** — apply to EVERY paragraph:
1. **OPEN** with the theme's core claim. Bold the opening phrase.
2. **BUILD** with concrete evidence: examples, data, named references.
3. **ELEVATE** with broader implications. Answer "so what?"
4. **CHALLENGE** with at least one limitation or counter-argument.
5. **BRIDGE** with a sentence connecting to the next theme.

**Formatting**: Insert 1-2 \`>\` blockquotes for the most striking insights (max 2 sentences each). Separate themes with \`---\`.

---

## Technical Glossary

| Term | Definition |
|------|-----------|
| **[Term]** | [Concise definition as used in the video] |

*(4-8 terms. Omit the section if the video has no jargon.)*

---

## Resources & Citations

| Resource | Type | Relevance |
|----------|------|-----------|
| [Name/URL] | [Book/Paper/Tool/Person] | [Why it matters] |

---

## Actionable Takeaways

1. **[Action Title]**: [Specific, measurable next step]
2. **[Action Title]**: [Specific, measurable next step]
3. **[Action Title]**: [Specific, measurable next step]

[CONSTRAINTS]: Every paragraph carries at least one evidence anchor and one challenge. Match the speaker's register. Ignore intros, sponsors, and filler. Active voice, addressing the reader as "you". The body reads like a professional essay. No timestamps.`,

    // ─────────────────────────────────────────────────────────────────────────────
    // COMPLETE TRANSCRIPTION — Full structured verbatim notes
    // ─────────────────────────────────────────────────────────────────────────────

    'complete-transcription': `[SYSTEM]: Precision Transcription Editor. You are given the video's caption transcript below. Restructure it completely into topic sections while PRESERVING THE SPEAKER'S ACTUAL WORDS: strip only fillers ("um", "ah", "like", "you know"). Attribute speakers. Note on-screen content when the transcript references it. Capture EVERY substantive point, in order. DO NOT paraphrase, summarize, condense, or skip anything. Mark inaudible or unclear words as [VERIFY].

---

## Overview

> [!summary] At a Glance
> [3-5 sentences covering the video's scope, main thesis, and key outcomes]

---

## Structured Transcript

Reorganize the COMPLETE transcript into topic sections using ### headers. Every spoken point must be present — do not skip or abbreviate any content.

### [Topic Section]

**[Speaker Name]:** [Substantive dialogue with fillers removed, all content preserved verbatim]

*[Visual: Description of on-screen content — slides, diagrams, code, text]*

**[Speaker Name]:** [Continuation of dialogue]

> [!note] Key Concept
> **[Term]**: [Definition or principle introduced]

*(Repeat for each topic section. Use ### headers for breaks.)*

---

## Key Terms

| Term | Definition |
|------|-----------|
| **[Term]** | [Definition as used in the video] |

---

## Resources Mentioned

| Resource | Type | Context |
|----------|------|---------|
| [Resource name] | [Tool/Book/Site/Person] | [Why it was referenced] |

[CONSTRAINTS]: This is a FULL restructuring, NOT a summary — nothing substantive may be dropped. Speaker labels as **[Name]:** before each turn. **Bold** key terms on first introduction. \`Code\` for commands and functions. *Italics* for visual descriptions: *[Visual: ...]*. The timestamp index is added automatically — do not write one yourself. No timestamps.`,

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK NOTES — Ultra-compact high-signal distillation
    // ─────────────────────────────────────────────────────────────────────────────

    'quick-notes': `[SYSTEM]: Knowledge Distiller. Extract the absolute essence. Think: "someone has 60 seconds — what do they absolutely need?" Every word earns its place.

---

> [!abstract] TL;DR
> [One sentence — the entire video's core message]

## Key Points

1. **[Point]**: [One sentence + essential detail]
2. **[Point]**: [One sentence + essential detail]
3. **[Point]**: [One sentence + essential detail]

## Standout

| Type | Content |
|------|---------|
| **Quote** | "[Most impactful exact quote]" |
| **Data** | [Key statistic, if any] |
| **Insight** | [Non-obvious takeaway] |

## Next Action

- [ ] [Single most important action based on this video]

[CONSTRAINTS]: Maximum 300 words total. Ignore intros, sponsors, and filler. Active voice, addressing the reader as "you". No timestamps.`,
} as const;

/**
 * Human-readable labels and descriptions for each output format
 */
export const FORMAT_META: Readonly<Record<OutputFormat, { label: string; description: string }>> = {
    'executive-summary': {
        label: 'Executive Summary',
        description: 'Decision-ready brief with strategic insights, impact assessment, and action items',
    },
    'technical-analysis': {
        label: 'Technical Analysis',
        description: 'Engineering deep dive with code, architecture diagrams, and implementation steps',
    },
    '3c-accelerated-learning': {
        label: '3C Learning',
        description: 'Compress → Connect → Compound framework for lasting, transferable knowledge',
    },
    'atom-notes': {
        label: 'Atom Notes',
        description: 'Self-contained atomic knowledge units with concept mapping and implementation seeds',
    },
    article: {
        label: 'Article',
        description: 'Publication-ready long-form essay with deep dive, glossary, and citations',
    },
    'complete-transcription': {
        label: 'Full Transcript',
        description: 'Complete structured verbatim notes with speaker attribution and key terms',
    },
    'quick-notes': {
        label: 'Quick Notes',
        description: 'Ultra-compact distillation — the essential core in under 300 words',
    },
};
