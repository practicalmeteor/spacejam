@echo off & setlocal enabledelayedexpansion
set PPID=%1
for /F "skip=1 tokens=1" %%a in ('wmic process where "ParentProcessID=%PPID%" get processid') do for %%b in (%%a) do (
  echo %%a
)