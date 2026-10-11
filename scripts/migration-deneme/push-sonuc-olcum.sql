-- PUSH OTURUM + GÖNDERİM SONUCU ÖLÇÜMÜ (0187)
-- ---------------------------------------------------------------------------
-- Bu dosya iddiayı SINAR, anlatmaz. Her satır "GEÇTİ" ya da "KALDI" yazar.
--
-- NE DEĞİLDİR. Expo'ya HİÇBİR istek gitmez: net.http_post taklidi isteği bir
-- tabloya yazar (supabase-taklit.sql) ve "Expo yanıtları" bu dosyada ELLE
-- yazılır. Yani ölçülen şey bizim ayrıştırmamızdır; Expo'nun gerçek yanıt
-- biçimini ÖLÇMEZ — yanıt biçimi Expo belgesinden alındı, canlı yanıtla
-- karşılaştırılmadı. Gerçek push gönderilmedi.
--
-- Kapsam: oturumu bitmiş cihaz hedeften düşer, oturum kimliği JWT'den yazılır,
-- bilet/makbuz özeti doğru sayılır, özet TTL sonrası silinen yanıta rağmen
-- kalır, yönetici olmayan okuyamaz.

\set ON_ERROR_STOP on
\pset pager off

-- Kullanıcılar: Y yönetici, B oturumu süren + süresi dolmuş + eski satırı olan, C oturumu silinmiş.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'y@ornek.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@ornek.test'),
  ('00000000-0000-0000-0000-00000000000c', 'c@ornek.test');
insert into public.profiles (id, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', true),
  ('00000000-0000-0000-0000-00000000000b', false),
  ('00000000-0000-0000-0000-00000000000c', false);

-- Oturumlar: b1 sürüyor, b2 süresi dolmuş. C'nin oturumu auth.sessions'ta YOK (çıkış yapmış).
insert into auth.sessions (id, user_id, not_after) values
  ('11111111-1111-1111-1111-1111111111b1', '00000000-0000-0000-0000-00000000000b', null),
  ('11111111-1111-1111-1111-1111111111b2', '00000000-0000-0000-0000-00000000000b', now() - interval '1 hour');

-- Cihazlar. Yalnız b1 (oturum sürüyor) ve eski (oturum kimliği yok) ulaşılabilir olmalı.
insert into public.push_cihaz (token, user_id, platform, oturum_id) values
  ('ExponentPushToken[b1]',   '00000000-0000-0000-0000-00000000000b', 'ios', '11111111-1111-1111-1111-1111111111b1'),
  ('ExponentPushToken[b2]',   '00000000-0000-0000-0000-00000000000b', 'ios', '11111111-1111-1111-1111-1111111111b2'),
  ('ExponentPushToken[c1]',   '00000000-0000-0000-0000-00000000000c', 'ios', '11111111-1111-1111-1111-1111111111c1'),
  ('ExponentPushToken[eski]', '00000000-0000-0000-0000-00000000000c', 'ios', null);

-- Yönetici olarak çağır.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset

select case when (public.admin_bildirim_ozet()::jsonb ->> 'cihaz') = '2' then 'GEÇTİ' else 'KALDI' end
  || '  özet yalnız ulaşılabilir cihazı sayar (b1 + oturum kimliksiz eski; çıkmış/süresi dolmuş sayılmaz)';

-- Gönderim: yalnız ulaşılabilir iki adres Expo paketine girer.
select (public.admin_bildirim_gonder('Başlık', 'Metin', null)::jsonb ->> 'gonderim_id')::bigint as gid \gset

select case when (select hedef_cihaz from public.bildirim_gonderim where id = :gid) = 2 then 'GEÇTİ' else 'KALDI' end
  || '  gönderim kaydı 2 cihaz yazar';

select case when (select count(*) from net._istek_taklit where url like '%/push/send') = 1
             and (select count(*) from net._istek_taklit t, jsonb_array_elements(t.body) e
                  where t.url like '%/push/send' and e ->> 'to' in ('ExponentPushToken[b1]', 'ExponentPushToken[eski]')) = 2
             and (select count(*) from net._istek_taklit t, jsonb_array_elements(t.body) e
                  where t.url like '%/push/send' and e ->> 'to' in ('ExponentPushToken[b2]', 'ExponentPushToken[c1]')) = 0
            then 'GEÇTİ' else 'KALDI' end
  || '  Expo paketinde çıkış yapmış / süresi dolmuş cihaz YOK';

-- Biletler gelmeden: yanıtsız sayılır, makbuz henüz yok.
select case when (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{bilet,yanitsiz}') = '1'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,durum}') = 'yok'
            then 'GEÇTİ' else 'KALDI' end
  || '  yanıt gelmeden: 1 yanıtsız istek, makbuz durumu yok';

-- Expo yanıtı (belgedeki biçim): biri kabul, biri DeviceNotRegistered. Hata METNİ (message) cihaz adresi içerir.
insert into net._http_response (id, status_code, content, timed_out) overriding system value
select (istek_idleri)[1], 200,
  '{"data":[{"status":"ok","id":"makbuz-1"},{"status":"error","message":"\"ExponentPushToken[eski]\" is not a registered push notification recipient","details":{"error":"DeviceNotRegistered"}}]}',
  false
from public.bildirim_gonderim where id = :gid;

select case when (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{bilet,kabul}') = '1'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{bilet,ret}') = '1'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{bilet,ret_kodlari,DeviceNotRegistered}') = '1'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,durum}') = 'erken'
            then 'GEÇTİ' else 'KALDI' end
  || '  bilet: 1 kabul, 1 ret (hata KODU sayılır); makbuz için 15 dk beklenir';

select case when position('ExponentPushToken' in public.admin_bildirim_sonuc(:gid)::text) = 0
            then 'GEÇTİ' else 'KALDI' end
  || '  sonuçta cihaz adresi ya da hata metni dönmez';

-- pg_net yanıtı TTL'de siler: özet kalıcı yazılmış olmalı.
delete from net._http_response;
select case when (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{bilet,kabul}') = '1'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{bilet,yanitsiz}') = '0'
            then 'GEÇTİ' else 'KALDI' end
  || '  yanıt silinse de bilet özeti kalır';

-- 15 dakika geçti: makbuz istenir (tek kimlik: yalnız KABUL edilen biletinki).
update public.bildirim_gonderim set olusturuldu = now() - interval '16 minutes' where id = :gid;
-- Fonksiyon istek ekliyor: aynı SELECT'in içinde göremez (anlık görüntü), ayrı çağrılır.
select public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,durum}' as durum15 \gset
select case when :'durum15' = 'istendi'
             and (select count(*) from net._istek_taklit where url like '%/push/getReceipts') = 1
             and (select body -> 'ids' from net._istek_taklit where url like '%/push/getReceipts') = '["makbuz-1"]'::jsonb
            then 'GEÇTİ' else 'KALDI' end
  || '  15 dk sonra makbuz istenir, yalnız kabul edilen biletin kimliğiyle';

select case when (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,durum}') = 'bekliyor'
             and (select count(*) from net._istek_taklit where url like '%/push/getReceipts') = 1
            then 'GEÇTİ' else 'KALDI' end
  || '  makbuz yanıtı gelmeden ikinci istek atılmaz (bekliyor)';

insert into net._http_response (id, status_code, content, timed_out) overriding system value
select (makbuz_istek_idleri)[1], 200,
  '{"data":{"makbuz-1":{"status":"error","message":"x","details":{"error":"MessageRateExceeded"}}}}', false
from public.bildirim_gonderim where id = :gid;

select case when (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,durum}') = 'okundu'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,hata}') = '1'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,ok}') = '0'
             and (public.admin_bildirim_sonuc(:gid)::jsonb #>> '{makbuz,hata_kodlari,MessageRateExceeded}') = '1'
            then 'GEÇTİ' else 'KALDI' end
  || '  makbuz okunur: hata kodu sayılır, özet yazılır';

-- Expo isteği düşerse (5xx) kabul sayılmaz.
select (public.admin_bildirim_gonder('B2', 'M2', null)::jsonb ->> 'gonderim_id')::bigint as gid2 \gset
insert into net._http_response (id, status_code, content, timed_out) overriding system value
select (istek_idleri)[1], 503, 'Service Unavailable', false from public.bildirim_gonderim where id = :gid2;
select case when (public.admin_bildirim_sonuc(:gid2)::jsonb #>> '{bilet,istek_hatasi}') = '1'
             and (public.admin_bildirim_sonuc(:gid2)::jsonb #>> '{bilet,kabul}') = '0'
            then 'GEÇTİ' else 'KALDI' end
  || '  Expo 503 verirse istek hatası sayılır, kabul sayılmaz';

-- Kayıt: oturum kimliği JWT'den yazılır; biçimsiz değer yazılmaz.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \gset
select set_config('request.jwt.claims', '{"session_id":"11111111-1111-1111-1111-1111111111b1"}', false) \gset
select public.push_cihaz_kaydet('ExponentPushToken[yeni]', 'ios');
select case when (select oturum_id from public.push_cihaz where token = 'ExponentPushToken[yeni]') = '11111111-1111-1111-1111-1111111111b1'
            then 'GEÇTİ' else 'KALDI' end
  || '  kayıt: JWT session_id oturum_id olarak yazılır';

select set_config('request.jwt.claims', '{"session_id":"uuid-degil"}', false) \gset
select public.push_cihaz_kaydet('ExponentPushToken[yeni]', 'ios');
select case when (select oturum_id from public.push_cihaz where token = 'ExponentPushToken[yeni]') is null
            then 'GEÇTİ' else 'KALDI' end
  || '  kayıt: biçimsiz session_id yazılmaz (null = oturumu bilinmiyor)';

-- Yönetici olmayan sonuç okuyamaz, gönderemez.
do $$
begin
  begin
    perform public.admin_bildirim_sonuc(null);
    raise notice 'KALDI  yönetici olmayan sonucu okudu';
  exception when others then
    if sqlerrm = 'not_admin' then raise notice 'GEÇTİ  yönetici olmayan sonuç okuyamaz';
    else raise notice 'KALDI  beklenmeyen hata: %', sqlerrm; end if;
  end;
  begin
    perform public.admin_bildirim_gonder('a', 'b', null);
    raise notice 'KALDI  yönetici olmayan gönderebildi';
  exception when others then
    if sqlerrm = 'not_admin' then raise notice 'GEÇTİ  yönetici olmayan gönderemez';
    else raise notice 'KALDI  beklenmeyen hata: %', sqlerrm; end if;
  end;
end $$;
