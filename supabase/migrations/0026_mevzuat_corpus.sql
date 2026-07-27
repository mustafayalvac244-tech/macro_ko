-- Yürürlükteki mevzuat korpusu — AI'nın gerçek kanun metnine dayanması için.
-- 7 temel kanunun (~4.500 madde) tam madde metni aranabilir bir tabloda tutulur;
-- ai-chat/ictihat Edge Function'ları soruyla ilgili GERÇEK madde metinlerini
-- getirip yanıtı buna dayandırır. Böylece madde no/içeriği hafızadan "tahmin"
-- edilmez. Veri kaynağı: src/data/laws/*.json (uygulamayla aynı offline korpus).
--
-- Not: Satırlar Yönetim API'siyle toplu yüklendi (src/data/laws/*.json ->
-- INSERT ... ON CONFLICT). Yeniden yüklemek için aynı JSON'lardan üretmek yeter.

create table if not exists public.mevzuat_maddeleri (
  id bigint generated always as identity primary key,
  kanun_short text not null,          -- TMK, TBK, HMK, CMK, TCK, TTK, İşK
  kanun_name text not null,           -- "4721 sayılı Türk Medeni Kanunu"
  madde_no text not null,             -- "733", "Geçici 1"
  baslik text,                        -- maddenin kenar başlığı
  metin text not null,                -- tam madde metni
  section text,                       -- kanun sistematiğindeki bölüm yolu (varsa)
  fts tsvector generated always as (
    to_tsvector('turkish',
      coalesce(kanun_short,'') || ' ' || coalesce(baslik,'') || ' ' ||
      coalesce(madde_no,'') || ' ' || coalesce(metin,''))
  ) stored,
  unique (kanun_short, madde_no)
);

create index if not exists mevzuat_fts_idx on public.mevzuat_maddeleri using gin (fts);
create index if not exists mevzuat_kanun_idx on public.mevzuat_maddeleri (kanun_short);

alter table public.mevzuat_maddeleri enable row level security;
drop policy if exists mevzuat_read on public.mevzuat_maddeleri;
create policy mevzuat_read on public.mevzuat_maddeleri
  for select to authenticated using (true);

-- Doğal dil sorgusu için FTS: soru cümlesindeki anlamlı lexeme'leri OR'lar
-- (uzun soru AND'lenince hiç eşleşmiyordu); yaygın hukuk kelimelerini (dava,
-- süre, kanun, mahkeme...) eleyip ayırt edici terimleri (bono, önalım, istinaf,
-- nafaka...) öne çıkarır. SECURITY DEFINER: tabloyu kilitli tutup tek erişim
-- yolu bu fonksiyon olsun.
create or replace function public.search_mevzuat_fts(q text, match_count integer default 8)
returns table(kanun_short text, kanun_name text, madde_no text, baslik text, snippet text, score real)
language plpgsql stable security definer set search_path = public as $$
declare
  stop text[] := array[
    'dava','davasi','davasinda','davada','davaya','davanin','acilir','acilan','acmak','acilmasi',
    'sure','suresi','suresinde','surede','surenin','kac','yil','yili','gun','gunu','ay','ayi','hafta',
    'madde','maddesi','kanun','kanunu','hukuk','hukuki','hukuku','mahkeme','mahkemesi','mahkemede',
    'hakim','karar','karari','taraf','tarafi','kisi','kisinin','nedir','midir','mudur','mi','mu',
    'ile','icin','olan','olarak','veya','gibi','bir','bu','ne','kadar','hangi','bagli','basvuru',
    'nasil','ise','yani','hem','daha','cok','vardir','var','yok','olur','gerekir','zorunlu','zorunda'
  ];
  q_clean text;
  q_or text;
  tsq tsquery;
begin
  select string_agg(w, ' ') into q_clean
  from (
    select w from unnest(regexp_split_to_array(lower(coalesce(q,'')), '[^0-9a-zğüşıöçâîû]+')) w
    where length(w) >= 3
      and translate(w, 'ğüşıöçâîû', 'gusiocaiu') <> all(stop)
  ) t;
  if q_clean is null or q_clean = '' then q_clean := coalesce(q,''); end if;
  select string_agg(lexeme, ' | ') into q_or from unnest(to_tsvector('turkish', q_clean));
  if q_or is null or q_or = '' then return; end if;
  tsq := to_tsquery('turkish', q_or);
  return query
    select m.kanun_short, m.kanun_name, m.madde_no, m.baslik,
           left(m.metin, 600) as snippet,
           ts_rank(m.fts, tsq) as score
    from public.mevzuat_maddeleri m
    where m.fts @@ tsq
    order by score desc
    limit match_count;
end;
$$;

grant execute on function public.search_mevzuat_fts(text, integer) to authenticated, anon;
