-- ⚠️ SUPABASE SQL EDITOR UYARISI (bu dosya birden çok SELECT içerir).
-- Editor çok ifadeli bir betikte YALNIZ SON ifadenin sonucunu gösterir. Bu
-- dosyayı olduğu gibi çalıştırırsan yalnızca en alttaki sorgunun tablosunu
-- görürsün — diğerleri koşar ama görünmez. Bu, üç tur boyunca ölçüm sonucunu
-- alamamamızın sebebiydi ve kusur bendeydi, dosyayı çalıştıranda değil.
--
-- İKİ YOL:
--   a) Hepsini tek tabloda isteyen özet için: scripts/hasat-tek-rapor.sql
--   b) Buradaki sorguları TEK TEK seçip (fareyle işaretle) Run'a bas.

-- AI MALİYETİ — TAHMİN DEĞİL, GERÇEK KULLANIMDAN ÖLÇÜM.
-- ===========================================================================
-- NEDEN BU YOL. Soru başına maliyeti bilmiyoruz; sekiz ölçüm betiği anahtar
-- olmadığı için hiç koşmadı. Betikleri koşturmanın da bir bedeli var ve
-- SUPABASE_SERVICE_ROLE_KEY gerektiriyor.
--
-- Oysa uygulamanın kendisi zaten her isteği kaydediyor: public.ai_istek
-- tablosunda model, tokens_in, tokens_out ve maliyet_try satır satır duruyor
-- (migration 0056). Yani uygulamayı normal kullanmak, ölçüm setinden DAHA İYİ
-- bir ölçüm üretir — çünkü gerçek dosyalar, gerçek istem uzunlukları.
--
-- KULLANIM: uygulamada birkaç gerçek iş yap (1 dilekçe, 1 belge incelemesi,
-- 1 sohbet), sonra bunu çalıştır.
--
-- KARŞILAŞTIRMA NOKTASI: AI paketi 1999 TL / 250 soru = soru başına 7,996 TL
-- satılıyor (src/hooks/useTrialStatus.ts). Aşağıdaki sorgular bu rakamın
-- altında mı üstünde mi kaldığımızı söyler.

-- ── 1) MOD BAŞINA GERÇEK MALİYET ────────────────────────────────────────────
select
  mod,
  count(*)                                as istek,
  round(avg(tokens_in))                   as ort_girdi_token,
  round(avg(tokens_out))                  as ort_cikti_token,
  round(avg(maliyet_try), 4)              as ort_maliyet_try,
  round(max(maliyet_try), 4)              as en_pahali_try,
  round(7.996 - avg(maliyet_try), 2)      as soru_basina_kar_try
from public.ai_istek
group by mod
order by ort_maliyet_try desc nulls last;

-- ── 2) HANGİ MODEL CEVAP VERDİ? ─────────────────────────────────────────────
-- EN KRİTİK SORGU. ai-chat, ücretli hatta HERHANGİ bir hata olursa (401,
-- kredi bitti, oran sınırı, geçici arıza) sessizce ÜCRETSİZ modele düşüyor
-- (ai-chat/index.ts:238-248). Kullanıcı hata görmez, sen uyarı almazsın —
-- sadece daha zayıf bir model hukuki metni yazmış olur.
--
-- Burada 'claude-opus-5' dışında bir satır görünüyorsa, o istekler ücretsiz
-- hatta düşmüş demektir. Oranı küçük değilse sorun vardır.
select
  coalesce(model, '(model kaydedilmemiş)')                        as model,
  count(*)                                                        as istek,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1)   as yuzde,
  round(sum(maliyet_try), 4)                                      as toplam_try
from public.ai_istek
group by 1
order by istek desc;

-- ── 3) SON 20 İSTEK — tek tek bakmak için ───────────────────────────────────
select olusturuldu, mod, model, tokens_in, tokens_out,
       round(maliyet_try, 4) as maliyet_try,
       musteriye_yazildi, iade_edildi
from public.ai_istek
order by olusturuldu desc
limit 20;

-- ── 4) ÖNBELLEK İŞE YARIYOR MU? ─────────────────────────────────────────────
-- ai-chat cache_control: ephemeral gönderiyor. Önbellek tutuyorsa aynı moddaki
-- ARDIŞIK isteklerde girdi token'ı düşmeli. Düşmüyorsa önbellek kırılıyordur
-- (ör. sistem isteminin başında her seferinde değişen bir şey var).
--
-- DÜRÜSTLÜK NOTU: ai_istek yalnız TOPLAM girdi token'ını tutuyor, önbellekten
-- okunanı ayrı tutmuyor. Yani bu sorgu önbelleği DOLAYLI ölçer; kesin cevap
-- Anthropic Console → Prompt caching kartındaki "tokens reused" rakamıdır.
select mod,
       min(tokens_in) as en_dusuk_girdi,
       max(tokens_in) as en_yuksek_girdi,
       round(avg(tokens_in)) as ortalama,
       count(*) as istek
from public.ai_istek
group by mod
having count(*) > 1
order by mod;

-- ── 5) TOPLAM HARCAMA ───────────────────────────────────────────────────────
select
  count(*)                          as toplam_istek,
  round(sum(maliyet_try), 2)        as toplam_try,
  round(sum(maliyet_try) / 42.0, 4) as yaklasik_usd,  -- kur sabit değil, kaba çevrim
  min(olusturuldu)                  as ilk_istek,
  max(olusturuldu)                  as son_istek
from public.ai_istek;
