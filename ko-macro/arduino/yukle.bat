@echo off
REM Leonardo'ya firmware yukler. Bu dosyaya cift tikla.
REM Arduino IDE kurmana gerek yok - gerekli her seyi kendisi indirir.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0yukle.ps1"
echo.
pause
