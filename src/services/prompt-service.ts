import { PromptService, VideoData, OutputFormat, PerformanceMode } from '../types';
import { ValidationUtils } from '../validation';

/**
 * Optimized prompt generation service for AI processing
 * Focus: Conciseness, clarity, reduced token usage, better AI adherence
 */

export class AIPromptService implements PromptService {
    // Shared frontmatter template (reduces duplication)
    private static createFrontmatter(title: string, url: string, videoId: string, format: OutputFormat): string {
        const date = new Date().toISOString().split('T')[0];
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
video_id: "${videoId || 'unknown'}"
ai_provider: "__AI_PROVIDER__"
ai_model: "__AI_MODEL__"
---

`;
    }

    // Shared video embed (reduces duplication)
    private static createVideoEmbed(url: string, videoId: string): string {
        const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : url;
        return `<iframe width="640" height="360" src="${embedUrl}" title="${url}" frameborder="0" allowfullscreen></iframe>`;
    }

    /**
     * Create analysis prompt - optimized for clarity and token efficiency
     */
    createAnalysisPrompt(
        videoData: VideoData,
        videoUrl: string,
        format: OutputFormat = 'detailed-guide',
        customPrompt?: string,
        transcript?: string,
        performanceMode: PerformanceMode = 'balanced'
    ): string {
        // Custom prompt handling
        if (customPrompt?.trim()) {
            return this.applyCustomPrompt(customPrompt, videoData, videoUrl);
        }

        // Build base content based on performance mode
        const baseContent = this.buildBaseContent(videoData, videoUrl, transcript, performanceMode);

        // Route to format-specific prompt
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

    /**
     * Build base content - performance-optimized
     */
    private buildBaseContent(videoData: VideoData, videoUrl: string, transcript: string | undefined, mode: PerformanceMode): string {
        // Truncate long transcripts
        let transcriptSection = '';
        if (transcript?.trim()) {
            const maxLength = mode === 'fast' ? 4000 : mode === 'quality' ? 12000 : 8000;
            transcriptSection = transcript.length > maxLength
                ? transcript.substring(0, maxLength) + '\n\n[Transcript truncated...]'
                : transcript;
        }

        const modeSuffix = mode === 'fast' ? ' (fast mode)' : mode === 'quality' ? ' (deep analysis)' : '';

        return `# YouTube Video Analysis${modeSuffix}

**Title:** ${videoData.title}
**URL:** ${videoUrl}

**Description:**
${videoData.description || 'No description provided.'}

${transcriptSection ? `**Transcript:**\n${transcriptSection}` : ''}

---

`;
    }

    /**
     * Brief format - optimized for quick scanning
     */
    private createBriefPrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Brief note format (3-4 sentences max)

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'brief')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

## Brief Description
[3-4 sentence summary]

## Key Takeaways
- **[Main point]**
- **[Main point]**
- **[Main point]**

## Quick Actions
1. **[Action 1]**
2. **[Action 2]**

## Resources
- **Video:** [Watch](${videoUrl})
- **Mentioned resources:**
  - [Resource 1]
  - [Resource 2]

INSTRUCTIONS: Keep it brief. Focus on actionable insights.`;
    }

    /**
     * Tutorial format - step-by-step guide
     */
    private createTutorialPrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Step-by-step tutorial format

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'tutorial')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

## 📋 Executive Summary
[2-3 paragraphs, ~250 words]

### Key Concepts
- **[Concept]:** [Definition]
- **[Concept]:** [Definition]
- **[Concept]:** [Definition]

### Priority Actions
1. **[Action 1]** - [description]
2. **[Action 2]** - [description]
3. **[Action 3]** - [description]
4. **[Action 4]** - [description]

---

## 🎯 Step-by-Step Tutorial

### Step 1: [Title]
**Objective:** [Goal]

1. [Action]
2. [Action]
3. [Action]

**Expected Result:** [What you'll see]

### Step 2: [Title]
**Objective:** [Goal]

1. [Action]
2. [Action]
3. [Action]

**Expected Result:** [What you'll see]

### Step 3: [Title]
[Continue as needed...]

---

## 🎓 Learning Outcomes
- [Skill 1]
- [Skill 2]
- [Skill 3]

## 🛠️ Required Tools
- **[Tool 1]:** [Where to get it]
- **[Tool 2]:** [Where to get it]

## 📖 Further Reading
- **[Resource 1]:** [Link]
- **[Resource 2]:** [Link]

## 💡 Pro Tips
- **Tip:** [Insight]
- **Avoid:** [Common mistake]

---

INSTRUCTIONS:
- Extract ALL steps needed to complete the task
- Use imperative language ("Do X", not "The video shows X")
- Convert visual demos to explicit text
- Include actual links when mentioned
- Format: clean, scannable, emoji section headers`;
    }

    /**
     * Executive Summary - strategic insights
     */
    private createExecutiveSummaryPrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Executive summary with strategic insights

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'executive-summary')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

## 📊 Executive Summary
[2-3 paragraphs, ~250 words, focus on value proposition]

### Key Concepts
- **[Concept]:** [Definition]
- **[Concept]:** [Definition]
- **[Concept]:** [Definition]

### Priority Actions
1. **[Action 1]** - [description]
2. **[Action 2]** - [description]
3. **[Action 3]** - [description]
4. **[Action 4]** - [description]

---

## 🎯 Strategic Insights

### 🔧 Technical
**[One-sentence technical strategy insight]**

### 💡 Design
**[One-sentence design thinking insight]**

### 📚 Learning
**[One-sentence continuous learning insight]**

---

## 🚀 Action Plan

### ⚡ Immediate
- **Action:** [What to do now]
- **Metric:** [Success criteria]

### 📈 Short-term
- **Action:** [Next steps]
- **Metric:** [Success criteria]

### 🎯 Mid-term
- **Action:** [Future goals]
- **Metric:** [Success criteria]

### 🔮 Long-term
- **Action:** [Vision]
- **Metric:** [Success criteria]

---

## 📚 Resources

### Primary Sources
- **Video:** [Watch](${videoUrl})
- **Channel:** [Channel Name](https://youtube.com/channel/[id])

### Tools & Technologies
- **[Tool 1]:** [Description]
- **[Tool 2]:** [Description]

### Documentation
- **[Resource 1]:** [Link]
- **[Resource 2]:** [Link]

INSTRUCTIONS:
- Focus on strategic value, not narrative
- Each action needs measurable success criteria
- Include actual links from content`;
    }

    /**
     * Detailed Guide - comprehensive format
     */
    private createDetailedGuidePrompt(baseContent: string, videoUrl: string): string {
        const videoId = ValidationUtils.extractVideoId(videoUrl);

        return `${baseContent}
OUTPUT: Comprehensive detailed guide

${AIPromptService.createFrontmatter('{{TITLE}}', videoUrl, videoId || '', 'detailed-guide')}
${AIPromptService.createVideoEmbed(videoUrl, videoId || '')}

# Practical Guide

## Overview
**Goal:** [Main objective]
**Level:** [Beginner/Intermediate/Advanced]

## Prerequisites
- [Requirement 1]
- [Requirement 2]

---

## Step-by-Step

### Step 1: [Title]
**Objective:** [Goal]

**Actions:**
1. [Specific instruction]
2. [Specific instruction]
3. [Specific instruction]

✅ **Success:** [Verification]

### Step 2: [Title]
**Objective:** [Goal]

[Continue steps...]

### Step 3: [Title]
**Objective:** [Goal]

---

## Learning Outcomes
Upon completion:
- [Skill 1]
- [Skill 2]
- [Skill 3]

## Required Tools
- **[Tool 1]:** [Source]
- **[Tool 2]:** [Source]

## Tips
💡 **Tip:** [Insight]
⚠️ **Avoid:** [Mistake]

---

## 📚 Resources

### Sources
- **Video:** [Watch](${videoUrl})
- **Channel:** [Name](https://youtube.com/channel/[id])

### Tools
- **[Tool 1]:** [Description]
- **[Tool 2]:** [Description]

### Documentation
- **[Resource 1]:** [Link]
- **[Resource 2]:** [Link]

INSTRUCTIONS:
- Clear, actionable steps
- Include all prerequisites
- Real links from content
- Scannable format`;
    }

    /**
     * Apply custom prompt template
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
            .replace(/__DATE__/g, new Date().toISOString().split('T')[0])
            .replace(/__TIMESTAMP__/g, new Date().toISOString());
    }

    /**
     * Process AI response - inject provider metadata
     */
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

    /**
     * Ensure frontmatter value exists and is quoted
     */
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
     * Legacy methods for compatibility
     */
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
