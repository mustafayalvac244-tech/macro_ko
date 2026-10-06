-- 06.10.2026 — GECE GÖREVİ vekil_madde_baglam HER GÜN ZAMAN AŞIMINA DÜŞÜYORDU.
--
-- Ölçüldü: son başarılı koşu 29.09.2026; 02–06.10 arası 5 koşunun 5'i
-- "canceling statement due to statement timeout" (genel sınır 120 sn). Etki:
-- 29.09'dan sonra hasatla gelen kararların atıf bağlamı kanun maddesi
-- aramasını (search_mevzuat_kural, 0066) beslemiyordu.
-- Elle 10 dk sınırla koşuldu (06.10 07:16 UTC): 205,7 sn'de BİTTİ.
--
-- Düzeltme: görev komutu kendi oturumunda sınırı 10 dk'ya çeker. Ölçülen
-- 206 sn'nin ~3 katı pay; görev 04:40 UTC'de (kullanıcı trafiği düşük) koşar.
-- Kalıcı çözüm (karar tablosunu okumadan kurul bilgisine ulaşmak) AÇIK İŞ.
-- GERİ ALMA: aynı cron.schedule'u eski komutla ('select public.madde_baglam_tazele()').
select cron.unschedule('vekil_madde_baglam') where exists (select 1 from cron.job where jobname = 'vekil_madde_baglam');
select cron.schedule('vekil_madde_baglam', '40 4 * * *', $$set statement_timeout = '10min'; select public.madde_baglam_tazele()$$);
