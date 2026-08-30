-- Vekil :: in-app feedback (suggestions & complaints)
-- Run this in the Supabase SQL Editor after 0003.

create table feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  type text not null check (type in ('suggestion', 'complaint')),
  message text not null,
  created_at timestamptz not null default now()
);

create index feedback_owner_id_idx on feedback (owner_id);

alter table feedback enable row level security;

create policy "feedback owner insert" on feedback
  for insert with check (auth.uid() = owner_id);
create policy "feedback owner select" on feedback
  for select using (auth.uid() = owner_id);
