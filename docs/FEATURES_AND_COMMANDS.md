# Features & Commands with Automation Examples

> 🎬 **YouTube to Note for Obsidian** - Complete reference for all features, commands, and automation workflows

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Commands](#commands)
3. [Trigger Sources](#trigger-sources)
4. [Output Formats](#output-formats)
5. [AI Providers](#ai-providers)
6. [Configuration](#configuration)
7. [Automation Examples](#automation-examples)
8. [Note Structure](#note-structure)
9. [Performance Modes](#performance-modes)
10. [Advanced Features](#advanced-features)

---

## Quick Reference

| Command ID | Name | Hotkey | Description |
|------------|------|--------|-------------|
| `ytp-process-youtube-video` | Process YouTube Video | *Configurable* | Open modal to process a video |
| `ytp-open-url-from-clipboard` | Open URL Modal (from clipboard) | *Configurable* | Process URL from clipboard |
| `ytp-batch-process` | Batch Process Videos | *Configurable* | Process multiple videos at once |

---

## Commands

### 1. Process YouTube Video

**Command ID**: `ytp-process-youtube-video`
**Default Name**: `Process YouTube Video`

Opens a modal where you can:
- Paste a YouTube URL
- Select output format (6 options)
- Choose AI provider and model
- Configure performance settings
- Set token limits and temperature

**Usage**:
1. Invoke via Command Palette (`Ctrl/Cmd + P`)
2. Paste YouTube URL
3. Select options
4. Click "Process Video"

---

### 2. Open URL Modal (from Clipboard)

**Command ID**: `ytp-open-url-from-clipboard`
**Default Name**: `YouTube Clipper: Open URL Modal (from clipboard)`

Automatically reads YouTube URL from system clipboard and opens the processing modal.

**Usage**:
1. Copy YouTube URL (`Ctrl/Cmd + C`)
2. Invoke command
3. Modal opens with URL pre-filled
4. Select options and process

---

### 3. Batch Process Videos

**Command ID**: `ytp-batch-process`
**Default Name**: `YouTube Clipper: Batch Process Videos`

Process multiple YouTube videos in sequence with the same settings.

**Usage**:
1. Invoke command
2. Enter multiple YouTube URLs (one per line)
3. Select format, provider, and model
4. Click "Process All"

---

## Trigger Sources

### 1. Ribbon Icon
- **Location**: Left sidebar (ribbon)
- **Action**: Click YouTube icon
- **Result**: Opens video processing modal

### 2. Command Palette
- **Trigger**: `Ctrl/Cmd + P` → Search "YouTube Clipper"
- **Actions**: All three commands available

### 3. URL Auto-Detection
The plugin automatically detects YouTube URLs in:
- **New file creation**: When creating a file with a YouTube URL in the content
- **Active leaf change**: When switching to a note containing a YouTube URL

**Configuration**:
```typescript
// Auto-detection works automatically
// URL patterns supported:
- youtube.com/watch?v=VIDEO_ID
- youtu.be/VIDEO_ID
- youtube.com/embed/VIDEO_ID
- youtube.com/shorts/VIDEO_ID
```

### 4. Protocol Handler
- **Protocol**: `obsidian://youtube-clipper`
- **Usage**: External apps can trigger video processing

**Example (browser console)**:
```javascript
window.location.href = 'obsidian://youtube-clipper?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ';
```

### 5. Chrome Extension (Optional)
A browser extension can send URLs to Obsidian via the protocol handler.

---

## Output Formats

### 1. Executive Summary (`executive-summary`)

**Best for**: Business content, strategy videos, talks

**Structure**:
```markdown
# Executive Summary

## Strategic Insights (3-5 high-impact takeaways)
- **[Category]**: Actionable intelligence with measurable impact
- **Business Implication**: Competitive or operational effect
- **Risk Factor**: Potential challenges to consider
- **Opportunity Window**: Timing-sensitive opportunity

## Executive Summary (200-250 words)
**Core Value**: [Central thesis]

**Analysis**:
- **Market Context**: Industry positioning
- **Competitive Advantage**: Key differentiators
- **Implementation**: Adoption considerations
- **Success Metrics**: Measurement approach

## Strategic Action Plan
- [ ] **[Initiative 1]**: Implementation with timeline
- [ ] **[Initiative 2]**: Risk mitigation or opportunity
- [ ] **[Initiative 3]**: Capability building
- [ ] **[Monitor]**: Key success indicators

## Intelligence Repository
**Cited**: Technologies, research, experts, external links
**Related**: Adjacent opportunities, future trends
```

---

### 2. Step-by-Step Tutorial (`step-by-step-tutorial`)

**Best for**: Tutorials, how-to videos, walkthroughs

**Structure**:
```markdown
# Step-by-Step Tutorial

## Overview (200-250 words)
- **Objective**: What you'll accomplish
- **Scope**: What's covered and what's not
- **Outcome**: Final result
- **Time Investment**: Estimated duration

## Prerequisites
- **Tools Required**: Software/hardware needed
- **Knowledge Needed**: Foundational skills
- **Setup**: Configuration requirements
- **Resources**: Materials to download

## Step-by-Step Implementation

### Phase 1: Foundation
1. **[Step Name]**: Action with specific details
   - **Expected Result**: Success indicator
   - **Troubleshooting**: Common issues and fixes

### Phase 2: Implementation
2. **[Step Name]**: Core action with dependencies
   - **Verification**: How to confirm it works
   - **Integration**: Connection to previous steps

### Phase 3: Refinement
3. **[Step Name]**: Enhancement or optimization
   - **Performance**: What to monitor
   - **Scaling**: Expansion considerations

## Critical Success Factors
- **Common Pitfalls**: Mistakes to avoid
- **Key Decisions**: Important choice points
- **Timing**: When to take action
- **Resources**: Effort allocation

## Resources
- **Links**: Tools, documentation, references
- **Templates**: Reusable components
- **Further Learning**: Advanced topics
```

---

### 3. Concise Summary (`concise-summary`)

**Best for**: Quick review, content curation, skimming

**Structure**:
```markdown
# Concise Summary

## Core Summary (<150 words)
- **Main Point**: Central thesis or key message
- **Key Takeaway**: Primary insight or value proposition
- **Immediate Application**: Quick action item or use case

## Power Takeaways (5 points)
- **[Insight 1]**: Actionable takeaway
- **[Insight 2]**: Strategic point
- **[Insight 3]**: Practical application
- **[Insight 4]**: Resource or tool mentioned
- **[Insight 5]**: Mindset shift or perspective

## Quick Actions
- [ ] **[Action 1]**: Implementation step
- [ ] **[Action 2]**: Resource to explore
- [ ] **[Action 3]**: Concept to research further
```

---

### 4. Technical Analysis (`technical-analysis`)

**Best for**: Programming tutorials, tech talks, architecture videos

**Structure**:
```markdown
# Technical Analysis

**Constraint**: Ignore intros, sponsors, "like and subscribe". Extract technical substance only.

## Tech Stack & Tools
- **Languages/Frameworks**: All with specific versions
- **Libraries**: Dependencies with versions
- **Environment**: Hardware, cloud, or configuration

## Architecture & Design
- **Structure**: System architecture overview
- **Patterns**: Design patterns used (CQRS, Event Sourcing, etc.)
- **Data Flow**: Client to database movement

## Implementation Details
- **Commands/Config**: Specific commands or settings
- **Pseudo-code**: Generated logic when described but not shown
- **Refactoring**: Before/After optimizations

## Engineering Trade-offs
- **Problem Solved**: Specific technical challenge addressed
- **Hot Takes**: Strong technical opinions
- **Trade-offs**: Performance/cost/complexity decisions

## Reproduction Steps
1. **[Action]**: Specific command or action
2. **[Action]**: Next step with dependencies
3. **[Action]**: Verification step
```

---

### 5. 3C Accelerated Learning (`3c-accelerated-learning`)

**Best for**: Educational content, lectures, deep learning

**Structure**:
```markdown
# 3C Accelerated Learning

**Compress → Compile → Consolidate**: Transform video into lasting knowledge.

## 🔹 COMPRESS (80/20 Rule)
The vital 20% delivering 80% value:
- **Core Thesis**: Fundamental message in 1-2 sentences
- **Key Concepts** (5-7): Precise definitions
- **Mental Models**: Visual analogies and metaphors
- **Visuals**: Descriptions of diagrams/demonstrations

## 🔸 COMPILE (Active Application)
- **Framework**: Organized understanding structure
- **Workflow**: Step-by-step implementation checklist
- **Tools/Resources**: Every app, book, site, hardware mentioned
- **Connections**: How concepts relate to each other

## 🔹 CONSOLIDATE (Retention & Transfer)
- **Master Model**: Unifying framework integrating all concepts
- **Recall Anchors**: 6-8 challenging comprehension questions
- **Action Roadmap**: 4-6 measurable next steps with timelines
- **Cross-References**: Related concepts and adjacent fields
- **Success Metrics**: Quantifiable impact indicators

**Transfer Acceleration**:
- **Adaptation**: How to modify for different scenarios
- **Obstacles**: Anticipated challenges and solutions
- **Compound Effect**: How small changes create disproportionate impact
```

---

### 6. Complete Transcription (`complete-transcription`)

**Best for**: Interviews, podcasts, word-for-word records

**Structure**:
```markdown
# Complete Transcription

**CRITICAL**:
- If transcript provided: Include FULL transcript below
- If NO transcript: State "Transcript Not Available: Based on title/description, this video covers:" followed by analysis
- **DO NOT include line numbers, timestamps, or numbering in the transcript**
- Process multimodally (visual/audio) for complete extraction

## Summary (<250 words)
[Core message and main value points]

## Full Transcript

**Structure Guidelines**:
- **NO line numbers, timestamps, or numbering**
- **Sections**: Logical topic segments with ### headers
- **Clean dialogue**: Remove filler words ("um", "uh", "like")
- **Speaker labels**: Format as **[Name]:** with dialogue
- **Readability**: Paragraph breaks between thoughts
- **Emphasis**: **Bold** for key terms, *italics* for visual descriptions
- **Code**: Inline `code` for commands/URLs
- **Resources**: Link as [Name](URL)

**Example Format**:
### Introduction
**[Speaker]:** Opening remarks and topic introduction.

**Key Point:** Main thesis statement.

### Main Content
1. First point with explanation
2. Second point with details

*[Visual: Diagram description]*

### Resources
- [Resource 1](https://example.com)

### Conclusion
Final thoughts and key takeaways
```

---

## AI Providers

### Supported Providers

| Provider | Models | Multimodal | Free Tier |
|----------|--------|------------|-----------|
| Google Gemini | gemini-2.0-flash, gemini-2.5-pro, etc. | Yes | Yes |
| Groq | llama-3.3-70b, mixtral-8x7b, etc. | No | Yes |
| OpenRouter | 100+ models | Varies | Varies |
| Ollama | Local models | Varies | Free (local) |
| Hugging Face | Various | Varies | Varies |

### Default Configuration

```typescript
// Defaults in main.ts
defaultProvider: 'Google Gemini'
defaultModel: 'gemini-2.0-flash'
defaultMaxTokens: 4096
defaultTemperature: 0.5
```

---

## Configuration

### Plugin Settings

```typescript
interface YouTubePluginSettings {
    // API Keys
    geminiApiKey: string;
    groqApiKey: string;
    ollamaApiKey: string;
    ollamaEndpoint: string;           // Default: 'http://localhost:11434'
    huggingFaceApiKey: string;
    openRouterApiKey: string;

    // Output
    outputPath: string;                // Default: 'YouTube/Processed Videos'

    // Environment Variables
    useEnvironmentVariables: boolean;  // Load keys from env vars
    environmentPrefix: string;         // Default: 'YTC'

    // Performance
    performanceMode: PerformanceMode;  // 'fast' | 'balanced' | 'quality'
    enableParallelProcessing: boolean;
    enableAutoFallback: boolean;       // Auto-switch providers on error
    preferMultimodal: boolean;         // Use video analysis when available

    // Model Parameters
    defaultMaxTokens: number;          // Default: 4096
    defaultTemperature: number;        // Default: 0.5

    // Caching
    modelOptionsCache?: Record<string, string[]>;       // Cached model lists
    modelCacheTimestamps?: Record<string, number>;      // Cache timestamps
}
```

### Environment Variables

```bash
# Prefix: YTC (configurable)
export YTC_GEMINI_API_KEY="your-gemini-key"
export YTC_GROQ_API_KEY="your-groq-key"
export YTC_OPENROUTER_API_KEY="your-openrouter-key"
export YTC_HUGGINGFACE_API_KEY="your-huggingface-key"
```

---

## Automation Examples

### Obsidian Hotkeys

**Setting up custom hotkeys**:

1. Open Obsidian Settings
2. Go to **Hotkeys** → **Plugin: YouTube Clipper**
3. Assign hotkeys:

| Command | Suggested Hotkey |
|---------|------------------|
| Process YouTube Video | `Ctrl/Cmd + Shift + Y` |
| Open URL Modal (from clipboard) | `Ctrl/Cmd + Shift + V` |
| Batch Process Videos | `Ctrl/Cmd + Shift + B` |

### URL Protocol Automation

**From browser bookmarklet**:

```javascript
// Create a bookmark with this URL
javascript:window.location.href='obsidian://youtube-clipper?url='+encodeURIComponent(window.location.href);
```

**From terminal script**:

```bash
#!/bin/bash
# yt-process.sh - Process YouTube video from command line

if [ -z "$1" ]; then
    echo "Usage: yt-process.sh <youtube-url>"
    exit 1
fi

URL="$1"
# Try Linux first, then macOS
if command -v xdg-open &> /dev/null; then
    xdg-open "obsidian://youtube-clipper?url=$URL"
elif command -v open &> /dev/null; then
    open "obsidian://youtube-clipper?url=$URL"
else
    echo "Error: Could not open obsidian protocol"
    exit 1
fi
```

**Usage**:
```bash
./yt-process.sh "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### API Access (Plugin API)

**Access plugin from another Obsidian plugin**:

```typescript
// In your plugin's onload()
const youtubeClipper = (this.app as any).plugins.plugins['youtube-to-note'];

if (youtubeClipper) {
    // Get current settings
    const settings = youtubeClipper.getCurrentSettings();

    // Access services
    const serviceContainer = youtubeClipper.getServiceContainer();
    const aiService = serviceContainer?.aiService;

    // Process a video programmatically
    // Note: This would require extending the plugin API
}
```

### Obsidian Templater Integration

**Create a template that processes YouTube videos**:

```markdown
---
---
<%*
// Get YouTube URL from user input
const url = await tp.system.prompt("Enter YouTube URL:");

if (url) {
    // Trigger processing via hotkey simulation
    // User would need to manually invoke the command
    tR += `<!-- YouTube URL: ${url} -->`;
    tR += "\n\nProcess this video with: YouTube Clipper: Open URL Modal (from clipboard)";
} else {
    tR += "No URL provided.";
}
%>
```

### Batch Processing Workflow

**Process a playlist of videos**:

```bash
#!/bin/bash
# process-playlist.sh - Process all videos in a text file

PLAYLIST_FILE="$1"

if [ ! -f "$PLAYLIST_FILE" ]; then
    echo "Playlist file not found: $PLAYLIST_FILE"
    exit 1
fi

while IFS= read -r url; do
    if [[ $url == *"youtube.com"* ]] || [[ $url == *"youtu.be"* ]]; then
        echo "Processing: $url"
        ./yt-process.sh "$url"
        sleep 2  # Brief pause between requests
    fi
done < "$PLAYLIST_FILE"
```

**playlist.txt example**:
```
https://www.youtube.com/watch?v=video1
https://www.youtube.com/watch?v=video2
https://youtu.be/video3
```

---

## Note Structure

Every generated note follows this structure:

```markdown
---
title: [Video Title]
source: [YouTube URL]
created: "YYYY-MM-DD"
type: youtube-note
format: [Output Format]
tags: [youtube]
video_id: "[VIDEO_ID]"
ai_provider: "[Provider Name]"
ai_model: "[Model Name]"
---

<div style="text-align: center; margin-bottom: 24px;">
<iframe width="640" height="360" src="https://www.youtube-nocookie.com/embed/[VIDEO_ID]" ...></iframe>
</div>

---

[AI-generated content in selected format]

---

## Resources
- Video URL: [YouTube URL]
- Processing Date: YYYY-MM-DD
- Provider: [Provider] [Model]
```

### Frontmatter Fields

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Video title | `"How to Build a React App"` |
| `source` | Full YouTube URL | `"https://youtube.com/watch?v=..."` |
| `created` | Processing date | `"2025-01-15"` |
| `type` | Note type | `youtube-note` or `youtube-transcript` |
| `format` | Output format used | `executive-summary` |
| `tags` | Automatic tags | `[youtube]` or `[youtube, transcript]` |
| `video_id` | YouTube video ID | `"dQw4w9WgXcQ"` |
| `ai_provider` | AI provider used | `"Google Gemini"` |
| `ai_model` | AI model used | `"gemini-2.0-flash"` |

---

## Performance Modes

### Fast Mode
- **Goal**: Quick processing
- **Best for**: Short videos, quick summaries
- **Token Usage**: ~30% less
- **Transcript**: Truncated or omitted
- **Prompt**: Simplified analysis

### Balanced Mode (Default)
- **Goal**: Quality vs speed balance
- **Best for**: Most content types
- **Token Usage**: Standard
- **Transcript**: Full (if available)
- **Prompt**: Standard analysis

### Quality Mode
- **Goal**: Maximum quality
- **Best for**: Complex topics, tutorials
- **Token Usage**: ~50% more
- **Transcript**: Full + multimodal processing
- **Prompt**: Comprehensive analysis with visual/audio processing

---

## Advanced Features

### Auto-Fallback

When enabled, the plugin automatically switches to another provider if the primary one fails:

```typescript
// Example: Gemini fails → automatically tries Groq
enableAutoFallback: true
```

**Fallback order**:
1. Selected provider
2. Available configured providers
3. Error notification if all fail

### Model Caching

Model lists are cached to reduce API calls:

```typescript
// Cache structure
modelOptionsCache: {
    "Google Gemini": ["gemini-2.0-flash", "gemini-2.5-pro", ...],
    "Groq": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", ...],
}

modelCacheTimestamps: {
    "Google Gemini": 1705305600000,  // Cache time
    "Groq": 1705305600000,
}
```

**Refresh models**: Click "Refresh" button in provider dropdown

### Multimodal Processing

When available, the AI analyzes both audio and visual content:

```typescript
preferMultimodal: true
```

**Benefits**:
- Extracts on-screen text
- Understands visual demonstrations
- Captures non-verbal cues
- Better comprehension of visual content

### Parallel Processing

Enable parallel processing for faster batch operations:

```typescript
enableParallelProcessing: true
```

**Note**: Currently processes videos sequentially; setting prepares for future parallel batch processing.

---

## URL Patterns Supported

```regex
# Standard watch URL
https://www.youtube.com/watch?v=VIDEO_ID
https://youtube.com/watch?v=VIDEO_ID

# Short URL
https://youtu.be/VIDEO_ID

# Embed URL
https://www.youtube.com/embed/VIDEO_ID

# Shorts
https://www.youtube.com/shorts/VIDEO_ID

# With timestamps
https://www.youtube.com/watch?v=VIDEO_ID&t=60s
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Configuration invalid: No API keys found` | No API keys configured | Add API key in settings |
| `Video ID extraction failed` | Invalid URL | Check URL format |
| `AI Processing failed` | Provider error | Check API key, try different provider |
| `Rate limit exceeded` | Too many requests | Wait or switch providers |
| `Free tier quota exhausted` | Free tier limit | Upgrade plan or wait for reset |

---

## Troubleshooting

### Plugin Not Working

1. **Check Console**: Open Obsidian Developer Console (`Ctrl/Cmd + Shift + I`)
2. **Verify API Keys**: Settings → YouTube Clipper → Check keys
3. **Check Logs**: Look for `[YT-CLIPPER]` entries
4. **Reload Plugin**: Settings → Community Plugins → Reload

### Model List Empty

1. **Check API Key**: Verify key is valid
2. **Refresh Models**: Click refresh button in dropdown
3. **Check Connection**: Ensure internet access
4. **Try Different Provider**: Switch to another provider

### Processing Slow

1. **Switch Mode**: Use "Fast" performance mode
2. **Change Provider**: Try Groq for faster text-only processing
3. **Check Video**: Longer videos take longer
4. **Reduce Tokens**: Lower max tokens setting

---

## FAQ

**Q: Can I use this without an API key?**
A: Only with Ollama (local models). All other providers require an API key.

**Q: Is my data private?**
A: API keys are stored locally in Obsidian settings. Video content is sent to your chosen AI provider.

**Q: Can I add custom output formats?**
A: Currently not. The 6 formats are built-in. Custom formats may be added in future versions.

**Q: Does this work with YouTube Shorts?**
A: Yes, all YouTube URL formats are supported including Shorts.

**Q: Can I batch process an entire playlist?**
A: Use the Batch Process command and paste all video URLs from the playlist.

---

## Resources

- **GitHub Issues**: [Report bugs](https://github.com/youtube-clipper/obsidian-plugin/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/youtube-clipper/obsidian-plugin/discussions)
- **Obsidian Discord**: [Community support](https://discord.gg/obsidianmd)

---

**Version**: 1.3.5
**Last Updated**: 2025-02-04
