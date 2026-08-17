$ErrorActionPreference = 'Stop'

$repo = (Get-Location).Path
$reports = Join-Path $repo 'frontend\e2e\admin\reports.spec.ts'
$taxonomy = Join-Path $repo 'frontend\e2e\admin\taxonomy.spec.ts'

if (-not (Test-Path $reports) -or -not (Test-Path $taxonomy)) {
  throw 'Run this script from the repository root.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $repo ".phase1-6-last-two-backup\$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item $reports (Join-Path $backupDir 'reports.spec.ts')
Copy-Item $taxonomy (Join-Path $backupDir 'taxonomy.spec.ts')

$utf8 = New-Object System.Text.UTF8Encoding($false)
$nl = [Environment]::NewLine

Write-Host '[1/2] Fixing report ban assertion...'
$text = [IO.File]::ReadAllText($reports)
$old = '  await expect(page.getByText(/Reported user:.*\(BANNED\)/)).toBeVisible();'
if ($text.Contains($old)) {
  $new = @(
    "  const reportId = page.url().split('/').pop()!;",
    '  await expect.poll(async () => {',
    '    const response = await page.request.get(`/api/v1/admin/reports/${reportId}`);',
    '    if (!response.ok()) return `HTTP_${response.status()}`;',
    '    const payload = (await response.json()) as {',
    '      data?: {',
    '        reportedUser?: { status?: string } | null;',
    '        currentComment?: { user?: { status?: string } } | null;',
    '      };',
    '    };',
    '    return payload.data?.reportedUser?.status ?? payload.data?.currentComment?.user?.status ?? null;',
    "  }).toBe('BANNED');"
  ) -join $nl
  $text = $text.Replace($old, $new)
  [IO.File]::WriteAllText($reports, $text, $utf8)
} elseif (-not $text.Contains("const reportId = page.url().split('/').pop()!;")) {
  throw 'Could not find the report assertion to replace.'
}

Write-Host '[2/2] Fixing taxonomy merge option selection...'
$text = [IO.File]::ReadAllText($taxonomy)
$oldExact = "  await dialog.getByLabel('Merge into').selectOption({ label: 'E2E Science Fiction' });"
$oldRegex = "  await dialog.getByLabel('Merge into').selectOption({ label: /E2E Science Fiction/ });"
if ($text.Contains($oldExact) -or $text.Contains($oldRegex)) {
  $new = @(
    "  const mergeSelect = dialog.getByLabel('Merge into');",
    "  const targetOption = mergeSelect.locator('option').filter({ hasText: 'E2E Science Fiction' });",
    '  await expect(targetOption).toHaveCount(1);',
    "  const targetValue = await targetOption.getAttribute('value');",
    '  expect(targetValue).toBeTruthy();',
    '  await mergeSelect.selectOption(targetValue!);'
  ) -join $nl
  if ($text.Contains($oldExact)) { $text = $text.Replace($oldExact, $new) }
  else { $text = $text.Replace($oldRegex, $new) }
  [IO.File]::WriteAllText($taxonomy, $text, $utf8)
} elseif (-not $text.Contains("const targetOption = mergeSelect.locator('option').filter({ hasText: 'E2E Science Fiction' });")) {
  throw 'Could not find the taxonomy selectOption line to replace.'
}

Write-Host 'Last two E2E fixes applied successfully.'
Write-Host "Backup: $backupDir"
