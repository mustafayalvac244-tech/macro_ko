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
create table public.cases (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), case_type text, created_at timestamptz default now());
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

-- 0102 için: veritabanı içi yedek katmanı (0029 + 0031 + 0082'nin bıraktığı hâl).
create schema if not exists backup;
create table backup.snapshots (
  id bigint generated always as identity primary key,
  snap_at timestamptz not null default now(),
  tbl text not null,
  row_data jsonb not null
);
create table backup.monthly (
  id bigint generated always as identity primary key,
  snap_month date not null,
  snap_at timestamptz not null,
  tbl text not null,
  row_data jsonb not null
);
create table backup.dosya_envanteri (
  id bigint generated always as identity primary key,
  snap_at timestamptz not null default now(),
  yol text, sahip uuid, boyut bigint, etag text, guncellendi timestamptz
);

-- 0092'nin bıraktığı hâl: yedeğe DOKUNMAYAN silme.
create function public.delete_account() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- 0101 için: hasat tarafının canlıda var olan ama bu depoda yaratılmayan
-- tabloları + 0084'ün disk freni.
create table public.ictihat_harvest_state (
  terim text primary key, next_page int default 1, done boolean default false,
  total int, last_run timestamptz, updated_at timestamptz
);
create table public.ictihat_kararlar (
  id text primary key, kurul text, daire text, esas_no text, karar_no text,
  karar_tarihi text, durum text, arama_terimi text, full_text text
);
create function public.disk_musait_mi(p_esik_mb integer default 460)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select pg_database_size(current_database()) < (p_esik_mb::bigint * 1024 * 1024)
$$;

-- pg_cron TAKLİDİ. Gerçek eklenti bu kapta yok; 0093/0094 gibi zamanlama
-- yazan migration'lar onsuz yerelde HİÇ sınanamıyordu. Taklit yalnız
-- sözdizimini ve iş adlarını doğrular — zamanlamanın gerçekten tetiklendiğini
-- DEĞİL. (Yani "cron kuruldu" demek için yeterli, "cron çalıştı" demek için
-- değil.)
create schema if not exists cron;
create table cron.job (
  jobid bigint generated always as identity primary key,
  jobname text unique,
  schedule text not null,
  command text not null,
  active boolean not null default true
);
create function cron.schedule(p_name text, p_schedule text, p_command text)
returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
create function cron.unschedule(p_name text) returns boolean language sql as $$
  delete from cron.job where jobname = p_name returning true
$$;

-- Supabase'in varsayılanı: authenticated tablolar üzerinde yetkili.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
