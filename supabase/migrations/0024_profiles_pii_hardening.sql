-- 0024 — profiles PII sertleştirmesi
--
-- Sorun: "profiles readable by authenticated" politikası + tablo-geneli SELECT,
-- giriş yapan HERKESİN tüm kullanıcıların email, phone ve tc_no değerlerini
-- API'den okumasına izin veriyordu (KVKK ihlali). Uygulama başkalarının yalnız
-- public alanlarını (ad/büro/baro/avatar/premium) kullanıyor.
--
-- Çözüm: hassas kolonların tablo-üstü SELECT iznini kaldır; kalan public
-- kolonlara kolon-düzeyi SELECT ver. Kullanıcı kendi tam profilini (hassas
-- alanlar dâhil) yalnız definer my_profile() RPC'siyle okur.

create or replace function public.my_profile()
returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Tablo-geneli SELECT'i kaldır; yalnız public kolonlara kolon-düzeyi SELECT ver.
-- (email, phone, tc_no dışarıda bırakıldı → başka kullanıcılar okuyamaz.)
revoke select on public.profiles from authenticated, anon;
grant select (
  id, full_name, firm_name, bar_number, avatar_url,
  created_at, updated_at, is_premium, friend_code, baro, is_admin
) on public.profiles to authenticated;
