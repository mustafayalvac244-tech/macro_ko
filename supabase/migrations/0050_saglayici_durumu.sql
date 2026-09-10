-- SAĞLAYICI DURUMU — yoklama değil, GERÇEK isteklerin sonucu.
--
-- ÖLÇÜLEN ARIZA. ai-saglik ucu "ayakta: [groq, gemini], yedekli: true" diyordu;
-- aynı anda gerçek bir dilekçe isteği 429 daily_quota alıyordu. Sebep: sağlık
-- yoklaması 1 token'lık bir istek gönderiyor ve Groq'un GÜNLÜK TOKEN tavanı
-- (TPD) dolmuşken bile o küçük istek geçebiliyor. Yani kontrol, hizmet
-- veremeyen bir sağlayıcıyı "ayakta" gösteriyordu.
--
-- Yalan söyleyen bir sağlık kontrolü, hiç olmamasından kötüdür: operatör
-- "her şey yolunda" görüp müşteriden öğrenir.
--
-- Çözüm: gerçek çağrıların sonucu kaydedilir ve sağlık raporu bunu da söyler.
-- Sağlayıcı başına TEK satır tutulur (upsert) — ölçüm tablosu değil, durum
-- tablosudur; büyümez ve gizli veri taşımaz.

create table if not exists public.ai_saglayici_durum (
  saglayici text primary key,
  son_sonuc text not null,
  son_zaman timestamptz not null default now(),
  -- Son BAŞARILI çağrının zamanı ayrı tutulur: "en son ne zaman gerçekten
  -- cevap verebildi" sorusu, "en son ne oldu"dan daha bilgilendiricidir.
  son_basari timestamptz,
  son_hata text
);

alter table public.ai_saglayici_durum enable row level security;

-- Operasyonel bilgi; kişisel veri yok. Oturum açmış kullanıcı okuyabilir
-- (yönetici panelinde gösteriliyor), yazma yalnız sunucu tarafındadır.
drop policy if exists ai_saglayici_durum_read on public.ai_saglayici_durum;
create policy ai_saglayici_durum_read on public.ai_saglayici_durum
  for select to authenticated using (true);

revoke insert, update, delete on public.ai_saglayici_durum from authenticated, anon;

/**
 * Bir çağrının sonucunu işler. Edge işlevinden service_role ile çağrılır.
 * p_sonuc: 'ok' | 'daily_quota' | 'rate_limit' | 'upstream'
 */
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
    case when p_sonuc = 'ok' then null else left(coalesce(p_hata, p_sonuc), 200) end
  )
  on conflict (saglayici) do update set
    son_sonuc = excluded.son_sonuc,
    son_zaman = excluded.son_zaman,
    -- Başarı zamanı yalnız başarıda ilerler; hata onu SIFIRLAMAZ, çünkü
    -- "en son ne zaman çalıştı" bilgisi arıza sırasında en çok gereken şeydir.
    son_basari = coalesce(excluded.son_basari, public.ai_saglayici_durum.son_basari),
    son_hata = excluded.son_hata;
$$;

grant execute on function public.ai_durum_yaz(text, text, text) to service_role;
