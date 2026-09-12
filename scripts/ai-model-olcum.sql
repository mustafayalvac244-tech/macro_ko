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
--
-- NOT (aynı hatayı bugün İKİNCİ kez yaptım): buradaki `group by` KONUM
-- numarasıdır ve seçim listesi (sira, bolum, alan, deger) olduğu için
-- gruplanacak ifade 3. konumdadır. `group by 2` yazmak, sabit bölüm metnine
-- ('MODEL') göre gruplamak demektir ve 42803 ile düşer. hasat-tur-teshis.sql
-- içinde aynı hatayı düzeltmiştim, buraya yazarken tekrarladım.

with son as (
  select i.model, i.mod, i.maliyet_try, i.tokens_in, i.tokens_out, i.gun,
         coalesce(nullif(p.ai_tier, ''), 'ücretsiz') as katman
  from public.ai_istek i
  left join public.profiles p on p.id = i.user_id
  -- `gun` METİN sütunu, tarih değil — canlıda 42883 ile öğrenildi. ISO
  -- biçiminde (YYYY-MM-DD) tutulduğu için metin karşılaştırması tarih
  -- sırasıyla aynı sonucu verir; ::date'e çevirmek biçim bozuksa düşerdi.
  where i.gun >= (current_date - 7)::text
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
  from son group by 3

  -- ÜCRETSİZE DÜŞME SİNYALİ. Maliyeti sıfır olan istekler ücretsiz sağlayıcıyla
  -- karşılanmış demektir. Oran yüksekse ya kota taşıyor ya ödeme sorunu var.
  union all
  select 30, 'BEDEL', '>> maliyeti SIFIR olan istek',
         count(*) filter (where coalesce(maliyet_try, 0) = 0)::text
         || ' / ' || count(*)::text
         || '  (%' || coalesce(round(100.0 * count(*) filter (where coalesce(maliyet_try, 0) = 0)
                                     / nullif(count(*), 0), 1)::text, '0') || ')'
  from son

  -- ASIL AYRIM. Ücretsiz hesabın ücretsiz modele düşmesi DOĞRU davranıştır.
  -- Sorun, ÜCRETLİ katmandaki bir isteğin bedelsiz bir modelle karşılanmasıdır:
  -- _shared/katman.ts'te bu bilerek yazılmış bir geri düşüş ("Claude anahtarı
  -- yoksa 'ai' katmanı da Groq'a düşer: ödeyen üye boş ekran görmez"). Faydalı
  -- bir emniyet ama SESSİZ: ödeyen üye farkı göremez. Sayısı burada.
  union all
  select 35, 'KATMAN', katman,
         count(*) || ' istek · bedelsiz ' || count(*) filter (where coalesce(maliyet_try, 0) = 0)
         || ' · modeller: ' || coalesce(string_agg(distinct coalesce(nullif(model, ''), '(boş)'), ', '), '-')
  from son group by 3
  union all
  select 36, 'KATMAN', '>> ÜCRETLİ katmanda bedelsiz model',
         count(*) filter (where katman <> 'ücretsiz' and coalesce(maliyet_try, 0) = 0)::text
         || ' / ' || count(*) filter (where katman <> 'ücretsiz')::text
  from son

  -- MOD BAZINDA: dilekçe mi sohbet mi, hangisi hangi modelde?
  union all
  select 40, 'MOD', coalesce(nullif(mod, ''), '(boş)'),
         count(*) || ' istek · modeller: '
         || coalesce(string_agg(distinct coalesce(nullif(model, ''), '(boş)'), ', '), '-')
  from son group by 3

  -- ZAMAN: son günlerde ne oldu?
  union all
  select 50, 'GÜN', gun,
         count(*) || ' istek · ' || round(sum(maliyet_try), 2) || ' TL · '
         || coalesce(string_agg(distinct coalesce(nullif(model, ''), '(boş)'), ', '), '-')
  from son group by 3
)
select bolum, alan, deger from satirlar order by sira, alan;
