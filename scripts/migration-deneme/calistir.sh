#!/usr/bin/env bash
# MIGRATION DENEME TEZGÂHI
# ---------------------------------------------------------------------------
# NEDEN VAR. 0095 migration'ı canlı Supabase'e yapıştırıldığında
#   ERROR 42P13: cannot change return type of existing function
# ile düştü. CREATE OR REPLACE bir fonksiyonun dönüş sütunlarını değiştiremez;
# bunu ancak ÇALIŞTIRINCA görebilirdim. Aynı koşuda iki hata daha çıktı:
#   • sütun bazlı "revoke update (sutun)" tablo yetkisi varken ETKİSİZ
#   • RLS politikası var ama tabloya SELECT grant'i yoksa liste hep boş
# Üçü de yerel Postgres'te ölçüldü, tahminle bulunamazdı.
#
# KULLANIM:  bash scripts/migration-deneme/calistir.sh 0095 0096 0097
#            bash scripts/migration-deneme/calistir.sh            # hepsi
#
# NE DEĞİLDİR: bu gerçek Supabase DEĞİL. auth şeması, roller ve dokunulan
# tablolar TAKLİT (supabase-taklit.sql). Sözdizimi, tip, yetki ve tetikleyici
# davranışını yakalar; Supabase'e özgü eklentileri (pgvector, pg_cron, storage)
# yakalamaz. Taklit eksikse hata verir — o zaman taklidi genişletin.
set -euo pipefail
PGBIN=/usr/lib/postgresql/16/bin
DATA=${PGDATA_TEST:-/tmp/pgdeneme}
PORT=${PGPORT_TEST:-55432}
KOK="$(cd "$(dirname "$0")/../.." && pwd)"

if ! pg_isready -h /tmp -p "$PORT" >/dev/null 2>&1; then
  rm -rf "$DATA"; mkdir -p "$DATA"; chown -R postgres "$DATA" 2>/dev/null || true
  su postgres -s /bin/bash -c "$PGBIN/initdb -D $DATA -U postgres --auth=trust -E UTF8" >/dev/null
  su postgres -s /bin/bash -c "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l /tmp/pgdeneme.log start" >/dev/null
  sleep 2
fi

DB="deneme_$(date +%s)"
psql -h /tmp -p "$PORT" -U postgres -q -c "create database $DB;"
psql -h /tmp -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$KOK/scripts/migration-deneme/supabase-taklit.sql"

HEDEF=("$@")
if [ ${#HEDEF[@]} -eq 0 ]; then
  mapfile -t DOSYALAR < <(ls "$KOK"/supabase/migrations/*.sql)
else
  DOSYALAR=()
  for n in "${HEDEF[@]}"; do DOSYALAR+=("$(ls "$KOK"/supabase/migrations/${n}_*.sql)"); done
fi

HATA=0
for D in "${DOSYALAR[@]}"; do
  OUT=$(psql -h /tmp -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$D" 2>&1 | grep -v NOTICE || true)
  if [ -z "$OUT" ]; then echo "OK    $(basename "$D")"; else echo "HATA  $(basename "$D")"; echo "$OUT" | head -5; HATA=1; fi
done

echo
echo "--- ikinci kez (idempotans) ---"
for D in "${DOSYALAR[@]}"; do
  OUT=$(psql -h /tmp -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$D" 2>&1 | grep -v NOTICE || true)
  [ -z "$OUT" ] || { echo "TEKRARDA HATA  $(basename "$D")"; echo "$OUT" | head -5; HATA=1; }
done
[ $HATA -eq 0 ] && echo "tekrar koşu temiz"

echo
echo "--- yetki ölçümü ---"
psql -h /tmp -p "$PORT" -U postgres -d "$DB" -tA -F' | ' -f "$KOK/scripts/migration-deneme/yetki-olcum.sql" || true
psql -h /tmp -p "$PORT" -U postgres -q -c "drop database $DB;" >/dev/null 2>&1 || true
exit $HATA
