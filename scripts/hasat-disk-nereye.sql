-- 332 MB NEREYE GİDİYOR? — tabloyu sütun sütun tartar, TEK tablo döner.
-- ===========================================================================
-- ÖLÇÜLEN (canlı, 2026-09-11): 9.995 karar · tablo 332 MB · indeksler 77 MB
-- · tam metin 44 MB · karar başına 34,1 KB.
--
-- AÇIKLANMAYAN 211 MB VAR. 332 − 77 = 255 MB yığın, ama tam metin yalnız
-- 44 MB. Aradaki farkın ne olduğunu ÖLÇMEDİM. Tahmin yürütebilirim (tsvector
-- sütunları, vektör, TOAST başlıkları, ölü satır şişmesi) ama tahminle mimari
-- karar verilmez: karar başına boyutu tahmin ettiğim için 34,1 KB'ı 10-15 KB
-- sanmıştım, 2-3 kat yanıldım.
--
-- NEDEN ÖNEMLİ: "tam metni Storage'a taşıyalım" diye bir plan önermiştim.
-- Tam metin 332 MB'ın yalnız 44 MB'ıysa o plan %13 kazandırır ve sorunu
-- ÇÖZMEZ. Yer kaplayanı bilmeden taşınacak şeyi seçmek, yanlış şeyi taşımaktır.
--
-- NEDEN GEÇİCİ FONKSİYON: bu tablo bu depodaki migration'larla yaratılmadı;
-- hangi sütunların olduğunu BİLMİYORUM (embedding, fts, fts_simple adları
-- migration'larda geçiyor ama hepsi var mı belirsiz). Düz SQL'de olmayan bir
-- sütunun adını yazmak, `case when exists` ile korunsa bile sorguyu derleme
-- anında düşürür — yerelde tam olarak bu hatayı aldım. Dinamik SQL sütunları
-- katalogdan okur: hiçbir ad varsayılmaz, ne varsa o tartılır.
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur.

create or replace function public.disk_nereye_gecici()
returns table(sira integer, bolum text, alan text, deger text)
language plpgsql
as $$
declare
  r record;
  v bigint;
  toplam numeric;
  indeks numeric;
  heap numeric;
  toast numeric;
begin
  select pg_total_relation_size('public.ictihat_kararlar'),
         pg_indexes_size('public.ictihat_kararlar'),
         pg_relation_size('public.ictihat_kararlar'),
         coalesce((select pg_total_relation_size(reltoastrelid)
                   from pg_class where oid = 'public.ictihat_kararlar'::regclass), 0)
    into toplam, indeks, heap, toast;

  sira := 1; bolum := 'TABLO'; alan := 'toplam';                deger := pg_size_pretty(toplam::bigint); return next;
  sira := 2; bolum := 'TABLO'; alan := 'ana yığın (heap)';      deger := pg_size_pretty(heap::bigint);   return next;
  sira := 3; bolum := 'TABLO'; alan := 'TOAST (uzun değerler)'; deger := pg_size_pretty(toast::bigint);  return next;
  sira := 4; bolum := 'TABLO'; alan := 'indeksler';             deger := pg_size_pretty(indeks::bigint); return next;

  -- SÜTUNLAR: adları katalogdan, boyutları dinamik sorgudan.
  for r in
    select a.attname, format_type(a.atttypid, a.atttypmod) as tip
    from pg_attribute a
    where a.attrelid = 'public.ictihat_kararlar'::regclass
      and a.attnum > 0 and not a.attisdropped
    order by a.attnum
  loop
    begin
      execute format('select sum(pg_column_size(%I))::bigint from public.ictihat_kararlar', r.attname)
        into v;
      sira := 10; bolum := 'SÜTUN'; alan := r.attname || '  (' || r.tip || ')';
      deger := pg_size_pretty(coalesce(v, 0)) ||
               case when toplam > 0 then '   %' || round(100.0 * coalesce(v, 0) / toplam, 1) else '' end;
      return next;
    exception when others then
      sira := 10; bolum := 'SÜTUN'; alan := r.attname; deger := 'ölçülemedi: ' || sqlerrm; return next;
    end;
  end loop;

  -- İNDEKSLER TEK TEK. HNSW ve GIN sanılandan çok yer kaplar.
  for r in
    select indexrelname as ad, pg_relation_size(indexrelid) as boy
    from pg_stat_user_indexes where relname = 'ictihat_kararlar'
    order by pg_relation_size(indexrelid) desc
  loop
    sira := 20; bolum := 'İNDEKS'; alan := r.ad;
    deger := pg_size_pretty(r.boy) ||
             case when toplam > 0 then '   %' || round(100.0 * r.boy / toplam, 1) else '' end;
    return next;
  end loop;

  -- ŞİŞME: silme/güncelleme sonrası geri alınmamış yer. Büyükse VACUUM FULL
  -- hiçbir veri kaybettirmeden ciddi yer açar.
  for r in
    select n_dead_tup, n_live_tup, last_autovacuum, last_vacuum
    from pg_stat_user_tables where relname = 'ictihat_kararlar'
  loop
    sira := 30; bolum := 'ŞİŞME'; alan := 'ölü satır';
    deger := coalesce(r.n_dead_tup, 0)::text || ' / canlı ' || coalesce(r.n_live_tup, 0)::text; return next;
    sira := 31; bolum := 'ŞİŞME'; alan := 'son vacuum';
    deger := coalesce(r.last_autovacuum::text, r.last_vacuum::text, 'hiç'); return next;
  end loop;

  -- KARAR SATIRLARI: hangi hamle ne kazandırır?
  sira := 40; bolum := 'KARAR'; alan := 'indekslerin payı';
  deger := '%' || round(100.0 * indeks / nullif(toplam, 0), 1); return next;

  select sum(pg_column_size(full_text))::bigint into v from public.ictihat_kararlar;
  sira := 41; bolum := 'KARAR'; alan := 'tam metni taşımanın kazancı';
  deger := '%' || round(100.0 * coalesce(v, 0) / nullif(toplam, 0), 1) ||
           '  (' || pg_size_pretty(coalesce(v, 0)) || ')'; return next;

  -- Karar başına boyut düşerse kapasite DOĞRU ORANTILI artar. 8 GB'lık planda
  -- 34,1 KB → 1 milyon karar 32,5 GB; 17 KB olsa 16 GB.
  sira := 42; bolum := 'KARAR'; alan := 'karar başına (ölçülen)';
  deger := round(toplam / greatest((select count(*) from public.ictihat_kararlar), 1) / 1024, 1)::text || ' KB';
  return next;
end;
$$;

select sira, bolum, alan, deger from public.disk_nereye_gecici() order by sira, alan;

drop function public.disk_nereye_gecici();
