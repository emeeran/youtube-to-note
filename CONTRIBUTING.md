# Contributing to YouTube Clipper

Thank you for your interest in contributing to the YouTube Clipper plugin! This guide will help you get started with contributing code, documentation, bug fixes, and new features.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Structure](#code-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Standards](#code-standards)
- [Submitting Changes](#submitting-changes)
- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)
- [Documentation](#documentation)
- [Community](#community)

## Getting Started

### Prerequisites

- **Node.js**: Version 16.0.0 or higher
- **npm**: Version 7.0.0 or higher
- **Git**: For version control
- **Obsidian**: Latest version for testing
- **TypeScript**: Knowledge of TypeScript is recommended
- **AI API Keys**: At least one AI provider API key for testing

### First-Time Setup

1. **Fork the Repository**:
   ```bash
   # Fork the repository on GitHub
   # Then clone your fork
   git clone https://github.com/your-username/youtube-clipper.git
   cd youtube-clipper
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   ```bash
   # Create .env file for development
   cp .env.example .env

   # Edit .env with your API keys
   YTC_GEMINI_API_KEY="your-gemini-key"
   YTC_GROQ_API_KEY="your-groq-key"
   YTC_DEBUG_MODE="true"
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Testing**:
   ```bash
   npm run build
   ```

## Development Setup

### Project Structure

```
youtube-clipper/
├── src/                          # Source code
│   ├── main.ts                   # Plugin entry point
│   ├── types.ts                  # TypeScript type definitions
│   ├── constants/                # Constants and enums
│   ├── services/                 # Core business logic
│   │   ├── ai/                  # AI provider implementations
│   │   ├── cache/               # Caching services
│   │   ├── file/                # File operations
│   │   ├── youtube/             # YouTube integration
│   │   └── prompt-service.ts    # AI prompt generation
│   ├── components/               # UI components
│   │   ├── modals/              # Input dialogs
│   │   └── settings/            # Settings tab
│   ├── interfaces/              # TypeScript interfaces
│   ├── security/                # Security implementations
│   ├── utils/                   # Utility functions
│   └── performance/             # Performance optimizations
├── tests/                        # Test files
├── docs/                         # Documentation
├── examples/                     # Usage examples
├── scripts/                      # Build and utility scripts
├── esbuild.config.mjs            # Build configuration
├── manifest.json                 # Plugin manifest
├── package.json                  # Dependencies and scripts
└── README.md                     # Project documentation
```

### Development Scripts

```json
{
  "scripts": {
    "dev": "npm run build -- --watch",
    "build": "node esbuild.config.mjs",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write src",
    "version": "node scripts/version.js"
  }
}
```

### IDE Configuration

**VS Code Recommended Extensions**:
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Jest
- Auto Rename Tag
- Path Intellisense

**VS Code Settings** (.vscode/settings.json):
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```

## Code Structure

### Service Architecture

The plugin follows a service-oriented architecture with dependency injection:

```typescript
// ServiceContainer - Central DI container
class ServiceContainer {
  private services = new Map<string, any>()

  register<T>(name: string, factory: () => T): void
  get<T>(name: string): T
  createServices(settings: YouTubePluginSettings): void
}

// Example service usage
const serviceContainer = ServiceContainer.getInstance()
const aiService = serviceContainer.get<AIService>('aiService')
```

### Adding New Services

1. **Create Service Interface**:
   ```typescript
   // src/interfaces/new-service.ts
   export interface INewService {
     performAction(input: string): Promise<string>
   }
   ```

2. **Implement Service**:
   ```typescript
   // src/services/new-service.ts
   export class NewService implements INewService {
     async performAction(input: string): Promise<string> {
       // Implementation
     }
   }
   ```

3. **Register in ServiceContainer**:
   ```typescript
   // src/services/service-container.ts
   private createNewService(settings: YouTubePluginSettings): NewService {
     return new NewService()
   }
   ```

### Adding New AI Providers

1. **Extend Base Provider**:
   ```typescript
   // src/services/ai/new-provider.ts
   export class NewProvider extends BaseAIProvider {
     name = 'new-provider'
     model = 'new-model'

     async process(prompt: string): Promise<string> {
       // API implementation
     }
   }
   ```

2. **Register Provider**:
   ```typescript
   // src/services/ai/ai-service.ts
   private createProviders(): BaseAIProvider[] {
     return [
       new GeminiProvider(this.settings.geminiApiKey),
       new GroqProvider(this.settings.groqApiKey),
       new NewProvider(this.settings.newProviderApiKey),
     ]
   }
   ```

## Development Workflow

### 1. Create a Feature Branch

```bash
# Create and switch to new branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-number-description
```

### 2. Make Changes

- Follow the existing code style and patterns
- Add TypeScript types for new code
- Include comments for complex logic
- Update relevant documentation

### 3. Test Your Changes

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm test

# Build project
npm run build
```

### 4. Commit Changes

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new AI provider support"

# For bug fixes
git commit -m "fix: resolve URL validation issue for short links"

# For documentation
git commit -m "docs: update API documentation with new endpoints"
```

### 5. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create pull request on GitHub
# Fill out PR template with details
```

## Testing

### Unit Tests

```typescript
// tests/services/new-service.test.ts
import { NewService } from '../../src/services/new-service'

describe('NewService', () => {
  let service: NewService

  beforeEach(() => {
    service = new NewService()
  })

  it('should perform action correctly', async () => {
    const result = await service.performAction('test input')
    expect(result).toBe('expected output')
  })
})
```

### Integration Tests

```typescript
// tests/integration/ai-service.test.ts
import { AIService } from '../../src/services/ai/ai-service'

describe('AIService Integration', () => {
  it('should process with fallback providers', async () => {
    const aiService = new AIService(mockSettings)
    const result = await aiService.process('test prompt')
    expect(result).toBeTruthy()
  })
})
```

### Testing AI Providers

```typescript
// tests/services/ai/providers.test.ts
describe('AI Providers', () => {
  describe('GeminiProvider', () => {
    it('should handle API responses correctly', async () => {
      const provider = new GeminiProvider('test-key')
      // Mock API call
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

      const result = await provider.process('test prompt')
      expect(result).toBe('processed response')
    })
  })
})
```

### Manual Testing

1. **Install Plugin in Obsidian**:
   ```bash
   npm run build
   # Copy files to Obsidian plugins directory
   cp -r dist/* ~/.obsidian/plugins/youtube-clipper/
   cp manifest.json ~/.obsidian/plugins/youtube-clipper/
   ```

2. **Test Functionality**:
   - Plugin loads without errors
   - Settings panel opens correctly
   - Video processing works
   - Error handling functions

### Test Checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Plugin loads in Obsidian
- [ ] Settings work correctly
- [ ] Video processing functions
- [ ] Error handling works
- [ ] Performance acceptable

## Code Standards

### TypeScript Guidelines

1. **Use Strict Types**:
   ```typescript
   // Good
   function processVideo(url: string, options: VideoProcessingOptions): Promise<ProcessingResult>

   // Bad
   function processVideo(url, options) {
   ```

2. **Prefer Interfaces over Types for Objects**:
   ```typescript
   // Good
   interface VideoData {
     title: string
     videoId: string
     duration: number
   }

   // Avoid for object shapes
   type VideoData = {
     title: string
     videoId: string
     duration: number
   }
   ```

3. **Use Enums for Constants**:
   ```typescript
   enum OutputFormat {
     EXECUTIVE_SUMMARY = 'executive-summary',
     TUTORIAL = 'tutorial',
     BRIEF = 'brief'
   }
   ```

### Naming Conventions

- **Files**: kebab-case (`youtube-url-modal.ts`)
- **Classes**: PascalCase (`VideoProcessingService`)
- **Methods**: camelCase (`processVideo()`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_TOKENS_DEFAULT`)
- **Interfaces**: Prefix with I (`IAIService`)

### Error Handling

```typescript
// Use custom error classes
export class VideoProcessingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'VideoProcessingError'
  }
}

// Handle errors gracefully
try {
  const result = await processVideo(url, options)
  return result
} catch (error) {
  if (error instanceof VideoProcessingError) {
    logger.error('Processing failed', { code: error.code }, 'VideoProcessor')
    throw new UserFriendlyError('Unable to process video. Please check the URL and try again.')
  }
  throw error
}
```

### Logging

```typescript
// Use the secure logger
import { logger } from '../utils/secure-logger'

// Log with context
logger.info('Processing video started', { videoId, format }, 'VideoProcessor')

// Log errors with details
logger.error('API request failed', {
  provider: 'gemini',
  statusCode: response.status,
  error: error.message
}, 'AIService')
```

## Submitting Changes

### Pull Request Process

1. **Create Pull Request**:
   - Use descriptive title
   - Fill out PR template
   - Link relevant issues
   - Add screenshots for UI changes

2. **PR Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] Build passes
   ```

3. **Code Review**:
   - Address reviewer feedback
   - Update tests as needed
   - Keep PR up to date with main branch

### Commit Message Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(ai): add support for Claude AI provider

fix(youtube): handle age-restricted videos correctly

docs(api): update provider interface documentation

refactor(services): extract common validation logic
```

## Bug Reports

### Before Reporting

1. **Check Existing Issues**:
   - Search open and closed issues
   - Check if already fixed in latest version

2. **Reproduce Issue**:
   - Clear steps to reproduce
   - Consistent behavior
   - Test with different configurations

3. **Gather Information**:
   - Plugin version
   - Obsidian version
   - Operating system
   - Browser/version (if applicable)
   - Error messages
   - Console logs

### Bug Report Template

```markdown
## Bug Description
Clear and concise description of the bug

## Steps to Reproduce
1. Open Obsidian
2. Go to YouTube Clipper settings
3. Enter API key
4. Try to process video
5. Error occurs

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Plugin Version: 1.3.5
- Obsidian Version: 1.4.0
- OS: Windows 11
- Browser: Chrome 120

## Error Messages
```
Paste full error message and stack trace here
```

## Additional Context
- Configuration details
- Related screenshots
- Any other relevant information
```

## Feature Requests

### Proposing Features

1. **Check Existing Requests**:
   - Search for similar feature requests
   - Check if already planned

2. **Provide Detailed Description**:
   - Problem you're trying to solve
   - Proposed solution
   - Alternative approaches considered

3. **Consider Impact**:
   - User value
   - Implementation complexity
   - Breaking changes

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature

## Problem Statement
What problem does this feature solve?

## Proposed Solution
How should the feature work?

## Alternative Solutions
Other approaches considered

## Additional Context
- Use cases
- User stories
- Implementation ideas
- Mockups or screenshots
```

## Documentation

### Documentation Types

1. **API Documentation**:
   - Method signatures
   - Parameter descriptions
   - Return types
   - Usage examples

2. **User Documentation**:
   - Installation guides
   - Configuration instructions
   - Troubleshooting guides
   - FAQ sections

3. **Developer Documentation**:
   - Architecture overview
   - Development setup
   - Contributing guidelines
   - Code examples

### Writing Documentation

- Use clear, concise language
- Include code examples
- Add screenshots for UI elements
- Keep documentation up to date
- Use consistent formatting

### Documentation Structure

```
docs/
├── API.md                    # API reference
├── ENVIRONMENT.md            # Environment variables
├── TROUBLESHOOTING.md        # Troubleshooting guide
├── ARCHITECTURE.md           # System architecture
├── CONTRIBUTING.md           # Contributing guidelines
└── examples/                 # Usage examples
    ├── basic-usage.md
    ├── custom-providers.md
    └── advanced-configuration.md
```

## Community

### Getting Help

1. **GitHub Discussions**: For questions and ideas
2. **GitHub Issues**: For bug reports and feature requests
3. **Documentation**: Check existing documentation first

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate
- Use inclusive language
- Focus on constructive feedback
- Help others learn and grow

### Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special thanks in documentation

## Release Process

### Version Management

- Follow Semantic Versioning (SemVer)
- Update version in `manifest.json` and `package.json`
- Use `npm run version` script for automated updates

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers updated
- [ ] Build and test production bundle
- [ ] Create GitHub release
- [ ] Update documentation website

### Publishing

1. **Create Release**:
   ```bash
   npm run version patch  # or minor, major
   git push origin main --tags
   ```

2. **GitHub Release**:
   - Go to releases page
   - Create new release from tag
   - Add release notes
   - Attach build artifacts

---

Thank you for contributing to YouTube Clipper! Your contributions help make this plugin better for everyone. If you have any questions or need help getting started, please don't hesitate to reach out through GitHub Discussions.