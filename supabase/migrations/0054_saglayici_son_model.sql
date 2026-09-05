-- HANGİ MODEL CEVAPLADI? Durum tablosu bunu tutmuyordu.
--
-- NEDEN GEREKLİ OLDU. Groq'ta günlük token tavanı MODEL BAŞINA ayrı; birincinin
-- kotası bitince sıradaki model deneniyor. Bu, asistanın susmasını engelliyor
-- ama yeni bir körlük yaratıyor: rapor "groq: ok" diyor, oysa cevabı hangi
-- modelin verdiği — dolayısıyla o an hangi kalitede çalıştığımız — bilinmiyor.
--
-- Kalite ile kapasiteyi ayırt edemezsek, "asistan bugün kötü cevap verdi"
-- şikâyetini "yedek modele düşmüşüz" ile "model gerçekten kötüleşmiş" arasında
-- ayıramayız. Gün boyu tekrar eden ders: ölçmediğin şeyi tartışamazsın.

alter table public.ai_saglayici_durum add column if not exists son_model text;

create or replace function public.ai_durum_yaz(
  p_saglayici text,
  p_sonuc text,
  p_hata text default null,
  p_model text default null
)
returns void
language sql
security definer set search_path = public as $$
  insert into public.ai_saglayici_durum (saglayici, son_sonuc, son_zaman, son_basari, son_hata, son_model)
  values (
    p_saglayici,
    p_sonuc,
    now(),
    case when p_sonuc = 'ok' then now() else null end,
    case when p_sonuc = 'ok' then null else left(coalesce(p_hata, p_sonuc), 500) end,
    p_model
  )
  on conflict (saglayici) do update set
    son_sonuc = excluded.son_sonuc,
    son_zaman = excluded.son_zaman,
    -- Başarı zamanı yalnız başarıda ilerler; hata onu SIFIRLAMAZ.
    son_basari = coalesce(excluded.son_basari, public.ai_saglayici_durum.son_basari),
    son_hata = excluded.son_hata,
    -- Model bilgisi geldiğinde güncellenir; gelmediğinde eski değer korunur
    -- (bilgiyi silmek, hiç tutmamakla aynı kapıya çıkardı).
    son_model = coalesce(excluded.son_model, public.ai_saglayici_durum.son_model);
$$;

grant execute on function public.ai_durum_yaz(text, text, text, text) to service_role;

-- Eski üç parametreli imza, yeni imzayla belirsizlik yaratmasın diye kaldırılır.
drop function if exists public.ai_durum_yaz(text, text, text);
