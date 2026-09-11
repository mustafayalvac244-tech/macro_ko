-- İÇTİHAT ARAMASI: ÖNCE "TÜM TERİMLER", DOLMAZSA "HERHANGİ BİRİ".
-- ===========================================================================
-- ÖLÇÜM (0110 teşhisi, canlı, 2026-09-11, 11.070 karar). search_ictihat_fts
-- sorguyu OR ile kuruyor (0032, geri çağırma için). Üç gerçek soruda:
--
--   sorgu                              OR eşleşme     OR yalnız EŞLEŞME süresi
--   gerçek olmayan ihtiyaç … tahliye   5.967 satır    16,3 s
--   işe iade arabuluculuk dava şartı   10.644 satır   15,1 s
--   kıdem tazminatı zamanaşımı         4.734 satır    17,2 s
--
-- Canlıdaki tavan 8 s. OR, havuzun yarısıyla eşleşiyor; eşleşen her satırın
-- ~7 KB'lık TOAST'lı tsvector'ü okunuyor ve ts_rank ile puanlanıyor
-- (+3-4 s). 0108'in eklediği GIN indeksi EŞLEŞMEYİ hızlandırır, PUANLAMAYI
-- değil; ve eşleşme kümesi havuzun yarısıysa indeks de kurtarmıyor. Üstüne
-- 4 harf önek taraması (B aşaması) 3,5-8,9 s. Yani bu sorgular 25-30 s
-- sürüyor ve kullanıcı "arama başarısız" görüyor — 30 sorudan 7'si böyle.
--
-- AYNI ÜÇ SORUDA AND (tüm terimler birlikte):
--   30 / 70 / 177 satır — tam sorgu (puanlama + limit 15) 77 / 130 / 211 ms.
-- Yüz kat hızlı ve üçünde de 15 sonucu dolduruyor. Tüm terimleri içeren
-- karar, herhangi birini içerenden ZATEN daha isabetli; yani hız için
-- isabetten vazgeçmiyoruz, tersine.
--
-- DÜZELTME: önce AND. match_count kadar sonuç verirse OR ve önek aşamaları
-- HİÇ ÇALIŞMAZ. Vermezse eski yol (OR + önek) yalnız KALAN yerler için koşar.
-- Eski yol nadir terimli sorgularda kalıyor — orada OR zaten az satırla
-- eşleştiği için ucuz. Yani maliyet iki dalda da sınırlı.
--
-- ÖLÇÜLMEMİŞ: 30 soruluk eval-ictihat setinde zaman aşımının 7'den kaça
-- düşeceği ve isabetin değişip değişmediği. Bu dosya uygulandıktan sonra
-- eval-ictihat koşturulur; "düzeldi" o zaman söylenir.
--
-- DİKKAT — SECURITY DEFINER KORUNMALI. 0106 bu fonksiyonu definer yaptı
-- (0104 tablo yetkilerini authenticated'dan aldı). CREATE OR REPLACE
-- niteliği yazılmazsa fonksiyon INVOKER'a döner ve arama yine kırılır
-- (bugün bir kez oldu). Bu yüzden nitelik ve search_path burada açıkça var.

CREATE OR REPLACE FUNCTION public.search_ictihat_fts(q text, match_count integer DEFAULT 15)
 RETURNS TABLE(id text, kurul text, daire text, esas_no text, karar_no text, karar_tarihi text, durum text, snippet text, score real)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  stopA text[] := array[
    'dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','kararin','taraf','tarafi','kisi','kisinin','nedir','midir','mudur',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','var','yok','olur','gerekir','zorunlu',
    'dairesi','daire','yargitay','danistay','esas','sayili','hakkinda','uzere','ancak','ayrica'
  ];
  stopB text[] := array[
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','nasil','ise','yani',
    'daha','cok','var','yok','olur','ben','beni','bana','benim','mi','mu','midir','mudur','nedir',
    'yapmaliyim','alabilir','miyim','istiyorum','oldu','edebilir','ama','fakat','ancak','dayanabilirim'
  ];
  q_clean text; q_or text; q_and text; tsq tsquery; tsq_and tsquery;
  w text; total bigint; dl bigint; ds bigint;
  longs text[] := '{}'; shorts text[] := '{}'; wl real[] := '{}'; ws real[] := '{}'; orq text;
  keepA integer := greatest(1, match_count - 2);
  -- AND ile bulunan kararlar (sırayla) ve kaç yer kaldığı.
  ve_ids text[] := '{}';
  ve_n integer := 0;
  kalan integer;
begin
  select string_agg(x, ' ') into q_clean from (
    select x from unnest(regexp_split_to_array(lower(coalesce(q, '')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(stopA)) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q, ''); end if;
  select string_agg(lexeme, ' | ') into q_or  from unnest(to_tsvector('turkish', q_clean));
  select string_agg(lexeme, ' & ') into q_and from unnest(to_tsvector('turkish', q_clean));
  tsq     := case when q_or  is null or q_or  = '' then null else to_tsquery('turkish', q_or)  end;
  tsq_and := case when q_and is null or q_and = '' then null else to_tsquery('turkish', q_and) end;

  -- ── HIZLI YOL: TÜM TERİMLERİ İÇEREN KARARLAR ──────────────────────────
  -- Eşleşme kümesi küçük (ölçümde 30-177 satır), puanlama ucuz, sonuç daha
  -- isabetli. Doldurursa OR ve önek aşamalarına hiç girilmez.
  if tsq_and is not null then
    select coalesce(array_agg(v.rid order by v.sc desc, v.rid), '{}') into ve_ids
    from (
      select k.id as rid, ts_rank(k.fts, tsq_and, 1) as sc
      from public.ictihat_kararlar k
      where k.fts @@ tsq_and
      order by sc desc, k.id
      limit match_count
    ) v;
    ve_n := coalesce(array_length(ve_ids, 1), 0);
    if ve_n > 0 then
      return query
        select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
               left(k.full_text, 320) as snippet, ts_rank(k.fts, tsq_and, 1)::real
        from public.ictihat_kararlar k
        where k.id = any(ve_ids)
        order by array_position(ve_ids, k.id);
    end if;
    if ve_n >= match_count then return; end if;
  end if;
  kalan := match_count - ve_n;

  -- ── YAVAŞ YOL (0069'daki davranış), YALNIZ KALAN YERLER İÇİN ─────────
  -- Buraya nadir terimli sorgular düşer; OR orada az satırla eşleştiği için
  -- ucuzdur. Yaygın terimli sorgular yukarıda dolup çıktı.
  select count(*) into total from public.ictihat_kararlar;

  for w in select distinct x from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x,'ğüşıöçâîû','gusiocaiu') <> all(stopB)
  loop
    select count(*) into ds from (select 1 from public.ictihat_kararlar k
      where k.fts_simple @@ to_tsquery('simple', left(w,4)||':*') limit 300) z;
    continue when ds = 0 or ds >= 300;
    select count(*) into dl from (select 1 from public.ictihat_kararlar k
      where k.fts_simple @@ to_tsquery('simple', w||':*') limit 300) z;
    shorts := shorts || left(w,4); ws := ws || ln((total+1.0)/(ds+1.0))::real;
    longs  := longs  || w;         wl := wl || ln((total+1.0)/(dl+1.0))::real;
  end loop;
  orq := case when array_length(shorts,1) is null then null
              else array_to_string(array(select p||':*' from unnest(shorts) p), ' | ') end;

  return query
  with aday as (
    select k.id rid, ts_rank(k.fts, tsq, 1) sc, row_number() over (order by ts_rank(k.fts, tsq, 1) desc, k.id) sira
    from public.ictihat_kararlar k
    where tsq is not null and k.fts @@ tsq and k.id <> all(ve_ids)
    order by sc desc, k.id limit match_count
  ),
  a as (select rid, sc from aday where sira <= keepA),
  terms as (
    select to_tsquery('simple', shorts[i]||':*') tqs, to_tsquery('simple', longs[i]||':*') tql,
           ws[i] wshort, wl[i] wlong
    from generate_subscripts(shorts,1) i where orq is not null
  ),
  b as (
    select k.id rid,
      (select coalesce(sum(case when k.fts_simple @@ t.tql then t.wlong else t.wshort end),0)
         from terms t where k.fts_simple @@ t.tqs)
      * (select count(*) from terms t where k.fts_simple @@ t.tqs) sc
    from public.ictihat_kararlar k
    where orq is not null and k.fts_simple @@ to_tsquery('simple', orq) and k.id <> all(ve_ids)
    order by sc desc, k.id limit 40
  ),
  extra as (
    select b.rid, b.sc from b where not exists (select 1 from a where a.rid = b.rid)
    order by b.sc desc, b.rid limit greatest(0, match_count - (select count(*) from a))
  ),
  merged as (
    select rid, sc, 0 tier from a
    union all
    select rid, greatest(coalesce((select min(sc) from a), 1.0),
                         coalesce((select max(sc) from a), 1.0) * 0.35), 1 from extra
    union all
    select rid, sc, 2 tier from aday
    where rid not in (select rid from a)
      and rid not in (select rid from extra)
  )
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
         left(k.full_text, 320) as snippet, mg.sc::real
  from merged mg join public.ictihat_kararlar k on k.id = mg.rid
  order by mg.tier, mg.sc desc, k.id
  limit kalan;
end;
$function$;

-- Yetkiler açıkça (0107 ile aynı): anon/public YOK.
revoke all on function public.search_ictihat_fts(text, integer) from public, anon;
grant execute on function public.search_ictihat_fts(text, integer) to authenticated, service_role;

-- ── DOĞRULAMA: teşhisteki üç sorgu, gerçek fonksiyonla, süre + sonuç sayısı ─
create temp table dogrulama (sorgu text, ms integer, sonuc bigint, definer boolean);
do $$
declare q text; t0 timestamptz; n bigint;
begin
  foreach q in array array['gerçek olmayan ihtiyaç nedeniyle tahliye','işe iade arabuluculuk dava şartı','kıdem tazminatı zamanaşımı'] loop
    t0 := clock_timestamp();
    select count(*) into n from public.search_ictihat_fts(q, 15);
    insert into dogrulama
    select q, round(extract(epoch from clock_timestamp() - t0) * 1000), n,
           (select p.prosecdef from pg_proc p join pg_namespace s on s.oid = p.pronamespace
             where s.nspname = 'public' and p.proname = 'search_ictihat_fts');
  end loop;
end $$;
select * from dogrulama order by sorgu;
