-- AI HARCAMA ÖZETİ — "ne kadar harcadık, hangi model cevap verdi" tek çağrıda.
-- ===========================================================================
-- NEDEN FONKSİYON, NEDEN DOSYA DEĞİL. Aynı rapor scripts/ai-tek-rapor.sql
-- olarak zaten var ama bir SQL DOSYASI; yalnız Supabase SQL Editor'e
-- yapıştırılarak çalıştırılabiliyor. Bu, iki durumda yetmiyor:
--   • Uzun bir ölçüm koşarken "ilerliyor mu, takıldı mı, ne harcadı" diye
--     bakmak gerektiğinde.
--   • Otomatik bir kontrolden (Actions) çağırmak gerektiğinde.
-- Fonksiyon olunca her iki yerden de çağrılabiliyor.
--
-- EN KRİTİK SATIR ">> Opus oranı". ai-chat, ücretli hatta HERHANGİ bir hata
-- olursa (anahtar yanlış, kredi bitti, oran sınırı, geçici arıza) SESSİZCE
-- ücretsiz modele düşüyor (ai-chat/index.ts:238-248). Kullanıcı hata görmez,
-- kimse uyarılmaz — sadece daha zayıf bir model hukuki metni yazmış olur.
-- Bu, bugün canlıda ölçüldü: anahtar eklenmeden önceki 11 isteğin 11'i
-- ücretsiz modellere gitmişti ve hiçbir yerde kırmızı bir satır yoktu.
--
-- Yalnız OKUR. Yetki: service_role (yönetim/otomasyon), authenticated DEĞİL —
-- bu tablo tüm kullanıcıların harcamasını içeriyor.

create or replace function public.ai_harcama_ozeti(p_saat integer default 24)
returns table(bolum text, alan text, deger text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  n numeric;
begin
  select count(*) into n from public.ai_istek
  where olusturuldu > now() - make_interval(hours => p_saat);

  return query select 'DURUM'::text, 'pencere'::text, p_saat::text || ' saat';
  return query select 'DURUM'::text, 'istek'::text, n::text;

  if n = 0 then
    return query select 'DURUM'::text, 'sonuç'::text, 'bu pencerede hiç istek yok'::text;
    return;
  end if;

  -- Opus oranı: %100 değilse anahtar ya da katman ayarında sorun var.
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

  -- Mod başına maliyet ve satış fiyatıyla kıyas (1999 TL / 250 soru = 7,996).
  return query
    select 'MALİYET'::text, mod::text,
           (count(*) || ' istek · ort ₺' || round(avg(maliyet_try), 3) ||
           ' · girdi ' || round(avg(tokens_in)) || ' · çıktı ' || round(avg(tokens_out)) ||
           ' · kâr ₺' || round(7.996 - avg(maliyet_try), 2))::text
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

comment on function public.ai_harcama_ozeti(integer) is
  'AI harcaması ve hangi modelin cevap verdiği. Yalnız okur. scripts/ai-tek-rapor.sql ile aynı rapor, çağrılabilir hâli.';

revoke all on function public.ai_harcama_ozeti(integer) from public, anon, authenticated;
grant execute on function public.ai_harcama_ozeti(integer) to service_role;

-- Uygulandığında mevcut durumu bas.
select * from public.ai_harcama_ozeti(3);
