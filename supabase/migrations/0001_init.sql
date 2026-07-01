-- Macro Ko :: Legal Case & Document Management
-- Initial schema: profiles, clients, cases, hearings, deadlines, documents
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type case_status as enum ('active', 'pending', 'on_hold', 'closed', 'won', 'lost');
create type priority_level as enum ('low', 'medium', 'high', 'critical');
create type hearing_type as enum ('hearing', 'trial', 'mediation', 'deposition', 'filing', 'meeting', 'other');
create type document_category as enum (
  'pleading', 'contract', 'evidence', 'correspondence', 'court_order', 'invoice', 'identification', 'other'
);

-- ---------------------------------------------------------------------------
-- profiles :: one row per authenticated lawyer, mirrors auth.users
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  firm_name text,
  bar_number text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-provision a profile row whenever a new auth user signs up.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  full_name text not null,
  company text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_owner_id_idx on clients (owner_id);

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
create table cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,
  title text not null,
  case_number text,
  court_name text,
  case_type text,
  status case_status not null default 'active',
  priority priority_level not null default 'medium',
  opposing_party text,
  description text,
  opened_date date not null default current_date,
  closed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cases_owner_id_idx on cases (owner_id);
create index cases_client_id_idx on cases (client_id);
create index cases_status_idx on cases (status);

-- ---------------------------------------------------------------------------
-- hearings :: court hearing dates linked to a case
-- ---------------------------------------------------------------------------
create table hearings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid not null references cases (id) on delete cascade,
  title text not null,
  type hearing_type not null default 'hearing',
  location text,
  scheduled_at timestamptz not null,
  reminder_minutes_before integer not null default 1440,
  notes text,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hearings_owner_id_idx on hearings (owner_id);
create index hearings_case_id_idx on hearings (case_id);
create index hearings_scheduled_at_idx on hearings (scheduled_at);

-- ---------------------------------------------------------------------------
-- deadlines :: critical legal deadlines / tasks linked to a case
-- ---------------------------------------------------------------------------
create table deadlines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid not null references cases (id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz not null,
  priority priority_level not null default 'medium',
  reminder_minutes_before integer not null default 1440,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deadlines_owner_id_idx on deadlines (owner_id);
create index deadlines_case_id_idx on deadlines (case_id);
create index deadlines_due_at_idx on deadlines (due_at);

-- ---------------------------------------------------------------------------
-- documents :: metadata for files stored in the `case-documents` storage bucket
-- ---------------------------------------------------------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  case_id uuid references cases (id) on delete cascade,
  name text not null,
  category document_category not null default 'other',
  file_path text not null,
  file_size bigint not null default 0,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

create index documents_owner_id_idx on documents (owner_id);
create index documents_case_id_idx on documents (case_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance trigger
-- ---------------------------------------------------------------------------
create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on profiles
  for each row execute procedure set_updated_at();
create trigger set_clients_updated_at before update on clients
  for each row execute procedure set_updated_at();
create trigger set_cases_updated_at before update on cases
  for each row execute procedure set_updated_at();
create trigger set_hearings_updated_at before update on hearings
  for each row execute procedure set_updated_at();
create trigger set_deadlines_updated_at before update on deadlines
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security :: every lawyer only ever sees their own data
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table clients enable row level security;
alter table cases enable row level security;
alter table hearings enable row level security;
alter table deadlines enable row level security;
alter table documents enable row level security;

create policy "profiles are self-readable" on profiles
  for select using (auth.uid() = id);
create policy "profiles are self-updatable" on profiles
  for update using (auth.uid() = id);

create policy "clients are owner-scoped select" on clients
  for select using (auth.uid() = owner_id);
create policy "clients are owner-scoped insert" on clients
  for insert with check (auth.uid() = owner_id);
create policy "clients are owner-scoped update" on clients
  for update using (auth.uid() = owner_id);
create policy "clients are owner-scoped delete" on clients
  for delete using (auth.uid() = owner_id);

create policy "cases are owner-scoped select" on cases
  for select using (auth.uid() = owner_id);
create policy "cases are owner-scoped insert" on cases
  for insert with check (auth.uid() = owner_id);
create policy "cases are owner-scoped update" on cases
  for update using (auth.uid() = owner_id);
create policy "cases are owner-scoped delete" on cases
  for delete using (auth.uid() = owner_id);

create policy "hearings are owner-scoped select" on hearings
  for select using (auth.uid() = owner_id);
create policy "hearings are owner-scoped insert" on hearings
  for insert with check (auth.uid() = owner_id);
create policy "hearings are owner-scoped update" on hearings
  for update using (auth.uid() = owner_id);
create policy "hearings are owner-scoped delete" on hearings
  for delete using (auth.uid() = owner_id);

create policy "deadlines are owner-scoped select" on deadlines
  for select using (auth.uid() = owner_id);
create policy "deadlines are owner-scoped insert" on deadlines
  for insert with check (auth.uid() = owner_id);
create policy "deadlines are owner-scoped update" on deadlines
  for update using (auth.uid() = owner_id);
create policy "deadlines are owner-scoped delete" on deadlines
  for delete using (auth.uid() = owner_id);

create policy "documents are owner-scoped select" on documents
  for select using (auth.uid() = owner_id);
create policy "documents are owner-scoped insert" on documents
  for insert with check (auth.uid() = owner_id);
create policy "documents are owner-scoped update" on documents
  for update using (auth.uid() = owner_id);
create policy "documents are owner-scoped delete" on documents
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Storage :: private bucket for case documents, one folder per owner
-- Path convention: <owner_id>/<case_id>/<filename>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

create policy "case-documents are owner-scoped select" on storage.objects
  for select using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "case-documents are owner-scoped insert" on storage.objects
  for insert with check (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "case-documents are owner-scoped update" on storage.objects
  for update using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "case-documents are owner-scoped delete" on storage.objects
  for delete using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
