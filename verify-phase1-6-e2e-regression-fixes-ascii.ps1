$ErrorActionPreference = 'Stop'

if (-not (Test-Path ".\\backend\\package.json") -or -not (Test-Path ".\\frontend\\package.json")) {
  throw "Run this script from the repository root (the folder containing backend and frontend)."
}

Write-Host "=== Format ==="
npm --prefix backend run format
if ($LASTEXITCODE -ne 0) { throw "Backend format failed" }
npm --prefix frontend run format
if ($LASTEXITCODE -ne 0) { throw "Frontend format failed" }

Write-Host "=== Seed idempotency regression ==="
npm --prefix backend run db:seed:e2e:admin
if ($LASTEXITCODE -ne 0) { throw "Admin E2E seed run 1 failed" }
npm --prefix backend run db:seed:e2e:admin
if ($LASTEXITCODE -ne 0) { throw "Admin E2E seed run 2 failed" }

Write-Host "=== Backend ready ==="
$ready = Invoke-RestMethod http://127.0.0.1:3000/api/v1/health/ready
$ready | ConvertTo-Json -Depth 8

Write-Host "=== Rerun previously failing Playwright specs ==="
npm --prefix frontend run e2e -- `
  e2e/public/author-profile-follow.spec.ts `
  e2e/public/comments.spec.ts `
  e2e/public/reader-analytics.spec.ts `
  e2e/admin/audit-logs.spec.ts `
  e2e/admin/reports.spec.ts `
  e2e/admin/stories.spec.ts `
  e2e/admin/taxonomy.spec.ts `
  e2e/admin/users.spec.ts
if ($LASTEXITCODE -ne 0) { throw "Targeted E2E regression suite failed" }

Write-Host "=== Targeted regression suite PASSED ==="
Write-Host "Now run the full suite: npm --prefix frontend run e2e"
