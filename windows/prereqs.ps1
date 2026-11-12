# Installs the missing prerequisites of llm-memory with winget, one by one, in a visible
# console. Called by the setup wizard (page "Prerequisites") or by hand:
#   powershell -ExecutionPolicy Bypass -File prereqs.ps1 [git] [node] [gh] [claude]
# Without arguments, installs whatever is missing.
param([string[]]$Only = @())
$ErrorActionPreference = 'Continue'

$packages = [ordered]@{
  git    = @{ Id = 'Git.Git';              Exe = 'git.exe' }
  node   = @{ Id = 'OpenJS.NodeJS.LTS';    Exe = 'node.exe' }
  gh     = @{ Id = 'GitHub.cli';           Exe = 'gh.exe' }
  claude = @{ Id = 'Anthropic.ClaudeCode'; Exe = 'claude.exe' }
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user;$env:Path"
}

function Test-Tool([string]$exe) {
  Refresh-Path
  if (Get-Command $exe -ErrorAction SilentlyContinue) { return $true }
  $extra = @("$env:USERPROFILE\.local\bin\$exe", "$env:ProgramFiles\nodejs\$exe", "$env:LOCALAPPDATA\Programs\nodejs\$exe", "$env:ProgramFiles\GitHub CLI\$exe", "$env:ProgramFiles\Git\cmd\$exe")
  foreach ($p in $extra) { if (Test-Path $p) { return $true } }
  return $false
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host 'winget (App Installer) is not available on this Windows. Install the tools by hand:'
  Write-Host '  Git: https://git-scm.com/download/win   Node.js LTS: https://nodejs.org   GitHub CLI: https://cli.github.com   Claude Code: https://claude.com/claude-code'
  exit 2
}

$failed = @()
foreach ($name in $packages.Keys) {
  if ($Only.Count -gt 0 -and $Only -notcontains $name) { continue }
  $pkg = $packages[$name]
  if (Test-Tool $pkg.Exe) { Write-Host "$name : already installed"; continue }
  Write-Host "--- installing $name ($($pkg.Id)) ---"
  winget install --id $pkg.Id --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
  if (Test-Tool $pkg.Exe) { Write-Host "$name : ok" } else { Write-Host "$name : NOT FOUND after install"; $failed += $name }
}

if ($failed.Count) {
  Write-Host ''
  Write-Host "Still missing: $($failed -join ', '). Install them by hand, then click 'Check again' in the setup."
  exit 1
}
Write-Host ''
Write-Host 'All prerequisites are installed.'
exit 0
