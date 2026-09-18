-- Vekil Pro :: vektörleme darboğazını açar
-- ===========================================================================
-- ÖLÇÜM (18.09.2026, canlı):
--
--   ictihat_kararlar            96.194 karar
--   embedding VAR               25.573   (%26,6)
--   embedding YOK               70.663
--   hasat hızı                  ~511 karar/saat  (12 saattir sabit)
--   vektörleme hızı             ~68 karar/saat
--
-- Yani havuz saatte 511 büyürken vektörleme 68 yapıyordu: açık saatte ~443
-- kayıt BÜYÜYORDU. Vektörsüz karar anlamsal aramada GÖRÜNMEZ; havuz
-- büyüdükçe arama kalitesi geriliyordu.
--
-- SEBEP — ölçüldü, tahmin değil:
--   cron işi 18 her 3 dakikada `vektorle_tetikle('ictihat', 6)` çağırıyordu.
--   Son 3 saatteki 60 çağrının 60'ı da 546 WORKER_RESOURCE_LIMIT ile düştü.
--   Cron kapatılıp yalıtılmış tek çağrı yapıldığında da aynı hata geldi
--   (istek 21652) — yani yük değil, YIĞIN BOYUTU sorunuydu. Edge işlevinin
--   kendi yorumu zaten "4 güvenli, 8 düşüyor" diyordu; cron 6 istiyordu.
--
--   Kayıtlar tek tek update edildiği için çöküşten ÖNCE yazılanlar kalıyordu.
--   Bu yüzden vektörleme dışarıdan "yavaş çalışıyor" gibi görünüyordu; oysa
--   HER ÇAĞRI HATA VERİYORDU. Kısmi başarı, tam arızayı gizledi.
--
-- ÇÖZÜM — iki parça:
--   1) Yığın küçülür (3), böylece çağrı tamamlanır.
--   2) Tek iş yerine PARALEL işler dakikada bir koşar. Tek iş 3 dakikada bir
--      3 kayıt = 60/saat yapardı; bu hasadın 1/8'i. 8 iş × dakikada bir × 3
--      kayıt = 1.440/saat.
--
--   Paralel işler AYNI satırları seçmesin diye edge işlevine `atla` (offset)
--   eklendi: her iş farklı bir pencereye bakar, kümeler ayrıktır.
--   İşlev zaten idempotent (yalnız embedding'i NULL olanı işler), o yüzden
--   çakışma olsa bile bozulma değil, yalnız boşa hesap olur.
--
-- BEKLENTİ (hesap, henüz ÖLÇÜM DEĞİL): 1.440 − 511 = ~929/saat net kapanma,
-- 70.663 birikim ≈ 76 saat ≈ 3 gün. Bu sayı uygulandıktan SONRA ölçülecek;
-- şu an yalnız aritmetiktir ve öyle okunmalıdır.

-- ── 1) vektorle_tetikle: atlama parametresi ────────────────────────────────
create or replace function public.vektorle_tetikle(
  kaynak text default 'ictihat',
  en_fazla integer default 3,
  atla integer default 0
)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  anahtar text;
  istek_id bigint;
begin
  if not public.disk_musait_mi() then
    raise notice 'disk esigi asildi — vektorleme atlandi';
    return null;
  end if;

  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  select net.http_post(
    url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/embed-ictihat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anahtar
    ),
    -- DİKKAT: bu uçta gövde anahtarı 'limit' — 'enFazla' DEĞİL. Mevcut canlı
    -- fonksiyondan birebir okundu; yanlış yazılsaydı vektörleme sessizce
    -- varsayılan yığın boyutuna düşerdi.
    body := jsonb_build_object('kaynak', kaynak, 'limit', en_fazla, 'atla', atla),
    timeout_milliseconds := 120000
  ) into istek_id;
  return istek_id;
end;
$function$;

-- ── 2) Eski tek iş gider, paralel işler gelir ──────────────────────────────
do $$
declare
  isci_sayisi constant int := 8;   -- tek ayar noktası: buradan büyütülür
  yigin       constant int := 3;   -- ölçülen güvenli yığın
  i int;
  ad text;
begin
  -- Eski iş (her 3 dk, yığın 6 — %100 hata veren yapılandırma).
  perform cron.unschedule('vekil_vektorle')
  where exists (select 1 from cron.job where jobname = 'vekil_vektorle');

  for i in 0..(isci_sayisi - 1) loop
    ad := 'vekil_vektorle_' || i;
    perform cron.unschedule(ad) where exists (select 1 from cron.job where jobname = ad);
    perform cron.schedule(
      ad,
      '* * * * *',
      format('select public.vektorle_tetikle(%L, %s, %s)', 'ictihat', yigin, i * yigin)
    );
  end loop;
end $$;

-- ── 3) Tek ifadeli doğrulama ───────────────────────────────────────────────
-- (Skill kuralı: çok ifadeli dosyada YALNIZ SON ifade döner. Bu yüzden
--  doğrulama tek select ve union all ile.)
select olcum, deger from (
  select 1 as sira, 'vektorle isleri' as olcum,
         coalesce(count(*)::text, 'YOK (!)') as deger
  from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 2, 'hepsi dakikalik mi',
         coalesce(string_agg(distinct schedule, ' | '), 'YOK (!)')
  from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 3, 'atlama degerleri',
         coalesce(string_agg(substring(command from 'vektorle_tetikle\(.*?, .*?, ([0-9]+)\)'), ',' order by jobname), 'YOK (!)')
  from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 4, 'embedding YOK',
         coalesce(count(*) filter (where embedding is null)::text, 'YOK (!)')
  from public.ictihat_kararlar
) ozet order by sira;
