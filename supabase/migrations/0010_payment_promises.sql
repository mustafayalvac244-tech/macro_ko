-- Vekil Pro :: client receivables (payment promises with due dates)
-- Run after 0009.

create table if not exists payment_promises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  case_id uuid references cases (id) on delete set null,
  amount numeric not null check (amount > 0),
  due_date date not null,
  note text,
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists payment_promises_owner_idx on payment_promises (owner_id);
create index if not exists payment_promises_client_idx on payment_promises (client_id, due_date);

alter table payment_promises enable row level security;

drop policy if exists "promises owner select" on payment_promises;
create policy "promises owner select" on payment_promises for select using (auth.uid() = owner_id);
drop policy if exists "promises owner insert" on payment_promises;
create policy "promises owner insert" on payment_promises for insert with check (auth.uid() = owner_id);
drop policy if exists "promises owner update" on payment_promises;
create policy "promises owner update" on payment_promises for update using (auth.uid() = owner_id);
drop policy if exists "promises owner delete" on payment_promises;
create policy "promises owner delete" on payment_promises for delete using (auth.uid() = owner_id);
