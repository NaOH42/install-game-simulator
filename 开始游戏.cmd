@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "INSTALL_SIM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%INSTALL_SIM_NODE%" (
  "%INSTALL_SIM_NODE%" scripts\start.mjs
) else (
  node scripts\start.mjs
)
if errorlevel 1 pause
