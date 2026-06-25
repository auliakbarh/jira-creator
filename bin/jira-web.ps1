# Launch the JIRA Creator bridge on Windows (PowerShell).
#   .\bin\jira-web.ps1          interactive bridge (type "stop" to end)
#   .\bin\jira-web.ps1 -Once    headless one-shot: drain pending jobs, then exit
# Requires the `claude` CLI in PATH and an authenticated Claude Code session.
param([switch]$Once)

$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Error "'claude' CLI not found in PATH. Install Claude Code first."
  exit 1
}

if ($Once) {
  claude -p --permission-mode acceptEdits "/jira-web"
} else {
  claude "/jira-web"
}
