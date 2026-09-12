-- DİSK FRENİ 6 GB → 30 GB — kullanıcı kararı: "ek ücret öderim".
--
-- NEDEN ŞİMDİ. 0122 ile hasat terimleri 134'ten 323'e çıkarıldı ve canlıdaki
-- terim satırı 404 → 970 oldu. Ama fren 6.000 MB'da duruyor ve ölçülen büyüme
-- hızıyla (12.09: 588 MB, günde 155–222 MB) yaklaşık BİR AY sonra hasat kendi
-- kendini durdururdu. O durumda terim genişletmesi de boşa giderdi: kapıyı
-- açıp önüne duvar örmek olurdu.
--
-- EŞİK NEDEN 30.000 MB — tahminle değil, FATURAYLA seçildi:
--   Supabase Pro'da 8 GB dahil, üstü $0,125/GB/ay.
--   30 GB'da aşım 22 GB → ayda +$2,75.
--   Ölçülen karar başına 33,2 KB ile 30 GB ≈ 900 bin karar.
-- Yani bu eşik "ne kadar disk" sorusunu değil, "ayda kaç dolar" sorusunu
-- cevaplıyor. Rakam büyütülmek istenirse bakılacak yer fatura, disk değil.
--
-- FREN NEDEN HÂLÂ VAR (kaldırılmadı). Tavana dayalı bir fren sessiz fatura
-- demektir; freni tamamen kaldırmak ise hasat bir gün beklenmedik biçimde
-- hızlanırsa (yeni terimler tam da bunu hedefliyor) faturayı kimse bakmadan
-- büyütür. Fren, "durdur" düğmesi değil, "haberim olsun" düğmesi.
--
-- KULLANICI VERİSİ ZATEN ETKİLENMİYOR: fren yalnız ARKA PLAN büyümesini
-- (hasat + vektörleme) durdurur; avukatın dava/müvekkil/belge yazması hiçbir
-- eşikte engellenmez (bkz. 0084'teki aynı not).
--
-- ÖLÇÜLMEYEN — açıkça yazıyorum: 900 bin satırda ARAMA BAŞARIMI bilinmiyor.
-- FTS ayarları ~11 bin satırda yapıldı (0111/0113). Asıl risk burada; disk
-- değil. Korpus 100 bini geçtiğinde eval-ictihat yeniden koşulmalı — o ölçüm
-- API parası istemiyor, yalnız veritabanı.

create or replace function public.disk_musait_mi(p_esik_mb integer default 30000)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select pg_database_size(current_database()) < (p_esik_mb::bigint * 1024 * 1024)
$$;

-- Yetkiler 0084/0100 ile aynı: yalnız service_role çağırır.
revoke all on function public.disk_musait_mi(integer) from public, anon, authenticated;
grant execute on function public.disk_musait_mi(integer) to service_role;

-- Doğrulama: şu anki boyut ve yeni eşiğe göre durum.
select pg_size_pretty(pg_database_size(current_database())) as su_anki_boyut,
       public.disk_musait_mi()                              as hasat_devam_edebilir,
       round((30000 - pg_database_size(current_database()) / 1024.0 / 1024.0)) as kalan_mb;
