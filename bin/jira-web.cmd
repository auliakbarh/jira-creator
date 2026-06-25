@echo off
REM Launch the JIRA Creator bridge on Windows (cmd.exe).
REM   bin\jira-web.cmd          interactive bridge (type "stop" to end)
REM   bin\jira-web.cmd --once   headless one-shot: drain pending jobs, then exit
REM Requires the `claude` CLI in PATH and an authenticated Claude Code session.
setlocal
cd /d "%~dp0.."

where claude >nul 2>nul
if errorlevel 1 (
  echo Error: 'claude' CLI not found in PATH. Install Claude Code first.
  exit /b 1
)

if "%~1"=="--once" (
  claude -p --permission-mode acceptEdits "/jira-web"
) else (
  claude "/jira-web"
)
