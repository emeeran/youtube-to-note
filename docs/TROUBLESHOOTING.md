# Troubleshooting Guide

This comprehensive guide helps you diagnose and resolve common issues with the YouTube Clipper plugin. If you encounter problems not covered here, please check the [GitHub Discussions](https://github.com/meeransethi/youtube-clipper/discussions) for community support.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [API Key Problems](#api-key-problems)
- [Video Processing Issues](#video-processing-issues)
- [Performance Problems](#performance-problems)
- [File and Output Issues](#file-and-output-issues)
- [Network and Connectivity](#network-and-connectivity)
- [Plugin Crashes](#plugin-crashes)
- [Security Issues](#security-issues)
- [Debug Mode](#debug-mode)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Step 1: Check Plugin Status

1. **Verify Plugin is Enabled**:
   - Go to `Settings → Community Plugins`
   - Ensure "YouTube Clipper" is enabled (toggle is on)
   - Check for any error messages next to the plugin name

2. **Check Plugin Version**:
   - Look at the plugin version in settings
   - Compare with [latest release](https://github.com/meeransethi/youtube-clipper/releases)

3. **Open Developer Console**:
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
   - Go to Console tab
   - Look for red error messages mentioning "YouTube Clipper"

### Step 2: Test Basic Functionality

1. **Open Command Palette**: `Ctrl/Cmd + P`
2. **Search**: "YouTube Clipper"
3. **Select**: "Process YouTube Video"
4. **Enter**: Any valid YouTube URL
5. **Check**: Does the modal open? Any error messages?

### Step 3: Verify Configuration

1. **Open Settings**: `Settings → YouTube Clipper`
2. **Check API Keys**: Are they entered correctly?
3. **Test Providers**: Use "Test API Connection" buttons
4. **Verify Output Path**: Does the folder exist?

## Installation Issues

### Plugin Not Showing in Community Plugins

**Symptoms**:
- YouTube Clipper not listed in available plugins
- Can't find plugin in Community Plugins browser

**Solutions**:

1. **Check Obsidian Version**:
   - Required: Obsidian v0.15.0 or higher
   - Update Obsidian if needed

2. **Manual Installation**:
   ```bash
   # Download latest release
   wget https://github.com/meeransethi/youtube-clipper/releases/latest/download/youtube-clipper.zip

   # Extract to plugins folder
   unzip youtube-clipper.zip -D ~/.obsidian/plugins/youtube-clipper/
   ```

3. **Check Third-Party Plugins**:
   - Enable `Settings → Community Plugins → Turn on community plugins`
   - Enable `Settings → Community Plugins → Browse third-party plugins`

### Plugin Won't Enable

**Symptoms**:
- Toggle switch doesn't stay on
- Error message when enabling

**Solutions**:

1. **Check File Permissions**:
   ```bash
   # Linux/macOS
   chmod -R 755 ~/.obsidian/plugins/youtube-clipper/

   # Check ownership
   ls -la ~/.obsidian/plugins/youtube-clipper/
   ```

2. **Verify Files**:
   - `manifest.json` exists and is valid JSON
   - `main.js` exists (not `main.ts`)
   - No missing dependencies

3. **Restart Obsidian**:
   - Close completely (not just minimize)
   - Reopen and try enabling again

### Outdated Version

**Symptoms**:
- Features not working as documented
- Compatibility issues with latest Obsidian

**Solutions**:

1. **Check Current Version**:
   - Settings → Community Plugins → YouTube Clipper
   - Note the version number

2. **Download Latest Release**:
   - Visit [GitHub Releases](https://github.com/meeransethi/youtube-clipper/releases)
   - Download the latest version

3. **Update Files**:
   - Backup current settings if needed
   - Replace all plugin files with new version
   - Restart Obsidian

## API Key Problems

### Invalid API Key Error

**Symptoms**:
- "Invalid API key" message
- "Authentication failed" error
- API connection test fails

**Solutions**:

1. **Verify API Key Format**:
   ```bash
   # Gemini: Should start with "AIzaSy"
   AIzaSyYour-Gemini-API-Key-Here

   # Groq: Should start with "gsk_"
   gsk_Your-Groq-API-Key-Here
   ```

2. **Check API Source**:
   - **Gemini**: Get key from https://makersuite.google.com/app/apikey
   - **Groq**: Get key from https://console.groq.com/keys

3. **Validate Key**:
   - Copy key directly from provider dashboard
   - Remove any extra spaces or quotes
   - Don't use "example" keys from documentation

4. **Test with Environment Variables**:
   ```bash
   export YTC_GEMINI_API_KEY="AIzaSyYour-Real-Key"
   # Restart Obsidian
   ```

### API Key Not Saving

**Symptoms**:
- API key disappears after restart
- Settings revert to previous values

**Solutions**:

1. **Check Secure Storage**:
   - Settings → YouTube Clipper → Security
   - Try disabling "Use secure storage" temporarily
   - Save key again

2. **Check File Permissions**:
   ```bash
   # Ensure Obsidian can write to data directory
   ls -la ~/.obsidian/plugins/youtube-clipper/
   ```

3. **Use Environment Variables**:
   - Set API key as environment variable instead
   - More reliable for some systems

### API Quota Exceeded

**Symptoms**:
- "Quota exceeded" messages
- Rate limiting errors
- Sudden stop working

**Solutions**:

1. **Check Usage**:
   - **Gemini**: https://makersuite.google.com/app/apikey
   - **Groq**: https://console.groq.com/keys

2. **Wait and Retry**:
   - Quotas typically reset daily or monthly
   - Try again after quota reset period

3. **Upgrade Plan**:
   - Free tiers have limited quotas
   - Consider upgrading to paid plan

4. **Use Fallback Providers**:
   - Configure multiple AI providers
   - Plugin will try alternatives automatically

## Video Processing Issues

### "Failed to Extract Video ID"

**Symptoms**:
- Can't process YouTube URLs
- "Invalid YouTube URL" error

**Solutions**:

1. **Check URL Format**:
   ```bash
   # Valid formats
   https://www.youtube.com/watch?v=VIDEO_ID
   https://youtu.be/VIDEO_ID
   https://m.youtube.com/watch?v=VIDEO_ID

   # Invalid formats
   youtube.com/watch?v=VIDEO_ID  # Missing protocol
   https://youtube.com/VIDEO_ID   # Wrong format
   ```

2. **Test with Known Video**:
   ```
   https://www.youtube.com/watch?v=dQw4w9WgXcQ
   ```

3. **Check URL Shorteners**:
   - Some URL shorteners may not be supported
   - Expand shortened URLs first

### Video Not Found

**Symptoms**:
- "Video not found" error
- "Private video" message
- "Video unavailable"

**Solutions**:

1. **Verify Video Access**:
   - Open URL in browser
   - Can you watch the video directly?
   - Check if video is private or deleted

2. **Check Region Restrictions**:
   - Some videos are region-locked
   - Try VPN if appropriate for your use case

3. **Age-Restricted Content**:
   - Plugin cannot process age-restricted videos
   - Use public, unlisted videos instead

### Processing Timeout

**Symptoms**:
- Processing stops after 30-60 seconds
- "Request timeout" error

**Solutions**:

1. **Increase Timeout Settings**:
   - Settings → YouTube Clipper → Performance
   - Increase timeout values:
     - Gemini: 30000ms → 60000ms
     - Groq: 25000ms → 45000ms

2. **Use Environment Variables**:
   ```bash
   export YTC_GEMINI_TIMEOUT="60000"
   export YTC_GROQ_TIMEOUT="45000"
   ```

3. **Choose Faster Provider**:
   - Groq is typically faster than Gemini
   - Use for quick text processing

4. **Check Network Connection**:
   - Slow internet may cause timeouts
   - Try processing shorter videos first

### Low Quality Results

**Symptoms**:
- Generated notes are poor quality
- Missing important information
- Irrelevant content

**Solutions**:

1. **Adjust Temperature Setting**:
   - Settings → YouTube Clipper → AI Configuration
   - Lower temperature (0.3-0.5) for more factual responses
   - Higher temperature (0.8-1.0) for more creative responses

2. **Choose Appropriate Format**:
   - **Executive Summary**: ≤250 words, key insights only
   - **Tutorial**: Detailed step-by-step instructions
   - **Brief**: Quick overview with main points

3. **Use Custom Prompts**:
   - Create specific prompts for your use case
   - Example: "Focus on technical implementation details"

4. **Try Different Provider**:
   - Gemini often provides better multimodal analysis
   - Groq may be better for text-specific content

## Performance Problems

### Slow Processing

**Symptoms**:
- Processing takes several minutes
- Plugin becomes unresponsive
- High CPU/memory usage

**Solutions**:

1. **Enable Performance Mode**:
   - Settings → YouTube Clipper → Performance
   - Set "Performance Mode" to "Fast"
   - Enable "Parallel Processing"

2. **Reduce Batch Size**:
   - Lower "Batch Size" from 3 to 1-2
   - Processes fewer videos simultaneously

3. **Clear Cache**:
   - Settings → YouTube Clipper → Cache
   - Click "Clear Cache"
   - Restarts with fresh cache

4. **Check System Resources**:
   - Close other applications
   - Ensure adequate RAM (8GB+ recommended)
   - Check CPU usage during processing

### Memory Leaks

**Symptoms**:
- Obsidian memory usage grows continuously
- Plugin becomes slower over time
- System becomes unresponsive

**Solutions**:

1. **Restart Obsidian**:
   - Close completely (not just minimize)
   - Reopen to clear memory

2. **Reduce Cache Size**:
   - Settings → YouTube Clipper → Cache
   - Lower "Cache Size" from 100 to 50

3. **Disable Parallel Processing**:
   - Settings → YouTube Clipper → Performance
   - Turn off "Enable Parallel Processing"

4. **Update Plugin**:
   - Memory leaks are often fixed in updates
   - Check for newer version

## File and Output Issues

### File Creation Failed

**Symptoms**:
- "Failed to create note" error
- No output file generated
- File permissions error

**Solutions**:

1. **Check Output Path**:
   - Settings → YouTube Clipper → Output
   - Verify path exists and is accessible
   - Use absolute paths for reliability

2. **Check File Permissions**:
   ```bash
   # Check directory permissions
   ls -la /path/to/output/directory/

   # Fix permissions if needed
   chmod 755 /path/to/output/directory/
   ```

3. **Test Simple Path**:
   - Set output to vault root temporarily
   - Test if basic file creation works

4. **Check Disk Space**:
   - Ensure adequate disk space
   - Clear unnecessary files if needed

### Invalid File Names

**Symptoms**:
- Files not created due to invalid characters
- Special characters in video titles cause issues

**Solutions**:

1. **Use Template Variables**:
   - Settings → YouTube Clipper → Output
   - Use safe variables like `{{videoId}}` and `{{date}}`
   - Avoid `{{title}}` if it contains special characters

2. **Custom Sanitization**:
   - Plugin automatically sanitizes filenames
   - Replace spaces with underscores
   - Remove special characters

3. **Test with Simple Titles**:
   - Process videos with simple titles first
   - Verify file creation works

### YAML Frontmatter Issues

**Symptoms**:
- Generated files have invalid YAML
- Obsidian shows YAML parsing errors
- File appears as plain text

**Solutions**:

1. **Check Template**:
   - Settings → YouTube Clipper → Output
   - Verify YAML template is valid
   - Ensure proper indentation (2 spaces)

2. **Test Default Template**:
   - Reset to default template
   - Test with basic format first

3. **Check for Special Characters**:
   - Video titles may contain quotes
   - Ensure proper escaping in YAML

## Network and Connectivity

### CORS Errors

**Symptoms**:
- "CORS policy" error in console
- YouTube API requests blocked
- Network-related errors

**Solutions**:

1. **Use CORS Proxy**:
   - Settings → YouTube Clipper → Network
   - Set CORS proxy URL
   - Example: `https://cors-anywhere.herokuapp.com`

2. **Environment Variable**:
   ```bash
   export YTC_CORS_PROXY="https://cors-anywhere.herokuapp.com"
   ```

3. **Self-Hosted Proxy**:
   - Deploy your own CORS proxy
   - More reliable than public proxies

### Firewall Issues

**Symptoms**:
- Can't reach AI provider APIs
- Connection timeout errors
- "Network unreachable" messages

**Solutions**:

1. **Check Firewall Rules**:
   - Allow connections to:
     - `generativelanguage.googleapis.com` (Gemini)
     - `api.groq.com` (Groq)
     - `youtube.com` (metadata)

2. **Corporate Network**:
   - Contact IT department
   - Request whitelist for API domains
   - Use VPN if necessary

3. **Test Connectivity**:
   ```bash
   # Test API endpoints
   curl -I https://generativelanguage.googleapis.com
   curl -I https://api.groq.com
   ```

### Proxy Server Issues

**Symptoms**:
- Requests failing through proxy
- Authentication errors
- SSL/TLS issues

**Solutions**:

1. **Configure Proxy Settings**:
   - Use system proxy settings
   - Or configure proxy in plugin settings

2. **Test Direct Connection**:
   - Temporarily bypass proxy
   - Test if plugin works without proxy

3. **SSL Certificate Issues**:
   - Update system certificates
   - Or disable SSL verification (not recommended)

## Plugin Crashes

### Obsidian Crashes When Using Plugin

**Symptoms**:
- Obsidian becomes unresponsive
- Application crashes or freezes
- Need to force quit

**Solutions**:

1. **Disable Plugin Temporarily**:
   - Close Obsidian
   - Edit `data.json` in vault's `.obsidian` folder
   - Remove YouTube Clipper from enabled plugins list
   - Restart Obsidian

2. **Check Plugin Files**:
   ```bash
   # Verify file integrity
   md5sum ~/.obsidian/plugins/youtube-clipper/main.js
   # Compare with expected hash from release
   ```

3. **Reinstall Plugin**:
   - Delete plugin folder completely
   - Download fresh copy from GitHub releases
   - Reinstall from scratch

### Plugin Settings Corrupted

**Symptoms**:
- Settings won't open
- Strange values in configuration
- Plugin won't load

**Solutions**:

1. **Reset to Defaults**:
   - Settings → YouTube Clipper → Reset
   - Click "Reset All Settings"
   - Reconfigure from scratch

2. **Manual Reset**:
   ```bash
   # Remove plugin data (CAUTION: This loses all settings)
   rm -rf ~/.obsidian/plugins/youtube-clipper/data.json
   ```

3. **Export/Import Settings**:
   - Export current settings before reset
   - Import working settings after reset

## Security Issues

### API Key Exposure

**Symptoms**:
- API keys visible in logs
- Keys stored in plain text
- Security warnings

**Solutions**:

1. **Enable Secure Storage**:
   - Settings → YouTube Clipper → Security
   - Enable "Use secure storage"
   - Set master password

2. **Use Environment Variables**:
   - Move API keys to environment variables
   - Remove keys from plugin settings
   - More secure for team environments

3. **Check Logs**:
   - Ensure no API keys in console logs
   - Enable debug mode to verify sanitization

### Suspicious Activity

**Symptoms**:
- Unusual API usage
- Unexpected charges
- Requests from unknown sources

**Solutions**:

1. **Review API Usage**:
   - Check provider dashboards
   - Review request history
   - Look for unusual patterns

2. **Rotate API Keys**:
   - Generate new API keys
   - Update plugin configuration
   - Revoke old keys

3. **Enable Logging**:
   - Settings → YouTube Clipper → Security
   - Enable detailed logging
   - Monitor for unauthorized access

## Debug Mode

### Enabling Debug Mode

1. **Settings Method**:
   - Settings → YouTube Clipper → Advanced
   - Enable "Debug Mode"

2. **Environment Variable**:
   ```bash
   export YTC_DEBUG_MODE="true"
   ```

3. **Temporary Enable**:
   - Open Developer Console (F12)
   - Run: `localStorage.setItem('ytc-debug', 'true')`
   - Reload Obsidian

### Debug Information Available

- **API Request Details**: Full request/response logging
- **Processing Steps**: Each stage of video processing
- **Performance Metrics**: Timing and resource usage
- **Error Traces**: Detailed error information
- **Configuration State**: Current settings and values

### Collecting Debug Information

1. **Enable Debug Mode**
2. **Reproduce the Issue**
3. **Open Developer Console**
4. **Copy Console Output**
5. **Save to file for support**

**Example Debug Output**:
```
[YouTube Clipper] DEBUG: Processing video: dQw4w9WgXcQ
[YouTube Clipper] DEBUG: Extracted metadata: {"title":"Never Gonna Give You Up",...}
[YouTube Clipper] DEBUG: Using provider: gemini
[YouTube Clipper] DEBUG: API Request: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent
[YouTube Clipper] DEBUG: Processing time: 12.345s
```

## Getting Help

### Self-Help Resources

1. **Documentation**:
   - [README](README.md) - General usage and setup
   - [API Reference](API.md) - Technical documentation
   - [Environment Variables](ENVIRONMENT.md) - Configuration options

2. **Community Support**:
   - [GitHub Discussions](https://github.com/meeransethi/youtube-clipper/discussions)
   - [GitHub Issues](https://github.com/meeransethi/youtube-clipper/issues)

3. **FAQ Section**:
   - Check below for frequently asked questions

### Reporting Issues

When reporting issues, include:

1. **Basic Information**:
   - Plugin version
   - Obsidian version
   - Operating system

2. **Error Details**:
   - Exact error message
   - Steps to reproduce
   - Expected vs actual behavior

3. **Debug Information**:
   - Console output (if available)
   - Configuration details
   - Network environment

4. **Privacy Considerations**:
   - Remove API keys from reports
   - Sanitize personal information
   - Use generic video URLs for examples

### Issue Template

```markdown
## Issue Description
Brief description of the problem

## Steps to Reproduce
1. Open YouTube Clipper
2. Enter URL: ...
3. Click process
4. Error occurs

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Plugin Version: 1.3.5
- Obsidian Version: 1.4.0
- OS: Windows 11 / macOS 13.0 / Ubuntu 22.04

## Error Messages
```
Paste exact error message here
```

## Additional Context
Any other relevant information
```

## Frequently Asked Questions

### Q: Why won't the plugin process age-restricted videos?
**A**: Age-restricted videos require authentication and age verification, which the plugin cannot perform. Use public, unlisted videos instead.

### Q: Can I use the plugin without API keys?
**A**: Yes, enable debug mode and set `YTC_MOCK_API=true` to test functionality without real API keys.

### Q: How do I migrate from plugin settings to environment variables?
**A**: See the [Environment Variables Guide](ENVIRONMENT.md#migration-guide) for step-by-step instructions.

### Q: Why are my generated notes poor quality?
**A**: Try adjusting the temperature setting (0.3-0.5 for factual, 0.8-1.0 for creative), or use custom prompts for your specific needs.

### Q: Can I use the plugin offline?
**A**: No, the plugin requires internet access for AI processing and YouTube metadata extraction.

### Q: How do I backup my plugin settings?
**A**: Settings → YouTube Clipper → Export Settings to save your configuration as JSON.

### Q: Why does processing take so long?
**A**: Processing time depends on video length, AI provider response time, and network speed. Try using Groq for faster processing.

### Q: Can I process multiple videos at once?
**A**: Yes, enable parallel processing in performance settings to process multiple videos simultaneously.

### Q: Is my data secure?
**A**: Yes, the plugin uses encrypted storage for API keys and sanitizes all logging data. See [Security Documentation](ENVIRONMENT.md#security-considerations) for details.

### Q: How do I update the plugin?
**A**: Download the latest release from GitHub and replace the plugin files, or use the Obsidian community plugins browser if available.

### Q: Can I contribute to the plugin?
**A**: Yes! See the [Contributing Guide](CONTRIBUTING.md) for development setup and contribution guidelines.

---

This troubleshooting guide should help resolve most common issues with the YouTube Clipper plugin. For additional support, check the GitHub discussions or create a new issue with the information requested above.