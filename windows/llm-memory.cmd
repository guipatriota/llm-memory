@echo off
rem llm-memory command shim (Windows). Finds node even when it was installed a minute
rem ago and is not yet on the PATH of this console.
setlocal
set "NODE_EXE="
for %%I in (node.exe) do if not "%%~$PATH:I"=="" set "NODE_EXE=%%~$PATH:I"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE (
  echo llm-memory: Node.js was not found. Install it ^(winget install OpenJS.NodeJS.LTS^) and open a new terminal.
  exit /b 1
)
"%NODE_EXE%" "%~dp0app\cli.cjs" %*
exit /b %ERRORLEVEL%
