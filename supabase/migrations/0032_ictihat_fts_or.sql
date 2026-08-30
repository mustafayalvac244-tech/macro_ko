-- İçtihat aramasında doğal dil sorgusu düzeltmesi.
--
-- SORUN: search_ictihat_fts, websearch_to_tsquery kullanıyordu ve bu tüm
-- kelimeleri AND'liyor. Avukatın doğal cümlesi ("işçi kıdem tazminatı
-- ödenmedi haklı fesih") altı kelimenin HEPSİNİN tek kararda geçmesini
-- şart koştuğu için HİÇ SONUÇ dönmüyordu — havuzda o konuda yüzlerce karar
-- olmasına rağmen. Kısa sorgular ("fazla mesai ücreti") çalıştığı için sorun
-- fark edilmemişti.
--
-- ÇÖZÜM: mevzuat aramasında (0026) zaten kanıtlanmış yaklaşım — sorguyu
-- lexeme'lere ayır, yaygın hukuk kelimelerini ele, kalanları OR'la ve
-- ts_rank ile sırala. OR olduğu için uzun cümle de eşleşir; sıralama daha
-- çok terim içeren kararı öne aldığından isabet de artar.

create or replace function public.search_ictihat_fts(q text, match_count integer default 15)
returns table(
  id text, kurul text, daire text, esas_no text, karar_no text,
  karar_tarihi text, durum text, snippet text, score real
)
language plpgsql stable as $$
declare
  -- Neredeyse her kararda geçtiği için ayırt edici olmayan kelimeler.
  stop text[] := array[
    'dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','kararin','taraf','tarafi','kisi','kisinin','nedir','midir','mudur',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','var','yok','olur','gerekir','zorunlu',
    'dairesi','daire','yargitay','danistay','esas','sayili','hakkinda','uzere','ancak','ayrica'
  ];
  q_clean text;
  q_or text;
  tsq tsquery;
begin
  -- Anlamlı kelimeleri süz: en az 3 harf, Türkçe harfler sadeleştirilerek
  -- stop listesiyle karşılaştırılır (liste ASCII tutulduğu için).
  select string_agg(w, ' ') into q_clean
  from (
    select w from unnest(regexp_split_to_array(lower(coalesce(q, '')), '[^0-9a-zğüşıöçâîû]+')) w
    where length(w) >= 3
      and translate(w, 'ğüşıöçâîû', 'gusiocaiu') <> all(stop)
  ) t;

  -- Tümü elendiyse ham sorguya dön (ör. yalnız "TCK 125" gibi kısa girdiler).
  if q_clean is null or q_clean = '' then q_clean := coalesce(q, ''); end if;

  select string_agg(lexeme, ' | ') into q_or from unnest(to_tsvector('turkish', q_clean));
  if q_or is null or q_or = '' then return; end if;
  tsq := to_tsquery('turkish', q_or);

  return query
    select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi, k.durum,
           left(k.full_text, 320) as snippet,
           ts_rank(k.fts, tsq) as score
    from public.ictihat_kararlar k
    where k.fts @@ tsq
    order by score desc
    limit match_count;
end;
$$;
