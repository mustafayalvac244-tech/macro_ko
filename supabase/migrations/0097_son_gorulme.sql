-- GERÇEK "SON GÖRÜLME" KAYDI
-- ---------------------------------------------------------------------------
-- BULUNAN EKSİK. "Bu kullanıcı en son ne zaman girdi?" sorusunun uygulamada
-- güvenilir bir cevabı YOKTU. Elde iki şey vardı, ikisi de yanlış ölçüyordu:
--
--   auth.users.last_sign_in_at — oturum cihazda saklanıyor ve jeton otomatik
--     tazeleniyor (src/lib/supabase.ts: persistSession + autoRefreshToken).
--     Çıkış yapmayan bir avukat uygulamayı HER GÜN açsa bile bu tarih aylar
--     öncesini gösterir. "Giren son cihaz oturumu" demektir, "kullandı" değil.
--
--   son_islem (0095) — kullanıcının açtığı son KAYIT. Gerçek kullanımı
--     gösterir ama yalnız YAZAN kullanıcıda dolar. Sadece dosyalarına bakan,
--     duruşma listesini okuyan, içtihat arayan avukat hiç görünmez.
--
-- Bu migration üçüncüsünü ekliyor: uygulamayı her AÇTIĞINDA güncellenen
-- son_gorulme. Okuma da sayılır.
--
-- YAZMA MALİYETİ. İstemci bunu her açılışta ve her öne gelişte çağırırsa
-- yoğun kullanıcıda günde onlarca yazma olur. Fonksiyon bu yüzden KENDİ
-- İÇİNDE kısıyor: son kayıttan bu yana 30 dakika geçmediyse hiç yazmıyor.
-- Böylece kısıtlama istemciye (ve istemcinin doğru davranmasına) bağlı değil.

alter table public.profiles add column if not exists son_gorulme timestamptz;

comment on column public.profiles.son_gorulme is
  'Kullanıcının uygulamayı en son açtığı an. Okuma da sayılır. En fazla 30 dakikada bir yazılır.';

-- Kullanıcı kendi satırını doğrudan güncelleyemesin diye SECURITY DEFINER.
-- (profiles üzerinde kullanıcıya update yetkisi var ama bu kolonu istemci
--  serbestçe yazabilseydi "son görülme" uydurulabilir bir alan olurdu.)
create or replace function public.son_gorulme_dokun()
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  kim uuid := auth.uid();
  onceki timestamptz;
begin
  if kim is null then
    return null;
  end if;

  select pr.son_gorulme into onceki from public.profiles pr where pr.id = kim;

  -- 30 dakikadan yeniyse yazma — gereksiz yazma trafiği ve WAL şişmesi olmasın.
  if onceki is not null and onceki > now() - interval '30 minutes' then
    return onceki;
  end if;

  update public.profiles set son_gorulme = now() where id = kim;
  return now();
end;
$$;

revoke all on function public.son_gorulme_dokun() from public, anon;
grant execute on function public.son_gorulme_dokun() to authenticated;

-- Admin listesi bu sütunu da döndürsün (0096'nın üstüne ekleniyor).
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
  son_gorulme timestamptz
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

           p.son_gorulme

    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 200));
end;
$$;

-- "Son 7 günde uygulamayı açan" gibi sorgular için.
create index if not exists profiles_son_gorulme_idx on public.profiles (son_gorulme desc nulls last);
