-- HASAT TEŞHİSİ — "çalışıyor mu?" sorusunun TEK ÇALIŞTIRMAYLA cevabı.
-- ---------------------------------------------------------------------------
-- BULUNAN YAPISAL KUSUR: hasadın çalışıp çalışmadığını GÖREBİLECEĞİMİZ hiçbir
-- yer yok. Zincir şöyle:
--
--   pg_cron  →  public.hasat_tetikle()  →  net.http_post(...)  →  harvest-tick
--
-- `net.http_post` ateşle-unut çağırır: bir istek kimliği döndürür ve BİTER.
-- harvest-tick 500 dönse de, 403 dönse de, hiç cevap vermese de hasat_tetikle
-- BAŞARILI sayılır; cron da işi "succeeded" yazar. Yani hasat haftalarca
-- tamamen kapalı olabilir ve hiçbir yerde kırmızı bir satır görünmez.
--
-- Bu SOMUT bir risk, kuramsal değil: harvest-tick terim seçerken
-- `ictihat_harvest_state.oncelik` sütununa göre sıralıyor (migration 0093).
-- O migration uygulanmadıysa PostgREST 42703 döndürür, işlev 500 verir ve
-- HİÇBİR KARAR TOPLANMAZ — sessizce. (Bu sürümde harvest-tick'e geri düşüş
-- eklendi, ama görünürlük eksiği yine de kapatılmalı: bir dahaki sessiz arıza
-- başka bir sebepten olacak.)
--
-- ÇÖZÜM: net._http_response'u OKUYAN bir teşhis. Yanıtlar zaten orada
-- duruyordu; kimse bakmıyordu.
--
-- DÜRÜSTLÜK NOTU: bu dosya hiçbir şeyi ONARMAZ, yalnız ÖLÇER. "Hasat
-- çalışıyor" cümlesini ancak bunun çıktısına bakarak kurabiliriz; öncesinde
-- kurduysak tahmin etmişiz demektir.

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
  -- Eşik fonksiyonun varsayılanına gömülü; hasat_tetikle onu argümansız
  -- çağırıyor. Bu yüzden GERÇEK eşik = pg_proc'taki varsayılan değer.
  -- Varsayılanı düz metinden çekiyoruz. Desen eşleşmezse NULL kalır ve
  -- "BİLİNMİYOR" yazarız; uydurulmuş bir sayı yazmak yanlış güven verirdi.
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

  -- ── 2) MIGRATION İZLERİ ───────────────────────────────────────────────────
  -- Migration'ların uygulanıp uygulanmadığını "dosya var mı" diye değil,
  -- ŞEMADA İZİ VAR MI diye sorarız. Tek güvenilir kanıt budur.
  return query select '0093', 'oncelik_sutunu',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ictihat_harvest_state' and column_name = 'oncelik'
    ) then 'VAR (0093 uygulanmış)' else 'YOK → 0093 UYGULANMAMIŞ' end;

  return query select '0093', 'tazeleme_fonksiyonu',
    case when to_regprocedure('public.hasat_onceligini_tazele()') is not null
      then 'VAR' else 'YOK' end;

  -- ── 3) ZAMANLI İŞLER ──────────────────────────────────────────────────────
  if to_regclass('cron.job') is null then
    return query select 'cron', 'durum', 'pg_cron YOK';
  else
    return query
      select 'cron', j.jobname,
             j.schedule || '   ' || case when j.active then '[açık]' else '[KAPALI]' end
      from cron.job j
      where j.jobname like 'vekil\_%'
      order by j.jobname;

    -- 0094'ün imzası: üç kaynak da 3 dakikada bir. Eski hâli 20 dakikada bir.
    return query select '0094', 'hasat_hizi',
      case
        when exists (select 1 from cron.job where jobname = 'vekil_hasat_yargitay' and schedule like '%/3 %')
          then 'HIZLI (0094 uygulanmış)'
        when exists (select 1 from cron.job where jobname = 'vekil_hasat_yargitay')
          then 'YAVAŞ → 0094 UYGULANMAMIŞ'
        else 'İŞ YOK'
      end;
  end if;

  -- ── 4) CRON ÇALIŞMA SONUÇLARI (son 24 saat) ───────────────────────────────
  if to_regclass('cron.job_run_details') is not null then
    return query
      select 'cron_sonuc', d.jobname || ' / ' || d.status, count(*)::text
      from cron.job_run_details d
      where d.start_time > now() - interval '24 hours' and d.jobname like 'vekil\_%'
      group by 1, 2
      order by 2;
  end if;

  -- ── 5) EDGE İŞLEVİNİN GERÇEK YANITLARI ────────────────────────────────────
  -- ASIL KANIT BURADA. Cron "succeeded" yazsa bile burada 500 varsa hasat
  -- çalışmıyordur. pg_net yanıtları kısa süre saklar; boş gelmesi "her şey
  -- yolunda" DEĞİL, "yanıt penceresi boş" demektir.
  if to_regclass('net._http_response') is not null then
    return query
      select 'edge_yanit', coalesce(r.status_code::text, 'yanıt yok'), count(*)::text
      from net._http_response r
      where r.created > now() - interval '24 hours'
      group by 1
      order by 1;

    -- Son başarısız yanıtın gövdesi: sebebi genelde tek satırda yazar.
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

  -- ── 6) HAVUZ ──────────────────────────────────────────────────────────────
  -- DİKKAT: ictihat_kararlar ve ictihat_harvest_state bu depodaki
  -- migration'larla YARATILMADI; yalnız canlı veritabanında var (0093'teki
  -- kırılganlık notu da bunu söylüyor). Bu yüzden sütun adları burada
  -- VARSAYILMAZ, information_schema'dan doğrulanır — yoksa sorgu yazmak yerine
  -- "sütun yok" deriz. Var sayıp patlamak, teşhis aracını teşhis edilecek şeye
  -- çevirirdi.
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

    -- KURUL DAĞILIMI. "En önemli içtihatları alalım" kararı ancak bu satırlara
    -- bakarak verilebilir: havuzun kaçta kaçı Yargıtay/Danıştay, kaçta kaçı
    -- yerel mahkeme? Üç kaynak şu an EŞİT hızda çalışıyor; bu dağılım eşitliğin
    -- doğru olup olmadığını söyleyecek tek kanıttır. Tahminle ağırlık
    -- değiştirmek, ölçmeden ayar yapmak olurdu.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'ictihat_kararlar' and column_name = 'kurul'
    ) then
      return query execute
        $q$ select 'havuz_kurul', coalesce(kurul, '(boş)'), count(*)::text
            from public.ictihat_kararlar group by 1, 2 order by count(*) desc $q$;
    end if;
  end if;

  if to_regclass('public.ictihat_harvest_state') is not null then
    return query select 'terimler', 'terim_sayisi', count(*)::text from public.ictihat_harvest_state;
    return query select 'terimler', 'bitmis_terim', count(*) filter (where done)::text
      from public.ictihat_harvest_state;
    return query select 'terimler', 'son_1s_islenen', count(*) filter (where last_run > now() - interval '1 hour')::text
      from public.ictihat_harvest_state;

    -- Öncelik dağılımı: hepsi 100'de duruyorsa tazeleme HİÇ çalışmamış demektir
    -- (taban değer 100). Bu, "0093 uygulandı" ile "0093 işe yaradı" arasındaki
    -- farkı gösteren tek satır.
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
end;
$$;

comment on function public.hasat_saglik() is
  'Hasat zincirinin tek çağrıda teşhisi: disk freni, migration izleri, cron işleri, edge yanıtları, havuz. Yalnız okur.';

revoke all on function public.hasat_saglik() from public, anon, authenticated;
grant execute on function public.hasat_saglik() to service_role;
