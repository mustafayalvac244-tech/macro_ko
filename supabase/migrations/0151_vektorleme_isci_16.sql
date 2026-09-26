-- Vekil Pro :: vektörleme işçisi 8 → 16 (tek cron işi, 16 asenkron istek)
-- ===========================================================================
-- NEDEN 16, NEDEN 64 DEĞİL.
--
-- Elimdeki bütün hız ölçümleri (8 · 16 · 32 · 64) uç işlevinde HÂLÂ şu sorgu
-- varken alındı:
--     select count(*) from ictihat_kararlar where embedding is null
-- Bu sorgu her çağrının sonunda koşuyordu ve gece yaşanan tıkanmanın
-- sebebiydi. Artık isteğe bağlı (gövdede `kalan: true` gelirse koşuyor).
--
-- Yani ÇAĞRI BAŞINA MALİYET DEĞİŞTİ ve eski sayılar bugünkü sistemi
-- anlatmıyor. 64'ü "ölçülmüş iyi değer" diye geri koymak, ölçmediğim bir
-- şeye güvenmek olurdu — geceyi yaratan hatanın aynısı.
--
-- 16, en KÖTÜ koşullarda (sayım hâlâ uçtayken) bile 10 dakikada 3 hata
-- vermişti ve 2.395/saat ölçülmüştü. Bugünkü koşullar kesin olarak daha iyi.
-- Dürüst ifade: en iyi değer BİLİNMİYOR; 16, bilinen en yüksek güvenli değer.
--
-- ÖLÇÜM ZİNCİRİ (18.09.2026, hepsi eski/pahalı sayım varken):
--   işçi  pencere                     Δ      hız/saat   hata
--    1*   eski cron (3 dk, yığın 6)    —       ~68      %100 çağrı düşüyordu
--    8    21:06:46 → 21:11:56       +100     1.161      0 / 10 dk
--    8    21:07:48 → 21:11:56        +79     1.147      0 / 10 dk
--   16    21:13:12 → 21:20:40       +298     2.395      3 / 10 dk
--   32    21:23:01 → 21:25:12       +124     3.408      1 / 5 dk  (kısa pencere)
--   64    21:25:12 → 21:29:39       +571     7.699      4 / 3 dk  → TIKANMA
--
-- GERİ ALMA: 0149'u tekrar uygula (8'e döner). Doğrudan SQL tıkanırsa bile
-- GitHub Actions → migration-uygula.yml yolu çalışır; gece kurtaran buydu.
--
-- GERİ ALMA EŞİĞİ (şimdi yazılıyor, sonra değil):
--   postgres_logs'ta 5 dakikalık ERROR sayısı 3'ü geçerse → 8'e dön.

do $$
declare
  isci_sayisi constant int := 16;
begin
  perform cron.unschedule('vekil_vektorle_toplu')
  where exists (select 1 from cron.job where jobname = 'vekil_vektorle_toplu');

  perform cron.schedule(
    'vekil_vektorle_toplu',
    '* * * * *',
    format('select public.vektorle_toplu(%L, %s, 3)', 'ictihat', isci_sayisi)
  );
end $$;

select olcum, deger from (
  select 1 as sira, 'vektorle isi' as olcum,
         coalesce(string_agg(jobname || ' @ ' || schedule || ' :: ' || command, ' | '), 'YOK (!)') as deger
    from cron.job where jobname like 'vekil_vektorle%'
  union all
  -- BURADA VEKTÖRSÜZ KAYIT SAYIMI YOKTU — BİLEREK.
  -- İlk hâlinde vardı ve göç Cloudflare 524 (ağ geçidi zaman aşımı) ile
  -- DÜŞTÜ: o sayım, gece biriken ölü tuple'lar yüzünden hâlâ dakikalar
  -- sürüyor. Yani cron değişikliğini uygulayan göç, kendi doğrulama
  -- sorgusu yüzünden uygulanamadı.
  --
  -- Bu, .claude/skills/once-dusun 7. maddesinin ta kendisi ("ölçüm aracının
  -- kendisi yükün parçası olabilir") — madde 19.09.2026'da yazıldı ve aynı
  -- gün tekrar aynı hataya düşüldü. Kural yazmak, kuralı uygulamak değildir.
  --
  -- Bir DEĞİŞİKLİK göçü, değişikliğin kendisini doğrular; havuzun durumu
  -- ayrı ve salt okunur bir göçün işidir (0145).
  select 2, 'olcum ani', now()::text
) ozet order by sira;
