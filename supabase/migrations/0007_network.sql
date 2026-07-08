-- Vekil :: lawyer network (direct messages + referral/job board)
-- Run this in the Supabase SQL Editor after 0006.

-- Lawyers must be able to find each other (name/firm/bar) for chat & referrals.
create policy "profiles readable by authenticated" on profiles
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------- messages
create table dm_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint dm_no_self check (sender_id <> recipient_id)
);

create index dm_messages_sender_idx on dm_messages (sender_id, created_at desc);
create index dm_messages_recipient_idx on dm_messages (recipient_id, created_at desc);

alter table dm_messages enable row level security;

create policy "dm participants select" on dm_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "dm sender insert" on dm_messages
  for insert with check (auth.uid() = sender_id);
create policy "dm recipient mark read" on dm_messages
  for update using (auth.uid() = recipient_id);

-- ---------------------------------------------------------------- job board
create table jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text,
  job_type text not null check (job_type in ('tevkil', 'devir', 'danisma')),
  city text not null,
  courthouse text,
  hearing_date timestamptz,
  fee_offer numeric,
  status text not null default 'open' check (status in ('open', 'assigned', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_status_idx on jobs (status, created_at desc);
create index jobs_city_idx on jobs (city);

create trigger set_jobs_updated_at before update on jobs
  for each row execute procedure set_updated_at();

alter table jobs enable row level security;

create policy "jobs readable by authenticated" on jobs
  for select using (auth.role() = 'authenticated');
create policy "jobs owner insert" on jobs
  for insert with check (auth.uid() = owner_id);
create policy "jobs owner update" on jobs
  for update using (auth.uid() = owner_id);
create policy "jobs owner delete" on jobs
  for delete using (auth.uid() = owner_id);
