-- KARAR BAŞINA 32,7 KB — BU 32,7 KB NEREYE GİDİYOR?
-- ===========================================================================
-- ÖLÇÜLEN GERÇEKLER (bugün):
--   · Kaynağın kendisinden: bir Yargıtay kararının düz metni ortalama 8,3 KB
--     (Bedesten getDocumentContent, 6 belge, base64 çözülmüş).
--   · Veritabanından: karar başına 32,7 KB. Yani metin, harcadığımız yerin
--     dörtte biri kadar. Geri kalan ~24 KB'ı METİN DEĞİL.
--
-- NEDEN ÖNEMLİ: 6.000 MB'lık frene 167.655 karar kaldı. Karar başına maliyeti
-- yarıya indirmek, kapasiteyi İKİYE KATLAR. Hasadı hızlandırmak kapasiteyi
-- artırmaz — sadece freni daha çabuk bulduruz. Bu yüzden "karar başına KB"
-- şu an hızdan daha önemli bir sayı.
--
-- ÖNCEKİ DENEMEM ÇALIŞTIRILAMADI: hasat-disk-nereye.sql geçici bir FONKSİYON
-- yaratıyor, yani yazıyor; salt okunur rapor koşturucu onu (doğru olarak)
-- reddediyor. Dinamik SQL'e ihtiyaç duymasının sebebi sütun adlarını
-- bilmemekti. Artık biliyorum (teşhis koşusu verdi), o yüzden burası düz SQL.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.

with n as (
  select greatest(count(*), 1)::numeric as adet from public.ictihat_kararlar
),
olcum as (
  select
    sum(pg_column_size(full_text))::numeric   as s_full_text,
    sum(pg_column_size(fts))::numeric         as s_fts,
    sum(pg_column_size(fts_simple))::numeric  as s_fts_simple,
    sum(pg_column_size(embedding))::numeric   as s_embedding,
    sum(pg_column_size(daire) + pg_column_size(esas_no) + pg_column_size(karar_no)
      + pg_column_size(karar_tarihi) + pg_column_size(kurul) + pg_column_size(durum)
      + pg_column_size(arama_terimi) + pg_column_size(id))::numeric as s_ustveri
  from public.ictihat_kararlar
),
boyut as (
  select
    pg_total_relation_size('public.ictihat_kararlar')::numeric as toplam,
    pg_indexes_size('public.ictihat_kararlar')::numeric        as indeks
),
satirlar as (
  select 10 as sira, 'ÖZET' as bolum, 'karar sayısı' as alan, n.adet::text as deger from n
  union all
  select 11, 'ÖZET', 'tablo + indeks toplam', pg_size_pretty(boyut.toplam::bigint) from boyut
  union all
  select 12, 'ÖZET', 'karar başına (toplam)',
         round(boyut.toplam / n.adet / 1024, 1)::text || ' KB' from boyut, n

  -- SÜTUN BAZINDA. Hangi sütun kapatılırsa/küçültülürse ne kazanılır?
  union all
  select 20, 'SÜTUN', 'full_text (düz metin)',
         pg_size_pretty(o.s_full_text::bigint) || '  · karar başına '
         || round(o.s_full_text / n.adet / 1024, 1)::text || ' KB  · %'
         || round(100.0 * o.s_full_text / b.toplam, 1)
  from olcum o, n, boyut b
  union all
  select 21, 'SÜTUN', 'fts (tsvector, türkçe)',
         pg_size_pretty(o.s_fts::bigint) || '  · karar başına '
         || round(o.s_fts / n.adet / 1024, 1)::text || ' KB  · %'
         || round(100.0 * o.s_fts / b.toplam, 1)
  from olcum o, n, boyut b
  union all
  select 22, 'SÜTUN', 'fts_simple (tsvector, sade)',
         pg_size_pretty(o.s_fts_simple::bigint) || '  · karar başına '
         || round(o.s_fts_simple / n.adet / 1024, 1)::text || ' KB  · %'
         || round(100.0 * o.s_fts_simple / b.toplam, 1)
  from olcum o, n, boyut b
  union all
  select 23, 'SÜTUN', 'embedding (vector 384)',
         pg_size_pretty(o.s_embedding::bigint) || '  · karar başına '
         || round(o.s_embedding / n.adet / 1024, 1)::text || ' KB  · %'
         || round(100.0 * o.s_embedding / b.toplam, 1)
  from olcum o, n, boyut b
  union all
  select 24, 'SÜTUN', 'üstveri (daire, esas, karar no…)',
         pg_size_pretty(o.s_ustveri::bigint) || '  · karar başına '
         || round(o.s_ustveri / n.adet / 1024, 1)::text || ' KB'
  from olcum o, n

  -- İNDEKSLER AYRI BİR MALİYET: tsvector sütunu bir kez, GIN indeksi bir kez.
  union all
  select 30, 'İNDEKS', s.indexrelname,
         pg_size_pretty(pg_relation_size(s.indexrelid)) || '  · karar başına '
         || round(pg_relation_size(s.indexrelid) / n.adet / 1024, 1)::text || ' KB'
  from pg_stat_user_indexes s, n where s.relname = 'ictihat_kararlar'

  -- ÇİFT SAYIM İHTİMALİ: iki tsvector sütunu + iki GIN indeksi. fts_simple'ın
  -- gerçekten ayrı bir soruyu cevaplayıp cevaplamadığı ayrıca sorulmalı.
  union all
  select 40, 'HESAP', '>> iki tsvector sütunu + indeksleri',
         pg_size_pretty((o.s_fts + o.s_fts_simple
           + coalesce((select sum(pg_relation_size(indexrelid)) from pg_stat_user_indexes
                       where relname = 'ictihat_kararlar'
                         and indexrelname in ('ictihat_fts_idx', 'ictihat_fts_simple_idx')), 0))::bigint)
         || '  · %' || round(100.0 * (o.s_fts + o.s_fts_simple
           + coalesce((select sum(pg_relation_size(indexrelid)) from pg_stat_user_indexes
                       where relname = 'ictihat_kararlar'
                         and indexrelname in ('ictihat_fts_idx', 'ictihat_fts_simple_idx')), 0)) / b.toplam, 1)
  from olcum o, boyut b
  union all
  select 41, 'HESAP', '>> düz metnin payı',
         '%' || round(100.0 * o.s_full_text / b.toplam, 1)
  from olcum o, boyut b

  -- ŞİŞME: geri alınmamış yer. Büyükse veri kaybetmeden yer açılabilir.
  union all
  select 50, 'ŞİŞME', 'ölü satır / canlı satır',
         coalesce(t.n_dead_tup, 0)::text || ' / ' || coalesce(t.n_live_tup, 0)::text
  from pg_stat_user_tables t where t.relname = 'ictihat_kararlar'
)
select bolum, alan, deger from satirlar order by sira, alan;
