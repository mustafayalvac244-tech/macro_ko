-- 0023 — Yönetici paneli RPC'leri + güvenlik sertleştirmesi
--
-- Bu dosya, canlı veritabanına Management API ile uygulanan değişiklikleri
-- sürüm kontrolünde de saklar (kaybolmasın). İçerik:
--   1) Yalnız admin çağırabilen panel RPC'leri (SECURITY DEFINER, is_admin denetimli)
--   2) is_admin ayrıcalık yükseltmesini engelleyen trigger (kritik güvenlik)

-- ── 1) Panel RPC'leri ───────────────────────────────────────────────────────
create or replace function public.admin_overview()
returns json language plpgsql security definer set search_path = public as $$
declare result json;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  select json_build_object(
    'total_users',   (select count(*) from public.profiles),
    'premium_users', (select count(*) from public.profiles where is_premium),
    'new_today',     (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'new_week',      (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_month',     (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'active_week',   (select count(*) from auth.users where last_sign_in_at >= now() - interval '7 days'),
    'total_cases',   (select count(*) from public.cases),
    'total_clients', (select count(*) from public.clients),
    'total_hearings',(select count(*) from public.hearings)
  ) into result;
  return result;
end; $$;

create or replace function public.admin_recent_users(p_limit int default 60)
returns table(id uuid, email text, full_name text, firm_name text, is_premium boolean, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.firm_name, coalesce(p.is_premium, false), u.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 200));
end; $$;

create or replace function public.admin_set_premium(p_user_id uuid, p_value boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  update public.profiles set is_premium = p_value, updated_at = now() where id = p_user_id;
  return true;
end; $$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_recent_users(int) from public, anon;
revoke all on function public.admin_set_premium(uuid, boolean) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_recent_users(int) to authenticated;
grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

-- ── 2) Ayrıcalık yükseltme koruması ─────────────────────────────────────────
-- profiles UPDATE politikası kolon kısıtlamadığından, bir kullanıcı kendi
-- satırında is_admin=true yapıp tüm verilere erişebilirdi. Trigger, is_admin
-- değişimini yalnız mevcut bir admin'e (ya da sunucu bağlamına) izin verir.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if auth.uid() is not null
       and coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) is not true then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();
