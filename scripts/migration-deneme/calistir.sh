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
  # YALNIZ gerçek hataya bak. Eskiden "çıktı varsa hata" sayılıyordu; bu yüzden
  # sonuç tablosu yazdıran migration'lar (ör. 0093/0094'teki cron.unschedule
  # çağrıları) sorunsuz çalıştıkları hâlde HATA görünüyordu. Yanlış alarm veren
  # bir tezgâh, bir süre sonra hiç okunmaz.
  OUT=$(psql -h /tmp -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$D" 2>&1 | grep -E "ERROR|FATAL|PANIC" || true)
  if [ -z "$OUT" ]; then echo "OK    $(basename "$D")"; else echo "HATA  $(basename "$D")"; echo "$OUT" | head -5; HATA=1; fi
done

echo
echo "--- ikinci kez (idempotans) ---"
for D in "${DOSYALAR[@]}"; do
  # YALNIZ gerçek hataya bak. Eskiden "çıktı varsa hata" sayılıyordu; bu yüzden
  # sonuç tablosu yazdıran migration'lar (ör. 0093/0094'teki cron.unschedule
  # çağrıları) sorunsuz çalıştıkları hâlde HATA görünüyordu. Yanlış alarm veren
  # bir tezgâh, bir süre sonra hiç okunmaz.
  OUT=$(psql -h /tmp -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$D" 2>&1 | grep -E "ERROR|FATAL|PANIC" || true)
  [ -z "$OUT" ] || { echo "TEKRARDA HATA  $(basename "$D")"; echo "$OUT" | head -5; HATA=1; }
done
[ $HATA -eq 0 ] && echo "tekrar koşu temiz"

echo
echo "--- yetki ölçümü ---"
psql -h /tmp -p "$PORT" -U postgres -d "$DB" -tA -F' | ' -f "$KOK/scripts/migration-deneme/yetki-olcum.sql" || true

# Yedekten silme ölçümü, YALNIZ 0102 bu koşuda uygulandıysa anlamlıdır.
# Uygulanmadıysa sessizce atlanır — "ölçüm yapıldı" izlenimi verilmez.
VAR=$(psql -h /tmp -p "$PORT" -U postgres -d "$DB" -tA \
  -c "select to_regprocedure('backup.kullaniciyi_yedeklerden_sil(uuid)') is not null" 2>/dev/null || echo f)
if [ "$VAR" = "t" ]; then
  echo
  echo "--- yedekten silme ölçümü (0102) ---"
  psql -h /tmp -p "$PORT" -U postgres -d "$DB" -q -f "$KOK/scripts/migration-deneme/yedek-silme-olcum.sql" 2>&1 \
    | grep -E "GEÇTİ|KALDI|BOZULDU|ERROR" || true
fi

# Öncelik ölçümü, YALNIZ 0103 bu koşuda uygulandıysa anlamlıdır.
VAR2=$(psql -h /tmp -p "$PORT" -U postgres -d "$DB" -tA \
  -c "select to_regprocedure('public.tr_kucult(text)') is not null" 2>/dev/null || echo f)
if [ "$VAR2" = "t" ]; then
  echo
  echo "--- hasat önceliği ölçümü (0103) ---"
  psql -h /tmp -p "$PORT" -U postgres -d "$DB" -q -c \
    "alter table public.cases add column if not exists case_type text;
     alter table public.ictihat_harvest_state add column if not exists oncelik integer not null default 100;" >/dev/null 2>&1
  psql -h /tmp -p "$PORT" -U postgres -d "$DB" -tA -f "$KOK/scripts/migration-deneme/oncelik-olcum.sql" 2>&1 \
    | grep -E "GEÇTİ|BOZULDU|ERROR" || true
fi

psql -h /tmp -p "$PORT" -U postgres -q -c "drop database $DB;" >/dev/null 2>&1 || true
exit $HATA
