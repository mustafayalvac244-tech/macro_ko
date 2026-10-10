-- BAĞIMLI: 0072 0073 0076 0079 0166 0173
-- 0205 — SATIN ALMA WEBHOOK'U: SANDBOX AYRIMI, OLAY SIRASI, SÜRESİ DOLAN ERİŞİM
-- (10.10.2026, 50 denetçi bulgularının doğrulaması; ajan 25)
-- ---------------------------------------------------------------------------
-- NE BOZUKTU (hepsi koddan okunarak doğrulandı; canlıda ÖLÇÜLMEDİ — kullanıcı
-- verisi okunmadı, gerçek satış sayısı 0 olduğundan yaşanmış zarar da yok):
--
--  1. SANDBOX = GERÇEK: sandbox olayı hem erişim açıyordu (DOĞRU, kalsın:
--     Apple inceleyicisi sandbox'ta satın alır) hem de tutarı purchases'a
--     yazılıp "ödenen", "satın alma sayısı" ve "ücretliye geçen" metriklerine
--     karışıyordu (0166'nın kendi notu: "bu tablo ortamı ayırmaz").
--     DÜZELTME: purchases.environment (RevenueCat event.environment: SANDBOX |
--     PRODUCTION). Sandbox satırında amount NULL yazılır; yönetici sayaçları
--     sandbox'ı dışlar. Erişim aynen açılır.
--
--  2. OLAY SIRASI: her olay profili doğrudan eziyordu; geç gelen eski bir
--     olay (ör. RENEWAL'dan sonra ulaşan eski EXPIRATION/CANCELLATION) yeniyi
--     bozabilirdi. DÜZELTME: her olay denetim satırı olarak yazılır
--     (event_at = event_timestamp_ms); profil, ENTITLEMENT BAŞINA "olay zamanı
--     en yeni" satırın bitişinden yeniden hesaplanır. Eski olay yeniyi ezemez.
--     Kusur: RevenueCat belgesi event_timestamp_ms'in "eylemin gerçekleştiği
--     anla örtüşmek zorunda olmadığını" söylüyor; elimizdeki tek sıra alanı bu.
--
--  3. KAÇAN EXPIRATION: bitiş alanı okunuyordu AMA (a) EXPIRATION'da
--     expiration_at_ms yoksa hiçbir şey değişmiyor, (b) olay hiç ulaşmazsa
--     (RevenueCat 5 denemeden sonra vazgeçer: 5+10+20+40+80 dk) premium
--     SÜRESİZ açık kalıyordu. DÜZELTME: (a) uç işlevinde (EXPIRATION bitişi
--     şimdiye çekilir), (b) revenuecat_suresi_dolanlari_kapat + günlük cron.
--
--  4. AI → TEMEL: ai_tier yalnız olayın entitlement_ids'inde 'ai' varsa
--     düşüyordu. AI paketi Temel'e geçince (aynı abonelik grubunda ürün
--     değişimi) Temel'in olayı ['premium'] taşır, EXPIRATION GELMEZ → ai_tier
--     ve Claude erişimi süresiz kalırdı. DÜZELTME: her olayda İKİ yetki de
--     defterden yeniden hesaplanır; AI'nin en yeni satırı bitmişse düşer.
--
--  5. TRANSFER ve anonim kimlik: atlanıyor ve iz bırakmıyordu → uç işlevi
--     artık loglar (SQL değişikliği yok). TRANSFER'in İŞLENMESİ ayrı karar:
--     belge nasıl işleneceğini söylemiyor → ürün sahibi kararı bekliyor.
--
--  6. İADE / EK SÜRE: BILLING_ISSUE ve CANCELLATION(BILLING_ERROR) ek süre
--     (grace) içinde erişimi eskiden anında kesiyordu; iade ise dönem sonuna
--     kadar erişim bırakıyordu. Kararlar uç işlevi tarafında
--     (_shared/revenuecatOlay.ts); SQL yalnız sonucu uygular.
--
-- DAĞITIM SIRASI: ÖNCE bu göç, SONRA revenuecat-webhook uç işlevi.
-- Eski 8 parametreli revenuecat_olay_isle imzası SARMALAYICI olarak KALIR
-- (düşürülmez): göç uygulanıp uç işlevi henüz eski kodda iken gelen olaylar
-- 5xx almaz — RevenueCat 5 denemeden sonra vazgeçtiği için düşen bir olay
-- gerçek bir satın almanın kaybı olurdu. Yeni imzadaki iki yeni parametre
-- (p_event_at, p_environment) BİLEREK varsayılansızdır: varsayılan olsaydı
-- eski 8 anahtarlı çağrı iki işleve birden uyar, PostgREST "hangisi?" diye
-- reddederdi (PGRST203). Eski imza, uç işlevi güncellendikten sonra başka bir
-- göçle silinebilir.
--
-- ÖLÇÜLDÜ (yerel Postgres 16, taklit şema; canlıda DEĞİL):
-- scripts/migration-deneme/revenuecat-olcum.sql

-- 1. Ortam ve olay zamanı. Eski satırlarda ikisi de NULL (ortam bilinmiyor:
--    sandbox sayılmaz, eskisi gibi davranır).
alter table public.purchases add column if not exists environment text;
alter table public.purchases add column if not exists event_at timestamptz;
alter table public.purchases drop constraint if exists purchases_environment_check;
alter table public.purchases add constraint purchases_environment_check
  check (environment is null or environment in ('SANDBOX', 'PRODUCTION'));

-- 2. Bir yetkinin (premium | ai) defterdeki EN YENİ satırının bitişi.
--    "En yeni" = olay zamanı (eski satırlarda alınma zamanı) en büyük olan.
--    expires_at NULL satırlar durum satırı sayılmaz (bilinmeyen/yetki
--    değiştirmeyen olay; ör. CANCELLATION+BILLING_ERROR).
create or replace function public.revenuecat_yetki_bitis(p_user uuid, p_yetki text)
returns timestamptz
language sql
stable
set search_path = public as $$
  select pu.expires_at
  from public.purchases pu
  where pu.user_id = p_user
    and pu.revenuecat_event_id is not null
    and pu.expires_at is not null
    and p_yetki = any(pu.entitlement_ids)
  order by coalesce(pu.event_at, pu.created_at) desc, pu.created_at desc, pu.id desc
  limit 1
$$;

-- 3. Olay işleme. YENİ imza: p_event_at ve p_environment zorunlu (varsayılansız),
--    varsayılanlı olanlar sonda (PostgreSQL kuralı).
create or replace function public.revenuecat_olay_isle(
  p_event_id text,
  p_user uuid,
  p_event_type text,
  p_platform text,
  p_expires_at timestamptz,
  p_event_at timestamptz,
  p_environment text,
  p_entitlement_ids text[] default '{}',
  p_amount numeric default null,
  p_currency text default 'TRY'
)
returns boolean
language plpgsql
security definer set search_path = public as $$
declare
  v_bitis timestamptz;
begin
  if p_event_id is null or p_event_id = '' then
    raise exception 'event_id gerekli';
  end if;
  if p_user is null then
    raise exception 'user_id gerekli';
  end if;
  if p_environment is not null and p_environment not in ('SANDBOX', 'PRODUCTION') then
    p_environment := null;
  end if;

  insert into public.purchases
    (user_id, product, platform, amount, currency, revenuecat_event_id, event_type,
     expires_at, entitlement_ids, environment, event_at)
  values
    (p_user, 'premium', coalesce(p_platform, 'other'),
     -- SANDBOX tutarı gelir değildir: erişim açılır, para yazılmaz.
     case when p_environment = 'SANDBOX' then null else p_amount end,
     coalesce(p_currency, 'TRY'),
     p_event_id, p_event_type, p_expires_at, p_entitlement_ids, p_environment,
     coalesce(p_event_at, now()))
  on conflict (revenuecat_event_id) do nothing;

  if not found then
    return false; -- zaten işlenmiş
  end if;

  -- İKİ yetki de defterdeki en yeni satırdan yeniden hesaplanır (olay hangisini
  -- anarsa ansın). Defterde o yetkiye dair HİÇ bitişli satır yoksa ona
  -- dokunulmaz: bilmediğimiz bir şeyden tahminle erişim verilmez/alınmaz.
  v_bitis := public.revenuecat_yetki_bitis(p_user, 'premium');
  if v_bitis is not null then
    update public.profiles set is_premium = (v_bitis > now()) where id = p_user;
  end if;

  v_bitis := public.revenuecat_yetki_bitis(p_user, 'ai');
  if v_bitis is not null then
    if v_bitis > now() then
      update public.profiles set ai_tier = 'ai' where id = p_user and ai_tier is distinct from 'ai';
    else
      -- Yalnız 'ai' ise düşer: yöneticinin elle verdiği başka bir katmana
      -- (ör. kontörlü pro/elit) süresi dolan AI aboneliği dokunmasın.
      update public.profiles set ai_tier = 'baslangic' where id = p_user and ai_tier = 'ai';
    end if;
  end if;

  return true;
end;
$$;

-- 4. ESKİ 8 PARAMETRELİ İMZA: SARMALAYICI (yukarıdaki not). create or replace
--    aynı imza + aynı varsayılanlarla yapılır; yeni işleve devreder.
create or replace function public.revenuecat_olay_isle(
  p_event_id text,
  p_user uuid,
  p_event_type text,
  p_platform text,
  p_expires_at timestamptz,
  p_entitlement_ids text[] default '{}',
  p_amount numeric default null,
  p_currency text default 'TRY'
)
returns boolean
language sql
security definer set search_path = public as $$
  select public.revenuecat_olay_isle(
    p_event_id, p_user, p_event_type, p_platform, p_expires_at,
    null::timestamptz, null::text, p_entitlement_ids, p_amount, p_currency)
$$;

-- 5. SÜRESİ DOLAN ERİŞİM SÜPÜRÜCÜSÜ: EXPIRATION olayı hiç ulaşmadıysa erişim
--    süresiz kalmasın. YALNIZ defterde RevenueCat satırı olan kullanıcılara
--    bakar (yalnız yönetici panelinden premium verilmiş hesaplar etkilenmez) ve
--    yöneticileri atlar (kendi hesabıyla sandbox deneyen ürün sahibi, elle
--    verdiği erişimi kaybetmesin).
--    p_pay: en yeni satırın bitişinden sonra beklenen pay. 1 gün SEÇİLMİŞ bir
--    değerdir, ÖLÇÜLMEDİ: RevenueCat'in yeniden deneme penceresi (belge:
--    5, 10, 20, 40, 80 dk = 155 dk) ve "EXPIRATION yaklaşık 1 saat
--    gecikebilir" notunun rahatça üstünde.
create or replace function public.revenuecat_suresi_dolanlari_kapat(p_pay interval default interval '1 day')
returns integer
language plpgsql
security definer set search_path = public as $$
declare
  r record;
  v_bitis timestamptz;
  v_adet integer := 0;
  v_n integer;
begin
  for r in
    select p.id, coalesce(p.is_premium, false) as premium, p.ai_tier
    from public.profiles p
    where (coalesce(p.is_premium, false) or p.ai_tier = 'ai')
      and not coalesce(p.is_admin, false)
      and exists (select 1 from public.purchases pu
                  where pu.user_id = p.id and pu.revenuecat_event_id is not null)
  loop
    if r.premium then
      v_bitis := public.revenuecat_yetki_bitis(r.id, 'premium');
      if v_bitis is not null and v_bitis + p_pay < now() then
        update public.profiles set is_premium = false where id = r.id and is_premium;
        get diagnostics v_n = row_count;
        v_adet := v_adet + v_n;
      end if;
    end if;
    if r.ai_tier = 'ai' then
      v_bitis := public.revenuecat_yetki_bitis(r.id, 'ai');
      if v_bitis is not null and v_bitis + p_pay < now() then
        update public.profiles set ai_tier = 'baslangic' where id = r.id and ai_tier = 'ai';
        get diagnostics v_n = row_count;
        v_adet := v_adet + v_n;
      end if;
    end if;
  end loop;
  return v_adet;
end;
$$;

-- 6. YETKİ KİLİDİ (0079 dersi): yeni/yeniden yaratılan fonksiyonlar varsayılan
--    olarak PUBLIC'e açıktır; revenuecat_olay_isle'ye anon/authenticated
--    erişimi = herkesin kendine bedava "ai" aboneliği vermesi. İsimden
--    döngüyle: iki imza da (aşırı yükleme) kapsanır.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array['revenuecat_olay_isle', 'revenuecat_yetki_bitis', 'revenuecat_suresi_dolanlari_kapat'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;

-- 7. Günlük süpürme (03:23 UTC; tam saat/yarım saat değil). Maliyeti ÖLÇÜLMEDİ:
--    profiller tablosunu günde bir kez tarar, yalnız is_premium/ai_tier='ai'
--    olanlar için defter sorgusu yapar. Geri alma: select cron.unschedule('vekil_rc_sure_kapat');
select cron.unschedule('vekil_rc_sure_kapat') where exists (select 1 from cron.job where jobname = 'vekil_rc_sure_kapat');
select cron.schedule('vekil_rc_sure_kapat', '23 3 * * *', $$select public.revenuecat_suresi_dolanlari_kapat()$$);

-- 8. YÖNETİCİ SAYAÇLARI: sandbox satırı gelir/satın alma/ücretliye geçen
--    sayılmaz. Aşağıdaki iki fonksiyon, en son tanımlarının (0173 ve 0166)
--    BİREBİR kopyasıdır; tek fark `pu.environment is distinct from 'SANDBOX'`
--    koşulu. Dönüş tipleri değişmediği için create or replace; yetkiler korunur.

create or replace function public.admin_recent_users(p_limit integer default 60)
returns table(
  id uuid, email text, full_name text, firm_name text, is_premium boolean,
  ai_tier text, ai_cost_try numeric, created_at timestamptz, last_sign_in_at timestamptz,
  son_islem timestamptz,
  odenen_try numeric,
  satin_alma_adet integer,
  ai_maliyet_toplam_try numeric,
  dava_adedi integer,
  muvekkil_adedi integer,
  gelir_try numeric,
  gider_try numeric,
  tahsilat_try numeric,
  finans_kayit_adedi integer,
  -- 0097 ile eklenen
  son_gorulme timestamptz,
  -- 0173 ile eklenen: nereden geldi
  kaynak text
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- pr takma adı ŞART: nitelenmemiş `id`, çıktı değişkeniyle çakışıyor (bkz. 0089).
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.firm_name, coalesce(p.is_premium, false),
           coalesce(p.ai_tier, case when p.is_premium then 'pro' else 'free' end),
           coalesce((select us.cost_try from public.ai_usage us
                      where us.user_id = p.id and us.period = to_char(now(), 'YYYY-MM')), 0),
           u.created_at, u.last_sign_in_at,

           greatest(
             (select max(c.created_at)  from public.cases c           where c.owner_id = p.id),
             (select max(cl.created_at) from public.clients cl        where cl.owner_id = p.id),
             (select max(h.created_at)  from public.hearings h        where h.owner_id = p.id),
             (select max(f.created_at)  from public.finance_entries f where f.owner_id = p.id)
           ),

           coalesce((select sum(pu.amount) from public.purchases pu where pu.user_id = p.id and pu.environment is distinct from 'SANDBOX'), 0)
           + coalesce((select sum(o.tutar_try) from public.ai_odeme o where o.user_id = p.id), 0),
           coalesce((select count(*) from public.purchases pu where pu.user_id = p.id and pu.environment is distinct from 'SANDBOX'), 0)::int,
           coalesce((select sum(us.cost_try) from public.ai_usage us where us.user_id = p.id), 0),
           coalesce((select count(*) from public.cases c   where c.owner_id = p.id), 0)::int,
           coalesce((select count(*) from public.clients cl where cl.owner_id = p.id), 0)::int,

           coalesce((select sum(f.amount) from public.finance_entries f
                      where f.owner_id = p.id and f.kind = 'income'), 0),
           coalesce((select sum(f.amount) from public.finance_entries f
                      where f.owner_id = p.id and f.kind = 'expense'), 0),
           coalesce((select sum(pay.amount) from public.payments pay where pay.owner_id = p.id), 0),
           coalesce((select count(*) from public.finance_entries f where f.owner_id = p.id), 0)::int,

           p.son_gorulme,

           -- KAYNAK: önce kayıtta yazılan (06.10.2026'dan itibaren), yoksa
           -- cihaz kaydındaki İLK platform (11.09.2026'dan itibaren tutuluyor;
           -- reklam/site bilgisi YOK, yalnız platform — bu yüzden ayrıca
           -- işaretleniyor), o da yoksa 'bilinmiyor'.
           coalesce(
             nullif(concat_ws(' · ',
               case u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'platform'
                 when 'ios' then 'iPhone' when 'android' then 'Android' when 'web' then 'Web'
                 else u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'platform' end,
               nullif(concat_ws('/', u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'kaynak',
                                     u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'kampanya'), ''),
               u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'site',
               case when u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'platform' = 'web'
                     and coalesce(u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'kaynak', '') = ''
                     and coalesce(u.raw_user_meta_data -> 'kayit_kaynagi' ->> 'site', '') = ''
                    then 'doğrudan' end
             ), ''),
             (select case oc.platform when 'ios' then 'iPhone' when 'android' then 'Android'
                                      when 'web' then 'Web' else oc.platform end
                     || ' (cihaz kaydından)'
                from public.oturum_cihazlari oc
               where oc.user_id = p.id
               order by oc.ilk_gorulme asc
               limit 1),
             'bilinmiyor'
           )

    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 200));
end;
$$;

create or replace function public.admin_deneme_takibi(p_limit integer default 50)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare sonuc json;
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;

  with deneyen as (
    select p.id, p.full_name, coalesce(p.is_premium, false) as premium, coalesce(p.ai_tier, '') as tier,
           coalesce(p.deneme_soru_kullanildi, 0) as kullanilan
    from public.profiles p
    where coalesce(p.deneme_soru_kullanildi, 0) > 0 and coalesce(p.ai_tier, '') <> 'ai'
  ),
  istek as (
    select i.user_id, i.mod, i.iade_edildi, i.olusturuldu
    from public.ai_istek i
    join public.profiles p on p.id = i.user_id
    where coalesce(p.ai_tier, '') <> 'ai'
  )
  select json_build_object(
    'deneyen_kisi',        (select count(*) from deneyen),
    'ucretsiz_bitiren',    (select count(*) from deneyen where not premium and kullanilan >= 10),
    'ucretliye_gecen',     (select count(*) from public.profiles p
                              where coalesce(p.deneme_soru_kullanildi, 0) > 0
                                and not coalesce(p.is_admin, false)
                                and exists (select 1 from public.purchases pu
                                            where pu.user_id = p.id
                                              and pu.revenuecat_event_id is not null
                                              and pu.environment is distinct from 'SANDBOX')),
    'son7_istek',          (select count(*) from istek where olusturuldu > now() - interval '7 days'),
    'son7_iade',           (select count(*) from istek where olusturuldu > now() - interval '7 days' and iade_edildi),
    'mod_dagilim',         (select coalesce(json_agg(x order by x.adet desc), '[]'::json) from (
                              select mod, count(*) as adet from istek
                              where olusturuldu > now() - interval '30 days' group by mod) x),
    'kisiler',             (select coalesce(json_agg(k order by k.son desc nulls last), '[]'::json) from (
                              select d.full_name as ad, d.premium, d.kullanilan,
                                     (select max(olusturuldu) from istek where user_id = d.id) as son,
                                     (select count(*) from istek where user_id = d.id and iade_edildi) as iade,
                                     (select string_agg(distinct mod, ', ') from istek where user_id = d.id) as modlar
                              from deneyen d
                              order by son desc nulls last
                              limit greatest(1, least(coalesce(p_limit, 50), 200))) k)
  ) into sonuc;
  return sonuc;
end;
$function$;
