-- YAŞAM BOYU DENEME HAKKI — free/baslangic katmanına artık Groq yönlendirilmiyor
-- (bkz. katman.ts: "sadece Opus" kararı). Ödeme yapmamış bir aday, AY BAZLI
-- DEĞİL, hiç yenilenmeyen DENEME_SORU_LIMIT (3) kadar bir tat alır — bunu bile
-- Opus'la, çünkü Groq'ta GERÇEK bir mantık hatası ölçüldü (bkz. konuşma
-- geçmişi: "aldı" fiilini "ödedi"ye çevirmişti) ve bir avukatın AI'yla İLK
-- teması bu olursa ürünü bir daha denemeyebilir.
--
-- NEDEN AYRI SÜTUN, ai_mod_kota DEĞİL. ai_mod_kota (0074) AY bazlı — her ay
-- sıfırlanır. Deneme hakkı YAŞAM BOYU bir kez verilir, hiç yenilenmez; aynı
-- tabloyu paylaşmak "her ay 3 deneme daha" gibi istenmeyen bir davranışa yol
-- açardı. Basit bir sayaç yeterli, ayrı bir tablo gerekmez.
--
-- GÜVENLİK — AYNI SINIFTAN AÇIĞI TEKRAR ETMEMEK İÇİN. 0076'da is_premium ve
-- ai_tier'ın authenticated tarafından DOĞRUDAN güncellenebildiği (bir
-- kullanıcının kendi kendine premium/ai_tier verebilmesi) bulunup kapatılmıştı.
-- Bu yeni sütun AYNI riski taşır: korunmazsa bir kullanıcı kendi
-- deneme_soru_kullanildi'sini sıfırlayıp SINIRSIZ deneme hakkı elde edebilirdi.
--
-- AŞAĞIDAKİ REVOKE TEK BAŞINA YETERSİZ — CANLIDA DOĞRULANDI. "Yeni sütunlar
-- eski geniş grant'lardan miras almaz" varsayımıyla kolon-özel bir REVOKE
-- yazılmıştı; ama profiles tablosunda authenticated/anon'a TABLO GENELİNDE
-- (kolon belirtilmeden) verilmiş eski bir UPDATE grant'ı var (bkz. 0001) ve
-- Postgres'te kolon-özel REVOKE, tablo-geneli bir GRANT'ı GEÇERSİZ KILMAZ.
-- Gerçek bir saldırı denemesiyle (demo hesabıyla deneme_soru_kullanildi'yi
-- -999 yapmaya çalışarak) doğrulandı: aşağıdaki REVOKE'a RAĞMEN authenticated
-- hâlâ bu kolonda UPDATE yetkisine sahip. TEK GERÇEK KORUMA aşağıdaki
-- protect_profile_privileges TETİKLEYİCİSİ — is_admin/is_premium/ai_tier için
-- de zaten öyleydi (0023, 0076). REVOKE satırı zararsız/gereksiz kalıyor,
-- kaldırılmadı (savunma derinliği, ve tablo-geneli grant bir gün kaldırılırsa
-- devreye girer) ama YALNIZ BAŞINA GÜVENMEYİN.
alter table public.profiles add column if not exists deneme_soru_kullanildi integer not null default 0;

revoke update (deneme_soru_kullanildi) on public.profiles from authenticated, anon;

/**
 * Deneme hakkını ATOMİK biçimde rezerve eder — ai_mod_rezerve_et (0074) ile
 * AYNI desen (SELECT ... FOR UPDATE satır kilidi), aynı yarış durumu
 * korumasıyla. Limit dolmuşsa false döner, doluysa sayaç artar ve true döner.
 */
create or replace function public.deneme_hakki_rezerve_et(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer set search_path = public as $$
declare mevcut integer;
begin
  select deneme_soru_kullanildi into mevcut
  from public.profiles
  where id = p_user
  for update;

  if mevcut is null then
    -- Profil satırı yoksa güvenli taraf: reddet (var olmayan kullanıcıya
    -- deneme hakkı verilmez).
    return false;
  end if;

  if mevcut >= p_limit then
    return false;
  end if;

  update public.profiles set deneme_soru_kullanildi = deneme_soru_kullanildi + 1 where id = p_user;
  return true;
end;
$$;

/**
 * Kusurlu çıktıda rezerve edilen deneme hakkını geri verir — aynı "kusurlu
 * çıktıda hak gitmez" ilkesi (bkz. ai_mod_serbest_birak, 0074). Sıfırın
 * altına düşmez.
 */
create or replace function public.deneme_hakki_serbest_birak(p_user uuid)
returns void
language sql
security definer set search_path = public as $$
  update public.profiles
  set deneme_soru_kullanildi = greatest(0, deneme_soru_kullanildi - 1)
  where id = p_user
$$;

grant execute on function public.deneme_hakki_rezerve_et(uuid, integer) to service_role;
grant execute on function public.deneme_hakki_serbest_birak(uuid) to service_role;

-- Savunma derinliği: is_admin/is_premium/ai_tier'ı koruyan aynı tetikleyiciye
-- deneme_soru_kullanildi'yi de ekle. REVOKE zaten doğrudan UPDATE'i engelliyor
-- olsa da, gelecekte biri bu sütuna yanlışlıkla yeniden UPDATE izni verirse
-- (ör. "grant update on profiles to authenticated" gibi tablo-geneli bir
-- komutla) bu tetikleyici ikinci bir güvenlik ağı olarak kalır.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  if (new.is_admin is distinct from old.is_admin
      or new.is_premium is distinct from old.is_premium
      or new.ai_tier is distinct from old.ai_tier
      or new.deneme_soru_kullanildi is distinct from old.deneme_soru_kullanildi)
     and auth.uid() is not null then
    caller_is_admin := coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
    if not caller_is_admin then
      new.is_admin := old.is_admin;
      new.is_premium := old.is_premium;
      new.ai_tier := old.ai_tier;
      new.deneme_soru_kullanildi := old.deneme_soru_kullanildi;
    end if;
  end if;
  return new;
end;
$$;
