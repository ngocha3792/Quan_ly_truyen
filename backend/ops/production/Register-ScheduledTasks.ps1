[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$MaintenanceTime = '02:00',
  [string]$BackupTime = '03:00',
  [string]$RestoreDrillTime = '04:00',
  [string]$RestoreDrillDay = 'Sunday',
  [string]$TaskPrefix = 'QuanLyTruyen'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
  throw 'This script registers Windows Scheduled Tasks only. Use ops/production/cron.example on Linux.'
}

$PowerShell = (Get-Command powershell.exe).Source
$MaintenanceScript = Join-Path $PSScriptRoot 'Invoke-Maintenance.ps1'
$BackupScript = Join-Path $PSScriptRoot 'Backup-Postgres.ps1'
$RestoreDrillScript = Join-Path $PSScriptRoot 'Test-PostgresRestoreDrill.ps1'

function Register-DailyTask {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string]$At
  )

  $Action = New-ScheduledTaskAction `
    -Execute $PowerShell `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$ScriptPath`""
  $Trigger = New-ScheduledTaskTrigger -Daily -At $At
  $Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

  if ($PSCmdlet.ShouldProcess($Name, 'Register scheduled task')) {
    Register-ScheduledTask `
      -TaskName $Name `
      -Action $Action `
      -Trigger $Trigger `
      -Settings $Settings `
      -RunLevel Highest `
      -Force | Out-Null
  }
}

function Register-WeeklyTask {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$ScriptPath,

    [Parameter(Mandatory = $true)]
    [string]$At,

    [Parameter(Mandatory = $true)]
    [string]$Day
  )

  $Action =
    New-ScheduledTaskAction `
      -Execute $PowerShell `
      -Argument (
        '-NoProfile -NonInteractive ' +
        '-ExecutionPolicy Bypass ' +
        "-File `"$ScriptPath`""
      )

  $Trigger =
    New-ScheduledTaskTrigger `
      -Weekly `
      -DaysOfWeek $Day `
      -At $At

  $Settings =
    New-ScheduledTaskSettingsSet `
      -StartWhenAvailable `
      -ExecutionTimeLimit (
        New-TimeSpan -Hours 4
      ) `
      -MultipleInstances IgnoreNew

  if (
    $PSCmdlet.ShouldProcess(
      $Name,
      'Register restore drill task'
    )
  ) {
    Register-ScheduledTask `
      -TaskName $Name `
      -Action $Action `
      -Trigger $Trigger `
      -Settings $Settings `
      -RunLevel Highest `
      -Force |
    Out-Null
  }
}

Register-DailyTask `
  -Name "$TaskPrefix-AuthMaintenance" `
  -ScriptPath $MaintenanceScript `
  -At $MaintenanceTime

Register-DailyTask `
  -Name "$TaskPrefix-PostgresBackup" `
  -ScriptPath $BackupScript `
  -At $BackupTime

Register-WeeklyTask `
  -Name "$TaskPrefix-PostgresRestoreDrill" `
  -ScriptPath $RestoreDrillScript `
  -At $RestoreDrillTime `
  -Day $RestoreDrillDay

Write-Host 'Scheduled tasks registered.' -ForegroundColor Green
