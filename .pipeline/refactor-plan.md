# Phase 2 — Debloat & Refactor (dry-run plan)

Generated 2026-08-05. **No edits made yet.** Every Tier-1 item is verified dead
code or behavior-preserving dedup. Tier-2 items change or might change behavior
and are flagged for `AUDIT.md` instead of applied.

## Tier 1 — Safe (apply on `--apply`)

### A1. Dead file: `src/types/result.ts`

- **Evidence:** `Result`/`Ok`/`Err`/`tryCatch`/`all` are imported nowhere (the
  `UrlDetectionResult` hit in `main.ts` is an unrelated type). Self-referential only.
- **Action:** `git mv src/types/result.ts trash2review/src/types/result.ts`.

### A2. Dead methods (each referenced only by its own definer — grep-verified)

| File                                                   | Symbol                                                   | Why dead                                                             |
| ------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/ai/base.ts`                                       | `processWithTimeout()`                                   | No caller anywhere.                                                  |
| `src/secure-config.ts`                                 | `SecureKeyStorage.isObfuscated()`                        | Obsolete after the plaintext-key resolver replaced its only callers. |
| `src/secure-config.ts`                                 | `SecureConfigService.getRotationRecommendations()`       | Definer-only; the only reader of the metadata subsystem.             |
| `src/secure-config.ts`                                 | `SecureConfigService.validateSecurityConfiguration()`    | Definer-only.                                                        |
| `src/secure-config.ts`                                 | `SecureConfigService.getEnvironmentTemplate()`           | Definer-only; ~55-line template string never shown.                  |
| `src/secure-config.ts`                                 | `SecureConfigService.exportSafeSettings()`               | Definer-only.                                                        |
| `src/ai/ollama.ts`                                     | `checkAvailability()`, `checkModelAvailability()`        | No caller.                                                           |
| `src/components/features/youtube/youtube-url-modal.ts` | field `fetchInProgress`, method `updateProviderStatus()` | Never read / never called.                                           |

- **Action:** delete each symbol. No import breaks (verified: none are referenced).
- **Net:** ~150 lines removed, no behavior change.

### A3. Duplicated Ollama error handling

- `src/ai/ollama.ts`: `process()` and `processWithImage()` repeat the same
  401/404/500 status handling (~30 lines) **and** the same network-error
  classification (`fetch`/`network`/`ECONNREFUSED`/`ENOTFOUND`, ~12 lines).
- **Action:** extract `private async handleOllamaStatus(response): Promise<void>`
  and `private classifyNetworkError(error): Error`; call from both methods.
  Identical error strings preserved — pure dedup, no behavior change.
- **Net:** ~40 lines removed.

### A4. Restate-the-code comment noise (small)

Remove comments that duplicate the line below, e.g. `// Validate inputs` above
`if (!prompt)`, `// Check expiration` above the TTL check. Keep "why" comments.
~5 spots. (No behavior change.)

## Tier 2 — Judgment → flag in `AUDIT.md`, do NOT apply here

- **B1. secure-config metadata subsystem** (`storeMetadata`, `getAllMetadata`,
  `clearMetadata`, `clearAllMetadata`, `APIKeyMetadata`). After A2 removes the
  only reader (`getRotationRecommendations`), these writes to `localStorage`
  become write-only dead state — but they sit inside `setApiKey`/`clearApiKey`,
  so removing them is more invasive. Flag; safe to remove later but not in this pass.
- **B2. Single-impl interfaces** `DOMUtilsInterface` and `ErrorHandlerInterface`
  (`src/types.ts`) — used only as `implements` on their one implementation. Removing
  them is cosmetic and opinionated; left for the human.
- **B3. Duplicate API-key validation** — `ValidationUtils.isValidAPIKey`
  (`src/validation.ts`) vs `APIKeyValidator.validateKeyFormat`
  (`src/secure-config.ts`). Two different validators for the same thing;
  consolidation changes which checks run where. Flag.
- **B4. Per-provider HTTP-status handling** — Gemini/Groq/OpenRouter/HuggingFace
  each hand-roll 401/404/429 branches with provider-specific copy. Consolidating
  via `base.handleAPIError` templates is behavior-sensitive (messages change).
  Flag.

## Verification plan (on `--apply`)

After each of A1–A4: `npx tsc --noEmit`, `npx jest`, `npm run build`. If any
step regresses, revert that item immediately and log it here as a false positive.

## Applied (2026-08-05)

Tier 1 applied in full. Verification after each batch: tsc OK, 71/71 tests pass,
build OK, eslint 0 errors. Net **-541 lines across 10 files**, no behavior change.

- A1: `src/types/result.ts` → `trash2review/` (fully dead Result type).
- A2: removed `processWithTimeout` (base), `isObfuscated` + `validateSecurityConfiguration`
    - `getRotationRecommendations` + `getEnvironmentTemplate` + `exportSafeSettings`
    - `checkKeyHealth` (secure-config — the last four were only reachable via the removed
      `validateSecurityConfiguration`/`getRotationRecommendations`), Ollama
      `checkAvailability`/`checkModelAvailability`, modal `fetchInProgress`/`updateProviderStatus`
    - write-only `providerStatusEl` field.
- A3: extracted `throwIfOllamaError` / `describeModelNotFound` / `describeAuthFailure`
  / `isCloudModel` / `asNetworkError` in OllamaProvider; `process` and `processWithImage`
  now share them (identical error strings preserved).
- A4: dropped restate-the-code comments in gemini.ts and memory-cache.ts. (Ollama's were
  removed by the A3 rewrite; url-handler `// Extract URL` markers left as section dividers.)

Carried forward to `AUDIT.md` (Tier 2, not applied): write-only metadata subsystem
(`storeMetadata`/`getAllMetadata`/`clearMetadata`/`clearAllMetadata`/`APIKeyMetadata`);
orphaned exported `SecurityValidationResult` interface; single-impl
`DOMUtilsInterface`/`ErrorHandlerInterface`; duplicate API-key validation
(`isValidAPIKey` vs `validateKeyFormat`); per-provider HTTP-status handling.
