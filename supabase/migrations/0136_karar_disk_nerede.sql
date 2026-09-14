-- KARAR BAŞINA 28 KB NEREYE GİDİYOR — SALT OKUNUR.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. 0121 ölçümü (14.09.2026) hasadın asıl sınırının hız değil DİSK
-- olduğunu gösterdi:
--   • karar başına 28,1 KB
--   • 6000 MB frenine kalan: 135.890 karar
--   • metin hasat hızı 615/saat → frene ~9 GÜN kaldı
--   • katalogdaki 2,37 milyon künye 28,1 KB'den 66,8 GB eder (30 GB kararının
--     iki katından fazla) — yani mevcut maliyetle katalog FİZİKSEL OLARAK
--     bitirilemez.
--
-- Hızı artırmak bu tabloda hiçbir şeyi çözmez; yalnız frene daha çabuk
-- çarptırır. Tek gerçek kaldıraç KARAR BAŞINA MALİYETİ düşürmek.
--
-- VE BİR İPUCU VAR: aynı ölçümde "tam metnin payı 182 MB" çıktı, oysa tablo
-- 1213 MB. İçeriğin ~5,7 katı bir şey daha var. Hipotezim `fts` ve
-- `fts_simple` tsvector sütunları (ikisi de `stored`), ama HİPOTEZ. Bu dosya
-- onu ölçüyor: hangi sütun ne kadar yer kaplıyor.
--
-- Ölçmeden sütun silmek geri alınamaz bir iş: tsvector'ü düşürmek aramayı
-- bozabilir. Önce sayı, sonra karar.
--
-- 0133/0134 dersleri burada da geçerli: TEK İFADE (uygulayıcı yalnız son
-- ifadenin satırlarını döndürür) ve hiçbir tabloya doğrudan `from public.x`
-- ile dokunulmuyor — tablo yoksa ayrıştırma aşamasında patlardı.

with ornek as (
  -- ÖRNEKLEM, TAM TARAMA DEĞİL. 44 bin satırın tamamında pg_column_size
  -- çağırmak bu tabloda ölçümün kendisini yavaşlatır (ve katalog upsert'i
  -- zaten statement timeout yiyor — ölçüm yüzünden hasadı aksatmayalım).
  -- 2000 satır, sütun oranlarını göstermeye fazlasıyla yeter.
  select case
    when to_regclass('public.ictihat_kararlar') is null then null
    else (xpath('/row/c/text()', query_to_xml($q$
      select
        count(*) || '|' ||
        coalesce(round(avg(pg_column_size(full_text)) / 1024.0, 1), 0) || '|' ||
        coalesce(round(avg(pg_column_size(fts)) / 1024.0, 1), 0) || '|' ||
        coalesce(round(avg(pg_column_size(fts_simple)) / 1024.0, 1), 0) || '|' ||
        coalesce(round(avg(pg_column_size(t) - pg_column_size(full_text)
                 - pg_column_size(fts) - pg_column_size(fts_simple)) / 1024.0, 1), 0)
        as c
      from (select * from public.ictihat_kararlar limit 2000) t
    $q$, false, true, '')))[1]::text
  end as ham
),
parca as (
  select
    split_part(ham, '|', 1) as satir,
    split_part(ham, '|', 2) as full_text_kb,
    split_part(ham, '|', 3) as fts_kb,
    split_part(ham, '|', 4) as fts_simple_kb,
    split_part(ham, '|', 5) as digerleri_kb
  from ornek
),
-- İndeksler ayrı: sütun boyutuna girmezler ama diske girerler.
indeksler as (
  select coalesce(
    (xpath('/row/c/text()', query_to_xml($q$
      select string_agg(indexrelname || ' ' || pg_size_pretty(pg_relation_size(indexrelid)),
                        ', ' order by pg_relation_size(indexrelid) desc) as c
      from pg_stat_user_indexes where relname = 'ictihat_kararlar'
    $q$, false, true, '')))[1]::text, 'INDEKS YOK') as liste
  where to_regclass('public.ictihat_kararlar') is not null
)
select olcum, deger from (
  select 1 as sira, 'orneklem satir sayisi' as olcum, coalesce(p.satir, 'TABLO YOK') as deger from parca p
  union all
  select 2, 'full_text (ort. KB/karar)',      coalesce(p.full_text_kb, '-') from parca p
  union all
  -- ASIL SORU: bu ikisi full_text'ten büyükse, aramayı ayakta tutmanın
  -- bedeli metnin kendisinden pahalı demektir.
  select 3, '>> fts tsvector (ort. KB)',       coalesce(p.fts_kb, '-') from parca p
  union all
  select 4, '>> fts_simple tsvector (ort. KB)', coalesce(p.fts_simple_kb, '-') from parca p
  union all
  select 5, 'diger tum sutunlar (ort. KB)',    coalesce(p.digerleri_kb, '-') from parca p
  union all
  select 6, 'indeksler (buyukten kucuge)',     coalesce((select liste from indeksler), 'TABLO YOK')
) ozet
order by sira;
