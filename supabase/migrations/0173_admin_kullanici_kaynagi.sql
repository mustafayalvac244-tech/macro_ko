-- 06.10.2026 — YÖNETİCİ PANELİ: KULLANICI NEREDEN GELDİ.
-- Ürün sahibi: "yönetici panelinde yeni kullanıcılar var, nereden geldiklerini
-- de ekle". Kayıt artık auth üstverisine `kayit_kaynagi` yazıyor
-- (src/lib/kullanim.ts > kayitKaynagi: platform + web'de utm kaynağı/kampanyası
-- + gelinen sitenin alan adı). Eski kayıtlarda bu yok; oturum_cihazlari'ndaki
-- ilk platform "(cihaz kaydından)" diye gösterilir — kaynak DEĞİL, platformdur.
--
-- Dönüş tipi değiştiği için drop + create (0097 ile aynı kalıp; yetkiler
-- aşağıda yeniden kuruluyor). Gövdenin geri kalanı 0097 ile birebir aynı.

drop function if exists public.admin_recent_users(integer);

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

           coalesce((select sum(pu.amount) from public.purchases pu where pu.user_id = p.id), 0)
           + coalesce((select sum(o.tutar_try) from public.ai_odeme o where o.user_id = p.id), 0),
           coalesce((select count(*) from public.purchases pu where pu.user_id = p.id), 0)::int,
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

-- drop sonrası yetkiler yeniden kuruluyor (yukarıdaki nota bakınız).
revoke all on function public.admin_recent_users(integer) from public, anon;
grant execute on function public.admin_recent_users(integer) to authenticated;
