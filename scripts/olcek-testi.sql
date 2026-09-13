-- KULLANICI ARTARSA NE OLUR? — ölçekleme teşhisi.
-- ===========================================================================
-- NEDEN BU DOSYA VAR. "Kaç kullanıcı kaldırır?" sorusunun cevabı tahminle
-- verilemez. Bu rapor, ölçek büyüdükçe ÖNCE hangi şeyin kırılacağını
-- veritabanının kendi sayaçlarından okur.
--
-- ARANAN ASIL ŞEY — RLS + EKSİK İNDEKS. Bu mimaride her tablo satır düzeyi
-- güvenlikle korunuyor ve politikalar "auth.uid() = user_id" biçiminde.
-- Postgres bu koşulu HER SATIR için değerlendirir; user_id üzerinde indeks
-- yoksa tek bir avukatın dava listesini açması TÜM tabloyu taramak demektir.
-- 20 kullanıcıda kimse fark etmez, 2.000 kullanıcıda uygulama durur. Sessiz,
-- yavaş ve tam olarak "kullanıcı artınca ne olur" sorusunun cevabı.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur. (Betik koşturucu yazma fiillerini
-- reddediyor; bu dosyada o kelimeler bilerek hiç geçmiyor.)

with rls_tablo as (
  select c.oid, c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
),
kullanici_sutunlu as (
  -- Politikaların dayandığı sütun; bu şemada sahiplik her yerde bu adla tutulur.
  select t.oid, t.relname, a.attnum
  from rls_tablo t
  join pg_attribute a
    on a.attrelid = t.oid and a.attname = 'user_id' and a.attnum > 0 and not a.attisdropped
),
indeks_durumu as (
  select k.relname,
         exists (
           select 1 from pg_index i
           where i.indrelid = k.oid and i.indkey[0] = k.attnum
         ) as indeks_var,
         coalesce((select c2.reltuples::bigint from pg_class c2 where c2.oid = k.oid), 0) as tahmini_satir,
         pg_total_relation_size(k.oid) as boyut
  from kullanici_sutunlu k
),
tarama as (
  select s.relname, s.seq_scan, coalesce(s.idx_scan, 0) as idx_scan,
         pg_total_relation_size(s.relid) as boyut
  from pg_stat_user_tables s
  where s.schemaname = 'public'
),
onbellek as (
  select sum(heap_blks_hit) as vurdu, sum(heap_blks_read) as diskten
  from pg_statio_user_tables
),
baglanti as (
  select count(*) as acik,
         (select setting::int from pg_settings where name = 'max_connections') as tavan
  from pg_stat_activity
),
satirlar as (
  -- ── 1. SAHİPLİK İNDEKSİ — ölçeklemenin en sessiz katili ─────────────────
  select 10::numeric as sira, 'RLS-INDEKS' as bolum,
         '>> ' || relname || ' — user_id indeksi YOK' as alan,
         'tahmini ' || tahmini_satir || ' satır · ' || pg_size_pretty(boyut)
         || ' — her kullanıcı sorgusu tam tarama riski' as deger
  from indeks_durumu where not indeks_var
  union all
  select 11, 'RLS-INDEKS', relname,
         'indeks VAR · tahmini ' || tahmini_satir || ' satır · ' || pg_size_pretty(boyut)
  from indeks_durumu where indeks_var

  -- ── 2. TAM TARAMA ORANI — 1 MB üstü tablolarda ──────────────────────────
  union all
  select 20, 'TARAMA', relname,
         'tam tarama ' || seq_scan || ' · indeksli ' || idx_scan
         || ' (%' || coalesce(round(100.0 * seq_scan / nullif(seq_scan + idx_scan, 0), 1), 0) || ' tam)'
         || ' · ' || pg_size_pretty(boyut)
  from tarama
  where seq_scan + idx_scan > 0 and boyut > 1024 * 1024

  -- ── 3. EN BÜYÜK TABLOLAR — disk tavanına ne kadar var ───────────────────
  union all
  select 30, 'BOYUT', relname, pg_size_pretty(boyut)
  from tarama where boyut > 8 * 1024 * 1024

  -- ── 4. ÖNBELLEK İSABETİ — %99 altına düşerse disk okumaya başlıyoruz ────
  union all
  select 40, 'ÖNBELLEK', 'veri önbellek isabeti',
         coalesce(round(100.0 * vurdu / nullif(vurdu + diskten, 0), 2)::text, '-') || '%'
         || ' (bellekten ' || coalesce(vurdu, 0) || ' · diskten ' || coalesce(diskten, 0) || ')'
  from onbellek

  -- ── 5. BAĞLANTI TAVANI — eşzamanlı kullanıcının sert sınırı ─────────────
  union all
  select 50, 'BAĞLANTI', 'açık / tavan',
         acik || ' / ' || tavan || '  (%' || round(100.0 * acik / nullif(tavan, 0), 1) || ' dolu)'
  from baglanti
)
select bolum, alan, deger from satirlar order by sira, alan;
