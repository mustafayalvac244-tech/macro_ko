-- ADMIN PANELİNDEKİ "SON KAYITLAR" HİÇ ÇALIŞMIYORDU.
--
-- BULUNAN HATA (canlıda ölçüldü). admin_recent_users her çağrıda şu hatayla
-- düşüyordu:
--   42702: column reference "id" is ambiguous
--   "It could refer to either a PL/pgSQL variable or a table column."
--
-- SEBEBİ. Fonksiyon `returns table(id uuid, email text, ...)` ile tanımlı ve
-- PL/pgSQL'de bu çıktı kolonlarının adları fonksiyon gövdesinde BİRER DEĞİŞKEN
-- olur. Dolayısıyla admin kontrolündeki
--     select is_admin from public.profiles where id = auth.uid()
-- ifadesindeki `id`, hem çıktı değişkeni `id` hem de `profiles.id` olabilir —
-- Postgres bunu çözemeyip hata veriyordu.
--
-- Hata FONKSİYONUN İLK İFADESİNDE oluştuğu için istisnasız herkes için
-- geçerliydi: admin olmayan da, GERÇEK ADMİN de bu listeyi hiç göremiyordu.
-- Güvenlik açısından zararsızdı (kapalı tarafa düşüyor, veri sızdırmıyor) ama
-- özellik baştan beri ölüydü.
--
-- ÇÖZÜM: kontrol sorgusundaki tabloya takma ad verilip kolon nitelendirildi
-- (pr.id). Aşağıdaki asıl sorgu zaten p./u./us. ile nitelenmişti, orada sorun
-- yoktu. Fonksiyonun imzası ve döndürdüğü sütunlar DEĞİŞMEDİ.

create or replace function public.admin_recent_users(p_limit integer default 60)
returns table(
  id uuid, email text, full_name text, firm_name text, is_premium boolean,
  ai_tier text, ai_cost_try numeric, created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- pr takma adı ŞART: nitelenmemiş `id`, çıktı değişkeniyle çakışıyordu.
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.firm_name, coalesce(p.is_premium, false),
           coalesce(p.ai_tier, case when p.is_premium then 'pro' else 'free' end),
           coalesce((select us.cost_try from public.ai_usage us
                      where us.user_id = p.id and us.period = to_char(now(), 'YYYY-MM')), 0),
           u.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.created_at desc
    limit greatest(1, least(p_limit, 200));
end;
$$;
