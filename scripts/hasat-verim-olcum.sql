-- ⚠️ SUPABASE SQL EDITOR UYARISI (bu dosya birden çok SELECT içerir).
-- Editor çok ifadeli bir betikte YALNIZ SON ifadenin sonucunu gösterir. Bu
-- dosyayı olduğu gibi çalıştırırsan yalnızca en alttaki sorgunun tablosunu
-- görürsün — diğerleri koşar ama görünmez.
--
-- İKİ YOL:
--   a) Hepsini tek tabloda isteyen özet için: scripts/hasat-tek-rapor.sql
--   b) Buradaki sorguları TEK TEK seçip (fareyle işaretle) Run'a bas.

-- HASAT VERİMİ
-- ===========================================================================
-- ⛔ BU DOSYANIN ESKİ BAŞLIĞI 6 KAT YANLIŞTI — 18.09.2026'da yakalandı.
--
-- Eskiden burada "gerçek hız saatte 85 … 1 milyona 484 gün" yazıyordu ve o
-- sayı bir yorum satırında donmuştu. Ürün sahibi "hasat verimi nasıl" diye
-- sorduğunda doğru davranış bu dosyayı AÇIP OKUMAK değil, canlıyı ÖLÇMEKTİ.
-- Ölçüldüğünde çıkan:
--
--     18.09.2026 20:45 · ictihat_kararlar 96.194 karar
--     son 1 saat 501 · son 6 saat 3.204 · son 24 saat 12.274
--     saatlik dağılım 12 saattir 496–560 arası, yani SABİT
--
-- Yani gerçek hız ~510/saat, 85 değil. Eski sayı bir zamanlar doğru olabilir
-- ama ölçüldüğü an geçmişte kaldı; yorum satırı onunla birlikte eskimedi.
--
-- DERS (.claude/skills/olcum 2. madde): ölçüm dosyasının İÇİNDEKİ sabit,
-- ölçümün kendisi DEĞİLDİR. Bu dosyadaki sorguları koş, başlığındaki sayıyı
-- okuma. Bir sayı yazacaksan tarihini ve ölçüm anını da yaz — bu paragraf
-- da bir gün eskiyecek ve okuyanın bunu anlaması gerekecek.
--
-- ── Aşağıdaki sorgular hâlâ geçerli ────────────────────────────────────────
-- Soru şu: zamanlama saatte daha fazlasına izin verirken neden bu kadar
-- geliyor? İki olasılık var ve çözümleri TERS:
--
--   A) YİNELENEN SONUÇ. Aramalar birbirini örtüyor. Havuzda olan eleniyor,
--      geriye az yeni kalıyor. → Çözüm: daha çok/ayrık terim, sayfa ilerletme.
--
--   B) UYAP HIZ SINIRI. harvest-tick'in kendi yorumu şöyle diyor:
--        "UYAP hız sınırında 429 DEĞİL, HTTP 200 + boş sonuç döndürüyor."
--      Dışarıdan "hepsi 200" diye bakınca BAŞARILI görünür.
--      → Çözüm: YAVAŞLATMAK. Hızlandırmak durumu kötüleştirir.
--
-- Yanıt gövdeleri net._http_response'ta duruyor; bu dosya oraya bakar.
-- Hiçbir şeyi değiştirmez.

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
