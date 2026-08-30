-- KESİN HUKUKİ KURALLAR — anlam bazlı erişim için tablo. Anahtar-kelime
-- tetikleyicisi yalnız hukuk terimini bilen kullanıcıda çalışıyordu; avukat
-- OLAYI anlattığında ("tapuda satış göstererek devretti") kural bulunamıyordu.
-- Artık kural metinleri FTS ile aranıyor: olay anlatımı da doğru kuralı bulur.
create table if not exists public.legal_rules (
  id text primary key,
  triggers text not null default '',
  body text not null,
  fts tsvector generated always as (to_tsvector('turkish', coalesce(triggers,'') || ' ' || coalesce(body,''))) stored
);
create index if not exists legal_rules_fts_idx on public.legal_rules using gin (fts);
alter table public.legal_rules enable row level security;

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
    order by score desc
    limit match_count;
end;
$$;
grant execute on function public.search_legal_rules(text,integer) to authenticated, anon;
