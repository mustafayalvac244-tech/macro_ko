-- 0091'İN YARIM KALAN İNDEKSLERİ — ONARIM.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. 14.09.2026 denetiminde ölçüldü: `0091_eksik_indeksler.sql` 26.
-- satırda `relation "public.client_advances" does not exist` ile düşüyor.
-- Sebebi şema değil, DOSYA DAĞILIMI: `client_advances`, `client_expenses` ve
-- `enforcement_collections` göçlerde değil, kökteki `KURULUM.sql`'de tanımlı.
-- 0091 bu tabloları göçlerin arasında arıyor ve bulamıyor.
--
-- SONUCU ÇALIŞTIRMA BİÇİMİNE GÖRE DEĞİŞİYOR ve ikisi de kötü:
--   • psql ON_ERROR_STOP ile → 26. satırda durur, sonraki 9 indeks de kurulmaz.
--   • Supabase SQL Editor ile → betiği TEK İŞLEMDE koşturur, hata hepsini geri
--     alır; 0091'in HİÇBİR indeksi kurulmamış olabilir.
-- Canlıdaki gerçek durumu ölçemedim (service_role erişimim yok ve istemiyorum).
-- Bu yüzden bu göç, hangi durumda olursa olsun DOĞRU sonuca yakınsıyor.
--
-- NEDEN ÖNEMLİ. Bu tabloların RLS politikaları `owner_id = auth.uid()` ile
-- süzüyor. `owner_id` indekssizse her okuma tam tarama yapar. Tek kullanıcıda
-- fark edilmez; kullanıcı sayısı ve satır sayısı arttıkça müvekkil ekranı ve
-- icra tahsilatları sessizce yavaşlar. "Sessiz" olması tam da sorun: kimse
-- hata görmez, sadece uygulama ağırlaşır.
--
-- NEDEN `if not exists` YETMİYOR. `create index if not exists` indeksin
-- varlığını kontrol eder, TABLONUN varlığını değil. Tablo yoksa yine hata
-- verir. Bu yüzden her satır `to_regclass` ile tablo varlığına bakıyor:
-- tablo yoksa satır sessizce atlanır ve göç çalışmaya devam eder.

do $$
declare
  hedef record;
begin
  for hedef in
    select * from (values
      -- 0091'in TAMAMI buraya kopyalandı ki hangi noktada durmuş olursa olsun
      -- eksik kalan tamamlansın. Var olanlar zaten atlanacak.
      ('case_expenses',           'owner_id',  'case_expenses_owner_idx'),
      ('case_installments',       'owner_id',  'case_installments_owner_idx'),
      ('client_advances',         'owner_id',  'client_advances_owner_idx'),
      ('client_expenses',         'owner_id',  'client_expenses_owner_idx'),
      ('enforcement_collections', 'owner_id',  'enforcement_collections_owner_idx'),
      ('jobs',                    'owner_id',  'jobs_owner_idx'),
      ('offices',                 'owner_id',  'offices_owner_idx'),
      ('ai_odeme',                'user_id',   'ai_odeme_user_idx'),
      ('documents',               'client_id', 'documents_client_idx'),
      ('office_messages',         'sender_id', 'office_messages_sender_idx'),
      ('payment_promises',        'case_id',   'payment_promises_case_idx'),
      -- 0091'de hiç yoktu; aynı denetimde indekssiz yabancı anahtar olarak
      -- bulundu. Yönetim kaydı düşük hacimli ama silme/birleştirme aynı
      -- maliyeti taşıyor.
      ('admin_islem_log',         'yapan',     'admin_islem_log_yapan_idx')
    ) as t(tablo, sutun, indeks)
  loop
    -- Tablo yoksa atla: bu göç hiçbir kurulum sırasında patlamamalı.
    if to_regclass('public.' || hedef.tablo) is null then
      raise notice 'atlandi (tablo yok): %', hedef.tablo;
      continue;
    end if;
    -- Sütun yoksa atla: eski bir kurulumda sütun adı farklı olabilir.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = hedef.tablo
        and column_name = hedef.sutun
    ) then
      raise notice 'atlandi (sutun yok): %.%', hedef.tablo, hedef.sutun;
      continue;
    end if;

    execute format(
      'create index if not exists %I on public.%I (%I)',
      hedef.indeks, hedef.tablo, hedef.sutun
    );
  end loop;
end $$;

-- Doğrulama: indekssiz kalan tek sütunlu yabancı anahtar var mı?
-- Boş dönmesi beklenir. Dönerse yukarıdaki listeye eklenmeli.
select
  c.conrelid::regclass::text || '.' || a.attname as hala_indekssiz
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
join pg_class cl on cl.oid = c.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where c.contype = 'f'
  and n.nspname = 'public'
  and array_length(c.conkey, 1) = 1
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
  )
order by 1;
