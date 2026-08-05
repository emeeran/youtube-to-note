#!/usr/bin/env bash
# Package the Chrome extension into a Web-Store-uploadable ZIP.
# Output: dist/youtube-to-note-ext-<version>.zip  (gitignored; regenerable)
#
# Usage: npm run package:extension      (or: bash scripts/package-extension.sh)
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="extension/chrome-extension"
VERSION=$(node -e "console.log(require('./${SRC}/manifest.json').version)")
OUT="dist/youtube-to-note-ext-${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"

# Zip from inside the extension dir so manifest.json is at the ZIP root
# (the Web Store requires this). Exclude dotfiles / OS junk.
( cd "$SRC" && zip -r -q "$OLDPWD/$OUT" . -x ".*" -x "*/.*" )

echo "Packaged ${SRC} -> ${OUT}"
unzip -l "$OUT" | tail -n +4 | head -n -2 | awk '{print "  " $4}'
