-- ⚠️ SUPABASE SQL EDITOR UYARISI (bu dosya birden çok SELECT içerir).
-- Editor çok ifadeli bir betikte YALNIZ SON ifadenin sonucunu gösterir. Bu
-- dosyayı olduğu gibi çalıştırırsan yalnızca en alttaki sorgunun tablosunu
-- görürsün — diğerleri koşar ama görünmez. Bu, üç tur boyunca ölçüm sonucunu
-- alamamamızın sebebiydi ve kusur bendeydi, dosyayı çalıştıranda değil.
--
-- İKİ YOL:
--   a) Hepsini tek tabloda isteyen özet için: scripts/hasat-tek-rapor.sql
--   b) Buradaki sorguları TEK TEK seçip (fareyle işaretle) Run'a bas.

-- "MİLYON KARAR" HEDEFİ — ENGEL HIZ DEĞİL, DİSK.
-- ===========================================================================
-- ÖNCE ARİTMETİK (ölçülen sayılardan):
--
--   Şu anki hız (0094): 3 kaynak × saatte 20 tur × en fazla 10 karar.
--   Gözlenen verim: 46 turda ~334 karar → tur başına ~7,3.
--   Yani ~438 karar/saat ≈ 10.500 karar/gün.
--   1.000.000 karara: (1.000.000 − 9.705) / 10.500 ≈ 94 GÜN.
--
--   Hızı artırmak teknik olarak mümkün: ölçülen güvenli tavan eşzamanlılık
--   10'da 8,7 belge/sn'ydi; şu anki hız ~0,12 belge/sn, yani tavanın %1,4'ü.
--
-- AMA HIZI ARTIRMAK SORUNU ÇÖZMÜYOR, ÇÜNKÜ ASIL SINIR DİSK:
--
--   Veritabanı şu an 434,7 MB (ölçüldü) ve havuzda 9.705 karar var.
--   Hasat emniyet freni 6000 MB'da devreye giriyor (migration 0100).
--   Pro planın dahil disk alanı 8 GB.
--
--   Karar başına ortalama boyutu ÖLÇMEDİM — 10-15 KB diye TAHMİN etmiştim ve
--   bu tahmin bu dosyanın 1. sorgusuyla yerini ölçüme bırakacak. Ama kaba bir
--   sağlama bile sorunu gösteriyor: karar başına 30 KB ise 1 milyon karar
--   ~30 GB eder. 8 GB'lık planda bu mümkün DEĞİL; fren ~195.000 karar
--   civarında devreye girer ve hasat kendini durdurur.
--
--   Yani "milyon" hedefi bugünkü mimariyle ulaşılamaz. Hızı artırmak yalnız
--   duvara DAHA ÇABUK çarpmayı sağlar.
--
-- ÇIKIŞ YOLU (karar ölçümden sonra verilecek): kararın TAM METNİ Postgres'te
-- durmak zorunda değil. Supabase Pro 100 GB depolama veriyor; metin oraya,
-- veritabanında yalnız künye + tsvector + vector(384) kalırsa aynı disk çok
-- daha fazla karar taşır. 1. ve 2. sorgu bu ayrımın ne kadar yer kazandıracağını
-- gösterecek.
--
-- Bu dosya hiçbir şeyi DEĞİŞTİRMEZ, yalnız ölçer.

-- ── 1) KARAR BAŞINA GERÇEK BOYUT ────────────────────────────────────────────
-- Tahmini ölçümle değiştiren satır budur.
select
  'ictihat_kararlar'                                              as tablo,
  count(*)                                                        as karar,
  pg_size_pretty(pg_total_relation_size('public.ictihat_kararlar')) as toplam_boyut,
  pg_size_pretty(pg_relation_size('public.ictihat_kararlar'))      as sadece_satirlar,
  pg_size_pretty(pg_indexes_size('public.ictihat_kararlar'))       as indeksler,
  round(pg_total_relation_size('public.ictihat_kararlar')::numeric
        / greatest(count(*), 1) / 1024, 1)                         as karar_basina_kb,
  -- 6000 MB frenine çarpmadan kaç karar daha sığar?
  -- DİKKAT: 6000*1024*1024 int4'e sığmaz (2,1 milyar tavanı) ve "integer out
  -- of range" verir — yerelde koşarken tam olarak bu hatayı aldı. bigint şart.
  round((6000::bigint * 1024 * 1024
         - pg_database_size(current_database()))::numeric
        / greatest(pg_total_relation_size('public.ictihat_kararlar')::numeric
                   / greatest(count(*), 1), 1))                    as kalan_kapasite_karar
from public.ictihat_kararlar;

-- ── 2) YERİ NE YİYOR: metin mi, indeks mi, vektör mü? ───────────────────────
-- Tam metni depolamaya taşımak ne kadar kazandırır sorusunun cevabı burada.
select 'kolon_boyutlari' as olcum,
       pg_size_pretty(sum(pg_column_size(full_text))::bigint)  as full_text,
       pg_size_pretty(sum(pg_column_size(embedding))::bigint)  as embedding,
       pg_size_pretty(sum(pg_column_size(id)
                        + pg_column_size(kurul)
                        + pg_column_size(daire)
                        + pg_column_size(esas_no)
                        + pg_column_size(karar_no)
                        + pg_column_size(karar_tarihi))::bigint) as kunye_alanlari,
       round(avg(length(full_text)))                           as ort_metin_karakteri
from public.ictihat_kararlar;

-- ── 3) İNDEKSLER TEK TEK ────────────────────────────────────────────────────
-- HNSW ve GIN indeksleri sanılandan çok yer kaplayabilir.
select indexrelname as indeks,
       pg_size_pretty(pg_relation_size(indexrelid)) as boyut
from pg_stat_user_indexes
where relname = 'ictihat_kararlar'
order by pg_relation_size(indexrelid) desc;

-- ── 4) VERİTABANININ TAMAMINDA EN BÜYÜK 10 TABLO ────────────────────────────
-- 434,7 MB'ın hepsi içtihat değil. Yedekler (backup şeması) ve mevzuat da var.
-- Nereyi küçültmenin işe yarayacağını bu söyler.
select schemaname || '.' || relname as tablo,
       pg_size_pretty(pg_total_relation_size(relid)) as boyut,
       round(100.0 * pg_total_relation_size(relid) / pg_database_size(current_database()), 1) as yuzde
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc
limit 10;

-- ── 5) HASAT HIZI: gerçek verim ─────────────────────────────────────────────
-- Tur başına kaç karar giriyor? 10 tavanına yakınsa hızı artırmak işe yarar;
-- çok altındaysa darboğaz hız değil, arama sonuçlarının tükenmesidir.
select 'son_6_saat' as pencere,
       count(*) as eklenen_karar,
       round(count(*) / 6.0) as saatlik,
       round(count(*) * 4.0) as gunluk_tahmin
from public.ictihat_kararlar
where created_at > now() - interval '6 hours';
