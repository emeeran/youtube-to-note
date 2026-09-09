# trash2review — holding pen, not a deletion

Files here were moved by the cleanup pipeline because they looked redundant. **Nothing is
deleted.** Review each file, then either restore it or remove it by hand.

## Restore a file

```bash
git mv trash2review/<mirrored-path> <original-path>
git commit -m "restore: <original-path> (false positive in cleanup pipeline)"
```

Each entry's original path is the path under `trash2review/` with the leading
`trash2review/` stripped. The reason it was moved is logged in
`.pipeline/purge-plan.md`.
