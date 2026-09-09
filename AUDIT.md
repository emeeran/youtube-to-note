# Production Readiness Audit — 2026-09-09

## Summary

**Ready with fixes.** The core pipeline (URL intake → transcript → AI → note save) is
architecturally sound: the trust boundaries around `obsidian://` intake, vault path
handling, caption-host pinning, secret redaction, and extension message-passing all
verified clean under a six-dimension audit (correctness, security, config, observability,
testing/CI, operations). However, two confirmed blocker-grade bugs — one silently
**reverts processing history**, the other **kills the file-watcher intake feature
entirely** — plus a cluster of high items (misclassified aggregate errors, untype-checked
tests, unload not aborting in-flight runs) should be fixed before this ships as 2.2.0.

## Blockers (must fix before prod)

- [ ] `src/main.ts:908-913` — **`saveSettings()` writes the plugin-load-time snapshot of
      `ytc-processing-history`, silently reverting history added during the session.**
      `loadSettings()` absorbs data.json's history array into `_settings` (main.ts:891);
      `ProcessingHistoryService` re-reads and mutates its own copy; the shared
      `withPluginDataLock` serializes the two writers but does nothing about the stale
      payload. Any settings save (toggle change, key migration main.ts:897, model-cache
      refresh main.ts:395/419) rewrites data.json with startup-era history →
      `warnOnDuplicates` stops matching and users re-pay for AI runs. _Verified by
      independent code read — both the operations and correctness audits found it._
      Fix direction: `saveSettings` must re-read fresh data (like
      `ProcessingHistoryService.save()` does) and own only the settings keys, never history.
- [ ] `src/services/url-handler.ts:234, 284` — **file-watcher and active-leaf intake is
      dead in production: logging `{ ...result }` with a live `TFile` throws on circular
      JSON before `handleUrlSafely()` runs.** `logger.formatMessage` calls
      `JSON.stringify(entry.data)` unguarded (logger.ts:55); a real `TFile` carries
      `vault`/`parent` back-references (`parent.children` contains the file), so stringify
      throws `TypeError: circular structure`, the surrounding `catch` swallows it, and the
      modal never opens. Protocol/clipboard intake (no `file` field) keeps working, which
      masks the bug; tests use a mock vault without the cycle. Fix direction: never log the
      raw `file` — log `file.path` only, and/or make `formatMessage` stringify-safe.

## High priority

- [ ] `src/services/error-handler.ts:80-110,129` + `src/main.ts:666` — the 6-provider
      aggregate failure is misclassified by substring scan: one provider's canned
      "Rate limit exceeded" (or any message containing "429") routes the _whole_ aggregate
      to `handleQuotaError`, replacing accurate per-provider attribution with a wrong
      provider's quota notice plus a Retry button. (Also: that Retry button dispatches
      `yt-clipper-retry-processing`, an event **nothing listens for** — a silent no-op,
      error-handler.ts:60-72.)
- [ ] `tsconfig.json:31-36` + `jest.config.js:21` — **tests are type-checked by
      nothing**: `tsc --noEmit` excludes `tests/**`, and ts-jest's `isolatedModules: true`
      skips type diagnostics entirely. The `@tests/` alias exists only in jest's
      moduleNameMapper. A mistyped test helper ships green.
- [ ] `src/ai/ollama.ts:25-35` — user-configured endpoint normalization has zero test
      coverage (all specs construct without the 4th arg), including a latent
      trailing-slash → `http://host//api` bug. This code decides where transcripts _and API
      keys_ are POSTed; the `'cloud'` substring heuristic also hijacks custom endpoints
      whose URL merely contains "cloud" (settings-tab.ts:243-244 duplicates the heuristic
      for key validation).
- [ ] `src/main.ts:478-483,183-196` — `activeRunControllers` never receives a
      production controller (the modal always passes its own signal), so `onunload`'s abort
      loop iterates an empty set; `modalManager.clear()` resets a boolean but does not
      close the modal. Disable/update mid-run keeps writing notes and firing Notices into a
      dead plugin instance.

## Medium / Low

- `src/validation.ts:40-55` — URL patterns are unanchored: `https://evil.com/…?v=<id>`
  passes, and the raw attacker string (not the canonical watch URL) flows into
  frontmatter `source:`, prompts, and timestamp links. → chains into:
- `src/services/prompt-service.ts:132` — timestamp-link destination is not escaped
  (caption text is), so a crafted URL forges markdown links in the saved note.
  Canonicalizing intake URLs to `https://www.youtube.com/watch?v=<id>` (the extension
  already does) closes both.
- `src/services/transcript-service.ts:383-413` — `DOMParser` never throws; a
  malformed/HTML error caption payload yields `<parsererror>` → 0 segments →
  misreported as `no-captions` → run "succeeds", spends an AI call, writes a thin note.
- `src/main.ts:434-438` — `modal.open()` has no try/finally around `beginOpen()`; a
  throwing `onOpen` (it rethrows, youtube-url-modal.ts:214) wedges the single-modal
  slot until restart.
- Settings defaults are hand-quadruplicated (`main.ts:127`, `settings-tab.ts:24-26,866-889`,
  `tests/utils/test-helpers.ts`, and 2 spec copies) and have **already drifted** — the
  secure-config/pipeline test copies omit fields production defaults to true.
  `DEFAULT_SETTINGS` is module-private, so no parity test is possible without exporting it.
- `src/ai/api.ts:34` — OpenRouter default is the dated `gemini-2.5-flash-preview-05-20`
  snapshot (the rot class that broke Groq/HF); GA `google/gemini-2.5-flash` should be
  the default.
- `src/ai/base.ts:219-230` — non-429 provider errors discard the response body: a 404
  "model does not exist" or a 500 detail surfaces only as "HTTP error 500" to user and
  console alike.
- `src/services/transcript-cache.ts:132-135` — failed rename orphans `.tmp-*` files
  until next reload (sync mounts are the common case); `:223-247` — prune re-reads up to
  200 full transcripts on every write, on the run's critical path.
- `src/settings-tab.ts:339,827` — API-key "Test" and settings-import failures swallow
  the reason into a bare toast with no log — the two highest-friction support paths.
- Observability: no run identifier or stage-boundary logging in `processYouTubeVideo`
  (main.ts:535-694 — stage list lives only in the transient modal); `ErrorHandler.handle`
  logs at DEBUG while prod pins INFO (all Notice-reported failures leave no console
  trace); no stack/`.cause` captured anywhere; provider base URLs duplicated as inline
  literals in settings-tab pings (one already points at a different host than the client).
- `src/services/user-preferences-service.ts` — the localStorage persistence layer and
  its `migrateFormatName` map are untested (a format rename that forgets the map
  silently resets user defaults); protocol length guard (url-handler.ts:302) and
  `cleanupHandledFiles` also untested.
- `jest.config.js:32-56` — coverage floors gate `lines` only (37% global); branch/lines
  regression passes CI. Lint/format cover `src/` only; `format:check` runs nowhere.
- Low: `$`-sequence expansion in `replacePlaceholders` (prompt-service.ts:495-502);
  `sanitizeInlineText` blocks line-forging but not inline markdown/HTML from `videoUrl`
  (prompt-service.ts:595+); captions double entity-decoded, rewriting literal
  `\uXXXX`/`\n` sequences in content (youtube-page.ts:185-198); `sanitizeFilename`
  empty-result/Windows-reserved-name gaps land after the paid AI call
  (obsidian-file.ts:62-65); caption-host guard's own logging can throw on a hostile
  URL (youtube-page.ts:274-278); "Clear transcript cache" leaves the 7-day memory tier
  (service-container.ts:126-128) so a refetch returns the same transcript;
  `MemoryCacheService` hands out cached objects by reference (memory-cache.ts:42);
  full URLs logged at INFO contradict the protocol handler's videoId-only policy
  (main.ts:312-319, url-handler.ts:139-143,234,284); onload failure leaves a
  half-initialized ribbon (main.ts:174-180); `data.json.example` still ships the
  removed `enableParallelProcessing` key; OpenRouter attribution headers name a
  scaffold repo and the plugin's old name (openrouter.ts:43-44); `AI_MODELS.OLLAMA_LOCAL`
  is not in the curated Ollama list so code-fallback and UI default disagree (api.ts:36);
  extension version strings (content_script.js/background.js headers) are hand-synced
  with no CI gate.

## Explicitly out of scope / accepted risk

- Plaintext API keys in `data.json` — intentional Obsidian convention, documented; env
  mode (`YTC_*`) available for off-disk keys.
- `preferMultimodal` toggle (write-only) and the never-dispatched `processWithImage`
  path — wire-or-remove decision pending (carried from cleanup pass).
- API-key format tables triplicated across validation/secure-config/settings-tab —
  unification is behavior-adjacent (regex strictness), needs a deliberate decision.
- Indirect prompt injection from video metadata/transcript into note bodies — inherent
  to LLM pipelines; structural note elements are deterministic and defended. Now
  documented here rather than silent.
- `withTimeout` exists twice (network vs DOM variants) — intentional decoupling.
- Extension ships plain JS with no build/lint — deliberate (CLAUDE.md).
- secure-config metadata subsystem remains write-only bookkeeping — harmless.

## Verified clean (positive assurance from the audit sweep)

Unhandled rejections (all fire-and-forget sites `void`-prefixed over catching fns);
resource leaks (timers, AbortControllers, listeners all tracked and cleared);
unbounded loops; `obsidian://` id-only trust boundary; vault path traversal
(`normalizePath`/`sanitizeSegment`); caption-host pinning (SSRF); secrets in
logs/code (redaction helper; keys never in URLs; header-placed); command injection
(none; scripts use `set -euo pipefail`); extension messaging (zero-permission,
DOMParser-only, id-gated); provider fetch contract asserted in tests (URL, header
placement, body shape, abort propagation); fake-timer hygiene; CI runs lint +
coverage floors with correct concurrency and tag/version gating; history bounded at
200 entries; duplicate-modal idempotency; disk-cache corruption handling.

---

# Production Readiness Audit — 2026-08-05

Branch `cleanup/pipeline-2026-08-05`, post Phases 0–3 (file purge, debloat, style).
Findings synthesised from four parallel audits (correctness/ops, security,
config/observability, testing/CI) and verified against the current source.

**Re-verified and closed out on 2026-09-06, branch `feature/production-readiness`.**
Every `[x]` below was confirmed fixed by re-reading the source on that branch, not by
trusting this document. Anything still open is collected in
[Remaining / deferred](#remaining--deferred) at the end.

**Re-verified again on 2026-09-07, `main` @ `134b117`**, after the second hardening pass
(a second parallel audit produced the H1–H8 / M1–M18 ledger in
[Second pass (2026-09-07)](#second-pass-2026-09-07) below). That pass closed the last of
the user-visible correctness gaps; the ledger below was re-walked against source on that
date and the open list was pruned accordingly.

## Summary

**Verdict: production-ready.** Every blocker and every High item from the 2026-08-05 audit
is fixed and verified against source; the hooks gate, the leak, the key-in-URL regression,
the data.json write race and the unsanitized-Notice paths are all closed. No RCE,
credential-theft, or arbitrary-write vulnerability was confirmed. API keys are handled
correctly in the production paths (header transport, masking, no logging) — and, since the
2026-09-07 pass, they no longer leave the plugin at all through a settings export.

What is _not_ done is deliberate or cosmetic, and it is listed openly in
[Remaining / deferred](#remaining--deferred): token-level streaming (the provider interface
is `Promise<string>`; stage progress is the interim), the ESLint 8 → 9 flat-config
migration (ESLint 8 is EOL), the TypeScript 5.3.3 bump, the `setApiKey` field-name masking
dead path, the `MemoryCache` FIFO eviction, and the 51 remaining inline `style.*` writes in
the modal and settings tab.

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
      101 tests at that point. **(extended 2026-09-07)** — **16 suites / 408 tests**
      (snapshot of `npx jest` on 2026-09-07; re-run it for the current count) now also cover
      the `processYouTubeVideo` pipeline, all six AI providers, the settings-level validation
      rules, and the modal's batch helpers. Still open (see Remaining): `obsidian-file.ts`,
      `video-data.ts` metadata, `settings-tab.ts`.

## Medium / Low

- [x] (med) `src/main.ts` — `modalManager` open-state tracking is dead code;
      `safeShowUrlModal` bypasses it, so concurrent modal opens aren't deduped — the ribbon,
      the command and the clipboard intake could stack three modals and three runs.
      **(fixed 2026-09-07)** — `ModalManager.beginOpen()` returns `false` while a modal is
      already open, every intake path goes through it, and the user gets a Notice instead of
      a second stacked modal.
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

## Second pass (2026-09-07)

A second parallel audit ran against `main` @ `44fcbbc` (v2.1.0) and produced the H1–H8 /
M1–M18 ledger below, fixed across `c003c0b`…`134b117`. Every entry was re-verified against
source on 2026-09-07 — the resolution text describes the code as it is now, not the intent.

### High

- [x] **H1 — Timestamp links were unfulfillable.** The prompt told the model to cite "only the
      segment start times supplied with the transcript", but `buildDataSection` rendered that
      transcript as plain text: `segments` fed only the complete-transcription index. With
      `includeTimestamps` on (the default), every other format had to omit the links or invent
      `t=` values. **(fixed `a028403`)** — `buildMinuteMarkedTranscript` renders the
      transcript with an inline `[MM:SS]` marker at each minute boundary (one per minute, not
      per caption, so the marker count is bounded by the video's length), and
      `buildTranscriptSection` uses it whenever segments are present. Complete Transcription's
      deterministic index is unchanged.
- [x] **H2 — Non-Gemini/Groq users were hard-blocked.** `validateSettings` counted only
      `geminiApiKey`/`groqApiKey` as a real key, the pipeline threw "No valid Gemini or Groq
      API key configured" for an OpenRouter/HuggingFace/Ollama-Cloud-only setup, and
      env-var mode could never show READY. **(fixed `c003c0b`)** — any of the five configured
      keys now satisfies validation (`API_KEY_FIELDS`), env mode with a prefix counts, and a
      key whose prefix does not match its provider is returned as a **warning** that never
      affects `isValid`. The settings tab's READY/SETUP badge (`validateConfiguration`) and
      the pipeline both follow the same any-provider rule.
- [x] **H3 — `hasFrontMatter` misread a leading `---` rule as frontmatter**, skipping the
      deterministic header and letting `ensureFrontMatterValue` inject `ai_provider:` under a
      horizontal rule. **(fixed `a028403`)** — the opening block must now look like YAML
      (`---` followed by a `key:` line) before it is treated as frontmatter.
- [x] **H4 — Modal retry re-ran the whole batch**, resetting results and looping every URL, so
      one flaky link re-billed N−1 successes — and a partial failure hid the notes that _did_
      save. **(fixed `b695bcb`)** — `buildFailureRetry` seeds the retry from the failures
      only (`failedUrlsOf`), the label says how many are left ("Retry 3 failed"), the
      successes stay rendered as clickable links above the error, and **🔁 Retry all** is a
      separate button that only appears when something already succeeded.
- [x] **H5 — Settings export downloaded live API keys** as plaintext JSON with no warning, and
      import re-admitted them. **(fixed `ca8aa11`)** — `exportSettings` deletes every
      `API_KEY_FIELDS` entry and writes an explanatory `keysNote`; `mergeImportedSettings`
      only takes a key from the file when it carries a non-empty value, so a key-free export
      can never blank the keys already in `data.json`.
- [x] **H6 — `customPrompts` were unbounded and saved on every keystroke**, rewriting the whole
      `data.json` per keypress. **(fixed `ca8aa11`)** — `MAX_CUSTOM_PROMPT_LENGTH` (20,000)
      is enforced by the textarea `maxlength`, re-checked as a hard validation error for
      imported or hand-edited values, and the textareas persist on a 500 ms debounce.
- [x] **H7 — v2.1.0 was not actually releasable:** the tag did not exist, the changelog still
      said `[Unreleased]`, the release job had no `permissions` (403 on default-read repos)
      and never asserted that tag = manifest = package version. **(fixed `134b117`)** —
      changelog section renamed, the release job opts into `contents: write` and fails fast on
      a version mismatch before building anything.
- [x] **H8 — Release hygiene with bite:** `.claude/settings.local.json` was tracked,
      lint-staged's `*.{js,mjs,cjs,jsx}` glob would have prettier-formatted the generated
      `main.js` had it ever been staged. **(fixed `134b117`)** — the settings file is
      untracked and gitignored, and `main.js` is excluded from the lint-staged glob.

### Medium

- [x] **M1 — The truncation story was incoherent:** the flag was set only at the 150k source
      cap, the warning copy said "100,000", and the per-format budgets sat between those two
      numbers — so a format that trimmed at 120k reported nothing at all. **(fixed
      `3808806`, `a028403`, `e979b38`)** — PromptService reports the trim it actually applied
      through an `onTruncated({ budget, originalLength })` callback, and the user-facing copy
      is derived from it: "trimmed to the first 120,000 of 145,000 characters for this
      format", or the 150,000 source-ceiling message when that is what fired. No hardcoded
      figure remains.
- [x] **M2 — AI `process()` had no generation timeout**, so a hung provider pinned the run.
      **(fixed `b509f48`)** — every provider request runs under `REQUEST_TIMEOUT_MS`
      (60,000) from `src/ai/error-utils.ts`.
- [x] **M3 — `requestUrl` stages were unabortable and un-timed.** **(fixed `e979b38`)** —
      watch-page, caption and innertube fetches run under a 15s `withTimeout` that accepts the
      run's `signal`, and the pipeline threads that signal through metadata, transcript and
      save.
- [x] **M4 — The transcript disk cache wrote junk directories** and raced on a fixed `.tmp`
      name, with no size bound. **(fixed `b509f48`)** — paths derive from the vault config
      dir that is actually written, the temp file is unique per write before an atomic rename,
      entries are shape-validated on read (a malformed file is a miss and is deleted), and the
      cache is pruned to `TRANSCRIPT_CACHE_MAX_FILES` (200) after each write.
- [x] **M5 — `## Resources` was appended unconditionally and the `## Source` check was
      case/spacing-sensitive**, so custom prompts produced duplicates or lost attribution.
      **(fixed `a028403`)** — both headings are matched case-insensitively with optional
      spacing and de-duplicated.
- [x] **M6 — An oEmbed failure killed the run** even though the CORS-free watch-page scrape
      existed. **(fixed `e979b38`)** — every oEmbed failure now falls back to the scrape; only
      when both fail does the run error, and it surfaces the more descriptive of the two.
- [x] **M7 — A background transcript prefetch duplicated the pipeline's own fetch** —
      unabortable, wasted network, on every video under 30 minutes. **(fixed `e979b38`)** —
      removed.
- [x] **M8 — Modal interaction defects:** Enter in the instructions textarea started a run,
      two `setTimeout`s were untracked, `validationTimer` was dead, and Ctrl+C was hijacked to
      "copy path" even with text selected. **(fixed `b695bcb`)** — the Enter handler ignores
      textareas, every timer is tracked and cleared through one owner, the dead field is gone,
      and the copy shortcut yields to a selection.
- [x] **M9 — Stacked modals** (see the Medium/Low entry above). **(fixed `b695bcb`)**
- [x] **M10 — The video preview refired a bare `fetch` on every keystroke** with no timeout,
      no abort and no de-dupe, so a stale response could overwrite the current preview.
      **(fixed `b695bcb`)** — it now goes through `requestUrl` under a 10s timeout with a
      monotonic request token that drops stale answers.
- [x] **M11 — Batch input had no de-dupe and no cap**: the same video in two URL forms ran
      twice, and a 200-line paste meant 200 paid AI runs. **(fixed `b695bcb`)** — URLs are
      de-duplicated on the extracted video id (first spelling wins) and capped at
      `MAX_BATCH_URLS` (50), with the dropped count reported back to the user.
- [x] **M12 — `environmentPrefix` was load-bearing but had no settings field**: an empty prefix
      failed validation, yet the value could only be changed by editing `data.json`.
      **(fixed `ca8aa11`)** — the prefix is a text field directly under the _Env Variables_
      toggle, and `.env.example` points at it.
- [x] **M13 — The modal was passed `defaultModel`/`defaultProvider`-style options it never
      read.** **(fixed `b695bcb`)** — dead parameters removed.
- [x] **M14 — Styling sat outside Obsidian's guidelines:** hardcoded `#ffa500`, no `@media`
      queries, and a `max-width: 500px !important` modal on a plugin that declares
      `isDesktopOnly: false`. **(partially fixed `8f3e1e3`)** — hardcoded colours moved to
      Obsidian CSS variables, the shared modal family moved to CSS classes, and a mobile
      breakpoint was added. The remaining 51 inline `style.*` writes are catalogued in
      [Remaining / deferred](#remaining--deferred).
- [x] **M15 — The extension's body-wide `MutationObserver` was never disconnected**, running six
      `querySelector`s per mutation batch for the life of the page, and retry chains shared a
      single budget. **(fixed `29ec2ad`)** — exactly one observer for the life of the script,
      disarmed as soon as the button sits on a stable URL, re-armed by `yt-navigate-finish` or
      a 1.5s watchdog; retry chains are per navigation. The zero-permission claim is unchanged.
- [x] **M16 — Docs drift** (README and user manual said caption-less videos produce no note;
      test counts stale; AUDIT listed fixed items as open). **(fixed this pass)** — this
      document, `README.md`, `USER_MANUAL.md`, `CLAUDE.md` and `.env.example` were rewritten
      against source on 2026-09-07.
- [x] **M17 — Test-suite shape.** **(fixed this pass)** — all three remaining
      `processAIResponse` formats are spec'd end-to-end, the obsidian mock now implements the
      full DataAdapter/Vault surface over an in-memory store (obsidian-file went 7% → 98%
      covered), stale fixtures compile again, and the single global floor was replaced with
      per-directory thresholds. Snapshot: **16 suites / 408 tests**.
- [x] **M18 — CI gaps:** no concurrency group, the extension ZIP was never built in CI, codecov
      could never fail the build, and the version bump was never smoke-tested. **(fixed
      `134b117`)** — a `concurrency` group cancels superseded runs, a `package-extension` job
      builds and validates the ZIP (non-empty, `manifest.json` at the archive root), codecov
      is explicitly non-blocking with the reason recorded, and the test job dry-runs
      `version-bump.mjs` and asserts it produces no diff.

### Low (from the same audit)

- [x] `data.json` was logged verbatim at debug level. **(fixed `e979b38`)** — a
      `redactPluginData` summary logs which credentials are set and the names (never the
      values) of everything else.
- [x] Ollama echoed the server-controlled HTTP reason phrase, and `error-handler.ts`
      interpolated `statusText` unsanitized. **(fixed `b509f48`)** — both route through
      `sanitizeRemoteMessage`.
- [x] Innertube's ANDROID `clientVersion` was a bare hardcoded string that would eventually
      stop working silently. **(fixed `e979b38`)** — pinned as
      `INNERTUBE_ANDROID_CLIENT_VERSION` with a warn log telling the next reader to bump it,
      and the caption `baseUrl` fetch is host-allowlisted.
- [x] Per-request generation parameters. **(fixed `bbab0b1`, `e979b38`)** — `maxTokens` and
      `temperature` travel on `AIRequestOptions`, so concurrent runs can no longer clobber the
      shared provider singletons.

## Remaining / deferred

Everything still open, re-verified on 2026-09-07 against `main` @ `134b117`. Ordered by how
much it matters.

- **Token-level streaming (deferred, deliberate).** `AIProvider.process` is
  `Promise<string>`, so output arrives all at once. The stage checklist
  (metadata → transcript → AI → save) is the interim UX. Adding streaming means changing the
  provider interface and every client.
- **ESLint 8 → 9 flat config (deferred, deliberate).** `eslint@^8.57.0` with `.eslintrc.js`.
  ESLint 8 is EOL; the migration touches the config format and the `indent`-vs-prettier
  settlement recorded in the conventions above. Not undertaken in either pass.
- **TypeScript is still 5.3.3.** A 5.x bump is mechanical but wide (ts-jest + the test
  tsconfig) and was deliberately not bundled with a correctness pass.
- **(low) `setApiKey` field-name masking is a dead path.** `SecureConfigService.setApiKey`
  calls `validator.validateKeyFormat(keyType, key)`, whose provider-specific patterns key off
  a field name that never matches the ones it is handed — so the format check silently passes
  everything through. Harmless today (the settings tab does its own prefix check, and
  `keyFormatWarning` is the enforced rule), but it is code that looks like a gate and is not.
- **(smell) `MemoryCacheService` evicts FIFO, not LRU**, and its entries can hold 150k-char
  transcripts — worst case roughly 15 MB resident. Bounded, but the wrong thing is evicted
  under pressure.
- **(smell) 51 inline `style.*` writes remain** across `youtube-url-modal.ts` (40) and
  `settings-tab.ts` (11), counted on 2026-09-07. The hardcoded colours, the shared modal
  classes and the mobile breakpoint are done; what is left is the mechanical migration of
  these writes into `styles.css`.
- **(smell) Three parallel error-formatting systems** — `src/services/error-handler.ts`
  (~350 lines), `src/ai/error-utils.ts` (free functions), and per-provider `handleAPIError`
  methods. Consolidation is behavior-sensitive (copy changes); flagged, not auto-applied.
- **(med) Critical-path test coverage is better and still not complete.** As of the
  2026-09-09 snapshot: **16 suites / 430 tests**, including the `processYouTubeVideo`
  pipeline, all six providers, provider network-error wording, and the Gemini text-only
  overflow retry. Still untested: `obsidian-file.ts` (save/conflict/path
  sanitization), `video-data.ts` metadata, and `settings-tab.ts`.
- **(verification, not code) The extension has not been manually exercised on
  music.youtube.com or a real `/live/` stream.** The selectors, normalisation and observer
  lifecycle are in place and code-reviewed; a human still needs to click through them before
  the next store upload.
- **API-key rotation reminder:** the metadata subsystem in `src/secure-config.ts` remains
  write-only localStorage bookkeeping — harmless, intentionally left alone.

Found during the provider-fallback pass (2026-09-09, deferred):

- **(dead setting) `preferMultimodal`** (`src/types.ts`, toggle in the settings tab) is never
  read by any provider — Gemini decides purely from the curated `supportsAudioVideo` flags plus
  a loose model-name regex. Either wire it into `createRequestBody` or remove the toggle.
- **(smell) Gemini's multimodal gating regex** (`src/ai/gemini.ts`,
  `/^gemini-(1\.5|2\.\d|flash|pro)/`) over-matches future/unknown model ids and will attach a
  `fileData` part to models that cannot ingest video. The text-only retry added in this pass
  rescues only token-overflow 400s; a capability 400 still fails the provider.
- **(gap) Hugging Face has no `listModels`**, so `fetchLatestModelsForProvider` returns the
  static curated list and the model dropdown cannot be refreshed against what hf-inference
  actually serves — the curated list goes stale and users hit the "not deployed" 400.
  **(fixed 2026-09-09, branch fix/provider-fallback-resilience)** — hf-inference stopped
  serving text-generation models entirely, so the provider was rewired to HF's
  OpenAI-compatible router (`/v1/chat/completions`, verified end-to-end), `listModels()`
  added against `/v1/models` filtered to `status: "live"` providers with text output, and
  the stale Groq/HF/Ollama-local defaults plus both curated lists were refreshed to live ids.
- **(smell) `ErrorHandler.handleEnhanced` can mask the aggregate failure Notice**: if any single
  provider reason contains a quota phrase, the notice degrades to a generic quota message.
  Swapping it for `ErrorHandler.handle` would fix that but loses the quota retry button.
  Flagged, not changed.

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

## Cleanup pipeline pass (2026-09-09, branch cleanup/pipeline-2026-09-09)

Second debloat pass, executed as units with the full test gate between each (baseline
16 suites / 440 tests → 16 suites / 430 tests; 10 low-value tests removed, 0 behavior
change intended). Net −853 lines across 8 units — see `.pipeline/refactor-plan.md` for
the per-item evidence.

Applied:

- error-handler dead second framework (~200 lines) + `ErrorHandlerInterface` (single impl).
- Dead settings knobs `enableParallelProcessing` (toggle removed from settings UI),
  `modelCacheTimestamps`; dead constants `PROVIDER_MODEL_LIST_URLS` / `PROVIDER_MODEL_REGEX` /
  `API_LIMITS`; dead `free:` model flag + UI-filter claim.
- Dead user-preferences API (6 methods, ~13 fields) incl. the never-written `lastModel_*`
  family the modal read dynamically; modal's never-true branch removed with them.
- Provider plumbing deduplicated on `BaseAIProvider` (`fetchModelIds`, `openAIChatBody`,
  default `extractContent`, `requireApiKey`, exported `extractRetryTime`).
- Silent `catch {}` blocks (12 sites) now `logger.warn` at minimum; `ErrorHandler.handle`
  logs its context; the model-refresh catches in `main.ts` were found to be _reachable_
  (they also guard `saveSettings`) and kept with logging added.
- Same-file dedups: `formatDuration` → `formatTimestamp`; `nextAvailablePath` extracted for
  `createVersionedCopy`; dead `createUniqueFile` (test-only) deleted with its test.
- ~30 restating comments removed; dead fixtures moved to `trash2review/`
  (`settings.fixtures.ts`, `MOCK_API_RESPONSES`, `MOCK_TRANSCRIPTS`, 6 helper exports);
  `DEFAULT_SETTINGS` inlined into `test-helpers.ts` (keep in sync with `main.ts`);
  `trash2review` excluded from tsconfig.
- Two scanner claims corrected during verification: `ModalManager.getState()` is live
  (debug-log field in `safeShowUrlModal`), and `getSmartDefaultPerformanceSettings` is live
  (modal pre-select) — both kept despite being flagged dead.

Carried items from this pass (flagged, not applied):

- `preferMultimodal` toggle + the never-dispatched `processWithImage` path: wire or remove
  (decision needed; the toggle still exists in settings but does nothing).
- Reusing `isNetworkFailure`/`isTimeoutAbort` inside Ollama/HF/video-data classification was
  NOT applied: the shared helpers match a narrower set than the hand-rolled keyword lists, so
  untested error paths would change user-facing copy.
- API-key knowledge still triplicated (`validation.ts` KEY_FORMATS vs `secure-config.ts`
  PATTERNS/KNOWN_KEY_PREFIXES vs the settings-tab reset field list); unifying on
  `validation.ts` is behavior-adjacent and needs a deliberate regex-strictness decision.
- `withTimeout` still exists twice (youtube-page with signal, youtube-modal-utils without);
  merging couples a DOM module to a network module — intentionally left.
- secure-config metadata subsystem, duplicate key-format validators, per-provider HTTP-status
  handling: unchanged from the carried list above.

---

## Blind review reconciliation (2026-09-09)

A context-blind cold review (sanitized dispatch — no knowledge of this audit or the
cleanup work; report verbatim at `.pipeline/blind-review.md`) reviewed the repo
independently. Reconciliation:

**Corroborated by both (higher confidence):**

- Modal slot wedges permanently if `modal.open()` throws (main.ts:434-438) — both found it.
- Dead quota Retry button dispatching an event with no listener, inside a
  never-auto-dismissing Notice (error-handler.ts:54-70).
- Cancelled run can still write the note: `assertLive()` is not re-checked across the
  indefinite `FileConflictModal` await (main.ts:695, obsidian-file.ts:93-112).
- settings-tab.ts and the modal are the largest untested surfaces; coverage floors gate
  lines-only; prettier is enforced nowhere in CI.

**Missed by pipeline, caught by blind review — verified real, added to the fix list:**

- [HIGH] `src/settings-tab.ts:579-586` + `src/secure-config.ts:402-434` — **"Clear Keys"
  is a silent no-op**: the service wraps a shallow _copy_ of plugin settings
  (settings-tab.ts:46/57), the cleared keys are written to that copy and never persisted,
  and `display()` re-copies the untouched original. The UI shows keys cleared; data.json
  still holds all five until restart. Security-relevant (this is the control the
  env-mode guidance tells users to use).
- [HIGH] `src/components/features/youtube/youtube-url-modal.ts:387-393` — provider
  dropdown is hardcoded to five entries and **omits Hugging Face**, though HF is a
  first-class provider; the modal's `providers` option (main.ts:374/382) is populated
  and never read. A users-with-only-HF-key run fabricates a "Google Gemini not found"
  failure before the chain recovers.
- [MEDIUM] Masked-key prefill can commit the mask as a real credential
  (settings-tab.ts:296-303): `isMasked()` exists (secure-config.ts:269) and is never
  called; HF/OpenRouter/Ollama have no key pattern to reject the mask.
- [MEDIUM] Gemini reads only `parts[0].text` and never checks `finishReason === 'MAX_TOKENS'`
  (gemini.ts:86-101,229-232): multi-part answers silently truncated, thought-block first
  parts fail, and token-truncated notes are reported as success.
- [MEDIUM] `window.prompt` throws in Electron (main.ts:329) — the clipboard command's
  manual-entry fallback always fails on desktop; `confirm()` (settings-tab.ts:581) likewise
  deprecated.
- [MEDIUM] Key migration can overwrite a real base64-shaped key with XOR garbage
  (secure-config.ts:295-358) and save it — narrow but silent credential destruction.
- [LOW] Ctrl+C in the modal swallows textarea selections (youtube-url-modal.ts:964-974,
  modal-utils.ts:240-243); file watcher reads full file contents per create/tab-switch
  event before cheap filters (url-handler.ts:209,259); user's deliberate "don't save" is
  reported as an error (obsidian-file.ts:106); `AbortSignal.timeout` fallback gap leaves
  generation unbounded on runtimes without it (error-utils.ts:45-57); Ollama Cloud key is
  forwarded to whatever `ollamaEndpoint` is configured (service-container.ts:85-92);
  further dead surface (`setModelParameters`, `SecureKeyStorage` metadata,
  `expectedSections` + the `validateFormatStructure` no-op section check); CLAUDE.md
  version drift (says 2.1.0; manifest is 2.2.0).

**Disagreement, resolved rather than averaged:**

- The blind review concluded "nothing in the note-writing path loses user data" and
  rated the data.json lock as sound. The pipeline's blocker — `saveSettings()` writing
  the stale load-time history snapshot (main.ts:908-913) — is precisely a data-loss case
  the cold review missed (it saw the lock serialize writers but not the stale payload).
  The blocker stands: it was verified directly against the code before this review ran.

**Honest limit:** the blind reviewer runs on the same underlying model as the pipeline,
so this pass removes self-grading and framing bias but not shared model blind spots. The
strongest remaining signal would be a human review, or a brand-new session unconnected
to this one, running the same cold review.

**Updated verdict:** still **Ready with fixes**, with the fix list now including the two
blind-review HIGHs above — the credential-clear no-op lands in the same
settings-tab-untested bucket the review called out as its top on-call concern.
