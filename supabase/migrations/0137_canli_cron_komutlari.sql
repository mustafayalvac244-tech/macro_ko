-- CANLIDA HANGİ HASAT KOMUTU KOŞUYOR — SALT OKUNUR.
-- ---------------------------------------------------------------------------
-- NEDEN VAR. Hasat ayarını değiştirmeden önce canlının GERÇEKTE ne yaptığını
-- görmem gerekiyor ve depo bunu güvenilir biçimde söylemiyor:
--   • 0125 `vekil_hasat_yargitay`i 'katalog' moduna çeviriyor (enFazla 40),
--   • ama 0135 ölçümünde canlıdaki ZAMANLAMALAR 0125'tekiyle uyuşmuyordu
--     (canlı: katalog_yargitay '0-59/4,1-59/4,2-59/4'; 0125: '0-59/2'),
--   • yani aradan 0126/0127/0129 geçmiş ve son durumu yalnız cron.job bilir.
--
-- Yanlış işi kısmak iki yönden de pahalı: metin hasadını kısarsam havuz
-- büyümesi durur, katalogu kısacağım yerde başkasını kısarsam hiçbir şey
-- düzelmez. Komut metnini görmeden ayar değiştirmek tahminle çalışmaktır.
--
-- 0121 ölçümü (14.09.2026) ayrıca şunu gösterdi: katalog upsert'i
-- "canceling statement due to statement timeout" ile düşüyor ve o turda
-- istenen 40 kaydın 0'ı yazılıyor. Hangi işin hangi kotayla çağrıldığı
-- burada görünecek.
--
-- 0133/0134 dersleri: TEK İFADE, ve hiçbir şemaya doğrudan referans yok
-- (cron.job yoksa ayrıştırma aşamasında patlardı).

select olcum, deger from (

  -- 1. Hasat/katalog işlerinin TAM komutu. Kotalar (enFazla) burada görünür.
  select 1 as sira, 'hasat isleri (ad | zamanlama | komut | aktif)' as olcum,
    case
      when to_regclass('cron.job') is null then 'pg_cron KURULU DEGIL'
      else coalesce((xpath('/row/c/text()', query_to_xml($q$
        select string_agg(
                 jobname || E'\n      ' || schedule || E'\n      ' ||
                 regexp_replace(command, '\s+', ' ', 'g') ||
                 case when active then '' else '  [PASIF]' end,
                 E'\n  ' order by jobname) as c
        from cron.job
        where jobname like '%hasat%' or jobname like '%katalog%' or jobname like '%vektorle%'
      $q$, false, true, '')))[1]::text, 'HASAT ISI YOK')
    end as deger

  union all
  -- 2. Hasat dışı işler — bütçeyi onlar da paylaşıyor.
  select 2, 'diger zamanlanmis isler',
    case
      when to_regclass('cron.job') is null then 'pg_cron KURULU DEGIL'
      else coalesce((xpath('/row/c/text()', query_to_xml($q$
        select string_agg(jobname || ' [' || schedule || ']', ', ' order by jobname) as c
        from cron.job
        where not (jobname like '%hasat%' or jobname like '%katalog%' or jobname like '%vektorle%')
      $q$, false, true, '')))[1]::text, 'YOK')
    end

  union all
  -- 3. Son koşularda hata var mı. cron.job_run_details her koşuyu yazar;
  --    işin kendisi başarılı görünse de içerideki edge çağrısı düşmüş
  --    olabilir — o yüzden 0121'deki edge yanıt kaydı ayrı bakılıyor.
  select 3, 'son 2 saatte basarisiz cron kosusu',
    case
      when to_regclass('cron.job_run_details') is null then 'KAYIT TABLOSU YOK'
      else coalesce((xpath('/row/c/text()', query_to_xml($q$
        select coalesce(string_agg(jobname || ': ' || status || ' — ' ||
                 coalesce(left(return_message, 80), ''), '; '), 'yok - temiz') as c
        from cron.job_run_details
        where start_time > now() - interval '2 hours' and status <> 'succeeded'
      $q$, false, true, '')))[1]::text, 'yok - temiz')
    end

) ozet
order by sira;
