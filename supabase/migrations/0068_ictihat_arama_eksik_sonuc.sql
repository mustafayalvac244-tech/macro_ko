-- İÇTİHAT ARAMASI BEŞ SONUÇ İSTENİNCE ÜÇ DÖNDÜRÜYORDU.
--
-- ÖLÇÜLEN ARIZA. İçtihat aramasının kalitesi bugüne kadar HİÇ ölçülmemişti;
-- 30 soruluk ölçüm seti kuruldu (scripts/ictihat-sorulari.json) ve ilk sonuç
-- şuydu: 30 soruya 150 sonuç yerine 110 sonuç döndü. Yani istenen her beş
-- karardan ikisi hiç gelmiyordu.
--
-- SEBEP: iki kollu tasarımda ts_rank kolu (a) match_count-2 aday topluyor,
-- kalan iki yer IDF koluna (extra) ayrılıyordu. IDF kolu yeni bir kayıt
-- bulamadığında o iki yer BOŞ kalıyordu — dolduracak aday varken.
--
-- Avukat için eksik her sonuç kayıp bir içtihattır; üstelik sessiz bir kayıp,
-- çünkü "başka karar yok" ile "getirmedik" ekranda aynı görünür.
--
-- ÇÖZÜM: ts_rank kolu match_count kadar aday topluyor, ilk keepA tanesi eskisi
-- gibi başta duruyor, IDF kolunun dolduramadığı yerler kalan adaylarla
-- tamamlanıyor. Sıralama önceliği değişmedi.
--
-- ÖLÇÜM: isabet@5 %54,7 → %75,3 (82/150 → 113/150). Tek isabetli sonuç bile
-- dönmeyen soru sayısı 2'den 1'e indi.

CREATE OR REPLACE FUNCTION public.search_ictihat_fts(q text, match_count integer DEFAULT 15)
 RETURNS TABLE(id text, kurul text, daire text, esas_no text, karar_no text, karar_tarihi text, durum text, snippet text, score real)
 LANGUAGE plpgsql
 STABLE
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
  q_clean text; q_or text; tsq tsquery;
  w text; total bigint; dl bigint; ds bigint;
  longs text[] := '{}'; shorts text[] := '{}'; wl real[] := '{}'; ws real[] := '{}'; orq text;
  keepA integer := greatest(1, match_count - 2);
begin
  select count(*) into total from public.ictihat_kararlar;

  select string_agg(x, ' ') into q_clean from (
    select x from unnest(regexp_split_to_array(lower(coalesce(q, '')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(stopA)) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q, ''); end if;
  select string_agg(lexeme, ' | ') into q_or from unnest(to_tsvector('turkish', q_clean));
  tsq := case when q_or is null or q_or = '' then null else to_tsquery('turkish', q_or) end;

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
    select k.id rid, ts_rank(k.fts, tsq) sc, row_number() over (order by ts_rank(k.fts, tsq) desc, k.id) sira
    from public.ictihat_kararlar k
    where tsq is not null and k.fts @@ tsq
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
    where orq is not null and k.fts_simple @@ to_tsquery('simple', orq)
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
    -- BOŞ KALAN YERLER DOLDURULUR. Ölçülen arıza: beş sonuç istendiğinde üç
    -- dönüyordu; otuz soruda 150 yerine 110 sonuç geldi. Eksik her sonuç,
    -- avukat için kayıp bir içtihattır.
    select rid, sc, 2 tier from aday
    where rid not in (select rid from a)
      and rid not in (select rid from extra)
  )
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
         left(k.full_text, 320) as snippet, mg.sc::real
  from merged mg join public.ictihat_kararlar k on k.id = mg.rid
  order by mg.tier, mg.sc desc, k.id
  limit match_count;
end;
$function$


grant execute on function public.search_ictihat_fts(text, integer) to authenticated, anon, service_role;
