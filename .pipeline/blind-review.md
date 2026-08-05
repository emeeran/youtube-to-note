# Phase 5 — Blind Review (verbatim)

**How this was produced:** a fresh subagent was dispatched with a sanitized prompt —
framed as an ordinary "due-diligence review before taking on-call," with **no mention**
of this cleanup pipeline, its phases, `trash2review`, `debloat`, or that any refactor had
occurred. Its full output is below, unedited by the main thread.

## Honest limits (read first)

1. **Same model.** This subagent runs on the same underlying model as the rest of the
   pipeline. A sanitized, context-blind pass removes _self-grading bias_ and _framing
   bias_ (both real and both fixed by sanitizing the prompt), but it does **not** remove
   blind spots the model has regardless of context. For a genuinely independent signal,
   paste a sample of the finished code into a brand-new session (fresh terminal,
   different reviewer's eyes) and ask the same cold-review question.
2. **`AUDIT.md` was already committed before this phase ran**, so it was present in the
   file tree and the reviewer found and read it. That is a real contamination of the
   "blind" aspect — the reviewer had the answer key available. Mitigating factors: the
   reviewer states it independently re-verified every claim against the source rather than
   taking `AUDIT.md`'s word, **and** it surfaced findings `AUDIT.md` does not contain
   (see reconciliation in `AUDIT.md` → "Missed by pipeline, caught by blind review"). Those
   net-new findings are the strongest signal this phase produced. Lesson for next time:
   run the blind review _before_ committing the audit doc, or exclude it from the review
   scope.

---

## Verbatim review output

# Senior Engineer Review — YouTube-to-Note Obsidian Plugin

**Scope reviewed:** Full source tree under `{src,extension,tests,.husky}`, read directly
(not name-guessed). I also found and cross-checked an existing `AUDIT.md` dated
2026-08-05; every claim below I verified against the code myself rather than taking that
file's word.

Note up front: there is already an `AUDIT.md` in the repo whose findings overlap
substantially with mine. I will not restate its wording, but I have independently
re-verified each item I list and call out where my reading differs.

### Blockers (correctness / security — fix before any release)

**B1. Husky hooks swallow every failure — quality gates are theater.**
`.husky/pre-commit:4-10` and `.husky/pre-push:2` wrap lint, type-check, and tests in
`2>/dev/null || echo "...skipped"` and `|| echo "Tests failed - pushing anyway"`. No
commit or push is ever blocked. This is almost certainly how known-bad code has been
landing. Severity: blocker (process). Fix: drop the suppression and let the hook exit
non-zero on failure.

**B2. Gemini API key leaked via URL query string in settings "Test" button.**
`src/settings-tab.ts:154`: `fetch(\`...?key=${key}\`)`. The production provider uses the
`x-goog-api-key` header (`src/ai/gemini.ts:101`); the settings validator regressed and
leaks the key into proxy logs, browser history, and Referer. Severity: blocker (security).
Fix: `fetch(url, { headers: { 'x-goog-api-key': key } })`.

**B3. `timerInterval` leak when modal closes mid-processing.**
`youtube-url-modal.ts:887` starts a 100ms `setInterval`, cleared in `showCompletionState`/
`showErrorState` but **not** in `onClose` (1041–1046). Esc/X/Cancel during an in-flight AI
call leaves the interval firing against a destroyed DOM forever; each cycle compounds.
Severity: blocker (leak). Fix: `clearInterval(timerInterval)` in `onClose`.

**B4. `processWith` permanently mutates the shared provider's model.**
`src/services/ai-service.ts:56-58` calls `provider.setModel(overrideModel)` and never
restores it. Providers are singletons; after one override run, every subsequent `process()`
— including the fallback iteration in the same call (line 73) and concurrent callers — uses
the previously selected model. Severity: blocker (correctness). Fix: capture/restore in
try/finally, or pass the model through `process(prompt, { model })`.

### High

**H1. Background promise mutates a returned-and-cached object.**
`src/video-data.ts:80-90` — `getVideoData` returns `result` and caches it, then a
`checkTranscriptAvailability` promise writes `result.hasTranscript` on the same reference
the caller holds and re-caches by reference. Callers see inconsistent state. Severity: high
(race). Fix: cache `{ ...result, hasTranscript }`.

**H2. No timeout on most `fetch()` calls.**
`_timeout` exists in `BaseAIProvider` but only HuggingFace wires it to an AbortController.
Gemini, Groq, OpenRouter, Ollama `process()` and every `listModels()` have no timeout.
`PAGE_TIMEOUT_MS`/`CAPTION_TIMEOUT_MS` in `youtube-page.ts` are exported but never applied.
Severity: high (operational). Fix: `AbortSignal.timeout(this._timeout)` on every fetch.

**H3. Processing history clobbers settings via unsynchronized read-modify-write.**
`processing-history.ts:66-74` — `save()` does `loadData()`+merge+`saveData()` against the
whole `data.json` with no mutex vs `main.ts saveSettings()`. A late history write silently
reverts settings (and vice versa). Severity: high (data loss). Fix: write mutex or separate
storage key.

**H4. Remote-controlled error text reaches users in three paths** bypassing
`sanitizeRemoteMessage`: `gemini.ts:36` (400 body), `huggingface.ts:84,97,110` (via
`formatHuggingFaceError`), `error-handler.ts:188,196-207` (`handleAPIError` details).
Severity: high (injection, low-impact). Fix: route each through `sanitizeRemoteMessage`.

**H5. Unsanitized title interpolated into YAML frontmatter and HTML attribute.**
`src/templates/index.ts:44,75` — the video title (network-controlled) is spliced raw into
`title: ${title}` (YAML) and `title="${title}"` (iframe attribute). A title containing `"`
or `:` produces malformed frontmatter or breaks out of the HTML attribute. Severity: high
(correctness/injection). Fix: YAML-quote (`JSON.stringify(title)`) and HTML-attribute-escape.

**H6. Plugin version is hardcoded and inconsistent.**
`main.ts:17` `PLUGIN_VERSION = '1.3.5'`; line 64 overwrites `this.manifest.version` with it.
`manifest.json`/`package.json` say 2.0.0. Telemetry/version-gating inconsistent. Severity:
high (operational). Fix: read `this.manifest.version`.

### Medium

**M1. `extension/chrome-extension/helper/server.js` is dead code shipped with the repo.**
Express server with `Access-Control-Allow-Origin: *`, optional `X-CLIPPER-TOKEN` auth, and
arbitrary file append to a path built from env vars. Zero consumers — the content script
uses the `obsidian://` protocol handler directly. 76-line attack surface doing nothing.
Severity: medium (security/dead-code). Fix: delete `helper/` (or `trash2review`).

**M2. `trash2review/` and staged review docs ship in the plugin folder.** Contains a prior
`CC_review_290526.md`, partial source, scripts, old README. None belongs in a shipped
plugin or on `main`. Severity: medium (hygiene/leakage). Fix: remove before release.

**M3. `tests/integration/pipeline.spec.ts` is 7 `expect(true).toBe(true)` stubs.** Zero
coverage, inflates the count; never noticed because of B1. Severity: medium (testing).

**M4. Critical-path modules have no tests.** Real coverage ≈ 5 of ~15 modules. Untested:
`processYouTubeVideo`, `prompt-service.ts`, `obsidian-file.ts` (incl. the `..` guard at
`obsidian-file.ts:194` — specifically worth a test), all 6 providers, `secure-config.ts`
legacy migration, `video-data.ts`. Severity: medium (testing).

**M5. `ensureDirectoryExists` swallows all errors.** `obsidian-file.ts:70-76` hides
permission/path failures behind "might already exist." Severity: medium (debuggability).

**M6. Dead `customTimeouts` setting and dead secure-config metadata subsystem.**
`types.ts:21` never read; `secure-config.ts:137-187` write-only after the rotation
recommender was removed. Severity: medium (dead code).

**M7. Unpinned `obsidian` dev dependency.** `package.json:43` `"obsidian": "latest"` —
`npm ci` not reproducible. Severity: medium (reproducibility).

**M8. No graceful cancellation of in-flight AI requests on unload.** `main.ts:383` checks
`isUnloading` at the top only. Severity: medium (operational).

### Low

- `url-handler.ts:306-308` protocol `setTimeout(...,200)` deferral with no comment; logs
  raw `params` with no length cap (313).
- `handleSettingsChange` clears services while a concurrent in-flight request holds the old
  reference; benign but uncommented.
- Modal has many `innerHTML =` (all static today, fragile if templated).
- `content_script.js:49` button SVG via `innerHTML` (hardcoded).
- `jest ^29.7.0` paired with `jest-environment-jsdom ^30.2.0` — major-version mismatch.

### AI-generated / over-engineering smells

- `secure-config.ts` (~470 lines) is the strongest tell — plaintext storage wrapped in an
  identity `obfuscateKey`, a write-only metadata subsystem, and three layers of indirection
  around `settings[field]`. Legacy de-obfuscation is the only real logic; could be ~30 lines.
- Single-implementation `interface`+`implements` DI boilerplate (`DOMUtilsInterface`,
  `ErrorHandlerInterface`, `CacheService`, `PromptService`, `FileService`, `VideoDataService`);
  `DOMUtils` has static _and_ instance methods that forward to the static ones.
- `error-handler.ts` (350 lines) duplicates logic already in provider `handleAPIError` and
  `error-utils.ts` — three parallel error-formatting systems.
- `pipeline.spec.ts` placeholders are a classic LLM stub.
- Curated model lists in `api.ts` are sprawling; some entries don't exist / are inconsistent.

### What's genuinely good

- `youtube-page.ts` is the best code in the repo — brace-balanced parser with string/escape
  handling, real tests for brace-in-string cases, accurate docs.
- Path-traversal guard (`obsidian-file.ts:194`) correctly rejects `..`.
- `textContent` used consistently for network strings in the modal preview.
- Ollama cleartext-HTTP-on-non-loopback warning is thoughtful and correct.
- `selectCaptionTrack` is well-reasoned (manual > ASR within language, English fallback).
- `sanitizeRemoteMessage` is the right idea (cap + control-char strip) — just under-applied.
- `MemoryCacheService` is small, correct, FIFO-evicting with metrics.
- `extractVideoId` cache does proper FIFO eviction.
- The `AUDIT.md` itself is disciplined self-review — prior author(s) found and accurately
  documented most issues.

### Consistency verdict

Does **not** read like one disciplined author. The YouTube/transcript layer is tight,
commented, well-tested — clearly the part someone cared about. The AI-provider layer and
`secure-config.ts` are over-abstracted and under-tested, with three parallel error systems
and write-only metadata. The modal is large/procedural with a timer-leak the careful author
of `youtube-page.ts` wouldn't leave. Visible seams.

### Overall verdict — would I take this on-call as-is?

**No, not as-is, but it's close.** Core happy path works, production security posture is
mostly correct (keys in headers, path-traversal guarded, preview uses `textContent`), and
the YouTube page parser is genuinely well-built. But four blockers (B1–B4) are each
individually disqualifying for a release: husky gates that don't gate, a key-leak regression
in settings, a forever-leaking timer, and shared-mutable provider state that silently
changes which model runs. Thin coverage means debugging by reading.

**Top 3 to fix first:**

1. Make the husky hooks actually fail (B1) — nothing else improves until quality gates work.
2. Fix B2, B3, B4 together — small, isolated (header transport, `clearInterval` in `onClose`,
   capture/restore `setModel`).
3. Stand up real tests for `obsidian-file.ts` (incl. the `..` guard), `secure-config.ts`
   legacy migration, and one end-to-end `processYouTubeVideo` test.
