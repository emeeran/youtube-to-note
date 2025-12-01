# Operations, Performance & Quality

This guide centralizes day-two operations: monitoring, performance tuning, regression testing, and release validation for YouTubeClipper.

## 1. Observability & Monitoring

### Structured Logging
- Use `src/services/logger.ts` and avoid raw `console.log` calls.
- Log levels: `debug`, `info`, `warn`, `error`; default threshold is configurable via `ServiceContainer` settings.
- Include `component` and `context` metadata objects to simplify triage.
- When running inside Obsidian, logs surface in the developer console (`Ctrl+Shift+I`).

### Performance Metrics
- Wrap long operations with `performanceMonitor.measureOperation(name, fn)` (`src/services/performance-monitor.ts`).
- Recommended timers: `video-metadata-fetch`, `prompt-generation`, `ai-provider-call`, `file-write`, `conflict-resolution`.
- Configure SLA thresholds in `DEFAULT_THRESHOLDS`; exceeding thresholds triggers `logger.warn`—pipe these into your telemetry tooling if embedding the plugin in managed builds.

### Health Checks
- AI Providers: call `aiService.verifyProvider(providerId)` during startup when running in managed deployments.
- CORS Proxy / Helper Server: expose `/healthz` returning upstream reachability; referenced by Chrome extension deployments.

## 2. Performance Tuning

| Lever | Location | Notes |
| --- | --- | --- |
| Provider selection | `src/services/ai-service.ts` | Use `performanceMode` (`speed`, `balanced`, `quality`). Consider disabling “provider racing” if cost sensitive. |
| Prompt size presets | `src/services/prompt-service.ts` | Toggle compact templates (`IMPROVEMENTS-SUMMARY.md`) to reduce tokens. |
| Cache | `src/advanced-cache.ts` | Enables metadata + transcript memoization between runs. |
| Network retries | `src/services/retry-service.ts` | Tune backoff + jitter to balance speed vs. resilience. |
| UI feedback | `src/confirmation-modal.ts`, `src/messages.ts` | Surface progress markers for long calls to prevent duplicate submissions. |

Performance workflow:
1. Enable verbose logging plus Performance Monitor timers.
2. Capture baseline metrics for representative clips.
3. Adjust provider/parsing settings; rerun and compare deltas.
4. Document findings under `IMPROVEMENTS-SUMMARY.md` or release notes.

## 3. Testing & Quality Gates

### Automated Tests
- Runner: `npm test` (Jest, see `jest.config.js`).
- Directory layout: `tests/unit`, `tests/integration`, `tests/fixtures` (ensure new suites follow this convention).
- Target coverage: ≥80% for services handling AI orchestration, encryption, URL validation, and conflict resolution.
- Use dependency injection to mock AI providers and Obsidian APIs.

### Static Analysis
- `npm run lint` (ESLint) and `npm run lint:fix` for autofixes.
- `npm run type-check` (tsc --noEmit) to enforce strict typings.
- Security scanners: Semgrep (`config/semgrep.yaml`), Trivy (`config/trivy.yaml`), Lizard (`config/lizard.yaml`), Revive (`config/revive.toml`).

### Manual QA
- Obsidian smoke: run through executive + tutorial flows, confirming metadata, frontmatter, and file creation.
- Error cases: invalid URL, missing API key, provider outage, duplicate file conflict (exercise `file-confirm-modal.ts`).
- Chrome extension: ensure the injected "Clip" button hands off to Obsidian/ helper server.
- Record findings in `FINAL_PLUGIN_STATUS.md` before each tagged release.

## 4. Security & Compliance Operations

- Follow `SECURITY.md` for API key storage, `.gitignore` enforcement, and incident response.
- Rotate provider keys quarterly; document rotation in `docs/CHANGELOG.md` when applicable.
- Run `npm audit` post-upgrade and capture summaries in `docs/PRODUCTION-READY.md` or the release PR.
- For organizations, integrate with Codacy/Codacy CLI using configs under `config/`.

## 5. Troubleshooting & Incident Response

- Start with `docs/TROUBLESHOOTING.md` for user-facing issues.
- For runtime diagnostics:
  1. Reproduce with `npm run dev` and enable Obsidian dev tools.
  2. Capture logs (`logger` output + performance monitor warnings).
  3. Collect provider responses (redact API data) when engaging AI vendors.
- Critical failures should be documented in `docs/PRODUCTION-READY.md` under “Open Risks” until fixed.

## 6. Release Validation Checklist

1. **Pre-flight**: `npm run lint && npm run type-check && npm test`.
2. **Bundle integrity**: `npm run build` (plugin) / respective commands (extension/helper) and diff artifacts.
3. **Docs updated**: `README.md`, `docs/SETUP/README.md`, `docs/OPERATIONS.md`, `CHANGELOG.md` reflect changes.
4. **Security scan**: Run configured Semgrep/Trivy pipelines.
5. **Tag & publish**: Follow `docs/DEPLOYMENT_SUMMARY.md` for Obsidian + Chrome submissions, then archive release assets.
