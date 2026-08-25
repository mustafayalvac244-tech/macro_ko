# Leonardo'ya firmware'i otomatik yukler.
#
# Arduino IDE kurmana gerek yok: bu betik arduino-cli'yi kendi klasorune
# indirir, AVR cekirdegini kurar, karti bulur, derler ve yukler.
#
# Calistirmak icin yukle.bat dosyasina cift tikla.

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolDir = Join-Path $root ".arduino-cli"
$cli = Join-Path $toolDir "arduino-cli.exe"
$sketch = Join-Path $root "ko_hid_bridge"

function Write-Step($number, $text) {
    Write-Host ""
    Write-Host "[$number] $text" -ForegroundColor Cyan
}

Write-Host "============================================"
Write-Host "  Leonardo firmware yukleyici"
Write-Host "============================================"

# --------------------------------------------------------------- arduino-cli

Write-Step "1/5" "arduino-cli hazirlaniyor..."

if (-not (Test-Path $cli)) {
    New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
    $zip = Join-Path $toolDir "arduino-cli.zip"
    $url = "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip"

    Write-Host "    Indiriliyor (bir kerelik, ~30 MB)..."
    Invoke-WebRequest -Uri $url -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $toolDir -Force
    Remove-Item $zip

    if (-not (Test-Path $cli)) {
        throw "arduino-cli indirilemedi. Internet baglantini kontrol et."
    }
    Write-Host "    Tamam."
} else {
    Write-Host "    Zaten var."
}

# ------------------------------------------------------------------ cekirdek

Write-Step "2/5" "AVR cekirdegi kuruluyor..."
& $cli core update-index 2>&1 | Out-Null
& $cli core install arduino:avr 2>&1 | Out-Null
Write-Host "    Tamam."

# --------------------------------------------------------------------- kart

Write-Step "3/5" "Kart araniyor..."

$board = $null
$fqbn = $null

# Kart bazen yeniden numaralaniyor; birkac kez deneriz.
foreach ($attempt in 1..6) {
    $listed = & $cli board list --format json 2>$null | ConvertFrom-Json

    # arduino-cli surumune gore cikti sekli degisiyor.
    $ports = if ($listed.detected_ports) { $listed.detected_ports } else { $listed }

    foreach ($entry in $ports) {
        $address = if ($entry.port) { $entry.port.address } else { $entry.address }
        $matches = if ($entry.matching_boards) { $entry.matching_boards } else { $entry.boards }

        foreach ($candidate in $matches) {
            if ($candidate.fqbn -match "leonardo|micro") {
                $board = $address
                $fqbn = $candidate.fqbn
                break
            }
        }
        if ($board) { break }
    }
    if ($board) { break }
    Start-Sleep -Seconds 1
}

if (-not $board) {
    Write-Host ""
    Write-Host "Kart bulunamadi." -ForegroundColor Red
    Write-Host ""
    Write-Host "Kontrol et:"
    Write-Host "  - Leonardo USB ile takili mi?"
    Write-Host "  - Kablo veri tasiyor mu? (Sadece sarj kablosu olmaz.)"
    Write-Host "  - Arduino IDE'nin Serial Monitor'u aciksa kapat."
    Write-Host ""
    Write-Host "Bagli portlar:"
    & $cli board list
    exit 1
}

Write-Host "    Bulundu: $board  ($fqbn)" -ForegroundColor Green

# ------------------------------------------------------------------- derleme

Write-Step "4/5" "Firmware derleniyor..."
& $cli compile --fqbn $fqbn $sketch
if ($LASTEXITCODE -ne 0) { throw "Derleme basarisiz." }
Write-Host "    Tamam."

# ------------------------------------------------------------------- yukleme

Write-Step "5/5" "Karta yukleniyor..."

# Leonardo yuklemeden once bootloader'a gecer ve port degisir; arduino-cli
# bunu kendisi halleder ama ilk deneme bazen kaciriyor.
$uploaded = $false
foreach ($attempt in 1..3) {
    & $cli upload -p $board --fqbn $fqbn $sketch
    if ($LASTEXITCODE -eq 0) { $uploaded = $true; break }
    Write-Host "    Tekrar deneniyor ($attempt/3)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}

if (-not $uploaded) {
    Write-Host ""
    Write-Host "Yukleme basarisiz." -ForegroundColor Red
    Write-Host "Kartin reset dugmesine HIZLICA IKI KEZ bas ve bu betigi tekrar calistir."
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  BITTI - firmware yuklendi" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Simdi ko-macro.exe klasorundeki baslat.bat dosyasini calistirabilirsin."
Write-Host ""
