@echo off
REM ko-macro'yu baslatir. Bu dosyaya cift tikla.
REM
REM Yonetici olarak calistirman gerekebilir: global kisayollar (F9/F12)
REM oyun penceresi ondeyken calissin diye. Sag tik > "Yonetici olarak calistir".

setlocal
cd /d "%~dp0"

if not exist "ko-macro.exe" (
    echo HATA: ko-macro.exe bu klasorde yok.
    echo Once derle.bat ile derle, sonra dist klasorundeki baslat.bat'i kullan.
    pause
    exit /b 1
)

echo Leonardo araniyor...
ko-macro.exe devices
echo.

ko-macro.exe run --watch
echo.
pause
