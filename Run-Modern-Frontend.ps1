[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 4200,
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$BuildOnly
)

$parameters = @{
    ProjectRoot = $PSScriptRoot
    Port = $Port
    SkipInstall = $SkipInstall
    SkipBuild = $SkipBuild
    BuildOnly = $BuildOnly
}

$runner = Join-Path $PSScriptRoot 'frontend\Run-Modern-Frontend-OneShot.ps1'
& $runner @parameters
exit $LASTEXITCODE
