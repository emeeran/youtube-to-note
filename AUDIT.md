# Production Readiness Audit — 2026-08-05

Branch `cleanup/pipeline-2026-08-05`, post Phases 0–3 (file purge, debloat, style).
Findings synthesised from four parallel audits (correctness/ops, security,
config/observability, testing/CI) and verified against the current source.

## Summary

**Verdict: production-viable, with a short list of should-fix-before-next-release items.**
The CI-blocking eslint/prettier conflict was resolved in Phase 3 (committed code is now
lint-clean). No RCE, credential-theft, or arbitrary-write vulnerability was confirmed.
API keys are handled correctly in the production paths (header transport, masking, no
logging). The remaining blockers are a non-functional quality gate, one resource leak,
and one security regression in a secondary path — each a small, isolated fix.

Critical-path test coverage is thin (~5 modules tested of ~15) — the plugin works, but
the safety net is narrow.

## Blockers (fix before next release)

- [ ] **`.husky/pre-commit` + `.husky/pre-push` swallow every failure.** Every gate ends
      in `2>/dev/null || echo "...skipped"` / `"Tests failed - pushing anyway"`, so lint,
      type-check, and tests **never block** a commit or push. This is how the CI-red `indent`
      errors slipped into prior commits. Fix: drop the `2>/dev/null || ...` suppression; let
      the hooks exit non-zero.
- [ ] **`src/components/features/youtube/youtube-url-modal.ts` `onClose` — `timerInterval`
      leaks.** The 100ms timer (started in `showProcessingState`) is cleared in
      `showCompletionState`/`showErrorState` but **not** in `onClose`. Closing the modal
      mid-process (Cancel / Escape / X) leaves the interval running against a destroyed DOM,
      and each cycle accumulates another. Fix: `clearInterval(timerInterval)` in `onClose`.
- [ ] **`src/settings-tab.ts:154` — Gemini key sent in the URL query string** during the
      settings "Test" button. The production `GeminiProvider` deliberately uses the
      `x-goog-api-key` header (`src/ai/gemini.ts`); the validator regressed. Query-string keys
      leak into proxy/server logs and Referer. Fix: `fetch(url, { headers: { 'x-goog-api-key': key } })`.

## High

- [ ] **`src/services/ai-service.ts:56` — `processWith` permanently mutates the shared
      provider's model.** `provider.setModel(overrideModel)` is never restored, so a later
      `process()` (or fallback iteration) uses the previously-selected model, not the default;
      concurrent calls also clobber each other. Fix: capture/restore in try/finally, or pass
      the model through `process(prompt, model)`.
- [ ] **`src/video-data.ts:80` — background promise mutates the returned `result`.**
      `checkTranscriptAvailability` writes `result.hasTranscript` on the object already handed
      to the caller, and re-caches by reference. Shared-mutable-state bug. Fix: cache a
      `{...result, hasTranscript}` copy.
- [ ] **`src/services/processing-history.ts:66` — `save()` read-modify-writes the whole
      plugin `data.json`** with no serialization against `main.ts` `saveSettings()`. A history
      write that completes after a settings write silently reverts the settings (and vice
      versa). Fix: a single async write mutex, or a separate storage key that doesn't
      round-trip through `loadData()`.
- [ ] **`listModels()` calls have no timeout** — `src/ai/groq.ts`, `openrouter.ts`,
      `ollama.ts`, `gemini.ts`. A hung `/models` endpoint pins the modal's model-fetch
      indefinitely. Fix: `AbortSignal.timeout(15000)` (or wrap).
- [ ] **Unsanitized remote error text reaches users** in three paths bypassing
      `sanitizeRemoteMessage`: `src/ai/huggingface.ts:84,97,110` (via `formatHuggingFaceError`),
      `src/services/error-handler.ts:188` (`handleAPIError` details), and `src/ai/gemini.ts:36`
      (400 path). A malicious endpoint could push multi-line content into a Notice.
      Fix: route each through `sanitizeRemoteMessage`.
- [ ] **Critical-path test gaps.** Untested: `main.ts:processYouTubeVideo` pipeline,
      `prompt-service.ts`, `obsidian-file.ts` (save/conflict/path-sanitize), the 6 AI
      providers, `secure-config.ts` (key resolution + legacy migration), `video-data.ts`,
      `settings-tab.ts`. Real coverage ≈ 5 of ~15 modules.

## Medium / Low

- [ ] (med) `src/main.ts:225` — `modalManager` open-state tracking is dead code;
      `safeShowUrlModal` bypasses it, so concurrent modal opens aren't deduped.
- [ ] (med) No `AbortController` on AI `process()` fetches; `onunload` doesn't cancel
      in-flight requests (only `isUnloading` is checked at the top of the pipeline).
- [ ] (med) `src/obsidian-file.ts:70` — `ensureDirectoryExists` swallows all errors, not
      just "already exists"; hides permission/path failures.
- [ ] (med) No `.env.example` despite first-class env-var support (`YTC_*` prefix).
- [ ] (med) `src/services/youtube-page.ts` — `PAGE_TIMEOUT_MS`/`CAPTION_TIMEOUT_MS` are
      defined but never applied (`requestUrl` has its own timeout; the consts are misleading).
- [ ] (med) `customTimeouts` setting (`src/types.ts:21`) is never read — dead config.
- [ ] (med) `src/main.ts:17,64` — hardcoded `PLUGIN_VERSION = '1.3.5'` is written onto
      `this.manifest.version` at runtime, while `manifest.json` says `2.0.0`. Telemetry/notices
      are inconsistent across reloads. Fix: read `this.manifest.version`, don't hardcode.
- [ ] (med) `tests/integration/pipeline.spec.ts` is 7 `expect(true).toBe(true)` stubs —
      missed by Phase 3 (which caught `example.spec` + `e2e/video-processing.spec`). Move to
      `trash2review` and replace with a real pipeline integration test.
- [ ] (med) `package.json` — `"obsidian": "latest"` is unpinned; CI `npm ci` is not
      reproducible across Obsidian API changes.
- [ ] (low) `src/services/url-handler.ts:310` — protocol handler logs raw `params` and
      applies no length cap to `params.url` before regex/cache.
- [ ] (low) `youtube-url-modal.ts` `handleSmartPaste` — clipboard with surrounding text
      (`"see https://youtu.be/… here"`) isn't URL-extracted; only a whole-string URL is accepted.
- [ ] (low) `extension/chrome-extension/content_script.js:49` — button SVG via `innerHTML`
      (hardcoded today; fragile pattern if ever templated).

## Missed by pipeline, caught by blind review (Phase 5)

A context-blind review (`pipeline/blind-review.md`) surfaced these **after** the Phase 4
audit. They are real and were not in the Phase 4 list — logged here rather than silently
folded into the earlier tiers.

- [ ] **(high) `src/templates/index.ts:44,75` — unsanitized video title in YAML frontmatter
      and iframe attribute.** The network-controlled title is spliced raw into `title: ${title}`
      (YAML) and `title="${title}"` (HTML attribute). A title containing `"` or `:` produces
      malformed frontmatter or breaks out of the attribute. Fix: YAML-quote
      (`JSON.stringify(title)`) and HTML-attribute-escape.
- [ ] **(med→high) `extension/chrome-extension/helper/server.js` — 76-line dead Express
      server shipped with the repo.** `Access-Control-Allow-Origin: *`, optional token auth,
      arbitrary file-append to env-var paths, and **zero consumers** (the content script uses
      the `obsidian://` handler directly). This is an attack surface doing nothing — the Phase 1
      purge missed it (it scanned `src/`, not `extension/`). Fix: move `helper/` to
      `trash2review` and confirm nothing references it.
- [ ] **(smell) Three parallel error-formatting systems** — `src/services/error-handler.ts`
      (~350 lines), `src/ai/error-utils.ts` (free functions), and per-provider `handleAPIError`
      methods all format the same kind of remote-error-to-user-message transform. Phase 4 noted
      "per-provider HTTP handling" but not this triplication. Consolidating is behavior-sensitive
      (copy changes) — flagged, not auto-applied.
- The blind review **confirmed** all Phase 4 blockers/highs (B1–B4, H1–H4) by independent
  re-read — higher confidence on those.

> **Limit:** the blind reviewer ran on the same model and `AUDIT.md` was already committed
> in the tree, so it had the answer key available (it says it re-verified each claim
> against source rather than trusting the doc, and the net-new findings above show it
> wasn't purely parroting). For a fully independent signal, re-run the cold-review prompt in
> a fresh session with `AUDIT.md` excluded. See `.pipeline/blind-review.md`.

## Explicitly out of scope / accepted risk

Carried from Phase 2/3 (judgment calls, intentionally not applied):

- `src/secure-config.ts` metadata subsystem (`storeMetadata`/`getAllMetadata`/…/`APIKeyMetadata`)
  is now write-only after `getRotationRecommendations` was removed — harmless dead writes
  to `localStorage`; left intact to avoid touching `setApiKey`/`clearApiKey`.
- Orphaned exported `SecurityValidationResult` interface (no consumers).
- Single-implementation interfaces `DOMUtilsInterface` / `ErrorHandlerInterface` (used only
  as `implements`) — cosmetic to remove.
- Duplicate API-key validation (`ValidationUtils.isValidAPIKey` vs `APIKeyValidator.validateKeyFormat`).
- Per-provider HTTP-status handling (consolidation would change user-facing error copy).
- Plaintext API-key storage in `data.json` — intentional, matches Obsidian convention;
  documented in `README.md`. Legacy XOR-obfuscated values are still recovered on read.

## Already addressed (context — not open)

Resolved by the prior `feat: core pipeline overhaul` + this cleanup pipeline:
dead `video.google.com/timedtext` endpoint and `allorigins.win` CORS proxy removed
(transcript + metadata now via `requestUrl`); API-key obfuscation layer removed
(reads de-obfuscate legacy values + migrate to plaintext); Gemini production key moved to
header; `outputPath` rejects `..`; modal status `innerHTML` → `textContent`; transcript
failures now logged + surfaced via Notice; eslint/prettier `indent` conflict fixed;
~541 lines of dead code removed (Phase 2).
