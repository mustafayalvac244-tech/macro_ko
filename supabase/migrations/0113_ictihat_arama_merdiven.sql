-- İÇTİHAT ARAMASI: ÜÇ BASAMAKLI MERDİVEN + YAVAŞ YOLA TAVAN.
-- ===========================================================================
-- ÖLÇÜM (eval-ictihat, canlı, 2026-09-11, aynı 30 soru, 8 dk arayla):
--     0111 öncesi : 17/30 zaman aşımı, 65 sonuç
--     0111 sonrası:  2/30 zaman aşımı, 140 sonuç, dönenlerde isabet %93,6
-- Kalan ikisi AND'in doldurmadığı sorgular:
--     "boşanmada çocuğun velayeti kime verilir"
--     "borçlunun mal kaçırması tasarrufun iptali davası"
-- Türkçe gövdeleme "çocuğun"u "çocuk"la aynı gövdeye indirmiyor ("çocuğ" ≠
-- "çocuk"); "mal kaçırma" kararlarda pek geçmiyor. Tek terim eksik kalınca
-- AND boş dönüyor ve arama, havuzun yarısıyla eşleşen OR'a (16 s) düşüyor.
--
-- İKİ DÜZELTME:
--  1) ORTA BASAMAK: n terimden n-1'ini içeren kararlar — (t1&t2&t3)|(t1&t2&t4)|…
--     Bir terim gövdeleme yüzünden tutmasa bile kalanlar tutar; küme AND'den
--     büyük, OR'dan çok küçük.
--  2) YAVAŞ YOLA TAVAN: OR ve önek aşamaları artık eşleşen HER satırı
--     puanlamıyor; ilk 1.500 eşleşme alınıp onlar puanlanıyor. Bu bir
--     KIRPMA: yaygın tek terimli bir sorguda ("velayet") 6.000 eşleşmenin
--     keyfi 1.500'ü arasından en iyileri döner. Zaman aşımıyla HİÇ sonuç
--     dönmemesinden iyi; ama tam sıralama değil, bunu saklamıyorum.
--     Önek aşamasının kelime döngüsü de yalnız ihtiyaç varsa koşuyor.
--
-- ÖLÇÜLMEMİŞ: bu dosya uygulandıktan sonra 30 soruda zaman aşımı ve isabet.
--
-- DİKKAT — SECURITY DEFINER korunmalı (bkz. 0111 başlığı).

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
    return query
      with aday as (
        -- TAVAN: eşleşen her satırı değil, ilk TAVAN kadarını puanla (bkz. başlık).
        select k.id as rid, k.fts as v
        from public.ictihat_kararlar k
        where k.fts @@ tq and k.id <> all(ve_ids)
        limit TAVAN
      ),
      secilen as (
        select a.rid, ts_rank(a.v, tq, 1) as sc
        from aday a
        order by sc desc, a.rid
        limit kalan
      )
      select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
             left(k.full_text, 320) as snippet, s.sc::real
      from secilen s join public.ictihat_kararlar k on k.id = s.rid
      order by s.sc desc, k.id;
    -- Bu basamakta dönenleri kaydet (aynı sorgu, ucuz: TAVAN sınırlı).
    select coalesce(ve_ids || array_agg(s.rid order by s.sc desc, s.rid), ve_ids) into ve_ids
    from (
      select a.rid, ts_rank(a.v, tq, 1) as sc
      from (select k.id as rid, k.fts as v from public.ictihat_kararlar k
            where k.fts @@ tq and k.id <> all(ve_ids) limit TAVAN) a
      order by sc desc, a.rid
      limit kalan
    ) s;
  end loop;

  kalan := match_count - coalesce(array_length(ve_ids, 1), 0);
  if kalan <= 0 then return; end if;

  -- ── ÖNEK BASAMAĞI (0034'ün geri çağırma yolu), yalnız hâlâ yer varsa ────
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

-- ── DOĞRULAMA: 0111'in üç sorgusu + zaman aşımına uğrayan iki sorgu ────────
create temp table dogrulama (sorgu text, ms integer, sonuc bigint, definer boolean);
do $$
declare q text; t0 timestamptz; n bigint;
begin
  foreach q in array array[
    'gerçek olmayan ihtiyaç nedeniyle tahliye', 'işe iade arabuluculuk dava şartı', 'kıdem tazminatı zamanaşımı',
    'boşanmada çocuğun velayeti kime verilir', 'borçlunun mal kaçırması tasarrufun iptali davası', 'velayet'
  ] loop
    t0 := clock_timestamp();
    select count(*) into n from public.search_ictihat_fts(q, 15);
    insert into dogrulama
    select q, round(extract(epoch from clock_timestamp() - t0) * 1000), n,
           (select p.prosecdef from pg_proc p join pg_namespace s on s.oid = p.pronamespace
             where s.nspname = 'public' and p.proname = 'search_ictihat_fts');
  end loop;
end $$;
select * from dogrulama order by ms desc;
