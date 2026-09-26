-- SALT OKUNUR ÖLÇÜM — hiçbir şey yazmaz.
--
-- ÖLÇÜM ARACININ KENDİSİ SORUNA KATKIDAYDI (19.09.2026). Bu dosyanın eski
-- hâli `count(*) filter (where embedding is not null)` kullanıyordu: bu, tüm
-- tabloyu (100 bin satır, her birinde tam metin + 384 boyutlu vektör) taramak
-- demek ve dakikalarca sürüyor. Yani "yük var mı" diye bakan sorgu, yükün bir
-- parçasıydı.
--
-- Artık yalnız KISMİ İNDEKSTEN okunuyor:
--   ictihat_embedding_missing_idx  ON (id) WHERE embedding IS NULL
-- Bu indeks yalnız vektörsüz kayıtları tutuyor, sayımı indeks-içi yapılıyor.
-- Toplam satır sayısı ise pg_class.reltuples'tan TAHMİN olarak alınıyor ve
-- adında öyle yazıyor — kesin sayıymış gibi sunulmuyor.
--
-- Tek ifade: çok ifadeli dosyada yalnız SON ifade döner (skill kuralı).
select olcum, deger from (
  select 1 as sira, 'embedding YOK (kesin, kismi indeks)' as olcum,
         coalesce(count(*)::text, 'YOK (!)') as deger
    from public.ictihat_kararlar where embedding is null
  union all
  select 2, 'toplam karar (TAHMIN, reltuples)',
         coalesce(nullif(reltuples, -1)::bigint::text, 'YOK (!)')
    from pg_class where oid = 'public.ictihat_kararlar'::regclass
  union all
  select 3, 'olcum ani', now()::text
  union all
  select 4, 'vektorle cron isi',
         coalesce(string_agg(jobname || ' @ ' || schedule || ' :: ' || command, ' | '), 'YOK (!)')
    from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 5, 'toplam aktif cron isi',
         coalesce(count(*)::text, 'YOK (!)') from cron.job where active
  union all
  select 6, 'son 10 dk BASARILI cagri',
         coalesce(count(*)::text, 'YOK (!)')
    from net._http_response
    where created > now() - interval '10 minutes' and content like '%processed%'
  union all
  select 7, 'son 10 dk KAYNAK HATASI',
         coalesce(count(*)::text, 'YOK (!)')
    from net._http_response
    where created > now() - interval '10 minutes' and content like '%WORKER_RESOURCE_LIMIT%'
  union all
  select 8, 'ornek yanit govdesi',
         coalesce(left(max(content), 160), 'YANIT YOK (!)')
    from net._http_response
    where created > now() - interval '10 minutes' and content like '%processed%'
  union all
  select 9, 'son 10 dk gelen yeni karar (hasat)',
         coalesce(count(*)::text, 'YOK (!)')
    from public.ictihat_kararlar
    where created_at > now() - interval '10 minutes'
  union all
  select 10, 'mevzuat embedding YOK',
         coalesce(count(*)::text, 'YOK (!)')
    from public.mevzuat_maddeleri where embedding is null
  union all
  select 11, 'not', 'hiz = 1. satirin DUSUSU / 3. satirin farki'
) ozet order by sira;
