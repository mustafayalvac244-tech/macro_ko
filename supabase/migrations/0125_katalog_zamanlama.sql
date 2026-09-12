-- KATALOG SAYIMI ZAMANLAMASI + metin hasadını katalogdan besle.
-- ===========================================================================
-- 0124 katalog tablosunu kurdu; bu dosya onu ÇALIŞTIRIR.
--
-- ÖLÇÜLEN GERÇEK (bugün, hasat-tur-teshis raporu, son 6 saat):
--   720 pg_net yanıtının yalnız 264'ü başarılı hasat turuydu.
--     546 WORKER_RESOURCE_LIMIT ... 285
--     403 forbidden ................ 132
--     500 Gateway Timeout ........... 33
--   Başarılı turların BOŞ TUR ORANI %0,0 — yani "yinelenen çok" diye bir sorun
--   hiç yokmuş; çağrıların yarıya yakını iş yapmadan düşüyormuş. Bu dosyadan
--   ÖNCE bunu bilmiyorduk çünkü ölçüm sorgusu payda olarak TÜM pg_net
--   trafiğini sayıyordu (düzeltildi: scripts/hasat-tek-rapor.sql).
--
-- BU YÜZDEN YÜK AZALTILIYOR, ARTTIRILMIYOR:
--   · Katalog turu belge indirmiyor; yalnız arama isteği atıyor. 8 sayfa =
--     800 üstveri satırı ≈ 3 saniye. Metin hasadına göre çok hafif.
--   · Metin hasadı turu artık tek tek değil TOPLU yazıyor ve belgeleri 4'lü
--     havuzda indiriyor; veritabanı gidiş-dönüşü 10'dan 2'ye iniyor. Gateway
--     Timeout ve ona bağlı 403'lerin sebebi tam da bu gidiş-dönüş baskısıydı.
--
-- NEDEN KATALOG DAKİKADA BİR AMA METİN 3 DAKİKADA BİR: katalog isteği UYAP'a
-- 1 istek/tur yükü bindiriyor, metin turu ise 40. Ölçülen güvenli hız
-- eşzamanlılık 4'te 4,24 belge/sn; 3 dakikada 40 belge ≈ 0,22 belge/sn, yani
-- ölçülen tavanın yirmide biri. Kaynak bir KAMU hizmeti; hızın sınırı teknik
-- değil, yasaklanmama riskidir.

-- ── Katalog sayımını tetikleyen fonksiyon ──────────────────────────────────
create or replace function public.katalog_tetikle(p_tur text default 'YARGITAYKARARI', p_sayfa integer default 8)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  anahtar text;
  istek_id bigint;
begin
  -- Disk emniyet freni burada da geçerli (0084 / 0123). Katalog ucuz ama
  -- bedava değil; fren "haberim olsun" düğmesidir.
  if not public.disk_musait_mi() then
    return null;
  end if;

  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  select net.http_post(
    url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/katalog-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anahtar),
    body := jsonb_build_object('tur', p_tur, 'sayfa', p_sayfa),
    timeout_milliseconds := 60000
  ) into istek_id;
  return istek_id;
end;
$$;

revoke all on function public.katalog_tetikle(text, integer) from public, anon, authenticated;
grant execute on function public.katalog_tetikle(text, integer) to service_role;

-- ── hasat_tetikle'ye MOD parametresi ───────────────────────────────────────
-- DİKKAT — BURADA BİR TUZAK VAR. Üçüncü argümanı VARSAYILANLI ekleyip
-- `create or replace` demek YETMEZ: Postgres bunu eskisinin YERİNE koymaz,
-- YENİ BİR AŞIRI YÜK olarak yaratır. O zaman iki argümanlı çağrı
-- (`hasat_tetikle('emsal', 10)` — vekil_hasat_emsal işi tam olarak böyle
-- çağırıyor) iki adaya birden uyar ve BELİRSİZ hâle gelir. Emsal hasadı
-- sessizce durabilirdi.
--
-- Bu yüzden eski imza önce DÜŞÜRÜLÜYOR. Düşürmek üzerindeki grant'leri de
-- siler; bu yüzden hemen aşağıda yeniden veriliyor. (0093'te aynı sebeple
-- DROP'tan kaçınılmıştı — orada yeniden grant verilmiyordu, burada veriliyor.)
drop function if exists public.hasat_tetikle(text, integer);

create or replace function public.hasat_tetikle(
  kaynak text,
  en_fazla integer default 6,
  p_mod text default 'terim'
)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  anahtar text;
  istek_id bigint;
begin
  -- EMNİYET FRENİ: disk sınıra yaklaştıysa arka plan büyümesini durdur.
  if not public.disk_musait_mi() then
    raise notice 'disk esigi asildi — hasat atlandi (kaynak: %)', kaynak;
    return null;
  end if;

  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  select net.http_post(
    url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/harvest-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anahtar
    ),
    body := jsonb_build_object('kaynak', kaynak, 'enFazla', en_fazla, 'mod', p_mod),
    timeout_milliseconds := 120000
  ) into istek_id;
  return istek_id;
end;
$$;

revoke all on function public.hasat_tetikle(text, integer, text) from public, anon, authenticated;
grant execute on function public.hasat_tetikle(text, integer, text) to service_role;

-- ── Zamanlama ──────────────────────────────────────────────────────────────
-- Katalog: iki tür, dakikalar kaydırılmış ki aynı anda vurmasınlar.
select cron.unschedule('vekil_katalog_yargitay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_yargitay');
select cron.unschedule('vekil_katalog_danistay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_danistay');
select cron.schedule('vekil_katalog_yargitay', '0-59/2 * * * *', $$select public.katalog_tetikle('YARGITAYKARARI', 8)$$);
select cron.schedule('vekil_katalog_danistay', '1-59/2 * * * *', $$select public.katalog_tetikle('DANISTAYKARAR', 8)$$);

-- Metin hasadı: KATALOG MODUNA geçiyor. Terim listesi silinmiyor — katalog
-- henüz boşken (ilk saatler) katalog modu "metinsiz karar yok" döndürür ve
-- emsal turu terim modunda çalışmaya devam eder. Yani geçiş sırasında hasat
-- durmaz.
select cron.unschedule('vekil_hasat_yargitay') where exists (select 1 from cron.job where jobname = 'vekil_hasat_yargitay');
select cron.unschedule('vekil_hasat_danistay') where exists (select 1 from cron.job where jobname = 'vekil_hasat_danistay');
select cron.schedule('vekil_hasat_yargitay', '0-59/3 * * * *', $$select public.hasat_tetikle('yargitay', 40, 'katalog')$$);
select cron.schedule('vekil_hasat_danistay', '1-59/3 * * * *', $$select public.hasat_tetikle('danistay', 40, 'katalog')$$);

-- ── Vektörlemenin sıklığı düşürülüyor ──────────────────────────────────────
-- ÖLÇÜM: vekil_vektorle son 6 saatte 360 kez koştu; 285 yanıt
-- WORKER_RESOURCE_LIMIT. Yani denemelerin ~%79'u kaynak yetersizliğinden
-- ölüyor. Üstelik embed-ictihat gövdedeki limiti 6 ile kırpıyor, cron ise 15
-- gönderiyordu — istenen parti boyu hiç uygulanmıyordu.
--
-- DÜRÜST NOT: 285 WORKER_RESOURCE_LIMIT'in TAMAMININ bu işten geldiğini
-- KANITLAYAMIYORUM. net._http_response hangi işlevin yanıtı olduğunu
-- yazmıyor; elimdeki kanıt sayıların örtüşmesi (360 koşu, 285 hata) ve bu
-- işlevin modülü yüklerken gte-small modelini belleğe almasıdır. Bu bir
-- korelasyon, kanıt değil. Sıklığı düşürmek hem yükü azaltır hem de bir
-- sonraki ölçümde ayrımı netleştirir: hata sayısı bu işle orantılı düşerse
-- kaynağı buydu.
select cron.unschedule('vekil_vektorle') where exists (select 1 from cron.job where jobname = 'vekil_vektorle');
select cron.schedule('vekil_vektorle', '*/3 * * * *', $$select public.vektorle_tetikle('ictihat', 6)$$);

-- Doğrulama.
select jobname, schedule, active from cron.job
where jobname in ('vekil_katalog_yargitay', 'vekil_katalog_danistay',
                  'vekil_hasat_yargitay', 'vekil_hasat_danistay',
                  'vekil_hasat_emsal', 'vekil_vektorle')
order by jobname;
