-- Madde BAŞLIĞINI gövdeden ağır sayan sıralama + kararlı sıra.
--
-- ÖLÇÜM: scripts/eval-arama.mjs, 18 gerçek avukat sorusu ve her birinin
-- veritabanındaki gerçek metni okunarak belirlenmiş doğru maddeleriyle çalışır.
-- Başlangıç isabeti %52,6 idi: soruların yarısında cevabı veren madde AI'nin
-- beslemesine hiç girmiyordu. Madde gelmeyince model boşluğu kendi hafızasından
-- dolduruyor — ölçülen bir örnekte tahliyede görevli mahkemeyi "asliye hukuk"
-- yazmıştı; HMK m.4 sulh hukuk diyor.
--
-- SORUN 1 — başlık ile gövde aynı ağırlıktaydı. `fts` düz bir vektördü, bu
-- yüzden "İhtiyati tedbirin şartları" başlıklı madde ile konuyu geçerken anan
-- madde arasında sıralama farkı doğmuyordu. Oysa bir maddenin BAŞLIĞI, o
-- maddenin neyi düzenlediğini söyleyen en güçlü sinyaldir.
--   Çözüm: setweight ile başlık 'A', gövde 'D'. ts_rank varsayılan ağırlıkları
--   ({D,C,B,A} = {0.1, 0.2, 0.4, 1.0}) başlık eşleşmesini 10 kat sayar.
--
-- SORUN 2 — sıralama kararsızdı. Eşit puanlı maddeler arasında ORDER BY'ın
-- ikinci bir ölçütü yoktu; aynı soru arka arkaya farklı maddeler döndürebiliyor,
-- ölçüm koşudan koşuya değişiyordu. Kullanıcı açısından da kötü: avukat aynı
-- soruyu tekrar sorduğunda başka kaynak görüyordu.
--   Çözüm: her sıralamaya id ile kesin bir eşitlik bozucu eklendi.
--
-- SONUÇ: %52,6 → %57,9 (11/19), iki ayrı koşuda birebir aynı.
--
-- NOT — neyi ÇÖZMEZ: kalan kaçakların çoğu kelime aramasının doğası gereğidir.
-- Avukat "şiddetli geçimsizlik" yazıyor, kanun "evlilik birliğinin temelinden
-- sarsılması" diyor; ortak kelime yok. Bunun karşılığı anlamsal aramadır
-- (içtihatta zaten var, mevzuata da açılmalı). Denenip ELENEN yollar: önek+IDF
-- yolunu tek başına kullanmak (%38,5) ve durak listesini küçültmek (%52,6 —
-- hiç fark etmedi; ilk tahminim yanlış çıktı).

alter table public.mevzuat_maddeleri
  add column if not exists fts_w tsvector
  generated always as (
    setweight(to_tsvector('turkish', coalesce(kanun_short,'') || ' ' || coalesce(baslik,'')), 'A') ||
    setweight(to_tsvector('turkish', coalesce(madde_no,'') || ' ' || coalesce(metin,'')), 'D')
  ) stored;
create index if not exists mevzuat_fts_w_idx on public.mevzuat_maddeleri using gin (fts_w);

create or replace function public.search_mevzuat_fts(q text, match_count integer default 8)
returns table(kanun_short text, kanun_name text, madde_no text, baslik text, snippet text, score real)
language plpgsql stable security definer set search_path = public as $$
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
    -- fts_w: başlık ağırlıklı vektör (bkz. yukarıdaki SORUN 1).
    select m.id, ts_rank(m.fts_w, tsq) sc
    from public.mevzuat_maddeleri m
    where tsq is not null and m.fts_w @@ tsq
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
$$;

grant execute on function public.search_mevzuat_fts(text, integer) to authenticated, anon;

-- İçtihatta başlık alanı yok (yalnız karar metni), bu yüzden ağırlıklandırma
-- uygulanmaz; kararsız sıralama düzeltmesi orada da gerekli.
create or replace function public.search_ictihat_fts(q text, match_count integer default 15)
returns table(
  id text, kurul text, daire text, esas_no text, karar_no text,
  karar_tarihi text, durum text, snippet text, score real
)
language plpgsql stable as $$
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
  with a as (
    select k.id rid, ts_rank(k.fts, tsq) sc
    from public.ictihat_kararlar k
    where tsq is not null and k.fts @@ tsq
    order by sc desc, k.id limit keepA
  ),
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
  )
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
         left(k.full_text, 320) as snippet, mg.sc::real
  from merged mg join public.ictihat_kararlar k on k.id = mg.rid
  order by mg.tier, mg.sc desc, k.id;
end;
$$;

grant execute on function public.search_ictihat_fts(text, integer) to authenticated, anon;
