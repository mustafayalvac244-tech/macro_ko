-- "AI" KATMANI — 1.499₺/ay, 250 soru + 12 mütalaa. Sayı bazlı kota.
-- ---------------------------------------------------------------------------
-- Diğer ücretli katmanlar (pro/elit) kontör (TL bakiyesi) ile ölçülür. "ai"
-- katmanı BUNU KULLANMAZ — sabit ücrete SAYIYLA dahil bir hak veriyoruz,
-- "bakiyeniz kadar" değil "ayda şu kadar". Kontör mantığıyla karıştırmamak
-- için ayrı bir sayaç: ai_istek zaten her isteği mod'uyla (dilekce/belge/
-- sohbet/mutalaa/kunye) kaydediyordu (bkz. 0056), burada yalnız o kaydı
-- "soru" (mütalaa dışındaki her mod) ve "mütalaa" diye ikiye ayırıp sayıyoruz.
--
-- MÜTALAA NEDEN AYRI SAYILIYOR. Tek istek değil — olayı hukuki sorunlara böl,
-- her birini araştır, sentezle: bir mütalaa bir sohbet sorusunun 4-8 katı
-- token tüketir (bkz. _shared/katman.ts > AI_SORU_LIMIT notu). Tek kotaya
-- karıştırmak, biri ayda 250 mütalaa çekerse maliyeti öngörülemez yapardı.
--
-- KUSURLU/İADE EDİLEN İSTEKLER SAYILMAZ — ai_istek.musteriye_yazildi zaten
-- bu ayrımı 0056'da yapıyor: kusurlu bir çıktı (yarım dilekçe, eksik bölüm)
-- kullanıcının hakkından düşülmüyordu; aynı ilke burada da geçerli olmalı,
-- yoksa bizim hatamızın bedelini avukatın aylık kotası öder.
create or replace function public.ai_mod_sayaci(p_user uuid, p_ay text)
returns table(soru bigint, mutalaa bigint)
language sql
stable security definer set search_path = public as $$
  select
    count(*) filter (where mod <> 'mutalaa') as soru,
    count(*) filter (where mod = 'mutalaa') as mutalaa
  from public.ai_istek
  where user_id = p_user
    and musteriye_yazildi = true
    and iade_edildi = false
    and gun like p_ay || '-%'
$$;

grant execute on function public.ai_mod_sayaci(uuid, text) to service_role;

-- RevenueCat OLAYI HANGİ YETKİYİ (entitlement) VERİYOR — şimdiye kadar
-- revenuecat_olay_isle yalnız "premium" entitlement'ını varsayıp is_premium'u
-- güncelliyordu. Artık İKİ ayrı satılabilir ürün var: temel (399₺, "premium"
-- entitlement'ı) ve AI (1.499₺, "ai" entitlement'ı — RevenueCat panelinde bu
-- isimle kurulacak, bkz. IAP_KURULUM.md). Hangi entitlement'ların bu olayda
-- aktif olduğu RevenueCat'in kendi event.entitlement_ids alanından gelir;
-- biz onu kör biçimde "her satın alma = tam premium" saymak yerine olduğu
-- gibi işliyoruz.
alter table purchases add column if not exists entitlement_ids text[];

-- ESKİ İMZA (7 parametre) DÜŞÜRÜLÜYOR. Yeni parametre (p_entitlement_ids)
-- ORTAYA eklendiği için "create or replace" bunu YERİNE KOYMAZ, AYRI BİR
-- AŞIRI YÜKLEME (overload) olarak bırakır — eski imza edge fonksiyonundan
-- artık hiç çağrılmasa da veritabanında sessizce kalır ve biri yanlışlıkla
-- çağırırsa entitlement'ları hiç işlemeden eski (yanlış) davranışa döner.
drop function if exists public.revenuecat_olay_isle(text, uuid, text, text, timestamptz, numeric, text);

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
    (user_id, product, platform, amount, currency, revenuecat_event_id, event_type, expires_at, entitlement_ids)
  values
    (p_user, 'premium', coalesce(p_platform, 'other'), p_amount, coalesce(p_currency, 'TRY'),
     p_event_id, p_event_type, p_expires_at, p_entitlement_ids)
  on conflict (revenuecat_event_id) do nothing;

  if not found then
    return false; -- zaten işlenmiş
  end if;

  -- expires_at YOKSA hiçbir yetkiyi değiştirme — bilmediğimiz bir olay
  -- türünden tahminle premium/ai vermek, hiç güncellememekten daha kötü.
  if p_expires_at is not null then
    if 'premium' = any(p_entitlement_ids) then
      update public.profiles set is_premium = (p_expires_at > now()) where id = p_user;
    end if;
    -- "ai" entitlement'ı süresi geçince ai_tier'ı GERİYE ('baslangic') alır —
    -- yalnız yükseltmiyoruz, süre dolunca gerçekten indiriyoruz; aksi hâlde
    -- iptal/expire eden bir AI aboneliği sonsuza dek Claude'a erişim bırakırdı.
    if 'ai' = any(p_entitlement_ids) then
      update public.profiles
        set ai_tier = case when p_expires_at > now() then 'ai' else 'baslangic' end
        where id = p_user;
    end if;
  end if;

  return true;
end;
$$;

grant execute on function public.revenuecat_olay_isle(text, uuid, text, text, timestamptz, text[], numeric, text)
  to service_role;
