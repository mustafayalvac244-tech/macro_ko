-- HASAT YAVAŞLADI — sebep ölçüldü (19.09.2026)
-- ===========================================================================
-- ÖLÇÜM:
--   son 24 saat hasat: 1.876 karar   (18.09'da 12.274'tü)
--   net._http_response, son 2 saat: 35 tur şu notla döndü:
--     "upsert: canceling statement due to statement timeout"
--   pg_stat_user_tables:
--     ictihat_katalog  canlı 2.657.763 · ÖLÜ 104.836 · son autovacuum 14.09
--
-- Yani hasat UYAP'tan veriyi çekiyor ama VERİTABANINA YAZAMIYOR. Yazamama
-- sebebi 2,6 milyonluk tabloda birikmiş ölü satırlar: her upsert indeksleri
-- gezerken zaman aşımına giriyor.
--
-- İKİ PARÇA:
-- 1) KALICI: bu tablo için autovacuum eşiği sıkılaştırılıyor. Varsayılan
--    ölçek %20 (yani ~531.000 ölü satır birikmeden temizlik başlamıyor).
--    %2'ye çekiliyor → ~53.000'de devreye girer. Yazma yoğun bir katalog
--    tablosu için varsayılan çok gevşek.
-- 2) TEK SEFERLİK: şu anki birikim elle temizleniyor.
--
-- ELLE VACUUM BU DOSYADA YOK — BİLEREK.
-- İlk hâlinde vardı ve göç şu hatayla düştü:
--   25001: VACUUM cannot run inside a transaction block
-- Yani uygulayıcı (Supabase Management API) SQL'i bir işlemle sarmalıyor.
-- Daha kötüsü: hata yüzünden ALTER TABLE'lar da geri alındı, yani hiçbir
-- şey uygulanmadı. Tek bir çalışmayan ifade, çalışan ifadeleri de götürdü.
-- (0150'de aynı deneme Cloudflare 524 ile düşmüştü; sebebi şimdi anlaşıldı.)
--
-- ELLE VACUUM GEREKMİYOR: ölçek %2'ye inince eşik 2.657.763 × 0,02 ≈ 53.000
-- olur ve tabloda ŞU AN 104.836 ölü satır var — yani eşiğin iki katı.
-- Autovacuum ayar uygulanır uygulanmaz kendiliğinden devreye girer.

alter table public.ictihat_katalog set (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 2000
);

alter table public.ictihat_kararlar set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_cost_limit = 2000
);

