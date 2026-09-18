-- Vekil Pro :: vektörleme işçisi 16 → 32
-- ===========================================================================
-- ÖLÇÜM ZİNCİRİ (18.09.2026, hepsi canlı, hepsi zaman damgalı):
--
--   işçi   pencere                       Δ embedding   hız/saat   hata(10dk)
--   ----   ---------------------------   -----------   --------   ----------
--    1*    (eski yapılandırma, limit 6)            —      ~68      %100
--    8     21:06:46 → 21:11:56 (310 sn)         +100    1.161       0
--    8     21:07:48 → 21:11:56 (248 sn)          +79    1.147       0
--   16     21:13:12 → 21:20:40 (448 sn)         +298    2.395       3
--
--   * eski yapılandırma: tek iş, 3 dakikada bir, yığın 6 → HER çağrı düşüyordu.
--
-- 8 → 16 geçişinde hız 2,08 kat arttı. Yani 0146'nın sorduğu soruya cevap
-- geldi: darboğaz DOYUM DEĞİL, kuyruk/gecikmeydi (A şıkkı). Paralellik
-- gerçekten karşılığını veriyor.
--
-- Bu yüzden 32 deneniyor. Ölçüt aynı: hız orantılı artıyor mu, hata sayısı
-- kabul edilebilir kalıyor mu, VE hasat zarar görüyor mu.
--
-- HASAT DA İZLENİYOR — çünkü harvest-tick de aynı edge çalışma zamanını
-- kullanıyor ve vektörleme onu aç bırakabilir. Şu ana kadar ölçülen:
--   20:45 öncesi 12 saatlik ortalama ~510/saat
--   21:06 penceresi 32/10dk · 21:11 penceresi 60/10dk · 21:20 penceresi 41/10dk
-- Düşüş, işçiler artmadan ÖNCE başlamıştı (21:06 penceresinde vektörleme
-- neredeyse kapalıydı), o yüzden sebebi vektörleme olarak GÖSTERİLEMEZ —
-- ama izlemeye devam. Hasat çökerse işçi sayısı geri çekilir.

do $$
declare
  isci_sayisi constant int := 32;
  yigin       constant int := 3;
  i int;
  ad text;
begin
  for i in 0..127 loop
    ad := 'vekil_vektorle_' || i;
    perform cron.unschedule(ad) where exists (select 1 from cron.job where jobname = ad);
  end loop;

  for i in 0..(isci_sayisi - 1) loop
    perform cron.schedule(
      'vekil_vektorle_' || i,
      '* * * * *',
      format('select public.vektorle_tetikle(%L, %s, %s)', 'ictihat', yigin, i * yigin)
    );
  end loop;
end $$;

select olcum, deger from (
  select 1 as sira, 'isci sayisi' as olcum, coalesce(count(*)::text,'YOK (!)') as deger
    from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 2, 'hepsi aktif mi', coalesce(string_agg(distinct active::text,','),'YOK (!)')
    from cron.job where jobname like 'vekil_vektorle%'
  union all
  select 3, 'embedding VAR', coalesce(count(*) filter (where embedding is not null)::text,'YOK (!)')
    from public.ictihat_kararlar
  union all
  select 4, 'olcum ani', now()::text
) ozet order by sira;
