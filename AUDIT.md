# Production Readiness Audit — 2026-08-05

Branch `cleanup/pipeline-2026-08-05`, post Phases 0–3 (file purge, debloat, style).
Findings synthesised from four parallel audits (correctness/ops, security,
config/observability, testing/CI) and verified against the current source.

**Re-verified and closed out on 2026-09-06, branch `feature/production-readiness`.**
Every `[x]` below was confirmed fixed by re-reading the source on that branch, not by
trusting this document. Anything still open is collected in
[Remaining / deferred](#remaining--deferred) at the end.

## Summary

**Verdict: production-ready.** Every blocker and every High item from the 2026-08-05 audit
is fixed and verified against source; the hooks gate, the leak, the key-in-URL regression,
the data.json write race and the unsanitized-Notice paths are all closed. No RCE,
credential-theft, or arbitrary-write vulnerability was confirmed. API keys are handled
correctly in the production paths (header transport, masking, no logging).

What is _not_ done is deliberate or cosmetic, and it is listed openly in
[Remaining / deferred](#remaining--deferred): token-level streaming (the provider interface
is `Promise<string>`; stage progress is the interim), the ESLint 8 → 9 flat-config
migration (ESLint 8 is EOL), Ollama's `statusText` echo, `/live/…` URL intake, and
critical-path test coverage, which improved from ~5 modules / 57 tests to 7 suites / 101
tests but still does not reach the pipeline, providers or settings UI.

## Blockers (fix before next release)

- [x] **`.husky/pre-commit` + `.husky/pre-push` swallow every failure.** Every gate ends
      in `2>/dev/null || echo "...skipped"` / `"Tests failed - pushing anyway"`, so lint,
      type-check, and tests **never block** a commit or push. This is how the CI-red `indent`
      errors slipped into prior commits. Fix: drop the `2>/dev/null || ...` suppression; let
      the hooks exit non-zero.
      **(fixed 2026-09-06, branch feature/production-readiness)** — both hooks are now bare
      `npx lint-staged` / `npm run type-check` / `npx jest` / `npm test`; no suppression, a
      failure aborts the commit/push.
- [x] **`src/components/features/youtube/youtube-url-modal.ts` `onClose` — `timerInterval`
      leaks.** The 100ms timer (started in `showProcessingState`) is cleared in
      `showCompletionState`/`showErrorState` but **not** in `onClose`. Closing the modal
      mid-process (Cancel / Escape / X) leaves the interval running against a destroyed DOM,
      and each cycle accumulates another. Fix: `clearInterval(timerInterval)` in `onClose`.
      **(fixed 2026-09-06, branch feature/production-readiness)** — `stopTimer()` clears and
      unsets the handle; `onClose` calls it, and every state transition goes through it.
- [x] **`src/settings-tab.ts:154` — Gemini key sent in the URL query string** during the
      settings "Test" button. The production `GeminiProvider` deliberately uses the
      `x-goog-api-key` header (`src/ai/gemini.ts`); the validator regressed. Query-string keys
      leak into proxy/server logs and Referer. Fix: `fetch(url, { headers: { 'x-goog-api-key': key } })`.
      **(fixed 2026-09-06, branch feature/production-readiness)** — the Gemini validator now
      sends `x-goog-api-key`; no provider key travels in a URL anywhere in the codebase.

## High

- [x] **`src/services/ai-service.ts:56` — `processWith` permanently mutates the shared
      provider's model.** `provider.setModel(overrideModel)` is never restored, so a later
      `process()` (or fallback iteration) uses the previously-selected model, not the default;
      concurrent calls also clobber each other. Fix: capture/restore in try/finally, or pass
      the model through `process(prompt, model)`.
      **(fixed 2026-09-06, branch feature/production-readiness)** — `previousModel` is
      captured before the call and restored in a `finally`.
- [x] **`src/video-data.ts:80` — background promise mutates the returned `result`.**
      `checkTranscriptAvailability` writes `result.hasTranscript` on the object already handed
      to the caller, and re-caches by reference. Shared-mutable-state bug. Fix: cache a
      `{...result, hasTranscript}` copy.
      **(fixed 2026-09-06, branch feature/production-readiness)** — the background write
      re-caches `{ ...result, hasTranscript }`; the caller's object is never mutated.
- [x] **`src/services/processing-history.ts:66` — `save()` read-modify-writes the whole
      plugin `data.json`** with no serialization against `main.ts` `saveSettings()`. A history
      write that completes after a settings write silently reverts the settings (and vice
      versa). Fix: a single async write mutex, or a separate storage key that doesn't
      round-trip through `loadData()`.
      **(fixed 2026-09-06, branch feature/production-readiness)** — `withPluginDataLock`
      serializes every read-modify-write, and `saveSettings` joins the same queue.
- [x] **`listModels()` calls have no timeout** — `src/ai/groq.ts`, `openrouter.ts`,
      `ollama.ts`, `gemini.ts`. A hung `/models` endpoint pins the modal's model-fetch
      indefinitely. Fix: `AbortSignal.timeout(15000)` (or wrap).
      **(fixed 2026-09-06, branch feature/production-readiness)** — all four go through
      `BaseAIProvider.fetchWithTimeout`, which applies `MODEL_LIST_TIMEOUT_MS` (15000) and
      rethrows a labelled timeout error.
- [x] **Unsanitized remote error text reaches users** in three paths bypassing
      `sanitizeRemoteMessage`: `src/ai/huggingface.ts:84,97,110` (via `formatHuggingFaceError`),
      `src/services/error-handler.ts:188` (`handleAPIError` details), and `src/ai/gemini.ts:36`
      (400 path). A malicious endpoint could push multi-line content into a Notice.
      Fix: route each through `sanitizeRemoteMessage`.
      **(fixed 2026-09-06, branch feature/production-readiness)** — the helper now lives in
      `src/ai/error-utils.ts`; huggingface, error-handler and all three gemini error paths
      sanitize (length cap + newline/control strip) before the text reaches an Error or Notice.
- [x] **Critical-path test gaps.** Untested: `main.ts:processYouTubeVideo` pipeline,
      `prompt-service.ts`, `obsidian-file.ts` (save/conflict/path-sanitize), the 6 AI
      providers, `secure-config.ts` (key resolution + legacy migration), `video-data.ts`,
      `settings-tab.ts`. Real coverage ≈ 5 of ~15 modules.
      **(partially fixed 2026-09-06, branch feature/production-readiness)** — 7 suites /
      101 tests now cover `youtube-page`, `transcript-service`, typed transcript outcomes,
      prompt timestamp logic, `ai-service` (chain + model restore), `url-handler` and
      `secure-config`. Still open (see Remaining): the `processYouTubeVideo` pipeline,
      `obsidian-file.ts`, `video-data.ts` metadata, the providers, `settings-tab.ts`.

## Medium / Low

- [ ] (med) `src/main.ts` — `modalManager` open-state tracking is dead code;
      `safeShowUrlModal` bypasses it, so concurrent modal opens aren't deduped.
      _(still present — it is now only read for a debug log and cleared on unload.)_
- [x] (med) No `AbortController` on AI `process()` fetches; `onunload` doesn't cancel
      in-flight requests (only `isUnloading` is checked at the top of the pipeline).
      **(fixed 2026-09-06, branch feature/production-readiness)** — `AIRequestOptions.signal`
      is threaded through every provider; the modal aborts on close, and `onunload` aborts
      every run that had no signal of its own.
- [x] (med) `src/obsidian-file.ts:70` — `ensureDirectoryExists` swallows all errors, not
      just "already exists"; hides permission/path failures.
      **(fixed 2026-09-06, branch feature/production-readiness)** — only the
      already-exists outcome is swallowed; everything else is rethrown with the path and the
      underlying message.
- [x] (med) No `.env.example` despite first-class env-var support (`YTC_*` prefix).
      **(fixed 2026-09-06, branch feature/production-readiness)** — `.env.example` documents
      all five keys and how to launch Obsidian with them. (Note: the _prefix_ itself has no
      settings-UI field; see Remaining.)
- [x] (med) `src/services/youtube-page.ts` — `PAGE_TIMEOUT_MS`/`CAPTION_TIMEOUT_MS` are
      defined but never applied (`requestUrl` has its own timeout; the consts are misleading).
      **(fixed 2026-09-06, branch feature/production-readiness)** — the unused consts are
      gone; the one request that genuinely needs a bound (the innertube fallback) runs under
      a 15s `withTimeout`.
- [x] (med) `customTimeouts` setting (`src/types.ts:21`) is never read — dead config.
      **(fixed 2026-09-06, branch feature/production-readiness)** — removed from the settings
      type and from `data.json.example`.
- [x] (med) `src/main.ts:17,64` — hardcoded `PLUGIN_VERSION = '1.3.5'` is written onto
      `this.manifest.version` at runtime, while `manifest.json` said `2.0.0`. Telemetry/notices
      are inconsistent across reloads. Fix: read `this.manifest.version`, don't hardcode.
      **(fixed 2026-09-06, branch feature/production-readiness)** — the constant is gone; the
      version is read from `this.manifest.version`.
- [x] (med) `tests/integration/pipeline.spec.ts` — 7 `expect(true).toBe(true)` stubs
      (missed by Phase 3, surfaced by Phase 5 blind review). **Moved to `trash2review`
      (2026-08-05).** A real pipeline integration test is still TODO (see High → test gaps).
      **(superseded 2026-09-06)** — `trash2review/` itself was deleted; the stubs no longer
      exist anywhere. A real integration test still does not.
- [x] (med) `package.json` — `"obsidian": "latest"` is unpinned; CI `npm ci` is not
      reproducible across Obsidian API changes.
      **(fixed 2026-09-06, branch feature/production-readiness)** — pinned to `1.10.3`
      (`jest-environment-jsdom` pinned to `^29.7.0` to match `jest`).
- [x] (low) `src/services/url-handler.ts:310` — protocol handler logs raw `params` and
      applies no length cap to `params.url` before regex/cache.
      **(fixed 2026-09-06, branch feature/production-readiness)** — URLs longer than 2048
      chars are rejected with a Notice, and only the extracted video id (never the raw
      params) is logged.
- [x] (low) `youtube-url-modal.ts` `handleSmartPaste` — clipboard with surrounding text
      (`"see https://youtu.be/… here"`) isn't URL-extracted; only a whole-string URL is accepted.
      **(fixed 2026-09-06, branch feature/production-readiness)** — `extractYouTubeUrls`
      pulls every YouTube URL out of arbitrary text, and multi-URL paste is now a feature.
- [x] (low) `extension/chrome-extension/content_script.js:49` — button SVG via `innerHTML`
      (hardcoded; fragile if templated). **Fixed (2026-08-05):** now built with
      `DOMParser` + `appendChild`, closing the innerHTML sink.

## Missed by pipeline, caught by blind review (Phase 5)

A context-blind review (`pipeline/blind-review.md`) surfaced these **after** the Phase 4
audit. They are real and were not in the Phase 4 list — logged here rather than silently
folded into the earlier tiers.

- [x] **(high) `src/templates/index.ts:44,75` — unsanitized video title in YAML frontmatter
      and iframe attribute.** The network-controlled title is spliced raw into `title: ${title}`
      (YAML) and `title="${title}"` (HTML attribute). A title containing `"` or `:` produces
      malformed frontmatter or breaks out of the attribute. Fix: YAML-quote
      (`JSON.stringify(title)`) and HTML-attribute-escape.
      **(fixed 2026-09-06, branch feature/production-readiness)** — `escapeYamlScalar`
      (JSON encoding, a safe YAML double-quoted scalar) covers every frontmatter value and
      the `ensureFrontMatterValue` fallback; `escapeHtmlAttr` covers the iframe attribute.
- [x] **(med→high) `extension/chrome-extension/helper/server.js` — 76-line dead Express
      server shipped with the repo.** `Access-Control-Allow-Origin: *`, optional token auth,
      arbitrary file-append to env-var paths, and **zero consumers** (the content script uses
      the `obsidian://` handler directly). This is an attack surface doing nothing — the Phase 1
      purge missed it (it scanned `src/`, not `extension/`). **Fixed (2026-08-05):** `helper/`
      (server.js + package.json) moved to `trash2review`; confirmed zero references beforehand.
      **(superseded 2026-09-06)** — `trash2review/` was deleted, so the code is gone from the
      tree entirely.
- [ ] **(smell) Three parallel error-formatting systems** — `src/services/error-handler.ts`
      (~350 lines), `src/ai/error-utils.ts` (free functions), and per-provider `handleAPIError`
      methods all format the same kind of remote-error-to-user-message transform. Phase 4 noted
      "per-provider HTTP handling" but not this triplication. Consolidating is behavior-sensitive
      (copy changes) — flagged, not auto-applied. _(still true.)_
- The blind review **confirmed** all Phase 4 blockers/highs (B1–B4, H1–H4) by independent
  re-read — higher confidence on those.

> **Limit:** the blind reviewer ran on the same model and `AUDIT.md` was already committed
> in the tree, so it had the answer key available (it says it re-verified each claim
> against source rather than trusting the doc, and the net-new findings above show it
> wasn't purely parroting). For a fully independent signal, re-run the cold-review prompt in
> a fresh session with `AUDIT.md` excluded. (`.pipeline/blind-review.md` was deleted with the
> pipeline scaffolding; the caveat stands for any future re-run.)

## Remaining / deferred

Everything still open, re-verified on 2026-09-06. Ordered by how much it matters.

- **Token-level streaming (deferred, deliberate).** `AIProvider.process` is
  `Promise<string>`, so output arrives all at once. The stage checklist
  (metadata → transcript → AI → save) is the interim UX. Adding streaming means changing the
  provider interface and every client.
- **ESLint 8 → 9 flat config (deferred, deliberate).** `eslint@^8.57.0` with `.eslintrc.js`.
  ESLint 8 is EOL; the migration touches the config format and the `indent`-vs-prettier
  settlement recorded in the conventions above. Not undertaken in this pass.
- **(low) Ollama echoes the HTTP reason phrase** — `src/ai/ollama.ts` throws
  `"Ollama API error: <status> - <statusText>"`. `statusText` is server-controlled and skips
  `sanitizeRemoteMessage` (unlike every other provider path). One-line fix when next touched.
- **(low) `/live/<id>` URLs are still rejected by the plugin's validator.**
  `ValidationUtils.URL_PATTERNS` has no `live` pattern, while the extension and the
  protocol-handler's logging regex both recognise the shape. The extension therefore
  normalises every URL to `https://www.youtube.com/watch?v=ID` before handing off, which is
  why live streams work from the extension and not from a pasted `/live/` link.
- **(low) Transcript-truncation warning misstates the threshold.** `main.ts` warns
  "truncated at 100,000 characters" but the flag it reports comes from the transcript
  service's 150,000-char source ceiling (the 100k figure is the _prompt_ budget applied later
  in `prompt-service.ts`). Cosmetic copy fix.
- **(low) The modal's live preview `fetch` has no timeout.**
  `youtube-url-modal.ts:showVideoPreview` calls `fetch` against YouTube's `oembed` endpoint
  directly (not `requestUrl`) and bounds it nowhere; a hung response leaves the preview blank
  rather than delaying processing, but it is the one YouTube request left without a bound.
- **(med) Critical-path test coverage is still thin** — no test drives
  `processYouTubeVideo` end to end, and `obsidian-file.ts`, `video-data.ts` metadata, the six
  providers and `settings-tab.ts` remain untested.
- **(med) `environmentPrefix` has no settings-UI field.** The setting exists and is validated,
  but the prefix can only be changed by editing `data.json`; `.env.example` documents that.
- **(smell) Three parallel error-formatting systems** (see above) — consolidation is
  behavior-sensitive and was deliberately not attempted here.
- **(verification, not code) The extension has not been manually exercised on
  music.youtube.com or a real `/live/` stream.** The selectors and normalisation are in place
  and code-reviewed; a human still needs to click through them before the next store upload.
- **API-key rotation reminder:** the metadata subsystem in `src/secure-config.ts` remains
  write-only localStorage bookkeeping — harmless, intentionally left alone.

## Explicitly out of scope / accepted risk

Carried from Phase 2/3 (judgment calls, intentionally not applied; all re-verified as still
present on 2026-09-06):

- `src/secure-config.ts` metadata subsystem (`storeMetadata`/`getAllMetadata`/…/`APIKeyMetadata`)
  is now write-only after `getRotationRecommendations` was removed — harmless dead writes
  to `localStorage`; left intact to avoid touching `setApiKey`/`clearApiKey`.
- Orphaned exported `SecurityValidationResult` interface (no consumers).
- Single-implementation interfaces `DOMUtilsInterface` / `ErrorHandlerInterface` (used only
  as `implements`) — cosmetic to remove.
- Duplicate API-key validation (`ValidationUtils.isValidAPIKey` vs `APIKeyValidator.validateKeyFormat`).
- Per-provider HTTP-status handling (consolidation would change user-facing error copy).
- **Plaintext API-key storage in `data.json` — intentional, matches Obsidian convention;
  documented in `README.md`. Legacy XOR-obfuscated values are still recovered on read.**
  Users who want keys off disk have `useEnvironmentVariables` + `YTC_*` env vars, and the
  settings tab warns when env mode is on while keys are still persisted.

## Already addressed (context — not open)

Resolved by the prior `feat: core pipeline overhaul` + this cleanup pipeline:
dead `video.google.com/timedtext` endpoint and `allorigins.win` CORS proxy removed
(transcript + metadata now via `requestUrl`); API-key obfuscation layer removed
(reads de-obfuscate legacy values + migrate to plaintext); Gemini production key moved to
header; `outputPath` rejects `..`; modal status `innerHTML` → `textContent`; transcript
failures now logged + surfaced via Notice; eslint/prettier `indent` conflict fixed;
~541 lines of dead code removed (Phase 2).
