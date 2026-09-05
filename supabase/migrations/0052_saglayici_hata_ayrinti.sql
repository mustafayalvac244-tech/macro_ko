-- Sağlayıcı hata gövdesi 200 karakterde kesiliyordu; işe yarayan kısım
-- tam da kesilen yerdeydi.
--
-- ÖLÇÜLEN ARIZA. Kota bitince kaydedilen Groq gövdesi şuydu:
--   "Rate limit reached ... on tokens per day (TPD): Limit 200000, Used 195324,
--    Re..."
-- Cümlenin devamı "Requested N, please try again in Xm" diye sürüyor — yani
-- "ne zaman açılır" bilgisi tam kesilen yerde kalıyordu. Operatör olarak
-- bekleme süresini bilmeden ölçüm planlamak, saatlerin boşa gitmesi demek.
--
-- 500 karakter, sağlayıcıların hata gövdesinin anlamlı kısmını taşımaya yeter
-- ve tablo hâlâ sağlayıcı başına TEK satır olduğu için büyümez.

create or replace function public.ai_durum_yaz(p_saglayici text, p_sonuc text, p_hata text default null)
returns void
language sql
security definer set search_path = public as $$
  insert into public.ai_saglayici_durum (saglayici, son_sonuc, son_zaman, son_basari, son_hata)
  values (
    p_saglayici,
    p_sonuc,
    now(),
    case when p_sonuc = 'ok' then now() else null end,
    case when p_sonuc = 'ok' then null else left(coalesce(p_hata, p_sonuc), 500) end
  )
  on conflict (saglayici) do update set
    son_sonuc = excluded.son_sonuc,
    son_zaman = excluded.son_zaman,
    -- Başarı zamanı yalnız başarıda ilerler; hata onu SIFIRLAMAZ.
    son_basari = coalesce(excluded.son_basari, public.ai_saglayici_durum.son_basari),
    son_hata = excluded.son_hata;
$$;

grant execute on function public.ai_durum_yaz(text, text, text) to service_role;
