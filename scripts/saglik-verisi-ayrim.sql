-- SAĞLIK VERİSİ BU VERİTABANINDA NE ARIYOR? — ayrım denetimi.
-- ===========================================================================
-- KURAL (ürün sahibi, 13.09.2026): "Sağlık verisini buraya karıştırma, hep
-- ayrı olacak."
--
-- NEDEN DOĞRU BİR KURAL. Sağlık verisi 6698 sayılı Kanun'un 6. maddesinde
-- ÖZEL NİTELİKLİ kişisel veridir: işlenmesi kural olarak açık rıza ister,
-- "yeterli önlem" alınması zorunludur ve VERBİS kayıt yükümlülüğü çalışan
-- sayısı/ciro eşiklerinden BAĞIMSIZ olarak doğabilir. Avukatın müvekkil
-- dosyasıyla aynı veritabanında durması, Vekil Pro'nun uyum yükünü kendi
-- işiyle ilgisi olmayan bir sebeple ağırlaştırır. Bir sızıntı ya da bir
-- denetim, iki ürünü birden kapsar.
--
-- BU RAPOR NE YAPAR. Eczane uygulamasının tablolarını bu veritabanında arar
-- ve İÇLERİNDE GERÇEK VERİ OLUP OLMADIĞINI söyler. Ayrım kararı, "boş mu
-- dolu mu" sorusuna göre çok farklı bir iştir: boşken taşımak bedavadır,
-- doluyken taşımak veri göçü + rıza + imha zinciri demektir.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur. Tabloları silmek BU BETİĞİN İŞİ
-- DEĞİLDİR ve olmamalıdır: onlar başka bir ürünün verisi.

with hedef as (
  -- Eczane tarafına ait oldukları adlarından belli olan tablolar.
  select unnest(array[
    'ilaclar', 'prospektusler', 'kullanici_ilaclar', 'kullanici_alimlar',
    'receteler', 'recete_kalemleri', 'hasta', 'hastalar', 'ilac_etkilesim'
  ]) as ad
),
bulunan as (
  select h.ad, c.oid, c.relrowsecurity as rls,
         coalesce(c.reltuples::bigint, 0) as tahmini_satir,
         pg_total_relation_size(c.oid) as boyut
  from hedef h
  join pg_class c on c.relname = h.ad
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r'
),
kisisel as (
  -- Kişiye bağlı mı? user_id/hasta sütunu varsa o tablo KİŞİSEL veri taşır;
  -- yalnız katalog (ilaç adı, prospektüs metni) taşıyan tablodan farklıdır.
  select b.ad,
         exists (
           select 1 from pg_attribute a
           where a.attrelid = b.oid and not a.attisdropped and a.attnum > 0
             and a.attname in ('user_id', 'hasta_id', 'tc_no', 'hasta')
         ) as kisiye_bagli
  from bulunan b
),
satirlar as (
  select 10::numeric as sira, 'VARLIK' as bolum, b.ad as alan,
         case when k.kisiye_bagli then 'KİŞİSEL — ' else 'katalog — ' end
         || 'tahmini ' || b.tahmini_satir || ' satır · ' || pg_size_pretty(b.boyut)
         || case when b.rls then ' · RLS açık' else ' · RLS KAPALI' end as deger
  from bulunan b join kisisel k on k.ad = b.ad
  union all
  select 20, 'ÖZET', 'eczane tablosu sayısı', count(*)::text from bulunan
  union all
  select 21, 'ÖZET', 'toplam yer kapladığı', pg_size_pretty(sum(boyut)) from bulunan
  union all
  select 22, 'ÖZET', '>> kişiye bağlı (sağlık verisi olabilecek) tablo',
         count(*)::text from kisisel where kisiye_bagli
)
select bolum, alan, deger from satirlar order by sira, alan;
