-- İÇTİHAT ARAMASI ZAMAN AŞIMINA UĞRUYOR — ölçüldü, eksik indeks.
-- ===========================================================================
-- ÖLÇÜM (canlı, 2026-09-11, eval-ictihat / 30 soru):
--     30 sorunun 11'i HİÇ SONUÇ DÖNDÜRMEDİ:
--     search_ictihat_fts 500: {"code":"57014",
--       "message":"canceling statement due to statement timeout"}
--
-- Yani kullanıcının gördüğü şey "arama başarısız". Bu, uygulamanın en güçlü ve
-- tamamen ücretsiz özelliği; her üç aramadan biri düşüyor.
--
-- RAPOR EDİLEN %86,3 İSABET YANILTICI: o oran yalnız SONUÇ DÖNEN 19 soru
-- üzerinden hesaplandı. Zaman aşımına uğrayan 11 soru "isabetsiz" bile
-- sayılmadı, hiç sayılmadı. Gerçek kullanıcı deneyimi bu orandan kötü.
--
-- SEBEP — depodaki indeks tanımları:
--     ictihat_kararlar using hnsw (embedding ...)   → 0033
--     ictihat_fts_simple_idx using gin (fts_simple) → 0034
--     fts sütununda İNDEKS YOK
-- Oysa 0035'teki ana sorgu tam olarak onu kullanıyor:
--     where tsq is not null and k.fts @@ tsq
-- İndeks olmayınca bu, ~10.000 satırın tsvector'ünü tek tek tarar. Havuz
-- günde ~2.400 karar büyüyor, yani sorun KENDİLİĞİNDEN AĞIRLAŞIYOR: hasat
-- şu anda ürünü iyileştirirken aramayı bozuyor.
--
-- İKİNCİ MASRAF KAYNAĞI (bu dosyada DOKUNULMUYOR, ölçülsün diye yazılıyor):
-- aynı fonksiyon her sorgu kelimesi için İKİ ayrı `:*` önek taraması yapıyor
-- (left(w,4)||':*' ve w||':*'). Dört harflik önek GIN'de çok sayıda sözcük
-- birimine açılır ve pahalıdır. İndeks eklendikten sonra hâlâ zaman aşımı
-- varsa asıl düzeltme oradadır; önce ucuz ve geri alınabilir olanı yapıyoruz.
--
-- NEDEN CONCURRENTLY DEĞİL: create index concurrently işlem bloğu içinde
-- çalışmaz ve bu migration uçtan tek deyim olarak gönderiliyor. Tablo ~332 MB
-- ve 10 bin satır; normal create index saniyeler sürer. Kilit kısa olacak,
-- hasat en fazla bir turu kaçırır.

-- ── ÖNCE: mevcut indeksler ──────────────────────────────────────────────────
do $$
declare r record;
begin
  raise notice '--- ÖNCEKİ İNDEKSLER ---';
  for r in
    select indexrelname as ad, pg_size_pretty(pg_relation_size(indexrelid)) as boy
    from pg_stat_user_indexes where relname = 'ictihat_kararlar'
  loop
    raise notice '  % (%)', r.ad, r.boy;
  end loop;
end $$;

-- ── EKSİK İNDEKS ────────────────────────────────────────────────────────────
-- `if not exists`: canlıda elle yaratılmış olabilir; varsa dokunmaz.
create index if not exists ictihat_fts_idx
  on public.ictihat_kararlar using gin (fts);

analyze public.ictihat_kararlar;

-- ── SONRA: doğrulama + ölçüm ────────────────────────────────────────────────
-- `fts` indeksi listede görünmeli. Son satır, ana sorgunun gerçekten indeksi
-- kullanıp kullanmadığını süreyle gösterir.
select 'indeks' as tur,
       i.indexrelname as ad,
       pg_size_pretty(pg_relation_size(i.indexrelid)) as deger
from pg_stat_user_indexes i
where i.relname = 'ictihat_kararlar'
union all
select 'havuz', 'karar sayısı', count(*)::text from public.ictihat_kararlar
union all
select 'sorgu', 'fts taraması (ms)',
       round(extract(epoch from (clock_timestamp() - t0)) * 1000)::text
from (
  select clock_timestamp() as t0,
         (select count(*) from public.ictihat_kararlar k
          where k.fts @@ to_tsquery('turkish', 'kira | tespit')) as n
) z
order by tur, ad;
