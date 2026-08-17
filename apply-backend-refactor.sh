#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="$SCRIPT_DIR/backend-refactor-phases-1-4.patch"

cd "$ROOT"

echo "[1/2] Checking patch..."
git apply --check "$PATCH_FILE"

echo "[2/2] Applying patch..."
git apply "$PATCH_FILE"

echo "Done. Next run: cd backend && npm run architecture:check && npm run build"
