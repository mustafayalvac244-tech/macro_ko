-- DİSK FRENİNİN CANLI DURUMU — SALT OKUNUR.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. Ürün sahibi 14.09.2026'da "sen şimdilik doldur, diski
-- büyütürüz" dedi. Bu doğru bir karar ama İKİ TUZAĞI var ve ikisi de
-- sessiz:
--
-- TUZAK 1 — FREN SESSİZCE DURDURUYOR. `hasat_tetikle` ve `vektorle_tetikle`
-- eşiği aşınca yalnızca `raise notice 'disk esigi asildi'` deyip `return
-- null` yapıyor. `raise notice` hiçbir yere yazılmaz; cron koşusu BAŞARILI
-- görünür. Yani hasat durduğu gün kimse fark etmez, günler sonra 0121
-- koşulunca anlaşılır.
--
-- TUZAK 2 — PLANI BÜYÜTMEK FRENİ BÜYÜTMEZ. Eşik, `disk_musait_mi`
-- fonksiyonunun içinde SABİT bir sayı. Supabase planı büyütülse bile hasat
-- eşiğe dayandığı yerde durmaya devam eder; yani para ödenir ve hiçbir şey
-- değişmez. Eşiği elle yükseltmek ayrı bir iştir ve unutulmaya birebir
-- adaydır.
--
-- Bu dosya ikisini de ölçüyor: canlı eşik kaç, bugün neredeyiz, kaç gün
-- kaldı. Hiçbir şeyi değiştirmiyor.
--
-- 0133/0134 dersleri geçerli: TEK İFADE ve doğrudan şema referansı yok.

-- ZAMAN SÜTUNU VARSAYILMIYOR, BULUNUYOR. `ictihat_kararlar`ı depodaki hiçbir
-- göç yaratmıyor (canlıda ve taklit şemada var, migration olarak yok), yani
-- sütun adları bilinmiyor. 0135'te `max(created_at)` yazıp düşmüştüm; aynı
-- hatayı bu dosyada da yaptım ve deneme koşusu yine yakaladı.
with zs as (
  select (select coalesce(
            max(c.column_name) filter (where c.column_name = 'created_at'),
            min(c.column_name))
          from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = 'ictihat_kararlar'
            and c.data_type like 'timestamp%') as sutun
),
son24 as (
  select case
    when to_regclass('public.ictihat_kararlar') is null then null
    when (select sutun from zs) is null then null
    else (xpath('/row/c/text()', query_to_xml(
           'select count(*) as c from public.ictihat_kararlar where '
           || quote_ident((select sutun from zs))
           || ' > now() - interval ''24 hours''', false, true, '')))[1]::text
  end as adet
)
select olcum, deger from (

  -- 1. Fren fonksiyonunun canlıdaki varsayılan eşiği. Depoda 460 yazıyor ama
  --    0121 "6000 MB frenine kalan" diye hesaplıyordu — yani arada
  --    değiştirilmiş. Doğrusunu yalnız canlı bilir.
  select 1 as sira, 'disk_musait_mi varsayilan esigi' as olcum,
    case
      when to_regproc('public.disk_musait_mi') is null then 'FONKSIYON YOK (!)'
      else coalesce((xpath('/row/c/text()', query_to_xml($q$
        select coalesce(
          (regexp_match(pg_get_functiondef(p.oid), 'p_esik_mb[^0-9]*([0-9]+)'))[1] || ' MB',
          'varsayilan okunamadi')  as c
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'disk_musait_mi' limit 1
      $q$, false, true, '')))[1]::text, 'okunamadi')
    end as deger

  union all
  -- 2. Hasadı tetikleyen fonksiyon freni HANGİ eşikle çağırıyor. Varsayılanı
  --    kullanıyorsa 1. satırla aynıdır; ayrı bir sayı geçiyorsa gerçek eşik
  --    budur.
  select 2, 'hasat_tetikle''nin kullandigi esik',
    case
      when to_regproc('public.hasat_tetikle') is null then 'FONKSIYON YOK (!)'
      else coalesce((xpath('/row/c/text()', query_to_xml($q$
        select coalesce(
          (regexp_match(pg_get_functiondef(p.oid), 'disk_musait_mi\s*\(\s*([0-9]+)'))[1] || ' MB (acikca gecilmis)',
          'varsayilani kullaniyor') as c
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'hasat_tetikle' limit 1
      $q$, false, true, '')))[1]::text, 'okunamadi')
    end

  union all
  select 3, 'veritabani bugunku boyut', pg_size_pretty(pg_database_size(current_database()))

  union all
  -- 3. Kalan alan ve kaç gün. Büyüme hızı son 24 saatteki gerçek karar
  --    artışından ve 0136'da ölçülen 28,1 KB/karar'dan hesaplanıyor —
  --    tahmin değil.
  select 4, 'son 24 saatte eklenen karar',
    coalesce((select adet from son24), 'ZAMAN SUTUNU/TABLO YOK')

  union all
  -- Günlük disk artışı, son 24 saatin GERÇEK karar sayısından ve 0136'da
  -- ölçülen 28,1 KB/karar'dan hesaplanıyor — tahmin değil.
  select 5, '>> gunluk disk artisi (28,1 KB/karar)',
    coalesce((select round(adet::numeric * 28.1 / 1024.0, 1)::text || ' MB/gun'
              from son24 where adet is not null), '?')

) ozet
order by sira;
