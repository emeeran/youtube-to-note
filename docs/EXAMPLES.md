# Usage Examples

This guide provides practical examples of how to use the YouTube Clipper plugin effectively in different scenarios. From basic usage to advanced workflows, these examples will help you get the most out of the plugin.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Output Format Examples](#output-format-examples)
- [Advanced Configuration](#advanced-configuration)
- [Integration Workflows](#integration-workflows)
- [Custom Prompts](#custom-prompts)
- [Batch Processing](#batch-processing)
- [Team Collaboration](#team-collaboration)
- [Development Examples](#development-examples)

## Basic Usage

### Quick Start Example

1. **Open the Plugin**:
   - Press `Ctrl/Cmd + P` to open the command palette
   - Search for "YouTube Clipper: Process YouTube Video"
   - Or click the YouTube Clipper ribbon icon

2. **Process a Video**:
   ```
   URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
   Format: Executive Summary
   Provider: Auto (recommended)
   ```

3. **Result**: A concise summary note created in your vault:
   ```markdown
   ---
   title: "Never Gonna Give You Up"
   source: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   video_id: "dQw4w9WgXcQ"
   format: "executive-summary"
   provider: "gemini"
   model: "gemini-1.5-pro"
   created: "2025-12-02T10:30:00Z"
   tags: ["music", "pop-culture", "viral"]
   ---

   # Never Gonna Give You Up

   ## Key Insights
   - Classic 80s pop song with memorable chorus and dance moves
   - Became an internet phenomenon through Rickrolling culture
   - Represents cultural touchstone of early internet memes

   ## Action Items
   - Great for presentations about internet culture
   - Useful example of viral marketing evolution
   - Consider for music history discussions

   ## Quick Links
   - [Watch Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
   - [Artist Information](https://en.wikipedia.org/wiki/Rick_Astley)

   <iframe width="560" height="315"
           src="https://www.youtube.com/embed/dQw4w9WgXcQ"
           frameborder="0"
           allowfullscreen>
   </iframe>
   ```

### Educational Content Example

**Scenario**: Processing a tutorial video about machine learning

**Input**:
```
URL: https://www.youtube.com/watch?v=aircAruvnKk
Format: Detailed Tutorial
Provider: Gemini (for multimodal analysis)
```

**Result**: Comprehensive tutorial note with step-by-step instructions:

```markdown
---
title: "Machine Learning for Beginners"
source: "https://www.youtube.com/watch?v=aircAruvnKk"
format: "tutorial"
duration: 1800
difficulty: "beginner"
tags: ["machine-learning", "ai", "tutorial", "data-science"]
---

# Machine Learning for Beginners

## Overview
This comprehensive introduction covers the fundamentals of machine learning, suitable for beginners with basic programming knowledge.

## Learning Objectives
- Understand what machine learning is and why it matters
- Learn the difference between supervised, unsupervised, and reinforcement learning
- Grasp basic concepts like training data, models, and predictions
- Explore real-world applications and use cases

## Prerequisites
- Basic Python programming knowledge
- Understanding of mathematical concepts (statistics, linear algebra)
- Familiarity with basic data concepts

## Step-by-Step Guide

### Step 1: Understanding Machine Learning Fundamentals
**Key Points:**
- Machine learning enables computers to learn from data without explicit programming
- Core concept: Patterns → Models → Predictions
- Types of learning: Supervised, Unsupervised, Reinforcement

**Visual Elements:**
- Diagrams showing data flow through ML pipeline
- Comparison table of learning types

### Step 2: Supervised Learning Deep Dive
**Key Concepts:**
- Training data with labeled examples
- Classification vs. regression problems
- Common algorithms: Linear regression, Decision trees, Neural networks

**Practical Examples:**
- Email spam detection
- Image classification
- Price prediction

### Step 3: Unsupervised Learning Techniques
**Key Concepts:**
- Finding patterns in unlabeled data
- Clustering algorithms
- Dimensionality reduction

**Applications:**
- Customer segmentation
- Anomaly detection
- Data compression

### Step 4: Model Evaluation and Validation
**Key Metrics:**
- Accuracy, Precision, Recall
- Cross-validation techniques
- Overfitting prevention

### Step 5: Real-World Implementation
**Best Practices:**
- Data preprocessing and cleaning
- Feature engineering
- Model selection and tuning

## Common Pitfalls and How to Avoid Them

1. **Overfitting**: Using too complex models for limited data
2. **Data Quality**: Not cleaning or preprocessing data properly
3. **Feature Selection**: Including irrelevant or redundant features
4. **Evaluation**: Not using proper validation techniques

## Next Steps
- Practice with real datasets
- Explore advanced algorithms
- Learn about deep learning and neural networks
- Apply ML to your domain of interest

## Additional Resources
- Recommended online courses
- Essential books and papers
- Open-source ML libraries

<iframe width="560" height="315"
        src="https://www.youtube.com/embed/aircAruvnKk"
        frameborder="0"
        allowfullscreen>
</iframe>
```

## Output Format Examples

### Executive Summary for Business Meeting

**Video**: Business strategy presentation (45 minutes)

```markdown
---
title: "Q4 Strategic Planning Summary"
source: "https://www.youtube.com/watch?v=example"
format: "executive-summary"
business_context: "quarterly-planning"
---

# Q4 Strategic Planning Summary

## Key Insights
- Revenue growth targets exceeded by 15% due to successful product launches
- New market expansion showing 300% ROI within first 6 months
- Customer acquisition costs reduced by 40% through optimization

## Action Items
- Scale successful marketing campaigns to additional regions
- Allocate additional resources to high-performing product lines
- Review and replicate successful expansion strategies

## Strategic Recommendations
- Focus on emerging markets with similar demographics
- Invest in customer retention programs for long-term growth
- Consider strategic partnerships for accelerated market entry
```

### Brief Overview for Quick Reference

**Video**: Product demo video (5 minutes)

```markdown
---
title: "Quick Product Overview"
source: "https://www.youtube.com/watch?v=example"
format: "brief"
---

# Quick Product Overview

## Key Points
- AI-powered video analysis tool
- Saves 80% time on note-taking
- Integrates with Obsidian seamlessly
- Supports multiple output formats

## Quick Links
- [Website](https://example.com)
- [Documentation](https://docs.example.com)
- [Pricing](https://example.com/pricing)
```

## Advanced Configuration

### Custom Output Path with Templates

**Setting up organized note storage**:

```typescript
// In plugin settings
Output Path Template: "📚 Learning/{{year}}/{{month}}/{{format}}/"
```

**Resulting file structure**:
```
📚 Learning/
├── 2025/
│   ├── 12/
│   │   ├── executive-summary/
│   │   │   └── 2025-12-02_Machine-Learning-Basics.md
│   │   ├── tutorial/
│   │   │   └── 2025-12-02_Python-Programming.md
│   │   └── brief/
│   │       └── 2025-12-02_Quick-News-Summary.md
```

### Environment Variables for Team Setup

**Team deployment configuration**:

```bash
# .env file for team deployment
export YTC_GEMINI_API_KEY="team-gemini-key"
export YTC_GROQ_API_KEY="team-groq-key"
export YTC_DEFAULT_PROVIDER="gemini"
export YTC_OUTPUT_PATH="/shared/notes/youtube-clips/"
export YTC_ENABLE_PARALLEL="true"
export YTC_BATCH_SIZE="5"
export YTC_LOG_LEVEL="warn"
```

### Performance Optimization Settings

**For high-volume processing**:

```typescript
// Advanced settings configuration
{
  performanceMode: 'fast',
  enableParallelProcessing: true,
  batchSize: 5,
  cacheSize: 200,
  cacheTTL: 7200, // 2 hours
  timeouts: {
    gemini: 30000,
    groq: 20000,
    ollama: 60000,
    metadata: 10000
  },
  defaultMaxTokens: 4000,
  defaultTemperature: 0.7
}
```

## Integration Workflows

### Research Workflow

**Scenario**: Academic researcher processing multiple lecture videos

```markdown
# Research Workflow Setup

## 1. Configure Output Organization
- Path: "🎓 Research/{{course}}/{{date}}/"
- Format: Tutorial for detailed analysis
- Provider: Gemini for multimodal content

## 2. Processing Pipeline
1. **Collect Videos**: Gather lecture URLs for the week
2. **Batch Process**: Use parallel processing for efficiency
3. **Tag and Organize**: Add course-specific tags
4. **Review and Enhance**: Add personal insights and connections

## 3. Integration with Zettelkasten
- Link related concepts across lectures
- Create atomic notes for key concepts
- Build knowledge graph through backlinks
```

### Content Creation Workflow

**Scenario**: Content creator analyzing competitor videos

```markdown
# Content Creation Analysis

## 1. Competitive Analysis Setup
- Provider: Groq for fast processing
- Format: Executive Summary for quick insights
- Output: "📊 Content Analysis/{{competitor}}/"

## 2. Analysis Process
1. **Process Multiple Videos**: Competitor's recent content
2. **Identify Patterns**: Common topics, formats, engagement strategies
3. **Extract Insights**: What works, what doesn't, opportunities
4. **Generate Ideas**: Content gaps and improvement opportunities

## 3. Content Planning
- Use analysis to inform content calendar
- Identify trending topics within niche
- Develop unique value propositions
```

### Learning Workflow

**Scenario**: Student creating study materials

```markdown
# Study Material Creation

## 1. Course Organization
- Path: "📚 Study/{{course}}/Week-{{week}}/"
- Format: Tutorial for comprehensive notes
- Custom Prompts: Focus on exam-relevant content

## 2. Weekly Processing
- Process lecture videos immediately after class
- Add personal notes and questions
- Link to related materials and concepts

## 3. Exam Preparation
- Review all generated notes
- Create summary sheets from key insights
- Use embedded videos for quick review
```

## Custom Prompts

### Technical Analysis Prompt

```typescript
// Custom prompt for software development tutorials
const softwareDevPrompt = `
Analyze this YouTube video about software development and create comprehensive notes that include:

1. **Technical Concepts Explained**:
   - Code examples and their explanations
   - Architecture patterns discussed
   - Programming languages and frameworks used

2. **Practical Implementation**:
   - Step-by-step coding instructions
   - Common pitfalls and how to avoid them
   - Best practices demonstrated

3. **Resources and Tools**:
   - IDE/Editor configurations shown
   - Libraries or packages mentioned
   - Development tools used

4. **Learning Objectives**:
   - Key takeaways for developers
   - Skills that can be immediately applied
   - Prerequisites needed to understand the content

Focus on making this suitable for software developers who want to implement the concepts shown in the video. Include code snippets in proper markdown formatting.

Video URL: __VIDEO_URL__
Video Title: __VIDEO_TITLE__
Channel: __CHANNEL_NAME__
Published: __PUBLISHED_DATE__
Duration: __DURATION__
`;
```

### Business Strategy Prompt

```typescript
// Custom prompt for business and marketing content
const businessStrategyPrompt = `
Analyze this business/marketing YouTube video and create strategic insights:

1. **Business Models Discussed**:
   - Revenue streams and pricing strategies
   - Business operations and workflows
   - Market positioning and competitive advantages

2. **Marketing Strategies**:
   - Customer acquisition tactics
   - Brand positioning methods
   - Growth hacking techniques shared

3. **Financial Insights**:
   - Investment requirements mentioned
   - ROI and profitability discussions
   - Cost optimization strategies

4. **Actionable Takeaways**:
   - Strategies that can be implemented immediately
   - Resources or tools recommended
   - Industry trends and future predictions

Format this for business professionals looking for actionable insights they can apply to their own ventures.

Video Details:
- Title: __VIDEO_TITLE__
- Channel: __CHANNEL_NAME__
- URL: __VIDEO_URL__
- Publication Date: __PUBLISHED_DATE__
`;
```

### Health and Fitness Prompt

```typescript
// Custom prompt for health and fitness content
const healthFitnessPrompt = `
Create detailed fitness and health notes from this YouTube video:

1. **Exercise Routines**:
   - Specific exercises demonstrated
   - Reps, sets, and duration recommendations
   - Proper form cues and technique tips
   - Modifications for different fitness levels

2. **Nutrition Information**:
   - Dietary advice given
   - Meal timing and portion suggestions
   - Supplement recommendations
   - Hydration guidelines

3. **Health Benefits**:
   - Scientific explanations of benefits
   - Target muscle groups or body systems
   - Expected results and timeline
   - Safety considerations and contraindications

4. **Implementation Guide**:
   - Equipment needed
   - Frequency recommendations
   - Progress tracking suggestions
   - When to expect results

Make this suitable for people looking to improve their health and fitness with clear, actionable guidance.

Video Information:
- Title: __VIDEO_TITLE__
- Instructor: __CHANNEL_NAME__
- Duration: __DURATION__
- Difficulty: (assess from content)
`;
```

## Batch Processing

### JavaScript API Example

```javascript
// Example: Process multiple videos programmatically
const videos = [
  {
    url: 'https://www.youtube.com/watch?v=video1',
    format: 'executive-summary',
    outputPath: '📥 Business/Market Research/'
  },
  {
    url: 'https://www.youtube.com/watch?v=video2',
    format: 'tutorial',
    outputPath: '📚 Learning/Technical/'
  },
  {
    url: 'https://www.youtube.com/watch?v=video3',
    format: 'brief',
    outputPath: '📝 Quick Notes/'
  }
];

// Process all videos in parallel
const results = await youtubeClipper.processBatch(videos);

console.log(`Processed ${results.length} videos successfully`);
results.forEach((result, index) => {
  if (result.success) {
    console.log(`Video ${index + 1}: ${result.filePath}`);
  } else {
    console.error(`Video ${index + 1} failed: ${result.error}`);
  }
});
```

### TypeScript Integration

```typescript
import { YouTubeClipperAPI, VideoProcessingOptions } from 'youtube-clipper-api';

class VideoProcessor {
  private clipper: YouTubeClipperAPI;

  constructor() {
    this.clipper = new YouTubeClipperAPI({
      defaultProvider: 'gemini',
      outputPath: '📚 Study Materials/',
      enableParallelProcessing: true,
      batchSize: 3
    });
  }

  async processCourseVideos(videoUrls: string[], courseName: string) {
    const options: VideoProcessingOptions[] = videoUrls.map(url => ({
      url,
      format: 'tutorial',
      outputPath: `📚 Study Materials/${courseName}/`,
      customPrompt: this.createStudyPrompt(courseName)
    }));

    try {
      const results = await this.clipper.processBatch(options);
      return results.filter(result => result.success);
    } catch (error) {
      console.error('Batch processing failed:', error);
      throw error;
    }
  }

  private createStudyPrompt(courseName: string): string {
    return `Create detailed study notes for ${courseName}. Focus on concepts that would appear on exams and provide clear explanations with examples.`;
  }
}

// Usage example
const processor = new VideoProcessor();
const courseVideos = [
  'https://www.youtube.com/watch?v=lecture1',
  'https://www.youtube.com/watch?v=lecture2',
  'https://www.youtube.com/watch?v=lecture3'
];

const results = await processor.processCourseVideos(courseVideos, 'Machine Learning 101');
console.log(`Created ${results.length} study notes`);
```

## Team Collaboration

### Shared Knowledge Base Setup

```markdown
# Team Knowledge Base Workflow

## 1. Centralized Configuration
- Shared API keys with usage monitoring
- Consistent output path: "🏢 Company/Knowledge Base/"
- Standardized tagging: `[team-name]`, `[project-name]`

## 2. Content Standards
- Use executive summary for meeting recordings
- Tutorial format for training materials
- Brief format for quick updates

## 3. Review Process
1. **Initial Processing**: Team members process videos
2. **Quality Review**: Content specialist reviews generated notes
3. **Enhancement**: Add internal context and action items
4. **Approval**: Team lead approves for knowledge base

## 4. Knowledge Management
- Regular review and update of content
- Link related videos and concepts
- Create master index of processed content
```

### Environment Variable Template

```bash
# team-env-template.sh
export YTC_GEMINI_API_KEY="shared-team-key"
export YTC_GROQ_API_KEY="shared-groq-key"
export YTC_DEFAULT_PROVIDER="gemini"
export YTC_OUTPUT_PATH="/shared/knowledge-base/"
export YTC_ENABLE_PARALLEL="true"
export YTC_BATCH_SIZE="3"
export YTC_DEFAULT_FORMAT="executive-summary"
export YTC_LOG_LEVEL="warn"

# Team-specific settings
export YTC_TEAM_NAME="YourTeamName"
export YTC_DEFAULT_TAGS="team-knowledge,internal-use"
```

## Development Examples

### Custom AI Provider

```typescript
// Example: Adding a custom AI provider
import { BaseAIProvider } from 'youtube-clipper-api';

class CustomOpenAIProvider extends BaseAIProvider {
  name = 'custom-openai';
  model = 'gpt-4-vision-preview';

  async process(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxTokens || 2000,
        temperature: this.temperature || 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// Register the custom provider
const customProvider = new CustomOpenAIProvider('your-openai-api-key');
youtubeClipper.registerProvider(customProvider);
```

### Plugin Integration

```typescript
// Example: Integrating with another Obsidian plugin
import { App, Plugin } from 'obsidian';

class YouTubeIntegrationPlugin extends Plugin {
  async onload() {
    // Register command to process current tab's YouTube video
    this.addCommand({
      id: 'process-current-tab',
      name: 'Process Current Tab YouTube Video',
      callback: async () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const content = activeView.editor.getValue();
        const youtubeUrls = this.extractYouTubeUrls(content);

        for (const url of youtubeUrls) {
          await this.processYouTubeVideo(url);
        }
      }
    });
  }

  private extractYouTubeUrls(content: string): string[] {
    const youtubeRegex = /https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/g;
    return content.match(youtubeRegex) || [];
  }

  private async processYouTubeVideo(url: string) {
    // Integration with YouTube Clipper plugin
    const clipper = this.app.plugins.plugins['youtube-clipper'];
    if (clipper) {
      await clipper.processVideo({
        url,
        format: 'executive-summary',
        autoInsert: true
      });
    }
  }
}
```

### Webhook Integration

```javascript
// Example: Webhook handler for automated video processing
const express = require('express');
const app = express();

app.post('/webhook/youtube', express.json(), async (req, res) => {
  const { videoUrl, format, outputPath } = req.body;

  try {
    // Process video using YouTube Clipper API
    const result = await youtubeClipper.processVideo({
      url: videoUrl,
      format: format || 'executive-summary',
      outputPath: outputPath || '/automated/',
      provider: 'gemini'
    });

    // Send notification to Slack/Teams
    await sendNotification(`Processed video: ${result.filePath}`);

    res.json({ success: true, filePath: result.filePath });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

async function sendNotification(message) {
  // Slack webhook integration
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message })
  });
}
```

---

These examples demonstrate the versatility and power of the YouTube Clipper plugin across various use cases. Whether you're a student, researcher, content creator, or business professional, these examples can help you integrate video analysis into your workflow effectively.

For more advanced use cases and custom integrations, refer to the [API Documentation](API.md) and [Architecture Guide](ARCHITECTURE.md).