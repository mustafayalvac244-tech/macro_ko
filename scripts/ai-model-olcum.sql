-- HANGİ MODEL GERÇEKTEN ÇALIŞIYOR? — ve sessizce ücretsize mi düşüyoruz?
-- ===========================================================================
-- NEDEN BU DOSYA VAR. scripts/eval-ictihat-ai-hatalar.json'daki son koşu
-- (11.09.2026) şu hatayla düştü:
--
--   "Your credit balance is too low to access the Anthropic API."
--
-- Bunun HÂLÂ geçerli olup olmadığını bilmiyoruz. Bilmemek tehlikeli, çünkü
-- ai-chat sessizce yedek sağlayıcılara düşüyor (Groq → Gemini). Yani ücretli
-- pakete para veren avukat, farkında olmadan ücretsiz modelin çıktısını
-- alıyor olabilir ve bunu KİMSE görmez — istek başarılı döner.
--
-- Bir kez daha ölçülmemiş bir şeye "çalışıyor" demeyelim: her istek `ai_istek`
-- tablosuna hangi modelle karşılandığını yazıyor. Cevap orada.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.

with son as (
  select model, mod, maliyet_try, tokens_in, tokens_out, gun
  from public.ai_istek
  where gun >= (current_date - 7)
),
satirlar as (
  select 10::numeric as sira, 'ÖZET' as bolum, 'son 7 günde istek' as alan,
         count(*)::text as deger from son
  union all
  select 11, 'ÖZET', 'son 7 günde maliyet (TL)',
         coalesce(round(sum(maliyet_try), 2)::text, '0') from son

  -- ASIL SORU: hangi model kaç isteği karşıladı?
  union all
  select 20, 'MODEL', coalesce(nullif(model, ''), '(boş)'),
         count(*) || ' istek · ' || round(sum(maliyet_try), 2) || ' TL'
  from son group by 2

  -- ÜCRETSİZE DÜŞME SİNYALİ. Maliyeti sıfır olan istekler ücretsiz sağlayıcıyla
  -- karşılanmış demektir. Oran yüksekse ya kota taşıyor ya ödeme sorunu var.
  union all
  select 30, 'BEDEL', '>> maliyeti SIFIR olan istek',
         count(*) filter (where coalesce(maliyet_try, 0) = 0)::text
         || ' / ' || count(*)::text
         || '  (%' || coalesce(round(100.0 * count(*) filter (where coalesce(maliyet_try, 0) = 0)
                                     / nullif(count(*), 0), 1)::text, '0') || ')'
  from son

  -- MOD BAZINDA: dilekçe mi sohbet mi, hangisi hangi modelde?
  union all
  select 40, 'MOD', coalesce(nullif(mod, ''), '(boş)'),
         count(*) || ' istek · modeller: '
         || coalesce(string_agg(distinct coalesce(nullif(model, ''), '(boş)'), ', '), '-')
  from son group by 2

  -- ZAMAN: son günlerde ne oldu?
  union all
  select 50, 'GÜN', gun::text,
         count(*) || ' istek · ' || round(sum(maliyet_try), 2) || ' TL · '
         || coalesce(string_agg(distinct coalesce(nullif(model, ''), '(boş)'), ', '), '-')
  from son group by 2
)
select bolum, alan, deger from satirlar order by sira, alan;
