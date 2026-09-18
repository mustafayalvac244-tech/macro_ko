-- Vekil Pro :: vektörleme işçisi 8 → 16
-- ===========================================================================
-- 0144 ile 8 paralel işçi kuruldu ve ÖLÇÜLDÜ (18.09.2026):
--
--   21:06:46  embedding VAR 25.631
--   21:07:48  embedding VAR 25.652
--   21:11:56  embedding VAR 25.731
--   → 310 saniyede +100  = 1.161/saat
--   → 248 saniyede  +79  = 1.147/saat   (iki aralık tutarlı)
--   son 10 dk: 56 başarılı çağrı, 0 kaynak hatası
--
-- Önceki hız 68/saat'ti. Yani darboğaz açıldı ve açık artık KAPANIYOR.
--
-- NEDEN YİNE DE ARTIRIYORUM. 8 işçi × dakikada bir = saatte 480 çağrı
-- bekleniyordu; ölçülen 336 (10 dakikada 56). Yani zamanlanan çağrıların
-- ~%70'i düşüyor. İki açıklama var ve bu göç ikisini AYIRT EDER:
--
--   A) Kuyruk/gecikme — yanıtlar tabloya geç yazılıyor, kapasite boşta.
--      Bu doğruysa işçi sayısını artırmak hızı orantılı artırır.
--   B) Doyum — edge çalışma zamanı zaten sınırda.
--      Bu doğruysa hız artmaz, KAYNAK HATASI sayısı artar.
--
-- Ölçüm sonrası karar: hata sayısı 0'da kalıp hız arttıysa 16 kalır; hata
-- görünürse 0144'teki 8'e dönülür (aynı kalıpla, tek satır değişikliği).
--
-- Bu göç geri alınabilir ve veriye dokunmaz; yalnız zamanlama değiştirir.

do $$
declare
  isci_sayisi constant int := 16;
  yigin       constant int := 3;
  i int;
  ad text;
begin
  -- Fazladan kalmış işçi olmasın: önce 0..31 aralığını temizle, sonra kur.
  for i in 0..31 loop
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
