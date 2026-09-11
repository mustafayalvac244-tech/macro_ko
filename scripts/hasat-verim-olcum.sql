-- ⚠️ SUPABASE SQL EDITOR UYARISI (bu dosya birden çok SELECT içerir).
-- Editor çok ifadeli bir betikte YALNIZ SON ifadenin sonucunu gösterir. Bu
-- dosyayı olduğu gibi çalıştırırsan yalnızca en alttaki sorgunun tablosunu
-- görürsün — diğerleri koşar ama görünmez. Bu, üç tur boyunca ölçüm sonucunu
-- alamamamızın sebebiydi ve kusur bendeydi, dosyayı çalıştıranda değil.
--
-- İKİ YOL:
--   a) Hepsini tek tabloda isteyen özet için: scripts/hasat-tek-rapor.sql
--   b) Buradaki sorguları TEK TEK seçip (fareyle işaretle) Run'a bas.

-- HASAT VERİMİ — neden saatte 600 değil 85?
-- ===========================================================================
-- ÖNCE KENDİ HATAMI DÜZELTİYORUM. Bir önceki turda "gözlenen verim tur başına
-- ~7,3 karar, yani ~438 karar/saat, 1 milyona ~94 gün" dedim. ÖLÇÜM BUNU
-- YALANLADI:
--
--     son_6_saat | eklenen_karar 511 | saatlik 85 | günlük ~2.044
--
-- Gerçek hız saatte 85. Benim rakamım 5 KAT FAZLAYDI. Sebebi: 46 dakikalık
-- bir pencereden (334 karar) saatlik hız çıkarmıştım; o pencere bundle'ın
-- uygulandığı ana denk geliyordu ve muhtemelen birikmiş işi boşaltıyordu.
-- Kısa pencereden uzun vadeli hız çıkarmak, tam olarak yapmamam gereken şeydi.
--
-- DÜZELTİLMİŞ ARİTMETİK (ölçülen 2.044 karar/gün ile):
--     (1.000.000 − 9.705) / 2.044 ≈ 484 GÜN ≈ 16 AY.
--
-- ŞİMDİ ASIL SORU. Zamanlama saatte 600 karara izin veriyor
-- (3 kaynak × 20 tur × 10 karar) ama 85 geliyor — kapasitenin %14'ü.
-- Tur başına ~1,4 karar. Demek ki DARBOĞAZ CRON SIKLIĞI DEĞİL. Cron'u
-- hızlandırmak, zaten boş dönen turları daha sık boş döndürmekten başka bir
-- şey yapmaz.
--
-- İKİ OLASILIK VAR ve ayırt edilmeleri şart, çünkü çözümleri TERS:
--
--   A) YİNELENEN SONUÇ. Aramalar birbirini örtüyor ("kıdem tazminatı" ile
--      "işçilik alacakları" aynı kararları getiriyor). Havuzda olan eleniyor,
--      geriye az yeni kalıyor. → Çözüm: daha çok/ayrık terim, sayfa ilerletme.
--
--   B) UYAP HIZ SINIRI. harvest-tick'in kendi yorumu şöyle diyor:
--        "UYAP hız sınırında 429 DEĞİL, HTTP 200 + boş sonuç döndürüyor."
--      Bu durumda işlev 200 döner ama gövdede `not` alanı ve `eklenen: 0`
--      vardır. Dışarıdan "54 yanıtın hepsi 200" diye bakınca BAŞARILI görünür.
--      → Çözüm: YAVAŞLATMAK. Hızlandırmak durumu kötüleştirir.
--
-- Yanıt gövdeleri net._http_response'ta zaten duruyor; kimse bakmamış.
-- Bu dosya oraya bakar. Hiçbir şeyi değiştirmez.

-- ── 1) TURLARIN SONUCU: kaçı karar ekledi, kaçı boş döndü, kaçı hata? ───────
-- EN AYIRT EDİCİ SORGU. 'hata/hız sınırı' kovası büyükse sebep (B),
-- 'eklenen: 0' kovası büyükse sebep (A).
select
  case
    when r.content is null                      then 'gövde yok'
    when r.content like '%"not"%'               then 'HATA / HIZ SINIRI (not alanı var)'
    when r.content like '%"eklenen":0%'         then 'boş tur (hepsi zaten havuzdaydı)'
    when r.content like '%"eklenen"%'           then 'karar ekledi'
    when r.content like '%terim_yok%'           then 'terim bulunamadı'
    when r.content like '%error%'               then 'hata'
    else 'sınıflandırılamadı'
  end                                           as sonuc,
  count(*)                                      as tur,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as yuzde
from net._http_response r
where r.created > now() - interval '6 hours'
group by 1
order by tur desc;

-- ── 2) HATA MESAJLARI TEK TEK ───────────────────────────────────────────────
-- "emsal 429 (sahte sıfır)" görürsen sebep kesin (B).
select left(r.content, 200) as govde, count(*) as adet
from net._http_response r
where r.created > now() - interval '6 hours'
  and r.content like '%"not"%'
group by 1
order by adet desc
limit 15;

-- ── 3) TUR BAŞINA KAÇ KARAR? ────────────────────────────────────────────────
-- "eklenen" sayısının dağılımı. 10'a yakınsa kapasite doluyor demektir ve
-- hızlanmak işe yarar; 0-1'de yığılmışsa hızlanmak hiçbir şey getirmez.
select coalesce(substring(r.content from '"eklenen":([0-9]+)'), 'yok') as eklenen,
       count(*) as tur
from net._http_response r
where r.created > now() - interval '6 hours'
group by 1
order by 1;

-- ── 4) KAYNAK BAZINDA ───────────────────────────────────────────────────────
-- Üç kaynak eşit hızda çalışıyor ama verimleri eşit mi? Biri sürekli boş
-- dönüyorsa payı ona göre değişmeli.
select coalesce(substring(r.content from '"kaynak":"([a-z]+)"'), '(bilinmiyor)') as kaynak,
       count(*)                                                                  as tur,
       sum(coalesce(substring(r.content from '"eklenen":([0-9]+)')::int, 0))      as toplam_eklenen,
       round(avg(coalesce(substring(r.content from '"eklenen":([0-9]+)')::int, 0)), 2) as tur_basina
from net._http_response r
where r.created > now() - interval '6 hours'
group by 1
order by toplam_eklenen desc;

-- ── 5) TERİMLERİN SAYFA DURUMU ──────────────────────────────────────────────
-- next_page 1'de takılı kalan çok terim varsa, o terimler her turda AYNI ilk
-- sayfayı tarıyor demektir — yinelenen sonucun en olası kaynağı budur.
select case
         when next_page = 1 then 'sayfa 1 (hiç ilerlememiş)'
         when next_page <= 5 then 'sayfa 2-5'
         when next_page <= 20 then 'sayfa 6-20'
         else 'sayfa 20+'
       end as sayfa_durumu,
       count(*) as terim
from public.ictihat_harvest_state
group by 1
order by 1;
