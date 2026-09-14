-- HASAT DENGESİ — ölçülmüş iki kaybı kapatıyor. Yalnız ZAMANLAMA değişir;
-- veri silinmez, şema değişmez, kod değişmez. Tamamen geri alınabilir.
-- ===========================================================================
-- 14.09.2026 ÖLÇÜMLERİ (0121 + 0135 + 0136 + 0137):
--
--   metin hasat hızı ......... 615 karar/saat (teorik tavan 14.400/gün AŞILMIŞ)
--   karar başına disk ........ 28,1 KB
--   6000 MB frenine kalan .... 135.890 karar  →  ~9 GÜN
--   katalog künye ............ 2.376.678 (metni bekleyen 2.353.945)
--   katalog büyüme hızı ...... ~47.000 künye/saat
--   son hata ................. mod=katalog, istenen 40, eklenen 0,
--                              "upsert: canceling statement due to
--                               statement timeout"
--
-- İKİ KAYIP VAR VE İKİSİ DE ÖLÇÜLDÜ.
--
-- KAYIP 1 — METİN İNDİRME TURU KOTAYA BOĞULUYOR.
-- `hasat_tetikle(kaynak, 40, 'katalog')` bir turda 40 kararı birden
-- ictihat_kararlar'a upsert etmeye çalışıyor. O tablo 1.213 MB ve her satırda
-- İKİ ADET `stored` tsvector üretiliyor (0136 ölçümü: fts 7,3 KB +
-- fts_simple 10,0 KB — metnin kendisi yalnız 4,5 KB), üstüne 168 MB'lık iki
-- GIN indeksi güncelleniyor. 40'lık yığın statement timeout'a çarpıyor ve
-- TURUN TAMAMI KAYBEDİLİYOR: eklenen 0, zaten_vardi 0.
--   → Kota 40'tan 15'e indiriliyor. Bu bir YAVAŞLATMA DEĞİL: timeout yiyen
--     tur bugün SIFIR karar yazıyor; 15'lik tur yazabildiği kadarını yazıyor.
--     Beklenen etki net ARTIŞ. (Beklenti; bir sonraki 0121 koşusunda
--     ölçülecek ve yanılırsam geri alınacak.)
--
-- KAYIP 2 — KATALOG, METİNDEN 76 KAT ÖNDE KOŞUYOR VE KULLANICIYA ZARAR VERİYOR.
-- Katalog saatte ~47.000 künye ekliyor, metin ise 615. Zaten 2,35 milyon
-- künyenin metni bekliyor — bugünkü metin hızıyla ~159 YILLIK iş. Yani yeni
-- künye toplamak havuzu büyütmüyor, yalnız kuyruğu uzatıyor.
--
-- Ve bedeli yalnız disk değil: 0129 bunu ÖLÇTÜ — katalog işi kaynağa
-- yüklenirken aynı kamu kaynağına atılan ölçüm isteği HTTP 429 aldı, ardından
-- TLS zaman aşımıyla ancak 34,86 sn'de döndü (sağlıklıyken 1,08 sn). ai-chat
-- beslemesi de havuz yetmediğinde AYNI kaynağa gidiyor. Yani katalog hasadı,
-- avukatın ekrana bakarak beklediği cevabı yavaşlatıyor.
--   → Katalog genişletme sıklığı 4 dakikada bir (saatte ~45 tur) yerine
--     30 dakikada bire (saatte 2 tur) indiriliyor: ~%95 azalma.
--
-- NEDEN TAMAMEN DURDURMUYORUZ. Duran bir iş sessizce çürür: uç işlev bozulsa
-- ya da kaynağın API'si değişse aylarca fark edilmez. Düşük hızda dönmesi
-- hem kuyruğu şişirmez hem de yolun çalıştığını kanıtlar.
--
-- NE YAPILMADI VE NEDEN. Asıl kaldıraç `stored` tsvector'leri bırakıp ifade
-- indeksine geçmek: karar başına 28,1 KB → ~10,8 KB, yani 2,37 milyon karar
-- 63,7 GB yerine 24,5 GB eder ve mevcut 30 GB kararının İÇİNE sığar. Ama
-- canlı arama fonksiyonu (0113) her iki sütunu da kullanıyor
-- (`k.fts` ana merdivende, `k.fts_simple` önek eşleşmesinde) ve sütunu
-- düşürmek tsvector'ü sorgu anında hesaplatır — arama gecikmesi riski.
-- Aramanın zaten bir zaman aşımı geçmişi var (0108). Bu yüzden ÖNCE
-- ÖLÇÜLECEK, sonra yapılacak. Bu göç o işe girmiyor.
--
-- GERİ ALMA: aşağıdaki iki bloğu eski değerlerle (40 ve '0-59/4...') yeniden
-- çalıştırmak yeter. cron.schedule aynı adla çağrıldığında işi günceller.

-- ── 1) Metin indirme kotası: 40 → 15 ────────────────────────────────────────
do $$
begin
  if to_regclass('cron.job') is null then
    raise notice '0138: pg_cron yok, zamanlama atlandı';
    return;
  end if;
  perform cron.schedule('vekil_hasat_yargitay', '0-59/3 * * * *',
    $cmd$select public.hasat_tetikle('yargitay', 15, 'katalog')$cmd$);
  perform cron.schedule('vekil_hasat_danistay', '1-59/3 * * * *',
    $cmd$select public.hasat_tetikle('danistay', 15, 'katalog')$cmd$);
end $$;

-- ── 2) Katalog genişletme: 4 dakikada bir → 30 dakikada bir ────────────────
do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  perform cron.schedule('vekil_katalog_yargitay', '5,35 * * * *',
    $cmd$select public.katalog_tetikle('YARGITAYKARARI')$cmd$);
  perform cron.schedule('vekil_katalog_danistay', '20,50 * * * *',
    $cmd$select public.katalog_tetikle('DANISTAYKARAR')$cmd$);
end $$;

-- ── 3) Ne olduğunu göster (tek ifade — uygulayıcı yalnız sonuncuyu döndürür)
select olcum, deger from (
  select 1 as sira, 'yeni hasat zamanlamasi' as olcum,
    case
      when to_regclass('cron.job') is null then 'pg_cron KURULU DEGIL'
      else coalesce((xpath('/row/c/text()', query_to_xml($q$
        select string_agg(jobname || '  [' || schedule || ']  ' ||
                 regexp_replace(command, '\s+', ' ', 'g'), E'\n  ' order by jobname) as c
        from cron.job
        where jobname like '%hasat%' or jobname like '%katalog%'
      $q$, false, true, '')))[1]::text, 'HASAT ISI YOK')
    end as deger
) ozet order by sira;
