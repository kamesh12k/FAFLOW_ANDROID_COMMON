@echo off
setlocal enabledelayedexpansion
cls

:: Anchor working directory to project root relative to this script
cd /d "%~dp0.."

call "%~dp0..\StartDev.bat" %*
