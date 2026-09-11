-- KAPASİTE ÖLÇÜMÜ — "kaç kişi kullanabilir" sorusuna SAYIYLA cevap.
-- ŞEMA DEĞİŞTİRMEZ; yalnız okur. Tekrar tekrar uygulanabilir.
-- ===========================================================================
-- Soru: web sürümünü kaç kişi kullanabilir ve bunu bedava mı yapıyoruz?
-- Cevap üç ayrı yerde birden sınırlanıyor ve en küçüğü hangisiyse tavan odur:
--   1. GitHub Pages  — statik dosya trafiği (bu dosyanın göremediği yer)
--   2. Supabase      — veritabanı boyutu, bağlantı sayısı, uç çağrıları
--   3. Anthropic     — yalnız AI katmanı; ücretsiz kullanıcıyı ilgilendirmez
--
-- Bu dosya 2. maddeyi ölçer: disk, tablo boyutları, bağlantı tavanı, kayıtlı
-- kullanıcı ve gerçek etkinlik. 1 ve 3 kod dışında, raporda ayrıca yazılır.

select 'DISK' as bolum, 'veritabanı toplam' as alan,
       pg_size_pretty(pg_database_size(current_database())) as deger
union all
select 'DISK', 'en büyük 5 tablo: ' || relname,
       pg_size_pretty(pg_total_relation_size(relid))
from pg_catalog.pg_statio_user_tables
where relid in (
  select relid from pg_catalog.pg_statio_user_tables
  order by pg_total_relation_size(relid) desc limit 5
)
union all
select 'BAĞLANTI', 'tavan (max_connections)', current_setting('max_connections')
union all
select 'BAĞLANTI', 'şu an kullanılan', count(*)::text from pg_stat_activity
union all
select 'KULLANICI', 'kayıtlı hesap', count(*)::text from auth.users
union all
select 'KULLANICI', 'son 30 günde giriş yapan',
       count(*)::text from auth.users where last_sign_in_at > now() - interval '30 days'
union all
select 'KULLANICI', 'ücretli (is_premium)', count(*)::text from public.profiles where is_premium
union all
select 'KULLANICI', 'AI katmanı', count(*)::text from public.profiles where ai_tier = 'ai'
union all
select 'İÇERİK', 'içtihat kararı', count(*)::text from public.ictihat_kararlar
union all
select 'İÇERİK', 'mevzuat maddesi', count(*)::text from public.mevzuat_maddeleri
union all
-- SATIR SAYISI DEĞİL, BÜYÜME HIZI ÖNEMLİ: disk tavanına ne zaman varacağımızı
-- bu belirliyor.
select 'BÜYÜME', 'son 24 saatte eklenen karar',
       count(*)::text from public.ictihat_kararlar where eklendi > now() - interval '24 hours'
order by 1, 2;
