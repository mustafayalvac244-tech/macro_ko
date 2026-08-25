@echo off
REM ko-macro'yu baslatir. Bu dosyaya cift tikla.
REM
REM Yonetici olarak calistirman gerekebilir: global kisayollar (F9/F12)
REM oyun penceresi ondeyken calissin diye.
REM Sag tik > "Yonetici olarak calistir".

chcp 65001 >nul
cd /d "%~dp0"

if not exist "ko-macro.exe" (
    echo HATA: ko-macro.exe bu klasorde yok.
    echo Once derle.bat ile derle, sonra dist klasorundeki baslat.bat'i kullan.
    pause
    exit /b 1
)

REM Ilk calistirmada kurulum sihirbazini calistir.
if not exist "config.yaml" (
    echo Ilk calistirma - kurulum baslatiliyor.
    echo.
    echo ONEMLI: Oyunu ACIK ve GORUNUR birak, canin TAM DOLU olsun.
    echo Barlarin yerini ekrandan otomatik bulacak.
    echo.
    pause
    ko-macro.exe kur
    echo.
    pause
)

echo Leonardo araniyor...
ko-macro.exe devices
echo.

ko-macro.exe run --watch
echo.
pause
