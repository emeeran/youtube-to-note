# Testing Guide

## Overview

This directory contains all tests for the YouTube Clipper Obsidian plugin. Tests are organized into three main categories:

- **Unit Tests**: `tests/unit/` - Test individual functions, classes, and modules in isolation
- **Integration Tests**: `tests/integration/` - Test how multiple modules work together
- **E2E Tests**: `tests/e2e/` - Test complete user workflows

## Directory Structure

```
tests/
├── __mocks__/          # Mock implementations
│   └── obsidian.ts     # Obsidian API mock
├── fixtures/           # Test data and fixtures
│   ├── index.ts
│   ├── video-data.fixtures.ts
│   └── settings.fixtures.ts
├── unit/               # Unit tests
│   ├── services/       # Service layer tests
│   ├── components/     # UI component tests
│   └── utils/          # Utility function tests
├── integration/        # Integration tests
├── e2e/                # End-to-end tests
├── utils/              # Test helper utilities
│   └── test-helpers.ts
├── setup.ts            # Global test setup
└── README.md           # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- url-handler.spec.ts

# Run tests matching a pattern
npm test -- --testNamePattern="URL validation"
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { URLHandler } from '../../src/services/url-handler';
import { VALID_YOUTUBE_URLS, INVALID_YOUTUBE_URLS } from '@tests/fixtures';

describe('URLHandler', () => {
    let handler: URLHandler;

    beforeEach(() => {
        handler = new URLHandler();
    });

    describe('validateYouTubeUrl', () => {
        it('should accept valid YouTube URLs', () => {
            expect(handler.validateYouTubeUrl(VALID_YOUTUBE_URLS.STANDARD)).toBe(true);
            expect(handler.validateYouTubeUrl(VALID_YOUTUBE_URLS.SHORT)).toBe(true);
        });

        it('should reject invalid YouTube URLs', () => {
            expect(handler.validateYouTubeUrl(INVALID_YOUTUBE_URLS.MALFORMED)).toBe(false);
            expect(handler.validateYouTubeUrl(INVALID_YOUTUBE_URLS.NOT_URL)).toBe(false);
        });
    });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import { AIService } from '../../src/services/ai-service';
import { createMockApp } from '@tests/utils/test-helpers';

describe('AIService Integration', () => {
    it('should process video end-to-end', async () => {
        const app = createMockApp();
        const aiService = new AIService(app, { /* settings */ });

        const result = await aiService.processVideo({
            videoId: 'test-id',
            transcript: 'Test transcript'
        });

        expect(result).toBeDefined();
        expect(result.content).toBeTruthy();
    });
});
```

### Using Test Helpers

```typescript
import {
    createMockApp,
    createMockVideoData,
    createMockSettings,
    flushPromises,
    delay,
} from '@tests/utils/test-helpers';

// Create mock objects
const app = createMockApp();
const videoData = createMockVideoData();
const settings = createMockSettings();

// Handle async operations
await flushPromises(); // Wait for all promises to resolve
await delay(100);      // Wait for specific time
```

### Using Fixtures

```typescript
import {
    VALID_YOUTUBE_URLS,
    MOCK_VIDEO_DATA,
    MOCK_API_RESPONSES,
} from '@tests/fixtures';

// Use predefined test data
const url = VALID_YOUTUBE_URLS.STANDARD;
const video = MOCK_VIDEO_DATA.SHORT_VIDEO;
const response = MOCK_API_RESPONSES.GEMINI_SUCCESS;
```

## Testing Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
   ```typescript
   it('should validate URL', () => {
       // Arrange
       const handler = new URLHandler();
       const url = 'https://youtube.com/watch?v=test';

       // Act
       const result = handler.validateYouTubeUrl(url);

       // Assert
       expect(result).toBe(true);
   });
   ```

2. **Descriptive Test Names**: Test names should describe what is being tested
   ```typescript
   // Good
   it('should return error when API key is invalid', () => {});

   // Bad
   it('test 1', () => {});
   ```

3. **Test One Thing**: Each test should verify a single behavior
   ```typescript
   // Good - separate tests
   it('should validate URL format', () => {});
   it('should extract video ID from URL', () => {});

   // Bad - testing multiple things
   it('should validate URL and extract ID', () => {});
   ```

4. **Use Mocks**: Isolate tests from external dependencies
   ```typescript
   // Mock Obsidian API
   jest.mock('obsidian', () => require('./__mocks__/obsidian'));

   // Mock HTTP requests
   jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse);
   ```

5. **Clean Up**: Reset mocks after each test
   ```typescript
   afterEach(() => {
       jest.clearAllMocks();
       jest.restoreAllMocks();
   });
   ```

## Coverage Goals

Target coverage:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

View coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

## Debugging Tests

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Or use VS Code debugger with this launch config:
{
    "type": "node",
    "request": "launch",
    "name": "Debug Jest Tests",
    "program": "${workspaceFolder}/node_modules/.bin/jest",
    "args": ["--runInBand", "--no-cache"],
    "console": "integratedTerminal",
    "internalConsoleOptions": "neverOpen"
}
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Manual trigger via GitHub Actions

Status badges:
- ![Tests](https://github.com/emeeran/yt-clipper/actions/workflows/test.yml/badge.svg)
- ![Coverage](https://codecov.io/gh/emeeran/yt-clipper/branch/main/graph/badge.svg)
