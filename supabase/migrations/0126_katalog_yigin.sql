-- KATALOG TURU ARTIK YIĞIN İŞLİYOR — kendi tasarım hatamın düzeltmesi.
-- ===========================================================================
-- 0125 kataloğu açtı ve çalıştı: canlıda ölçüldü, pencereler işleniyor,
-- işlev hata vermiyor. AMA HIZI YANLIŞ TASARLAMIŞIM.
--
-- CANLI ÖLÇÜM (14:26 → 14:33, yedi dakika):
--     kapanan pencere: Yargıtay 1, Danıştay 3
--     katalog satırı:  0
-- Sıfır satır DOĞRUYDU — sıradaki günler bugün ve dünüydü, henüz karar
-- yayımlanmamış. Sorun o değil, HIZ: turda TEK pencere işleniyordu.
-- 15.850 pencere × tur başına 1 pencere ÷ saatte 60 tur ≈ DOKUZ AY.
-- Yani "11 saatte tüm korpus" hesabım aritmetik olarak doğruydu ama
-- yazdığım tasarım o hesabı kullanamıyordu.
--
-- KÖK SEBEP: günlerin çoğu 100'den az karar içeriyor, yani tek sayfada
-- bitiyor. Tek pencerelik tur o günü kapatıp DURUYORDU. Oysa turun asıl
-- maliyeti soğuk başlangıç ve yetki kontrolü; arama isteğinin kendisi ucuz
-- (ölçüldü: 271 satır/sn, eşzamanlılık 4, 0 hata).
--
-- DÜZELTME: katalog-tick artık bir turda 30 pencereyi birden işliyor
-- (4'lü havuzda, ≈8 saniye, ≈3.000 üstveri satırı).
--
-- YENİ SÜRE HESABI — ve bunun bir TAHMİN olduğunu açıkça yazıyorum:
--   10,4 milyon karar ÷ 100 kayıt/istek ≈ 104.000 arama isteği.
--   Saatte 60 tur × 30 istek = 1.800 istek/saat  →  ≈ 58 saat ≈ 2,4 gün.
-- Bu hesap ölçülen istek hızına dayanıyor ama UÇTAN UCA HENÜZ ÖLÇÜLMEDİ;
-- gerçek süre yarın katalog-durum raporuyla belli olacak.
--
-- NEZAKET: 1.800 istek/saat = 0,5 istek/sn. Ölçülen güvenli patlama hızı
-- 4 istek/sn idi. Sürekli hız onun sekizde biri. İki tür DÖNÜŞÜMLÜ dakikalarda
-- çalışıyor, yani aynı anda hiçbir zaman iki tur birden vurmuyor.

select cron.unschedule('vekil_katalog_yargitay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_yargitay');
select cron.unschedule('vekil_katalog_danistay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_danistay');
select cron.schedule('vekil_katalog_yargitay', '0-59/2 * * * *', $$select public.katalog_tetikle('YARGITAYKARARI', 30)$$);
select cron.schedule('vekil_katalog_danistay', '1-59/2 * * * *', $$select public.katalog_tetikle('DANISTAYKARAR', 30)$$);

-- Doğrulama: zamanlama ve şu ana kadarki ilerleme.
select
  (select count(*) from public.ictihat_katalog)                          as katalog_satiri,
  (select count(*) from public.ictihat_katalog_pencere where bitti)      as biten_pencere,
  (select count(*) from public.ictihat_katalog_pencere)                  as toplam_pencere,
  (select string_agg(jobname || ' ' || schedule, ' | ' order by jobname)
     from cron.job where jobname like 'vekil_katalog%')                  as zamanlama;
