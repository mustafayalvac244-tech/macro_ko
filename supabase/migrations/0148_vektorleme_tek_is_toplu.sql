-- Vekil Pro :: N ayrı cron işi yerine TEK iş, içinden N asenkron istek
-- ===========================================================================
-- NEDEN TASARIM DEĞİŞİYOR.
--
-- 0144/0146/0147 her işçi için AYRI bir pg_cron işi kurdu (8, 16, 32). Bu
-- yaklaşımın görünmez bir tavanı var: pg_cron'un aynı anda koşabileceği iş
-- sayısı sınırlı (`cron.max_running_jobs`, tipik varsayılan 32). Tavan
-- aşıldığında işler HATA VERMEZ — sessizce atlanır. Yani 64 iş kurmak, 64
-- işçi çalıştığı ANLAMINA GELMEZ ve fark ölçüme "doyum" gibi yansır.
-- Yanlış teşhis, teşhissizlikten kötüdür.
--
-- Bu göç tavanı tamamen dolanıyor: TEK cron işi, içinden N adet
-- `net.http_post` kuyruklar. pg_net asenkron olduğu için istekler anında
-- kuyruğa girer, iş hemen biter; hiçbiri pg_cron'un eşzamanlılık bütçesini
-- tutmaz. İşçi sayısı artık tek bir SAYI — ayarlamak için yeni iş kurmak
-- gerekmiyor.
--
-- Ayrıca iki ufak israf kalkıyor: vault anahtarı ve disk kontrolü, her
-- istek için değil, tur başına BİR KEZ yapılıyor.
--
-- ÖLÇÜM ZİNCİRİ (18.09.2026, hepsi canlı ve zaman damgalı):
--   işçi   pencere                       Δ embedding   hız/saat   hata(10dk)
--    1*    eski yapılandırma                       —      ~68      %100
--    8     21:06:46 → 21:11:56 (310 sn)         +100    1.161       0
--    8     21:07:48 → 21:11:56 (248 sn)          +79    1.147       0
--   16     21:13:12 → 21:20:40 (448 sn)         +298    2.395       3
--   32     21:23:01 → 21:25:12 (131 sn)         +124    3.408       1 (5dk)
--   * tek iş, 3 dakikada bir, yığın 6 → HER çağrı düşüyordu.
--
-- 32'nin penceresi kısa (131 sn), o yüzden gürültülü — ama yön net:
-- doğrusal olsa 4.790 beklenirdi, 3.408 geldi (%71). Bu, tam olarak
-- `cron.max_running_jobs = 32` tavanının bırakacağı iz.
--
-- ÖLÇÜLDÜ: cron.max_running_jobs = 32, toplam AKTİF cron işi = 42.
-- Yani 32 vektörleme işi tavanı tek başına dolduruyordu ve geri kalan 10 iş
-- (hasat, katalog, yedek) aynı bütçe için yarışıyordu. Vektörlemeyi
-- büyütmek, HASADI aç bırakma riski taşıyordu. Bu göç o riski de kaldırıyor:
-- vektörleme artık tek bir cron yuvası tutuyor, 32 değil.

create or replace function public.vektorle_toplu(
  kaynak text default 'ictihat',
  isci integer default 32,
  yigin integer default 3
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  anahtar text;
  i int;
  kuyruklanan int := 0;
begin
  if not public.disk_musait_mi() then
    raise notice 'disk esigi asildi — vektorleme atlandi';
    return 0;
  end if;

  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  for i in 0..(isci - 1) loop
    perform net.http_post(
      url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/embed-ictihat',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anahtar
      ),
      -- Gövde anahtarı 'limit' — 'enFazla' DEĞİL (canlı uçtan okundu).
      body := jsonb_build_object('kaynak', kaynak, 'limit', yigin, 'atla', i * yigin),
      timeout_milliseconds := 120000
    );
    kuyruklanan := kuyruklanan + 1;
  end loop;

  return kuyruklanan;
end;
$function$;

do $$
declare
  isci_sayisi constant int := 64;
  i int;
  ad text;
begin
  -- Eski tek tek işler kalkıyor (0..127 aralığı süpürülüyor).
  for i in 0..127 loop
    ad := 'vekil_vektorle_' || i;
    perform cron.unschedule(ad) where exists (select 1 from cron.job where jobname = ad);
  end loop;
  perform cron.unschedule('vekil_vektorle')
  where exists (select 1 from cron.job where jobname = 'vekil_vektorle');

  perform cron.unschedule('vekil_vektorle_toplu')
  where exists (select 1 from cron.job where jobname = 'vekil_vektorle_toplu');

  perform cron.schedule(
    'vekil_vektorle_toplu',
    '* * * * *',
    format('select public.vektorle_toplu(%L, %s, 3)', 'ictihat', isci_sayisi)
  );
end $$;

select olcum, deger from (
  select 1 as sira, 'tek tek is kaldi mi' as olcum,
         coalesce(count(*)::text, 'YOK (!)') as deger
    from cron.job where jobname ~ '^vekil_vektorle_[0-9]+$'
  union all
  select 2, 'toplu is',
         coalesce(string_agg(jobname || ' @ ' || schedule, ' | '), 'YOK (!)')
    from cron.job where jobname = 'vekil_vektorle_toplu'
  union all
  select 3, 'embedding VAR',
         coalesce(count(*) filter (where embedding is not null)::text, 'YOK (!)')
    from public.ictihat_kararlar
  union all
  select 4, 'olcum ani', now()::text
) ozet order by sira;
