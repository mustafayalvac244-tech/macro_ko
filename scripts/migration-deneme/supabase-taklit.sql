-- Supabase taklidi: roller, auth şeması, 0095-0099'un dokunduğu tablolar.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, firm_name text, email text, bar_number text, phone text, avatar_url text, baro text, tc_no text, friend_code text, created_at timestamptz default now(),
  is_premium boolean default false, is_admin boolean default false,
  ai_tier text, deneme_soru_kullanildi int default 0,
  updated_at timestamptz default now()
);
create table public.cases (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), created_at timestamptz default now());
create table public.clients (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), created_at timestamptz default now());
create table public.hearings (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), created_at timestamptz default now());
create table public.finance_entries (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), kind text, amount numeric, created_at timestamptz default now());
create table public.payments (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), amount numeric);
create table public.purchases (id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id), amount numeric);
create table public.ai_odeme (event_id text primary key, user_id uuid references auth.users(id), tutar_try numeric);
create table public.ai_usage (user_id uuid references auth.users(id), period text, cost_try numeric, primary key(user_id, period));

-- 0023 + 0089'un bıraktığı hâl: fonksiyon var, PUBLIC yetkisi KALDIRILMIŞ.
create function public.admin_recent_users(p_limit int default 60)
returns table(id uuid, email text, full_name text, firm_name text, is_premium boolean,
  ai_tier text, ai_cost_try numeric, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin return; end $$;
revoke all on function public.admin_recent_users(int) from public, anon;
grant execute on function public.admin_recent_users(int) to authenticated;

create function public.admin_set_premium(p_user_id uuid, p_value boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin return true; end $$;
revoke all on function public.admin_set_premium(uuid, boolean) from public, anon;
grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

create function public.protect_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$ begin return new; end $$;
create trigger protect_profile_privileges_trg before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- Supabase'in varsayılanı: authenticated tablolar üzerinde yetkili.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
