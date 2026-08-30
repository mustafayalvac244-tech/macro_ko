-- Vekil :: office income/expense ledger (monthly finance module)
-- Run this in the Supabase SQL Editor after 0005.

create table finance_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  category text not null default 'other',
  title text not null,
  amount numeric not null check (amount > 0),
  entry_date date not null default current_date,
  -- Recurring entries (rent, salaries, retainers) count once in every month
  -- from entry_date's month until recurring_until's month (null = open ended).
  is_recurring boolean not null default false,
  recurring_until date,
  note text,
  created_at timestamptz not null default now()
);

create index finance_entries_owner_id_idx on finance_entries (owner_id);
create index finance_entries_entry_date_idx on finance_entries (entry_date);

alter table finance_entries enable row level security;

create policy "finance owner select" on finance_entries
  for select using (auth.uid() = owner_id);
create policy "finance owner insert" on finance_entries
  for insert with check (auth.uid() = owner_id);
create policy "finance owner update" on finance_entries
  for update using (auth.uid() = owner_id);
create policy "finance owner delete" on finance_entries
  for delete using (auth.uid() = owner_id);
