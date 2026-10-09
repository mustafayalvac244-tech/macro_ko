-- T.C. KİMLİK NO AUTH ÜSTVERİSİNDE KALMAZ (09.10.2026 denetimi).
--
-- SORUN. Kayıt formu TC'yi signUp'ın options.data'sıyla gönderiyor
-- (src/store/authStore.ts > signUp). Bu bilinçli: e-posta doğrulaması açıkken
-- signUp oturum döndürmez, ayrı bir UPDATE kimliksiz kalır ve veri kaybolurdu
-- (bkz. 0086). handle_new_user (0086) TC'yi profiles.tc_no'ya kopyalıyor AMA
-- auth.users.raw_user_meta_data'dan SİLMİYOR. Supabase user_metadata'yı
-- kullanıcının ERİŞİM JETONUNA koyar — belgedeki uyarı aynen: "These fields
-- will be exposed in the user's access token JWT"
-- (supabase.com/docs/guides/auth/managing-user-data; alanlar:
-- supabase.com/docs/guides/auth/jwt-fields). Sonuç: TC numarası
--   • her API isteğinin Authorization başlığında şifresiz (base64) gidiyor,
--   • cihazda saklanan oturum kaydında (AsyncStorage / tarayıcı localStorage)
--     duruyor,
--   • profiles.tc_no'nun bilinçli olarak kapalı tutulmasını (yalnız my_profile
--     ile sahibine) boşa çıkarıyor.
--
-- CANLI ÖLÇÜM (09.10.2026; yalnız pg_proc/pg_trigger, kullanıcı verisi
-- okunmadı): handle_new_user gövdesi 0086 ile birebir aynı (md5 352fb049…),
-- temizlik yok; auth.users'ta iki AFTER INSERT tetikleyici var
-- (kvkk_onay_kayit_tetik, on_auth_user_created); fonksiyonun sahibi postgres,
-- SECURITY DEFINER ve auth.users üzerinde UPDATE yetkisi var.
--
-- ÇÖZÜM.
--  1) handle_new_user profili yazdıktan SONRA tc_no'yu üstveriden siler.
--     GoTrue kayıttan sonra kullanıcıyı veritabanından yeniden okur — kaynak
--     (supabase/auth, internal/api/signup.go > signupNewUser, 09.10.2026
--     okundu): "there may be triggers ... that will modify the user data as it
--     is being inserted. thus we load the user object again". Yani kaydın
--     yanıtı ve ilk jeton da temiz üretilir. Canlı GoTrue sürümünde ayrıca
--     ÖLÇÜLMEDİ.
--     Doğrulanmamış hesapla TEKRAR kayıt olunduğunda GoTrue üstveriyi
--     güncellemiyor (aynı dosya: "do not update the user because we can't be
--     sure of their claimed identity"); bu yüzden ayrı bir UPDATE tetikleyicisi
--     eklenmedi.
--  2) Var olan kayıtlardaki kopya silinir. profiles.tc_no'ya DOKUNULMAZ (asıl
--     kaynak orası). Üstveride kalan değerler çoğunlukla '' (TC girilmeyen
--     kayıtlar: istemci boşken '' gönderiyor) ya da profile zaten kopyalanmış
--     TC'dir.
--
-- ÖNCE DÜŞÜN (.claude/skills/once-dusun §8):
--   DEĞİŞİKLİK : auth.users üstverisinden tc_no anahtarını kaldırmak.
--   ÇARPAN     : kayıt başına en çok bir ek UPDATE (yalnız üstveride tc_no
--                varsa). 2. adım tek seferlik; tc_no taşıyan satır sayısı
--                ÖLÇÜLMEDİ (kullanıcı verisi okunmadı).
--   YANLIŞ GİDERSE : belirti — kayıt "Database error saving new user" ile
--                düşer. Geri alma: 0086'daki handle_new_user gövdesini aynen
--                yeniden uygula (migration-uygula iş akışı ya da SQL Editor).
--                2. ADIM GERİ ALINAMAZ: üstverideki kopya silinir; TC
--                profiles.tc_no'da durur.
--   BİTTİ DEMEK İÇİN : uyguladıktan sonra yeni bir deneme kaydında
--                profiles.tc_no dolu VE raw_user_meta_data ? 'tc_no' = false;
--                select count(*) from auth.users where raw_user_meta_data ? 'tc_no'
--                → 0.
--
-- Yerel deneme (09.10.2026): scripts/migration-deneme/calistir.sh 0181 (iki
-- koşu temiz) + taklit şemada tetikleyiciyle uçtan uca kayıt denemesi.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_tc text := nullif(trim(coalesce(m ->> 'tc_no', '')), '');
begin
  -- TC yalnız tam 11 hanelik rakam dizisiyse saklanır; değilse hiç yazılmaz.
  if v_tc is not null and v_tc !~ '^[0-9]{11}$' then
    v_tc := null;
  end if;

  insert into public.profiles (id, email, full_name, firm_name, tc_no, baro, bar_number)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(m ->> 'full_name', ''), 120),
    nullif(left(trim(coalesce(m ->> 'firm_name', '')), 160), ''),
    v_tc,
    nullif(left(trim(coalesce(m ->> 'baro', '')), 60), ''),
    nullif(left(trim(coalesce(m ->> 'bar_number', '')), 30), '')
  );

  -- 0181: TC profile yazıldı; auth üstverisinde KALMAZ (erişim jetonuna girer).
  if m ? 'tc_no' then
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'tc_no'
     where id = new.id;
  end if;
  return new;
end;
$$;

-- Tetikleyici gövdesi istemciden çağrılamaz (0079 kilidi). CREATE OR REPLACE
-- canlıdaki yetkileri korur; bu satır taze bir veritabanında da aynı sonucu verir.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Var olan kayıtlar: üstverideki kopya silinir; profiles.tc_no'ya dokunulmaz.
update auth.users set raw_user_meta_data = raw_user_meta_data - 'tc_no' where raw_user_meta_data ? 'tc_no';
