#!/usr/bin/env bash
# Firmware testlerini PC'de derleyip çalıştırır (Arduino donanımı gerekmez).
set -euo pipefail

cd "$(dirname "$0")"

# stubs/ arama yoluna eklenince .ino içindeki <Keyboard.h> / <Mouse.h>
# taklitlere çözülür.
g++ -std=c++17 -Wall -Wextra -Wno-unused-parameter -O1 \
    -I stubs \
    -o /tmp/ko_hid_bridge_test test_firmware.cpp

/tmp/ko_hid_bridge_test
