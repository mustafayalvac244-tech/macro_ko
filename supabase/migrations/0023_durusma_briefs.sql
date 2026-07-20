create table if not exists durusma_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid not null references cases (id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists durusma_briefs_case_uidx on durusma_briefs (case_id);
alter table durusma_briefs enable row level security;
drop policy if exists "briefs own" on durusma_briefs;
create policy "briefs own" on durusma_briefs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
