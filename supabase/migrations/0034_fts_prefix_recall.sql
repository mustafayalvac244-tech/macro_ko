-- Aramanın kaçırdığı maddeleri/kararları yakalayan önek katmanı.
--
-- SORUN: PostgreSQL'in 'turkish' kök bulucusu Türkçe eklerini birleştiremiyor.
-- Ölçüldü:
--     tahliye     → 'tahli'
--     tahliyesine → 'tahliye'
--     tahliyesi   → 'tahliyes'
--     ödemiyor    → 'ödemiyor'   ödeme → 'öde'   ödenmemesi → 'ödenmemes'
-- Aynı kelimenin üç biçimi üç ayrı köke gidiyor ve birbirini TUTMUYOR. Sonuç:
-- avukat "tahliye" yazınca, metninde "tahliyesine" geçen HMK m.4 (Sulh hukuk
-- mahkemelerinin görevi — kiralananın tahliyesi) HİÇ bulunamıyordu. Aynı şekilde
-- "istinaf süresi" sorusunda HMK m.345 (Başvuru süresi) dışarıda kalıyordu.
--
-- Bu, yalnız arama sonucunu değil CEVABIN DOĞRULUĞUNU bozuyor: ilgili madde
-- beslemeye girmeyince model boşluğu kendi hafızasından dolduruyor. Gerçek
-- ölçümde asistan, tahliye davası için görevli mahkemeyi "Asliye Hukuk / İş
-- Mahkemesi" diye yazdı; HMK m.4 açıkça SULH HUKUK diyor.
--
-- ÇÖZÜM: köke indirgemeye hiç güvenmeyen ikinci bir arama yolu. Türkçe eklemeli
-- bir dil olduğu için kök, kelimenin BAŞINDADIR; bu yüzden önek eşleşmesi
-- ('tahliye:*' → tahliyesi, tahliyesine, tahliyesinin) ekleri kendiliğinden
-- kapsar. Bunun için köke indirgemeyen ('simple') ayrı bir arama vektörü tutulur.
--
-- TASARIM KARARI — sıralama DEĞİŞTİRİLMEZ, yalnız EKLENİR:
-- Önce sıralamayı baştan yazmayı (önek+IDF, ardından sıra bazlı birleştirme/RRF)
-- denedim ve beş gerçek soruyla ölçtüm: ikisi de bazı sorularda daha iyi, bazı
-- sorularda DAHA KÖTÜ çıktı — RRF, "Beş yıllık zamanaşımı" maddesini büsbütün
-- kaybetti. Çalışan bir sıralamayı belirsiz bir kazanç için bozmak doğru
-- olmadığından mevcut sıra aynen korunur; önek araması yalnızca mevcut yolun
-- HİÇ bulamadığı kayıtları listenin SONUNA ekler. Kazanç tek yönlüdür: yeni
-- kayıt gelir, çalışan sonuç kaybolmaz.

-- ---------------------------------------------------------------------------
-- 1) Köke indirgemeyen arama vektörleri
-- ---------------------------------------------------------------------------
alter table public.mevzuat_maddeleri
  add column if not exists fts_simple tsvector
  generated always as (to_tsvector('simple',
    coalesce(kanun_short,'') || ' ' || coalesce(baslik,'') || ' ' || coalesce(metin,''))) stored;
create index if not exists mevzuat_fts_simple_idx on public.mevzuat_maddeleri using gin (fts_simple);

alter table public.ictihat_kararlar
  add column if not exists fts_simple tsvector
  generated always as (to_tsvector('simple', coalesce(full_text,''))) stored;
create index if not exists ictihat_fts_simple_idx on public.ictihat_kararlar using gin (fts_simple);

-- ---------------------------------------------------------------------------
-- 2) Mevzuat araması: mevcut sıra + önek katmanının eklediği maddeler
-- ---------------------------------------------------------------------------
create or replace function public.search_mevzuat_fts(q text, match_count integer default 8)
returns table(kanun_short text, kanun_name text, madde_no text, baslik text, snippet text, score real)
language plpgsql stable security definer set search_path = public as $$
declare
  -- A yolu (mevcut): yaygın hukuk kelimeleri elenir, kalanlar OR'lanır.
  stopA text[] := array[
    'dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acmak','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi','hafta',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','taraf','tarafi','kisi','kisinin','nedir','midir','mudur','mi','mu',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','var','yok','olur','gerekir','zorunlu','zorunda'
  ];
  -- B yolu (önek): burada yalnız işlev kelimeleri elenir. Ayırt ediciliği IDF
  -- ölçer — "kira" binlerce maddede geçtiği için kendiliğinden düşük, "tahliye"
  -- üç maddede geçtiği için yüksek ağırlık alır; elle liste tutmaya gerek yok.
  stopB text[] := array[
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','nasil','ise','yani',
    'daha','cok','var','yok','olur','ben','beni','bana','benim','mi','mu','midir','mudur','nedir',
    'yapmaliyim','alabilir','miyim','istiyorum','oldu','edebilir','ama','fakat','ancak','dayanabilirim'
  ];
  q_clean text; q_or text; tsq tsquery;
  w text; total bigint; dl bigint; ds bigint;
  longs text[] := '{}'; shorts text[] := '{}'; wl real[] := '{}'; ws real[] := '{}'; orq text;
  -- Listenin sonunda önek katmanına yer ayrılır; gerisi mevcut yolundur.
  keepA integer := greatest(1, match_count - 2);
begin
  select count(*) into total from public.mevzuat_maddeleri;

  select string_agg(x,' ') into q_clean from (
    select x from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x,'ğüşıöçâîû','gusiocaiu') <> all(stopA)) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q,''); end if;
  select string_agg(lexeme,' | ') into q_or from unnest(to_tsvector('turkish', q_clean));
  tsq := case when q_or is null or q_or = '' then null else to_tsquery('turkish', q_or) end;

  -- Her kelime için iki önek: kelimenin kendisi ve 4 harflik kökü.
  --   "istinaf" → {istinaf, isti}: "istinaf" geçen madde tam eşleşmenin yüksek
  --   ağırlığını alır; yalnız "istismar"/"isteme" geçen madde "isti"nin düşük
  --   ağırlığını alır. Böylece kısa önek, eşadlı kelimeleri öne çıkarmaz.
  --   "kirayı"  → {kirayı, kira}: metinde "kiralanan" geçse de yakalanır.
  for w in select distinct x from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) x
    where length(x) >= 3 and translate(x,'ğüşıöçâîû','gusiocaiu') <> all(stopB)
  loop
    -- Sayım 300'de kesilir: IDF için gereken RELATİF enderliktir, kesin sayı
    -- değil. 300'ü aşan her terim zaten "yaygın" kabul edilip aynı düşük
    -- ağırlığı alır; kesmek tam tarama yerine erken çıkış sağlar.
    select count(*) into ds from (select 1 from public.mevzuat_maddeleri m
      where m.fts_simple @@ to_tsquery('simple', left(w,4)||':*') limit 300) z;
    -- Ayırt etmeyen kelimeyi VERİ eler, elle liste değil: tavana dayanan terim
    -- ("mahkemede", "gün", "süre", "davasını"...) yüzlerce maddede geçiyor
    -- demektir ve sıralamayı konudan uzaklaştırır. Soruda ender kelime hiç
    -- yoksa önek katmanı bir şey eklemez; mevcut arama tek başına çalışır.
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
    select m.id, ts_rank(m.fts, tsq) sc
    from public.mevzuat_maddeleri m
    where tsq is not null and m.fts @@ tsq
    order by sc desc limit keepA
  ),
  terms as (
    select to_tsquery('simple', shorts[i]||':*') tqs, to_tsquery('simple', longs[i]||':*') tql,
           ws[i] wshort, wl[i] wlong
    from generate_subscripts(shorts,1) i where orq is not null
  ),
  b as (
    select m.id,
      -- Kelime başına EN ÖZGÜL eşleşmenin ağırlığı × eşleşen kelime sayısı.
      -- Çarpan, tek bir nadir kelimeye takılan ilgisiz maddeyi geriye iter.
      (select coalesce(sum(case when m.fts_simple @@ t.tql then t.wlong else t.wshort end),0)
         from terms t where m.fts_simple @@ t.tqs)
      * (select count(*) from terms t where m.fts_simple @@ t.tqs) sc
    from public.mevzuat_maddeleri m
    where orq is not null and m.fts_simple @@ to_tsquery('simple', orq)
    order by sc desc limit 40
  ),
  extra as (
    select b.id, b.sc from b where not exists (select 1 from a where a.id = b.id)
    order by b.sc desc limit greatest(0, match_count - (select count(*) from a))
  ),
  merged as (
    select id, sc, 0 tier from a
    union all
    -- Puan, çağıranın gürültü elemesini (en yüksek puanın %30'u) HER DURUMDA
    -- geçecek şekilde verilir; yoksa eklenen kayıt listeye girip hemen elenir.
    -- Sıralamayı bozmaz: tier=1 olduğu için yine A'dan sonra gelir.
    select id, greatest(coalesce((select min(sc) from a), 1.0),
                        coalesce((select max(sc) from a), 1.0) * 0.35), 1 from extra
  )
  select m.kanun_short, m.kanun_name, m.madde_no, m.baslik,
         left(m.metin, 600) as snippet, mg.sc::real
  from merged mg join public.mevzuat_maddeleri m on m.id = mg.id
  order by mg.tier, mg.sc desc;
end;
$$;

grant execute on function public.search_mevzuat_fts(text, integer) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3) İçtihat araması: aynı mantık (0032'deki sıra korunur, önek katmanı eklenir)
-- ---------------------------------------------------------------------------
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
    -- Karar metinleri uzun olduğundan tam sayım pahalı; 300'de kesilir.
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
    order by sc desc limit keepA
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
    order by sc desc limit 40
  ),
  extra as (
    select b.rid, b.sc from b where not exists (select 1 from a where a.rid = b.rid)
    order by b.sc desc limit greatest(0, match_count - (select count(*) from a))
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
  order by mg.tier, mg.sc desc;
end;
$$;

grant execute on function public.search_ictihat_fts(text, integer) to authenticated, anon;
