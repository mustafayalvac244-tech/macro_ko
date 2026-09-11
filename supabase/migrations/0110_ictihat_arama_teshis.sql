-- İÇTİHAT ARAMASI ZAMAN AŞIMI — TEŞHİS. ŞEMA DEĞİŞTİRMEZ, yalnız ölçer.
-- ===========================================================================
-- NEDEN MIGRATION DOSYASI. Canlı veritabanına SQL gönderebildiğim tek kanal
-- migration-uygula.yml (Management API). Bu dosya bir "migration" değil, bir
-- ölçüm; ama başka kanal olmadığı için buradan koşuyor. Tekrar tekrar
-- uygulanabilir; hiçbir kalıcı iz bırakmaz (yalnız geçici tablo).
--
-- ÖLÇÜLEN DURUM (0108 sonrası, canlı): 30 sorunun 7'si hâlâ zaman aşımı
-- (57014). 0108, `fts` sütununa GIN indeksi ekledi ve 11 → 7'ye indirdi;
-- kalan maliyetin nerede olduğu ÖLÇÜLMEDİ, tahmin edildi ("çift :* önek
-- taraması"). Tahminle düzeltme yapmak yerine önce aşama aşama süre ölçülür.
--
-- search_ictihat_fts (0069) üç aşamadan oluşuyor:
--   DÖNGÜ  her sorgu kelimesi için İKİ sayım: 4 harf önek (left(w,4)||':*')
--          ve tam kelime önek (w||':*'), her biri limit 300.
--   A      turkish fts: k.fts @@ tsq + ts_rank(…,1) sıralaması, limit 15.
--   B      simple fts: k.fts_simple @@ (önek1:* | önek2:* | …) ile eşleşen
--          HER satır için terim başına iki alt sorgu (puan), sonra limit 40.
--          Puanlama için eşleşen TÜM satırlar taranır; limit sonra gelir.
--
-- Bu dosya her aşamayı ayrı ayrı zamanlar ve B'de kaç satırın puanlandığını
-- sayar. Sonuç son SELECT'te; Management API yalnız son deyimin satırlarını
-- döndürür (bkz. scripts/migration-uygula.mjs).
--
-- DİKKAT: Management API `postgres` rolüyle koşar; canlıdaki 8 sn'lik
-- statement_timeout (authenticated rolü) burada geçerli değil. Yani burada
-- 12 sn ölçülen bir aşama, kullanıcı için "arama başarısız" demektir.

create temp table teshis (sorgu text, asama text, ms integer, satir bigint);

do $$
declare
  sorgular text[] := array[
    'gerçek olmayan ihtiyaç nedeniyle tahliye',
    'kıdem tazminatı zamanaşımı',
    'kira bedelinin tespiti',
    'işe iade arabuluculuk dava şartı',
    'trafik kazası manevi tazminat',
    'boşanma yoksulluk nafakası'
  ];
  stopB text[] := array[
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','nasil','ise','yani',
    'daha','cok','var','yok','olur','ben','beni','bana','benim','mi','mu','midir','mudur','nedir',
    'yapmaliyim','alabilir','miyim','istiyorum','oldu','edebilir','ama','fakat','ancak','dayanabilirim'
  ];
  q text; w text; t0 timestamptz; n bigint;
  q_or text; tsq tsquery; shorts text[]; longs text[]; orq text;
begin
  foreach q in array sorgular loop
    shorts := '{}'; longs := '{}';

    -- ── DÖNGÜ: kelime başına iki önek sayımı ──────────────────────────────
    for w in select distinct x
             from unnest(regexp_split_to_array(lower(q), '[^0-9a-zğüşıöçâîû]+')) x
             where length(x) >= 3 and translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(stopB)
    loop
      t0 := clock_timestamp();
      select count(*) into n from (select 1 from public.ictihat_kararlar k
        where k.fts_simple @@ to_tsquery('simple', left(w, 4) || ':*') limit 300) z;
      insert into teshis values (q, 'döngü önek4 ' || left(w, 4), round(extract(epoch from clock_timestamp() - t0) * 1000), n);

      t0 := clock_timestamp();
      select count(*) into n from (select 1 from public.ictihat_kararlar k
        where k.fts_simple @@ to_tsquery('simple', w || ':*') limit 300) z;
      insert into teshis values (q, 'döngü tam ' || w, round(extract(epoch from clock_timestamp() - t0) * 1000), n);

      shorts := shorts || left(w, 4); longs := longs || w;
    end loop;

    -- ── A: turkish fts + ts_rank(…,1) ────────────────────────────────────
    select string_agg(lexeme, ' | ') into q_or from unnest(to_tsvector('turkish', q));
    tsq := case when q_or is null or q_or = '' then null else to_tsquery('turkish', q_or) end;
    if tsq is not null then
      t0 := clock_timestamp();
      select count(*) into n from (select k.id from public.ictihat_kararlar k
        where k.fts @@ tsq order by ts_rank(k.fts, tsq, 1) desc, k.id limit 15) z;
      insert into teshis values (q, 'A fts@@tsq + ts_rank limit 15', round(extract(epoch from clock_timestamp() - t0) * 1000), n);

      t0 := clock_timestamp();
      select count(*) into n from public.ictihat_kararlar k where k.fts @@ tsq;
      insert into teshis values (q, 'A eşleşen toplam satır', round(extract(epoch from clock_timestamp() - t0) * 1000), n);
    end if;

    -- ── B: simple OR-önek taraması ───────────────────────────────────────
    if array_length(shorts, 1) is not null then
      orq := array_to_string(array(select p || ':*' from unnest(shorts) p), ' | ');

      t0 := clock_timestamp();
      select count(*) into n from public.ictihat_kararlar k
        where k.fts_simple @@ to_tsquery('simple', orq);
      insert into teshis values (q, 'B eşleşen toplam satır (puanlanacak)', round(extract(epoch from clock_timestamp() - t0) * 1000), n);

      -- Fonksiyondaki B ile BİREBİR aynı puanlama (terim başına iki alt sorgu).
      t0 := clock_timestamp();
      select count(*) into n from (
        with terms as (
          select to_tsquery('simple', shorts[i] || ':*') tqs, to_tsquery('simple', longs[i] || ':*') tql
          from generate_subscripts(shorts, 1) i
        )
        select k.id,
          (select count(*) from terms t where k.fts_simple @@ t.tql)
          * (select count(*) from terms t where k.fts_simple @@ t.tqs) sc
        from public.ictihat_kararlar k
        where k.fts_simple @@ to_tsquery('simple', orq)
        order by sc desc, k.id limit 40
      ) z;
      insert into teshis values (q, 'B puanlama + limit 40 (fonksiyondaki gibi)', round(extract(epoch from clock_timestamp() - t0) * 1000), n);

      -- KARŞILAŞTIRMA: 5 harf önek olsaydı kaç satır puanlanırdı?
      orq := array_to_string(array(select left(p, 5) || ':*' from unnest(longs) p), ' | ');
      t0 := clock_timestamp();
      select count(*) into n from public.ictihat_kararlar k
        where k.fts_simple @@ to_tsquery('simple', orq);
      insert into teshis values (q, 'B′ önek5 ile eşleşen satır', round(extract(epoch from clock_timestamp() - t0) * 1000), n);
    end if;

    -- ── TOPLAM: gerçek fonksiyon ─────────────────────────────────────────
    t0 := clock_timestamp();
    select count(*) into n from public.search_ictihat_fts(q, 15);
    insert into teshis values (q, 'TOPLAM search_ictihat_fts(q,15)', round(extract(epoch from clock_timestamp() - t0) * 1000), n);
  end loop;
end $$;

select sorgu, asama, ms, satir
from teshis
order by sorgu, ms desc;
