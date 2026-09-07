-- REVENUECAT IAP — gerçek satın alma akışının sunucu tarafı.
-- ---------------------------------------------------------------------------
-- 0011'in kendi notu bunu önceden söylüyordu: "When RevenueCat/IAP lands,
-- its webhook writes into this same table (platform: 'ios' | 'android')."
-- Bugüne kadar hiçbir şey bu tabloya YAZMIYORDU — premium.tsx yalnız
-- OKUYORDU, is_premium yalnız admin panelinden elle açılıyordu. Bu göç,
-- gerçek satın almanın işleneceği tek yeri kurar.
--
-- IDEMPOTANS DESENİ 0064'teki (Stripe/ai_odeme) İLE BİREBİR AYNI: olay
-- kimliği (revenuecat_event_id) tekil, yazma ile profil güncellemesi TEK
-- fonksiyonda birleşiyor ki RevenueCat aynı olayı tekrar gönderdiğinde
-- (belgelenmiş normal davranış — 5xx/timeout sonrası 5 kez tekrar dener)
-- ikinci kez hiçbir şey değişmesin.
--
-- SÜRE TABANLI DOĞRULUK. Olay TÜRÜNE (type) göre dallanmıyoruz — CANCELLATION
-- geldiğinde erişimi hemen kesmek YANLIŞ olurdu: iptal edilmiş ama dönem sonu
-- henüz gelmemiş bir abonelik hâlâ premium olmalıdır. Mağaza zaten bunu
-- expiration_at_ms ile doğru ifade ediyor; tek karar kuralı "süresi geçti mi".
alter table purchases add column if not exists revenuecat_event_id text unique;
alter table purchases add column if not exists event_type text;
alter table purchases add column if not exists expires_at timestamptz;

alter table purchases drop constraint if exists purchases_platform_check;
alter table purchases add constraint purchases_platform_check
  check (platform in ('demo', 'stripe', 'ios', 'android', 'other'));

-- İSTEMCİ ARTIK KENDİ SATIRINI YAZAMAZ. Eskiden "kendi satırını ekleyebilir"
-- politikası vardı (Stripe denemesinden kalma) — bugün hiç kullanılmıyordu
-- ama durursa bir istemci sahte bir satır ekleyip kendine bedava premium
-- yazdırabilirdi. Yazma yetkisi yalnız service_role'de (webhook).
drop policy if exists "purchases own insert" on purchases;
revoke insert, update, delete on purchases from authenticated, anon;

/**
 * RevenueCat webhook olayını işler: audit kaydı yazar + profiles.is_premium
 * günceller. Idempotent — aynı p_event_id ikinci kez gelirse false döner ve
 * hiçbir şey değişmez (bkz. 0064 > ai_odeme_isle, aynı desen).
 */
create or replace function public.revenuecat_olay_isle(
  p_event_id text,
  p_user uuid,
  p_event_type text,
  p_platform text,
  p_expires_at timestamptz,
  p_amount numeric default null,
  p_currency text default 'TRY'
)
returns boolean
language plpgsql
security definer set search_path = public as $$
begin
  if p_event_id is null or p_event_id = '' then
    raise exception 'event_id gerekli';
  end if;
  if p_user is null then
    raise exception 'user_id gerekli';
  end if;

  insert into public.purchases
    (user_id, product, platform, amount, currency, revenuecat_event_id, event_type, expires_at)
  values
    (p_user, 'premium', coalesce(p_platform, 'other'), p_amount, coalesce(p_currency, 'TRY'),
     p_event_id, p_event_type, p_expires_at)
  on conflict (revenuecat_event_id) do nothing;

  if not found then
    return false; -- zaten işlenmiş
  end if;

  -- expires_at YOKSA profili DEĞİŞTİRME — bilmediğimiz bir olay türünden
  -- tahminle bedava/kalıcı premium vermek, hiç güncellememekten daha kötü.
  if p_expires_at is not null then
    update public.profiles set is_premium = (p_expires_at > now()) where id = p_user;
  end if;

  return true;
end;
$$;

grant execute on function public.revenuecat_olay_isle(text, uuid, text, text, timestamptz, numeric, text)
  to service_role;
