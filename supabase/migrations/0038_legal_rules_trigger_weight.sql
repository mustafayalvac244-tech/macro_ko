-- Kural aramasında TETİKLEYİCİ kelimeleri gövdeden ağır say.
--
-- SORUN: legal_rules.fts, triggers ile body'yi aynı ağırlıkta topluyordu.
-- Oysa `triggers` alanı zaten "bu kural hangi soruda çıkmalı" sorusunun
-- cevabıdır — en güçlü sinyal odur. Ölçüldü: "istinaf başvuru süresi ne
-- kadardır" sorusunda ALAKASIZ `islah_bir_kez` kuralı (0,0304), doğru
-- `kanun_yolu_sureleri` kuralının (0,0250) ÜSTÜNDE sıralanıyordu — çünkü
-- islah kuralının gövdesinde de "süre" geçiyor.
--
-- Kural sıralaması özellikle önemlidir: bu metinler modele "KESİN KURALLAR —
-- bunlara uymak zorundasın" diye veriliyor ve modelin kendi tahminini eziyor.
-- Yanlış kuralın üste çıkması, yanlış bilgiyi bağlayıcı diye sunmak demektir.
--
-- ÇÖZÜM: mevzuat aramasında ölçülerek işe yaradığı görülen yöntem (0035) —
-- setweight ile triggers 'A', body 'D'. ts_rank varsayılan ağırlıkları
-- tetikleyici eşleşmesini 10 kat sayar.

drop index if exists legal_rules_fts_idx;
alter table public.legal_rules drop column if exists fts;
alter table public.legal_rules add column fts tsvector
  generated always as (
    setweight(to_tsvector('turkish', coalesce(triggers, '')), 'A') ||
    setweight(to_tsvector('turkish', coalesce(body, '')), 'D')
  ) stored;
create index legal_rules_fts_idx on public.legal_rules using gin (fts);

-- Eşit puanlarda kararlı sıra: aynı soru her zaman aynı kuralı getirsin.
create or replace function public.search_legal_rules(q text, match_count integer default 3)
returns table(id text, body text, score real)
language plpgsql stable security definer set search_path = public as $$
declare
  stop text[] := array['dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acmak','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi','hafta',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','taraf','tarafi','kisi','kisinin','nedir','midir','mudur','var','yok',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','olur','gerekir','ben','bana','benim','yapabilirim'];
  q_clean text; q_or text; tsq tsquery;
begin
  select string_agg(w,' ') into q_clean from (
    select w from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) w
    where length(w) >= 3 and translate(w,'ğüşıöçâîû','gusiocaiu') <> all(stop)
  ) t;
  if q_clean is null or q_clean='' then return; end if;
  select string_agg(lexeme,' | ') into q_or from unnest(to_tsvector('turkish', q_clean));
  if q_or is null or q_or='' then return; end if;
  tsq := to_tsquery('turkish', q_or);
  return query
    select r.id, r.body, ts_rank(r.fts, tsq) as score
    from public.legal_rules r
    where r.fts @@ tsq
    order by score desc, r.id
    limit match_count;
end;
$$;

grant execute on function public.search_legal_rules(text,integer) to authenticated, anon;
