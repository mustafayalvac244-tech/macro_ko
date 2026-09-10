-- AI KONTÖRÜ — ücretli modeli soru başına satabilmek için ön ödemeli bakiye.
--
-- NEDEN AYLIK TAVAN DEĞİL DE KONTÖR. Bugüne kadar ücretli katmanlarda aylık bir
-- TL tavanı vardı (ai katmanı 1.250 TL). Tavan, "batmayı" engeller ama iki şeyi
-- çözmez:
--   • Az kullanan çok ödüyor. Ayda üç dilekçe yazan avukat, otuz dilekçe
--     yazanla aynı parayı veriyor.
--   • Kapasite sözü veremiyoruz. Ücretsiz sağlayıcının günlük tavanı TÜM
--     kullanıcılar için ortak ve 200.000 token; bir dilekçe ~7.000-8.000 token
--     yiyor. Yani "sınırsız" demek, tutamayacağımız bir söz olurdu.
-- Kontör ikisini de çözer: kullandığın kadar ödersin, biz de ancak sattığımız
-- kadar hizmet vermeyi taahhüt ederiz.
--
-- BİRİM TL'DİR, TOKEN DEĞİL. Kullanıcı token'ı bilmek zorunda değil; sattığımız
-- şey "20 dilekçelik paket" gibi anlaşılır olmalı. Token sayısı yine yanıtta
-- gösteriliyor (şeffaflık), ama bakiye paradan düşüyor.
--
-- GÜVENLİK: bakiyeyi yalnız sunucu değiştirir. Kullanıcı kendi bakiyesini
-- OKUYABİLİR (ekranda göstermek için), yazamaz. Aksi hâlde herkes kendine
-- kontör yazardı.

create table if not exists public.ai_kontor (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Kalan bakiye (TL). Negatife düşebilir: bir istek başlarken bakiye yeterliydi
  -- ama gerçek maliyet tahminden yüksek çıktıysa farkı yutmak, isteği yarıda
  -- kesip kullanıcıya yarım dilekçe vermekten iyidir.
  bakiye_try numeric(12,4) not null default 0,
  toplam_yuklenen_try numeric(12,4) not null default 0,
  toplam_harcanan_try numeric(12,4) not null default 0,
  guncellendi timestamptz not null default now()
);

alter table public.ai_kontor enable row level security;

drop policy if exists ai_kontor_read on public.ai_kontor;
create policy ai_kontor_read on public.ai_kontor
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.ai_kontor from authenticated, anon;

/**
 * Kontör yükler (ödeme onaylandıktan sonra sunucudan çağrılır).
 */
create or replace function public.ai_kontor_yukle(p_user uuid, p_tutar numeric)
returns numeric
language plpgsql
security definer set search_path = public as $$
declare yeni numeric;
begin
  if p_tutar is null or p_tutar <= 0 then
    raise exception 'gecersiz tutar';
  end if;
  insert into public.ai_kontor (user_id, bakiye_try, toplam_yuklenen_try, guncellendi)
  values (p_user, p_tutar, p_tutar, now())
  on conflict (user_id) do update set
    bakiye_try = public.ai_kontor.bakiye_try + excluded.bakiye_try,
    toplam_yuklenen_try = public.ai_kontor.toplam_yuklenen_try + excluded.toplam_yuklenen_try,
    guncellendi = now()
  returning bakiye_try into yeni;
  return yeni;
end;
$$;

/**
 * Harcamayı bakiyeden düşer. Tek deyimde yapılır: iki eşzamanlı istek aynı
 * bakiyeyi iki kez harcayamasın.
 */
create or replace function public.ai_kontor_dus(p_user uuid, p_tutar numeric)
returns numeric
language sql
security definer set search_path = public as $$
  insert into public.ai_kontor (user_id, bakiye_try, toplam_harcanan_try, guncellendi)
  values (p_user, -p_tutar, p_tutar, now())
  on conflict (user_id) do update set
    bakiye_try = public.ai_kontor.bakiye_try - p_tutar,
    toplam_harcanan_try = public.ai_kontor.toplam_harcanan_try + p_tutar,
    guncellendi = now()
  returning bakiye_try;
$$;

grant execute on function public.ai_kontor_yukle(uuid, numeric) to service_role;
grant execute on function public.ai_kontor_dus(uuid, numeric) to service_role;
