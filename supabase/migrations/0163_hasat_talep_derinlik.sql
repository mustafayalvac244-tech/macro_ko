-- 01.10.2026 — SORULAN KONU, BİTMİŞ SAYILSA DA DERİNLEŞSİN (0162'nin devamı).
--
-- CANLIDA ÖLÇÜLDÜ (01.10.2026 05:54): 0162 kurulduktan sonra "kira tespiti"
-- araması sayaca düştü ve "kira tespit davası" önceliği 200 oldu — ama sıraya
-- GİRMEDİ. Sebep: terim `done = true, next_page = 1, total = 571.094`. "Bitti"
-- burada kaynağın tükendiği değil, KENDİ derinlik sınırımıza (50 sayfa × 20 =
-- 1.000 karar) varıldığı anlamına geliyor (bkz. _shared/hasatSayfa.ts) ve
-- bitmiş terim 7 gün sıraya alınmıyor.
--
-- ÇÖZÜM: talep gelen terim sınıra takılarak bitmişse (total > 1.000) ve henüz
-- talep önceliğinde değilse, 51. sayfadan DEVAM ettirilir. harvest-tick talep
-- önceliğindeki (≥ 200) terimde sınırı 200 sayfaya çıkarıyor. Baştan
-- yürütülmez: ilk 50 sayfa zaten havuzda, yeniden gezmek yalnız yinelenen
-- istek üretirdi.
--
-- Kaynak tükenerek biten terim (total ≤ 1.000) dokunulmadan kalır — orada
-- alınacak yeni karar yok, 7 günlük yeniden tarama yeterli.
--
-- SORU METNİ YİNE SAKLANMAZ (bkz. 0162 başlığı).

create or replace function public.hasat_talep_kaydet(p_metin text, p_kaynak text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_metin text := public.tr_kucult(left(coalesce(p_metin, ''), 2000));
  v_sayi  integer;
begin
  if p_kaynak not in ('arama', 'ai') or length(trim(v_metin)) < 3 then
    return 0;
  end if;

  with eslesen as (
    select h.terim
    from public.ictihat_harvest_state h
    where h.terim not like '%:%'
      and length(public.hasat_terim_cekirdek(h.terim)) >= 4
      and position(public.hasat_terim_cekirdek(h.terim) in v_metin) > 0
  ),
  sayac as (
    insert into public.hasat_konu_talep as t (terim, gun, kaynak, adet)
    select terim, current_date, p_kaynak, 1 from eslesen
    on conflict (terim, gun, kaynak) do update set adet = t.adet + 1
    returning t.terim
  )
  update public.ictihat_harvest_state h
  set oncelik   = greatest(coalesce(h.oncelik, 100), 200),
      done      = case when coalesce(h.done, false) and coalesce(h.oncelik, 0) < 200 and coalesce(h.total, 0) > 1000
                       then false else h.done end,
      next_page = case when coalesce(h.done, false) and coalesce(h.oncelik, 0) < 200 and coalesce(h.total, 0) > 1000
                       then 51 else h.next_page end
  from sayac s
  where h.terim = s.terim;

  get diagnostics v_sayi = row_count;
  return v_sayi;
end;
$function$;

revoke execute on function public.hasat_talep_kaydet(text, text) from public, anon, authenticated;
grant execute on function public.hasat_talep_kaydet(text, text) to service_role;
