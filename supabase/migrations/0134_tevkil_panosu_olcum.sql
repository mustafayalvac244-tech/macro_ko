-- TEVKİL PANOSU — CANLI ÖLÇÜM. SALT OKUNUR, hiçbir şeyi değiştirmez.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. Ürün sahibi 14.09.2026'da tevkil panosunu web sürümüne geri
-- açmayı istedi. Pano `jobs` tablosuna, iletişim de `dm_messages`'a dayanıyor
-- ve ikisi de 0007_network.sql'de tanımlı — YANİ ÇOK ESKİ BİR GÖÇTE.
--
-- Tehlike şu: ekranı geri açıp yayına verdikten sonra tablonun canlıda
-- olmadığını öğrenmek. O durumda pano hata bile vermez, "kurulum gerekli"
-- diye boş durur ve avukat özelliğin bozuk olduğunu düşünür. Ekrandan önce
-- şema ölçülüyor.
--
-- ÖZELLİKLE POLİTİKALAR ÖNEMLİ. Pano tasarımı gereği HERKESE AÇIK bir
-- listedir: `jobs readable by authenticated` her oturum açmış avukatın tüm
-- ilanları görmesini sağlar. Bu doğru ama KVKK metninde YAZMASI gerekiyor
-- (YAYIN-DENETIMI.md → C2). Politikanın gerçekten bu olduğunu görmeden metni
-- yazmak, metni tahmine dayandırmak olurdu.
--
-- 0133 ile aynı ders: HEPSİ TEK SORGU. Uygulayıcı (Supabase Management API)
-- çok ifadeli bir dosyada yalnız SON ifadenin satırlarını döndürüyor.

select olcum, deger from (

  -- 1. jobs tablosu canlıda var mı ve şekli ne
  select 1 as sira, 'jobs sutunlari' as olcum,
    coalesce(string_agg(column_name || ':' || data_type, ', ' order by ordinal_position), 'TABLO YOK (!)') as deger
  from information_schema.columns
  where table_schema = 'public' and table_name = 'jobs'

  union all
  -- 2. jobs RLS açık mı ve hangi politikalarla. Kapalıysa oturum açmamış
  --    biri de okuyabilirdi; açıksa politika adları metnin dayanağı olur.
  select 2, 'jobs RLS',
    coalesce(max(case
      when c.relrowsecurity then 'ACIK · politika: ' || coalesce(
        (select string_agg(polname, ', ' order by polname) from pg_policy p where p.polrelid = c.oid), 'YOK (!)')
      else 'KAPALI (!)'
    end), 'TABLO YOK (!)')
  from pg_class c
  where c.oid = to_regclass('public.jobs')

  union all
  -- 3. İlan türü kısıtı. Ekran tevkil/devir/danisma bekliyor; kısıt farklıysa
  --    ilan kaydı sessizce reddedilir.
  select 3, 'jobs tur kisiti',
    coalesce(string_agg(pg_get_constraintdef(oid), ' | '), 'KISIT YOK (!)')
  from pg_constraint
  where conrelid = to_regclass('public.jobs') and contype = 'c'

  union all
  -- 4. dm_messages — panodaki "Mesaj" düğmesinin dayanağı. Yoksa ilan sahibine
  --    ulaşmanın hiçbir yolu kalmaz ve pano işlevsiz olur.
  select 4, 'dm_messages RLS',
    coalesce(max(case
      when c.relrowsecurity then 'ACIK · politika: ' || coalesce(
        (select string_agg(polname, ', ' order by polname) from pg_policy p where p.polrelid = c.oid), 'YOK (!)')
      else 'KAPALI (!)'
    end), 'TABLO YOK (!)')
  from pg_class c
  where c.oid = to_regclass('public.dm_messages')

  union all
  -- 5. profiles'ın okuma politikası. Panoda ilan sahibinin ADI görünüyor;
  --    bunu mümkün kılan politika budur. KVKK metninde "diğer avukatlara
  --    hangi bilgileriniz görünür" cümlesi buna dayanacak.
  select 5, 'profiles okuma politikalari',
    coalesce(string_agg(polname, ', ' order by polname), 'YOK (!)')
  from pg_policy p
  where p.polrelid = to_regclass('public.profiles') and p.polcmd in ('r', '*')

  union all
  -- 6. Canlıda kaç ilan var. Sıfırdan büyükse özellik daha önce kullanılmış
  --    demektir ve ekranı kapatmak veri gizlemek olurdu.
  select 6, 'canli ilan sayisi',
    case when to_regclass('public.jobs') is null then 'TABLO YOK'
         else (select count(*)::text from public.jobs) end

  union all
  -- 7. Canlıda kaç özel mesaj var.
  select 7, 'canli mesaj sayisi',
    case when to_regclass('public.dm_messages') is null then 'TABLO YOK'
         else (select count(*)::text from public.dm_messages) end

  union all
  -- 8. Kaç avukat profili var — panonun kaç kişiye görünür olacağı.
  select 8, 'profil sayisi',
    case when to_regclass('public.profiles') is null then 'TABLO YOK'
         else (select count(*)::text from public.profiles) end

) ozet
order by sira;
