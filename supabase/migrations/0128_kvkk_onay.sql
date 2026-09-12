-- KVKK AÇIK RIZA KAYDI — 6698 s.K. m.5/1 ve m.9.
-- ===========================================================================
-- NEDEN GEREKLİ. Yapay zekâ özellikleri, kullanıcının yazdığı metni ABD
-- merkezli sağlayıcılara (Anthropic, Google, Groq, OpenAI — dördünün de kod
-- yolu supabase/functions/ai-chat/index.ts içinde mevcut) gönderiyor. Bu bir
-- YURT DIŞINA AKTARIMDIR ve m.9 kapsamında açık rıza ya da başka bir hukuki
-- mekanizma ister. Bugüne kadar ne rıza alınıyordu ne de kayıt tutuluyordu.
--
-- Üstelik gizlilik metni "yasal zorunluluk dışında hiçbir veri kimseyle
-- paylaşılmaz" diyordu — bu cümle YANLIŞTI ve aynı sürümde düzeltiliyor.
--
-- TASARIM — EKLEMELİ GÜNLÜK (append-only). Rıza kaydı bir DELİLDİR: ne zaman,
-- hangi metin sürümüne, nereden verildiği sonradan gösterilebilmeli. Bu yüzden
-- satırlar GÜNCELLENMEZ ve SİLİNMEZ; rızanın geri alınması da yeni bir satırdır
-- (onay = false). "Şu an rıza var mı" sorusu, en son satıra bakılarak
-- cevaplanır — üzerine yazarak geçmişi yok etmek, delili yok etmek olurdu.
--
-- HESAP SİLİNİRSE kayıt da silinir (on delete cascade): rızanın kendisi de
-- kişisel veridir, kullanıcının silme hakkı ondan da üstündür.

create table if not exists public.kvkk_onay (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Hangi rıza. Ayrı ayrı tutuluyor çünkü m.9 rızası, hizmetin geri kalanından
  -- BAĞIMSIZ olmak zorunda: geri alınması diğer özellikleri durdurmamalı.
  tur         text not null,
  surum       text not null,
  onay        boolean not null,
  kaynak      text,
  verildi_at  timestamptz not null default now()
);

create index if not exists kvkk_onay_kullanici_idx
  on public.kvkk_onay (user_id, tur, verildi_at desc);

alter table public.kvkk_onay enable row level security;

-- Kullanıcı YALNIZ kendi kaydını görür ve yalnız kendi adına ekleyebilir.
-- UPDATE ve DELETE politikası BİLEREK YOK: günlük eklemeli.
drop policy if exists kvkk_onay_kendi_okur on public.kvkk_onay;
create policy kvkk_onay_kendi_okur on public.kvkk_onay
  for select using (auth.uid() = user_id);

drop policy if exists kvkk_onay_kendi_yazar on public.kvkk_onay;
create policy kvkk_onay_kendi_yazar on public.kvkk_onay
  for insert with check (auth.uid() = user_id);

revoke all on table public.kvkk_onay from anon;
grant select, insert on table public.kvkk_onay to authenticated;
grant select, insert on table public.kvkk_onay to service_role;

-- ── Kayıt anında rızayı yaz ────────────────────────────────────────────────
-- NEDEN TETİKLEYİCİ, NEDEN İSTEMCİDEN DEĞİL. E-posta doğrulaması AÇIK: signUp
-- bir oturum döndürmüyor. Oturumsuz istemci `auth.uid()` taşımadığı için
-- kendi adına satır YAZAMAZ ve rıza sessizce kaybolurdu — profil alanlarında
-- daha önce tam olarak bu yaşandı (bkz. authStore.signUp notu, migration 0086).
-- Bu yüzden rıza, kayıt üstverisiyle taşınıp burada yazılıyor.
create or replace function public.kvkk_onay_kaydet()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  riza boolean;
  surum text;
begin
  riza  := coalesce((new.raw_user_meta_data ->> 'kvkk_riza')::boolean, false);
  surum := nullif(new.raw_user_meta_data ->> 'kvkk_surum', '');

  -- Rıza verilmediyse SATIR YAZILMAZ. "false" yazmak da bir seçenekti ama
  -- yanıltıcı olurdu: rıza sorulmadan oluşturulmuş bir hesapla, sorulup
  -- reddedilmiş hesap aynı görünürdü.
  if riza and surum is not null then
    insert into public.kvkk_onay (user_id, tur, surum, onay, kaynak)
    values (new.id, 'yurtdisi_ai', surum, true, 'kayit');
  end if;

  return new;
end;
$$;

drop trigger if exists kvkk_onay_kayit_tetik on auth.users;
create trigger kvkk_onay_kayit_tetik
  after insert on auth.users
  for each row execute function public.kvkk_onay_kaydet();

-- ── "Şu an rızası var mı?" ─────────────────────────────────────────────────
-- En son satıra bakar. Yapay zekâ uçları ileride bunu soracak.
create or replace function public.kvkk_riza_var_mi(p_tur text default 'yurtdisi_ai')
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select o.onay
       from public.kvkk_onay o
      where o.user_id = auth.uid() and o.tur = p_tur
      order by o.verildi_at desc, o.id desc
      limit 1),
    false);
$$;

revoke all on function public.kvkk_riza_var_mi(text) from anon;
grant execute on function public.kvkk_riza_var_mi(text) to authenticated, service_role;

-- Doğrulama.
select
  (select count(*) from public.kvkk_onay) as onay_satiri,
  (select count(*) from pg_trigger where tgname = 'kvkk_onay_kayit_tetik') as tetikleyici,
  (select count(*) from pg_policies where tablename = 'kvkk_onay') as politika;
