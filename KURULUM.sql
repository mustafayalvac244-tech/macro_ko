-- ============================================================
-- VEKİL PRO — TEK DOSYA KURULUM
-- Bu dosyayı Supabase SQL Editor'a KOMPLE yapıştırıp RUN deyin.
-- Daha önce hangi adımı çalıştırdıysanız sorun olmaz; her şey
-- "varsa atla" mantığıyla yazıldı, iki kez çalıştırmak güvenlidir.
-- Kapsam: finans (0005-0006) + mesajlaşma/ilan panosu (0007)
--         + ofisler (0008) + canlı sohbet yayını
-- ============================================================

-- ---------- 0005: dava ücreti + tahsilatlar ----------
alter table cases add column if not exists fee_amount numeric;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid not null references cases (id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists payments_owner_id_idx on payments (owner_id);
create index if not exists payments_case_id_idx on payments (case_id);
alter table payments enable row level security;
drop policy if exists "payments owner select" on payments;
create policy "payments owner select" on payments for select using (auth.uid() = owner_id);
drop policy if exists "payments owner insert" on payments;
create policy "payments owner insert" on payments for insert with check (auth.uid() = owner_id);
drop policy if exists "payments owner update" on payments;
create policy "payments owner update" on payments for update using (auth.uid() = owner_id);
drop policy if exists "payments owner delete" on payments;
create policy "payments owner delete" on payments for delete using (auth.uid() = owner_id);

-- ---------- 0006: ofis gelir/gider defteri ----------
create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  category text not null default 'other',
  title text not null,
  amount numeric not null check (amount > 0),
  entry_date date not null default current_date,
  is_recurring boolean not null default false,
  recurring_until date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists finance_entries_owner_id_idx on finance_entries (owner_id);
create index if not exists finance_entries_entry_date_idx on finance_entries (entry_date);
alter table finance_entries enable row level security;
drop policy if exists "finance owner select" on finance_entries;
create policy "finance owner select" on finance_entries for select using (auth.uid() = owner_id);
drop policy if exists "finance owner insert" on finance_entries;
create policy "finance owner insert" on finance_entries for insert with check (auth.uid() = owner_id);
drop policy if exists "finance owner update" on finance_entries;
create policy "finance owner update" on finance_entries for update using (auth.uid() = owner_id);
drop policy if exists "finance owner delete" on finance_entries;
create policy "finance owner delete" on finance_entries for delete using (auth.uid() = owner_id);

-- ---------- 0007: meslektaş ağı (mesaj + ilan panosu) ----------
drop policy if exists "profiles readable by authenticated" on profiles;
create policy "profiles readable by authenticated" on profiles
  for select using (auth.role() = 'authenticated');

create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint dm_no_self check (sender_id <> recipient_id)
);
create index if not exists dm_messages_sender_idx on dm_messages (sender_id, created_at desc);
create index if not exists dm_messages_recipient_idx on dm_messages (recipient_id, created_at desc);
alter table dm_messages enable row level security;
drop policy if exists "dm participants select" on dm_messages;
create policy "dm participants select" on dm_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists "dm sender insert" on dm_messages;
create policy "dm sender insert" on dm_messages for insert with check (auth.uid() = sender_id);
drop policy if exists "dm recipient mark read" on dm_messages;
create policy "dm recipient mark read" on dm_messages for update using (auth.uid() = recipient_id);

create table if not exists jobs (
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
create index if not exists jobs_status_idx on jobs (status, created_at desc);
create index if not exists jobs_city_idx on jobs (city);
drop trigger if exists set_jobs_updated_at on jobs;
create trigger set_jobs_updated_at before update on jobs
  for each row execute procedure set_updated_at();
alter table jobs enable row level security;
drop policy if exists "jobs readable by authenticated" on jobs;
create policy "jobs readable by authenticated" on jobs for select using (auth.role() = 'authenticated');
drop policy if exists "jobs owner insert" on jobs;
create policy "jobs owner insert" on jobs for insert with check (auth.uid() = owner_id);
drop policy if exists "jobs owner update" on jobs;
create policy "jobs owner update" on jobs for update using (auth.uid() = owner_id);
drop policy if exists "jobs owner delete" on jobs;
create policy "jobs owner delete" on jobs for delete using (auth.uid() = owner_id);

-- ---------- 0008: ofisler (yönetici + üyeler + ofis sohbeti) ----------
create table if not exists offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists office_members (
  office_id uuid not null references offices (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (office_id, user_id)
);

create table if not exists office_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists office_members_user_idx on office_members (user_id);
create index if not exists office_messages_office_idx on office_messages (office_id, created_at desc);

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

drop policy if exists "offices member select" on offices;
create policy "offices member select" on offices
  for select using (owner_id = auth.uid() or is_office_member(id));
drop policy if exists "offices owner insert" on offices;
create policy "offices owner insert" on offices for insert with check (owner_id = auth.uid());
drop policy if exists "offices owner update" on offices;
create policy "offices owner update" on offices for update using (owner_id = auth.uid());
drop policy if exists "offices owner delete" on offices;
create policy "offices owner delete" on offices for delete using (owner_id = auth.uid());

drop policy if exists "office members select" on office_members;
create policy "office members select" on office_members
  for select using (is_office_member(office_id));
drop policy if exists "office admin insert members" on office_members;
create policy "office admin insert members" on office_members
  for insert with check (
    exists (select 1 from offices o where o.id = office_id and o.owner_id = auth.uid())
  );
drop policy if exists "office member leave or admin remove" on office_members;
create policy "office member leave or admin remove" on office_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from offices o where o.id = office_id and o.owner_id = auth.uid())
  );

drop policy if exists "office messages select" on office_messages;
create policy "office messages select" on office_messages
  for select using (is_office_member(office_id));
drop policy if exists "office messages insert" on office_messages;
create policy "office messages insert" on office_messages
  for insert with check (sender_id = auth.uid() and is_office_member(office_id));

-- ---------- canlı sohbet yayını (WhatsApp gibi anlık) ----------
do $$ begin
  alter publication supabase_realtime add table dm_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table office_messages;
exception when duplicate_object then null; end $$;

-- Bitti! Uygulamayı kapatıp açın; Mesajlar, Tevkil Panosu ve Finans çalışır.
