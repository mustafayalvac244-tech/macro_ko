-- ÖLÇÜM: 0205 (satın alma webhook'u) GERÇEKTEN söylediğini yapıyor mu?
-- ---------------------------------------------------------------------------
-- Ön koşul: taklit şema + 0072, 0073, 0076, 0079, 0166, 0173, 0205 uygulanmış
-- (bkz. calistir.sh). Örnek:
--   PGPORT_TEST=55425 PGDATA_TEST=/tmp/pg25 bash scripts/migration-deneme/calistir.sh \
--     0072 0073 0076 0079 0166 0173 0205
--   psql -h /tmp -p 55425 -U postgres -d <calistir'in_olusturdugu_deneme_*> -tA \
--     -f scripts/migration-deneme/revenuecat-olcum.sql
--
-- NE DEĞİLDİR: canlı ölçüm DEĞİL. Yerel Postgres 16 + taklit şema; RevenueCat'e
-- ya da Supabase'e dokunmaz. Senaryoları AJANIN KENDİSİ yazdı (bağımsız doğrulama
-- değil): SQL'in niyet edilen davranışı yaptığını gösterir, gerçek RevenueCat
-- yükünün bu davranışı tetiklediğini GÖSTERMEZ.
--
-- "Zaman geçti" taklidi: defterdeki bitişi geçmişe çekmek (update purchases ...).

\set ON_ERROR_STOP on

create or replace function pg_temp.k(ad text, ok boolean, detay text default '') returns text language sql as $$
  select case when coalesce(ok, false) then 'GEÇTİ    ' else 'BOZULDU  ' end || ad
         || case when coalesce(ok, false) then '' else '  :: ' || coalesce(detay, 'null') end
$$;

create or replace function pg_temp.kullanici(p uuid, adm boolean default false, prem boolean default false, tier text default null)
returns void language sql as $$
  insert into auth.users (id, email) values (p, p::text || '@ornek.test');
  insert into public.profiles (id, email, is_admin, is_premium, ai_tier) values (p, p::text || '@ornek.test', adm, prem, tier);
$$;

create or replace function pg_temp.olay(id text, u uuid, tip text, bitis timestamptz, at timestamptz, env text, yetkiler text[], tutar numeric default 399)
returns boolean language sql as $$
  select public.revenuecat_olay_isle(id, u, tip, 'ios', bitis, at, env, yetkiler, tutar, 'TRY')
$$;

create or replace function pg_temp.prem(u uuid) returns boolean language sql as $$ select is_premium from public.profiles where id = u $$;
create or replace function pg_temp.tier(u uuid) returns text language sql as $$ select ai_tier from public.profiles where id = u $$;

-- Kullanıcılar
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000001');                       -- sandbox
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000002');                       -- sıra
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000004');                       -- AI -> Temel
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000005', false, false, 'pro');  -- elle verilmiş katman
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000006', false, true);          -- süpürülecek
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000007', false, true);          -- pay içinde
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000008', true, true);           -- yönetici
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000009', false, true);          -- yalnız elle premium
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000010');                       -- ek süre
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000011', false, true);          -- boş entitlement
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000012');                       -- eski imza
select pg_temp.kullanici('a0000000-0000-4000-8000-000000000013');                       -- üretim satın alması

-- 1. SANDBOX: erişim AÇILIR, tutar YAZILMAZ
select pg_temp.olay('s-1', 'a0000000-0000-4000-8000-000000000001', 'INITIAL_PURCHASE', now() + interval '30 days', now(), 'SANDBOX', array['premium']) as sonuc \gset
select pg_temp.k('sandbox olayı işlendi (true döner)', :'sonuc' = 't', :'sonuc');
select pg_temp.k('sandbox olayı erişimi AÇAR', pg_temp.prem('a0000000-0000-4000-8000-000000000001'));
select pg_temp.k('sandbox tutarı NULL, ortam SANDBOX',
  (select amount is null and environment = 'SANDBOX' from public.purchases where revenuecat_event_id = 's-1'));

-- 1b. PRODUCTION: tutar yazılır
select pg_temp.olay('p-1', 'a0000000-0000-4000-8000-000000000013', 'INITIAL_PURCHASE', now() + interval '30 days', now(), 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.k('production tutarı yazılır',
  (select amount = 399 and environment = 'PRODUCTION' from public.purchases where revenuecat_event_id = 'p-1'));

-- 2. OLAY SIRASI
select pg_temp.olay('o-1', 'a0000000-0000-4000-8000-000000000002', 'RENEWAL', now() + interval '30 days', now() - interval '1 hour', 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.k('RENEWAL erişimi açar', pg_temp.prem('a0000000-0000-4000-8000-000000000002'));
select pg_temp.olay('o-2', 'a0000000-0000-4000-8000-000000000002', 'EXPIRATION', now() - interval '2 days', now() - interval '3 days', 'PRODUCTION', array['premium'], null) as sonuc \gset
select pg_temp.k('GEÇ gelen ESKİ EXPIRATION yeni RENEWAL''ı EZMEZ', pg_temp.prem('a0000000-0000-4000-8000-000000000002'));
select pg_temp.olay('o-3', 'a0000000-0000-4000-8000-000000000002', 'EXPIRATION', now(), now(), 'PRODUCTION', array['premium'], null) as sonuc \gset
select pg_temp.k('daha YENİ EXPIRATION erişimi kapatır', not pg_temp.prem('a0000000-0000-4000-8000-000000000002'));
select pg_temp.olay('o-4', 'a0000000-0000-4000-8000-000000000002', 'RENEWAL', now() + interval '30 days', now() - interval '2 hours', 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.k('GEÇ gelen ESKİ RENEWAL yeni EXPIRATION''ı geri AÇMAZ', not pg_temp.prem('a0000000-0000-4000-8000-000000000002'));
select pg_temp.olay('o-1', 'a0000000-0000-4000-8000-000000000002', 'RENEWAL', now() + interval '30 days', now() - interval '1 hour', 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.k('aynı olay kimliği ikinci kez: false döner ve hiçbir şey değişmez', :'sonuc' = 'f' and not pg_temp.prem('a0000000-0000-4000-8000-000000000002'), :'sonuc');

-- 3/4. AI -> TEMEL: AI satırı bitince Temel olayı ai_tier'ı düşürür
select pg_temp.olay('t-1', 'a0000000-0000-4000-8000-000000000004', 'RENEWAL', now() + interval '30 days', now() - interval '3 hours', 'PRODUCTION', array['premium', 'ai'], 2999) as sonuc \gset
select pg_temp.k('AI aboneliği iki yetkiyi de açar', pg_temp.prem('a0000000-0000-4000-8000-000000000004') and pg_temp.tier('a0000000-0000-4000-8000-000000000004') = 'ai', pg_temp.tier('a0000000-0000-4000-8000-000000000004'));
update public.purchases set expires_at = now() - interval '1 day' where revenuecat_event_id = 't-1';  -- AI dönemi bitti
select pg_temp.olay('t-2', 'a0000000-0000-4000-8000-000000000004', 'RENEWAL', now() + interval '30 days', now(), 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.k('Temel yenilemesi: premium açık', pg_temp.prem('a0000000-0000-4000-8000-000000000004'));
select pg_temp.k('Temel yenilemesi: ai_tier baslangic''a DÜŞER (eskiden ai kalıyordu)', pg_temp.tier('a0000000-0000-4000-8000-000000000004') = 'baslangic', pg_temp.tier('a0000000-0000-4000-8000-000000000004'));

-- 5. Elle verilmiş katman (pro) süresi dolan AI olayından etkilenmez
select pg_temp.olay('e-1', 'a0000000-0000-4000-8000-000000000005', 'EXPIRATION', now() - interval '1 day', now(), 'PRODUCTION', array['ai'], null) as sonuc \gset
select pg_temp.k('süresi dolan AI olayı elle verilmiş ''pro'' katmanına dokunmaz', pg_temp.tier('a0000000-0000-4000-8000-000000000005') = 'pro', pg_temp.tier('a0000000-0000-4000-8000-000000000005'));

-- 6. SÜPÜRÜCÜ: kaçan EXPIRATION
select pg_temp.olay('w-6', 'a0000000-0000-4000-8000-000000000006', 'RENEWAL', now() + interval '30 days', now(), 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.olay('w-7', 'a0000000-0000-4000-8000-000000000007', 'RENEWAL', now() + interval '30 days', now(), 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.olay('w-8', 'a0000000-0000-4000-8000-000000000008', 'RENEWAL', now() + interval '30 days', now(), 'PRODUCTION', array['premium']) as sonuc \gset
update public.purchases set expires_at = now() - interval '2 days' where revenuecat_event_id in ('w-6', 'w-8');  -- EXPIRATION hiç gelmedi
update public.purchases set expires_at = now() - interval '2 hours' where revenuecat_event_id = 'w-7';          -- pay içinde
select public.revenuecat_suresi_dolanlari_kapat() as kapanan \gset
select pg_temp.k('süpürücü: 2 gün önce bitmiş + EXPIRATION gelmemiş kullanıcının erişimini KAPATIR', not pg_temp.prem('a0000000-0000-4000-8000-000000000006'));
select pg_temp.k('süpürücü: 1 günlük pay içindeki kullanıcıya dokunmaz', pg_temp.prem('a0000000-0000-4000-8000-000000000007'));
select pg_temp.k('süpürücü: yöneticiye dokunmaz', pg_temp.prem('a0000000-0000-4000-8000-000000000008'));
select pg_temp.k('süpürücü: yalnız elle premium verilmiş (defter satırı yok) hesaba dokunmaz', pg_temp.prem('a0000000-0000-4000-8000-000000000009'));
select pg_temp.k('süpürücü: kapatılan sayıyı döndürür (ölçülen: 1 premium)', :'kapanan'::int = 1, :'kapanan');

-- 7. EK SÜRE (grace): BILLING_ISSUE -> CANCELLATION(BILLING_ERROR, bitişi null) -> EXPIRATION
select pg_temp.olay('g-1', 'a0000000-0000-4000-8000-000000000010', 'RENEWAL', now() - interval '1 day', now() - interval '20 days', 'PRODUCTION', array['premium']) as sonuc \gset
select pg_temp.k('dönemi bitmiş RENEWAL tek başına erişim vermez', not pg_temp.prem('a0000000-0000-4000-8000-000000000010'));
select pg_temp.olay('g-2', 'a0000000-0000-4000-8000-000000000010', 'BILLING_ISSUE', now() + interval '10 days', now() - interval '1 day', 'PRODUCTION', array['premium'], null) as sonuc \gset
select pg_temp.k('BILLING_ISSUE (ek süre sonu = bitiş) erişimi ek süre boyunca AÇIK tutar', pg_temp.prem('a0000000-0000-4000-8000-000000000010'));
select pg_temp.olay('g-3', 'a0000000-0000-4000-8000-000000000010', 'CANCELLATION', null, now() - interval '23 hours', 'PRODUCTION', array['premium'], null) as sonuc \gset
select pg_temp.k('CANCELLATION(BILLING_ERROR) (bitiş NULL) ek süre erişimini KESMEZ', pg_temp.prem('a0000000-0000-4000-8000-000000000010'));
select pg_temp.olay('g-4', 'a0000000-0000-4000-8000-000000000010', 'EXPIRATION', now(), now(), 'PRODUCTION', array['premium'], null) as sonuc \gset
select pg_temp.k('ek süre bitince EXPIRATION erişimi KAPATIR', not pg_temp.prem('a0000000-0000-4000-8000-000000000010'));

-- 8. Boş entitlement_ids: yalnız denetim satırı, elle verilmiş premium'a dokunmaz
select pg_temp.olay('b-1', 'a0000000-0000-4000-8000-000000000011', 'TEMPORARY_ENTITLEMENT_GRANT', null, now(), 'PRODUCTION', '{}', null) as sonuc \gset
select pg_temp.k('boş entitlement_ids erişim durumunu DEĞİŞTİRMEZ', pg_temp.prem('a0000000-0000-4000-8000-000000000011'));

-- 9. ESKİ 8 ANAHTARLI ÇAĞRI (göç uygulanmış, uç işlevi henüz eski kodda): hata YOK, işlenir
select public.revenuecat_olay_isle(
  p_event_id => 'old-1', p_user => 'a0000000-0000-4000-8000-000000000012', p_event_type => 'INITIAL_PURCHASE',
  p_platform => 'ios', p_expires_at => now() + interval '30 days', p_entitlement_ids => array['premium'],
  p_amount => 399, p_currency => 'TRY') as sonuc \gset
select pg_temp.k('eski 8 parametreli imza belirsizlik/hata vermeden çalışır ve erişimi açar', :'sonuc' = 't' and pg_temp.prem('a0000000-0000-4000-8000-000000000012'), :'sonuc');
-- 9b. YENİ 10 anahtarlı çağrı (adlandırılmış) belirsizsiz çözülür
select public.revenuecat_olay_isle(
  p_event_id => 'new-1', p_user => 'a0000000-0000-4000-8000-000000000012', p_event_type => 'RENEWAL',
  p_platform => 'ios', p_expires_at => now() + interval '60 days', p_event_at => now(), p_environment => 'PRODUCTION',
  p_entitlement_ids => array['premium'], p_amount => 399, p_currency => 'TRY') as sonuc \gset
select pg_temp.k('yeni 10 parametreli imza adlandırılmış çağrıda çözülür', :'sonuc' = 't', :'sonuc');

-- 10. YETKİ KİLİDİ
select pg_temp.k('yetki: ' || p.oid::regprocedure::text,
  not has_function_privilege('anon', p.oid, 'execute')
  and not has_function_privilege('authenticated', p.oid, 'execute')
  and has_function_privilege('service_role', p.oid, 'execute'),
  'anon=' || has_function_privilege('anon', p.oid, 'execute') || ' auth=' || has_function_privilege('authenticated', p.oid, 'execute'))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('revenuecat_olay_isle', 'revenuecat_yetki_bitis', 'revenuecat_suresi_dolanlari_kapat')
order by p.oid::regprocedure::text;

-- 11. CRON
select pg_temp.k('cron işi kuruldu (vekil_rc_sure_kapat, günde bir)',
  exists (select 1 from cron.job where jobname = 'vekil_rc_sure_kapat' and schedule = '23 3 * * *'));

-- 12. YÖNETİCİ SAYAÇLARI: sandbox satın alma sayılmaz.
-- auth.uid() taklidi yalnız bu bölüm için gerçek bir kimlik döndürür (taklit
-- şemadaki varsayılan NULL idi); biter bitmez geri alınır.
alter table public.profiles add column if not exists son_gorulme timestamptz;
alter table public.oturum_cihazlari add column if not exists platform text;
alter table public.oturum_cihazlari add column if not exists ilk_gorulme timestamptz;
create or replace function auth.uid() returns uuid language sql stable as $$ select 'a0000000-0000-4000-8000-000000000008'::uuid $$;
update public.profiles set deneme_soru_kullanildi = 1 where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000013');
select (public.admin_deneme_takibi(5) ->> 'ucretliye_gecen')::int as gecen \gset
select pg_temp.k('admin_deneme_takibi: yalnız SANDBOX satın alan kişi "ücretliye geçen" SAYILMAZ, production olan sayılır (beklenen 1)', :'gecen'::int = 1, :'gecen');
select odenen_try, satin_alma_adet from public.admin_recent_users(60) where id = 'a0000000-0000-4000-8000-000000000001' \gset s1_
select pg_temp.k('admin_recent_users: sandbox kullanıcısının ödediği 0 ve satın alma sayısı 0', :s1_odenen_try = 0 and :s1_satin_alma_adet = 0, :'s1_odenen_try' || '/' || :'s1_satin_alma_adet');
select odenen_try, satin_alma_adet from public.admin_recent_users(60) where id = 'a0000000-0000-4000-8000-000000000013' \gset s2_
select pg_temp.k('admin_recent_users: production kullanıcısının ödediği 399 ve satın alma sayısı 1', :s2_odenen_try = 399 and :s2_satin_alma_adet = 1, :'s2_odenen_try' || '/' || :'s2_satin_alma_adet');
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
