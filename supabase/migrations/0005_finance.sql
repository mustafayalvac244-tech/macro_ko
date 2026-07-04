-- Vekil :: fee tracking (finance module)
-- Run this in the Supabase SQL Editor after 0004.

alter table cases add column fee_amount numeric;

create table payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid not null references cases (id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payments_owner_id_idx on payments (owner_id);
create index payments_case_id_idx on payments (case_id);

alter table payments enable row level security;

create policy "payments owner select" on payments
  for select using (auth.uid() = owner_id);
create policy "payments owner insert" on payments
  for insert with check (auth.uid() = owner_id);
create policy "payments owner update" on payments
  for update using (auth.uid() = owner_id);
create policy "payments owner delete" on payments
  for delete using (auth.uid() = owner_id);
