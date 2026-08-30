-- Vekil Pro :: offices (Discord-style rooms: one admin, invited members, group chat)
-- Run after 0007.

create table offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table office_members (
  office_id uuid not null references offices (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (office_id, user_id)
);

create table office_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index office_members_user_idx on office_members (user_id);
create index office_messages_office_idx on office_messages (office_id, created_at desc);

-- security definer helper avoids RLS self-recursion on office_members
create or replace function is_office_member(oid uuid) returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from office_members where office_id = oid and user_id = auth.uid()
  );
$$;

alter table offices enable row level security;
alter table office_members enable row level security;
alter table office_messages enable row level security;

create policy "offices member select" on offices
  for select using (owner_id = auth.uid() or is_office_member(id));
create policy "offices owner insert" on offices
  for insert with check (owner_id = auth.uid());
create policy "offices owner update" on offices
  for update using (owner_id = auth.uid());
create policy "offices owner delete" on offices
  for delete using (owner_id = auth.uid());

create policy "office members select" on office_members
  for select using (is_office_member(office_id));
-- only the office admin adds members (owner adds themself on creation too)
create policy "office admin insert members" on office_members
  for insert with check (
    exists (select 1 from offices o where o.id = office_id and o.owner_id = auth.uid())
  );
create policy "office member leave or admin remove" on office_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from offices o where o.id = office_id and o.owner_id = auth.uid())
  );

create policy "office messages select" on office_messages
  for select using (is_office_member(office_id));
create policy "office messages insert" on office_messages
  for insert with check (sender_id = auth.uid() and is_office_member(office_id));

-- live chat: stream new rows to connected clients
do $$ begin
  alter publication supabase_realtime add table dm_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table office_messages;
exception when duplicate_object then null; end $$;
