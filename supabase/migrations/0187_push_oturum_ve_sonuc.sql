-- 09.10.2026 — PUSH: OTURUMU BİTEN CİHAZA GÖNDERİLMEZ + GÖNDERİM SONUCU OKUNUR
-- (bkz. 0161_push_bildirim; 09.10.2026 denetimi).
-- ===========================================================================
--
-- 1) ÇIKIŞ YAPAN CİHAZ HEDEFTE KALIYORDU (kodla doğrulandı).
--    push_cihaz satırını yalnız istemci siliyordu: çıkışta, oturum kapanmadan,
--    bellekteki adresle (src/lib/notifications.ts pushAdresiniSil). İki yolda
--    silinemiyordu:
--      • oturum SUNUCUDAN düşürülünce. Varsayılan signOut() kullanıcının TÜM
--        oturumlarını kapatır (@supabase/auth-js 2.110: scope 'global');
--        başka cihazdan "tüm oturumları kapat" da öyle. O cihaz SIGNED_OUT
--        alır ama artık kimliği olmadığı için kendi satırını silemez.
--      • adres bellekte yoksa (açılıştaki kayıt ağ yüzünden düştüyse).
--    Sonuç: çıkış yapılmış telefona o hesabın duyuruları gitmeye devam ediyordu.
--
--    ÇÖZÜM: kayıtta oturum kimliği (JWT `session_id`) tutulur; gönderim ve
--    "kaç cihaza ulaşılır" sayısı yalnız oturumu auth.sessions'ta HÂLÂ duran
--    cihazları sayar. Kaynak (Supabase belgesi, auth/sessions): her erişim
--    jetonunda session_id vardır; auth.sessions'ta karşılığı yoksa kullanıcı
--    çıkış yapmıştır; çıkışta ilgili oturum satırları silinir.
--    Oturum kimliği OLMAYAN eski satırlar (bu göçten önce kaydolmuş) hedefte
--    KALIR: uygulama her açılışta adresi yeniden kaydettiği için zamanla dolar.
--    Dışlansalardı, uygulamayı bir daha açmayan kullanıcıya ulaşma amacı (0161)
--    boşa giderdi.
--
-- 2) "GÖNDERİLDİ" SAYISI KUYRUK SAYISIYDI (kodla doğrulandı).
--    admin_bildirim_gonder isteği pg_net kuyruğuna bırakıp hemen dönüyor;
--    panel bu sayıyı "Gönderildi: X kişi, Y cihaz" diye gösteriyordu. Expo'nun
--    yanıtı (bilet) ve teslim makbuzu hiçbir yerde okunmuyordu.
--
--    admin_bildirim_sonuc(p_gonderim_id): (null → son gönderim)
--      • BİLETLER: net._http_response'tan okunur. pg_net yanıtı TTL kadar tutar
--        (canlıda pg_net.ttl = '6 hours', 09.10.2026 ölçüldü); bütün yanıtlar
--        geldiğinde özet bildirim_gonderim'e yazılır, sonra silinse de kalır.
--      • MAKBUZLAR: Expo belgesi makbuzlara ~15 dk sonra bakılmasını söylüyor ve
--        24 saat tuttuğunu yazıyor. Gönderimden 15 dk sonraki ilk okumada
--        /push/getReceipts istenir; sonraki okumada özetlenir.
--      • Yalnız hata KODU döner (details.error). Hata metni (message) cihaz
--        adresini içerebildiği için okunmaz; cihaz adresi hiçbir yerde dönmez.
--
-- NE YAPMAZ.
--   • Makbuz "ok" = Expo bildirimi Apple/Google'a teslim etti. Telefonda
--     GÖRÜNDÜĞÜNÜ göstermez.
--   • Android'de FCM yapılandırması (app.json android.googleServicesFile) yok;
--     Android cihazlar bugün adres alamıyor olabilir. Bu göç onu çözemez.
--   • Okuma fonksiyonu yan etkilidir (makbuz isteği atar, özeti yazar) — bu
--     yüzden yalnız yönetici çağırır ve istemcide "mutation" olarak durur.

alter table public.push_cihaz add column if not exists oturum_id uuid;

alter table public.bildirim_gonderim add column if not exists bilet_ozet jsonb;
alter table public.bildirim_gonderim add column if not exists makbuz_idleri text[] not null default '{}';
alter table public.bildirim_gonderim add column if not exists makbuz_istek_idleri bigint[] not null default '{}';
alter table public.bildirim_gonderim add column if not exists makbuz_ozet jsonb;

-- ---------------------------------------------------------------------------
-- Kayıt: oturum kimliği de yazılır.
create or replace function public.push_cihaz_kaydet(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_oturum_metni text := auth.jwt() ->> 'session_id';
  v_oturum       uuid;
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
  -- Biçimi tutmayan değer yazılmaz (null kalır = "oturumu bilinmiyor").
  if v_oturum_metni ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_oturum := v_oturum_metni::uuid;
  end if;

  insert into public.push_cihaz (token, user_id, platform, oturum_id)
  values (p_token, auth.uid(), p_platform, v_oturum)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        oturum_id = excluded.oturum_id,
        son_goruldu = now();
end;
$function$;

-- ---------------------------------------------------------------------------
-- Özet: yalnız ULAŞILABİLİR cihazlar (oturumu süren ya da oturumu bilinmeyen).
create or replace function public.admin_bildirim_ozet()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sonuc json;
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;
  select json_build_object('cihaz', count(*), 'kisi', count(distinct c.user_id))
    into v_sonuc
  from public.push_cihaz c
  where c.oturum_id is null
     or exists (
       select 1 from auth.sessions s
       where s.id = c.oturum_id and (s.not_after is null or s.not_after > now())
     );
  return v_sonuc;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Gönderim: 0161 ile aynı, tek fark oturumu biten cihazın atlanması.
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
  join hedef h on h.id = c.user_id
  where c.oturum_id is null
     or exists (
       select 1 from auth.sessions o
       where o.id = c.oturum_id and (o.not_after is null or o.not_after > now())
     );

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

-- ---------------------------------------------------------------------------
-- Sonuç: biletler + makbuzlar. Dönen json:
--   { gonderim_id, olusturuldu, hedef_kisi, hedef_cihaz,
--     bilet:  { istek, yanitsiz, silinmis, istek_hatasi, istek_hata_kodlari, kabul, ret, ret_kodlari },
--     makbuz: { durum: yok|erken|istendi|bekliyor|eksik|okundu, ok, hata, hata_kodlari, makbuzsuz } }
create or replace function public.admin_bildirim_sonuc(p_gonderim_id bigint default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  g              public.bildirim_gonderim%rowtype;
  v_ttl          interval;
  v_istek        bigint;
  v_durum_kodu   integer;
  v_icerik       text;
  v_zaman_asimi  boolean;
  v_govde        jsonb;
  v_oge          jsonb;
  v_kod          text;
  -- biletler
  v_yanitsiz     integer := 0;
  v_istek_hata   integer := 0;
  v_istek_kod    jsonb := '{}'::jsonb;
  v_kabul        integer := 0;
  v_ret          integer := 0;
  v_ret_kod      jsonb := '{}'::jsonb;
  v_makbuz_id    text[] := '{}';
  v_bilet        jsonb;
  -- makbuzlar
  v_m_durum      text := 'yok';
  v_m_yanitsiz   integer := 0;
  v_m_istek_hata integer := 0;
  v_m_gelen      integer := 0;
  v_m_ok         integer := 0;
  v_m_hata       integer := 0;
  v_m_kod        jsonb := '{}'::jsonb;
  v_istekler     bigint[] := '{}';
  v_makbuz       jsonb;
  i              integer;
begin
  if not coalesce((select pr.is_admin from public.profiles pr where pr.id = auth.uid()), false) then
    raise exception 'not_admin';
  end if;

  if p_gonderim_id is null then
    select * into g from public.bildirim_gonderim order by id desc limit 1;
  else
    select * into g from public.bildirim_gonderim where id = p_gonderim_id;
  end if;
  if not found then
    return json_build_object('gonderim_id', null);
  end if;

  begin
    v_ttl := coalesce(nullif(current_setting('pg_net.ttl', true), '')::interval, interval '6 hours');
  exception when others then
    v_ttl := interval '6 hours';
  end;

  -- 1) BİLETLER (POST /push/send yanıtı: { data: [ {status, id | details.error} ] }).
  if g.bilet_ozet is null then
    foreach v_istek in array g.istek_idleri loop
      select r.status_code, r.content, coalesce(r.timed_out, false)
        into v_durum_kodu, v_icerik, v_zaman_asimi
      from net._http_response r
      where r.id = v_istek;
      if not found then
        v_yanitsiz := v_yanitsiz + 1;
        continue;
      end if;

      begin
        v_govde := v_icerik::jsonb;
      exception when others then
        v_govde := null;
      end;

      if v_zaman_asimi or v_durum_kodu is null or v_durum_kodu >= 300
         or jsonb_typeof(v_govde -> 'data') is distinct from 'array' then
        v_istek_hata := v_istek_hata + 1;
        v_kod := coalesce(v_govde #>> '{errors,0,code}',
                          case when v_zaman_asimi then 'zaman_asimi' else 'http_' || coalesce(v_durum_kodu::text, 'yok') end);
        v_istek_kod := v_istek_kod || jsonb_build_object(v_kod, coalesce((v_istek_kod ->> v_kod)::integer, 0) + 1);
        continue;
      end if;

      for v_oge in select e from jsonb_array_elements(v_govde -> 'data') as e loop
        if v_oge ->> 'status' = 'ok' then
          v_kabul := v_kabul + 1;
          if v_oge ->> 'id' is not null then
            v_makbuz_id := v_makbuz_id || (v_oge ->> 'id');
          end if;
        else
          v_ret := v_ret + 1;
          v_kod := coalesce(v_oge #>> '{details,error}', 'bilinmiyor');
          v_ret_kod := v_ret_kod || jsonb_build_object(v_kod, coalesce((v_ret_kod ->> v_kod)::integer, 0) + 1);
        end if;
      end loop;
    end loop;

    v_bilet := jsonb_build_object(
      'istek', coalesce(array_length(g.istek_idleri, 1), 0),
      'yanitsiz', v_yanitsiz,
      'silinmis', v_yanitsiz > 0 and now() > g.olusturuldu + v_ttl,
      'istek_hatasi', v_istek_hata,
      'istek_hata_kodlari', v_istek_kod,
      'kabul', v_kabul,
      'ret', v_ret,
      'ret_kodlari', v_ret_kod
    );

    -- Bütün yanıtlar geldiyse özet kalıcı yazılır: pg_net yanıtı TTL'de siler.
    if v_yanitsiz = 0 then
      update public.bildirim_gonderim
         set bilet_ozet = v_bilet,
             makbuz_idleri = v_makbuz_id
       where id = g.id
      returning * into g;
    end if;
  else
    v_bilet := g.bilet_ozet;
  end if;

  -- 2) MAKBUZLAR (POST /push/getReceipts yanıtı: { data: { <id>: {status, details.error} } }).
  if g.makbuz_ozet is not null then
    v_m_durum := 'okundu';
  elsif g.bilet_ozet is null or coalesce(array_length(g.makbuz_idleri, 1), 0) = 0 then
    v_m_durum := 'yok';
  elsif coalesce(array_length(g.makbuz_istek_idleri, 1), 0) = 0 then
    if now() < g.olusturuldu + interval '15 minutes' then
      v_m_durum := 'erken';
    else
      -- Expo istek başına en çok 1000 makbuz kimliği kabul ediyor (PUSH_TOO_MANY_RECEIPTS).
      for i in 1 .. array_length(g.makbuz_idleri, 1) by 1000 loop
        v_istekler := v_istekler || net.http_post(
          url := 'https://exp.host/--/api/v2/push/getReceipts',
          body := jsonb_build_object('ids', to_jsonb(g.makbuz_idleri[i : i + 999])),
          headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
          timeout_milliseconds := 30000
        );
      end loop;
      update public.bildirim_gonderim set makbuz_istek_idleri = v_istekler where id = g.id;
      v_m_durum := 'istendi';
    end if;
  else
    foreach v_istek in array g.makbuz_istek_idleri loop
      select r.status_code, r.content, coalesce(r.timed_out, false)
        into v_durum_kodu, v_icerik, v_zaman_asimi
      from net._http_response r
      where r.id = v_istek;
      if not found then
        v_m_yanitsiz := v_m_yanitsiz + 1;
        continue;
      end if;

      begin
        v_govde := v_icerik::jsonb;
      exception when others then
        v_govde := null;
      end;

      if v_zaman_asimi or v_durum_kodu is null or v_durum_kodu >= 300
         or jsonb_typeof(v_govde -> 'data') is distinct from 'object' then
        v_m_istek_hata := v_m_istek_hata + 1;
        continue;
      end if;

      for v_makbuz in select value from jsonb_each(v_govde -> 'data') loop
        v_m_gelen := v_m_gelen + 1;
        if v_makbuz ->> 'status' = 'ok' then
          v_m_ok := v_m_ok + 1;
        else
          v_m_hata := v_m_hata + 1;
          v_kod := coalesce(v_makbuz #>> '{details,error}', 'bilinmiyor');
          v_m_kod := v_m_kod || jsonb_build_object(v_kod, coalesce((v_m_kod ->> v_kod)::integer, 0) + 1);
        end if;
      end loop;
    end loop;

    if v_m_yanitsiz > 0 then
      -- İstek yanıtı henüz gelmedi; TTL'i geçtiyse bir daha gelmez → yeniden iste.
      if now() > g.olusturuldu + v_ttl then
        update public.bildirim_gonderim set makbuz_istek_idleri = '{}' where id = g.id;
      end if;
      v_m_durum := 'bekliyor';
    elsif v_m_istek_hata = 0
          and (v_m_gelen >= array_length(g.makbuz_idleri, 1) or now() > g.olusturuldu + interval '24 hours') then
      update public.bildirim_gonderim
         set makbuz_ozet = jsonb_build_object(
               'ok', v_m_ok,
               'hata', v_m_hata,
               'hata_kodlari', v_m_kod,
               'makbuzsuz', greatest(array_length(g.makbuz_idleri, 1) - v_m_gelen, 0))
       where id = g.id
      returning * into g;
      v_m_durum := 'okundu';
    else
      -- Bir kısmı henüz hazır değil ya da istek düştü: sonraki okuma yeniden ister.
      update public.bildirim_gonderim set makbuz_istek_idleri = '{}' where id = g.id;
      v_m_durum := 'eksik';
    end if;
  end if;

  return json_build_object(
    'gonderim_id', g.id,
    'olusturuldu', g.olusturuldu,
    'hedef_kisi',  g.hedef_kisi,
    'hedef_cihaz', g.hedef_cihaz,
    'bilet',       v_bilet,
    'makbuz',      case
                     when g.makbuz_ozet is not null then g.makbuz_ozet || jsonb_build_object('durum', 'okundu')
                     else jsonb_build_object(
                       'durum', v_m_durum,
                       'ok', v_m_ok,
                       'hata', v_m_hata,
                       'hata_kodlari', v_m_kod,
                       'makbuzsuz', greatest(coalesce(array_length(g.makbuz_idleri, 1), 0) - v_m_gelen, 0))
                   end
  );
end;
$function$;

revoke execute on function public.push_cihaz_kaydet(text, text) from public, anon;
revoke execute on function public.admin_bildirim_ozet() from public, anon;
revoke execute on function public.admin_bildirim_gonder(text, text, integer) from public, anon;
revoke execute on function public.admin_bildirim_sonuc(bigint) from public, anon;
grant execute on function public.push_cihaz_kaydet(text, text) to authenticated;
grant execute on function public.admin_bildirim_ozet() to authenticated;
grant execute on function public.admin_bildirim_gonder(text, text, integer) to authenticated;
grant execute on function public.admin_bildirim_sonuc(bigint) to authenticated;
