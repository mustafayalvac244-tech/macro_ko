-- 05.10.2026 — RESMÎ GAZETE GÜNLÜK FİHRİSTİ (ürün sahibi: "Resmî Gazete özetini ekle").
--
-- Kaynak: resmigazete.gov.tr günlük fihristi; ayrıştırma
-- supabase/functions/_shared/resmiGazete.ts, çekme supabase/functions/resmi-gazete.
--
-- PAYLAŞILAN TABLO — BİLİNÇLİ KARAR. Satırlar kişisel veri değil, herkese
-- açık resmî yayının başlıklarıdır; her kullanıcı aynı satırı okur. Okuma
-- yalnız giriş yapmış kullanıcıya açık (anon kapalı); yazma yalnız
-- service_role (uç işlevi). KVKK metnine etkisi yok: kişisel veri işlenmiyor.
--
-- ZAMANLAMA: günde 8 tur (3 saatte bir, UTC :17). Tek tur = kaynağa 1 istek
-- (+ varsa mükerrer sayfası). 05.10 sayısı 06:24 UTC'de yayındaydı (ölçüldü);
-- ilk yayın anı ve mükerrer sayının yayın saati ÖLÇÜLMEDİ — tek tur onları
-- kaçırabilirdi. Kaynak arada cevap vermiyor
-- (ölçüldü: 31 istekte 10 zaman aşımı) — bir tur düşerse sonraki tamamlar.
-- GERİ ALMA: select cron.unschedule('vekil_resmi_gazete');

create table if not exists public.resmi_gazete (
  tarih     date primary key,
  sayi      integer,
  maddeler  jsonb not null default '[]'::jsonb,
  mukerrer  integer not null default 0,
  cekildi   timestamptz not null default now()
);

alter table public.resmi_gazete enable row level security;

drop policy if exists "resmi_gazete okuma" on public.resmi_gazete;
create policy "resmi_gazete okuma" on public.resmi_gazete
  for select to authenticated using (true);

revoke all on table public.resmi_gazete from anon;
grant select on table public.resmi_gazete to authenticated;

create or replace function public.resmi_gazete_tetikle(p_tarih date default null)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  anahtar text;
  istek_id bigint;
begin
  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  select net.http_post(
    url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/resmi-gazete',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anahtar
    ),
    body := case when p_tarih is null then '{}'::jsonb
                 else jsonb_build_object('tarih', to_char(p_tarih, 'YYYY-MM-DD')) end,
    timeout_milliseconds := 120000
  ) into istek_id;
  return istek_id;
end;
$$;

revoke all on function public.resmi_gazete_tetikle(date) from public, anon, authenticated;
grant execute on function public.resmi_gazete_tetikle(date) to service_role;

select cron.unschedule('vekil_resmi_gazete') where exists (select 1 from cron.job where jobname = 'vekil_resmi_gazete');
select cron.schedule('vekil_resmi_gazete', '17 */3 * * *', $$select public.resmi_gazete_tetikle()$$);
