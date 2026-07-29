-- VEKALET (VEKALETNAME) YÖNETİMİ — rakiplerin tamamında var, bizde yoktu.
-- Kritik nokta: sulh, feragat, kabul, ahzu kabz gibi işlemler vekaletnamede
-- AÇIKÇA ÖZEL YETKİ verilmişse yapılabilir (HMK m.74). Bu tablo o yetkileri
-- ayrı ayrı tutar ki uygulama avukatı "bu vekaletnamede ahzu kabz yok" diye
-- uyarabilsin.
create table if not exists public.powers_of_attorney (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  kind text not null default 'genel',          -- genel | ozel | bosanma | tanima_tenfiz
  notary_name text,                            -- noter adı
  notary_no text,                              -- yevmiye no
  issued_date date,                            -- düzenleme tarihi
  valid_until date,                            -- süreli vekaletnamede bitiş
  -- Özel yetkiler (HMK m.74)
  auth_sulh boolean not null default false,        -- sulh / uzlaşma
  auth_feragat boolean not null default false,     -- davadan feragat
  auth_kabul boolean not null default false,       -- davayı kabul
  auth_ahzu_kabz boolean not null default false,   -- para tahsil etme
  auth_temyiz boolean not null default false,      -- kanun yoluna başvurma
  auth_tahkim boolean not null default false,      -- tahkim / hakem
  auth_isticvap boolean not null default false,    -- yemin teklifi/kabulü
  -- Durum
  status text not null default 'aktif',        -- aktif | azil | istifa | suresi_doldu
  status_date date,
  document_path text,                          -- taranmış vekaletname (storage)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poa_owner_idx on public.powers_of_attorney (owner_id);
create index if not exists poa_client_idx on public.powers_of_attorney (client_id);

alter table public.powers_of_attorney enable row level security;

drop policy if exists "poa owner select" on public.powers_of_attorney;
drop policy if exists "poa owner insert" on public.powers_of_attorney;
drop policy if exists "poa owner update" on public.powers_of_attorney;
drop policy if exists "poa owner delete" on public.powers_of_attorney;
create policy "poa owner select" on public.powers_of_attorney for select using (auth.uid() = owner_id);
create policy "poa owner insert" on public.powers_of_attorney for insert with check (auth.uid() = owner_id);
create policy "poa owner update" on public.powers_of_attorney for update using (auth.uid() = owner_id);
create policy "poa owner delete" on public.powers_of_attorney for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.powers_of_attorney to authenticated;
