-- ===========================================================================
-- BİRLEŞİK MIGRATION: hasat-baslat
-- Üreten: scripts/sql-birlestir.mjs — ELLE DÜZENLEME. Kaynak dosyalar:
--   supabase/migrations/0093_hasat_onceligi.sql
--   supabase/migrations/0094_hasat_hizi.sql
--   supabase/migrations/0101_hasat_teshis.sql
--   supabase/migrations/0102_hesap_silince_yedekten_de_sil.sql
--   supabase/migrations/0103_hasat_onceligi_olculdu_ve_duzeltildi.sql
--
-- NASIL UYGULANIR: Supabase → SQL Editor → hepsini yapıştır → Run.
-- Hepsi tekrar çalıştırılabilir (idempotent): daha önce uygulanmış olanlar
-- zarar vermeden yeniden çalışır. Bu yüzden "hangisi uygulanmıştı" diye
-- düşünmene gerek yok.
-- ===========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 0093_hasat_onceligi.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- HASAT ÖNCELİĞİ — "her şeyi değil, ÖNEMLİ olanı topla".
--
-- SORUN. Terim seçimi "en uzun süredir işlenmemiş" kuralıyla dönüyordu
-- (harvest-tick: order by last_run asc). Yani 134 terim eşit ağırlıkta sırayla
-- taranıyor: Yargıtay Hukuk Genel Kurulu kararı ile hiçbir müvekkilimizi
-- ilgilendirmeyen bir konu aynı hızda toplanıyor. Günde ~1.300 karar
-- çekebiliyorsak, o kotayı neyin harcadığı önemlidir.
--
-- ÜÇ SİNYAL, sırayla:
--
--   1) KURUL AĞIRLIĞI. İçtihadı Birleştirme > Genel Kurul > Yargıtay dairesi >
--      Danıştay > istinaf (BAM/BİM) > yerel. Bir İBK kararı bağlayıcıdır; bir
--      yerel mahkeme kararı emsal bile sayılmaz. Eşit toplamak yanlıştır.
--
--   2) BİZİM KULLANICILARIMIZIN GERÇEK DAVA KARIŞIMI. `cases` tablosundaki
--      dava türü/mahkeme dağılımına bakıp, avukatlarımızın FİİLEN çalıştığı
--      konuları öne alır. Rakiplerin yapamayacağı şey budur: onlarda dosya
--      yok, bizde var. 11 milyon kararın hepsini toplamak yerine, bizim
--      avukatlarımızın davasına dokunanı önce toplarız.
--
--   3) TAZELİK. Aynı konuda yeni içtihat eskisini bastırır.
--
-- DÜZELTME (2026-09-11, sonradan eklendi — yorum satırı, SQL değişmedi):
-- Yukarıdaki "KIRILGANLIK NOTU" başlığıyla burada şu yazıyordu: "terim listesi
-- (134 satır) bu depoda değil, yalnız canlı veritabanında." BU YANLIŞTI. Liste
-- depoda: scripts/ictihat-terms.txt (137 satır, 3'ü tekrar → 134 tekil terim,
-- canlıdaki sayıyla aynı). Yanlış not, listeyi görmeden puanlama yazmama yol
-- açtı; doğrusunu görünce bu migration'ın iki sinyalinin hiç eşleşmediği
-- ölçüldü. Ölçüm ve düzeltme: migration 0103.
--
-- Aşağıdaki puanlama terim METNİNE bakarak çalışır; yeni terim eklenirse
-- kendiliğinden puanlanır.

alter table public.ictihat_harvest_state
  add column if not exists oncelik integer not null default 100;

comment on column public.ictihat_harvest_state.oncelik is
  'Hasat önceliği. Büyük olan önce taranır. public.hasat_onceligini_tazele() haftalık günceller.';

create index if not exists ictihat_harvest_state_oncelik_idx
  on public.ictihat_harvest_state (oncelik desc, last_run asc nulls first);

/*
 * Terim önceliğini yeniden hesaplar.
 *
 * Taban 100. Üstüne:
 *   +60  terim, kullanıcılarımızın dava türlerinden biriyle eşleşiyorsa
 *        (eşleşme sayısıyla orantılı, en çok 60)
 *   +40  yüksek yargı sinyali taşıyan terimler (genel kurul, içtihadı
 *        birleştirme) — bunlar bağlayıcı kararlara götürür
 *   -30  yalnız yerel/istinaf sinyali taşıyanlar
 *
 * NEDEN FONKSİYON, NEDEN SABİT DEĞİL: kullanıcı kitlesi değiştikçe öncelik de
 * değişmeli. Sabit bir liste, bugünün müvekkil karışımını yarına dayatırdı.
 */
create or replace function public.hasat_onceligini_tazele()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  guncellenen integer;
begin
  with dava_konulari as (
    -- Kullanıcılarımızın gerçek dava karışımı. Boş/çöp değerler elenir.
    select lower(trim(coalesce(case_type, ''))) as konu, count(*)::numeric as adet
    from public.cases
    where case_type is not null and length(trim(case_type)) >= 3
    group by 1
  ),
  toplam as (select greatest(sum(adet), 1) as t from dava_konulari),
  puanlar as (
    select
      h.terim,
      100
      -- 1) Kullanıcı dava karışımı (en çok +60)
      + coalesce((
          select least(60, round(60 * sum(d.adet) / (select t from toplam)))::integer
          from dava_konulari d
          where lower(h.terim) like '%' || d.konu || '%'
             or d.konu like '%' || lower(h.terim) || '%'
        ), 0)
      -- 2) Yüksek yargı sinyali
      + case
          when lower(h.terim) ~ 'içtihadı birleştirme|ictihadi birlestirme|genel kurul|hgk|cgk' then 40
          else 0
        end
      -- 3) Yalnız alt derece sinyali
      + case
          when lower(h.terim) ~ 'yerel mahkeme|asliye|sulh' and lower(h.terim) !~ 'yargıtay|yargitay|danıştay|danistay' then -30
          else 0
        end
      as yeni_oncelik
    from public.ictihat_harvest_state h
  )
  update public.ictihat_harvest_state h
  set oncelik = greatest(1, p.yeni_oncelik)
  from puanlar p
  where h.terim = p.terim and h.oncelik is distinct from greatest(1, p.yeni_oncelik);

  get diagnostics guncellenen = row_count;
  return guncellenen;
end;
$$;

revoke execute on function public.hasat_onceligini_tazele() from public, anon, authenticated;

-- Haftada bir tazele: dava karışımı günlük değişmez, saatlik hesap israftır.
select cron.unschedule('vekil_hasat_onceligi') where exists (
  select 1 from cron.job where jobname = 'vekil_hasat_onceligi'
);
select cron.schedule('vekil_hasat_onceligi', '17 4 * * 1', $$select public.hasat_onceligini_tazele()$$);

-- İlk hesabı hemen yap ki bir hafta beklenmesin.
select public.hasat_onceligini_tazele();


-- ═══════════════════════════════════════════════════════════════════════════
-- 0094_hasat_hizi.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- HASAT HIZI — 11 kat, hâlâ ölçülen güvenli tavanın çok altında.
--
-- ÖNCEKİ: 3 kaynak × saatte 3 tur × en fazla 6 karar = günde ~1.296 karar.
-- Bu hızla 1 milyon karar 2,1 yıl sürer.
--
-- YENİ: 3 kaynak × saatte 20 tur × en fazla 10 karar = günde ~14.400 karar.
-- 1 milyon karar ~70 gün.
--
-- NEDEN DAHA FAZLA DEĞİL. Ölçüm (önceki oturum): eşzamanlılık 10'da 8,7
-- belge/sn güvenli, 16'da 429 dönüyor. Yeni hız ~0,17 belge/sn — ölçülen
-- güvenli tavanın ellide biri. Sınır teknik değil: UYAP bir KAMU hizmeti ve
-- IP yasağı özelliği TAMAMEN öldürür. 500 kat hızlanıp yasaklanmaktansa 11 kat
-- hızlanıp çalışmaya devam etmek yeğdir.
--
-- Turlar dakika bazında kaydırıldı ki üç kaynak aynı anda vurmasın.
-- Disk emniyet freni (migration 0084) yürürlükte kalır: havuz beklenenden hızlı
-- büyürse hasat kendini durdurur.

select cron.unschedule('vekil_hasat_yargitay') where exists (select 1 from cron.job where jobname = 'vekil_hasat_yargitay');
select cron.unschedule('vekil_hasat_danistay') where exists (select 1 from cron.job where jobname = 'vekil_hasat_danistay');
select cron.unschedule('vekil_hasat_emsal')    where exists (select 1 from cron.job where jobname = 'vekil_hasat_emsal');

select cron.schedule('vekil_hasat_yargitay', '0-59/3 * * * *', $$select public.hasat_tetikle('yargitay', 10)$$);
select cron.schedule('vekil_hasat_danistay', '1-59/3 * * * *', $$select public.hasat_tetikle('danistay', 10)$$);
select cron.schedule('vekil_hasat_emsal',    '2-59/3 * * * *', $$select public.hasat_tetikle('emsal', 10)$$);

-- Vektörleme hasada YETİŞMELİ: vektörsüz karar anlamsal aramada görünmez.
-- 5 dakikada 6 karar (günde ~1.700) yeni hızın çok gerisinde kalırdı.
select cron.unschedule('vekil_vektorle') where exists (select 1 from cron.job where jobname = 'vekil_vektorle');
select cron.schedule('vekil_vektorle', '* * * * *', $$select public.vektorle_tetikle('ictihat', 15)$$);


-- ═══════════════════════════════════════════════════════════════════════════
-- 0101_hasat_teshis.sql
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 0102_hesap_silince_yedekten_de_sil.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- HESAP SİLİNİYOR AMA YEDEKTEKİ KOPYA 12 AY KALIYORDU.
-- ---------------------------------------------------------------------------
-- BULDUĞUM HATA — VE ÖNCE BUNU SÖYLEMELİYİM: bu kusuru ben yazdım. Koşullar
-- 13. maddeye "Hesabı silme işlemi geri alınamaz ve YEDEKLENMİŞ BİR KOPYA
-- TUTULMAZ" cümlesini ben ekledim. Cümle yazıldığı anda DOĞRU DEĞİLDİ; Pro
-- planına geçilince yanlış olmadı, zaten yanlıştı. Gizlilik metnindeki
-- "Silme ... sunucudaki TÜM kayıtlarınızı kapsar" cümlesi de aynı durumda.
--
-- ÖLÇÜLEBİLİR GERÇEK (migration'lardan okundu, tahmin değil):
--   • backup.take_snapshot()  — her gece 03:15, 21 tabloyu jsonb kopyalar,
--     21 GÜN saklar.                                  (migration 0029)
--   • backup.take_monthly()   — her ayın 1'i, o günkü kopyayı alır,
--     12 AY saklar.                                   (migration 0031)
--   • backup.take_file_inventory() — belge envanteri, 21 gün. (migration 0082)
--   • public.delete_account() — yalnız `delete from auth.users` yapar.
--     Cascade public şemasını temizler; backup ŞEMASINA HİÇ DOKUNMAZ.
--                                                     (migration 0092)
--
-- Sonuç: "hesabımı sil" diyen bir avukatın müvekkil adları, dava başlıkları ve
-- finans kayıtları backup.monthly'de BİR YILA KADAR duruyordu. Kullanıcı
-- bunu bilmiyordu, çünkü metinlerimiz tersini söylüyordu.
--
-- KVKK m.7 açısından: yedekte tutma kendi başına yasak değil — ama süresi
-- sınırlı olmalı, bir amaca bağlı olmalı ve AÇIKÇA BİLDİRİLMELİ. Bizde üçü de
-- yoktu; üstüne aksi yazılıydı. Yanlış beyan, sessizliğin üstüne bir katman
-- daha ekler.
--
-- BU DOSYANIN YAPTIĞI: silme işlemi artık yedekteki kopyayı da götürür.
-- Böylece metni gerçeğe uydurmuyoruz — GERÇEĞİ metne uyduruyoruz; doğru sıra
-- budur. (Metinler de ayrıca düzeltiliyor: Supabase'in KENDİ platform yedeği
-- Pro planda 7 gün saklanıyor ve ondan tek bir kullanıcıyı ayıklayamayız; bu
-- kalan pencere artık koşullarda ve gizlilikte açıkça yazıyor.)

-- ── Kullanıcının izini yedeklerden siler ────────────────────────────────────
/**
 * NEDEN UUID METİN TARAMASI, NEDEN SÜTUN LİSTESİ DEĞİL.
 *
 * Yedek satırları `row_data jsonb` olarak duruyor; tablo başına sahiplik
 * sütunu farklı: çoğu tabloda `owner_id`, purchases/question_answers/
 * office_members'ta `user_id`, profiles'ta `id`. Elle bir eşleme yazsaydım
 * ileride eklenen bir tablo sessizce kapsam dışı kalırdı — yani bu düzeltme
 * kendi kusurunu üretirdi.
 *
 * Bunun yerine satırın METNİNDE kullanıcının UUID'si geçiyor mu diye bakıyoruz.
 * UUID 128 bitlik; başka bir anlamda tesadüfen geçmesi pratikte imkânsız.
 * Geçiyorsa satır ya kullanıcıya aittir ya da ona işaret ediyordur — iki
 * durumda da gitmesi gerekir.
 *
 * MALİYETİ ÖLÇMEDİM: bu bir sıralı tarama (jsonb → text). Bugünkü veri
 * boyutunda hızlı olması beklenir ama SÜREYİ ÖLÇMEDİM. Hesap silme nadir bir
 * işlem olduğu için bu maliyeti kabul ediyorum; yedek tablosu büyüyüp silme
 * yavaşlarsa sütun bazlı hızlı yol eklenmeli.
 */
create or replace function backup.kullaniciyi_yedeklerden_sil(p_uid uuid)
returns table(kaynak text, silinen bigint)
language plpgsql
security definer
set search_path to 'backup', 'public'
as $$
declare
  iz text;
  n bigint;
begin
  if p_uid is null then
    raise exception 'kullanıcı kimliği boş — yedek silme yapılmadı';
  end if;
  iz := '%' || p_uid::text || '%';

  delete from backup.snapshots s where s.row_data::text like iz;
  get diagnostics n = row_count;
  kaynak := 'backup.snapshots'; silinen := n; return next;

  delete from backup.monthly m where m.row_data::text like iz;
  get diagnostics n = row_count;
  kaynak := 'backup.monthly'; silinen := n; return next;

  -- Envanterde sahip ayrı bir sütun; metin taramasına gerek yok.
  delete from backup.dosya_envanteri d where d.sahip = p_uid;
  get diagnostics n = row_count;
  kaynak := 'backup.dosya_envanteri'; silinen := n; return next;
end;
$$;

comment on function backup.kullaniciyi_yedeklerden_sil(uuid) is
  'Bir kullanıcının satırlarını veritabanı içi yedeklerden (snapshots, monthly, dosya envanteri) siler. delete_account() çağırır.';

revoke all on function backup.kullaniciyi_yedeklerden_sil(uuid) from public, anon, authenticated;

-- ── delete_account: artık yedeği de temizliyor ──────────────────────────────
/**
 * SIRA ÖNEMLİ: önce yedek, sonra auth.users.
 *
 * Tersi olsaydı ve yedek silme hata verseydi, işlem geri alınırdı (ikisi aynı
 * işlem içinde) — ama hata mesajı "kullanıcı silinemedi" yerine anlamsız bir
 * yedek hatası olurdu. Önce yedeği temizleyip sonra asıl silmeyi yapmak hem
 * atomik hem de okunabilir.
 *
 * auth.uid() BİR KEZ okunup değişkene alınıyor: auth.users silindikten sonra
 * aynı çağrının tekrar aynı değeri döndüreceğine güvenmek gereksiz bir varsayım.
 */
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'backup'
as $$
declare
  kim uuid := auth.uid();
begin
  if kim is null then
    raise exception 'oturum yok — silme yapılmadı';
  end if;

  -- storage.objects SİLİNMEZ: Supabase doğrudan SQL silmeyi engelliyor ve bu
  -- ifade fonksiyonun tamamını iptal ediyordu (bkz. migration 0092). Dosyalar
  -- istemcide Storage API ile, bu çağrıdan ÖNCE siliniyor.
  perform backup.kullaniciyi_yedeklerden_sil(kim);

  delete from auth.users where id = kim;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ── Doğrulama yardımcısı ────────────────────────────────────────────────────
/**
 * Silmeden SONRA "gerçekten gitti mi?" sorusunu cevaplar. Sıfırdan farklı bir
 * sayı, silmenin eksik kaldığı anlamına gelir.
 *
 * Bu fonksiyon olmasaydı temizliğin çalıştığını ancak VARSAYABİLİRDİK; burada
 * varsaymak yeterli değil, çünkü iddia hukuki bir metinde yazılı.
 */
create or replace function backup.yedekte_iz_var_mi(p_uid uuid)
returns table(kaynak text, kalan bigint)
language sql
stable
security definer
set search_path to 'backup', 'public'
as $$
  select 'backup.snapshots', count(*) from backup.snapshots where row_data::text like '%' || p_uid::text || '%'
  union all
  select 'backup.monthly', count(*) from backup.monthly where row_data::text like '%' || p_uid::text || '%'
  union all
  select 'backup.dosya_envanteri', count(*) from backup.dosya_envanteri where sahip = p_uid;
$$;

revoke all on function backup.yedekte_iz_var_mi(uuid) from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 0103_hasat_onceligi_olculdu_ve_duzeltildi.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- HASAT ÖNCELİĞİ: 0093'ÜN İKİ SİNYALİ ÖLÇÜLDÜ, İKİSİ DE ÇALIŞMIYORDU.
-- ---------------------------------------------------------------------------
-- KUSURU BEN YAZDIM, ÖNCE ONU SÖYLÜYORUM. Migration 0093'te üç sinyalli bir
-- öncelik puanlaması kurdum ve o dosyada "kurul ağırlığı" sinyalini ürünün
-- ayırt edici özelliği gibi anlattım. ÖLÇMEMİŞTİM.
--
-- ÖLÇÜM (2026-09-11, yerel PostgreSQL 16; girdi: scripts/ictihat-terms.txt'in
-- yorumsuz ve tekrarsız hâli = 134 terim — canlıdaki terim sayısıyla aynı):
--
--   +40 "yüksek yargı sinyali"  →  134 terimden 1'i eşleşti:
--        « şirket genel kurul kararının iptali »
--        Bu bir TİCARET HUKUKU terimidir; şirketin genel kurul kararının
--        iptali davasıdır. Yargıtay Hukuk Genel Kurulu ile hiçbir ilgisi yok.
--        Yani kural 0 doğru, 1 YANLIŞ eşleşme üretiyor: işe yaramamakla
--        kalmıyor, kotayı yanlış terime kaydırıyor.
--
--   -30 "alt derece sinyali"    →  134 terimden 0'ı eşleşti. Ölü kod.
--
-- SEBEBİ, ŞİMDİ BAKINCA AÇIK: terimler KONU sorgularıdır ("kira tespit
-- davası"), mahkeme adı değil. Kararın hangi kuruldan geldiği aramanın DEĞİL
-- sonucun bir özelliğidir — harvest-tick zaten kurulOf(daire) ile hesaplayıp
-- ictihat_kararlar.kurul'a yazıyor. Kurul ağırlığını terim metninden çıkarmaya
-- çalışmak, baştan yanlış yerde arama yapmaktı.
--
-- BU DOSYA NE YAPIYOR:
--   1) İki ölü sinyali KALDIRIYOR. Çalışmayan kuralı kodda bırakmak, sonraki
--      okuyucuya "kurul ağırlığı var" diye yalan söylemek olurdu.
--   2) Geriye kalan TEK gerçek sinyali — kullanıcılarımızın dava karışımı —
--      sağlamlaştırıyor (Türkçe büyük/küçük harf tuzağı + joker karakter
--      sızıntısı; ikisi de aşağıda).
--   3) Kurul ağırlığının doğru yerini SÖYLÜYOR ama oraya DOKUNMUYOR: bu bir
--      kaynak zamanlaması (cron) kararıdır ve havuzun mevcut kurul dağılımı
--      ÖLÇÜLMEDEN verilemez. public.hasat_saglik() artık o dağılımı
--      raporluyor; karar ondan sonra verilecek.
--
-- NE İDDİA ETMİYORUM: kalan +60 sinyalinin canlıda kaç terime dokunduğunu
-- ÖLÇMEDİM — cases.case_type değerlerini görmüyorum. hasat_saglik() çıktısındaki
-- 'oncelik_dagilimi' satırı bunu gösterecek: hepsi 100'de duruyorsa bu sinyal
-- de fiilen çalışmıyor demektir.

-- ── Türkçe güvenli küçültme ─────────────────────────────────────────────────
/**
 * NEDEN lower() YETMİYOR. Türkçede 'İ' (U+0130) ve 'I' ayrı harflerdir:
 * doğru karşılıkları 'i' ve 'ı'dır. PostgreSQL'in lower()'ı veritabanı
 * yerelinde çalışır ve Supabase'de yerel Türkçe DEĞİL; 'I' → 'i' olur, 'İ' ise
 * yerele göre tek/çift kod birimine düşebilir. Sonuç: "İş Kazası" ile
 * "iş kazası" eşleşmeyebilir — yani sinyal sessizce kaybolur.
 *
 * Bu yüzden Türkçe harfleri ÖNCE elle eşliyoruz, sonra lower() ile ASCII'yi
 * hallediyoruz. Sıra önemli: 'I' → 'ı' dönüşümü lower()'dan ÖNCE olmalı,
 * yoksa lower() onu 'i' yapar ve bilgi kaybolur.
 */
create or replace function public.tr_kucult(t text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select lower(translate(t, 'İIŞĞÜÖÇÂÎÛ', 'iışğüöçaiu'))
$$;

comment on function public.tr_kucult(text) is
  'Türkçe güvenli küçük harfe çevirme. İ→i, I→ı. Karşılaştırmalarda lower() yerine bunu kullanın.';

-- ── Öncelik tazeleme: iki ölü sinyal kaldırıldı ─────────────────────────────
/**
 * Taban 100. Tek üstünlük kaynağı: kullanıcılarımızın GERÇEK dava karışımı
 * (en çok +60). Bu, rakiplerin kopyalayamayacağı tek sinyaldir — onlarda
 * dosya yok, bizde var.
 *
 * İKİ DÜZELTME (ikisi de 0093'te sessiz hataydı):
 *
 *  a) JOKER KARAKTER SIZINTISI. 0093 eşleşmeyi
 *         h.terim like '%' || d.konu || '%'
 *     ile yapıyordu. `d.konu` KULLANICININ yazdığı serbest metindir; içinde
 *     '%' ya da '_' geçen bir dava türü ("%50 hisse") deseni bozar ve
 *     olmayacak eşleşmeler üretir. Artık position() kullanılıyor: joker yok,
 *     kaçış yok, sürpriz yok.
 *
 *  b) TÜRKÇE KÜÇÜLTME. lower() yerine public.tr_kucult().
 *
 *  c) least() NULL'I YUTUYORDU — ÖNCELİĞİN TAMAMINI SESSİZCE ÖLDÜREN HATA.
 *     0093'teki ifade şuydu:
 *         coalesce((select least(60, round(60 * sum(adet) / toplam)) ... ), 0)
 *     Hiçbir dava türü eşleşmediğinde sum() NULL döner, round() NULL olur ve
 *     PostgreSQL'de least(60, NULL) = 60'tır — least() NULL argümanları
 *     ATLAR, NULL DÖNDÜRMEZ. Yani EŞLEŞMEYEN her terim de +60 alıyordu.
 *     Dıştaki coalesce hiçbir işe yaramıyordu: alt sorgu zaten 60 döndürüyordu.
 *
 *     ÖLÇÜM (yerel PostgreSQL 16, 134 gerçek terim, 8 davalık bir karışım):
 *     134 terimin 128'i 160 puan aldı; yalnız gerçekten eşleşen 6 terim
 *     (123 / 115 / 108) farklı puandaydı. Yani puanlama neredeyse SABİTTİ —
 *     "öncelik" diye bir şey fiilen yoktu ve üstelik kendini gizliyordu:
 *     tabloya bakan biri 160'ları görüp "puanlanmış" sanırdı.
 *
 *     Düzeltme: tavan en DIŞTA. least(60, coalesce(<toplam>, 0)) — eşleşme
 *     yoksa 0, varsa payı kadar.
 *
 * Ayrıca çok kısa/çok genel dava türleri elenir: "dava", "dosya", "diğer",
 * "genel" gibi bir değer neredeyse HER terimle eşleşip puanı düzleştirirdi —
 * yani sinyali gürültüye çevirirdi.
 */
create or replace function public.hasat_onceligini_tazele()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  guncellenen integer;
begin
  with dava_konulari as (
    select public.tr_kucult(trim(case_type)) as konu, count(*)::numeric as adet
    from public.cases
    where case_type is not null
      and length(trim(case_type)) >= 4
      and public.tr_kucult(trim(case_type)) not in ('dava','dosya','diğer','diger','genel','hukuk','ceza dosyası')
    group by 1
  ),
  toplam as (select greatest(sum(adet), 1) as t from dava_konulari),
  puanlar as (
    select
      h.terim,
      -- TAVANI EN DIŞTA UYGULA — bkz. yukarıdaki (c) maddesi. least() içeride
      -- olursa eşleşme yokken NULL'ı yutar ve 60 döndürür.
      100 + least(60, coalesce((
        select round(60 * sum(d.adet) / (select t from toplam))::integer
        from dava_konulari d
        where position(d.konu in public.tr_kucult(h.terim)) > 0
           or position(public.tr_kucult(h.terim) in d.konu) > 0
      ), 0)) as yeni_oncelik
    from public.ictihat_harvest_state h
  )
  update public.ictihat_harvest_state h
  set oncelik = greatest(1, p.yeni_oncelik)
  from puanlar p
  where h.terim = p.terim and h.oncelik is distinct from greatest(1, p.yeni_oncelik);

  get diagnostics guncellenen = row_count;
  return guncellenen;
end;
$$;

revoke all on function public.hasat_onceligini_tazele() from public, anon, authenticated;
grant execute on function public.hasat_onceligini_tazele() to service_role;

-- Düzeltilmiş puanlamayı hemen uygula: eski (yanlış) +40 puanı da böylece
-- temizlenmiş olur.
do $$
declare n integer;
begin
  if to_regclass('public.ictihat_harvest_state') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='ictihat_harvest_state'
                   and column_name='oncelik') then
    select public.hasat_onceligini_tazele() into n;
    raise notice 'Öncelik yeniden hesaplandı: % terim güncellendi.', n;
  else
    raise notice 'ictihat_harvest_state.oncelik yok — önce 0093 uygulanmalı.';
  end if;
end $$;

