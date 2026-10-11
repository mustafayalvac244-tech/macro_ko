-- KATALOG GERİ TARAMASI 30 → 180 GÜN, YENİDEN AÇILAN PENCERE ÖNE ALINIR (09.10.2026).
-- ===========================================================================
-- Ürün sahibi: "Göç hasat işleri sürekli çalışsın."
--
-- 0175'teki iki varsayım canlı ölçümle çürüdü:
--
-- 1) "30 GÜN GERİ TARAMA YETER" — TAHMİNDİ, YANLIŞ ÇIKTI.
--    Ölçüm (execute_sql, 09.10): taranmış Yargıtay pencerelerinde hafta içi
--    gün başına karar, pencerenin TARANDIĞI ana göre:
--      2026-04: 609 · 2026-05: 458 · 2026-06: 295 · 2026-07: 50 · 2026-08: 1
--    (Nisan–Temmuz pencereleri 12.09–07.10 arasında, Ağustos 12–13.09'da,
--    Eylül sonrası 09.10'da tarandı.) 09.10'da ilk kez taranan 13.09–24.09
--    günleri 0–85 karar verdi; 2025-09 → 2026-04 aylarında ortalama 514–755. Yani kaynak kararı aylarca geç yayımlıyor (ÇIKARIM: yoğunluk
--    tarihten uzaklaştıkça artıyor; sebebin yayın gecikmesi olduğu ölçülmedi).
--    30 günlük geri tarama Haziran–Ağustos'a hiç dönmezdi; oradaki kararlar
--    havuza hiç girmezdi.
--
-- 2) YENİDEN AÇILAN PENCERE SIRAYA GİRMİYORDU.
--    katalog-tick sırası: son_calisma ARTAN (boşlar önce), sonra gün AZALAN.
--    0175 yeniden açarken son_calisma'ya dokunmuyordu. Ölçüm (09.10): 3.212
--    bitmemiş eski pencere var, tur başına 10 pencere, saatte 2 tur → bir tam
--    dolaşma ~160 saat (~6,7 gün). Yeni taranmış bir pencere yeniden açılınca
--    o sıranın SONUNA düşüyor, yani haftalık geri tarama ancak bir sonraki
--    haftalık geri taramaya yetişiyordu.
--    Şimdi yeniden açılan pencerenin son_calisma'sı boşaltılır → yeni günlerle
--    birlikte en öne, en yeni gün önce. (katalog-durum.sql'deki "hiç
--    işlenmemiş" sayısı bu yüzden yeniden açılanları da içerir.)
--
-- MALİYET (hesap, ölçüm değil): son 180 günde biten ~155 Yargıtay penceresi,
--   toplam ~25.900 satır → ~415 arama isteği → tur başına 10 → ~42 tur
--   (~21 saat, haftada bir). Tur boyu DEĞİŞMEDİ: veritabanına tur başına
--   yazılan satır sayısı aynı (≤1.000), yalnız hangi pencerenin işlendiği
--   değişiyor. O ~21 saatte eski (2005–2025) birikim bekler.
--   Danıştay: 180 güne düşen 6–7 ay penceresi, 2026'da ayda 0–159 karar.
--
-- GERİ ALMA:
--   select cron.unschedule('vekil_katalog_pencere_haftalik');
--   select cron.schedule('vekil_katalog_pencere_haftalik', '40 3 * * 1', $$select public.katalog_pencere_yenile(30)$$);
--   (Yeniden açılmış pencereler zararsız; katalog upsert'i ignoreDuplicates.)

create or replace function public.katalog_pencere_yenile(p_geri_gun integer default 0)
returns table(yargitay_eklenen integer, danistay_eklenen integer, yeniden_acilan integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_dun date := v_bugun - 1;
  v_ay date := date_trunc('month', v_bugun)::date;
  v_y_son date;
  v_d_son date;
  v_y integer := 0;
  v_d integer := 0;
  v_a integer := 0;
  v_ek integer := 0;
begin
  select max(gun) into v_y_son from public.ictihat_katalog_pencere where tur = 'YARGITAYKARARI';
  select max(gun) into v_d_son from public.ictihat_katalog_pencere where tur = 'DANISTAYKARAR';

  if v_y_son is not null and v_y_son < v_dun then
    insert into public.ictihat_katalog_pencere (tur, gun, bitis)
    select 'YARGITAYKARARI', g::date, g::date
    from generate_series(v_y_son + 1, v_dun, interval '1 day') as g
    on conflict (tur, gun) do nothing;
    get diagnostics v_y = row_count;
  end if;

  if v_d_son is not null and v_d_son < v_ay then
    insert into public.ictihat_katalog_pencere (tur, gun, bitis)
    select 'DANISTAYKARAR', a::date, (a + interval '1 month - 1 day')::date
    from generate_series((date_trunc('month', v_d_son) + interval '1 month')::date, v_ay, interval '1 month') as a
    on conflict (tur, gun) do nothing;
    get diagnostics v_d = row_count;
  end if;

  -- İçinde bulunulan ayın Danıştay penceresi ay bitene kadar her gün açılır.
  update public.ictihat_katalog_pencere
     set bitti = false, sonraki_sayfa = 1, son_calisma = null
   where tur = 'DANISTAYKARAR' and gun = v_ay and bitti;
  get diagnostics v_a = row_count;

  if p_geri_gun > 0 then
    update public.ictihat_katalog_pencere
       set bitti = false, sonraki_sayfa = 1, son_calisma = null
     where bitti and bitis >= v_bugun - p_geri_gun;
    get diagnostics v_ek = row_count;
    v_a := v_a + v_ek;
  end if;

  return query select v_y, v_d, v_a;
end;
$function$;

revoke all on function public.katalog_pencere_yenile(integer) from public, anon, authenticated;
grant execute on function public.katalog_pencere_yenile(integer) to service_role;

-- Pazartesi 06:40 TR: son 180 günü yeniden tara.
select cron.unschedule('vekil_katalog_pencere_haftalik') where exists (select 1 from cron.job where jobname = 'vekil_katalog_pencere_haftalik');
select cron.schedule('vekil_katalog_pencere_haftalik', '40 3 * * 1', $$select public.katalog_pencere_yenile(180)$$);

-- İlk geri tarama hemen (pazartesiyi beklemeden). AYRI ifade.
select public.katalog_pencere_yenile(180);

-- Doğrulama (TEK İFADE: uygulayıcı yalnız son ifadenin satırlarını döndürür).
select olcum, deger from (
  select 1 as sira, 'öne alınmış bitmemiş pencere (yargıtay / danıştay)' as olcum,
    (select format('%s / %s',
       count(*) filter (where tur = 'YARGITAYKARARI'),
       count(*) filter (where tur = 'DANISTAYKARAR'))
     from public.ictihat_katalog_pencere where not bitti and son_calisma is null) as deger
  union all
  select 2, 'haftalık zamanlama',
    coalesce((select command from cron.job where jobname = 'vekil_katalog_pencere_haftalik'), 'YOK (!)')
) ozet
order by sira;
