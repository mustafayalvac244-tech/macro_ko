-- AI katmanı ve kullanım ölçümü (maliyet tavanı ile "batma" koruması).

-- 1) Katman: null → is_premium'dan türetilir (geriye uyum). Değerler:
--    'free' | 'baslangic' | 'pro' | 'elit'
alter table public.profiles add column if not exists ai_tier text;

-- 2) Aylık kullanım biriktirici (kullanıcı × dönem)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,                 -- 'YYYY-MM'
  calls int not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  cost_try numeric(12,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_self_read on public.ai_usage;
create policy ai_usage_self_read on public.ai_usage for select using (auth.uid() = user_id);
-- Yazma yalnız service_role (edge fonksiyon RLS'i bypass eder); authenticated'a write policy YOK.

-- 3) Kullanıcının kendi bu-ay kullanımı (istemci için)
create or replace function public.my_ai_usage()
returns table(period text, calls int, cost_try numeric, tier text)
language sql stable security definer set search_path = public as $$
  select to_char(now(),'YYYY-MM'),
         coalesce(u.calls,0),
         coalesce(u.cost_try,0),
         coalesce((select ai_tier from public.profiles where id = auth.uid()), case when (select is_premium from public.profiles where id=auth.uid()) then 'pro' else 'free' end)
  from (select 1) x
  left join public.ai_usage u on u.user_id = auth.uid() and u.period = to_char(now(),'YYYY-MM');
$$;
revoke all on function public.my_ai_usage() from public, anon;
grant execute on function public.my_ai_usage() to authenticated;

-- 4) Admin: kullanıcı listesine katman + bu-ay AI maliyeti eklendi
drop function if exists public.admin_recent_users(int);
create or replace function public.admin_recent_users(p_limit int default 60)
returns table(id uuid, email text, full_name text, firm_name text, is_premium boolean, ai_tier text, ai_cost_try numeric, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.firm_name, coalesce(p.is_premium,false),
           coalesce(p.ai_tier, case when p.is_premium then 'pro' else 'free' end),
           coalesce((select us.cost_try from public.ai_usage us where us.user_id=p.id and us.period=to_char(now(),'YYYY-MM')), 0),
           u.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 200));
end; $$;

-- 5) Admin genel bakışa toplam bu-ay AI maliyeti
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
    'total_hearings',(select count(*) from public.hearings),
    'ai_cost_month', (select coalesce(sum(cost_try),0) from public.ai_usage where period = to_char(now(),'YYYY-MM'))
  ) into result;
  return result;
end; $$;
