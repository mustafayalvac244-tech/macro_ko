@echo off
REM ================================================================
REM  ko-macro - TEK DOSYA. Buna cift tikla, gerisini kendi halleder.
REM
REM  Sirayla: karti bulur -> firmware yoksa yukler -> ayar dosyasi
REM  yoksa kurulumu yapar -> programi acar. Her adimda ne oldugunu
REM  yazar; takilirsa tanilama.txt dosyasini birakir.
REM
REM  Yonetici olarak calistirmak en iyisi: F9/F12 kisayollari oyun
REM  penceresi ondeyken ancak oyle calisir.
REM  Sag tik > "Yonetici olarak calistir".
REM ================================================================

chcp 65001 >nul
cd /d "%~dp0"
title ko-macro

if not exist "ko-macro.exe" (
    echo HATA: ko-macro.exe bu klasorde yok.
    echo Zip'i tamamen cikardigindan emin ol - zip'in icinden calistirma.
    pause
    exit /b 1
)

REM --- firmware yukleyicinin yeri: pakette firmware\, depoda ..\arduino\
set "FLASHER="
if exist "firmware\yukle.ps1"    set "FLASHER=firmware\yukle.ps1"
if exist "..\arduino\yukle.ps1"  set "FLASHER=..\arduino\yukle.ps1"

echo.
echo [1/4] Kart araniyor...
ko-macro.exe tani --kontrol firmware
if not errorlevel 1 goto :firmware_ok

REM Kart cevap vermedi. Firmware hic yuklenmemis olabilir - dene.
if "%FLASHER%"=="" (
    echo.
    echo Firmware yukleyici bulunamadi. Zip eksik cikmis olabilir.
    goto :diagnose
)

echo.
echo Kart cevap vermiyor. Firmware simdi yukleniyor - 1-2 dakika surer.
echo Bu sirada Leonardo'nun kablosunu CIKARMA.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%FLASHER%"

echo.
echo Tekrar deneniyor...
ko-macro.exe tani --kontrol firmware
if errorlevel 1 goto :diagnose

:firmware_ok
echo     Kart hazir.

echo.
echo [2/4] Ekran okunabiliyor mu...
ko-macro.exe tani --kontrol ekran

echo.
echo [3/4] Ayarlar...
if exist "config.yaml" goto :config_ok

echo     Ilk calistirma. Kurulum sihirbazi acilacak.
echo.
echo     ONEMLI: Oyun ACIK ve GORUNUR olsun, canin TAM DOLU olsun.
echo     Barlarin yerini ekrandan kendisi bulacak.
echo.
pause
ko-macro.exe kur
if errorlevel 1 goto :diagnose

:config_ok
echo     Ayar dosyasi hazir: config.yaml

echo.
echo [4/4] Baslatiliyor...
echo.
ko-macro.exe run --watch
echo.
pause
exit /b 0

:diagnose
echo.
echo ================================================================
echo  Bir yerde takildi. Tam tanilama calistiriliyor.
echo ================================================================
echo.
ko-macro.exe tani
echo.
echo Yukaridaki "->" satirlari ne yapilacagini soyluyor.
echo Cozemezsen tanilama.txt dosyasinin icerigini oldugu gibi paylas.
echo.
pause
exit /b 1
