-- Vekil Pro :: purchase/entitlement ledger.
-- Server-side record of every purchase so premium status survives reinstall
-- and can be audited from the Supabase dashboard. When RevenueCat/IAP lands,
-- its webhook writes into this same table (platform: 'ios' | 'android').

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  product text not null default 'premium',
  platform text not null default 'demo' check (platform in ('demo', 'stripe', 'ios', 'android')),
  amount numeric,
  currency text not null default 'TRY',
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_idx on purchases (user_id, created_at desc);

alter table purchases enable row level security;

drop policy if exists "purchases own select" on purchases;
create policy "purchases own select" on purchases for select using (auth.uid() = user_id);
drop policy if exists "purchases own insert" on purchases;
create policy "purchases own insert" on purchases for insert with check (auth.uid() = user_id);
