-- KATALOG DURUMU — "korpusun ne kadarı elimizde?" sorusunun ölçülebilir hâli.
-- ===========================================================================
-- Bu rapor, bugüne kadar CEVAPLAYAMADIĞIMIZ soruyu cevaplıyor. Terim tabanlı
-- hasatta "şu terimden 200 karar geldi"yi biliyorduk ama "elimizde NE YOK"u
-- bilmiyorduk. Katalog gün gün sayıldığı için artık kapsama bir tahmin değil,
-- sayım: "2024-03-05 tamamlandı".
--
-- REFERANS (bugün kaynağın kendisinden ölçüldü, tekrar sorulunca aynı çıkar):
--   Yargıtay  9.982.845
--   Danıştay    415.248
-- Yüzdeler bu iki sayıya göre.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.

with hedef as (
  select 'YARGITAYKARARI'::text as tur, 9982845::numeric as erisilebilir
  union all select 'DANISTAYKARAR', 415248
),
p as (
  select tur,
         count(*)::numeric                            as pencere,
         count(*) filter (where bitti)::numeric       as biten,
         count(*) filter (where son_calisma is null)::numeric as hic_islenmemis,
         min(gun) filter (where not bitti)            as en_eski_bekleyen,
         max(gun) filter (where bitti)                as en_yeni_biten
  from public.ictihat_katalog_pencere group by tur
),
kt as (
  select tur, count(*)::numeric as satir,
         count(*) filter (where metin_var)::numeric as metinli,
         min(karar_tarihi) as en_eski, max(karar_tarihi) as en_yeni
  from public.ictihat_katalog group by tur
),
satirlar as (
  select 10::numeric as sira, 'KATALOG' as bolum, h.tur as alan,
         to_char(coalesce(kt.satir, 0), 'FM999G999G999') || ' / '
         || to_char(h.erisilebilir, 'FM999G999G999')
         || '   %' || round(100.0 * coalesce(kt.satir, 0) / h.erisilebilir, 3) as deger
  from hedef h left join kt on kt.tur = h.tur
  union all
  select 20, 'PENCERE', p.tur,
         'biten ' || p.biten || ' / ' || p.pencere
         || '  (%' || round(100.0 * p.biten / nullif(p.pencere, 0), 1) || ')'
         || ' · hiç işlenmemiş ' || p.hic_islenmemis
  from p
  union all
  select 21, 'PENCERE', p.tur || ' · en yeni biten gün', coalesce(p.en_yeni_biten::text, '(yok)') from p
  union all
  select 22, 'PENCERE', p.tur || ' · en eski bekleyen gün', coalesce(p.en_eski_bekleyen::text, '(yok)') from p

  -- METİN KATMANI: katalogdaki kaç kararın tam metni de var?
  union all
  select 30, 'METİN', kt.tur,
         to_char(kt.metinli, 'FM999G999G999') || ' / ' || to_char(kt.satir, 'FM999G999G999')
         || '   %' || round(100.0 * kt.metinli / nullif(kt.satir, 0), 2)
  from kt
  union all
  select 31, 'METİN', 'ictihat_kararlar (tüm kaynaklar)',
         to_char(count(*), 'FM999G999G999') from public.ictihat_kararlar

  -- SON SAATİN HIZI: katalog ve metin ayrı ayrı.
  union all
  select 40, 'HIZ', 'son 1 saatte eklenen katalog satırı',
         to_char(count(*), 'FM999G999G999')
  from public.ictihat_katalog where eklendi > now() - interval '1 hour'
  union all
  select 41, 'HIZ', 'son 1 saatte eklenen tam metin',
         to_char(count(*), 'FM999G999G999')
  from public.ictihat_kararlar where created_at > now() - interval '1 hour'

  -- MALİYET: katalog satırı gerçekten ucuz mu? Tahmin 172 bayt/kararmış.
  union all
  select 50, 'DİSK', 'katalog tablosu + indeksleri',
         pg_size_pretty(pg_total_relation_size('public.ictihat_katalog'))
  union all
  select 51, 'DİSK', '>> katalog satırı başına bayt',
         coalesce(round(pg_total_relation_size('public.ictihat_katalog')::numeric
                        / nullif((select count(*) from public.ictihat_katalog), 0))::text, 'satır yok')
  union all
  select 52, 'DİSK', '>> 10,4 milyon satır bu hızda kaç GB',
         coalesce(round(pg_total_relation_size('public.ictihat_katalog')::numeric
                        / nullif((select count(*) from public.ictihat_katalog), 0)
                        * 10400000 / 1024 / 1024 / 1024, 1)::text || ' GB', 'ölçülemedi')
)
select bolum, alan, deger from satirlar order by sira, alan;
