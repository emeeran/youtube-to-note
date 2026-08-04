# trash2review

Holding pen for files the cleanup pipeline flagged as redundant, dead, or
superseded. **Nothing here is deleted** — each file was moved in with
`git mv`, so its history is intact. To restore one, move it back:

    git mv trash2review/<mirrored-path> <original-path>

The path under `trash2review/` mirrors the original path, so restores are
unambiguous (e.g. `trash2review/CC_review_290526.md` → `CC_review_290526.md`).

Review the entries (the move reasons are logged in `.pipeline/purge-plan.md`),
keep what you want by moving it back, and delete the rest once you're
satisfied. This folder is the pipeline's only "delete" surface — the pipeline
itself never `rm`s anything.
