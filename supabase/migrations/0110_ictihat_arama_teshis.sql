-- İÇTİHAT ARAMASI ZAMAN AŞIMI — TEŞHİS. ŞEMA DEĞİŞTİRMEZ, yalnız ölçer.
-- ===========================================================================
-- NEDEN MIGRATION DOSYASI. Canlı veritabanına SQL gönderebildiğim tek kanal
-- migration-uygula.yml (Management API). Bu dosya bir "migration" değil, bir
-- ölçüm; ama başka kanal olmadığı için buradan koşuyor. Tekrar tekrar
-- uygulanabilir; hiçbir kalıcı iz bırakmaz (yalnız geçici tablo).
--
-- İLK SÜRÜM (aynı gün, bir önceki commit) KENDİSİ ZAMAN AŞIMINA UĞRADI ve bu
-- başlı başına bir bulgu oldu:
--     ERROR 57014: canceling statement due to statement timeout
--     CONTEXT: select count(*) from (select k.id from ictihat_kararlar k
--              where k.fts @@ tsq order by ts_rank(k.fts, tsq, 1) desc ... limit 15)
--     PL/pgSQL function inline_code_block line 45
-- Management API'nin tavanı 2 dakika (20:14:25 → 20:16:26) ve İLK sorgunun
-- A aşaması (turkish fts + ts_rank) o tavanı tek başına doldurdu. Yani 0108'in
-- "kalan maliyet çift :* önek taramasında (B)" tahmini YANLIŞ YÖNÜ gösteriyordu;
-- pahalı olan A. Sebep şu olmalı (bu dosya bunu ölçüyor): sorgu OR ile
-- kuruluyor (0032, geri çağırma için), "tahliye | ihtiyaç | gerçek | olmayan"
-- gibi yaygın terimler BİNLERCE kararla eşleşiyor ve ts_rank her eşleşen
-- satırın TOAST'lı tsvector'ünü diskten okuyup puanlamak zorunda. GIN indeksi
-- (0108) eşleşmeyi hızlandırır, puanlamayı değil.
--
-- BU SÜRÜM SINIRLI ÖRNEKLEMLE ÖLÇER ki 2 dakikaya sığsın: tam sorguyu
-- koşturmak yerine (1) kaç satır eşleşiyor, (2) eşleşen satırda tsvector kaç
-- bayt, (3) 300 satırı puanlamak kaç ms — ve bunlardan tam maliyet TAHMİN
-- edilir (tahmin olduğu 'deger' sütununda açıkça yazılır). Ayrıca AND
-- kurgusunun (tüm terimler) aynı ölçüleri: düzeltmenin adayı o.
--
-- DİKKAT: canlıdaki 8 sn'lik statement_timeout (authenticated) burada geçerli
-- değil; burada ölçülen tahmin 8.000 ms'yi aşıyorsa kullanıcı "arama
-- başarısız" görüyor demektir.

create temp table teshis (sorgu text, asama text, ms integer, deger text);

do $$
declare
  sorgular text[] := array[
    'gerçek olmayan ihtiyaç nedeniyle tahliye',
    'kıdem tazminatı zamanaşımı',
    'işe iade arabuluculuk dava şartı'
  ];
  stopB text[] := array[
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','nasil','ise','yani',
    'daha','cok','var','yok','olur','ben','beni','bana','benim','mi','mu','midir','mudur','nedir',
    'yapmaliyim','alabilir','miyim','istiyorum','oldu','edebilir','ama','fakat','ancak','dayanabilirim'
  ];
  q text; w text; t0 timestamptz; n bigint; ms integer; boy bigint; toplam bigint;
  q_or text; q_and text; tsq tsquery; tsq_and tsquery; shorts text[]; orq text;
begin
  select count(*) into toplam from public.ictihat_kararlar;
  insert into teshis values ('(havuz)', 'karar sayısı', 0, toplam::text);

  foreach q in array sorgular loop
    shorts := '{}';
    for w in select distinct x
             from unnest(regexp_split_to_array(lower(q), '[^0-9a-zğüşıöçâîû]+')) x
             where length(x) >= 3 and translate(x, 'ğüşıöçâîû', 'gusiocaiu') <> all(stopB)
    loop
      shorts := shorts || left(w, 4);
    end loop;

    select string_agg(lexeme, ' | ') into q_or from unnest(to_tsvector('turkish', q));
    select string_agg(lexeme, ' & ') into q_and from unnest(to_tsvector('turkish', q));
    tsq := to_tsquery('turkish', q_or);
    tsq_and := to_tsquery('turkish', q_and);
    insert into teshis values (q, 'sorgu (OR)', 0, tsq::text);

    -- ── A1: OR ile kaç satır eşleşiyor (GIN, puanlama yok) ────────────────
    t0 := clock_timestamp();
    select count(*) into n from public.ictihat_kararlar k where k.fts @@ tsq;
    ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
    insert into teshis values (q, 'A1 OR eşleşen satır (GIN, puansız)', ms, n::text);

    -- ── A2: eşleşen satırda tsvector boyutu (TOAST okuma maliyetinin ölçüsü) ─
    select coalesce(avg(pg_column_size(k.fts)), 0)::bigint into boy
    from (select fts from public.ictihat_kararlar k where k.fts @@ tsq limit 200) k;
    insert into teshis values (q, 'A2 ort. tsvector boyutu (200 satır)', 0, boy::text || ' bayt');

    -- ── A3: 300 satırı ts_rank ile puanlamak kaç ms → tam maliyet tahmini ───
    t0 := clock_timestamp();
    perform ts_rank(k.fts, tsq, 1) from (select fts from public.ictihat_kararlar k where k.fts @@ tsq limit 300) k;
    ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
    insert into teshis values (q, 'A3 ts_rank 300 satır', ms,
      'TAHMİN tam puanlama ≈ ' || round(ms * n / 300.0)::text || ' ms (' || n || ' satır × ' || round(ms / 300.0, 2) || ' ms)');

    -- ── A4: AND kurgusu — kaç satır, tam puanlama kaç ms (küçükse gerçek ölçüm) ─
    t0 := clock_timestamp();
    select count(*) into n from public.ictihat_kararlar k where k.fts @@ tsq_and;
    ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
    insert into teshis values (q, 'A4 AND eşleşen satır', ms, n::text);
    if n <= 3000 then
      t0 := clock_timestamp();
      perform k.id from public.ictihat_kararlar k where k.fts @@ tsq_and order by ts_rank(k.fts, tsq_and, 1) desc, k.id limit 15;
      ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
      insert into teshis values (q, 'A5 AND tam puanlama + limit 15 (GERÇEK ölçüm)', ms, n::text || ' satır');
    else
      insert into teshis values (q, 'A5 AND tam puanlama', 0, 'atlandı: ' || n || ' satır > 3000');
    end if;

    -- ── B: simple OR-önek taraması (0108'in şüphelendiği yer) ────────────
    if array_length(shorts, 1) is not null then
      orq := array_to_string(array(select p || ':*' from unnest(shorts) p), ' | ');
      t0 := clock_timestamp();
      select count(*) into n from (select 1 from public.ictihat_kararlar k
        where k.fts_simple @@ to_tsquery('simple', orq) limit 3000) z;
      ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
      insert into teshis values (q, 'B1 önek4 OR eşleşen satır (en fazla 3000 sayıldı)', ms, n::text);

      t0 := clock_timestamp();
      perform (select count(*) from unnest(shorts) p where k.fts_simple @@ to_tsquery('simple', p || ':*'))
      from (select fts_simple from public.ictihat_kararlar k where k.fts_simple @@ to_tsquery('simple', orq) limit 300) k;
      ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
      insert into teshis values (q, 'B2 önek puanlama 300 satır', ms,
        'TAHMİN tam ≈ ' || round(ms * n / 300.0)::text || ' ms (en az)');
    end if;
  end loop;
end $$;

select sorgu, asama, ms, deger
from teshis
order by sorgu, asama;
