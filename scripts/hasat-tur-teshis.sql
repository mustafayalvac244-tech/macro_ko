-- HASAT TURU TEŞHİSİ — "boş tur" gerçekten boş mu, yoksa hata mı?
-- ===========================================================================
-- NEDEN BU DOSYA VAR (kusur bendeydi). hasat-tek-rapor.sql'deki `y` bloğu
-- son 6 saatteki pg_net yanıtlarını sayıyor ama İKİ hata içeriyor:
--
--   1. URL SÜZGECİ YOK. net._http_response tablosunda hangi işlevin çağrıldığı
--      yazmıyor; tablo pg_net ile yapılan HER isteğin yanıtını tutuyor. Başka
--      bir zamanlı iş de http çağırıyorsa onun yanıtları "hasat turu" diye
--      sayılıyor.
--
--   2. HATA TESTİ DAR. Rapor `content like '%"not"%'` görürse hata sayıyor.
--      Oysa harvest-tick sert hatalarda {"error":"forbidden"},
--      {"error":"state_failed"}, {"error":"terim_yok"} döndürüyor — hiçbirinde
--      "not" geçmiyor. Bu yanıtlar "boş tur (hepsi yinelenen)" kovasına
--      düşüyor ve hız sınırı/yetki arızası SIFIR görünüyor.
--
-- Son ölçümde "(bilinmiyor) kaynak: 451 tur · 0 karar" ile "boş tur: 449"
-- neredeyse aynı sayı. Bu dosya o 451 yanıtın NE olduğunu söylüyor: hangi
-- HTTP durum koduyla döndüler, içerikleri neye benziyor, ve hangi zamanlı iş
-- onları üretiyor.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.

with y as (
  select
    r.status_code,
    r.timed_out,
    coalesce(r.error_msg, '')       as error_msg,
    coalesce(r.content, '')         as content
  from net._http_response r
  where r.created > now() - interval '6 hours'
),
imza as (
  -- İçeriğin ilk 70 karakteri, boşluklar sadeleştirilmiş: aynı şekildeki
  -- yanıtlar tek satırda toplansın.
  select left(regexp_replace(content, '\s+', ' ', 'g'), 70) as sig, count(*) as adet
  from y group by 1 order by 2 desc limit 20
),
isler as (
  select
    j.jobname,
    j.schedule,
    j.active,
    case
      when j.command ilike '%harvest-tick%' then 'harvest-tick'
      when j.command ilike '%functions/v1/%'
        then coalesce(substring(j.command from 'functions/v1/([a-zA-Z0-9_-]+)'), '(edge?)')
      when j.command ilike '%net.http%' then '(http, ad çözülemedi)'
      else '(http değil)'
    end as hedef
  from cron.job j
),
kosular as (
  select d.jobid, d.status, count(*) as adet
  from cron.job_run_details d
  where d.start_time > now() - interval '6 hours'
  group by 1, 2
),
satirlar as (

  -- 1. HANGİ ZAMANLI İŞLER VAR. 718 "tur"un kaçının hasatla ilgisi var?
  select 10 as sira, 'İŞ' as bolum, i.jobname as alan,
         (case when i.active then 'açık' else 'KAPALI' end)
         || ' · ' || i.schedule || ' · → ' || i.hedef as deger
  from isler i

  -- 2. ZAMANLI İŞ KOŞULARI. Cron'un kendisi hata veriyor mu?
  union all
  select 20, 'KOŞU', coalesce(j.jobname, 'jobid ' || k.jobid::text) || ' / ' || k.status,
         k.adet::text
  from kosular k left join cron.job j on j.jobid = k.jobid

  -- 3. HTTP DURUM KODU DAĞILIMI. 200 değilse "boş tur" değil, ARIZA.
  union all
  select 30, 'DURUM',
         coalesce(y.status_code::text, '(kod yok)')
         || (case when y.timed_out then ' · zaman aşımı' else '' end),
         count(*)::text
  -- group by 3: seçim listesi (sira, bolum, alan, deger) — konum 3 "alan".
  -- Burada 2 yazmıştım; 2 sabit 'DURUM' metnine denk geliyor ve sorgu düşüyor.
  from y group by 3

  -- 4. ASIL AYRIM. Yanıtta "kaynak" geçiyorsa harvest-tick'tir; geçmiyorsa
  --    ya başka bir işin yanıtıdır ya da harvest-tick'in sert hatasıdır.
  union all
  select 40, 'AYRIM', 'harvest yanıtı ("kaynak" var)', count(*)::text
  from y where content like '%"kaynak"%'
  union all
  select 41, 'AYRIM', 'harvest sert hatası ("error" var)', count(*)::text
  from y where content like '%"error"%'
  union all
  select 42, 'AYRIM', '>> ikisi de değil (hasatla ilgisiz)', count(*)::text
  from y where content not like '%"kaynak"%' and content not like '%"error"%'
  union all
  select 43, 'AYRIM', 'pg_net taşıma hatası (error_msg dolu)', count(*)::text
  from y where error_msg <> ''

  -- 5. İÇERİK İMZALARI. Gerçekte ne dönüyor — tahmin değil, metnin kendisi.
  union all
  select 50, 'İMZA', imza.sig, imza.adet::text from imza

  -- 6. GERÇEK BOŞ TUR. Yalnız harvest yanıtları içinde, eklenen = 0 olanlar.
  --    Sözünü verdiğim "boş tur oranı" ASIL bu paydayla ölçülmeliydi.
  union all
  select 60, 'GERÇEK', 'harvest turu (payda)', count(*)::text
  from y where content like '%"kaynak"%'
  union all
  select 61, 'GERÇEK', '  ├ karar ekledi', count(*)::text
  from y where content like '%"kaynak"%'
    and coalesce(substring(content from '"eklenen":([0-9]+)')::int, 0) > 0
  union all
  select 62, 'GERÇEK', '  ├ hız sınırı ("not" var)', count(*)::text
  from y where content like '%"kaynak"%' and content like '%"not"%'
  union all
  select 63, 'GERÇEK', '  └ gerçekten boş (hepsi yinelenen)', count(*)::text
  from y where content like '%"kaynak"%' and content not like '%"not"%'
    and coalesce(substring(content from '"eklenen":([0-9]+)')::int, 0) = 0
  union all
  select 64, 'GERÇEK', '>> BOŞ TUR ORANI %',
         coalesce((
           select round(100.0 * count(*) filter (
                    where content not like '%"not"%'
                      and coalesce(substring(content from '"eklenen":([0-9]+)')::int, 0) = 0)
                  / nullif(count(*), 0), 1)::text
           from y where content like '%"kaynak"%'
         ), 'ölçülemedi')

  -- 7. ÖNCELİK UYARISI. Sütun yoksa hasat sessizce eski davranışa düşüyor.
  union all
  select 70, 'UYARI', 'oncelik sütunu yok uyarısı veren tur', count(*)::text
  from y where content like '%oncelik_sutunu_yok%'

  -- 8. DİSK NEREYE GİDİYOR — ASIL SORU BU.
  -- Ölçtüm (bugün, kaynağın kendisinden): bir Yargıtay kararının düz metni
  -- ortalama 8,3 KB. Ama diskte karar başına 32,7 KB harcıyoruz. Aradaki
  -- ~24 KB'ın nereye gittiğini BİLMİYORUM ve tahmin etmeyeceğim. İndeks
  -- boyutları katalogdan doğrudan okunabiliyor; sütun adları da öyle.
  -- (Sütun adlarını bilmeden pg_column_size yazamam: olmayan bir sütun adı
  -- sorguyu derleme anında düşürür. Bu yüzden önce adları istiyorum.)
  union all
  select 80, 'İNDEKS', s.indexrelname,
         pg_size_pretty(pg_relation_size(s.indexrelid))
  from pg_stat_user_indexes s where s.relname = 'ictihat_kararlar'
  union all
  select 90, 'SÜTUN', a.attname, format_type(a.atttypid, a.atttypmod)
  from pg_attribute a
  where a.attrelid = 'public.ictihat_kararlar'::regclass
    and a.attnum > 0 and not a.attisdropped
)
select bolum, alan, deger from satirlar order by sira, alan;
