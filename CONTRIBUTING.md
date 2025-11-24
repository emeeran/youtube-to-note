# Contributing to YT-Clipper

Thank you for your interest in contributing to YT-Clipper! This document provides guidelines and information to help you contribute effectively.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Git**: For version control
- **Obsidian**: For testing the plugin

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/yt-clipper.git
   cd yt-clipper
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Development Mode**
   ```bash
   npm run dev
   ```
   This will start the development build with watch mode.

4. **Load Plugin in Obsidian**
   - Go to Settings → Community Plugins → Browse
   - Turn on "Safe mode" off
   - Click "Install from disk" and select the plugin folder

### Project Structure

```
yt-clipper/
├── src/                    # Main source code
│   ├── main.ts            # Plugin entry point
│   ├── services/          # Core services
│   │   ├── ai-service.ts
│   │   ├── url-handler.ts
│   │   ├── modal-manager.ts
│   │   ├── encryption-service.ts
│   │   ├── retry-service.ts
│   │   ├── performance-monitor.ts
│   │   └── logger.ts
│   ├── types/             # TypeScript definitions
│   ├── modals/            # UI components
│   └── utils/             # Utility functions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── fixtures/         # Test data
├── docs/                 # Documentation
├── assets/               # Static assets
└── scripts/              # Build and utility scripts
```

## Development Guidelines

### Code Style

We use automated tools to maintain code quality:

- **ESLint**: Linting with TypeScript rules
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks for quality checks

Before committing, ensure:
```bash
npm run lint:fix    # Fix linting issues
npm run format      # Format code
npm run type-check  # Check TypeScript types
npm test            # Run tests
```

### Code Standards

1. **TypeScript**: Strict mode enabled
   - No `any` types unless absolutely necessary
   - Explicit return types for public methods
   - Proper interface definitions

2. **Naming Conventions**
   - Classes: PascalCase (`ServiceContainer`)
   - Methods: camelCase (`processVideo`)
   - Constants: UPPER_SNAKE_CASE (`DEFAULT_SETTINGS`)
   - Files: kebab-case (`url-handler.ts`)

3. **Documentation**
   - JSDoc comments for all public APIs
   - Inline comments for complex logic
   - README for each major service

### Testing Guidelines

#### Unit Tests
- Test all public methods
- Mock external dependencies
- Cover edge cases and error conditions
- Aim for 80%+ coverage

#### Integration Tests
- Test service interactions
- Test real API calls when possible
- Use test fixtures for consistent data

#### Test Structure
```typescript
describe('ServiceName', () => {
    beforeEach(() => {
        // Setup
    });

    describe('methodName', () => {
        it('should do expected behavior', async () => {
            // Arrange
            // Act
            // Assert
        });
    });
});
```

### Commit Guidelines

#### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```bash
feat(ai-service): add support for new AI provider
fix(url-handler): resolve temp file detection issue
docs(readme): update installation instructions
test(encryption): add comprehensive encryption tests
```

### Pull Request Process

1. **Create Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code following the guidelines
   - Add tests for new functionality
   - Update documentation

3. **Run Quality Checks**
   ```bash
   npm run lint
   npm run test
   npm run type-check
   npm run build
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(service): add new feature"
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Use descriptive title and description
   - Link to relevant issues
   - Include screenshots for UI changes
   - Request review from maintainers

#### PR Checklist
- [ ] Code follows style guidelines
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No console.log statements (use logger instead)
- [ ] No TODO comments left
- [ ] Breaking changes documented

## Architecture Guidelines

### Service Design

1. **Single Responsibility**: Each service should have one clear purpose
2. **Dependency Injection**: Use ServiceContainer for dependency management
3. **Interface Segregation**: Define clear interfaces for services
4. **Error Handling**: Use centralized error handling with proper logging

### Performance Considerations

1. **Async Operations**: Use async/await for all I/O operations
2. **Caching**: Implement caching for expensive operations
3. **Retry Logic**: Use RetryService for external API calls
4. **Monitoring**: Add performance metrics for new operations

### Security Guidelines

1. **Input Validation**: Validate all external inputs
2. **Sensitive Data**: Use EncryptionService for API keys
3. **Error Messages**: Don't expose sensitive information in errors
4. **Dependencies**: Keep dependencies updated and vetted

## Adding New Features

### New AI Provider

1. Create provider class implementing `AIProvider` interface
2. Add to ServiceContainer factory
3. Update types and configuration
4. Add tests
5. Update documentation

### New Output Format

1. Add to `OutputFormat` type
2. Update PromptService with new template
3. Add UI elements in YouTubeUrlModal
4. Add tests for new format
5. Update documentation

### New Service

1. Create service interface
2. Implement service class
3. Add to ServiceContainer
4. Add to main.ts initialization
5. Add comprehensive tests
6. Update architecture documentation

## Debugging

### Logging

Use the structured logger:
```typescript
import { logger } from './services/logger';

logger.info('Operation completed', 'ServiceName', { data: 'value' });
logger.error('Operation failed', 'ServiceName', { error: error.message });
```

### Performance Monitoring

Add performance metrics:
```typescript
import { performanceMonitor } from './services/performance-monitor';

await performanceMonitor.measureOperation('operation-name', async () => {
    // Your code here
});
```

### Common Issues

1. **Build Errors**: Check TypeScript types and imports
2. **Plugin Loading**: Verify manifest.json and main.js
3. **API Issues**: Check API keys and rate limits
4. **UI Issues**: Check Obsidian API compatibility

## Release Process

### Version Management

We use semantic versioning:
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json` and `manifest.json`
2. Update changelog
3. Run full test suite
4. Create release tag
5. Build production version
6. Update documentation

## Getting Help

### Resources

- **Obsidian Plugin API**: [Official Documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- **TypeScript Documentation**: [Official Guide](https://www.typescriptlang.org/docs/)
- **Project Issues**: [GitHub Issues](https://github.com/your-username/yt-clipper/issues)

### Communication

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Report bugs or request features
- **Discord**: Join our community Discord (if available)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and constructive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

Thank you for contributing to YT-Clipper! 🎥📝