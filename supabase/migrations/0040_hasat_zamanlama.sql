-- İçtihat hasadını Supabase'in İÇİNDE zamanlar (GitHub Actions gerekmez).
--
-- NEDEN: hasat GitHub Actions'ta kuruluydu ve çalışması repoya secret
-- eklenmesine bağlıydı. O adım tamamlanamadı; dokuz zamanlı çalışma da secret
-- olmadığı için düştü ve havuz yalnız elle büyüdü. Tek bir dış yapılandırma
-- adımına bağlı kalmak, "havuzun sürekli büyümesi" hedefi için fazla kırılgan.
--
-- Burada aynı iş, veritabanının kendi zamanlayıcısıyla yapılır:
--   pg_cron  → zamanlama (yedekleme işleri zaten bu desenle çalışıyor)
--   pg_net   → edge fonksiyonuna HTTP çağrısı
--   Vault    → servis anahtarı (bu dosyaya anahtar YAZILMAZ; ada göre okunur)
--
-- GitHub iş akışı silinmedi: secret bir gün eklenirse o da çalışır ve iki yol
-- birbirini bozmaz — hasat idempotenttir, aynı kararı iki kez eklemez
-- (id çakışmasında upsert) ve sayfa durumu tek tablodan yürür.

-- Anahtarı Vault'tan okuyup edge fonksiyonunu çağırır. Cron komutları kısa ve
-- okunur kalsın diye ayrı fonksiyon; ayrıca elle de çağrılabilir (test için).
create or replace function public.hasat_tetikle(kaynak text, en_fazla integer default 6)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  anahtar text;
  istek_id bigint;
begin
  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  select net.http_post(
    url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/harvest-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anahtar
    ),
    body := jsonb_build_object('kaynak', kaynak, 'enFazla', en_fazla),
    timeout_milliseconds := 120000
  ) into istek_id;
  return istek_id;
end;
$$;

revoke execute on function public.hasat_tetikle(text, integer) from public, anon, authenticated;

-- Yeni kararların arama vektörünü doldurur. Vektörsüz karar anlamsal aramada
-- GÖRÜNMEZ; bu iş olmazsa havuz büyüdükçe arama kalitesi geriler.
create or replace function public.vektorle_tetikle(kaynak text default 'ictihat', en_fazla integer default 6)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  anahtar text;
  istek_id bigint;
begin
  select decrypted_secret into anahtar
  from vault.decrypted_secrets where name = 'vekil_service_key';
  if anahtar is null then
    raise exception 'vekil_service_key Vault''ta bulunamadı';
  end if;

  select net.http_post(
    url := 'https://wjshlysfmeqlnfiibknj.supabase.co/functions/v1/embed-ictihat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anahtar
    ),
    body := jsonb_build_object('kaynak', kaynak, 'limit', en_fazla),
    timeout_milliseconds := 120000
  ) into istek_id;
  return istek_id;
end;
$$;

revoke execute on function public.vektorle_tetikle(text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Zamanlama
--
-- Kaynaklar KAYDIRMALI dakikalarda çalışır: aynı anda üç kaynağa yüklenmek
-- UYAP/Bedesten hız sınırını tetikliyor ve throttle'da HTTP 200 + boş sonuç
-- dönüyor (sessiz kayıp). 20 dakikada bir, kaynak başına en fazla 6 karar:
-- saatte ~54 karar üst sınırı, kaynak siteleri yormayacak kadar nazik.
-- ---------------------------------------------------------------------------
select cron.schedule('vekil_hasat_yargitay', '3,23,43 * * * *', $$select public.hasat_tetikle('yargitay', 6)$$);
select cron.schedule('vekil_hasat_danistay', '9,29,49 * * * *', $$select public.hasat_tetikle('danistay', 6)$$);
select cron.schedule('vekil_hasat_emsal',    '15,35,55 * * * *', $$select public.hasat_tetikle('emsal', 6)$$);

-- Vektörleme hasattan sık: yeni kararlar birikmeden vektörlensin.
select cron.schedule('vekil_vektorle', '*/5 * * * *', $$select public.vektorle_tetikle('ictihat', 6)$$);
