-- KULLANICI TRAFİĞİNE ÖNCELİK: katalog hasadı mesai saatlerinde kısılıyor.
-- ===========================================================================
-- NEDEN. Bu sürümle yapay zekâ beslemesi de (ai-chat/buildGrounding) havuz
-- yetersiz kaldığında CANLI UYAP'a gidiyor. Yani aynı kamu kaynağına artık iki
-- taraf birden dokunuyor: arka plan katalog hasadı ve avukatın beklediği
-- istek. Bu ikisi eşit değildir — biri bir tur gecikirse kimse görmez, diğeri
-- gecikirse avukat ekrana bakarak bekler.
--
-- BU BİR TAHMİN DEĞİL, BUGÜN ÖLÇÜLDÜ. Katalog işi 4 eşzamanlı istekle
-- çalışırken kaynağa ek bir ölçüm isteği attım:
--   · ilk deneme: HTTP 429 Too Many Requests
--   · ikinci deneme: TLS el sıkışması zaman aşımı, ardından dört tekrarla
--     ancak 34,86 saniyede sonuç (sağlıklıyken aynı arama 1,08 sn).
-- Yani kaynağın tavanı gerçek ve biz ona bugün kendimiz dayandık.
--
-- ÇÖZÜM: bütçeyi saate göre böl. Mesai saatlerinde (TR 09:00-19:00 =
-- UTC 06:00-16:00) tur başına istek 30 → 10; gece tam hızda. Katalogun
-- tamamlanması uzar ama gündüz avukatın cevabı hızlı gelir. Doğru takas bu:
-- katalog bir kerelik bir iş, kullanıcı deneyimi her gün tekrarlanıyor.
--
-- NEDEN CRON DEĞİL DE FONKSİYON. Saati cron'a yazmak dört ayrı iş satırı
-- (tür × gündüz/gece) demekti ve dördü birbiriyle tutarlı tutulmak zorunda
-- kalırdı. Karar tek yerde: fonksiyonun kendisi saate bakıyor.

create or replace function public.katalog_tetikle(
  p_tur text default 'YARGITAYKARARI',
  -- NULL geçilirse bütçeyi SAAT belirler. Sayı geçilirse o kullanılır —
  -- elle tek seferlik hızlandırma hâlâ mümkün olsun.
  p_sayfa integer default null
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  anahtar text;
  istek_id bigint;
  v_istek integer;
  v_saat integer;
begin
  if not public.disk_musait_mi() then
    return null;
  end if;

  v_saat := extract(hour from (now() at time zone 'UTC'))::int;
  -- UTC 06-15 → TR 09-18 (mesai). Kalan saatler gece sayılır.
  v_istek := coalesce(p_sayfa, case when v_saat between 6 and 15 then 10 else 30 end);

  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  select net.http_post(
    url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/katalog-tick',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anahtar),
    body := jsonb_build_object('tur', p_tur, 'istek', v_istek),
    timeout_milliseconds := 60000
  ) into istek_id;
  return istek_id;
end;
$$;

revoke all on function public.katalog_tetikle(text, integer) from public, anon, authenticated;
grant execute on function public.katalog_tetikle(text, integer) to service_role;

-- Cron artık bütçeyi DAYATMIYOR: kararı fonksiyona bırakıyor.
select cron.unschedule('vekil_katalog_yargitay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_yargitay');
select cron.unschedule('vekil_katalog_danistay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_danistay');
select cron.schedule('vekil_katalog_yargitay', '0-59/4,1-59/4,2-59/4 * * * *', $$select public.katalog_tetikle('YARGITAYKARARI')$$);
select cron.schedule('vekil_katalog_danistay', '3-59/4 * * * *', $$select public.katalog_tetikle('DANISTAYKARAR')$$);

-- Doğrulama: şu anki saat hangi bütçeye denk geliyor?
select
  extract(hour from (now() at time zone 'UTC'))::int as utc_saat,
  case when extract(hour from (now() at time zone 'UTC'))::int between 6 and 15
       then 'mesai — tur başına 10 istek'
       else 'gece — tur başına 30 istek' end as bütçe,
  (select string_agg(jobname || ' → ' || schedule, ' | ' order by jobname)
     from cron.job where jobname like 'vekil_katalog%') as zamanlama;
