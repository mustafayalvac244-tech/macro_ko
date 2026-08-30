-- Vekalet ücreti yapısı (alıcı): tip + yüzde + peşin; taksit (vade) tablosu
alter table cases add column if not exists fee_type text default 'fixed'; -- percentage | advance_percentage | fixed
alter table cases add column if not exists fee_percent numeric;
alter table cases add column if not exists fee_advance numeric;

create table if not exists case_installments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid not null references cases (id) on delete cascade,
  seq int not null default 1,
  amount numeric not null check (amount > 0),
  due_date date,
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists case_installments_case_idx on case_installments (case_id, seq);
alter table case_installments enable row level security;
drop policy if exists "case_installments own" on case_installments;
create policy "case_installments own" on case_installments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
