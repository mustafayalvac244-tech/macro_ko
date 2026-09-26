-- ACİL GERİ ÇEKME — 64 işçi veritabanını bağlantı kabul edemez hâle getirdi
-- ===========================================================================
-- OLAY (18-19.09.2026 gecesi). 0148 ile tek cron işi + 64 asenkron istek
-- kuruldu. İlk 4 dakika iyi göründü (7.699/saat, hata %2,2). Sonra doğrudan
-- SQL bağlantısı ZAMAN AŞIMINA DÜŞMEYE başladı — `select now()` bile.
-- Proje durumu ACTIVE_HEALTHY'ydi, yani düşen veritabanı değil, BAĞLANTI
-- KAPASİTESİYDİ ve sebebi bizim yükümüz.
--
-- EN OLASI SEBEP, ÖLÇÜLEBİLİR BİR İZLE BİRLİKTE: edge işlevi her çağrının
-- SONUNDA "kaç kayıt kaldı" saymak için
--     select count(*) from ictihat_kararlar where embedding is null
-- çalıştırıyor. Bu 70 bin satırlık bir sayım ve dakikada 64 kez koşuyordu.
-- İz şu: 21:20'den itibaren yanıtlarda `"remaining":null` görünmeye başladı —
-- yani o sayım ZATEN düşüyordu. Sayı üretmeyen ama kaynak yiyen bir sorgu.
--
-- DÜRÜST NOT: "en olası sebep" diyorum, KANITLANMIŞ demiyorum. Bağlantı
-- açamadığım için pg_stat_activity'yi okuyamadım; teşhisi yükü düşürdükten
-- sonra doğrulayacağım. Yanlış teşhisi kural gibi yazmak, teşhissizlikten
-- kötüdür.
--
-- BU GÖÇ NE YAPIYOR: işçi sayısını ÖLÇÜLMÜŞ GÜVENLİ değere (8) indiriyor.
-- 8 işçi 1.147-1.161/saat verdi ve 10 dakikada SIFIR hata üretti. Hız
-- düşüyor ama havuz yine de kapanıyor (hasat ~350-510/saat).
--
-- Sıradaki adım (ayrı bir değişiklik): pahalı `remaining` sayımını edge
-- işlevinden çıkarmak. O düzelince işçi sayısı tekrar denenebilir.

do $$
declare
  isci_sayisi constant int := 8;
  i int;
  ad text;
begin
  for i in 0..127 loop
    ad := 'vekil_vektorle_' || i;
    perform cron.unschedule(ad) where exists (select 1 from cron.job where jobname = ad);
  end loop;

  perform cron.unschedule('vekil_vektorle_toplu')
  where exists (select 1 from cron.job where jobname = 'vekil_vektorle_toplu');

  perform cron.schedule(
    'vekil_vektorle_toplu',
    '* * * * *',
    format('select public.vektorle_toplu(%L, %s, 3)', 'ictihat', isci_sayisi)
  );
end $$;

select olcum, deger from (
  select 1 as sira, 'toplu is' as olcum,
         coalesce(string_agg(jobname || ' :: ' || command, ' | '), 'YOK (!)') as deger
    from cron.job where jobname = 'vekil_vektorle_toplu'
  union all
  select 2, 'tek tek is kaldi mi',
         coalesce(count(*)::text, 'YOK (!)')
    from cron.job where jobname ~ '^vekil_vektorle_[0-9]+$'
  union all
  select 3, 'olcum ani', now()::text
) ozet order by sira;
