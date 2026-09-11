-- AI PAKETİ 1.999 → 3.999 ₺: harcama özetindeki "kâr" sütunu satış fiyatını
-- SABİT (7,996 = 1999/250) alıyordu. Fiyat artık parametre; varsayılan 3.999.
-- ===========================================================================
-- 0109'daki ai_harcama_ozeti, mod başına "kâr ₺X" yazarken soru başına satış
-- fiyatını gövdeye gömülü 7.996 ile hesaplıyordu. Paket fiyatı 3.999'a çıktı
-- (2026-09-11, ürün kararı); sabit kalsa rapor yanlış kâr gösterirdi.
--
-- Soru başına fiyat = paket fiyatı / 250 soru = 15,996 ₺. Mütalaa ayrıca 12
-- hak içerdiğinden bu bölme kaba bir yaklaşımdır; rapor bunu "soru başı"
-- diye etiketler, mütalaanın gerçek payını iddia etmez.
--
-- Yalnız OKUR; yetki değişmedi (service_role).

create or replace function public.ai_harcama_ozeti(p_saat integer default 24, p_paket_fiyati numeric default 3999)
returns table(bolum text, alan text, deger text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  n numeric;
  soru_fiyati numeric := p_paket_fiyati / 250.0;
begin
  select count(*) into n from public.ai_istek
  where olusturuldu > now() - make_interval(hours => p_saat);

  return query select 'DURUM'::text, 'pencere'::text, p_saat::text || ' saat';
  return query select 'DURUM'::text, 'istek'::text, n::text;
  return query select 'DURUM'::text, 'paket fiyatı'::text, ('₺' || p_paket_fiyati || ' / 250 soru → soru başı ₺' || round(soru_fiyati, 3))::text;

  if n = 0 then
    return query select 'DURUM'::text, 'sonuç'::text, 'bu pencerede hiç istek yok'::text;
    return;
  end if;

  return query
    select 'DURUM'::text, '>> Opus oranı'::text,
           ('%' || round(100.0 * count(*) filter (where model like 'claude%') / n, 1)
           || '   (' || count(*) filter (where model like 'claude%') || '/' || n::int || ')')::text
    from public.ai_istek where olusturuldu > now() - make_interval(hours => p_saat);

  return query
    select 'DURUM'::text, 'anahtar'::text,
           case
             when count(*) filter (where model like 'claude%') = 0
               then 'HAYIR — hiçbir istek Opus''a gitmemiş'
             when count(*) filter (where model not like 'claude%') > 0
               then 'KISMEN — bazı istekler ücretsiz hatta düşmüş'
             else 'EVET — tüm istekler Opus''a gitti'
           end::text
    from public.ai_istek where olusturuldu > now() - make_interval(hours => p_saat);

  return query
    select 'MODEL'::text, coalesce(model, '(kaydedilmemiş)')::text,
           (count(*) || ' istek · ₺' || round(sum(maliyet_try), 2))::text
    from public.ai_istek where olusturuldu > now() - make_interval(hours => p_saat)
    group by model;

  return query
    select 'MALİYET'::text, mod::text,
           (count(*) || ' istek · ort ₺' || round(avg(maliyet_try), 3) ||
           ' · girdi ' || round(avg(tokens_in)) || ' · çıktı ' || round(avg(tokens_out)) ||
           ' · soru başı kâr ₺' || round(soru_fiyati - avg(maliyet_try), 2))::text
    from public.ai_istek where olusturuldu > now() - make_interval(hours => p_saat)
    group by mod;

  return query
    select 'TOPLAM'::text, 'harcama'::text, ('₺' || round(sum(maliyet_try), 2))::text
    from public.ai_istek where olusturuldu > now() - make_interval(hours => p_saat);
  return query
    select 'TOPLAM'::text, 'son istek'::text, max(olusturuldu)::text
    from public.ai_istek where olusturuldu > now() - make_interval(hours => p_saat);
end;
$$;

-- Eski imza (tek parametreli) kalmasın: iki aşırı yükleme birden dururken
-- `ai_harcama_ozeti(3)` çağrısı belirsiz olur.
drop function if exists public.ai_harcama_ozeti(integer);

comment on function public.ai_harcama_ozeti(integer, numeric) is
  'AI harcaması ve hangi modelin cevap verdiği. Yalnız okur. p_paket_fiyati: aylık AI paketi fiyatı (₺), kâr sütunu için.';

revoke all on function public.ai_harcama_ozeti(integer, numeric) from public, anon, authenticated;
grant execute on function public.ai_harcama_ozeti(integer, numeric) to service_role;

select * from public.ai_harcama_ozeti(24);
