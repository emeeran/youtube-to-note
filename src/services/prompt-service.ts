import { PromptService, VideoData, OutputFormat, PerformanceMode } from '../types';
import { ValidationUtils } from '../validation';

/**
 * Optimized prompt generation service for AI processing
 * Focus: Compact, structured, visually scannable output
 */

export class AIPromptService implements PromptService {
    // Shared frontmatter template
    private static createFrontmatter(title: string, url: string, videoId: string, format: OutputFormat): string {
        const date = new Date().toISOString().split('T')[0];
        const isoDate = new Date().toISOString();
        const type = format === 'tutorial' ? 'youtube-tutorial' : 'youtube-note';
        const tags = format === 'brief' ? ['youtube', 'brief']
            : format === 'tutorial' ? ['youtube', 'tutorial']
            : format === 'executive-summary' ? ['youtube', 'executive-summary']
            : ['youtube', 'detailed-guide'];

        return `---
title: ${title}
source: ${url}
created: "${date}"
modified: "${date}"
type: ${type}
format: ${format}
tags:
${tags.map(t => `  - ${t}`).join('\n')}
status: processed
duration: "[Extract video duration]"
channel: "[Extract channel name]"
video_id: "${videoId || 'unknown'}"
processing_date: "${isoDate}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

`;
    }

    // Shared video embed
    private static createVideoEmbed(url: string, videoId: string): string {
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : url;
        return `<iframe width="640" height="360" src="${embedUrl}" title="${url}" frameborder="0" allowfullscreen></iframe>`;
    }

    createAnalysisPrompt(
        videoData: VideoData,
        videoUrl: string,
        format: OutputFormat = 'detailed-guide',
        customPrompt?: string,
        transcript?: string,
        performanceMode: PerformanceMode = 'balanced'
    ): string {
        if (customPrompt?.trim()) {
            return this.applyCustomPrompt(customPrompt, videoData, videoUrl);
        }

        const baseContent = this.buildBaseContent(videoData, videoUrl, transcript, performanceMode);

        switch (format) {
            case 'executive-summary':
                return this.createExecutiveSummaryPrompt(baseContent, videoUrl);
            case 'brief':
                return this.createBriefPrompt(baseContent, videoUrl);
            case 'tutorial':
                return this.createTutorialPrompt(baseContent, videoUrl);
            case 'detailed-guide':
            default:
                return this.createDetailedGuidePrompt(baseContent, videoUrl);
        }
    }

    private buildBaseContent(videoData: VideoData, videoUrl: string, transcript: string | undefined, mode: PerformanceMode): string {
        let transcriptSection = '';
        if (transcript?.trim()) {
            const maxLength = mode === 'fast' ? 4000 : mode === 'quality' ? 12000 : 8000;
            transcriptSection = transcript.length > maxLength
                ? transcript.substring(0, maxLength) + '\n\n[Transcript truncated...]'
                : transcript;
        }

        return `**Title:** ${videoData.title}
**URL:** ${videoUrl}

**Description:**
${videoData.description || 'No description provided.'}

${transcriptSection ? `**Transcript:**\n${transcriptSection}` : ''}

---

`;
    }

    /**
     * BRIEF FORMAT - Ultra-compact, scannable
     */
    private createBriefPrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Brief note (3-4 sentences, bullet points only)

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'brief')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

## Summary
[3-4 sentence core message]

## Key Points
- **[Point 1]**
- **[Point 2]**
- **[Point 3]**

## Actions
1. [Action 1]
2. [Action 2]

## Resources
- [Watch](${videoUrl}) | [Channel](https://youtube.com/channel/[id])`;
    }

    /**
     * TUTORIAL FORMAT - Actionable step-by-step
     */
    private createTutorialPrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Step-by-step tutorial (imperative, visual descriptions)

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'tutorial')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

# Tutorial

## Overview
[Brief: What you'll build/learn]

**Prerequisites:** [List requirements]

---

## Steps

### 1. [Step Title]
**Goal:** [Objective]

> **Visual:** [What you see on screen]

1. [Action]
2. [Action]
3. [Action]

✓ **Result:** [Verification]

---

### 2. [Step Title]
**Goal:** [Objective]

> **Visual:** [Description]

1. [Action]
2. [Action]
3. [Action]

✓ **Result:** [Verification]

---

[Continue steps...]

## Summary

**You learned:**
- [Skill 1]
- [Skill 2]

**Tools used:**
- [Tool 1] - [Link/source]
- [Tool 2] - [Link/source]

**Tips:**
- [Pro tip]
- ⚠️ [Avoid this]

---

[Watch on YouTube](${videoUrl})`;
    }

    /**
     * EXECUTIVE FORMAT - Strategic, insights-driven
     */
    private createExecutiveSummaryPrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Executive summary (strategic insights, action plan)

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'executive-summary')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

## Executive Summary
[2-3 paragraphs, ~250 words]

**Key Concepts:**
- **[Concept]** - [Definition]
- **[Concept]** - [Definition]
- **[Concept]** - [Definition]

**Priority Actions:**
1. [Action 1]
2. [Action 2]
3. [Action 3]

---

## Strategic Insights

| Technical | Design | Learning |
|-----------|--------|---------|
| [Insight] | [Insight] | [Insight] |

---

## Action Plan

| Phase | Action | Metric |
|-------|--------|--------|
| ⚡ Now | [Action] | [Success criteria] |
| 📈 Soon | [Action] | [Success criteria] |
| 🎯 Later | [Action] | [Success criteria] |

---

## Resources
- **Video:** [Watch](${videoUrl})
- **Channel:** [Name](https://youtube.com/channel/[id])
- **Tools:** [Tool 1] • [Tool 2]
- **Docs:** [Resource 1] • [Resource 2]`;
    }

    /**
     * DETAILED FORMAT - Comprehensive guide
     */
    private createDetailedGuidePrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Comprehensive detailed guide

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'detailed-guide')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

# Guide

**Level:** [Beginner/Intermediate/Advanced]
**Time:** [Estimated duration]

**Prerequisites:**
- [Requirement 1]
- [Requirement 2]

---

## Steps

### 1. [Title]
**Goal:** [Objective]

> **Visual cue:** [What to look for]

1. [Instruction]
2. [Instruction]
3. [Instruction]

✓ **Check:** [How to verify]

---

### 2. [Title]
**Goal:** [Objective]

1. [Instruction]
2. [Instruction]
3. [Instruction]

✓ **Check:** [How to verify]

---

### 3. [Title]
[Continue as needed...]

---

## Outcomes

**Skills gained:**
- [Skill 1]
- [Skill 2]

**Tools required:**
- [Tool] - [Source]
- [Tool] - [Source]

---

## Resources
- **Video:** [Watch](${videoUrl})
- **Channel:** [Name](https://youtube.com/channel/[id])
- **Related:** [Link 1] • [Link 2]`;
    }

    private applyCustomPrompt(customPrompt: string, videoData: VideoData, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : videoUrl;

        return customPrompt
            .replace(/__VIDEO_TITLE__/g, videoData.title || 'Unknown Video')
            .replace(/__VIDEO_DESCRIPTION__/g, videoData.description || 'No description available')
            .replace(/__VIDEO_URL__/g, videoUrl)
            .replace(/__VIDEO_ID__/g, videoId || 'unknown')
            .replace(/__EMBED_URL__/g, embedUrl)
            .replace(/__DATE__/g, new Date().toISOString().split('T')[0])
            .replace(/__TIMESTAMP__/g, new Date().toISOString());
    }

    processAIResponse(content: string, provider: string, model: string, format?: OutputFormat): string {
        if (!content) return content;

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

    createSummaryPrompt(videoData: VideoData, videoUrl: string): string {
        return this.createBriefPrompt(
            this.buildBaseContent(videoData, videoUrl, undefined, 'balanced'),
            videoUrl
        );
    }

    validatePrompt(prompt: string): boolean {
        return Boolean(prompt) &&
               typeof prompt === 'string' &&
               prompt.trim().length > 10 &&
               prompt.length < 50000;
    }
}
