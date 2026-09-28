-- 28.09.2026 — DENEME TAKİBİ (ürün sahibi: "denemedeki soruları takip edeceğiz").
--
-- Ücretsiz katmana 5 deneme sorusu açıldı (katman.ts > UCRETSIZ_DENEME_LIMIT).
-- Bu fonksiyon yönetici ekranı için kimin denediğini, kaçını kullandığını,
-- hangi işte kullandığını, kaçının hata alıp iade edildiğini ve kaçının
-- ücretliye geçtiğini döker.
--
-- SORU METNİ YOK — BİLEREK. ai_istek metni hiç saklamıyor (ai-chat:
-- "Soru metni SAKLANMAZ"). Avukatın sorusu müvekkil bilgisi içerebilir
-- (Av.K. m.36) ve aydınlatma metni metnin yalnız yanıt için gönderildiğini
-- söylüyor. Metni saklamak ayrı bir karar + metin değişikliği ister.
--
-- "Deneme isteği" tanımı: 'ai' katmanında OLMAYAN kullanıcının ai_istek
-- satırı (ücretsiz → Haiku, ₺399 → deneme modeli). 'ai' katmanı kendi
-- kotasını kullanır ve buraya girmez.

create or replace function public.admin_deneme_takibi(p_limit integer default 50)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare sonuc json;
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;

  with deneyen as (
    select p.id, p.full_name, coalesce(p.is_premium, false) as premium, coalesce(p.ai_tier, '') as tier,
           coalesce(p.deneme_soru_kullanildi, 0) as kullanilan
    from public.profiles p
    where coalesce(p.deneme_soru_kullanildi, 0) > 0 and coalesce(p.ai_tier, '') <> 'ai'
  ),
  istek as (
    select i.user_id, i.mod, i.iade_edildi, i.olusturuldu
    from public.ai_istek i
    join public.profiles p on p.id = i.user_id
    where coalesce(p.ai_tier, '') <> 'ai'
  )
  select json_build_object(
    'deneyen_kisi',        (select count(*) from deneyen),
    'ucretsiz_bitiren',    (select count(*) from deneyen where not premium and kullanilan >= 5),
    'ucretliye_gecen',     (select count(*) from public.profiles p
                              where coalesce(p.deneme_soru_kullanildi, 0) > 0
                                and (coalesce(p.is_premium, false) or p.ai_tier = 'ai')),
    'son7_istek',          (select count(*) from istek where olusturuldu > now() - interval '7 days'),
    'son7_iade',           (select count(*) from istek where olusturuldu > now() - interval '7 days' and iade_edildi),
    'mod_dagilim',         (select coalesce(json_agg(x order by x.adet desc), '[]'::json) from (
                              select mod, count(*) as adet from istek
                              where olusturuldu > now() - interval '30 days' group by mod) x),
    'kisiler',             (select coalesce(json_agg(k order by k.son desc nulls last), '[]'::json) from (
                              select d.full_name as ad, d.premium, d.kullanilan,
                                     (select max(olusturuldu) from istek where user_id = d.id) as son,
                                     (select count(*) from istek where user_id = d.id and iade_edildi) as iade,
                                     (select string_agg(distinct mod, ', ') from istek where user_id = d.id) as modlar
                              from deneyen d
                              order by son desc nulls last
                              limit greatest(1, least(coalesce(p_limit, 50), 200))) k)
  ) into sonuc;
  return sonuc;
end;
$function$;

revoke execute on function public.admin_deneme_takibi(integer) from public, anon;
grant execute on function public.admin_deneme_takibi(integer) to authenticated;
