#!/usr/bin/env bash
# Create a review branch in a NEW clone. Never touches the existing export folder.
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_REPO="${1:?Usage: bash tools/prepare_review.sh /absolute/path/to/new-review-clone}"
if [[ "$TARGET_REPO" != /* || -e "$TARGET_REPO" ]]; then
  echo 'The destination must be a new, absolute path that does not already exist.' >&2
  exit 1
fi
if [[ ! -f "$SOURCE_ROOT/content/site.json" || ! -f "$SOURCE_ROOT/templates/base.html" ]]; then
  echo 'Replacement source files are missing.' >&2
  exit 1
fi

git clone --branch main https://github.com/zioico/site.git "$TARGET_REPO"
git -C "$TARGET_REPO" switch -c clean-static-rebuild
# This destination was freshly cloned above; removing superseded files is reversible in Git.
rsync -a --delete --exclude='.git/' --exclude='dist/' --exclude='.private/' \
  --exclude='.env' --exclude='.env.*' --exclude='__pycache__/' --exclude='.DS_Store' \
  "$SOURCE_ROOT/" "$TARGET_REPO/"
cd "$TARGET_REPO"
python3 tools/build.py
python3 tools/build.py --output dist
python3 tools/check_site.py dist
git add -A
git status --short
git diff --cached --stat
echo "Review branch prepared at: $TARGET_REPO"
echo 'No commit or push was made. Review, commit, and push when ready.'
