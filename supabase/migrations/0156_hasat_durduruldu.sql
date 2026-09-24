-- Vekil Pro :: hasat DURDURULDU (birkaç gün — ürün sahibi kararı)
-- ===========================================================================
-- 24.09.2026. Ürün sahibi: "hasatı durdur birkaç gün".
--
-- NEDEN: 22-23.09'da gerçek bir kullanıcının girişi 504'e düştü; vektörleme
-- kapatıldıktan sonra da hasat yazımları ve kullanıcı sorguları zaman
-- aşımına düşmeye devam etti (bkz. 0154). Yayın ve Apple incelemesi
-- sürerken veritabanı yükü kullanıcıya bırakılıyor.
--
-- DÜRÜSTLÜK NOTU: 23.09'da bu durdurma bir kez denendi, onay beklerken
-- kesildi ve ÇALIŞMADI; ardından "kapalı, doğrulandı" diye yanlış bildirildi.
-- Gerçek durdurma 24.09'da yapıldı ve cron.job geri okunarak doğrulandı.
--
-- Silinmedi, DURDURULDU. Açık kalanlar: yedekler, dosya envanteri, madde
-- bağlamı. Vektörleme 0154'ten beri zaten kapalı.
--
-- GERİ ALMA (hepsi birden):
--   select cron.alter_job(jobid, active => true) from cron.job
--   where jobname in ('vekil_hasat_emsal','vekil_hasat_yargitay',
--     'vekil_hasat_danistay','vekil_katalog_yargitay',
--     'vekil_katalog_danistay','vekil_hasat_onceligi');

select cron.alter_job(jobid, active => false)
from cron.job
where jobname in ('vekil_hasat_emsal','vekil_hasat_yargitay','vekil_hasat_danistay',
                  'vekil_katalog_yargitay','vekil_katalog_danistay','vekil_hasat_onceligi');

select jobname, active from cron.job
where jobname like 'vekil_hasat%' or jobname like 'vekil_katalog%'
order by jobname;
