-- OTURUM/CİHAZ KAYDI — "hesabıma başka biri mi girdi?"
-- ---------------------------------------------------------------------------
-- BULUNAN EKSİK. Uygulamada bir avukatın hesabına KAÇ cihazdan girildiğini
-- görmesinin hiçbir yolu yoktu. Şifresi ele geçirilse (aynı şifreyi başka
-- yerde kullanmış, oltalama, ortak bilgisayarda açık kalmış oturum) bunu
-- fark etmesi imkânsızdı: uygulama sessizce çalışmaya devam ederdi. Bu bir
-- hukuk bürosunda müvekkil dosyalarının tamamı demektir.
--
-- NE YAPAR, NE YAPMAZ — ABARTMADAN:
--   YAPAR: giriş yapan her cihazı listeler, YENİ bir cihaz eklendiğinde
--          kullanıcıyı uyarır, "bu ben değilim" dendiğinde TÜM oturumları
--          kapatma imkânı verir (asıl etkili kontrol budur).
--   YAPMAZ: saldırganı engellemez. Cihaz bilgisini İSTEMCİ gönderir; kötü
--          niyetli bir istemci başka bir cihazın anahtarını taklit edebilir.
--          Bu kayıt bir KİMLİK DOĞRULAMA katmanı DEĞİL, bir FARK ETME
--          aracıdır. Güvenlik sınırı hâlâ Supabase oturum jetonudur.
--   IP/konum TUTULMAZ: PostgREST üzerinden çağrılan bir fonksiyon istemcinin
--          IP'sini göremez (yalnız uç işlevler görebilir). Olmayan bir veriyi
--          varmış gibi göstermektense hiç göstermiyoruz.

create table if not exists public.oturum_cihazlari (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- İstemcinin ürettiği kalıcı rastgele anahtar (SecureStore/localStorage).
  cihaz_anahtari text not null,
  ad text,
  platform text,
  uygulama_surumu text,
  ilk_gorulme timestamptz not null default now(),
  son_gorulme timestamptz not null default now(),
  unique (user_id, cihaz_anahtari)
);

create index if not exists oturum_cihazlari_user_idx
  on public.oturum_cihazlari (user_id, son_gorulme desc);

alter table public.oturum_cihazlari enable row level security;

-- Kullanıcı YALNIZ kendi cihazlarını okur. Yazma/silme doğrudan YOK —
-- her şey aşağıdaki SECURITY DEFINER fonksiyonlardan geçer; aksi hâlde
-- kullanıcı kendi cihaz geçmişini temizleyip izini silebilirdi.
drop policy if exists oturum_cihazlari_read on public.oturum_cihazlari;
create policy oturum_cihazlari_read on public.oturum_cihazlari
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.oturum_cihazlari from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Cihazı bildir. Dönen jsonb:
--   { yeni: boolean, ilk_cihaz: boolean, toplam: int }
-- "yeni" true ise arayüz uyarı gösterir. "ilk_cihaz" ilk kurulumda uyarı
-- çıkmasın diye ayrı: ilk cihazın kendisi şüpheli değildir.
create or replace function public.cihaz_bildir(
  p_anahtar text,
  p_ad text default null,
  p_platform text default null,
  p_surum text default null
)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  kim uuid := auth.uid();
  vardi boolean;
  adet int;
begin
  if kim is null then
    raise exception 'not_authenticated';
  end if;
  -- Anahtar istemciden geliyor; uzunluğu sınırlanıyor ki tablo şişirilemesin.
  if p_anahtar is null or length(p_anahtar) < 8 or length(p_anahtar) > 128 then
    raise exception 'gecersiz_cihaz_anahtari';
  end if;

  select exists(
    select 1 from public.oturum_cihazlari c
    where c.user_id = kim and c.cihaz_anahtari = p_anahtar
  ) into vardi;

  select count(*) into adet from public.oturum_cihazlari c where c.user_id = kim;

  insert into public.oturum_cihazlari (user_id, cihaz_anahtari, ad, platform, uygulama_surumu)
  values (kim, p_anahtar, left(coalesce(p_ad, ''), 80), left(coalesce(p_platform, ''), 20), left(coalesce(p_surum, ''), 20))
  on conflict (user_id, cihaz_anahtari) do update
    set son_gorulme = now(),
        ad = coalesce(nullif(left(coalesce(p_ad, ''), 80), ''), public.oturum_cihazlari.ad),
        uygulama_surumu = coalesce(nullif(left(coalesce(p_surum, ''), 20), ''), public.oturum_cihazlari.uygulama_surumu);

  return jsonb_build_object(
    'yeni', not vardi,
    'ilk_cihaz', adet = 0,
    'toplam', adet + (case when vardi then 0 else 1 end)
  );
end;
$$;
revoke all on function public.cihaz_bildir(text, text, text, text) from public, anon;
grant execute on function public.cihaz_bildir(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cihaz kayıtlarını temizle (kullanıcı "bu ben değilim" dediğinde).
--
-- ÖNEMLİ VE ABARTILMAMASI GEREKEN NOKTA: bu fonksiyon SATIRI siler, OTURUMU
-- KAPATMAZ. Oturumu gerçekten sonlandıran şey istemcideki
-- supabase.auth.signOut({ scope: 'global' }) çağrısıdır — o, kullanıcının
-- TÜM yenileme jetonlarını iptal eder. Arayüz ikisini birlikte yapar;
-- burada tek başına çağrılması yanlış bir güvenlik hissi verirdi.
create or replace function public.cihazlarimi_temizle(p_haric text default null)
returns integer
language plpgsql
security definer set search_path = public as $$
declare
  kim uuid := auth.uid();
  silinen int;
begin
  if kim is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.oturum_cihazlari c
  where c.user_id = kim
    and (p_haric is null or c.cihaz_anahtari <> p_haric);
  get diagnostics silinen = row_count;
  return silinen;
end;
$$;
revoke all on function public.cihazlarimi_temizle(text) from public, anon;
grant execute on function public.cihazlarimi_temizle(text) to authenticated;
