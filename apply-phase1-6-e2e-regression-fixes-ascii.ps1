param(
  [string]$PatchPath = ".\\phase1-6-e2e-regression-fixes.patch"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path ".\\backend\\package.json") -or -not (Test-Path ".\\frontend\\package.json")) {
  throw "Run this script from the repository root (the folder containing backend and frontend)."
}

if (-not (Test-Path $PatchPath)) {
  throw "Patch file not found: $PatchPath"
}

Write-Host "[1/2] Checking patch..."
git apply --check --ignore-space-change --ignore-whitespace $PatchPath
if ($LASTEXITCODE -ne 0) {
  throw "git apply --check failed. Check git status/diff and confirm Phases 1-6 are already applied."
}

Write-Host "[2/2] Applying patch..."
git apply --ignore-space-change --ignore-whitespace $PatchPath
if ($LASTEXITCODE -ne 0) {
  throw "git apply failed."
}

Write-Host "E2E regression fixes applied successfully."
Write-Host "Next: run format, seed admin twice, then rerun the previously failing specs."
