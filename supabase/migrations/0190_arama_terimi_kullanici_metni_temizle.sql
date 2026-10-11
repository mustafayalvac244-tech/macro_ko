-- 0190 — ictihat_kararlar.arama_terimi'ndeki KULLANICI METNİNİ temizle (09.10.2026).
--
-- SORUN. ai-chat, havuz yetersiz kalınca canlı kaynaktan (Bedesten) getirdiği
-- kararları arşivlerken `arama_terimi` sütununa SORUNUN/ANLATIMIN ilk 120
-- karakterini yazıyordu (canliArsivle). Dilekçe yolunda bu, avukatın olay
-- anlatımıydı: müvekkil adı, olay, T.C. no kalıcı tabloya düşüyordu (müvekkil
-- sırrı, Av.K. m.36; 0162'nin "soru metni saklanmaz" ilkesine aykırı). Kod
-- düzeltildi (ai-chat > canliArsivle artık yalnız hasat listesindeki SABİT konu
-- adını ya da null yazar; tests/dilekceSunucu.test.ts). Bu göç, o güne dek
-- yazılmış kalıntıyı siler.
--
-- NEYİ SİLER. `arama_terimi` dolu olup hasat listesinde (ictihat_harvest_state)
-- bulunmayan satırların YALNIZ o sütununu null yapar. Hasat işleri bu sütuna
-- listedeki terimi yazar (harvest-tick: aramaTerimi; yalnız önekli
-- "yargitay:/danistay:" kopyaları öneksiz yazılabilir, ikisi de korunur);
-- listede olmayan her değer kullanıcının yazdığı metindir. İçtihat Arama
-- ekranının arşivlediği sorgu metni de (ictihat/index.ts: query.slice(0,120))
-- aynı biçimde silinir. Karar metnine (full_text) ve kimliğe DOKUNULMAZ.
--
-- ÖNCE DÜŞÜN (.claude/skills/once-dusun §8):
--   DEĞİŞİKLİK : kullanıcı metni taşıyan arama_terimi değerlerini null yapmak.
--   ÇARPAN     : tek bir UPDATE; taranan satır ictihat_kararlar'ın tamamı
--                (pg_class.reltuples ≈ 270.838, 09.10.2026), güncellenecek
--                satır sayısı ÖLÇÜLMEDİ (büyük tabloda tam tarama yasaktı).
--                Hasat listesi ≈ 970 satır (reltuples). Alt sorgu ilişkisiz →
--                tek kez hash'lenir, satır başına 970 karşılaştırma YOK.
--                UPDATE güncellenen her satırın yeni bir ana-heap sürümünü
--                yazar (full_text TOAST'ta kalır, kopyalanmaz); eski sürümler
--                vacuum ile geri kazanılır. Disk baskısındaki veritabanında
--                bu geçici bir büyümedir: disk_musait_mi() kapalıysa göç
--                HATA VERİR (sessizce atlamaz; disk rahatlayınca yeniden
--                uygulanır).
--   YANLIŞ GİDERSE : belirti — scripts/hasat-kalite-olcum.sql'deki "terim
--                başına karar" sayımı, listede olmayan eski terimlerden gelen
--                satırlar için düşer (yalnız izleme sütunu; karar kaybı yok).
--                Geri alma: sütun değeri kullanıcı metniydi, GERİ ALINAMAZ
--                ve geri alınmak İSTENMEZ; yanlışlıkla silinen hasat terimi
--                etiketi harvest-tick bir sonraki yazışta yeniden doldurmaz
--                (yalnız yeni satırlara yazar).
--   BİTTİ DEMEK İÇİN : uyguladıktan sonra aşağıdaki sorgu 0 vermeli (tam tarama,
--                bir kez, disk müsaitken):
--                select count(*) from public.ictihat_kararlar k
--                 where k.arama_terimi is not null
--                   and k.arama_terimi not in (
--                     select terim from public.ictihat_harvest_state
--                     union select regexp_replace(terim, '^(yargitay|danistay):', '')
--                       from public.ictihat_harvest_state);
--
-- Yerel deneme (09.10.2026): calistir.sh 0190 iki koşu temiz; ayrıca taklit
-- şemada 5 satır tohumlandı (hasat terimi, öneksiz karşılığı, "yargitay:"
-- önekli, kişi adı + T.C. içeren anlatım, null): yalnız anlatım satırı null
-- oldu, diğer dördü aynen kaldı.

do $$
declare
  v_sayi bigint;
begin
  -- Tablo adı plpgsql gövdesinde çalışma zamanında çözülür; yoksa güvenle çık.
  if to_regclass('public.ictihat_kararlar') is null
     or to_regclass('public.ictihat_harvest_state') is null then
    raise notice '0190: tablo yok, atlandı';
    return;
  end if;

  if not coalesce(public.disk_musait_mi(), false) then
    raise exception '0190: disk müsait değil, yazma yapılmadı; disk rahatlayınca yeniden uygulayın';
  end if;

  update public.ictihat_kararlar k
     set arama_terimi = null
   where k.arama_terimi is not null
     and k.arama_terimi not in (
       select h.terim from public.ictihat_harvest_state h
       union
       select regexp_replace(h.terim, '^(yargitay|danistay):', '')
         from public.ictihat_harvest_state h
     );
  get diagnostics v_sayi = row_count;
  raise notice '0190: % satırın arama_terimi temizlendi', v_sayi;
end
$$;
