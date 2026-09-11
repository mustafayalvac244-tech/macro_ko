-- ADMIN PANELİ: KULLANICI BAŞINA "SON GİRİŞ", "SON İŞLEM" VE PARA BİLGİSİ
-- ---------------------------------------------------------------------------
-- BULUNAN EKSİK. admin_recent_users zaten `last_sign_in_at` DÖNDÜRÜYORDU ve
-- istemci tipi (src/hooks/useAdmin.ts) onu alıyordu; ekran (app/admin.tsx)
-- ise satırda YALNIZ created_at'i basıyordu. Yani veri sunucudan geliyor,
-- ağdan iniyor ve çöpe atılıyordu. "Bu kullanıcı en son ne zaman girdi"
-- sorusunun cevabı uygulamada hiçbir yerde görünmüyordu.
--
-- İKİ ÖNEMLİ AYRIM (arayüzde de bu şekilde etiketleniyor):
--   • last_sign_in_at = son GİRİŞ. Oturum cihazda saklanıp jeton otomatik
--     tazelendiği için (supabase.ts: persistSession + autoRefreshToken),
--     çıkış yapmayan bir kullanıcı uygulamayı her gün açsa bile bu tarih
--     AYLAR ÖNCESİNİ gösterebilir. Tek başına "aktiflik" ölçüsü DEĞİLDİR.
--   • son_islem = kullanıcının kendi kayıtlarından en yenisinin tarihi
--     (dava / müvekkil / duruşma / finans). Gerçek kullanımın ölçüsü budur.
--     Yalnız OKUMA yapan (hiç kayıt açmayan) bir kullanıcıda bu da boş kalır;
--     uygulama ayrı bir "son görülme" kaydı TUTMUYOR.
--
-- PARA. odenen_try, kullanıcının BİZE ödediğidir: purchases (mağaza/Stripe)
-- + ai_odeme (AI kontör yüklemesi). NOT: 2026-09-11 ölçümünde hem
-- revenuecat-webhook hem stripe-webhook 503 {"error":"not_configured"}
-- dönüyordu — gizli anahtarlar ayarlanmadığı için ödeme kaydı yazılamıyor.
-- Yani bu sütun bugün 0 görünüyorsa sebebi kullanıcı değil, kurulum eksiği.
--
-- İmzaya SÜTUN EKLENDİ; eski sütunların adı ve sırası korundu, sonuna eklendi.

-- DÖNÜŞ TİPİ DEĞİŞİYOR → ÖNCE DROP ŞART.
-- Postgres: "42P13 cannot change return type of existing function". CREATE OR
-- REPLACE bir fonksiyonun döndürdüğü sütun kümesini DEĞİŞTİREMEZ; bu migration
-- admin_recent_users'a yeni sütun ekliyor, dolayısıyla önce düşürülmeli.
--
-- DİKKAT — GÜVENLİK: drop, fonksiyonun YETKİLERİNİ DE SİLER. Yeniden
-- oluşturulan fonksiyonda Postgres varsayılanı devreye girer ve EXECUTE
-- yetkisi PUBLIC'e geri verilir. 0023 ve 0079'da bilerek kaldırılan bu yetki
-- sessizce geri gelirdi. Bu yüzden aşağıda create'ten SONRA revoke/grant
-- yeniden yazılıyor.
drop function if exists public.admin_recent_users(integer);

create or replace function public.admin_recent_users(p_limit integer default 60)
returns table(
  id uuid, email text, full_name text, firm_name text, is_premium boolean,
  ai_tier text, ai_cost_try numeric, created_at timestamptz, last_sign_in_at timestamptz,
  -- yeni sütunlar
  son_islem timestamptz,
  odenen_try numeric,
  satin_alma_adet integer,
  ai_maliyet_toplam_try numeric,
  dava_adedi integer,
  muvekkil_adedi integer
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

           -- SON İŞLEM: kullanıcının kendi kayıtlarından en yenisi.
           greatest(
             (select max(c.created_at)  from public.cases c           where c.owner_id = p.id),
             (select max(cl.created_at) from public.clients cl        where cl.owner_id = p.id),
             (select max(h.created_at)  from public.hearings h        where h.owner_id = p.id),
             (select max(f.created_at)  from public.finance_entries f where f.owner_id = p.id)
           ),

           -- ÖDENEN: mağaza/Stripe satın almaları + AI kontör yüklemeleri.
           coalesce((select sum(pu.amount) from public.purchases pu where pu.user_id = p.id), 0)
           + coalesce((select sum(o.tutar_try) from public.ai_odeme o where o.user_id = p.id), 0),

           coalesce((select count(*) from public.purchases pu where pu.user_id = p.id), 0)::int,

           -- AI'ın BİZE maliyeti (tüm dönemler, aylık değil).
           coalesce((select sum(us.cost_try) from public.ai_usage us where us.user_id = p.id), 0),

           coalesce((select count(*) from public.cases c   where c.owner_id = p.id), 0)::int,
           coalesce((select count(*) from public.clients cl where cl.owner_id = p.id), 0)::int

    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 200));
end;
$$;

-- drop sonrası yetkiler yeniden kuruluyor (yukarıdaki nota bakınız).
revoke all on function public.admin_recent_users(integer) from public, anon;
grant execute on function public.admin_recent_users(integer) to authenticated;


-- Alt sorgular kullanıcı başına filtreliyor; sahip sütunlarında indeks yoksa
-- 200 kullanıcılık listede tablo taraması yapılırdı.
create index if not exists purchases_user_amount_idx on public.purchases (user_id);
create index if not exists ai_odeme_user_idx on public.ai_odeme (user_id);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id);
