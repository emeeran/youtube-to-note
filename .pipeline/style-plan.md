# Style Plan — dry run, 2026-09-09 (branch cleanup/pipeline-2026-09-09)

Detection first: prettier + eslint already gate every commit (0 errors, formatting clean
across `src/` **and** `tests/` — verified with `--check`), so "one formatting standard" is
already true. What follows is the full consistency sweep and the small set of real findings.

| Convention                                                | State                                                                                                                        | Action                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Formatting                                                | prettier + eslint gates, clean everywhere                                                                                    | none                                                                     |
| Emoji voice in UI/log strings                             | repo's intentional tone (CLAUDE.md pins it)                                                                                  | keep                                                                     |
| `Service`/`Handler`/`Utils`/`Manager` suffixes            | repo's established naming (CLAUDE.md pins it)                                                                                | keep                                                                     |
| Error-handling philosophy                                 | unified in Phase 2 Unit E: throw `Error` + `ErrorHandler` for user-facing, `null` only at fetch boundaries, every catch logs | none left                                                                |
| Docstring style                                           | dominant: one-line imperative summary, no tags (584 blocks); 3 stragglers use `@param` tags                                  | fix the 3                                                                |
| Import ordering                                           | de-facto loose (header JSDoc → imports), no enforced rule                                                                    | leave — imposing an order would be a new convention, not an existing one |
| Logger config knobs (`enableConsole`, `enableTimestamps`) | never varied outside constructor defaults                                                                                    | leave — generic infrastructure, not a dead feature knob; noted           |
| Extension (plain JS, no build)                            | deliberately unformatted/unlinted                                                                                            | leave — CLAUDE.md pins this                                              |

## Apply list

1. `src/main.ts` `processYouTubeVideo` JSDoc: 2 `@param` tags → prose line.
2. `src/video-data.ts` `getVideoData` JSDoc: `@param` tag → prose line.
3. `src/services/transcript-service.ts` `fetchTranscriptOutcome` JSDoc: `@param` tag → prose line.

After these, `grep -rn '@param\|@returns' src` returns zero — one docstring voice everywhere.
