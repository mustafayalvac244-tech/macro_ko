-- Vekil Pro :: hasat YAYINA KADAR durduruldu
-- ===========================================================================
-- 23.09.2026 — ürün sahibi kararı: "Programı salana kadar hasat yok."
--
-- NEDEN (ölçülerek): 22.09'da gerçek bir kullanıcının 7 giriş denemesinin
-- 6'sı 504 döndü. 23.09'da vektörleme kapatıldıktan SONRA bile postgres
-- kayıtlarında hasat sorguları (ictihat_kararlar upsert, ictihat_katalog
-- select) ve gerçek kullanıcı sorguları (clients, cases, profiles) zaman
-- aşımına düşüyordu. Bağlantı sayısı 7/60 — doluluk değil, yük.
-- Apple incelemesi ve ilk kullanıcılar yayında; veritabanı onlara kalsın.
--
-- DURDURULANLAR (silinmedi, active=false):
--   vekil_hasat_emsal · vekil_hasat_yargitay · vekil_hasat_danistay
--   vekil_katalog_yargitay · vekil_katalog_danistay · vekil_hasat_onceligi
-- ÇALIŞMAYA DEVAM EDENLER: yedekler (günlük, aylık, dosya envanteri),
--   vekil_madde_baglam.
-- Vektörleme zaten 0154 ile kapalı.
--
-- CANLIDA: cron.alter_job ile uygulandı ve geri okunarak doğrulandı.
-- Bu dosya depoyu canlıya eşitler.
--
-- GERİ AÇMA (ürün sahibi "aç" dediğinde, tek ifade):
--   select cron.alter_job(jobid, active => true) from cron.job
--   where jobname in ('vekil_hasat_emsal','vekil_hasat_yargitay',
--     'vekil_hasat_danistay','vekil_katalog_yargitay',
--     'vekil_katalog_danistay','vekil_hasat_onceligi');
-- Açtıktan sonra ilk saat postgres_logs ERROR sayısı izlenmeli.

select cron.alter_job(jobid, active => false)
from cron.job
where jobname in ('vekil_hasat_emsal','vekil_hasat_yargitay','vekil_hasat_danistay',
                  'vekil_katalog_yargitay','vekil_katalog_danistay','vekil_hasat_onceligi');

select jobname, active from cron.job
where jobname like 'vekil_hasat%' or jobname like 'vekil_katalog%'
order by jobname;
