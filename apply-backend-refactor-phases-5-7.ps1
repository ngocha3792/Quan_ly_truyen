param(
  [Parameter(Position=0)]
  [string]$RepoPath = ".",

  [Parameter(Position=1)]
  [string]$PatchPath = "$PSScriptRoot\backend-refactor-phases-5-7-after-phase4.patch"
)

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path $RepoPath).Path
$patch = (Resolve-Path $PatchPath).Path

Write-Host "Repo : $repo"
Write-Host "Patch: $patch"

Push-Location $repo
try {
  if (-not (Test-Path ".git")) {
    throw "Thu muc nay khong phai Git repo: $repo"
  }

  # Patch nay bat dau tu trang thai sau Phase 1-4.
  if (-not (Test-Path "backend\src\modules\ratings")) {
    throw "Khong thay RatingsModule. Repo co ve chua apply Phase 1-4. Dung patch 1-4 truoc."
  }
  if (-not (Test-Path "backend\src\modules\libraries")) {
    throw "Khong thay LibrariesModule. Repo co ve chua apply Phase 1-4."
  }
  if (-not (Test-Path "backend\src\modules\reading-history")) {
    throw "Khong thay ReadingHistoryModule. Repo co ve chua apply Phase 1-4."
  }

  # Comments phai CHUA duoc tach: cac handler comment van con trong stories.
  if (-not (Test-Path "backend\src\modules\stories\application\commands\create-story-comment")) {
    throw "Khong thay create-story-comment trong StoriesModule. Phase 5 co the da duoc apply; dung patch khac phu hop voi trang thai repo."
  }

  # Chapters phai CHUA duoc tach.
  if (Test-Path "backend\src\modules\chapters") {
    throw "Da ton tai ChaptersModule. Khong apply patch 5-7 nay de tranh conflict."
  }

  Write-Host "Checking patch..." -ForegroundColor Cyan
  & git apply --check --whitespace=nowarn $patch
  if ($LASTEXITCODE -ne 0) {
    throw "git apply --check that bai. Khong co thay doi nao duoc apply."
  }

  Write-Host "Applying Phase 5-7..." -ForegroundColor Cyan
  & git apply --whitespace=nowarn $patch
  if ($LASTEXITCODE -ne 0) {
    throw "git apply that bai."
  }

  Write-Host "Applied thanh cong." -ForegroundColor Green
  Write-Host "Tiep theo chay:" -ForegroundColor Yellow
  Write-Host "  cd backend"
  Write-Host "  npm run architecture:check"
  Write-Host "  npm run build"
  Write-Host "  npm run test:stories:all"
  Write-Host "  npm run test:comments:integration"
}
finally {
  Pop-Location
}
