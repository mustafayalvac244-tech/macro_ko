-- AI PAKETİ 3.999 → 2.999 ₺: harcama özetindeki varsayılan satış fiyatı.
-- ===========================================================================
-- 0114 bu fiyatı parametre yapmış ve varsayılanı 3.999 koymuştu. Fiyat aynı
-- gün 2.999'a çekildi; gerekçe RAKİP FİYATI: Lexedes'in önerdiği "Bireysel"
-- planı 2.990 ₺/ay ve bizim AI katmanımızla aynı işi hedefliyor (derin
-- içtihat/mevzuat araştırması, dilekçe üretimi, belge analizi). 3.999'da
-- rakibin önerdiği plandan %34 pahalıydık.
--
-- Yalnız VARSAYILAN değişiyor; gövde 0114'teki gibi. Fonksiyonu p_paket_fiyati
-- vererek başka bir fiyatla da çağırabilirsiniz.
--
-- Soru başına fiyat = 2999 / 250 = 11,996 ₺. Mütalaa ayrı 12 hak içerdiğinden
-- bu bölme kabadır; rapor "soru başı" diye etiketler, mütalaanın gerçek
-- payını iddia etmez.

create or replace function public.ai_harcama_ozeti(p_saat integer default 24, p_paket_fiyati numeric default 2999)
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

comment on function public.ai_harcama_ozeti(integer, numeric) is
  'AI harcaması ve hangi modelin cevap verdiği. Yalnız okur. p_paket_fiyati: aylık AI paketi fiyatı (₺, vars. 2999), kâr sütunu için.';

revoke all on function public.ai_harcama_ozeti(integer, numeric) from public, anon, authenticated;
grant execute on function public.ai_harcama_ozeti(integer, numeric) to service_role;

select * from public.ai_harcama_ozeti(24);
