-- HASAT CANLI DENEMESİ — zinciri baştan sona ELLE çalıştırıp sonucu okur.
-- ===========================================================================
-- NEDEN BU DOSYA. Canlıda bugüne kadar ÖLÇÜLENLER:
--   • Disk 434.7 MB / eşik 6000 MB → fren AÇIK, hasat serbest
--   • 0093 uygulanmış (oncelik sütunu var), 0094 uygulanmış (3 dakikada bir)
--   • Dokuz pg_cron işinin hepsi [açık]
-- Yani KURULUM tamam. Ama kurulum "çalışıyor" DEMEK DEĞİLDİR.
--
-- Zincirin kör noktası:
--     pg_cron → hasat_tetikle() → net.http_post(...) → harvest-tick
-- net.http_post ateşle-unut çağırır: bir istek kimliği döndürür ve biter.
-- harvest-tick 500 dönse de, 403 dönse de, hiç cevap vermese de hasat_tetikle
-- BAŞARILI sayılır ve cron işi "succeeded" yazar. Bu yüzden "işler açık"
-- bilgisi tek başına hiçbir şey kanıtlamaz.
--
-- BU DOSYA bir turu ELLE tetikler, bekler ve edge işlevinin GERÇEK yanıtını
-- okur. Dört soruya birden cevap verir:
--   1. Vault'ta servis anahtarı var mı? (yoksa hasat hiç çalışamaz)
--   2. Tetikleme isteği gidiyor mu?
--   3. harvest-tick ne döndürüyor — 200 mü, 500 mü, hiç mi?
--   4. Havuza yeni karar giriyor mu?
--
-- GÜVENLİ Mİ: evet. Tek tur, en fazla 10 karar — cron'un üç dakikada bir
-- zaten yaptığının aynısı. Yeni bir yük getirmez.
--
-- NEDEN GEÇİCİ FONKSİYON: Vault anahtarı yoksa hasat_tetikle exception
-- fırlatır ve düz bir betikte GERİ KALAN HER ŞEY çalışmadan iptal olur —
-- yani asıl teşhis satırlarını hiç göremezdik. Fonksiyon içindeki exception
-- kalkanı bunu engelliyor: hata bir SATIR olarak raporlanıyor, koşu devam
-- ediyor. (RAISE NOTICE kullanmadım: Supabase SQL Editor bildirimleri
-- göstermiyor — 0100'ü çalıştırdığında "Success. No rows returned" demişti,
-- oysa o dosyada notice vardı.)
--
-- ÖNCE 0104'Ü ÇALIŞTIR: hasat_saglik "tr_kucult anon'a HÂLÂ AÇIK" diyor.

create or replace function public.hasat_denemesi_gecici()
returns table(sira integer, alan text, deger text)
language plpgsql
as $$
declare
  v_id bigint;
  v_once bigint;
  v_sonra bigint;
begin
  -- 1) Vault anahtarı ---------------------------------------------------------
  begin
    if exists (select 1 from vault.decrypted_secrets where name = 'vekil_service_key') then
      sira := 1; alan := 'vault_anahtari'; deger := 'VAR'; return next;
    else
      sira := 1; alan := 'vault_anahtari';
      deger := 'YOK → hasat hiç çalışamaz. Settings → Vault → New secret, ad: vekil_service_key';
      return next;
    end if;
  exception when others then
    sira := 1; alan := 'vault_anahtari'; deger := 'okunamadı: ' || sqlerrm; return next;
  end;

  -- 2) Tetiklemeden önceki havuz ----------------------------------------------
  begin
    select count(*) into v_once from public.ictihat_kararlar;
    sira := 2; alan := 'havuz_once'; deger := v_once::text; return next;
  exception when others then
    v_once := null;
    sira := 2; alan := 'havuz_once'; deger := 'okunamadı: ' || sqlerrm; return next;
  end;

  -- 3) Elle bir tur -----------------------------------------------------------
  begin
    select public.hasat_tetikle('yargitay', 10) into v_id;
    sira := 3; alan := 'tetikleme';
    deger := coalesce('istek gönderildi, id=' || v_id::text,
                      'NULL döndü → disk freni kapatmış ya da Vault anahtarı yok');
    return next;
  exception when others then
    sira := 3; alan := 'tetikleme'; deger := 'HATA: ' || sqlerrm; return next;
  end;

  -- 4) Bekle — harvest-tick her karar arasında 300 ms duruyor ------------------
  perform pg_sleep(12);

  -- 5) Sonraki havuz ----------------------------------------------------------
  begin
    select count(*) into v_sonra from public.ictihat_kararlar;
    sira := 4; alan := 'havuz_sonra'; deger := v_sonra::text; return next;
    sira := 5; alan := 'yeni_karar';
    deger := case
               when v_once is null then 'hesaplanamadı'
               when v_sonra - v_once > 0 then (v_sonra - v_once)::text || ' YENİ KARAR GİRDİ'
               else '0 — ya hepsi zaten havuzdaydı ya da hiç sonuç gelmedi'
             end;
    return next;
  exception when others then
    sira := 4; alan := 'havuz_sonra'; deger := 'okunamadı: ' || sqlerrm; return next;
  end;
end;
$$;

select * from public.hasat_denemesi_gecici() order by sira;

drop function public.hasat_denemesi_gecici();

-- ── EDGE İŞLEVİNİN GERÇEK YANITI — ASIL KANIT ───────────────────────────────
-- 200 + gövdede "eklenen"   → hasat çalışıyor.
-- 500 "state_failed"        → terim seçimi düşüyor (sütun/yetki).
-- 403 "forbidden"           → servis anahtarı yanlış.
-- 401                       → Authorization başlığı geçmiyor.
-- Hiç satır yok             → istek hiç çıkmamış; yukarıdaki 1. ve 3. satıra bak.
select id,
       status_code,
       left(coalesce(content, error_msg, '(gövde yok)'), 400) as govde,
       created
from net._http_response
order by id desc
limit 5;

-- ── TAM TABLO ───────────────────────────────────────────────────────────────
select * from public.hasat_saglik()
where bolum in ('cron_sonuc', 'edge_yanit', 'havuz', 'havuz_kurul', 'terimler');
