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

-- ---------- 0009: Günün Davası ----------
create table if not exists question_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  question_key text not null,
  body text not null check (char_length(body) between 10 and 4000),
  points int not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, question_key)
);
create index if not exists question_answers_key_idx on question_answers (question_key, created_at desc);
create index if not exists question_answers_user_idx on question_answers (user_id, created_at desc);
alter table question_answers enable row level security;
drop policy if exists "qa readable by authenticated" on question_answers;
create policy "qa readable by authenticated" on question_answers for select using (auth.role() = 'authenticated');
drop policy if exists "qa insert own" on question_answers;
create policy "qa insert own" on question_answers for insert with check (user_id = auth.uid());
drop policy if exists "qa update own" on question_answers;
create policy "qa update own" on question_answers for update using (user_id = auth.uid());
drop policy if exists "qa delete own" on question_answers;
create policy "qa delete own" on question_answers for delete using (user_id = auth.uid());


-- ---------- 0010: müvekkil alacak takibi (ödeme sözleri) ----------
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


-- ---------- 0011: satın alma defteri (premium kayıtları) ----------
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  product text not null default 'premium',
  platform text not null default 'demo' check (platform in ('demo', 'stripe', 'ios', 'android')),
  amount numeric,
  currency text not null default 'TRY',
  created_at timestamptz not null default now()
);
create index if not exists purchases_user_idx on purchases (user_id, created_at desc);
alter table purchases enable row level security;
drop policy if exists "purchases own select" on purchases;
create policy "purchases own select" on purchases for select using (auth.uid() = user_id);
drop policy if exists "purchases own insert" on purchases;
create policy "purchases own insert" on purchases for insert with check (auth.uid() = user_id);


-- ---------- 0012: premium rozeti (profil çerçevesi) ----------
alter table profiles add column if not exists is_premium boolean not null default false;
-- Satın alma yapan herkesi premium işaretle (defterle uyum)
update profiles p set is_premium = true
  where exists (select 1 from purchases pu where pu.user_id = p.id) and p.is_premium = false;

-- ---------- 0013: Vekil Kodu (kodla arkadaş ekleme) ----------
-- Her avukata paylaşılabilir kısa bir kod: VP-XXXXXX
create or replace function gen_friend_code() returns text
language sql volatile as $$
  select 'VP-' || (
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random()*31)+1)::int, 1), '')
    from generate_series(1, 6)
  )
$$;

alter table profiles add column if not exists friend_code text unique default gen_friend_code();
update profiles set friend_code = gen_friend_code() where friend_code is null;

-- ---------- 0014: Avukat üyeliği (TC + Baro + Sicil) ----------
alter table profiles add column if not exists tc_no text;
alter table profiles add column if not exists baro text;
-- bar_number (baro sicil no) ve firm_name zaten mevcut.

-- ---------- 0015: Yönetici (admin) hesapları ----------
-- Aşağıdaki e-postalarla KAYITLI hesaplar yönetici + premium yapılır.
-- 3. satırı kendi seçtiğiniz e-posta ile değiştirin. Hesap sonradan
-- açıldıysa bu bloğu tekrar çalıştırmanız yeterli.
alter table profiles add column if not exists is_admin boolean not null default false;

update profiles set is_admin = true, is_premium = true
  where lower(email) in (
    'mustafayalvac244@gmail.com',
    'altunalperr@gmail.com',
    'mustafayalvac244+admin@gmail.com'
  );

-- ---------- 0016: Alıcı geri bildirimi ----------
-- Alıcı geri bildirimi (v3.5.0): dava dizini, karar bilgileri, karşı vekil,
-- müvekkil unvanı, müvekkil bazlı belge
alter table clients add column if not exists title text;
alter table cases add column if not exists opposing_counsel text;
alter table cases add column if not exists instance_stage text;
alter table cases add column if not exists case_stage text;
alter table cases add column if not exists closed_result text;
alter table cases add column if not exists decision_number text;
alter table cases add column if not exists decision_date date;
alter table cases add column if not exists decision_served_date date;
alter table documents add column if not exists client_id uuid references clients (id) on delete set null;

-- ---------- 0017: Masraf avansı defteri ----------
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

-- ---------- 0018: Mahkeme kategorisi + müvekkil tipi ----------
-- Alıcı revizyonu (v3.6.0): mahkeme kategorisi + müvekkil tipi
alter table cases add column if not exists court_category text;   -- hukuk | ceza | idare
alter table clients add column if not exists client_type text default 'gercek'; -- gercek | tuzel

-- ---------- 0019: Vekalet ücreti tipi + taksitler ----------
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

-- ---------- 0020: Durum açıklaması ----------
alter table cases add column if not exists stage_note text;

-- ---------- 0021: Taksitli müvekkil alacakları ----------
-- Bir alacak taksitlere bölündüğünde her taksit ayrı payment_promises satırıdır;
-- aynı planın taksitleri ortak group_id + sıra (seq) + toplam adet (total_count) taşır.
alter table payment_promises add column if not exists group_id uuid;
alter table payment_promises add column if not exists seq int;
alter table payment_promises add column if not exists total_count int;
create index if not exists payment_promises_group_idx on payment_promises (group_id, seq);

-- ---------- 0022: Duruşma/görev dosyasız oluşturulabilsin ----------
-- Toplantı gibi bazı kayıtlar bir davaya bağlı olmayabilir; case_id opsiyonel.
alter table hearings alter column case_id drop not null;
alter table deadlines alter column case_id drop not null;

-- ---------- 0023: Müvekkil masraf avansı ----------
-- Müvekkilin masraflar için yatırdığı avans depozitleri. Harcanan tutar
-- (case_expenses) bu avanstan düşülür; kalan bakiye eksiye inince uyarı verilir.
create table if not exists client_advances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  deposited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists client_advances_client_idx on client_advances (client_id, deposited_at desc);
alter table client_advances enable row level security;
drop policy if exists "client_advances own" on client_advances;
create policy "client_advances own" on client_advances
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- 0024: İcra takibi modülü ----------
-- İcra dosyaları davadan ayrı tutulur: alacaklı (müvekkil) + borçlu + takip
-- çıkışı; güncel kapak hesabı uygulama tarafında faiz işletilerek hesaplanır.
create table if not exists enforcement_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,  -- alacaklı (müvekkil)
  debtor_name text not null,                                  -- borçlu adı/unvanı
  debtor_id_no text,                                          -- borçlu TC/vergi no
  debtor_address text,
  office_name text,                                           -- icra dairesi
  file_number text,                                           -- dosya no (2026/1234 E.)
  takip_type text not null default 'ilamsiz',                 -- ilamsiz|ilamli|kambiyo|kira|rehin
  principal numeric not null default 0,                       -- asıl alacak
  pre_interest numeric not null default 0,                    -- takip öncesi işlemiş faiz
  interest_rate numeric,                                      -- yıllık faiz oranı (%)
  start_date date not null default current_date,              -- takip tarihi
  expenses numeric not null default 0,                        -- harç + masraflar
  attorney_fee numeric not null default 0,                    -- vekalet ücreti
  stage text not null default 'opened',                       -- opened|served|objected|final|attachment|sale|closed
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enforcement_files_owner_idx on enforcement_files (owner_id, created_at desc);
create index if not exists enforcement_files_client_idx on enforcement_files (client_id);
drop trigger if exists set_enforcement_files_updated_at on enforcement_files;
create trigger set_enforcement_files_updated_at before update on enforcement_files
  for each row execute procedure set_updated_at();
alter table enforcement_files enable row level security;
drop policy if exists "enforcement_files own" on enforcement_files;
create policy "enforcement_files own" on enforcement_files
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- İcra tahsilatları: eklendikçe kapak hesabından düşer.
create table if not exists enforcement_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  enforcement_id uuid not null references enforcement_files (id) on delete cascade,
  amount numeric not null check (amount > 0),
  collected_at date not null default current_date,
  source text not null default 'payment',                     -- payment|attachment|sale|other
  note text,
  created_at timestamptz not null default now()
);
create index if not exists enforcement_collections_file_idx on enforcement_collections (enforcement_id, collected_at);
alter table enforcement_collections enable row level security;
drop policy if exists "enforcement_collections own" on enforcement_collections;
create policy "enforcement_collections own" on enforcement_collections
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Bitti! Uygulamayı kapatıp açın; Mesajlar, Tevkil, Finans ve Günün Davası çalışır.
