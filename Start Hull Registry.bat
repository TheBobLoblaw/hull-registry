@echo off
cd /d "%~dp0"
python serve.py
if errorlevel 1 (
  echo.
  echo Python 3 is needed: https://www.python.org/downloads/  (tick "Add python.exe to PATH")
  pause
)
