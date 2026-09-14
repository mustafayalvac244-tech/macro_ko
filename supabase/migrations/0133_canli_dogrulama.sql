-- CANLI DOĞRULAMA — SALT OKUNUR. Hiçbir şeyi değiştirmez.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. 14.09.2026'da 0131 (zaman kaydı) ve 0132 (eksik indeksler)
-- canlıya uygulandı ve iş akışı "UYGULANDI" dedi. Ama "uygulandı" ile
-- "doğru oturdu" aynı şey değil: göç hatasız koşup yine de beklenenden
-- farklı bir şema bırakabilir (sütun tipi, kısıt, politika, tetikleyici).
--
-- Yerelde ölçmüştüm ama yerel ≠ canlı: canlıda pgvector var, pg_cron var,
-- KURULUM.sql çalıştırılmış ve 130 göç birikmiş. Bu dosya o farkı kapatıyor.
--
-- 0116/0120/0121 ile aynı desen: yazmayan, yalnız ölçen göç. Çıktısı
-- Actions kaydında görünür.

-- ⚠️ HEPSİ TEK SORGU — SEBEBİ ÖNEMLİ.
-- İlk yazımda sekiz ayrı `select` vardı ve canlıda koşunca YALNIZ SONUNCUSU
-- döndü; yedi ölçüm sessizce kayboldu. Uygulayıcı (Supabase Management API,
-- tıpkı SQL Editor gibi) çok ifadeli bir dosyada yalnız son ifadenin
-- satırlarını veriyor. Bu, göç dosyasının kendi başlığında da yazılıydı;
-- okumadan yazdım.
-- Çözüm: UNION ALL ile tek ifade. Sıra `sira` sütunuyla korunuyor.

select olcum, deger from (

  -- 1. Zaman kaydı tablosu gerçekten var mı ve şekli doğru mu
  select 1 as sira, 'time_entries sutunlari' as olcum,
    coalesce(string_agg(column_name || ':' || data_type, ', ' order by ordinal_position), 'TABLO YOK (!)') as deger
  from information_schema.columns
  where table_schema = 'public' and table_name = 'time_entries'

  union all
  -- 2. amount GERÇEKTEN hesaplanan sütun mu. Sıradan sütun olsaydı uygulama
  --    ne yazarsa o kalırdı ve ekranla rapor ayrışabilirdi.
  select 2, 'amount hesaplanan mi',
    coalesce(max(is_generated), 'SUTUN YOK (!)')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'time_entries' and column_name = 'amount'

  union all
  -- 3. CHECK kısıtları duruyor mu (minutes 1..1440, açıklama boş olamaz)
  select 3, 'time_entries kisitlari',
    coalesce(string_agg(conname, ', ' order by conname), 'KISIT YOK (!)')
  from pg_constraint
  where conrelid = to_regclass('public.time_entries') and contype = 'c'

  union all
  -- 4. RLS. Kapalıysa her avukat herkesin çalışma kaydını görür.
  select 4, 'time_entries RLS',
    coalesce(max(case
      when c.relrowsecurity then 'ACIK · politika: ' || coalesce(
        (select string_agg(polname, ', ') from pg_policy p where p.polrelid = c.oid), 'YOK (!)')
      else 'KAPALI (!)'
    end), 'TABLO YOK (!)')
  from pg_class c
  where c.oid = to_regclass('public.time_entries')

  union all
  -- 5. Sahiplik tetikleyicisi. Bu olmadan bir kullanıcı BAŞKASININ dosya
  --    kimliğine kayıt iliştirebilir; göremez ama o dosya silinince kaydı
  --    da silinir (sessiz veri kaybı).
  select 5, 'sahiplik tetikleyicisi',
    coalesce(string_agg(tgname, ', '), 'YOK (!)')
  from pg_trigger
  where tgrelid = to_regclass('public.time_entries') and not tgisinternal

  union all
  -- 6. profiles.hourly_rate eklendi mi
  select 6, 'profiles.hourly_rate',
    coalesce(max(data_type), 'SUTUN YOK (!)')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'hourly_rate'

  union all
  -- 7. 0132'den sonra indekssiz yabancı anahtar kaldı mı.
  --    Eczane tabloları sayımın DIŞINDA: AGENTS.md gereği onlara
  --    dokunulmuyor, sayıma girerlerse her koşuda yanlış alarm verirler.
  select 7, 'indekssiz FK (bizim tablolar)',
    coalesce(string_agg(t.ad, ', ' order by t.ad), 'yok - temiz')
  from (
    select c.conrelid::regclass::text || '.' || a.attname as ad
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
      and array_length(c.conkey, 1) = 1
      and cl.relname not in ('kullanici_ilaclar', 'kullanici_alimlar', 'ilaclar', 'prospektusler')
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
      )
  ) t

  union all
  -- 8. Kullanımda mı. Sıfırdan büyükse özellik kullanılmaya başlanmış.
  select 8, 'canli zaman kaydi sayisi', count(*)::text from public.time_entries

) ozet
order by sira;
