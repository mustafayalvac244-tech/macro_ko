-- Vekil Pro :: vektörleme eşzamanlılığı 40 → 8, sıklık 5 dk → 1 dk
-- ===========================================================================
-- 21.09.2026 — ÖLÇÜLDÜ, TAHMİN DEĞİL.
--
-- BELİRTİ: 04:00'ten itibaren postgres_logs'ta saatlik ERROR sayısı
-- 0–1'den 10–31'e çıktı; hepsi "canceling statement due to statement
-- timeout". Doğrudan SQL bağlantıları da zaman aşımına düşüyordu.
--
-- İLK TEŞHİSİM YANLIŞTI. "Bağlantı doygunluğu" demiştim — 18/19.09 gecesinin
-- aynısı sanıp. Hata kayıtlarındaki SORGU METNİ okununca (03:00–11:00):
--
--   postgres_exporter / pg_stat_statements   79   Supabase'in kendi izlemesi
--   ictihat_kararlar UPSERT                  21   hasat yazımı
--   ictihat_kararlar UPDATE embedding        21   vektörleme yazımı
--   ictihat_katalog SELECT                   13   hasat seçimi
--
-- Yani tıkanan şey bağlantı sayısı değil, AYNI TABLOYA (ictihat_kararlar)
-- eşzamanlı yazma çekişmesi: 40 paralel embedding UPDATE'i, her 3 dakikada
-- bir koşan hasat upsert'leriyle aynı satır aralıklarında buluşuyor.
--
-- ÇÖZÜM SEÇİMİ — neden sadece "40'ı 8 yap" değil:
-- İşçiyi 8'e indirip sıklığı */5'te bırakmak saatlik hızı 1.440'tan 288'e
-- düşürürdü; yani sorunu çözerken ürünün ilerlemesini beşe bölerdi. Oysa
-- çekişmeyi yaratan TOPLAM İŞ değil, AYNI ANDA yazan sayısı. Sıklık dakikaya
-- çekilince iş hacmi birebir korunuyor:
--
--   eski:  */5 · 40 işçi · yığın 3  =  120 kayıt / 5 dk  = 1.440/saat
--   yeni:  *   ·  8 işçi · yığın 3  =   24 kayıt / 1 dk  = 1.440/saat
--
-- Eşzamanlı yazan sayısı 40 → 8 (beşte bir), saatlik hız aynı.
--
-- HENÜZ ÖLÇÜLMEDİ: bu değişikliğin hata sayısını düşürüp düşürmediği. Bu
-- göç değişikliği KAYDEDER, sonucu KANITLAMAZ. Sonuç, değişiklikten sonraki
-- postgres_logs ERROR sayımıyla ayrıca ölçülür.
--
-- GERİ ALMA EŞİĞİ (şimdi yazılıyor, sonra değil):
--   15 dakikalık ERROR sayısı 5'i geçerse → işçiyi 4'e indir, sıklık kalsın.
--
-- NOT: canlıda bu değişiklik cron.alter_job ile 21.09.2026'da zaten
-- uygulandı ve geri okunarak doğrulandı. Bu dosya depoyu canlıya eşitler.
-- 0151 ile 0153 arasında depoya yazılmamış bir değişiklik vardı (işçi 40,
-- sıklık */5, elle alter_job); o boşluk bu dosyayla kapanıyor.

do $$
declare
  isci_sayisi constant int := 8;
  sikligi     constant text := '* * * * *';
begin
  perform cron.unschedule('vekil_vektorle_toplu')
  where exists (select 1 from cron.job where jobname = 'vekil_vektorle_toplu');

  perform cron.schedule(
    'vekil_vektorle_toplu',
    sikligi,
    format('select public.vektorle_toplu(%L, %s, 3)', 'ictihat', isci_sayisi)
  );
end $$;

-- Doğrulama: YALNIZ değişikliğin kendisi. Havuzun durumunu (kaç kayıt
-- vektörsüz) burada SAYMIYORUZ — 0151 tam da o sayım yüzünden Cloudflare
-- 524 ile iki kez düşmüştü.
select jobname || ' @ ' || schedule || ' :: ' || command as vektorle_isi
  from cron.job where jobname = 'vekil_vektorle_toplu';
