-- KRİTİK AÇIK: is_premium VE ai_tier, is_admin GİBİ KORUNMUYORDU.
--
-- 0023, kullanıcının kendi profilinde is_admin=true yapıp tüm panele
-- erişebileceğini bulup bir tetikleyiciyle (protect_profile_privileges)
-- kapatmıştı — ama AYNI SINIFTAN AÇIK is_premium ve ai_tier için hiç
-- kapatılmamıştı. profiles UPDATE RLS politikası satır bazlı
-- (auth.uid() = id), kolon kısıtlamıyor; authenticated rolünün ai_tier ve
-- is_premium sütunlarında doğrudan UPDATE izni olduğu canlı veritabanında
-- doğrulandı (information_schema.column_privileges). Yani herhangi bir
-- kullanıcı kendi satırında
--   update profiles set is_premium = true, ai_tier = 'ai' where id = auth.uid()
-- çalıştırıp ÖDEME YAPMADAN hem premium'u hem "ai" katmanını (Claude erişimi
-- dahil) kendine verebilirdi. Uygulamanın kendi kodu bunu hiç yapmıyor
-- (updateProfile yalnız full_name/firm_name/bar_number/phone gönderiyor) ama
-- anon key herkeste olduğundan bu, istemci kodundan bağımsız açık bir kapıydı.
--
-- ÇÖZÜM: 0023'teki trigger'ı genişlet — is_admin'le AYNI kural is_premium ve
-- ai_tier için de geçerli olsun: bu üç alandan biri değişiyorsa VE değiştiren
-- gerçek bir kullanıcı oturumuysa (auth.uid() dolu) VE o kullanıcı admin
-- değilse, üçü de eski değerine döner. auth.uid() NULL olan yol (service_role
-- ile çağrılan revenuecat_olay_isle — webhook, JWT bağlamı taşımaz) ve admin
-- yolu (admin_set_premium RPC'si, auth.uid() = çağıran admin) ETKİLENMEZ —
-- ikisi de zaten meşru tek yazma yollarıydı.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
  caller_is_admin boolean;
begin
  if (new.is_admin is distinct from old.is_admin
      or new.is_premium is distinct from old.is_premium
      or new.ai_tier is distinct from old.ai_tier)
     and auth.uid() is not null then
    caller_is_admin := coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
    if not caller_is_admin then
      new.is_admin := old.is_admin;
      new.is_premium := old.is_premium;
      new.ai_tier := old.ai_tier;
    end if;
  end if;
  return new;
end;
$$;
