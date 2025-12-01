# Setup & Deployment Guide

This guide consolidates every environment required to run YouTubeClipper end-to-end—from the Obsidian plugin through the Chrome extension, helper server, and automation pipelines. Use it as the canonical checklist before shipping new builds or onboarding contributors.

## 1. Obsidian Plugin Setup

**Prerequisites**
- Obsidian 0.15.0+ with Safe Mode disabled.
- Node.js 18+, npm 8+, git.

**Development installation**
1. `git clone https://github.com/emeeran/yt-clipper.git && cd yt-clipper`
2. `npm install`
3. `npm run dev` (esbuild + watch)
4. In Obsidian: *Settings → Community Plugins → Install from disk → Select repo folder*
5. Toggle "YouTube Processor" on, then open *Settings → Plugin Options* to enter API keys.

**Production installation**
1. Run `npm run build` to emit `main.js`, `manifest.json`, `styles.css`.
2. Copy the `yt-clipper/` folder (or zipped release) into `<vault>/.obsidian/plugins/`.
3. Restart Obsidian and enable the plugin.

Cross-reference: `README.md` (quick start), `docs/ARCHITECTURE.md` (internals).

## 2. API Key Management & Security

- Primary providers: Google Gemini (multimodal) and Groq (text-first). Optional: Ollama local models.
- Keys are stored locally in `data.json` and encrypted via AES-GCM (see `src/services/encryption-service.ts`).
- Never commit `data.json`; `.gitignore` and `SECURITY.md` enumerate covered patterns.
- Acquisition & rotation steps live in `docs/API_SETUP.md`; follow provider-specific quota notes there.
- For high-assurance environments, pair plugin storage with OS-level secrets vaults as suggested in `SECURITY.md`.

## 3. Chrome Extension Setup (Optional Companion)

Located under `extension/chrome-extension/`.

1. Run `npm install` if the extension has its own package file.
2. Build (or `npm run dev` if watch mode is provided).
3. Visit `chrome://extensions`, enable Developer Mode, click **Load unpacked**, and select `extension/chrome-extension/dist`.
4. Configure the extension options page with:
   - **Obsidian URI target** (usually `obsidian://yt-clipper?url=<video>`)
   - Optional helper server endpoint (see Section 4)
5. Confirm the injected "Clip" button appears on YouTube; clicking it should hand off the URL to Obsidian or the helper server.

See `extension/chrome-extension/README.md` for screenshots and advanced configuration.

## 4. Helper Server & Bridge (Optional)

Some users deploy a lightweight HTTP bridge so browsers without `obsidian://` support can still call the plugin.

- Reference implementation: `extension/helper-server/` (if present) or `scripts/content_script.js` + `scripts/cli.sh`.
- Typical deployment:
  1. `cd extension/helper-server && npm install`
  2. Configure `.env` with `PORT`, `OBSIDIAN_URI`, and allowed origins.
  3. `npm run start` (or use PM2/systemd for production).
  4. Point the Chrome extension to `https://<server>/clip?url=<video>`.
- Ensure TLS termination and API key secrecy per `SECURITY.md`.

## 5. Automation & Tooling Surface

| Tool | Location | Purpose |
| --- | --- | --- |
| Agent Chain Runner | `src/agent-chain-runner.js`, `config/agent-chain-config.json` | Drives multi-step refactors/tests using LLM agents. |
| Performance Optimizer | `scripts/optimizer.sh` | Bundles lint, type-check, tests, and size analysis. |
| CLI Helper | `scripts/cli.sh` | Runs codemods, sync tasks, and release chores. |
| Content Script | `scripts/content_script.js` | Bridges browser context to helper endpoints. |

Automation steps:
1. Run `npm run lint && npm run type-check` before invoking agents—many scripts assume a clean tree.
2. `node src/agent-chain-runner.js --config config/agent-chain-config.json` to execute automated improvement flows referenced in `docs/README-agent-chain.md`.
3. Capture metrics using `src/performance-monitor.ts`; export via scripts if needed.

## 6. Release Checklist (Cross-Surface)

| Stage | Plugin | Extension | Helper/Automation |
| --- | --- | --- | --- |
| Version bump | Update `manifest.json`, `package.json`, `versions.json` | Update `manifest.json` or `package.json` inside `extension/` | Document API changes in helper configs |
| Build | `npm run build` | Respective `npm run build` | `npm run build` or container build |
| QA | Manual smoke + tests in `tests/` | Browser testing (Chrome, Edge) | e2e call from extension → helper → Obsidian |
| Documentation | Touch `CHANGELOG.md`, `docs/OPERATIONS.md`, `README.md` | Update extension README | Update helper README + ops notes |
| Distribution | Zip `main.js` bundle for Obsidian release | Publish to Chrome Web Store (follow `DEPLOYMENT_SUMMARY.md`) | Deploy helper to hosting + rotate secrets |

Use `docs/DEPLOYMENT_SUMMARY.md` for the detailed Obsidian release process and `docs/PRODUCTION-READY.md` for baseline readiness criteria.
