-- Vekil Pro :: hasat YENİDEN AÇILDI
-- ===========================================================================
-- 28.09.2026 — ürün sahibi: "hasata devam". Uygulama yayında (0156'daki
-- "programı salana kadar hasat yok" koşulu doldu).
--
-- AÇMADAN ÖNCE ÖLÇÜLDÜ (28.09.2026):
--   postgres_logs son 24 saat: saatte 0–1 hata (en fazla 1, 13:00 UTC).
--   disk_musait_mi() = true · veritabanı 4116 MB · ictihat_kararlar 116.218.
--
-- AÇILANLAR: 0156'da durdurulan altı iş (vekil_hasat_emsal, _yargitay,
--   _danistay, vekil_katalog_yargitay, _danistay, vekil_hasat_onceligi).
-- KAPALI KALAN: vekil_vektorle_toplu (0154/0155 — ayrı karar).
--
-- GERİ ALMA EŞİĞİ: kullanıcı tablolarında (clients, cases, profiles) zaman
--   aşımı görülürse ya da saatlik hata taban çizgisinin (0–1) belirgin üstüne
--   çıkarsa 0156'daki ifadeyle tekrar kapatılır.
--
-- CANLIDA: cron.alter_job ile 18:34:46 UTC'de uygulandı, geri okundu.
-- Bu dosya depoyu canlıya eşitler.

select cron.alter_job(jobid, active => true)
from cron.job
where jobname in ('vekil_hasat_emsal','vekil_hasat_yargitay','vekil_hasat_danistay',
                  'vekil_katalog_yargitay','vekil_katalog_danistay','vekil_hasat_onceligi');

select jobname, active from cron.job
where jobname like 'vekil_hasat%' or jobname like 'vekil_katalog%'
order by jobname;
