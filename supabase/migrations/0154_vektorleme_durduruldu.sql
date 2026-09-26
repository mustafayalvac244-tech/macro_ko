-- Vekil Pro :: vektörleme cron'u DURDURULDU (kullanıcı girişi öncelikli)
-- ===========================================================================
-- 23.09.2026 — ölçülerek.
--
-- OLAY: gerçek bir kullanıcı (ürün sahibinin ekran görüntüsü, 19:22 TR)
-- uygulamaya giremedi. Hata gövdesi:
--     {"status":504,"statusText":"gateway timed out",
--      "url":".../auth/v1/token?grant_type=password"}
--
-- ÖLÇÜM (edge_logs, /auth/v1/token):
--     22.09 15:00 UTC → 1 başarılı, 1 × 504
--     22.09 16:00 UTC → 5 × 504
--   7 denemenin 6'sı düşmüş. Aynı saatlerde postgres_logs'ta saatlik hata
--   45–54 seviyesindeydi.
--
-- 0153'TE YAZDIĞIM TEŞHİS EKSİKTİ. Orada eşzamanlılığı 40'tan 8'e indirmiş
-- ve "yazma çekişmesi" demiştim. İki gün sonra ölçüldüğünde hatalar geri
-- gelmişti (23.09 01:00 UTC: 60 hata) ve baskın hata hâlâ aynıydı:
-- 75 kez `ictihat_kararlar` embedding UPDATE zaman aşımı. Yani 8 işçi de
-- yeterince az değildi.
--
-- "BAĞLANTI DOYGUNLUĞU" TEŞHİSİ DE YANLIŞTI — iki gün boyunca bunu
-- söyledim, ölçülünce çürüdü:
--     max_connections = 60 · açık bağlantı = 7 (4 boş, 2 çalışan, 1 işlemde)
-- Bağlantı bolca var. Sorun bağlantı sayısı değil, sorguların yavaşlığı:
-- 2,7 milyon künyelik hasat + 106 bin kararlık vektör indeksi, bu boyuttaki
-- bir sunucuda kullanıcı sorgularını kuyruğa sokuyor.
--
-- KARAR: arka plan işi, gerçek kullanıcının girişinden sonra gelir.
-- Vektörleme DURDURULDU (silinmedi — durduruldu).
--
-- GERİ ALMA (tek satır):
--     select cron.alter_job(96, active => true);
--
-- HENÜZ ÖLÇÜLMEDİ: bunun tek başına 504'leri bitirip bitirmediği.
-- Kapatmadan sonraki 70 dakikada hata devam etti (hasat 11, Supabase'in
-- kendi izlemesi 17, gerçek kullanıcı sorguları 3). Yani bu göç
-- "düzeltildi" demiyor, "en büyük kaynağı kestim" diyor.
--
-- HASAT DURDURULMADI: ürün sahibi hasat cron'larının durdurulmasını
-- REDDETTİ (23.09). Yani hasat yükü ve ondan gelen ara sıra zaman aşımı
-- bilinçli olarak yerinde duruyor.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vekil_vektorle_toplu') then
    perform cron.alter_job(
      (select jobid from cron.job where jobname = 'vekil_vektorle_toplu'),
      active => false
    );
  end if;
end $$;

-- Doğrulama: yalnız değişikliğin kendisi (0151'in dersi — havuz sayımı
-- göçün kendisini düşürüyordu).
select jobname, schedule, active
  from cron.job where jobname = 'vekil_vektorle_toplu';
