-- TEŞHİS ARACININ KENDİSİ ÇÖKTÜ — cron.job_run_details'te `jobname` YOK.
-- ---------------------------------------------------------------------------
-- CANLIDA ALINAN HATA (kullanıcı çalıştırdı, ekran görüntüsüyle geldi):
--     ERROR: 42703: column d.jobname does not exist
--     CONTEXT: PL/pgSQL function hasat_saglik() line 64 at RETURN QUERY
--
-- HATAYI BEN YAPTIM. pg_cron'da `cron.job` tablosunda jobname VARDIR, ama
-- `cron.job_run_details` tablosunda YOKTUR — orada yalnız `jobid` bulunur
-- (sütunlar: jobid, runid, job_pid, database, username, command, status,
-- return_message, start_time, end_time). İş adını görmek için cron.job ile
-- birleştirmek gerekir. Ben ikisini aynı sanıp doğrudan d.jobname yazdım.
--
-- NEDEN YEREL TEZGÂH YAKALAMADI: taklitte cron.job_run_details tablosu HİÇ
-- YOKTU. 0101'deki `if to_regclass('cron.job_run_details') is not null`
-- koruması yüzünden o blok yerelde hiç çalışmadı ve sınanmamış kod canlıya
-- gitti. Koruma, hatayı engellemedi — SAKLADI. Taklide tablo eklendi (doğru
-- sütunlarla, jobname OLMADAN) ki aynı sınıf hata bir daha yerelde çıksın.
--
-- İKİNCİ VE ASIL DERS: bir TEŞHİS aracı, teşhis edilecek şeye dönüşmemeli.
-- Tek bir yanlış sütun adı, raporun TAMAMINI götürdü — disk, migration izleri
-- ve cron işleri satırları zaten hesaplanmıştı ama hepsi çöpe gitti. Artık her
-- isteğe bağlı bölüm kendi exception bloğunda: bir bölüm patlarsa yalnız o
-- satır "ölçülemedi: <hata>" olarak görünür, rapor ayakta kalır.

create or replace function public.hasat_saglik()
returns table(bolum text, alan text, deger text)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'net', 'cron'
as $$
declare
  v_esik integer;
begin
  -- ── 1) DİSK VE EMNİYET FRENİ ──────────────────────────────────────────────
  begin
    select substring(pg_get_function_arguments(p.oid) from 'DEFAULT[[:space:]]+([0-9]+)')::integer
      into v_esik
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'disk_musait_mi'
    limit 1;

    return query select 'disk', 'veritabani_mb',
      round(pg_database_size(current_database()) / 1024.0 / 1024.0, 1)::text;
    return query select 'disk', 'hasat_esigi_mb', coalesce(v_esik::text, 'FONKSİYON YOK');
    return query select 'disk', 'fren_durumu',
      case
        when v_esik is null then 'BİLİNMİYOR'
        when pg_database_size(current_database()) < v_esik::bigint * 1024 * 1024 then 'açık (hasat serbest)'
        else 'KAPALI — eşik aşıldı, hasat kendini durdurdu'
      end;
  exception when others then
    return query select 'disk', 'HATA', sqlerrm;
  end;

  -- ── 2) MIGRATION İZLERİ ───────────────────────────────────────────────────
  begin
    return query select '0093', 'oncelik_sutunu',
      case when exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ictihat_harvest_state' and column_name = 'oncelik'
      ) then 'VAR (0093 uygulanmış)' else 'YOK → 0093 UYGULANMAMIŞ' end;

    return query select '0093', 'tazeleme_fonksiyonu',
      case when to_regprocedure('public.hasat_onceligini_tazele()') is not null
        then 'VAR' else 'YOK' end;

    return query select '0103', 'tr_kucult',
      case when to_regprocedure('public.tr_kucult(text)') is not null
        then 'VAR (0103 uygulanmış)' else 'YOK → 0103 UYGULANMAMIŞ' end;

    return query select '0102', 'yedekten_silme',
      case when to_regprocedure('backup.kullaniciyi_yedeklerden_sil(uuid)') is not null
        then 'VAR (0102 uygulanmış)' else 'YOK → 0102 UYGULANMAMIŞ' end;

    return query select '0104', 'tr_kucult anon''a kapalı mı',
      case
        when to_regprocedure('public.tr_kucult(text)') is null then 'fonksiyon yok'
        when has_function_privilege('anon', 'public.tr_kucult(text)', 'EXECUTE')
          then 'HAYIR — HÂLÂ AÇIK, 0104 uygulanmamış'
        else 'evet (0104 uygulanmış)'
      end;
  exception when others then
    return query select 'migration', 'HATA', sqlerrm;
  end;

  -- ── 3) ZAMANLI İŞLER ──────────────────────────────────────────────────────
  begin
    if to_regclass('cron.job') is null then
      return query select 'cron', 'durum', 'pg_cron YOK';
    else
      return query
        select 'cron', j.jobname,
               j.schedule || '   ' || case when j.active then '[açık]' else '[KAPALI]' end
        from cron.job j
        where j.jobname like 'vekil\_%'
        order by j.jobname;

      return query select '0094', 'hasat_hizi',
        case
          when exists (select 1 from cron.job where jobname = 'vekil_hasat_yargitay' and schedule like '%/3 %')
            then 'HIZLI (0094 uygulanmış)'
          when exists (select 1 from cron.job where jobname = 'vekil_hasat_yargitay')
            then 'YAVAŞ → 0094 UYGULANMAMIŞ'
          else 'İŞ YOK'
        end;
    end if;
  exception when others then
    return query select 'cron', 'HATA', sqlerrm;
  end;

  -- ── 4) CRON ÇALIŞMA SONUÇLARI (son 24 saat) ───────────────────────────────
  -- DÜZELTME: job_run_details'te jobname YOK, jobid var. cron.job ile
  -- birleştiriyoruz. left join bilinçli: silinmiş bir işin geçmiş kayıtları
  -- da görünsün, aksi hâlde "iş kaldırılmış ama eskiden hata veriyordu"
  -- bilgisi sessizce kaybolurdu.
  begin
    if to_regclass('cron.job_run_details') is not null then
      return query
        select 'cron_sonuc',
               coalesce(j.jobname, 'jobid ' || d.jobid::text) || ' / ' || d.status,
               count(*)::text
        from cron.job_run_details d
        left join cron.job j on j.jobid = d.jobid
        where d.start_time > now() - interval '24 hours'
          and coalesce(j.jobname, d.command) like '%vekil%'
        group by 1, 2
        order by 2;

      if not exists (
        select 1 from cron.job_run_details d
        left join cron.job j on j.jobid = d.jobid
        where d.start_time > now() - interval '24 hours'
          and coalesce(j.jobname, d.command) like '%vekil%'
      ) then
        return query select 'cron_sonuc', 'son_24s', 'HİÇ ÇALIŞMA KAYDI YOK — cron işleri tetiklenmemiş';
      end if;

      -- Son başarısız çalışmanın mesajı: sebep genelde burada yazar.
      return query
        select 'cron_sonuc', 'son_hata',
               left(coalesce(d.return_message, '(mesaj yok)'), 300)
        from cron.job_run_details d
        left join cron.job j on j.jobid = d.jobid
        where d.status <> 'succeeded'
          and d.start_time > now() - interval '24 hours'
          and coalesce(j.jobname, d.command) like '%vekil%'
        order by d.start_time desc
        limit 1;
    else
      return query select 'cron_sonuc', 'durum', 'cron.job_run_details YOK';
    end if;
  exception when others then
    return query select 'cron_sonuc', 'ölçülemedi', sqlerrm;
  end;

  -- ── 5) EDGE İŞLEVİNİN GERÇEK YANITLARI ────────────────────────────────────
  -- ASIL KANIT BURADA. Cron "succeeded" yazsa bile burada 500 varsa hasat
  -- çalışmıyordur: hasat_tetikle net.http_post ile ateşle-unut çağırıyor ve
  -- yanıta kimse bakmıyor. pg_net yanıtları kısa süre saklar; boş gelmesi
  -- "her şey yolunda" DEĞİL, "yanıt penceresi boş" demektir.
  begin
    if to_regclass('net._http_response') is not null then
      -- DİKKAT: `group by 1` YETMEZ — 1 sabit metindir, status_code değil.
      -- 0101'de bunu da yanlış yazmıştım; yerel koşuda "must appear in the
      -- GROUP BY clause" hatası verdi. Doğrusu `group by 1, 2`.
      return query
        select 'edge_yanit', coalesce(r.status_code::text, 'yanıt yok'), count(*)::text
        from net._http_response r
        where r.created > now() - interval '24 hours'
        group by 1, 2
        order by 2;

      -- Sessizlik belirsizdir: hiç yanıt yoksa bunu AÇIKÇA yaz. Boş bir bölüm
      -- "sorun yok" diye okunurdu, oysa "hiç çağrı gitmemiş" de olabilir.
      if not exists (select 1 from net._http_response r where r.created > now() - interval '24 hours') then
        return query select 'edge_yanit', 'son_24s', 'HİÇ YANIT YOK — ya çağrı gitmedi ya pencere boşaldı';
      end if;

      return query
        select 'edge_yanit', 'son_hata',
               left(coalesce(r.content, r.error_msg, '(gövde yok)'), 300)
        from net._http_response r
        where (r.status_code is null or r.status_code >= 400)
          and r.created > now() - interval '24 hours'
        order by r.created desc
        limit 1;
    else
      return query select 'edge_yanit', 'durum', 'net._http_response YOK (pg_net?)';
    end if;
  exception when others then
    return query select 'edge_yanit', 'ölçülemedi', sqlerrm;
  end;

  -- ── 6) HAVUZ ──────────────────────────────────────────────────────────────
  begin
    if to_regclass('public.ictihat_kararlar') is not null then
      return query select 'havuz', 'toplam_karar', count(*)::text from public.ictihat_kararlar;

      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ictihat_kararlar' and column_name = 'created_at'
      ) then
        return query execute
          $q$ select 'havuz', 'son_24s_eklenen', count(*)::text
              from public.ictihat_kararlar where created_at > now() - interval '24 hours' $q$;
      else
        return query select 'havuz', 'son_24s_eklenen', 'created_at sütunu yok — ölçülemedi';
      end if;

      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ictihat_kararlar' and column_name = 'embedding'
      ) then
        return query execute
          $q$ select 'havuz', 'vektorsuz_karar', count(*)::text
              from public.ictihat_kararlar where embedding is null $q$;
      end if;

      -- KURUL DAĞILIMI. "En önemli içtihatları alalım" kararı ancak buna
      -- bakarak verilebilir: havuzun kaçta kaçı Yargıtay/Danıştay, kaçta kaçı
      -- yerel? Üç kaynak şu an EŞİT hızda; eşitliğin doğru olup olmadığını
      -- söyleyecek tek kanıt bu satırlar.
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ictihat_kararlar' and column_name = 'kurul'
      ) then
        return query execute
          $q$ select 'havuz_kurul', coalesce(kurul, '(boş)'), count(*)::text
              from public.ictihat_kararlar group by 1, 2 order by count(*) desc $q$;
      end if;
    end if;
  exception when others then
    return query select 'havuz', 'ölçülemedi', sqlerrm;
  end;

  -- ── 7) TERİMLER ───────────────────────────────────────────────────────────
  begin
    if to_regclass('public.ictihat_harvest_state') is not null then
      return query select 'terimler', 'terim_sayisi', count(*)::text from public.ictihat_harvest_state;
      return query select 'terimler', 'bitmis_terim', count(*) filter (where done)::text
        from public.ictihat_harvest_state;
      return query select 'terimler', 'son_1s_islenen', count(*) filter (where last_run > now() - interval '1 hour')::text
        from public.ictihat_harvest_state;

      -- Hepsi tabandaysa (100) tazeleme hiç ayrıştırmamış demektir.
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'ictihat_harvest_state' and column_name = 'oncelik'
      ) then
        return query execute
          $q$ select 'terimler', 'oncelik_dagilimi',
                     case when count(*) = 0 then 'terim yok'
                          when count(distinct oncelik) = 1
                            then 'HEPSİ ' || min(oncelik) || ' — tazeleme hiç ayrıştırmamış'
                          else 'en düşük ' || min(oncelik) || ' / en yüksek ' || max(oncelik) ||
                               ' / farklı değer ' || count(distinct oncelik)
                     end
              from public.ictihat_harvest_state $q$;
      end if;
    end if;
  exception when others then
    return query select 'terimler', 'ölçülemedi', sqlerrm;
  end;
end;
$$;

comment on function public.hasat_saglik() is
  'Hasat zincirinin tek çağrıda teşhisi: disk freni, migration izleri, cron işleri ve sonuçları, edge yanıtları, havuz, kurul dağılımı, terimler. Yalnız okur; her bölüm kendi hata kalkanında.';

revoke all on function public.hasat_saglik() from public, anon, authenticated;
grant execute on function public.hasat_saglik() to service_role;
