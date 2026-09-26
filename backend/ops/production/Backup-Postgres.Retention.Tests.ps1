#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }

<#
  .SYNOPSIS
  Tests for the local retention half of Backup-Postgres.ps1.

  This code deletes database backups, so it is tested against the real
  function bodies rather than a copy: the AST below lifts the functions
  straight out of the script. Editing the script without editing these
  tests changes what is tested.

  The script's top level talks to Docker, so it cannot simply be
  dot-sourced. Only the four retention functions are loaded, with the
  variables and commands they close over supplied by the test.
#>

BeforeAll {
  $ScriptPath = Join-Path $PSScriptRoot 'Backup-Postgres.ps1'

  $Tokens = $null
  $ParseErrors = $null
  $Ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $ScriptPath,
    [ref]$Tokens,
    [ref]$ParseErrors
  )

  if ($ParseErrors) {
    throw "Backup-Postgres.ps1 does not parse: $($ParseErrors[0].Message)"
  }

  $Wanted = @(
    'Get-OffsiteDumpName',
    'Remove-SupersededLocalBackup',
    'Remove-StaleLocalTempFile',
    'Get-LocalBackupKeepCount'
  )

  $Definitions = $Ast.FindAll(
    {
      param($Node)
      $Node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    },
    $true
  ) | Where-Object { $Wanted -contains $_.Name }

  if ($Definitions.Count -ne $Wanted.Count) {
    throw (
      'Expected {0} retention functions in Backup-Postgres.ps1, found {1}.' -f
      $Wanted.Count,
      $Definitions.Count
    )
  }

  # Loaded into the script scope so the functions see the test's
  # $BackupDirectory, $DumpFile, Invoke-Compose and Get-EnvValue.
  . ([scriptblock]::Create(($Definitions.Extent.Text -join "`n")))

  function Get-RemainingDumpName {
    (Get-ChildItem -LiteralPath $script:BackupDirectory -Filter '*.dump' -File).Name |
      Sort-Object
  }
}

Describe 'Remove-SupersededLocalBackup' {
  BeforeEach {
    $script:BackupDirectory = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $script:BackupDirectory -Force | Out-Null

    # Newest last, so the run's own dump is the highest-sorting name.
    $script:Names = @(
      'quan_ly_truyen-20260921T000000Z.dump',
      'quan_ly_truyen-20260922T000000Z.dump',
      'quan_ly_truyen-20260923T000000Z.dump',
      'quan_ly_truyen-20260924T000000Z.dump',
      'quan_ly_truyen-20260925T000000Z.dump'
    )

    foreach ($Name in $script:Names) {
      Set-Content -LiteralPath (Join-Path $script:BackupDirectory $Name) -Value 'dump'
      Set-Content -LiteralPath (Join-Path $script:BackupDirectory "$Name.sha256") -Value 'hash'
    }

    $script:DumpFile = Get-Item -LiteralPath (
      Join-Path $script:BackupDirectory 'quan_ly_truyen-20260925T000000Z.dump'
    )

    $script:AllOffsite = [Collections.Generic.List[string]]::new()
    $script:Names | ForEach-Object { $script:AllOffsite.Add($_) }
  }

  AfterEach {
    Remove-Item -LiteralPath $script:BackupDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }

  It 'keeps the newest N dumps and deletes the rest with their checksums' {
    Remove-SupersededLocalBackup -Keep 2 -OffsiteDumpName $script:AllOffsite

    Get-RemainingDumpName | Should -Be @(
      'quan_ly_truyen-20260924T000000Z.dump',
      'quan_ly_truyen-20260925T000000Z.dump'
    )

    (Get-ChildItem -LiteralPath $script:BackupDirectory -Filter '*.sha256' -File).Count |
      Should -Be 2
  }

  It 'never deletes the dump this run created' {
    Remove-SupersededLocalBackup -Keep 1 -OffsiteDumpName $script:AllOffsite

    Get-RemainingDumpName | Should -Contain $script:DumpFile.Name
  }

  It 'keeps a dump whose checksum has not been written yet' {
    # A concurrent run mid-write, not a leftover.
    Remove-Item -LiteralPath (
      Join-Path $script:BackupDirectory 'quan_ly_truyen-20260921T000000Z.dump.sha256'
    )

    Remove-SupersededLocalBackup -Keep 2 -OffsiteDumpName $script:AllOffsite

    Get-RemainingDumpName | Should -Contain 'quan_ly_truyen-20260921T000000Z.dump'
  }

  It 'keeps a dump that has no confirmed off-host copy' {
    $Partial = [Collections.Generic.List[string]]::new()
    $script:Names |
      Where-Object { $_ -ne 'quan_ly_truyen-20260922T000000Z.dump' } |
      ForEach-Object { $Partial.Add($_) }

    Remove-SupersededLocalBackup -Keep 2 -OffsiteDumpName $Partial

    Get-RemainingDumpName | Should -Contain 'quan_ly_truyen-20260922T000000Z.dump'
  }

  It 'still matches correctly when off-host holds a single dump' {
    $Single = [Collections.Generic.List[string]]::new()
    $Single.Add('quan_ly_truyen-20260921T000000Z.dump')

    Remove-SupersededLocalBackup -Keep 2 -OffsiteDumpName $Single

    # Only the one confirmed off-host goes; the rest are kept.
    Get-RemainingDumpName | Should -Not -Contain 'quan_ly_truyen-20260921T000000Z.dump'
    (Get-RemainingDumpName).Count | Should -Be 4
  }

  It 'deletes nothing when the off-host list could not be read' {
    Remove-SupersededLocalBackup -Keep 2 -OffsiteDumpName $null

    (Get-RemainingDumpName).Count | Should -Be 5
  }

  It 'deletes nothing when off-host genuinely holds no dump' {
    Remove-SupersededLocalBackup `
      -Keep 2 `
      -OffsiteDumpName ([Collections.Generic.List[string]]::new())

    (Get-RemainingDumpName).Count | Should -Be 5
  }

  It 'deletes nothing when there are no more dumps than the keep count' {
    Remove-SupersededLocalBackup -Keep 5 -OffsiteDumpName $script:AllOffsite

    (Get-RemainingDumpName).Count | Should -Be 5
  }
}

Describe 'Get-OffsiteDumpName' {
  BeforeEach {
    $script:BackupDirectory = [IO.Path]::GetTempPath()
  }

  It 'reads dump basenames out of restic JSON around compose noise' {
    function Invoke-Compose {
      param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
      @(
        'level=warning msg="Found orphan containers"',
        '[{"time":"2026-09-26T03:30:40Z","paths":["/backups/a.dump","/backups/a.dump.sha256"]},',
        ' {"time":"2026-09-26T00:55:45Z","paths":["/backups/b.dump","/backups/b.dump.sha256"]}]'
      )
    }

    $Names = Get-OffsiteDumpName

    $Names | Should -Contain 'a.dump'
    $Names | Should -Contain 'b.dump'
    # The .sha256 paths must not be mistaken for dumps.
    $Names.Count | Should -Be 2
  }

  It 'hands back a real list object, not unrolled strings' {
    # Without the unary comma on the return, PowerShell enumerates the
    # list and an empty one vanishes entirely — making "off-host holds
    # nothing" indistinguishable from "could not read the repository".
    function Invoke-Compose {
      param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
      @('[{"paths":["/backups/only.dump","/backups/only.dump.sha256"]}]')
    }

    $Names = Get-OffsiteDumpName

    # Not piped into Should: the pipeline itself would unroll the list
    # and the assertion would inspect the string inside it.
    $Names -is [Collections.Generic.List[string]] | Should -BeTrue
    $Names.Count | Should -Be 1
    $Names.Contains('only.dump') | Should -BeTrue
  }

  It 'distinguishes an empty repository from an unreadable one' {
    function Invoke-Compose {
      param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
      @('[]')
    }

    $Empty = Get-OffsiteDumpName

    # Empty, but present: not $null.
    $null -eq $Empty | Should -BeFalse
    $Empty.Count | Should -Be 0
  }

  It 'returns null rather than an empty list when the output is not JSON' {
    function Invoke-Compose {
      param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
      @('Fatal: unable to open repository')
    }

    $null -eq (Get-OffsiteDumpName) | Should -BeTrue
  }

  It 'returns null when the JSON is malformed' {
    function Invoke-Compose {
      param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
      @('[{"paths": ')
    }

    $null -eq (Get-OffsiteDumpName) | Should -BeTrue
  }
}

Describe 'Remove-StaleLocalTempFile' {
  It 'removes temp files older than an hour and keeps fresh ones' {
    $script:BackupDirectory = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $script:BackupDirectory -Force | Out-Null

    try {
      $Stale = Join-Path $script:BackupDirectory 'backup-last-success.json.tmp'
      $Fresh = Join-Path $script:BackupDirectory '.env.deploy.abc.tmp'
      Set-Content -LiteralPath $Stale -Value ''
      Set-Content -LiteralPath $Fresh -Value ''
      (Get-Item -LiteralPath $Stale).LastWriteTimeUtc = [DateTime]::UtcNow.AddHours(-2)

      Remove-StaleLocalTempFile

      Test-Path -LiteralPath $Stale | Should -BeFalse
      Test-Path -LiteralPath $Fresh | Should -BeTrue
    }
    finally {
      Remove-Item -LiteralPath $script:BackupDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

Describe 'Get-LocalBackupKeepCount' {
  It 'uses the configured value when it is a positive integer' {
    function Get-EnvValue { param([string]$Name) '5' }

    Get-LocalBackupKeepCount -Default 2 | Should -Be 5
  }

  It 'falls back to the default when unset, blank, zero or not a number' {
    foreach ($Configured in @($null, '', '   ', '0', '-3', 'many')) {
      $script:Value = $Configured
      function Get-EnvValue { param([string]$Name) $script:Value }

      Get-LocalBackupKeepCount -Default 2 | Should -Be 2
    }
  }
}
