-- DİSK EMNİYET FRENİ — uygulamanın salt-okunur moda düşmesini önler.
--
-- ÖLÇÜLEN DURUM (bu düzeltme yazılırken): veritabanı 418 MB / 500 MB (%83,5)
-- ve içtihat hasadı günde ~1.150 karar × ~34 kB ≈ 39 MB büyütüyordu. Kalan
-- alan 82 MB → yaklaşık İKİ GÜN sonra Free planın sınırına çarpılacaktı.
-- Supabase Free planda bu sınır aşılınca proje SALT-OKUNUR moda geçer: okuma
-- çalışır ama HİÇBİR yazma işlemi olmaz — yeni dava, müvekkil, duruşma, belge
-- yükleme, kayıt olma, AI kullanımı, hepsi durur. Üstelik veri silmek boyutu
-- anında küçültmez (vacuum gerekir), yani çarptıktan sonra toparlanma da anlık
-- değildir.
--
-- BİRİNCİ ÖNLEM (cron): hasat işleri saatte 3 turdan GÜNDE 1 tura indirildi
-- (72 kat azalma), vektörleme saatlik bırakıldı (embedding'ler küçük ve
-- hasadın gerisinde kalmamalı).
--
-- İKİNCİ ÖNLEM (bu dosya): tahmin yanılsa bile bir daha ASLA duvara
-- çarpmayalım. hasat_tetikle ve vektorle_tetikle, veritabanı eşiği aşmışsa
-- İSTEĞİ HİÇ GÖNDERMEZ. Böylece disk dolmaya yaklaştığında büyümeyi üreten
-- şey kendiliğinden durur; kullanıcıların yazma işlemleri için alan kalır.
-- Eşik 460 MB: 500 MB sınırının altında 40 MB'lık bir tampon bırakır.
--
-- Not: bu fren yalnız ARKA PLAN büyümesini durdurur. Kullanıcıların kendi
-- verisi (dava/müvekkil/belge) engellenmez — zaten korunmak istenen odur.

create or replace function public.disk_musait_mi(p_esik_mb integer default 460)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select pg_database_size(current_database()) < (p_esik_mb::bigint * 1024 * 1024)
$$;

revoke all on function public.disk_musait_mi(integer) from public, anon, authenticated;
grant execute on function public.disk_musait_mi(integer) to service_role;

-- hasat_tetikle: eşik aşılmışsa hiç çağrı yapma.
create or replace function public.hasat_tetikle(kaynak text, en_fazla integer default 6)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  anahtar text;
  istek_id bigint;
begin
  -- EMNİYET FRENİ: disk sınıra yaklaştıysa arka plan büyümesini durdur.
  if not public.disk_musait_mi() then
    raise notice 'disk esigi asildi — hasat atlandi (kaynak: %)', kaynak;
    return null;
  end if;

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

revoke all on function public.hasat_tetikle(text, integer) from public, anon, authenticated;
grant execute on function public.hasat_tetikle(text, integer) to service_role;

-- vektorle_tetikle: aynı fren. Embedding küçük olsa da eşik aşıldığında
-- her türlü arka plan yazmasını kesmek en güvenlisi.
create or replace function public.vektorle_tetikle(kaynak text default 'ictihat', en_fazla integer default 6)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  anahtar text;
  istek_id bigint;
begin
  if not public.disk_musait_mi() then
    raise notice 'disk esigi asildi — vektorleme atlandi';
    return null;
  end if;

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
    -- DİKKAT: bu uçta gövde anahtarı 'limit' — 'enFazla' DEĞİL. Mevcut canlı
    -- fonksiyondan birebir okundu; yanlış yazılsaydı vektörleme sessizce
    -- varsayılan yığın boyutuna düşerdi.
    body := jsonb_build_object('kaynak', kaynak, 'limit', en_fazla),
    timeout_milliseconds := 120000
  ) into istek_id;
  return istek_id;
end;
$$;

revoke all on function public.vektorle_tetikle(text, integer) from public, anon, authenticated;
grant execute on function public.vektorle_tetikle(text, integer) to service_role;
