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

-- SAYIMLAR BURADA, TEK YERDE. Gerekçesi aşağıda 6. ölçümün başında yazılı:
-- tablo adı METİN olarak geçiyor, böylece ayrıştırma zamanında bağımlılık
-- doğmuyor ve tablo yokken dosya patlamıyor.
with sayimlar as (
  select t.ad,
    case
      when to_regclass(t.ad) is null then 'TABLO YOK'
      else (xpath('/row/c/text()',
              query_to_xml('select count(*) as c from ' || t.ad, false, true, '')))[1]::text
    end as deger
  from (values ('public.jobs'), ('public.dm_messages'), ('public.profiles')) as t(ad)
)
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

  -- ── SAYIMLAR: `to_regclass` TEK BAŞINA YETMEZ — 14.09.2026'da ölçüldü ──
  -- İlk yazımda bu üç sayım şöyleydi:
  --     case when to_regclass('public.jobs') is null then 'TABLO YOK'
  --          else (select count(*)::text from public.jobs) end
  -- Canlıda çalıştı (tablo var) ama CI'da düştü:
  --     ERROR: relation "public.jobs" does not exist
  -- SEBEP: `to_regclass` ÇALIŞMA ZAMANINDA koruyor; Postgres ise ifadeyi
  -- önce AYRIŞTIRIYOR. `from public.jobs` metinde geçtiği sürece, CASE
  -- dalına hiç girilmeyecek olsa bile tablo ayrıştırma aşamasında aranır.
  -- CI yalnız DEĞİŞEN göçleri boş bir veritabanında oynattığı için orada
  -- tablo yok ve dosya patlıyor.
  --
  -- Bu, `create index if not exists`in TABLOYU değil İNDEKSİ kontrol etmesi
  -- dersinin aynısı: koruma, referansın AYRIŞTIRILMASINI da engellemeli.
  --
  -- ÇÖZÜM: `query_to_xml` sorguyu METİN olarak alır — ayrıştırma zamanında
  -- bağımlılık doğurmaz, yalnız çalışma zamanında koşar. CASE dalı da onu
  -- tablo yokken hiç çağırmaz. Sayı yine TAM (tahmini değil); bu yüzden
  -- pg_stat_user_tables tahmini tercih edilmedi.
  union all
  -- 6. Canlıda kaç ilan var. Sıfırdan büyükse özellik daha önce kullanılmış
  --    demektir ve ekranı kapatmak veri gizlemek olurdu.
  select 6, 'canli ilan sayisi', (select deger from sayimlar where ad = 'public.jobs')

  union all
  -- 7. Canlıda kaç özel mesaj var.
  select 7, 'canli mesaj sayisi', (select deger from sayimlar where ad = 'public.dm_messages')

  union all
  -- 8. Kaç avukat profili var — panonun kaç kişiye görünür olacağı.
  select 8, 'profil sayisi', (select deger from sayimlar where ad = 'public.profiles')

) ozet
order by sira;
