-- ADMIN PANELİ: KULLANICININ UYGULAMA İÇİ GELİR/GİDER HACMİ
-- ---------------------------------------------------------------------------
-- 0095'te kullanıcı başına "BİZE ödediği" (purchases + ai_odeme) eklenmişti.
-- Sorulan şey o değildi: avukatın UYGULAMA İÇİNDE işlediği kendi cirosu —
-- Finans modülündeki gelir/gider kayıtları ve dosya tahsilatları.
--
-- İKİ FARKLI PARA, KARIŞTIRILMAMALI:
--   odenen_try   = kullanıcının BİZE ödediği (abonelik / AI kontörü)
--   gelir_try    = kullanıcının KENDİ müvekkillerinden yazdığı gelir
--   gider_try    = kullanıcının KENDİ büro gideri
--   tahsilat_try = dosya bazlı tahsilat kayıtları (payments)
-- Arayüzde de ayrı etiketlerle gösteriliyor.
--
-- TEKRARLAYAN KAYIT UYARISI. finance_entries'te is_recurring = true olan
-- kayıtlar (kira, maaş, vekâlet ücreti) tabloda TEK SATIRDIR ama uygulama
-- onları entry_date ayından recurring_until ayına kadar HER AY sayar
-- (bkz. 0005_finance.sql başlığı). Buradaki toplam HAM TOPLAMDIR: her
-- tekrarlayan kaydı bir kez sayar. Yani ekranda gördüğün rakam, avukatın
-- kendi Finans ekranındaki aylık toplamlarla birebir aynı OLMAYABİLİR.
-- Bu bilerek böyle: tekrarları burada açmak, hangi aya bakıldığına bağlı
-- bir sayı üretirdi ve "toplam hacim" anlamını kaybederdi.
--
-- GİZLİLİK NOTU. Bu sütunlar avukatın kendi mali verisinin ÖZETİDİR (tek tek
-- kayıt değil, toplam). Yalnız is_admin kullanıcıya, SECURITY DEFINER
-- fonksiyon üzerinden döner; kayıt detayı hiçbir yerde açılmaz.

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
  -- 0096 ile eklenen: kullanıcının UYGULAMA İÇİ kendi ciro hacmi
  gelir_try numeric,
  gider_try numeric,
  tahsilat_try numeric,
  finans_kayit_adedi integer
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

           -- UYGULAMA İÇİ GELİR/GİDER (ham toplam; tekrarlayan kayıt bir kez sayılır)
           coalesce((select sum(f.amount) from public.finance_entries f
                      where f.owner_id = p.id and f.kind = 'income'), 0),
           coalesce((select sum(f.amount) from public.finance_entries f
                      where f.owner_id = p.id and f.kind = 'expense'), 0),
           coalesce((select sum(pay.amount) from public.payments pay where pay.owner_id = p.id), 0),
           coalesce((select count(*) from public.finance_entries f where f.owner_id = p.id), 0)::int

    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 200));
end;
$$;

-- Kullanıcı başına toplam alınıyor; sahip sütununda indeks yoksa 200 kişilik
-- listede finance_entries ve payments tam taranırdı.
create index if not exists finance_entries_owner_kind_idx on public.finance_entries (owner_id, kind);
create index if not exists payments_owner_amount_idx on public.payments (owner_id);
