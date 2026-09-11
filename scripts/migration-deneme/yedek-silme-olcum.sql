-- ÖLÇÜM: hesap silindiğinde yedekteki kopya GERÇEKTEN gidiyor mu?
-- ---------------------------------------------------------------------------
-- Bu dosya 0102'nin iddiasını sınar. İddiayı yazıp "herhalde çalışır" demek
-- yetmez: hukuki metinde "yedeklenmiş kopya kalmaz" yazacaksak, kalmadığını
-- ölçmüş olmamız gerekir.
--
-- SINANAN DÖRT ŞEY:
--   1) Silinen kullanıcının satırları backup.snapshots'tan gider.
--   2) backup.monthly'den de gider (12 aylık katman — asıl uzun kuyruk budur).
--   3) backup.dosya_envanteri'nden gider.
--   4) BAŞKA KULLANICININ satırlarına DOKUNULMAZ. (En kritik madde: fazla
--      silen bir temizlik, hiç silmeyenden daha kötüdür.)
--
-- Koşum:  bash scripts/migration-deneme/calistir.sh 0102
--         psql ... -f scripts/migration-deneme/yedek-silme-olcum.sql
-- (calistir.sh bunu kendi sonunda çağırır.)

\set ON_ERROR_STOP on

-- İki kullanıcı: A silinecek, B kalacak.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@ornek.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@ornek.test');
insert into public.profiles (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@ornek.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@ornek.test');

-- Yedek satırları: gerçek take_snapshot ne yazıyorsa o biçimde (tbl + jsonb).
-- A'nın satırları farklı sahiplik sütunlarıyla yazılıyor — çünkü gerçekte de
-- öyle: profiles'ta `id`, çoğu tabloda `owner_id`, purchases'ta `user_id`.
insert into backup.snapshots (tbl, row_data) values
  ('profiles', '{"id":"11111111-1111-1111-1111-111111111111","email":"a@ornek.test"}'),
  ('cases',    '{"id":"aaaa0001-0000-0000-0000-000000000000","owner_id":"11111111-1111-1111-1111-111111111111","title":"A davası"}'),
  ('purchases','{"id":"aaaa0002-0000-0000-0000-000000000000","user_id":"11111111-1111-1111-1111-111111111111"}'),
  -- Dolaylı bağlı satır: sahiplik sütunu yok, yalnız case_id üzerinden bağlı.
  -- Metin taraması bunu da yakalamalı ÇÜNKÜ A'nın dava kimliği içinde geçmiyor;
  -- burada bilerek owner_id konuldu ki gerçek şemaya sadık kalınsın.
  ('payments', '{"id":"aaaa0003-0000-0000-0000-000000000000","owner_id":"11111111-1111-1111-1111-111111111111","amount":100}'),
  ('profiles', '{"id":"22222222-2222-2222-2222-222222222222","email":"b@ornek.test"}'),
  ('cases',    '{"id":"bbbb0001-0000-0000-0000-000000000000","owner_id":"22222222-2222-2222-2222-222222222222","title":"B davası"}');

insert into backup.monthly (snap_month, snap_at, tbl, row_data) values
  (current_date, now(), 'cases', '{"id":"aaaa0001-0000-0000-0000-000000000000","owner_id":"11111111-1111-1111-1111-111111111111","title":"A davası"}'),
  (current_date, now(), 'cases', '{"id":"bbbb0001-0000-0000-0000-000000000000","owner_id":"22222222-2222-2222-2222-222222222222","title":"B davası"}');

insert into backup.dosya_envanteri (yol, sahip, boyut) values
  ('11111111-1111-1111-1111-111111111111/dosya.pdf', '11111111-1111-1111-1111-111111111111', 10),
  ('22222222-2222-2222-2222-222222222222/dosya.pdf', '22222222-2222-2222-2222-222222222222', 10);

-- auth.uid() A'yı döndürsün: delete_account oturumdaki kullanıcıyı siler.
create or replace function auth.uid() returns uuid language sql stable
as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;

select public.delete_account();

-- ── SONUÇLAR ────────────────────────────────────────────────────────────────
select 'A izi snapshots' as olcum,
       count(*) as deger, 0 as beklenen,
       case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end as sonuc
from backup.snapshots where row_data::text like '%11111111-1111-1111-1111-111111111111%'
union all
select 'A izi monthly', count(*), 0,
       case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end
from backup.monthly where row_data::text like '%11111111-1111-1111-1111-111111111111%'
union all
select 'A izi dosya envanteri', count(*), 0,
       case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end
from backup.dosya_envanteri where sahip = '11111111-1111-1111-1111-111111111111'
union all
-- B'nin satırları TAM OLARAK yerinde durmalı: snapshots 2, monthly 1, envanter 1.
select 'B izi snapshots (2 olmalı)', count(*), 2,
       case when count(*) = 2 then 'GEÇTİ' else 'BOZULDU' end
from backup.snapshots where row_data::text like '%22222222-2222-2222-2222-222222222222%'
union all
select 'B izi monthly (1 olmalı)', count(*), 1,
       case when count(*) = 1 then 'GEÇTİ' else 'BOZULDU' end
from backup.monthly where row_data::text like '%22222222-2222-2222-2222-222222222222%'
union all
select 'B izi dosya envanteri (1 olmalı)', count(*), 1,
       case when count(*) = 1 then 'GEÇTİ' else 'BOZULDU' end
from backup.dosya_envanteri where sahip = '22222222-2222-2222-2222-222222222222'
union all
select 'A auth kaydı', count(*), 0,
       case when count(*) = 0 then 'GEÇTİ' else 'KALDI' end
from auth.users where id = '11111111-1111-1111-1111-111111111111'
union all
select 'B auth kaydı (1 olmalı)', count(*), 1,
       case when count(*) = 1 then 'GEÇTİ' else 'BOZULDU' end
from auth.users where id = '22222222-2222-2222-2222-222222222222';

-- Doğrulama yardımcısı da aynı cevabı vermeli (sıfır kalan).
select 'yedekte_iz_var_mi: ' || kaynak as olcum, kalan
from backup.yedekte_iz_var_mi('11111111-1111-1111-1111-111111111111');

-- Oturumsuz çağrı sessizce hiçbir şey silmemeli, HATA vermeli.
create or replace function auth.uid() returns uuid language sql stable
as $$ select null::uuid $$;
do $$
begin
  perform public.delete_account();
  raise exception 'BEKLENEN HATA GELMEDİ — oturumsuz silme engellenmedi';
exception when others then
  if sqlerrm like '%oturum yok%' then
    raise notice 'oturumsuz silme engellendi: GEÇTİ';
  else
    raise;
  end if;
end $$;
