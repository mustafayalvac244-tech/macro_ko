-- HASAT DURUM RAPORU — SALT OKUNUR. Hiçbir şeyi değiştirmez.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. Ürün sahibi 14.09.2026'da hasat durumunu sordu. Cevabı iş akışı
-- kayıtlarından ("koşu başarılı") çıkarmak yanlış olurdu: hasat pg_cron ile
-- Supabase İÇİNDE dönüyor ve "koştu" ile "veri geldi" aynı şey değil. Tek
-- doğru kaynak veritabanının kendisi.
--
-- 0133/0134 dersi: HEPSİ TEK SORGU, çünkü uygulayıcı çok ifadeli dosyada
-- yalnız SON ifadenin satırlarını döndürüyor.
--
-- 0134 dersi: `to_regclass` ÇALIŞMA ZAMANINDA korur, ayrıştırmayı korumaz.
-- Bu yüzden hiçbir tabloya doğrudan `from public.x` ile dokunulmuyor; sayımlar
-- tablo adını METİN olarak alan query_to_xml ile yapılıyor. Böylece dosya,
-- tabloların hiçbirinin bulunmadığı boş bir veritabanında da patlamıyor
-- (CI yalnız değişen göçleri boş DB'de oynatıyor).

with hedef(sira, etiket, tablo, kosul) as (
  values
    (1, 'ictihat karar metni',        'public.ictihat_kararlar',        null),
    (2, 'ictihat katalog (kunye)',    'public.ictihat_katalog',         null),
    (3, 'katalog - metni inmis',      'public.ictihat_katalog',         'metin_var is true'),
    (4, 'katalog - metni BEKLEYEN',   'public.ictihat_katalog',         'metin_var is not true'),
    (5, 'ictihat atif baglari',       'public.ictihat_atif',            null),
    (6, 'mevzuat maddeleri',          'public.mevzuat_maddeleri',       null),
    (7, 'hasat durumu (terim) satiri','public.ictihat_harvest_state',   null),
    (8, 'katalog penceresi satiri',   'public.ictihat_katalog_pencere', null)
),
sayim as (
  select h.sira, h.etiket,
    case
      when to_regclass(h.tablo) is null then 'TABLO YOK'
      else (xpath('/row/c/text()', query_to_xml(
              'select count(*) as c from ' || h.tablo ||
              coalesce(' where ' || h.kosul, ''), false, true, '')))[1]::text
    end as deger
  from hedef h
),
-- En son ne zaman veri geldi. Hasat durmuşsa sayı yüksek ama tarih eski olur;
-- yalnız sayıya bakmak duran bir hasadı sağlıklı gösterirdi.
-- TAZELİK — ZAMAN SÜTUNUNUN ADI VARSAYILMIYOR, BULUNUYOR.
-- İlk yazımda `max(created_at)` yazmıştım ve deneme koşusu düşürdü:
-- "column created_at does not exist". Sebep önemli: `ictihat_kararlar`ı
-- depodaki HİÇBİR göç yaratmıyor (canlıda ve taklit şemada var, migration
-- olarak yok). Yani o tablonun sütun adlarını bilmiyordum, varsaymıştım.
-- Aşağıdaki hâli sütunu information_schema'dan buluyor: önce 'created_at'
-- arıyor, yoksa ilk timestamp sütununu alıyor ve HANGİSİNİ kullandığını
-- çıktıya yazıyor — böylece sayı okunurken neye dayandığı belli oluyor.
zaman_sutunu as (
  select t.tablo, t.sira, t.etiket,
    (select coalesce(
              max(c.column_name) filter (where c.column_name = 'created_at'),
              min(c.column_name))
     from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = t.tablo
       and c.data_type like 'timestamp%') as sutun
  from (values (9, 'en son karar metni', 'ictihat_kararlar'),
               (10, 'en son katalog kaydi', 'ictihat_katalog'))
       as t(sira, etiket, tablo)
),
tazelik as (
  select z.sira, z.etiket,
    case
      when to_regclass('public.' || z.tablo) is null then 'TABLO YOK'
      when z.sutun is null then 'ZAMAN SUTUNU YOK'
      else z.sutun || ' = ' || coalesce(
             (xpath('/row/c/text()', query_to_xml(
               'select max(' || quote_ident(z.sutun) || ')::text as c from public.' || quote_ident(z.tablo),
               false, true, '')))[1]::text, 'HIC VERI')
    end as deger
  from zaman_sutunu z
  union all
  -- pg_cron gerçekten kurulu mu ve hasat işi zamanlanmış mı. Kurulu değilse
  -- hasat hiç dönmüyor demektir ve bunu sayılardan anlamak zordur.
  --
  -- DİKKAT: burada `from cron.job` YAZILMIYOR. Aynı dosyada iki satır yukarıda
  -- anlattığım tuzağa yazarken yeniden düşecektim: pg_cron kurulu olmayan bir
  -- veritabanında (CI'ın boş DB'si) doğrudan referans AYRIŞTIRMA aşamasında
  -- patlar, to_regclass koruması buna yetmez.
  select 11, 'pg_cron zamanlanmis isler',
    case
      when to_regclass('cron.job') is null then 'pg_cron KURULU DEGIL'
      -- Dolar tırnağı: iç sorguda tek tırnak var, kaçırmaya kalkmak okunmaz
      -- bir satır üretiyordu.
      else coalesce((xpath('/row/c/text()', query_to_xml(
             $q$select string_agg(jobname || ' [' || schedule || ']', ', ' order by jobname) as c from cron.job$q$,
             false, true, '')))[1]::text, 'ZAMANLANMIS IS YOK')
    end
)
select etiket as olcum, deger from (
  select sira, etiket, deger from sayim
  union all
  select sira, etiket, deger from tazelik
) ozet
order by sira;
