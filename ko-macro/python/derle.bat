@echo off
REM ko-macro.exe derler. Bu dosyayi cift tiklaman yeterli.
REM Gereken tek sey: bilgisayarinda Python 3.10+ kurulu olmasi.

setlocal
cd /d "%~dp0"

echo ============================================
echo   ko-macro.exe derleniyor
echo ============================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo HATA: Python bulunamadi.
    echo.
    echo https://www.python.org/downloads/ adresinden Python 3.10 veya
    echo ustunu kur. Kurulum ekraninda "Add Python to PATH" kutusunu
    echo ISARETLEMEYI UNUTMA.
    echo.
    pause
    exit /b 1
)

echo [1/3] Gerekli paketler kuruluyor...
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt pyinstaller
if errorlevel 1 (
    echo HATA: Paketler kurulamadi. Internet baglantini kontrol et.
    pause
    exit /b 1
)

echo.
echo [2/3] Derleniyor... (birkac dakika surebilir)
python -m PyInstaller ko-macro.spec --noconfirm --clean
if errorlevel 1 (
    echo HATA: Derleme basarisiz.
    pause
    exit /b 1
)

echo.
echo [3/3] Dosyalar hazirlaniyor...
if not exist "dist\config.yaml" copy "config.example.yaml" "dist\config.yaml" >nul
copy "baslat.bat" "dist\" >nul 2>&1

echo.
echo ============================================
echo   BITTI
echo ============================================
echo.
echo Exe burada:  %cd%\dist\ko-macro.exe
echo Ayar dosyasi: %cd%\dist\config.yaml
echo.
echo dist klasorunu istedigin yere tasiyabilirsin.
echo Calistirmak icin icindeki baslat.bat dosyasina cift tikla.
echo.
pause
