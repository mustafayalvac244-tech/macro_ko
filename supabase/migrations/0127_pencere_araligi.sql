-- PENCERE ARALIĞI: Danıştay'ı gün gün taramayı bırak + turları işin ağırlığına göre böl.
-- ===========================================================================
-- ÖLÇÜM (bugün, kaynağın kendisinden, yıl yıl):
--
--            Yargıtay      Danıştay
--   2005-26  9.976.045      407.292
--   ve Danıştay'ın 2006-2019 arası YILDA 300-2.600 karar. Yani neredeyse boş.
--
-- İSTEK ARİTMETİĞİ (ölçüldü: istek başına 100 kayıt):
--   Yargıtay  99.760 sayfa + 7.925 pencere = 107.685 istek
--   Danıştay   4.073 sayfa + 7.925 pencere =  11.998 istek
--
-- Danıştay'da isteklerin ÜÇTE İKİSİ boş gün keşfetmeye gidiyor. Gün penceresi
-- Yargıtay için doğru (günde ~1.300-3.600 karar), Danıştay için israf.
-- Ay penceresiyle: 273 pencere + 4.073 sayfa = 4.346 istek. 2,8 kat ucuz.
--
-- NEDEN YARGITAY'DA AY PENCERESİ YOK. Aritmetik orada da bir şey kazandırırdı
-- (107.685 → 100.033, %7) ama 2012 gibi yoğun bir ayda pencere 750 SAYFA
-- derinliğine iner. Derin sayfanın ÇALIŞTIĞINI ölçtüm (pageNumber 5.000'de
-- satır döndü) ama sıralamanın sayfalar arasında KARARLI olduğunu ÖLÇMEDİM.
-- Kararsız sıralamada derin sayfalama karar atlar. %7 için o riski almıyorum;
-- Danıştay'da en yoğun ay ~76 sayfa, orada risk düşük.
--
-- TUR DAĞILIMI DA YANLIŞTI. Yargıtay işin %96'sı ama turların yarısını
-- alıyordu. İşin ağırlığına göre bölünüyor: 4 dakikanın 3'ü Yargıtay.
-- Ölçülen toplam tempo 1.100 istek/saat; bu dağılımla Yargıtay'ın payı
-- 550'den ~825'e çıkıyor.
--
-- HIZI ARTIRMIYORUZ, BÜTÇEYİ DAHA İYİ HARCIYORUZ. Bugün yıl ölçümü yaparken
-- kaynaktan 429 Too Many Requests aldım: canlı katalog işi 4 eşzamanlı
-- çalışırken benim isteklerim üste binince sınır devreye girdi. Yani tavan
-- gerçek ve yakın; kazanç boşa giden isteği kesmekten gelmeli.

-- ── Pencere artık bir ARALIK ───────────────────────────────────────────────
-- `gun` başlangıç, `bitis` bitiş. Varsayılan tek gün, yani mevcut satırların
-- davranışı DEĞİŞMİYOR.
alter table public.ictihat_katalog_pencere
  add column if not exists bitis date;

update public.ictihat_katalog_pencere set bitis = gun where bitis is null;

alter table public.ictihat_katalog_pencere
  alter column bitis set not null;

-- ── Danıştay: gün pencerelerini AY pencereleriyle değiştir ─────────────────
-- TÜM gün pencereleri siliniyor, bitenler dahil. İlk yazdığımda yalnız
-- bitmemişleri siliyordum ama o bir BOŞLUK açıyordu: biten bir gün (örn.
-- 2026-09-01) ayın ilk günüyse, o ayın ay-penceresi `on conflict do nothing`
-- yüzünden hiç eklenmez ve o ay bir daha taranmazdı.
--
-- Bitmiş günleri silmenin maliyeti, o günlerin kararlarının bir kez daha
-- listelenmesi: katalog upsert'i ignoreDuplicates olduğu için veri bozulmaz,
-- bedeli birkaç istek. Boşluk riskinden ucuz.
delete from public.ictihat_katalog_pencere
where tur = 'DANISTAYKARAR' and bitis = gun;

insert into public.ictihat_katalog_pencere (tur, gun, bitis)
select 'DANISTAYKARAR', a::date, (a + interval '1 month - 1 day')::date
from generate_series(date '2005-01-01', date_trunc('month', current_date)::date, interval '1 month') as a
on conflict (tur, gun) do nothing;

-- ── Turları işin ağırlığına göre böl ───────────────────────────────────────
select cron.unschedule('vekil_katalog_yargitay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_yargitay');
select cron.unschedule('vekil_katalog_danistay') where exists (select 1 from cron.job where jobname = 'vekil_katalog_danistay');
-- Yargıtay dakikaların 0,1,2'sinde (4'te 3), Danıştay 3'ünde (4'te 1).
select cron.schedule('vekil_katalog_yargitay', '0-59/4,1-59/4,2-59/4 * * * *', $$select public.katalog_tetikle('YARGITAYKARARI', 30)$$);
select cron.schedule('vekil_katalog_danistay', '3-59/4 * * * *', $$select public.katalog_tetikle('DANISTAYKARAR', 30)$$);

-- Doğrulama.
select
  (select count(*) from public.ictihat_katalog_pencere where tur = 'DANISTAYKARAR') as danistay_pencere,
  (select count(*) from public.ictihat_katalog_pencere where tur = 'YARGITAYKARARI') as yargitay_pencere,
  (select count(*) from public.ictihat_katalog_pencere where bitis > gun) as aralikli_pencere,
  (select count(*) from public.ictihat_katalog) as katalog_satiri,
  (select string_agg(jobname || ' → ' || schedule, ' | ' order by jobname)
     from cron.job where jobname like 'vekil_katalog%') as zamanlama;
