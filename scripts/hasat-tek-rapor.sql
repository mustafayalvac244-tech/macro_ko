-- HASAT TEK RAPOR — hepsi TEK sonuç tablosunda.
-- ===========================================================================
-- NEDEN BU DOSYA VAR (kusur bendeydi). Ölçüm dosyalarını arka arkaya beş ayrı
-- SELECT olarak yazdım. Supabase SQL Editor çok ifadeli bir betikte yalnız
-- SON ifadenin sonucunu gösteriyor; bu yüzden üç turdur yalnız 5. sorgunun
-- çıktısını görebildim ve asıl cevapları (karar başına disk, hız sınırı oranı)
-- hiç göremedim. Kullanıcı dosyaları doğru çalıştırdı — hata, aracı onun
-- çalıştığı ortama uydurmamış olmamda.
--
-- Bu dosya TEK sorgudur: her satır bir ölçüm, hepsi bir tabloda. Tek Run,
-- tek ekran görüntüsü.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.

with
-- ── Havuz ve disk ───────────────────────────────────────────────────────────
k as (
  select count(*)::numeric as karar from public.ictihat_kararlar
),
-- Disk freninin GERÇEK eşiği: public.disk_musait_mi()'nin varsayılan argümanı.
-- Katalogdan okunuyor ki rapor ile canlı ayar bir daha ayrışmasın.
f as (
  select coalesce(
    nullif(regexp_replace(coalesce(pg_get_expr(p.proargdefaults, 0), ''), '\D', '', 'g'), '')::int,
    30000
  ) as esik_mb
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'disk_musait_mi'
  limit 1
),
b as (
  select
    pg_total_relation_size('public.ictihat_kararlar')::numeric as tablo_bayt,
    pg_indexes_size('public.ictihat_kararlar')::numeric        as indeks_bayt,
    pg_database_size(current_database())::numeric              as db_bayt
),
-- ── Son 6 saatin edge yanıtları ─────────────────────────────────────────────
--
-- İKİ KUSUR DÜZELTİLDİ (ikisi de bendeydi; ölçüm bu yüzden yanlış okunuyordu).
--
-- 1. PAYDA YANLIŞTI. Burada URL süzgeci yoktu. net._http_response, pg_net ile
--    yapılan HER isteğin yanıtını tutuyor — hangi işlev olduğu yazmıyor. Yani
--    hasatla ilgisi olmayan zamanlı işlerin yanıtları da "hasat turu" diye
--    sayılıyordu. Son ölçümde 718 "tur"un 451'i kaynağı belirsizdi ve toplam
--    0 karar üretmişti; bu 451 yanıt paydayı şişirip "boş tur oranı"nı
--    olduğundan yüksek gösteriyordu.
--
-- 2. HATA TESTİ DARDI. Yalnız '%"not"%' hata sayılıyordu. harvest-tick sert
--    hatalarda {"error":"forbidden"} / {"error":"state_failed"} /
--    {"error":"terim_yok"} döndürüyor; hiçbirinde "not" geçmiyor. Bu yanıtlar
--    HATA değil "boş tur (hepsi yinelenen)" diye sayılıyordu — yani yetki ya
--    da migration arızası, "sonuç yok" gibi görünüyordu. Rapor üç turdur
--    "HATA / HIZ SINIRI 0" yazıyordu; bu sıfır güvenilir değildi.
--
-- Artık payda YALNIZ harvest-tick yanıtları: gövdesinde "kaynak" geçen
-- yanıtlar. Hasatla ilgisiz trafik ayrı bir satırda GÖRÜNÜR hâle getiriliyor
-- (gizlenmiyor), ve hata testi HTTP durum kodunu da içeriyor.
tum as (
  select
    r.status_code,
    coalesce(r.content, '') as content
  from net._http_response r
  where r.created > now() - interval '6 hours'
),
y as (
  select
    t.content,
    coalesce(substring(t.content from '"eklenen":([0-9]+)')::int, 0) as eklenen,
    coalesce(substring(t.content from '"kaynak":"([a-z]+)"'), '(bilinmiyor)') as kaynak,
    (t.content like '%"not"%' or coalesce(t.status_code, 0) <> 200) as hatali,
    (t.content like '%"yarim"%') as yarim
  from tum t
  where t.content like '%"kaynak"%'
),
satirlar as (

  -- 1. DİSK: "milyon karar" mümkün mü?
  -- sira NUMERIC: araya satır sokabilmek için (22.5 gibi) ondalık kullanılıyor.
  select 10::numeric as sira, 'DİSK' as bolum, 'havuzdaki karar' as alan, to_char(k.karar, 'FM999G999G999') as deger from k
  union all
  select 11, 'DİSK', 'içtihat tablosu', pg_size_pretty(b.tablo_bayt::bigint) from b
  union all
  select 12, 'DİSK', 'bunun indeksleri', pg_size_pretty(b.indeks_bayt::bigint) from b
  union all
  select 13, 'DİSK', 'veritabanı toplam', pg_size_pretty(b.db_bayt::bigint) from b
  union all
  -- ASIL SAYI: tahminimi (10-15 KB) ölçümle değiştiren satır.
  select 14, 'DİSK', '>> KARAR BAŞINA KB', round(b.tablo_bayt / greatest(k.karar, 1) / 1024, 1)::text from k, b
  union all
  -- FREN EŞİĞİ SABİT YAZILMIYOR — KENDİ HATAM. Burada 6000 sabiti duruyordu,
  -- oysa eşik 0123 ile 30.000 MB'a çıkarılmıştı. Rapor bu yüzden kalan
  -- kapasiteyi BEŞTE BİR gösteriyordu: 167 bin karar dedi, gerçek ~950 bin.
  -- Eşik artık fonksiyonun kendi varsayılanından okunuyor; bir daha
  -- değiştirildiğinde rapor kendiliğinden doğru kalır.
  select 15, 'DİSK', '>> frene kalan karar (eşik: ' || f.esik_mb || ' MB)',
         to_char(greatest((f.esik_mb::bigint * 1024 * 1024 - b.db_bayt)
                          / greatest(b.tablo_bayt / greatest(k.karar, 1), 1), 0), 'FM999G999G999')
  from k, b, f
  union all
  select 16, 'DİSK', '>> 1 milyon karar kaç GB eder',
         round(b.tablo_bayt / greatest(k.karar, 1) * 1000000 / 1024 / 1024 / 1024, 1)::text || ' GB'
  from k, b
  union all
  select 17, 'DİSK', 'tam metnin payı',
         coalesce((select pg_size_pretty(sum(pg_column_size(full_text))::bigint) from public.ictihat_kararlar), 'ölçülemedi')

  -- 2. VERİM: turlar ne yapıyor?
  union all
  select 20, 'VERİM', 'son 6 saatte eklenen karar', count(*)::text
  from public.ictihat_kararlar where created_at > now() - interval '6 hours'
  union all
  select 21, 'VERİM', 'saatlik', round(count(*) / 6.0)::text
  from public.ictihat_kararlar where created_at > now() - interval '6 hours'
  union all
  select 22, 'VERİM', 'son 6 saatteki hasat turu', count(*)::text from y
  union all
  -- Payda dışında bırakılanlar GİZLENMİYOR. Bu satır büyükse "hasat turu"
  -- sandığımız trafiğin çoğu başka bir işe aitti demektir.
  select 22.5, 'VERİM', '  (hasat dışı pg_net yanıtı — sayılmadı)', count(*)::text
  from tum where content not like '%"kaynak"%'
  union all
  -- harvest-tick'in sert hataları: 403 forbidden, 500 state_failed, 404
  -- terim_yok. Eskiden bunlar "boş tur" sayılıyordu.
  select 22.6, 'VERİM', '  (sert hata döndüren yanıt)', count(*)::text
  from tum where content like '%"error"%'
  union all
  -- Kova dağılımı: hız sınırı mı, yinelenen mi? Çözümleri TERS yönde.
  select 23, 'VERİM', '  ├ karar ekledi', count(*)::text from y where not hatali and eklenen > 0
  union all
  select 24, 'VERİM', '  ├ boş tur (hepsi yinelenen)', count(*)::text from y where not hatali and eklenen = 0
  union all
  select 25, 'VERİM', '  └ >> HATA / HIZ SINIRI', count(*)::text from y where hatali
  union all
  select 26, 'VERİM', '>> tur başına ortalama karar', coalesce(round(avg(eklenen), 2)::text, 'veri yok') from y
  union all
  select 27, 'VERİM', 'kotaya takılıp yarım kalan tur', count(*)::text from y where yarim
  union all
  select 28, 'VERİM', 'son hata mesajı',
         coalesce((select left(content, 160) from y where hatali order by 1 desc limit 1), '(hata yok)')

  -- 3. KAYNAK BAZINDA: üç kaynak eşit hızda, ama eşit verimli mi?
  union all
  select 30, 'KAYNAK', kaynak, 'tur ' || count(*) || ' · toplam ' || sum(eklenen) ||
         ' · tur başına ' || round(avg(eklenen), 2)
  from y group by kaynak

  -- 4. TERİMLER
  union all
  select 40, 'TERİM', 'terim sayısı', count(*)::text from public.ictihat_harvest_state
  union all
  select 41, 'TERİM', 'bitmiş terim', count(*) filter (where done)::text from public.ictihat_harvest_state
  union all
  select 42, 'TERİM', 'sayfa 1 (hiç ilerlememiş)', count(*) filter (where next_page = 1)::text from public.ictihat_harvest_state
  union all
  select 43, 'TERİM', 'sayfa 20+', count(*) filter (where next_page > 20)::text from public.ictihat_harvest_state
  union all
  -- Hepsi aynı puandaysa öncelik fiilen yok demektir.
  select 44, 'TERİM', '>> öncelik dağılımı',
         case when count(distinct oncelik) = 1
              then 'HEPSİ ' || min(oncelik) || ' — ayrışmamış'
              else min(oncelik) || '–' || max(oncelik) || ', ' || count(distinct oncelik) || ' farklı değer' end
  from public.ictihat_harvest_state

  -- 5. KURUL DAĞILIMI: "en önemli içtihat" kararının dayanağı
  union all
  select 50, 'KURUL', coalesce(kurul, '(boş)'),
         count(*) || '  (%' || round(100.0 * count(*) / sum(count(*)) over (), 1) || ')'
  from public.ictihat_kararlar group by kurul

  -- 6. 'Yerel' etiketi bir SON ÇARE; içinde yanlış sınıflanmış yüksek yargı olabilir
  union all
  select 60, 'YEREL?', 'daire alanı boş',
         count(*) filter (where daire is null or trim(daire) = '')::text
  from public.ictihat_kararlar where kurul = 'Yerel'
  union all
  select 61, 'YEREL?', '>> aslında Yargıtay',
         count(*) filter (where daire ilike '%yarg%tay%')::text
  from public.ictihat_kararlar where kurul = 'Yerel'
  union all
  select 62, 'YEREL?', '>> aslında Danıştay',
         count(*) filter (where daire ilike '%dan%tay%')::text
  from public.ictihat_kararlar where kurul = 'Yerel'
)
select bolum, alan, deger from satirlar order by sira, alan;
