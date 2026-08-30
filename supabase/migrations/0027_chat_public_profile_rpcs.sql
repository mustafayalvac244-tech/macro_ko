-- Sohbet/rehber için herkese-açık profil erişimi. profiles PII sertleştirmesiyle
-- authenticated'a kapalı; bu SECURITY DEFINER RPC'ler YALNIZCA açık alanları
-- (ad, büro, baro no, avatar, premium) döndürür — telefon/e-posta/TC ASLA sızmaz.

create or replace function public.public_profiles(p_ids uuid[])
returns table(id uuid, full_name text, firm_name text, bar_number text, avatar_url text, is_premium boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.firm_name, p.bar_number, p.avatar_url, coalesce(p.is_premium, false)
  from public.profiles p
  where p.id = any(p_ids)
$$;

create or replace function public.search_lawyers(p_q text)
returns table(id uuid, full_name text, firm_name text, bar_number text, avatar_url text, is_premium boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  q text := trim(coalesce(p_q, ''));
  digits text := regexp_replace(coalesce(p_q,''), '[^0-9+]', '', 'g');
  code text := upper(regexp_replace(coalesce(p_q,''), '\s', '', 'g'));
begin
  if length(q) < 2 then return; end if;
  return query
    select p.id, p.full_name, p.firm_name, p.bar_number, p.avatar_url, coalesce(p.is_premium, false)
    from public.profiles p
    where p.id <> auth.uid()
      and (
        p.full_name ilike '%'||q||'%'
        or p.firm_name ilike '%'||q||'%'
        or p.bar_number ilike '%'||q||'%'
        or (length(digits) >= 4 and p.phone ilike '%'||digits||'%')
        or p.friend_code ilike '%'||code||'%'
      )
    order by p.full_name
    limit 20;
end;
$$;

grant execute on function public.public_profiles(uuid[]) to authenticated;
grant execute on function public.search_lawyers(text) to authenticated;
