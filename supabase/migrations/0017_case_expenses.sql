-- Masraf avansı defteri (alıcı geri bildirimi): müvekkilden alınan avans,
-- dava masrafları düşüldükçe kalan; eksiye düşünce uygulama uyarır.
alter table cases add column if not exists advance_amount numeric;

create table if not exists case_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid not null references cases (id) on delete cascade,
  title text not null,
  amount numeric not null check (amount > 0),
  spent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists case_expenses_case_idx on case_expenses (case_id, spent_at desc);
alter table case_expenses enable row level security;
drop policy if exists "case_expenses own" on case_expenses;
create policy "case_expenses own" on case_expenses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
