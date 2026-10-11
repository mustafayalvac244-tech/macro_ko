-- Supabase taklidi: roller, auth şeması, 0095-0099'un dokunduğu tablolar.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb -- 0181: kayıt üstverisi (signUp options.data)
);
-- 0187 ölçümü için auth.uid()/auth.jwt() oturum ayarlarından okunur (gerçek
-- Supabase da JWT'yi böyle ayar olarak taşır). Ayar yoksa eskisi gibi null.
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
-- Sütunlar canlıdan alındı (information_schema, 10.10.2026); yalnız 0187'nin okuduğu kadarı.
create table auth.sessions (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, not_after timestamptz);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, firm_name text, email text, bar_number text, phone text, avatar_url text, baro text, tc_no text, friend_code text, created_at timestamptz default now(),
  is_premium boolean default false, is_admin boolean default false,
  ai_tier text, deneme_soru_kullanildi int default 0,
  updated_at timestamptz default now()
);
create table public.cases (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), case_type text, created_at timestamptz default now());
create table public.clients (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), created_at timestamptz default now());
create table public.hearings (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), created_at timestamptz default now());
create table public.finance_entries (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), kind text, amount numeric, created_at timestamptz default now());
create table public.payments (id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id), amount numeric);
create table public.purchases (id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id), product text not null default 'premium', platform text not null default 'demo', amount numeric, currency text not null default 'TRY', created_at timestamptz not null default now()); -- 0011 ile aynı sütunlar (0072/0073/0205 bunun üstüne ekler)
create table public.ai_odeme (event_id text primary key, user_id uuid references auth.users(id), tutar_try numeric);
-- ai_usage sütunları canlıdan (information_schema, 09.10.2026) — 0191'in SQL gövdesi hepsine dokunuyor.
create table public.ai_usage (user_id uuid references auth.users(id), period text, calls int not null default 0, tokens_in bigint not null default 0, tokens_out bigint not null default 0, cost_try numeric(12,4) not null default 0, updated_at timestamptz not null default now(), primary key(user_id, period));

-- 0023 + 0089'un bıraktığı hâl: fonksiyon var, PUBLIC yetkisi KALDIRILMIŞ.
create function public.admin_recent_users(p_limit int default 60)
returns table(id uuid, email text, full_name text, firm_name text, is_premium boolean,
  ai_tier text, ai_cost_try numeric, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin return; end $$;
revoke all on function public.admin_recent_users(int) from public, anon;
grant execute on function public.admin_recent_users(int) to authenticated;

create function public.admin_set_premium(p_user_id uuid, p_value boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin return true; end $$;
revoke all on function public.admin_set_premium(uuid, boolean) from public, anon;
grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

create function public.protect_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$ begin return new; end $$;
create trigger protect_profile_privileges_trg before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- 0102 için: veritabanı içi yedek katmanı (0029 + 0031 + 0082'nin bıraktığı hâl).
create schema if not exists backup;
create table backup.snapshots (
  id bigint generated always as identity primary key,
  snap_at timestamptz not null default now(),
  tbl text not null,
  row_data jsonb not null
);
create table backup.monthly (
  id bigint generated always as identity primary key,
  snap_month date not null,
  snap_at timestamptz not null,
  tbl text not null,
  row_data jsonb not null
);
create table backup.dosya_envanteri (
  id bigint generated always as identity primary key,
  snap_at timestamptz not null default now(),
  yol text, sahip uuid, boyut bigint, etag text, guncellendi timestamptz
);

-- 0092'nin bıraktığı hâl: yedeğe DOKUNMAYAN silme.
create function public.delete_account() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- 0101 için: hasat tarafının canlıda var olan ama bu depoda yaratılmayan
-- tabloları + 0084'ün disk freni.
create table public.ictihat_harvest_state (
  terim text primary key, next_page int default 1, done boolean default false,
  total int, last_run timestamptz, updated_at timestamptz,
  -- `oncelik` 0093 (hasat önceliği) ile canlıya eklendi ama taklide
  -- yansıtılmamıştı; 0121 onu okuduğu için deneme koşusunda düşüyordu.
  -- Aynı gerekçe ictihat_kararlar.created_at'te de yazılı: bu tabloların
  -- şeması yalnız canlıda tam, taklit geride kalınca migration'lar YERELDE
  -- hiç sınanamıyor ve hatalar ancak canlıda görülüyor.
  oncelik int default 100
);
create table public.ictihat_kararlar (
  id text primary key, kurul text, daire text, esas_no text, karar_no text,
  karar_tarihi text, durum text, arama_terimi text, full_text text,
  -- `created_at` CANLIDA VAR, TAKLİTTE YOKTU — 14.09.2026'da eklendi.
  -- Bu tabloyu depodaki hiçbir migration yaratmıyor (yalnız canlıda ve burada
  -- var), o yüzden sütunları ancak canlıya bakarak bilinebiliyor. Eksikliği
  -- BUGÜN ÜÇ AYRI DOSYADA tuzak oldu: 0121 (zaten yazılıydı, denemede
  -- düşüyordu), 0135 ve 0139 (ikisini de yazarken created_at'i varsaydım ve
  -- deneme koşusu yakaladı). Doğru çözüm migration'ları eğip bükmek değil,
  -- taklidi gerçeğe uydurmak.
  -- Canlıdaki varlığı 0135 ile ölçüldü: "created_at = 2026-09-14 17:46:03".
  created_at timestamptz default now(),
  -- `fts` canlıda var ama depodaki hiçbir migration onu yaratmıyor (0034
  -- yalnız fts_simple'ı ekliyor). Taklitte yokken 0108/0111 yerelde HİÇ
  -- sınanamıyordu ("column k.fts does not exist"). Canlıdaki tanım
  -- doğrulanmadı; arama fonksiyonlarının kullandığı biçim ('turkish'
  -- yapılandırması, full_text üzerinden) burada taklit edildi.
  fts tsvector generated always as (to_tsvector('turkish', coalesce(full_text, ''))) stored,
  -- fts_simple'ı 0034 ekliyor ama o dosya önce mevzuat tablosuna dokunuyor ve
  -- taklitte o sütunlar (kanun_short) olmadığı için ictihat kısmına hiç
  -- gelemiyor. Arama fonksiyonu yerelde sınanabilsin diye burada hazır.
  fts_simple tsvector generated always as (to_tsvector('simple', coalesce(full_text, ''))) stored
);
create function public.disk_musait_mi(p_esik_mb integer default 460)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select pg_database_size(current_database()) < (p_esik_mb::bigint * 1024 * 1024)
$$;

-- pg_cron TAKLİDİ. Gerçek eklenti bu kapta yok; 0093/0094 gibi zamanlama
-- yazan migration'lar onsuz yerelde HİÇ sınanamıyordu. Taklit yalnız
-- sözdizimini ve iş adlarını doğrular — zamanlamanın gerçekten tetiklendiğini
-- DEĞİL. (Yani "cron kuruldu" demek için yeterli, "cron çalıştı" demek için
-- değil.)
create schema if not exists cron;
create table cron.job (
  jobid bigint generated always as identity primary key,
  jobname text unique,
  schedule text not null,
  command text not null,
  active boolean not null default true
);
create function cron.schedule(p_name text, p_schedule text, p_command text)
returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
create function cron.unschedule(p_name text) returns boolean language sql as $$
  delete from cron.job where jobname = p_name returning true
$$;

-- DİKKAT — BU TABLONUN SÜTUNLARI BİLEREK GERÇEĞİNE SADIK:
-- cron.job_run_details'te `jobname` YOKTUR, yalnız `jobid` vardır. İş adını
-- görmek için cron.job ile birleştirmek gerekir.
--
-- Bu tablo taklide EKSİKTİ ve 0101'deki "if to_regclass(...) is not null"
-- koruması yüzünden o blok yerelde hiç çalışmadı; sınanmamış kod canlıya gitti
-- ve orada "42703: column d.jobname does not exist" ile patladı. Koruma hatayı
-- engellemedi, SAKLADI. Sütun adlarını değiştirmeyin — taklidin değeri tam
-- olarak gerçeğe sadık olmasından geliyor.
create table cron.job_run_details (
  jobid bigint,
  runid bigint generated always as identity primary key,
  job_pid integer,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
);

-- Vault taklidi: hasat_tetikle servis anahtarını buradan okuyor (0084).
create schema if not exists vault;
create table vault.decrypted_secrets (name text primary key, decrypted_secret text);

-- pg_net taklidi: hasat_tetikle'nin ateşle-unut yanıtlarının düştüğü yer.
-- Sütun adları pg_net'in gerçek _http_response tablosundan alındı.
create schema if not exists net;
create table net._http_response (
  id bigint generated always as identity primary key,
  status_code integer,
  content_type text,
  headers jsonb,
  content text,
  timed_out boolean,
  error_msg text,
  created timestamptz not null default now()
);
-- net.http_post taklidi: isteği kaydeder, kimliğini döner (gerçekte pg_net kuyruğa alır
-- ve yanıt AYNI kimlikle net._http_response'a düşer). Gerçek ağ çağrısı YAPMAZ.
create table net._istek_taklit (id bigint generated always as identity primary key, url text, body jsonb);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language sql as $$ insert into net._istek_taklit (url, body) values (url, body) returning id $$;

-- Supabase'in varsayılanı: authenticated tablolar üzerinde yetkili.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;

-- 0104 için: anon'un canlıda fazladan tuttuğu yetkileri taklit et.
create table public.legal_rule_atif (rule_id text, kanun_short text, madde_no text, sira int);
alter table public.legal_rule_atif enable row level security;
create policy legal_rule_atif_read on public.legal_rule_atif for select to authenticated, anon using (true);
create table public.mevzuat_maddeleri (id bigint generated always as identity primary key, metin text);
create table public.legal_rules (id text primary key, baslik text, triggers text default '', body text, zorunlu_terimler text[] default '{}');
create table public.ictihat_atif (karar_id text, kanun_short text, madde_no text);
create table public.oturum_cihazlari (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), cihaz text);
-- 0056 (ai_istek) — 0168 bu tabloya sütun ekliyor (03.10.2026).
create table if not exists public.ai_istek (id uuid primary key default gen_random_uuid(), user_id uuid, gun text not null default '', mod text not null default 'sohbet', model text, tokens_in integer not null default 0, tokens_out integer not null default 0, maliyet_try numeric(12,4) not null default 0, ucret_try numeric(12,4) not null default 0, musteriye_yazildi boolean not null default true, iade_edildi boolean not null default false, iade_sebep text, olusturuldu timestamptz not null default now());
-- 0118 (atıf denetimi sayaçları) — 0167 bu tabloya sütun ekliyor; taklitte yoksa 0167 tek başına düşer (03.10.2026, CI'da ölçüldü).
create table public.atif_denetim_kaydi (id bigint generated always as identity primary key, olusturuldu timestamptz not null default now(), mod text not null, model text, toplam integer not null default 0, dogrulanan integer not null default 0, havuzda_yok integer not null default 0, olanaksiz integer not null default 0, uydurma_madde integer not null default 0);
alter table public.oturum_cihazlari enable row level security;
grant select on public.oturum_cihazlari to authenticated;
grant all on all tables in schema public to anon, authenticated, service_role;
-- 0124 + 0127 (katalog pencereleri) — 0175 bu tabloya pencere ekliyor; taklitte yoksa 0175 tek başına düşer (08.10.2026, yerelde ölçüldü).
create table if not exists public.ictihat_katalog_pencere (tur text not null, gun date not null, sonraki_sayfa integer not null default 1, bitti boolean not null default false, toplam integer, son_calisma timestamptz, bitis date not null, primary key (tur, gun));

-- 0194 (veritabani guvenligi, 10.10.2026) — canlida olup taklitte olmayan tablolar.
-- Canli politika/yetki hali 10.10'da pg_policies + has_*_privilege ile olculdu;
-- 0194'un "ONCE" durumu burada kurulur ki goc gercek bir degisikligi oynatsin.
alter table public.cases add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.hearings add column if not exists case_id uuid references public.cases(id) on delete cascade;
alter table public.payments add column if not exists case_id uuid references public.cases(id) on delete cascade;
create table if not exists public.deadlines (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), case_id uuid references public.cases(id) on delete cascade);
create table if not exists public.documents (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), case_id uuid references public.cases(id) on delete cascade, client_id uuid references public.clients(id) on delete set null);
create table if not exists public.case_expenses (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), case_id uuid not null references public.cases(id) on delete cascade);
create table if not exists public.case_installments (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), case_id uuid not null references public.cases(id) on delete cascade);
create table if not exists public.client_advances (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), client_id uuid not null references public.clients(id) on delete cascade);
create table if not exists public.client_expenses (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), client_id uuid not null references public.clients(id) on delete cascade);
create table if not exists public.enforcement_files (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), client_id uuid references public.clients(id) on delete set null);
create table if not exists public.payment_promises (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), client_id uuid not null references public.clients(id) on delete cascade, case_id uuid references public.cases(id) on delete set null);
create table if not exists public.powers_of_attorney (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), client_id uuid references public.clients(id) on delete set null);

-- 0128 + 0130: KVKK riza gunlugu (canlida authenticated'in UPDATE/DELETE tablo yetkisi de var: olculdu).
create table if not exists public.kvkk_onay (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tur text not null, surum text not null, onay boolean not null, kaynak text,
  verildi_at timestamptz not null default now(), kanit jsonb);
alter table public.kvkk_onay enable row level security;
drop policy if exists kvkk_onay_kendi_okur on public.kvkk_onay;
create policy kvkk_onay_kendi_okur on public.kvkk_onay for select using (auth.uid() = user_id);
drop policy if exists kvkk_onay_kendi_yazar on public.kvkk_onay;
create policy kvkk_onay_kendi_yazar on public.kvkk_onay for insert with check (auth.uid() = user_id);

-- 0165: kullanim sayaci.
create table if not exists public.kullanim_sayac (
  gun date not null default (now() at time zone 'Europe/Istanbul')::date,
  olay text not null, platform text not null, adet integer not null default 0,
  primary key (gun, olay, platform));
alter table public.kullanim_sayac enable row level security;
revoke all on public.kullanim_sayac from anon, authenticated;

-- 0050: AI saglayici durumu (canlida using(true) ile okunuyordu).
create table if not exists public.ai_saglayici_durum (
  saglayici text primary key, son_sonuc text, son_zaman timestamptz default now(),
  son_basari timestamptz, son_hata text, son_model text);
alter table public.ai_saglayici_durum enable row level security;
drop policy if exists ai_saglayici_durum_read on public.ai_saglayici_durum;
create policy ai_saglayici_durum_read on public.ai_saglayici_durum for select to authenticated using (true);

-- Ofis (0007 + ofis tablolari): canlidaki politikalar.
create table if not exists public.offices (id uuid primary key default gen_random_uuid(), name text, owner_id uuid not null references public.profiles(id));
create table if not exists public.office_members (office_id uuid not null references public.offices(id) on delete cascade, user_id uuid not null references public.profiles(id), role text default 'member', joined_at timestamptz default now(), primary key (office_id, user_id));
create or replace function public.is_office_member(oid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from office_members where office_id = oid and user_id = auth.uid()) $$;
alter table public.offices enable row level security;
alter table public.office_members enable row level security;
drop policy if exists "office admin insert members" on public.office_members;
create policy "office admin insert members" on public.office_members for insert
  with check (exists (select 1 from offices o where o.id = office_members.office_id and o.owner_id = auth.uid()));
drop policy if exists "office members select" on public.office_members;
create policy "office members select" on public.office_members for select using (is_office_member(office_id));
drop policy if exists "offices member select" on public.offices;
create policy "offices member select" on public.offices for select using (owner_id = auth.uid() or is_office_member(id));

grant all on public.deadlines, public.documents, public.case_expenses, public.case_installments,
  public.client_advances, public.client_expenses, public.enforcement_files, public.payment_promises,
  public.powers_of_attorney, public.kvkk_onay, public.ai_saglayici_durum, public.offices,
  public.office_members to anon, authenticated, service_role;
grant all on public.kullanim_sayac to service_role;
