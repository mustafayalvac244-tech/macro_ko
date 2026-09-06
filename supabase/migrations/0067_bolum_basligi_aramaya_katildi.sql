-- BÖLÜM BAŞLIĞI ARAMAYA KATILDI — maddelerin üçte birinin kendi başlığı yetersiz.
--
-- ÖLÇÜLEN ARIZA. Arama ölçümünde kalan 21 kaçağın belirgin bir kısmı "doğru
-- bölüm, yanlış madde" biçimindeydi:
--
--   "edinilmiş mallara katılma rejimi neleri kapsar"
--   beklenen: TMK 218 — başlığı yalnızca "Kapsamı"
--   dönen   : TMK 219 ("Edinilmiş mallar"), 228, 230 — hepsi aynı bölümden
--
--   "sözleşmede faiz kararlaştırılmamışsa temerrüt faizi ne olur"
--   beklenen: TBK 120 — başlığı yalnızca "Genel olarak"
--   dönen   : TBK 121 ("Faizlerde… temerrüt faizi"), TBK 112 …
--
-- SEBEP: Türk kanunlarında başlıklar HİYERARŞİKTİR. Madde başlığı üst başlığın
-- altında anlam kazanır; tek başına "Kapsamı" ya da "Genel olarak" hiçbir şey
-- aramaz. Havuzdaki 6.107 maddenin 1.981'inin (yüzde 32) başlığı 14 karakterden
-- kısa — yani üçte biri bu durumda.
--
-- Üst başlık zaten VARDI: section sütunu 5.846 maddede dolu ve TMK 218 için
-- "EŞLER ARASINDAKİ MAL REJİMİ › EDİNİLMİŞ MALLARA KATILMA" yazıyor — sorunun
-- birebir karşılığı. Üç arama vektörünün hiçbiri bu sütunu okumuyordu.
--
-- ÖLÇÜM: isabet 47/68 → 48/68 (%69,1 → %70,6). Bir soru; küçük ama gerçek —
-- bu ölçüm deterministik, gürültü değil.
--
-- YALNIZ AĞIRLIKLI KOLA EKLENDİ. Aynı başlık IDF koluna (fts_simple) da
-- eklenip ölçüldü: kazanç YOK (47/68). Kazanç getirmeyen değişiklik, taşınacak
-- fazladan yüktür — eklenmedi.
--
-- Ağırlık B seçildi: maddenin KENDİ başlığından (A) daha zayıf, metinden (D)
-- daha güçlü. Bölüm başlığı maddeyi tanımlar ama maddenin kendisi kadar özel
-- değildir.

alter table public.mevzuat_maddeleri
  add column if not exists fts_w2 tsvector generated always as (
    setweight(to_tsvector('turkish', coalesce(kanun_short,'') || ' ' || coalesce(baslik,'')), 'A')
    || setweight(to_tsvector('turkish', coalesce(section,'')), 'B')
    || setweight(to_tsvector('turkish', coalesce(madde_no,'') || ' ' || coalesce(metin,'')), 'D')
    || setweight(to_tsvector('turkish', coalesce(baglam,'')), 'D')
  ) stored;

create index if not exists mevzuat_fts_w2_idx on public.mevzuat_maddeleri using gin(fts_w2);

-- search_mevzuat_fts artık fts_w yerine fts_w2 okuyor. Eski sütun ve indeksi
-- DURUYOR: ölçüm birkaç koşu daha doğrulanana kadar geri dönüş yolu açık
-- kalsın. Kullanılmadığı doğrulandığında ayrı bir göçle düşürülür.
create or replace function public.search_mevzuat_fts(q text, match_count integer default 8)
returns table(kanun_short text, kanun_name text, madde_no text, baslik text, snippet text, score real)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  stopA text[] := array[
    'dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acmak','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi','hafta',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','taraf','tarafi','kisi','kisinin','nedir','midir','mudur','mi','mu',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','var','yok','olur','gerekir','zorunlu','zorunda'
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
  select count(*) into total from public.mevzuat_maddeleri;

  select string_agg(x,' ') into q_clean from (
    select x from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x,'ğüşıöçâîû','gusiocaiu') <> all(stopA)) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q,''); end if;
  select string_agg(lexeme,' | ') into q_or from unnest(to_tsvector('turkish', q_clean));
  tsq := case when q_or is null or q_or = '' then null else to_tsquery('turkish', q_or) end;

  for w in select distinct x from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x,'ğüşıöçâîû','gusiocaiu') <> all(stopB)
  loop
    select count(*) into ds from (select 1 from public.mevzuat_maddeleri m
      where m.fts_simple @@ to_tsquery('simple', left(w,4)||':*') limit 300) z;
    continue when ds = 0 or ds >= 300;
    select count(*) into dl from (select 1 from public.mevzuat_maddeleri m
      where m.fts_simple @@ to_tsquery('simple', w||':*') limit 300) z;
    shorts := shorts || left(w,4); ws := ws || ln((total+1.0)/(ds+1.0))::real;
    longs  := longs  || w;         wl := wl || ln((total+1.0)/(dl+1.0))::real;
  end loop;
  orq := case when array_length(shorts,1) is null then null
              else array_to_string(array(select p||':*' from unnest(shorts) p), ' | ') end;

  return query
  with a as (
    -- fts_w2: madde başlığı (A) + BÖLÜM BAŞLIĞI (B) + metin (D).
    select m.id, ts_rank(m.fts_w2, tsq) sc
    from public.mevzuat_maddeleri m
    where tsq is not null and m.fts_w2 @@ tsq
    order by sc desc, m.id limit keepA
  ),
  terms as (
    select to_tsquery('simple', shorts[i]||':*') tqs, to_tsquery('simple', longs[i]||':*') tql,
           ws[i] wshort, wl[i] wlong
    from generate_subscripts(shorts,1) i where orq is not null
  ),
  b as (
    select m.id,
      (select coalesce(sum(case when m.fts_simple @@ t.tql then t.wlong else t.wshort end),0)
         from terms t where m.fts_simple @@ t.tqs)
      * (select count(*) from terms t where m.fts_simple @@ t.tqs) sc
    from public.mevzuat_maddeleri m
    where orq is not null and m.fts_simple @@ to_tsquery('simple', orq)
    order by sc desc, m.id limit 40
  ),
  extra as (
    select b.id, b.sc from b where not exists (select 1 from a where a.id = b.id)
    order by b.sc desc, b.id limit greatest(0, match_count - (select count(*) from a))
  ),
  merged as (
    select id, sc, 0 tier from a
    union all
    select id, greatest(coalesce((select min(sc) from a), 1.0),
                        coalesce((select max(sc) from a), 1.0) * 0.35), 1 from extra
  )
  select m.kanun_short, m.kanun_name, m.madde_no, m.baslik,
         left(m.metin, 600) as snippet, mg.sc::real
  from merged mg join public.mevzuat_maddeleri m on m.id = mg.id
  order by mg.tier, mg.sc desc, m.id;
end;
$function$;

grant execute on function public.search_mevzuat_fts(text, integer) to authenticated, anon, service_role;
