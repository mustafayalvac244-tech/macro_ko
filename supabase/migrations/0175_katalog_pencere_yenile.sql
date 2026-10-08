-- KATALOG PENCERELERİ YENİ GÜNLER İÇİN AÇILMIYORDU (08.10.2026).
-- ===========================================================================
-- BULUNAN KUSUR (denetimde bulundu, canlıda ölçüldü 08.10):
--   • ictihat_katalog_pencere YALNIZ göç anında tohumlanıyor (0124: 2005 →
--     o günün tarihi; 0127: Danıştay ay pencereleri → o ayın sonu). Sonrası
--     için pencere ekleyen HİÇBİR şey yok.
--   • Ölçüm (execute_sql, 08.10): Yargıtay'ın en yeni penceresi 2026-09-12;
--     Danıştay'ın 261 penceresinin 261'i bitti ve katalog-tick her turda
--     'pencere_yok' dönüyor.
--   • Sonuç: 13.09.2026'dan sonra verilen Yargıtay/Danıştay kararları katalog
--     yoluyla havuza HİÇ girmiyor (metin hasadı katalogdan beslenir).
--   • Tohum anındaki "bugün" ve "bu ay" pencereleri o gün taranıp `bitti`
--     oldu; sonradan yayımlanan kararlar için bir daha açılmıyor.
--
-- ÇÖZÜM: public.katalog_pencere_yenile(p_geri_gun)
--   1) Yargıtay: son pencereden DÜNE kadar günlük pencere ekler (TR saati).
--      Bugünün penceresi eklenmez: gün bitmeden taranırsa `bitti` olur ve o
--      günün geri kalanı kaçar.
--   2) Danıştay: son ay penceresinden İÇİNDE BULUNULAN aya kadar ay penceresi
--      ekler. İçinde bulunulan ayın penceresi her gün yeniden açılır (ay
--      bitmeden `bitti` olması, ayın kalanını kaçırırdı).
--   3) p_geri_gun > 0 ise bitişi son p_geri_gun gün içinde olan BİTMİŞ
--      pencereleri yeniden açar (geç yayımlanan kararlar için).
--
-- SAYILAR:
--   • Günlük ek yük: 1 Yargıtay penceresi (ölçülmüş: günde ~1.300–3.600
--     karar → ~13–36 sayfa, 0127 başlığı) + Danıştay'ın içinde bulunulan ayı
--     (en yoğun ay ~76 sayfa, 0127). Ölçülen tempo ~1.100 istek/saat (0127).
--   • 30 GÜNLÜK GERİYE TARAMA bir TAHMİNDİR, ÖLÇÜLMEDİ: kaynağın kararı kaç
--     gün geç yayımladığını bilmiyoruz. Haftada bir koşar.
--   • İlk koşuda birikmiş açık: 13.09 → dün arası ~25 Yargıtay günü.
--
-- GERİ ALMA:
--   select cron.unschedule('vekil_katalog_pencere_gunluk');
--   select cron.unschedule('vekil_katalog_pencere_haftalik');
--   (Eklenen pencereler zararsız; katalog upsert'i ignoreDuplicates.)

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
     set bitti = false, sonraki_sayfa = 1
   where tur = 'DANISTAYKARAR' and gun = v_ay and bitti;
  get diagnostics v_a = row_count;

  if p_geri_gun > 0 then
    update public.ictihat_katalog_pencere
       set bitti = false, sonraki_sayfa = 1
     where bitti and bitis >= v_bugun - p_geri_gun;
    get diagnostics v_ek = row_count;
    v_a := v_a + v_ek;
  end if;

  return query select v_y, v_d, v_a;
end;
$function$;

revoke all on function public.katalog_pencere_yenile(integer) from public, anon, authenticated;
grant execute on function public.katalog_pencere_yenile(integer) to service_role;

-- Her gün 06:10 TR (03:10 UTC): yeni günler ve bu ayın Danıştay penceresi.
select cron.unschedule('vekil_katalog_pencere_gunluk') where exists (select 1 from cron.job where jobname = 'vekil_katalog_pencere_gunluk');
select cron.schedule('vekil_katalog_pencere_gunluk', '10 3 * * *', $$select public.katalog_pencere_yenile(0)$$);
-- Pazartesi 06:40 TR: son 30 günü yeniden tara (30 = TAHMİN, ölçülmedi).
select cron.unschedule('vekil_katalog_pencere_haftalik') where exists (select 1 from cron.job where jobname = 'vekil_katalog_pencere_haftalik');
select cron.schedule('vekil_katalog_pencere_haftalik', '40 3 * * 1', $$select public.katalog_pencere_yenile(30)$$);

-- İlk koşu: birikmiş açığı (13.09 → dün) hemen kapatır. AYRI ifade: aynı
-- ifadedeki alt sorgular başlangıç anlık görüntüsünü okur, eklenenleri görmezdi.
select public.katalog_pencere_yenile(0);

-- Doğrulama (TEK İFADE: uygulayıcı yalnız son ifadenin satırlarını döndürür).
select olcum, deger from (
  select 2 as sira, 'yargıtay en yeni pencere' as olcum,
    coalesce((select max(gun)::text from public.ictihat_katalog_pencere where tur = 'YARGITAYKARARI'), 'YOK (!)') as deger
  union all
  select 3, 'danıştay en yeni pencere',
    coalesce((select max(gun)::text from public.ictihat_katalog_pencere where tur = 'DANISTAYKARAR'), 'YOK (!)')
  union all
  select 4, 'bitmemiş pencere (yargıtay / danıştay)',
    (select format('%s / %s',
       count(*) filter (where tur = 'YARGITAYKARARI' and not bitti),
       count(*) filter (where tur = 'DANISTAYKARAR' and not bitti))
     from public.ictihat_katalog_pencere)
  union all
  select 5, 'zamanlama',
    coalesce((select string_agg(jobname || ' → ' || schedule, ' | ' order by jobname)
       from cron.job where jobname like 'vekil_katalog_pencere%'), 'YOK (!)')
) ozet
order by sira;
