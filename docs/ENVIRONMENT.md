# Environment Variables Configuration

This document describes all environment variables that can be used to configure the YouTube Clipper plugin. Environment variables provide a secure way to manage API keys and configuration without storing them in plain text.

## Overview

Environment variables are optional but recommended for:
- Enhanced security (API keys not stored in plugin settings)
- Team deployments and CI/CD pipelines
- Docker containerization
- Development environments

## Variable Prefix

All YouTube Clipper environment variables use the `YTC_` prefix by default to avoid conflicts with other applications.

### Custom Prefix

You can customize the prefix by setting `YTC_CUSTOM_PREFIX`:

```bash
export YTC_CUSTOM_PREFIX="MY_APP_"
# Variables would then be MY_APP_GEMINI_API_KEY, etc.
```

## Core Configuration

### YTC_GEMINI_API_KEY

**Description**: Google Gemini API key for multimodal video analysis

**Format**: String starting with "AIzaSy"

**Example**:
```bash
export YTC_GEMINI_API_KEY="AIzaSyYour-Gemini-API-Key-Here"
```

**Required**: Optional (if plugin settings contain key)

**Notes**:
- Get your key from: https://makersuite.google.com/app/apikey
- Supports multiple project keys (comma-separated for fallback)
- Supports the following models: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash

### YTC_GROQ_API_KEY

**Description**: Groq API key for high-speed text-only inference

**Format**: String starting with "gsk_"

**Example**:
```bash
export YTC_GROQ_API_KEY="gsk_Your-Groq-API-Key-Here"
```

**Required**: Optional (if plugin settings contain key)

**Notes**:
- Get your key from: https://console.groq.com/keys
- Ideal for quick text processing and fallback scenarios
- Supports Groq-specific models like llama-3.1-70b-versatile

### YTC_OLLAMA_API_KEY

**Description**: API key for local Ollama instance (if authentication is enabled)

**Format**: String (format depends on Ollama configuration)

**Example**:
```bash
export YTC_OLLAMA_API_KEY="Your-Ollama-API-Key"
```

**Required**: Optional (only if Ollama requires authentication)

**Notes**:
- Usually not required for local Ollama instances
- Required when using remote Ollama with authentication

## Provider Configuration

### YTC_DEFAULT_PROVIDER

**Description**: Default AI provider to use for video processing

**Format**: String

**Valid Values**:
- `"gemini"` (recommended for multimodal analysis)
- `"groq"` (fast text-only processing)
- `"ollama"` (local processing)
- `"auto"` (automatic selection based on availability)

**Example**:
```bash
export YTC_DEFAULT_PROVIDER="gemini"
```

**Required**: Optional (defaults to "auto")

**Priority**: Environment variables override plugin settings

### YTC_GEMINI_MODEL

**Description**: Default Gemini model to use for processing

**Format**: String

**Valid Values**:
- `"gemini-2.0-flash-exp"` (latest, experimental)
- `"gemini-1.5-pro"` (stable, high quality)
- `"gemini-1.5-flash"` (fast, lower cost)

**Example**:
```bash
export YTC_GEMINI_MODEL="gemini-2.0-flash-exp"
```

**Required**: Optional (uses plugin default if not set)

### YTC_GROQ_MODEL

**Description**: Default Groq model to use for processing

**Format**: String

**Valid Values**:
- `"llama-3.1-70b-versatile"`
- `"mixtral-8x7b-32768"`
- `"gemma2-9b-it"`

**Example**:
```bash
export YTC_GROQ_MODEL="llama-3.1-70b-versatile"
```

**Required**: Optional (uses plugin default if not set)

### YTC_OLLAMA_MODEL

**Description**: Default Ollama model to use for processing

**Format**: String

**Valid Values**: Any model available in your Ollama instance

**Example**:
```bash
export YTC_OLLAMA_MODEL="llama3.2"
```

**Required**: Optional (uses plugin default if not set)

## Connection Settings

### YTC_OLLAMA_ENDPOINT

**Description**: Ollama server endpoint URL

**Format**: Valid URL

**Example**:
```bash
export YTC_OLLAMA_ENDPOINT="http://localhost:11434"
# Or for remote Ollama:
export YTC_OLLAMA_ENDPOINT="https://ollama.example.com"
```

**Required**: Optional (defaults to http://localhost:11434)

### YTC_CORS_PROXY

**Description**: CORS proxy URL for YouTube API requests (if needed)

**Format**: Valid URL

**Example**:
```bash
export YTC_CORS_PROXY="https://cors-anywhere.herokuapp.com"
# Or self-hosted proxy:
export YTC_CORS_PROXY="https://proxy.your-domain.com"
```

**Required**: Optional

**Use Cases**:
- Bypassing CORS restrictions in browser environments
- Corporate networks blocking YouTube API
- Development environments with CORS issues

## Performance Settings

### YTC_MAX_TOKENS

**Description**: Default maximum tokens for AI responses

**Format**: Integer (100-32000)

**Example**:
```bash
export YTC_MAX_TOKENS="8000"
```

**Required**: Optional (defaults to 8000)

**Notes**:
- Higher values allow longer responses but cost more
- Executive Summary: 250-500 tokens recommended
- Detailed Tutorial: 4000-8000 tokens recommended
- Brief: 100-200 tokens recommended

### YTC_TEMPERATURE

**Description**: Default creativity/temperature setting for AI responses

**Format**: Float (0.0-2.0)

**Example**:
```bash
export YTC_TEMPERATURE="0.7"
```

**Required**: Optional (defaults to 0.7)

**Values**:
- `0.0`: Very deterministic, factual responses
- `0.7`: Balanced creativity and factuality (recommended)
- `1.5+`: Highly creative, less factual

### YTC_ENABLE_PARALLEL

**Description**: Enable parallel processing for multiple videos

**Format**: Boolean ("true" or "false")

**Example**:
```bash
export YTC_ENABLE_PARALLEL="true"
```

**Required**: Optional (defaults to "true")

### YTC_BATCH_SIZE

**Description**: Number of videos to process in parallel

**Format**: Integer (1-10)

**Example**:
```bash
export YTC_BATCH_SIZE="3"
```

**Required**: Optional (defaults to 3)

**Notes**:
- Higher values use more memory and API quota
- Recommended: 2-5 for most systems

## Output Configuration

### YTC_OUTPUT_PATH

**Description**: Default output directory for generated notes

**Format**: File path

**Example**:
```bash
export YTC_OUTPUT_PATH="/path/to/notes/youtube-clips"
# Or relative path:
export YTC_OUTPUT_PATH="./youtube-clips"
# Obsidian-specific:
export YTC_OUTPUT_PATH="YouTube Clips/"
```

**Required**: Optional (uses plugin default if not set)

**Template Variables**:
- `{{date}}` - Current date (YYYY-MM-DD)
- `{{year}}` - Current year
- `{{month}}` - Current month
- `{{day}}` - Current day
- `{{format}}` - Output format name

**Example with Templates**:
```bash
export YTC_OUTPUT_PATH="YouTube Clips/{{year}}/{{month}}/"
```

### YTC_DEFAULT_FORMAT

**Description**: Default output format for video analysis

**Format**: String

**Valid Values**:
- `"executive-summary"`
- `"tutorial"`
- `"brief"`
- `"custom"`

**Example**:
```bash
export YTC_DEFAULT_FORMAT="executive-summary"
```

**Required**: Optional (uses plugin default if not set)

## Security Settings

### YTC_ENABLE_SECURE_STORAGE

**Description**: Enable encrypted storage for plugin settings

**Format**: Boolean ("true" or "false")

**Example**:
```bash
export YTC_ENABLE_SECURE_STORAGE="true"
```

**Required**: Optional (defaults to "true")

### YTC_MASTER_PASSWORD

**Description**: Master password for encrypted storage (NOT RECOMMENDED)

**Format**: String

**Example**:
```bash
export YTC_MASTER_PASSWORD="your-secure-password"
```

**Required**: Optional

⚠️ **SECURITY WARNING**: Storing master password in environment variables is less secure than using the plugin's built-in password prompt. Only use this in automated environments where interactive input is not possible.

### YTC_LOG_LEVEL

**Description**: Logging level for debugging and monitoring

**Format**: String

**Valid Values**:
- `"debug"` - Detailed debugging information
- `"info"` - General information (recommended)
- `"warn"` - Warnings only
- `"error"` - Errors only

**Example**:
```bash
export YTC_LOG_LEVEL="info"
```

**Required**: Optional (defaults to "info")

## Timeout Settings

### YTC_GEMINI_TIMEOUT

**Description**: Request timeout for Gemini API in milliseconds

**Format**: Integer (5000-300000)

**Example**:
```bash
export YTC_GEMINI_TIMEOUT="45000"
```

**Required**: Optional (defaults to 30000)

### YTC_GROQ_TIMEOUT

**Description**: Request timeout for Groq API in milliseconds

**Format**: Integer (5000-300000)

**Example**:
```bash
export YTC_GROQ_TIMEOUT="25000"
```

**Required**: Optional (defaults to 25000)

### YTC_OLLAMA_TIMEOUT

**Description**: Request timeout for Ollama API in milliseconds

**Format**: Integer (5000-300000)

**Example**:
```bash
export YTC_OLLAMA_TIMEOUT="60000"
```

**Required**: Optional (defaults to 60000)

### YTC_METADATA_TIMEOUT

**Description**: Request timeout for YouTube metadata extraction

**Format**: Integer (5000-60000)

**Example**:
```bash
export YTC_METADATA_TIMEOUT="15000"
```

**Required**: Optional (defaults to 10000)

## Cache Settings

### YTC_CACHE_SIZE

**Description**: Maximum number of items to cache

**Format**: Integer (10-1000)

**Example**:
```bash
export YTC_CACHE_SIZE="200"
```

**Required**: Optional (defaults to 100)

### YTC_CACHE_TTL

**Description**: Cache time-to-live in seconds

**Format**: Integer (300-86400)

**Example**:
```bash
export YTC_CACHE_TTL="3600"  # 1 hour
```

**Required**: Optional (defaults to 1800)

## Development Settings

### YTC_DEBUG_MODE

**Description**: Enable debug mode for development

**Format**: Boolean ("true" or "false")

**Example**:
```bash
export YTC_DEBUG_MODE="true"
```

**Required**: Optional (defaults to "false")

**Effects**:
- Enables detailed logging
- Disables some optimizations for easier debugging
- Shows additional error information

### YTC_MOCK_API

**Description**: Use mock API responses for testing

**Format**: Boolean ("true" or "false")

**Example**:
```bash
export YTC_MOCK_API="true"
```

**Required**: Optional (defaults to "false")

**Use Cases**:
- Development without API keys
- Testing plugin functionality
- Demo environments

## Configuration Examples

### Basic Setup (Minimum)

```bash
# Set your primary API key
export YTC_GEMINI_API_KEY="AIzaSyYour-Gemini-API-Key"

# Set default output location
export YTC_OUTPUT_PATH="YouTube Clips/"
```

### Production Setup (Comprehensive)

```bash
# API Keys
export YTC_GEMINI_API_KEY="AIzaSyYour-Gemini-API-Key"
export YTC_GROQ_API_KEY="gsk_Your-Groq-API-Key"

# Provider Configuration
export YTC_DEFAULT_PROVIDER="gemini"
export YTC_GEMINI_MODEL="gemini-1.5-pro"

# Performance Settings
export YTC_ENABLE_PARALLEL="true"
export YTC_BATCH_SIZE="3"
export YTC_MAX_TOKENS="8000"
export YTC_TEMPERATURE="0.7"

# Output Configuration
export YTC_OUTPUT_PATH="YouTube Clips/{{year}}/{{month}}/"
export YTC_DEFAULT_FORMAT="executive-summary"

# Security
export YTC_ENABLE_SECURE_STORAGE="true"
export YTC_LOG_LEVEL="warn"

# Timeouts
export YTC_GEMINI_TIMEOUT="45000"
export YTC_GROQ_TIMEOUT="25000"
export YTC_METADATA_TIMEOUT="15000"
```

### Development Setup

```bash
# Use mock API for testing
export YTC_MOCK_API="true"
export YTC_DEBUG_MODE="true"

# Development logging
export YTC_LOG_LEVEL="debug"

# Local development paths
export YTC_OUTPUT_PATH="./test-output/"

# Faster timeouts for development
export YTC_GEMINI_TIMEOUT="10000"
export YTC_GROQ_TIMEOUT="5000"
```

### Docker/Container Setup

```bash
# API Keys (passed to container)
export YTC_GEMINI_API_KEY="AIzaSyYour-Gemini-API-Key"
export YTC_GROQ_API_KEY="gsk_Your-Groq-API-Key"

# Container-specific settings
export YTC_OUTPUT_PATH="/app/output/youtube-clips"
export YTC_ENABLE_SECURE_STORAGE="false"  # Use env vars only
export YTC_LOG_LEVEL="info"

# Performance tuned for containers
export YTC_BATCH_SIZE="2"  # Lower for containers
export YTC_CACHE_SIZE="50"  # Lower memory usage
```

## Loading Environment Variables

### Method 1: Shell Profile

Add to your `~/.bashrc`, `~/.zshrc`, or shell profile:

```bash
# YouTube Clipper Configuration
export YTC_GEMINI_API_KEY="AIzaSyYour-API-Key"
export YTC_OUTPUT_PATH="YouTube Clips/"
```

### Method 2: .env File

Create a `.env` file in your plugin directory:

```bash
# .env file
YTC_GEMINI_API_KEY=AIzaSyYour-API-Key
YTC_GROQ_API_KEY=gsk_Your-Groq-API-Key
YTC_OUTPUT_PATH=YouTube Clips/
YTC_DEFAULT_PROVIDER=gemini
```

⚠️ **Security**: Add `.env` to your `.gitignore` file to avoid committing secrets.

### Method 3: System Environment

Set at system level:

```bash
# Linux/macOS
sudo nano /etc/environment
# Add: YTC_GEMINI_API_KEY="AIzaSyYour-API-Key"

# Windows
setx YTC_GEMINI_API_KEY "AIzaSyYour-API-Key"
```

### Method 4: Runtime

Set before running Obsidian:

```bash
# Linux/macOS
YTC_GEMINI_API_KEY="AIzaSyYour-API-Key" obsidian

# Windows
set YTC_GEMINI_API_KEY=AIzaSyYour-API-Key && obsidian.exe
```

## Priority Order

The plugin loads configuration in this priority order (highest to lowest):

1. **Environment Variables** (highest priority)
2. **Plugin Settings** (configured in UI)
3. **Default Values** (built-in defaults)

This means environment variables will always override plugin settings if both are present.

## Validation

The plugin validates environment variables on startup:

- **API Keys**: Checked for valid format
- **URLs**: Validated for proper format
- **Numbers**: Checked for valid ranges
- **Booleans**: Parsed as true/false
- **Paths**: Validated if accessible

Invalid environment variables are logged as warnings and ignored.

## Security Considerations

### Best Practices

1. **Never commit API keys** to version control
2. **Use read-only API keys** when possible
3. **Rotate keys regularly** using environment variable updates
4. **Limit key permissions** to only required scopes
5. **Monitor usage** through provider dashboards

### Key Rotation

To rotate API keys:

```bash
# Set new key
export YTC_GEMINI_API_KEY="AIzaSyNew-API-Key"

# Restart Obsidian to load new key
```

### Team Environments

For team deployments:

1. Use **secret management systems** (HashiCorp Vault, AWS Secrets Manager)
2. Inject secrets at **runtime** rather than build time
3. Use **different keys** per environment (dev/staging/prod)
4. **Audit key usage** regularly

## Troubleshooting

### Environment Variables Not Loading

1. **Check variable names** - ensure `YTC_` prefix
2. **Verify syntax** - no spaces around `=` in shell
3. **Restart application** - Obsidian needs restart to load changes
4. **Check logs** - enable debug logging to see loading status

### API Key Issues

1. **Validate key format** - check provider-specific formats
2. **Check key permissions** - ensure required scopes are enabled
3. **Verify quota** - check usage limits on provider dashboard
4. **Test connectivity** - ensure network access to provider APIs

### Path Issues

1. **Use absolute paths** for reliable configuration
2. **Check permissions** - ensure Obsidian can write to output path
3. **Create directories** - plugin doesn't auto-create parent directories
4. **Escape special characters** in paths with spaces or symbols

## Monitoring

### Environment Variable Status

Check which environment variables are loaded:

1. Open Developer Console (F12)
2. Look for "Environment Variables Loaded" log entry
3. Debug mode shows all loaded variables

### API Key Validation

The plugin validates API keys on startup:

```javascript
// Console output example
"[YouTube Clipper] Environment Variables Loaded: 8 variables"
"[YouTube Clipper] API Key Validation: gemini=valid, groq=missing"
```

## Migration Guide

### From Plugin Settings to Environment Variables

1. **Export current settings** from plugin UI
2. **Create .env file** with equivalent environment variables
3. **Test configuration** with debug mode enabled
4. **Remove API keys** from plugin settings for security
5. **Restart Obsidian** to apply changes

### Multiple Environments

Use different environment files:

```bash
# .env.development
YTC_MOCK_API=true
YTC_DEBUG_MODE=true

# .env.production
YTC_GEMINI_API_KEY=prod-api-key
YTC_LOG_LEVEL=warn
```

Load with:

```bash
# Development
export NODE_ENV=development

# Production
export NODE_ENV=production
```

This documentation covers all environment variables available for configuring the YouTube Clipper plugin. Use environment variables for enhanced security, team deployments, and automated workflows.