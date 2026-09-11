-- 1) KENDİ AÇTIĞIM DELİĞİ KAPATMA: son_gorulme kullanıcı tarafından YAZILABİLİYORDU
-- ---------------------------------------------------------------------------
-- 0097'de profiles'a son_gorulme eklendi ve yazımı son_gorulme_dokun() RPC'sine
-- bırakıldı. AMA sütun seviyesinde UPDATE yetkisi KALDIRILMADI. Supabase'de
-- authenticated rolünün public şemadaki tablolarda tablo-geneli UPDATE yetkisi
-- vardır; profiles'ta kullanıcı kendi satırını (RLS ile) güncelleyebiliyor.
-- Yani kullanıcı doğrudan
--     PATCH /rest/v1/profiles?id=eq.<kendi id>  {"son_gorulme":"2030-01-01"}
-- diyerek damgayı İSTEDİĞİ tarihe çekebilirdi. "Son görülme" uydurulabilir bir
-- alan olsaydı yönetim ekranındaki rakam hiçbir şey ifade etmezdi.
--
-- SÜTUN BAZLI REVOKE TEK BAŞINA İŞE YARAMIYOR — YEREL POSTGRES'TE ÖLÇÜLDÜ.
-- "revoke update (sutun) ... from authenticated" yazmak, rol TABLO SEVİYESİNDE
-- update yetkisine sahipse HİÇBİR ŞEY YAPMAZ (Postgres: tablo yetkisi sütun
-- yetkisini kapsar, sütun bazlı revoke onu delmez). Supabase'de authenticated
-- rolü public şemadaki tablolarda tablo-geneli yetkilere sahiptir.
-- Ölçüm (PostgreSQL 16, migration uygulandıktan SONRA):
--     has_column_privilege('authenticated','profiles','son_gorulme','UPDATE') → TRUE
-- Yani yalnız revoke yazsaydım "kapattım" derken hiçbir şey kapatmamış olurdum.
-- 0077'deki deneme_soru_kullanildi revoke'u da AYNI SEBEPLE etkisiz; oradaki
-- gerçek koruma da tetikleyicidir.
--
-- DOĞRU YOL: tablo-geneli update'i kaldır, kullanıcının MEŞRU olarak
-- değiştirdiği sütunları tek tek geri ver. Uygulama profiles üzerinde yalnız
-- şu beş sütunu yazıyor (src/store/authStore.ts: updateProfile / uploadAvatar /
-- removeAvatar). Geri kalan her sütun artık istemciye kapalı.
-- SECURITY DEFINER fonksiyonlar (handle_new_user, admin_set_premium,
-- son_gorulme_dokun) sahibi olarak çalıştığı için bu kısıttan ETKİLENMEZ.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, firm_name, bar_number, phone, avatar_url)
  on public.profiles to authenticated;

-- Tetikleyici ikinci güvenlik ağı: ileride biri tablo-geneli bir grant yazarsa
-- (ör. "grant update on profiles to authenticated") sütun yetkisi geri gelir,
-- tetikleyici yine de eski değeri korur. Kullanıcı kendi damgasını değiştiremez;
-- yalnız SECURITY DEFINER olan son_gorulme_dokun() yazabilir (o auth.uid()
-- üzerinden çalışır ve tetikleyicinin admin kontrolünden GEÇMEZ, çünkü
-- definer olarak çalışırken auth.uid() yine kullanıcıdır — bu yüzden aşağıda
-- damganın YALNIZ ileri gitmesine izin veriliyor: geri alınamaz).
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

  -- SON GÖRÜLME yalnız İLERİ gidebilir. Geriye çekmek ("uzun süredir
  -- girmemiş gibi görünmek") ya da geleceğe atmak engellenir. Bu kural
  -- definer fonksiyonu için de geçerlidir; o zaten now() yazıyor.
  if new.son_gorulme is distinct from old.son_gorulme then
    if new.son_gorulme is null
       or (old.son_gorulme is not null and new.son_gorulme < old.son_gorulme)
       or new.son_gorulme > now() + interval '1 minute' then
      new.son_gorulme := old.son_gorulme;
    end if;
  end if;

  return new;
end;
$$;

-- 2) YÖNETİCİ İŞLEM KAYDI
-- ---------------------------------------------------------------------------
-- BULUNAN EKSİK. admin_set_premium bir kullanıcıya premium verip alabiliyor ve
-- bundan HİÇBİR İZ KALMIYORDU. Yönetici hesabı ele geçirilse (ya da ikinci bir
-- yönetici eklense) kimin neyi ne zaman değiştirdiği sonradan hiçbir şekilde
-- tespit edilemezdi. Yetki vermek kadar, verilen yetkinin İZİNİ TUTMAK da
-- güvenliğin parçasıdır.
create table if not exists public.admin_islem_log (
  id bigint generated always as identity primary key,
  yapan uuid references auth.users(id) on delete set null,
  eylem text not null,
  hedef uuid,
  detay jsonb,
  olusturuldu timestamptz not null default now()
);

create index if not exists admin_islem_log_zaman_idx on public.admin_islem_log (olusturuldu desc);
create index if not exists admin_islem_log_hedef_idx on public.admin_islem_log (hedef);

alter table public.admin_islem_log enable row level security;

-- Kimse doğrudan yazamaz/silemez; yalnız SECURITY DEFINER fonksiyonlar yazar.
-- Okuma da yalnız yöneticiye, o da RPC üzerinden (aşağıda). Tabloya doğrudan
-- select politikası VERİLMİYOR: log'un kendisi de saldırganın ilgi alanıdır.
revoke all on public.admin_islem_log from authenticated, anon;

create or replace function public.admin_log_yaz(p_eylem text, p_hedef uuid, p_detay jsonb)
returns void
language plpgsql
security definer set search_path = public as $$
begin
  insert into public.admin_islem_log (yapan, eylem, hedef, detay)
  values (auth.uid(), p_eylem, p_hedef, p_detay);
end;
$$;
revoke all on function public.admin_log_yaz(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_log_yaz(text, uuid, jsonb) to service_role;

-- admin_set_premium artık iz bırakıyor. Eski değer de yazılıyor ki
-- "zaten premium'du" ile "premium yapıldı" ayırt edilebilsin.
create or replace function public.admin_set_premium(p_user_id uuid, p_value boolean)
returns boolean
language plpgsql
security definer set search_path = public as $$
declare
  onceki boolean;
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;

  select pr.is_premium into onceki from public.profiles pr where pr.id = p_user_id;
  update public.profiles set is_premium = p_value, updated_at = now() where id = p_user_id;

  insert into public.admin_islem_log (yapan, eylem, hedef, detay)
  values (auth.uid(), 'premium', p_user_id, jsonb_build_object('onceki', onceki, 'yeni', p_value));

  return true;
end;
$$;
revoke all on function public.admin_set_premium(uuid, boolean) from public, anon;
grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

-- Yönetici log'u okuma — yalnız is_admin.
create or replace function public.admin_islem_gecmisi(p_limit integer default 100)
returns table(
  id bigint, yapan uuid, yapan_ad text, eylem text, hedef uuid, hedef_ad text,
  detay jsonb, olusturuldu timestamptz
)
language plpgsql
security definer set search_path = public as $$
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return query
    select l.id, l.yapan, yp.full_name, l.eylem, l.hedef, hd.full_name, l.detay, l.olusturuldu
    from public.admin_islem_log l
    left join public.profiles yp on yp.id = l.yapan
    left join public.profiles hd on hd.id = l.hedef
    order by l.olusturuldu desc
    limit greatest(1, least(p_limit, 500));
end;
$$;
revoke all on function public.admin_islem_gecmisi(integer) from public, anon;
grant execute on function public.admin_islem_gecmisi(integer) to authenticated;
