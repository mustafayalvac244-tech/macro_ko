-- HASAT HIZI — 11 kat, hâlâ ölçülen güvenli tavanın çok altında.
--
-- ÖNCEKİ: 3 kaynak × saatte 3 tur × en fazla 6 karar = günde ~1.296 karar.
-- Bu hızla 1 milyon karar 2,1 yıl sürer.
--
-- YENİ: 3 kaynak × saatte 20 tur × en fazla 10 karar = günde ~14.400 karar.
-- 1 milyon karar ~70 gün.
--
-- NEDEN DAHA FAZLA DEĞİL. Ölçüm (önceki oturum): eşzamanlılık 10'da 8,7
-- belge/sn güvenli, 16'da 429 dönüyor. Yeni hız ~0,17 belge/sn — ölçülen
-- güvenli tavanın ellide biri. Sınır teknik değil: UYAP bir KAMU hizmeti ve
-- IP yasağı özelliği TAMAMEN öldürür. 500 kat hızlanıp yasaklanmaktansa 11 kat
-- hızlanıp çalışmaya devam etmek yeğdir.
--
-- Turlar dakika bazında kaydırıldı ki üç kaynak aynı anda vurmasın.
-- Disk emniyet freni (migration 0084) yürürlükte kalır: havuz beklenenden hızlı
-- büyürse hasat kendini durdurur.

select cron.unschedule('vekil_hasat_yargitay') where exists (select 1 from cron.job where jobname = 'vekil_hasat_yargitay');
select cron.unschedule('vekil_hasat_danistay') where exists (select 1 from cron.job where jobname = 'vekil_hasat_danistay');
select cron.unschedule('vekil_hasat_emsal')    where exists (select 1 from cron.job where jobname = 'vekil_hasat_emsal');

select cron.schedule('vekil_hasat_yargitay', '0-59/3 * * * *', $$select public.hasat_tetikle('yargitay', 10)$$);
select cron.schedule('vekil_hasat_danistay', '1-59/3 * * * *', $$select public.hasat_tetikle('danistay', 10)$$);
select cron.schedule('vekil_hasat_emsal',    '2-59/3 * * * *', $$select public.hasat_tetikle('emsal', 10)$$);

-- Vektörleme hasada YETİŞMELİ: vektörsüz karar anlamsal aramada görünmez.
-- 5 dakikada 6 karar (günde ~1.700) yeni hızın çok gerisinde kalırdı.
select cron.unschedule('vekil_vektorle') where exists (select 1 from cron.job where jobname = 'vekil_vektorle');
select cron.schedule('vekil_vektorle', '* * * * *', $$select public.vektorle_tetikle('ictihat', 15)$$);
