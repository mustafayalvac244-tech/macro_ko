-- 05.10.2026 — YAPAY ZEKÂ BEKLEMESİNİN İKİ VERİTABANI SEBEBİ.
--
-- Ürün sahibi: "performanstan memnun değiller". Modelsiz kuru koşu
-- (scripts/olcum-adim.mjs, sonuç scripts/olcum-adim-sonuc.json) model dışı
-- beklemenin besleme adımlarında olduğunu gösterdi: mevzuat 3–16 sn,
-- içtihat 0,8–17 sn; denetimler <0,6 sn. Veritabanında ayrı ayrı ölçülünce
-- (EXPLAIN ANALYZE): kararlar_madde_ile 5.429 ms (her soruda 3 kez, paralel)
-- ve search_ictihat_fts içindeki tam sayım 14.176 ms.
--
-- Yetkiler önceki tanımlarla aynı bırakılır (create or replace korur).

-- GÖVDE DENETİMİ KAPALI: ictihat_atif ve ictihat_kararlar hiçbir göçle
-- yaratılmıyor (canlıda var, CI'daki taklit şemada yok — bkz. supabase-goc
-- skill'i). SQL dilindeki fonksiyon gövdesi oluşturulurken denetlendiği için
-- taklit şemada düşerdi. Canlıda tablolar mevcut; davranış değişmez.
set check_function_bodies = off;

-- 0172 — madde atfı araması: kanun listesi tam tarama yerine atlamalı okuma.
-- Ölçüldü 05.10.2026: "select distinct kanun from ictihat_atif" 337 bin satırı
-- tarıyordu; kararlar_madde_ile('TBK',315,2) 5.429 ms. Özyinelemeli atlama
-- (indeks üzerinde kanun başına 1 okuma, 14 kanun) ile 81 ms. Sonuç TBK 315,
-- HMK 4, tmk 166, İşK 18, İİK 68 için eskiyle BİREBİR aynı (canlıda karşılaştırıldı).
create or replace function public.kararlar_madde_ile(p_kanun text, p_madde integer, p_limit integer default 5)
returns table(id text, kurul text, daire text, esas_no text, karar_no text, karar_tarihi text, snippet text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with recursive kanunlar as (
    (select a.kanun from public.ictihat_atif a order by a.kanun limit 1)
    union all
    select (select a.kanun from public.ictihat_atif a where a.kanun > k.kanun order by a.kanun limit 1)
    from kanunlar k where k.kanun is not null
  ), hedef as (
    select kanun from kanunlar
    where kanun is not null
      and upper(translate(kanun,   'İIıŞşĞğÜüÖöÇç', 'IIiSsGgUuOoCc'))
        = upper(translate(p_kanun, 'İIıŞşĞğÜüÖöÇç', 'IIiSsGgUuOoCc'))
  )
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi,
         left(k.full_text, 320)
  from public.ictihat_atif a
  join hedef h on h.kanun = a.kanun
  join public.ictihat_kararlar k on k.id = a.karar_id
  where a.madde_no = p_madde
  order by case k.kurul when 'Yargıtay' then 0 when 'Danıştay' then 1
                        when 'BAM' then 2 when 'BİM' then 3 else 4 end,
           k.id
  limit greatest(1, least(20, p_limit));
$function$;

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
    'dairesi','daire','yargitay','danistay','esas','sayili','hakkinda','uzere','ancak','ayrica',
    -- Soru dolguları: "kime verilir", "ne yapmalıyım" — kararlarda her yerde geçer.
    'kime','kimin','kim','verilir','verilmesi','yapmaliyim','istiyorum','edebilir','miyim'
  ];
  stopB text[] := array[
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','nasil','ise','yani',
    'daha','cok','var','yok','olur','ben','beni','bana','benim','mi','mu','midir','mudur','nedir',
    'yapmaliyim','alabilir','miyim','istiyorum','oldu','edebilir','ama','fakat','ancak','dayanabilirim'
  ];
  -- Yavaş yol tavanı: OR/önek eşleşmelerinden en fazla bu kadarı puanlanır.
  TAVAN constant integer := 1500;
  q_clean text; lex text[]; n integer; tsq tsquery; tsq_and tsquery; tsq_n1 tsquery;
  parca text; parcalar text[] := '{}'; ii integer; jj integer;
  w text; total bigint; dl bigint; ds bigint;
  longs text[] := '{}'; shorts text[] := '{}'; wl real[] := '{}'; ws real[] := '{}'; orq text;
  -- Bulunanlar (sırayla) ve basamak sırası (0 = AND, 1 = n-1, 2 = OR, 3 = önek).
  ve_ids text[] := '{}';
  bu_ids text[];
  bu_sc real[];
  basamak integer := 0;
  tq tsquery;
  kalan integer;
begin
  select string_agg(x, ' ') into q_clean from (
    select x from unnest(regexp_split_to_array(lower(coalesce(q, '')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(stopA)) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q, ''); end if;

  select array_agg(lexeme order by lexeme) into lex from (select distinct lexeme from unnest(to_tsvector('turkish', q_clean))) l;
  n := coalesce(array_length(lex, 1), 0);
  if n = 0 then return; end if;

  tsq     := to_tsquery('turkish', array_to_string(lex, ' | '));
  tsq_and := to_tsquery('turkish', array_to_string(lex, ' & '));
  -- ORTA BASAMAK: n-1 terim. Yalnız n >= 3 iken anlamlı (n=2'de "1 terim" = OR).
  if n >= 3 then
    for ii in 1..n loop
      parca := '';
      for jj in 1..n loop
        if jj <> ii then parca := parca || case when parca = '' then '' else ' & ' end || lex[jj]; end if;
      end loop;
      parcalar := parcalar || ('(' || parca || ')');
    end loop;
    tsq_n1 := to_tsquery('turkish', array_to_string(parcalar, ' | '));
  end if;

  -- ── MERDİVEN: AND → (n-1) → OR(tavanlı). Her basamak yalnız kalan yerleri doldurur. ──
  foreach tq in array array[tsq_and, tsq_n1, tsq] loop
    basamak := basamak + 1;
    continue when tq is null;
    kalan := match_count - coalesce(array_length(ve_ids, 1), 0);
    exit when kalan <= 0;
    -- 0172: aday sorgusu BASAMAK BAŞINA BİR KEZ. Eskiden aynı sorgu iki kez
    -- koşuyordu (biri döndürmek, biri ve_ids'e yazmak için); "limit TAVAN"
    -- sırasız olduğundan iki koşu farklı 1500 satırı da seçebiliyordu.
    select coalesce(array_agg(s.rid order by s.sc desc, s.rid), '{}'),
           coalesce(array_agg(s.sc order by s.sc desc, s.rid), '{}')
      into bu_ids, bu_sc
    from (
      select a.rid, ts_rank(a.v, tq, 1) as sc
      from (select k.id as rid, k.fts as v from public.ictihat_kararlar k
            where k.fts @@ tq and k.id <> all(ve_ids) limit TAVAN) a
      order by sc desc, a.rid
      limit kalan
    ) s;
    return query
      select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
             left(k.full_text, 320) as snippet, x.sc::real
      from unnest(bu_ids, bu_sc) with ordinality as x(rid, sc, sira)
      join public.ictihat_kararlar k on k.id = x.rid
      order by x.sira;
    ve_ids := ve_ids || bu_ids;
  end loop;

  kalan := match_count - coalesce(array_length(ve_ids, 1), 0);
  if kalan <= 0 then return; end if;

  -- ── ÖNEK BASAMAĞI (0034'ün geri çağırma yolu), yalnız hâlâ yer varsa ────
  -- 0172: TAM SAYIM YERİNE PLANLAYICI İSTATİSTİĞİ. Ölçüldü 05.10.2026:
  -- count(*) 216.551 satırda 14.176 ms. Sayı yalnız IDF ağırlığında
  -- (ln(toplam/df)) kullanılıyor; istatistik ile gerçek arasındaki fark
  -- (211.716 / 216.551, %2) her terime yaklaşık aynı sabiti ekler.
  select greatest(c.reltuples, 0)::bigint into total from pg_class c where c.oid = 'public.ictihat_kararlar'::regclass;
  if coalesce(total, 0) <= 0 then select count(*) into total from public.ictihat_kararlar; end if;
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
  if array_length(shorts, 1) is null then return; end if;
  orq := array_to_string(array(select p||':*' from unnest(shorts) p), ' | ');

  return query
  with terms as (
    select to_tsquery('simple', shorts[i]||':*') tqs, to_tsquery('simple', longs[i]||':*') tql,
           ws[i] wshort, wl[i] wlong
    from generate_subscripts(shorts,1) i
  ),
  aday as (
    select k.id as rid, k.fts_simple as v
    from public.ictihat_kararlar k
    where k.fts_simple @@ to_tsquery('simple', orq) and k.id <> all(ve_ids)
    limit TAVAN
  ),
  b as (
    select a.rid,
      (select coalesce(sum(case when a.v @@ t.tql then t.wlong else t.wshort end),0)
         from terms t where a.v @@ t.tqs)
      * (select count(*) from terms t where a.v @@ t.tqs) sc
    from aday a
    order by sc desc, a.rid limit kalan
  )
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
         left(k.full_text, 320) as snippet, b.sc::real
  from b join public.ictihat_kararlar k on k.id = b.rid
  order by b.sc desc, k.id;
end;
$function$;

revoke all on function public.search_ictihat_fts(text, integer) from public, anon;
grant execute on function public.search_ictihat_fts(text, integer) to authenticated, service_role;
