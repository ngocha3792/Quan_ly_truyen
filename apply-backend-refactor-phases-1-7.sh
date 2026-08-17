#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="$SCRIPT_DIR/backend-refactor-phases-1-7.patch"

if [[ ! -f "$PATCH_FILE" ]]; then
  echo "Không tìm thấy patch: $PATCH_FILE" >&2
  exit 1
fi

cd "$REPO_DIR"

if [[ ! -d backend || ! -f backend/package.json ]]; then
  echo "Thư mục '$REPO_DIR' không giống root repo Quan_ly_truyen." >&2
  exit 1
fi

if ! git apply --check "$PATCH_FILE"; then
  echo >&2
  echo "Patch Phase 1-7 không apply sạch." >&2
  echo "Patch này dành cho bản repo gốc trước khi apply các patch refactor trước đó." >&2
  exit 1
fi

git apply "$PATCH_FILE"

echo "Đã apply Phase 1-7."
cd backend
node scripts/architecture/check-boundaries.mjs

echo
echo "Tiếp theo chạy bằng đúng Node/npm version của repo:"
echo "  npm run build"
echo "  npm run test:stories:all"
echo "  npm run test:comments:integration"
