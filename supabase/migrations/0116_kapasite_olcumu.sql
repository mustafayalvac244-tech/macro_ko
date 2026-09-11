-- KAPASİTE ÖLÇÜMÜ — "kaç kişi kullanabilir" sorusuna SAYIYLA cevap.
-- ŞEMA DEĞİŞTİRMEZ; yalnız okur. Tekrar tekrar uygulanabilir.
-- ===========================================================================
-- Web sürümünü kaç kişi kullanabilir? Tavan üç ayrı yerde birden belirlenir
-- ve en küçüğü hangisiyse gerçek tavan odur:
--   1. GitHub Pages  — statik dosya trafiği (buradan görülemez, raporda)
--   2. Supabase      — disk, bağlantı, uç çağrıları  ← bu dosya bunu ölçer
--   3. Anthropic     — yalnız AI katmanı; ücretsiz kullanıcıyı ilgilendirmez
--
-- İLK SÜRÜM HATA VERDİ: ictihat_kararlar'da "eklendi" sütunu olduğunu
-- VARSAYDIM, yokmuş (42703). O tablo depodaki hiçbir migration'da
-- tanımlı değil — canlıda elle açılmış, yani sütunlarını bilmiyoruz.
-- Bu sürüm hiçbir sütun adı varsaymıyor: zaman sütununu
-- information_schema'dan BULUYOR, yoksa "ölçülemedi" yazıyor.

create temp table rapor (bolum text, alan text, deger text);

insert into rapor values
  ('1-DISK', 'veritabanı toplam', pg_size_pretty(pg_database_size(current_database()))),
  ('2-BAĞLANTI', 'tavan (max_connections)', current_setting('max_connections')),
  ('2-BAĞLANTI', 'şu an açık', (select count(*)::text from pg_stat_activity));

insert into rapor
select '1-DISK', 'tablo: ' || relname, pg_size_pretty(pg_total_relation_size(relid))
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc limit 6;

insert into rapor values
  ('3-KULLANICI', 'kayıtlı hesap', (select count(*)::text from auth.users)),
  ('3-KULLANICI', 'son 30 günde giren',
     (select count(*)::text from auth.users where last_sign_in_at > now() - interval '30 days')),
  ('3-KULLANICI', 'son 24 saatte giren',
     (select count(*)::text from auth.users where last_sign_in_at > now() - interval '24 hours')),
  ('3-KULLANICI', 'ücretli (is_premium)', (select count(*)::text from public.profiles where is_premium)),
  ('3-KULLANICI', 'AI katmanı', (select count(*)::text from public.profiles where ai_tier = 'ai')),
  ('4-İÇERİK', 'içtihat kararı', (select count(*)::text from public.ictihat_kararlar)),
  ('4-İÇERİK', 'mevzuat maddesi', (select count(*)::text from public.mevzuat_maddeleri));

-- BÜYÜME: disk tavanına ne zaman varacağımızı bu belirler. Zaman sütununun
-- ADI BİLİNMİYOR (tablo elle açılmış), o yüzden aranıyor.
do $$
declare sutun text; n bigint;
begin
  select column_name into sutun
  from information_schema.columns
  where table_schema = 'public' and table_name = 'ictihat_kararlar'
    and data_type in ('timestamp with time zone', 'timestamp without time zone')
  order by case column_name when 'eklendi' then 0 when 'created_at' then 1 else 2 end
  limit 1;

  if sutun is null then
    insert into rapor values ('5-BÜYÜME', 'son 24 saatte eklenen karar',
      'ÖLÇÜLEMEDİ — ictihat_kararlar''da zaman sütunu yok');
  else
    execute format('select count(*) from public.ictihat_kararlar where %I > now() - interval ''24 hours''', sutun) into n;
    insert into rapor values ('5-BÜYÜME', 'son 24 saatte eklenen karar (' || sutun || ')', n::text);
  end if;
end $$;

-- Kaydı olan tabloların satır sayısı: hangi özelliğin gerçekten
-- kullanıldığını gösterir (boş tablo = kimse kullanmıyor).
insert into rapor
select '6-KULLANIM', 'satır: ' || relname, n_live_tup::text
from pg_stat_user_tables
where relname in ('cases','clients','documents','hearings','ai_istek','ai_usage','oturum_cihazlari')
order by relname;

select * from rapor order by bolum, alan;
