-- ÖDEME KAYDI VE TEKRAR KORUMASI.
--
-- NEDEN. Kontör paketleri satılabiliyor (payment-sheet PaymentIntent üretiyor)
-- ama ödeme onaylandığında bakiyeyi yükleyecek halka yoktu: başarılı bir ödeme
-- karşılıksız kalıyordu. Bu, iş modelinin çalışmadığı anlamına geliyor —
-- kullanıcı parayı ödüyor, kontörü almıyor.
--
-- TEKRAR KORUMASI ŞART. Stripe webhook'u AYNI olayı birden çok kez gönderir:
-- ağ hatası, zaman aşımı ya da 2xx dönmeyen bir yanıt sonrası tekrar dener. Bu
-- bir istisna değil, belgelenmiş normal davranıştır. Tekrar koruması olmadan
-- tek bir ödeme kullanıcıya iki, üç kez kontör yükler; hata para kaybettirir ve
-- SESSİZ olur — kimse "fazla kontör geldi" diye şikâyet etmez.
--
-- Koruma, olay kimliğinin BİRİNCİL ANAHTAR olmasıyla sağlanıyor: yükleme ile
-- kayıt tek işlemde (transaction) yapılır; ikinci kez gelen olayın insert'i
-- çakışır, yükleme hiç çalışmaz.

create table if not exists public.ai_odeme (
  -- Stripe olay kimliği (evt_...). Tekrar korumasının dayanağı.
  event_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  tutar_try numeric(12,4) not null,
  payment_intent text,
  islendi timestamptz not null default now()
);

alter table public.ai_odeme enable row level security;

-- Kullanıcı kendi ödemelerini görebilir; kimse yazamaz (yalnız service_role).
drop policy if exists ai_odeme_read on public.ai_odeme;
create policy ai_odeme_read on public.ai_odeme
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.ai_odeme from authenticated, anon;

/**
 * Onaylanmış bir ödemeyi işler: kaydı yazar ve kontörü yükler.
 *
 * Dönüş: yükleme yapıldıysa yeni bakiye, olay daha önce işlenmişse null.
 * İkisi TEK deyimde bağlı olduğu için ya ikisi olur ya hiçbiri.
 */
create or replace function public.ai_odeme_isle(
  p_event_id text,
  p_user uuid,
  p_tutar numeric,
  p_payment_intent text default null
)
returns numeric
language plpgsql
security definer set search_path = public as $$
declare yeni numeric;
begin
  if p_event_id is null or p_event_id = '' then
    raise exception 'event_id gerekli';
  end if;
  if p_user is null then
    raise exception 'user_id gerekli';
  end if;
  if p_tutar is null or p_tutar <= 0 then
    raise exception 'gecersiz tutar';
  end if;

  -- ON CONFLICT DO NOTHING: ikinci kez gelen olayda hiçbir satır eklenmez ve
  -- aşağıdaki FOUND yanlış olur; yükleme atlanır.
  insert into public.ai_odeme (event_id, user_id, tutar_try, payment_intent)
  values (p_event_id, p_user, p_tutar, p_payment_intent)
  on conflict (event_id) do nothing;

  if not found then
    return null; -- zaten işlenmiş
  end if;

  yeni := public.ai_kontor_yukle(p_user, p_tutar);
  return yeni;
end;
$$;

grant execute on function public.ai_odeme_isle(text, uuid, numeric, text) to service_role;
