param(
  [string]$PatchPath = ".\phase1-6-e2e-regression-fixes.patch"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path ".\backend\package.json") -or -not (Test-Path ".\frontend\package.json")) {
  throw "Hãy chạy script này tại root repo (thư mục có backend và frontend)."
}

if (-not (Test-Path $PatchPath)) {
  throw "Không tìm thấy patch: $PatchPath"
}

Write-Host "[1/2] Kiểm tra patch..."
git apply --check --ignore-space-change --ignore-whitespace $PatchPath
if ($LASTEXITCODE -ne 0) {
  throw "git apply --check thất bại. Kiểm tra git diff/status và bảo đảm Phase 1-6 đã được áp dụng."
}

Write-Host "[2/2] Apply patch..."
git apply --ignore-space-change --ignore-whitespace $PatchPath
if ($LASTEXITCODE -ne 0) {
  throw "git apply thất bại."
}

Write-Host "Đã apply E2E regression fixes."
Write-Host "Tiếp theo chạy format, seed admin 2 lần, rồi rerun các spec fail."
