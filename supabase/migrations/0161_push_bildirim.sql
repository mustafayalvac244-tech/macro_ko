-- 30.09.2026 — UYGULAMA BİLDİRİMİ (push). Ürün sahibi: "uygulamadan bildirim
-- gönder", "yaz, OTA ile yapalım".
--
-- NEDEN. Sunucudan kullanıcıya ulaşmanın hiçbir yolu yoktu: expo-notifications
-- yalnız telefonda kurulan hatırlatmalar için kullanılıyordu, hiçbir cihazın
-- bildirim adresi (Expo push token) kaydedilmiyordu. Kayıt olup uygulamayı
-- bir daha açmayan kullanıcıya "deneme hakların tanımlandı" demek mümkün
-- değildi.
--
-- NASIL.
--  • push_cihaz: cihaz başına bir satır (token birincil anahtar). Aynı telefonda
--    başka hesapla girilirse satır yeni kullanıcıya geçer (on conflict).
--    Çıkışta istemci kendi satırını siler; hesap silinince cascade siler.
--  • push_cihaz_kaydet / push_cihaz_sil: istemcinin tek yazma yolu.
--  • admin_bildirim_gonder: yalnız yönetici. Expo'nun push servisine pg_net ile
--    100'lük paketler hâlinde gönderir (Expo'nun istek başı sınırı 100 mesaj).
--    Yanıtlar (bilet/hata) net._http_response'a düşer; gönderim kaydı
--    bildirim_gonderim'de istek kimlikleriyle tutulur, sonuç oradan okunur.
--  • admin_bildirim_ozet: panelde "kaç cihaza ulaşılabilir" sayısı.
--
-- NE YAPMAZ. iOS'ta bildirimin telefona düşmesi, Expo hesabında Apple push
-- anahtarı (APNs) tanımlı olmasını da ister; bu göç onu kuramaz. Expo bileti
-- "InvalidCredentials" dönerse eksik olan odur.
--
-- KİŞİSEL VERİ. Token bir cihaz tanımlayıcısıdır; mesaj metni yöneticinin
-- yazdığı duyurudur, müvekkil verisi içermemelidir (panelde uyarı var).

create table if not exists public.push_cihaz (
  token        text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  platform     text not null check (platform in ('ios', 'android')),
  olusturuldu  timestamptz not null default now(),
  son_goruldu  timestamptz not null default now()
);

create index if not exists push_cihaz_user_idx on public.push_cihaz (user_id);

alter table public.push_cihaz enable row level security;

drop policy if exists "push_cihaz own" on public.push_cihaz;
create policy "push_cihaz own" on public.push_cihaz for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.push_cihaz from anon;

create table if not exists public.bildirim_gonderim (
  id           bigint generated always as identity primary key,
  gonderen     uuid references auth.users (id) on delete set null,
  baslik       text not null,
  metin        text not null,
  hedef        text not null,
  hedef_kisi   integer not null default 0,
  hedef_cihaz  integer not null default 0,
  istek_idleri bigint[] not null default '{}',
  olusturuldu  timestamptz not null default now()
);

-- Politika YOK — bilerek: yalnız security definer fonksiyonlar okur/yazar.
alter table public.bildirim_gonderim enable row level security;
revoke all on public.bildirim_gonderim from anon, authenticated;

create or replace function public.push_cihaz_kaydet(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[^\]]{1,200}\]$' then
    raise exception 'gecersiz_token';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'gecersiz_platform';
  end if;

  insert into public.push_cihaz (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        son_goruldu = now();
end;
$function$;

create or replace function public.push_cihaz_sil(p_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.push_cihaz where token = p_token and user_id = auth.uid();
end;
$function$;

create or replace function public.admin_bildirim_ozet()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  return json_build_object(
    'cihaz', (select count(*) from public.push_cihaz),
    'kisi',  (select count(distinct user_id) from public.push_cihaz)
  );
end;
$function$;

-- p_son_kayit: null → bildirim adresi olan HERKES; n → en son kayıt olan n
-- kullanıcı (gönderen yönetici ve @vekilpro.app iç/demo hesapları hariç).
create or replace function public.admin_bildirim_gonder(p_baslik text, p_metin text, p_son_kayit integer default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_baslik   text := trim(coalesce(p_baslik, ''));
  v_metin    text := trim(coalesce(p_metin, ''));
  v_tokenlar text[];
  v_kisi     integer;
  v_paket    jsonb;
  v_istekler bigint[] := '{}';
  v_hedef    text;
  v_id       bigint;
  i          integer;
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  if length(v_baslik) = 0 or length(v_metin) = 0 then
    raise exception 'bos_mesaj';
  end if;
  if length(v_baslik) > 100 or length(v_metin) > 500 then
    raise exception 'mesaj_uzun';
  end if;
  if p_son_kayit is not null and (p_son_kayit < 1 or p_son_kayit > 1000) then
    raise exception 'gecersiz_hedef';
  end if;

  v_hedef := case when p_son_kayit is null then 'herkes' else 'son_' || p_son_kayit end;

  with hedef as (
    select u.id
    from auth.users u
    where p_son_kayit is null
    union
    select s.id
    from (
      select u.id
      from auth.users u
      where p_son_kayit is not null
        and u.id <> auth.uid()
        and coalesce(u.email, '') not ilike '%@vekilpro.app'
      order by u.created_at desc
      limit p_son_kayit
    ) s
  )
  select array_agg(c.token order by c.token), count(distinct c.user_id)
    into v_tokenlar, v_kisi
  from public.push_cihaz c
  join hedef h on h.id = c.user_id;

  if v_tokenlar is not null then
    for i in 1 .. array_length(v_tokenlar, 1) by 100 loop
      select jsonb_agg(jsonb_build_object(
               'to', t,
               'title', v_baslik,
               'body', v_metin,
               'sound', 'default',
               'channelId', 'legal-deadlines'))
        into v_paket
      from unnest(v_tokenlar[i : i + 99]) as t;

      v_istekler := v_istekler || net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := v_paket,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
        timeout_milliseconds := 30000
      );
    end loop;
  end if;

  insert into public.bildirim_gonderim (gonderen, baslik, metin, hedef, hedef_kisi, hedef_cihaz, istek_idleri)
  values (auth.uid(), v_baslik, v_metin, v_hedef, coalesce(v_kisi, 0),
          coalesce(array_length(v_tokenlar, 1), 0), v_istekler)
  returning id into v_id;

  return json_build_object(
    'gonderim_id', v_id,
    'hedef_kisi',  coalesce(v_kisi, 0),
    'hedef_cihaz', coalesce(array_length(v_tokenlar, 1), 0)
  );
end;
$function$;

revoke execute on function public.push_cihaz_kaydet(text, text) from public, anon;
revoke execute on function public.push_cihaz_sil(text) from public, anon;
revoke execute on function public.admin_bildirim_ozet() from public, anon;
revoke execute on function public.admin_bildirim_gonder(text, text, integer) from public, anon;
grant execute on function public.push_cihaz_kaydet(text, text) to authenticated;
grant execute on function public.push_cihaz_sil(text) to authenticated;
grant execute on function public.admin_bildirim_ozet() to authenticated;
grant execute on function public.admin_bildirim_gonder(text, text, integer) to authenticated;
