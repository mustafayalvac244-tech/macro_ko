-- KURAL HAVUZU ARAMAYI BESLİYOR — "hangi madde" sorusunun cevabı zaten bizde.
--
-- ÖLÇÜLEN ARIZA (67 soruluk arama ölçümü, isabet %61,8). Kaçan 26 sorunun
-- büyük kısmı Türk hukukunun EN TEMEL soruları:
--   "istinafa başvurmak için kaç günüm var"      → HMK 345 gelmedi
--   "dava dilekçesinde hangi bilgiler bulunmalı" → HMK 119 gelmedi
--   "haksız fiilde zamanaşımı ne kadardır"       → TBK 72 gelmedi
--   "tutuklama için hangi şartlar aranır"        → CMK 100 gelmedi
--   "açtığım davayı ıslah edebilir miyim"        → HMK 176 gelmedi
--
-- Sebep: ts_rank'te IDF yok, sık kelimeler nadir olanı eziyor. Sıralamayı
-- ayarlayarak düzeltmeyi denedik ve ÖLÇTÜK — üç ayrı aday (yalnız IDF, IDF'e
-- daha çok yer, harmanlanmış puan) ve on iki ağırlık kombinasyonu denendi;
-- hiçbiri %61,8'i geçemedi. Yani eksik olan ağırlık değil, SİNYALİN KENDİSİ.
--
-- ELİMİZDEKİ SİNYAL: legal_rules. Kırk beş kural, tam da bu soruların cevabını
-- ve dayandığı madde numarasını içeriyor ve kural araması doğal dilde İYİ
-- çalışıyor (ölçüldü: sekiz sorunun altısında doğru maddeyi atıf olarak içeren
-- kural ilk üçte geliyor). Bu bilgi duruyordu ve mevzuat araması onu hiç
-- kullanmıyordu.
--
-- Yaptığı şey basit: soruya en çok uyan kuralların ATIF YAPTIĞI maddeler,
-- mevzuat aramasının sonuçlarının BAŞINA konur. Kural "istinaf süresi HMK
-- m.345'tir" diyorsa, o soruda HMK 345'i ilk sıraya koymamak için sebep yok.

-- ── 1. KURAL ATIFLARI ───────────────────────────────────────────────────────
-- Kural metinlerindeki "HMK m.345", "TBK m. 146", "İİK m.62/son" gibi atıflar
-- ayrıştırılıp saklanır. Her aramada regex çalıştırmak yerine bir kez çıkarıp
-- tabloda tutmak, aramayı yavaşlatmamak için.
create table if not exists public.legal_rule_atif (
  rule_id text not null references public.legal_rules(id) on delete cascade,
  kanun_short text not null,
  madde_no text not null,
  -- Kuralın kaçıncı atfı: ilk atıf genelde kuralın ANA dayanağıdır, sondakiler
  -- yan atıf olur. Sıralamada öne almak için tutuluyor.
  sira integer not null,
  primary key (rule_id, kanun_short, madde_no)
);

alter table public.legal_rule_atif enable row level security;
drop policy if exists legal_rule_atif_read on public.legal_rule_atif;
create policy legal_rule_atif_read on public.legal_rule_atif for select to authenticated, anon using (true);

/**
 * Kural metinlerinden atıfları yeniden çıkarır.
 *
 * Yalnız HAVUZDA OLAN kanunların kısaltmaları aranır: havuzda olmayan bir
 * kanuna (örn. KTK) yapılan atfı saklamanın anlamı yok, o maddeyi zaten
 * gösteremeyiz.
 */
create or replace function public.kural_atiflarini_tazele()
returns integer
language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.legal_rule_atif;

  insert into public.legal_rule_atif (rule_id, kanun_short, madde_no, sira)
  select rule_id, kanun_short, madde_no, min(sira)
  from (
    select r.id as rule_id,
           k.kanun_short,
           (m.eslesme)[2] as madde_no,
           m.sira
    from public.legal_rules r
    cross join (select distinct kanun_short from public.mevzuat_maddeleri) k
    cross join lateral (
      select e.eslesme, e.sira
      from regexp_matches(
             r.body,
             '(' || k.kanun_short || ')\s*m\.?\s*([0-9]+)',
             'g'
           ) with ordinality as e(eslesme, sira)
    ) m
  ) x
  group by rule_id, kanun_short, madde_no;

  get diagnostics n = row_count;
  return n;
end;
$$;

select public.kural_atiflarini_tazele();

-- ── 2. KURAL DESTEKLİ MEVZUAT ARAMASI ───────────────────────────────────────
/**
 * Mevzuat araması + kural havuzundan gelen atıflar.
 *
 * SIRALAMA: önce kuralların işaret ettiği maddeler (en çok üç tane), sonra
 * mevcut aramanın sonuçları. Üç ile sınırlı olmasının sebebi: bir kural sekiz
 * maddeye atıf yapabiliyor ve hepsini başa koymak, aramanın kendi isabetini
 * boğardı. Kural puanı ve kuraldaki atıf sırası birlikte kullanılıyor — ilk
 * atıf genelde kuralın ana dayanağıdır.
 *
 * Mevcut arama SİLİNMEDİ, sarmalandı: kural eşleşmezse davranış aynen eskisi.
 */
create or replace function public.search_mevzuat_kural(q text, match_count integer default 8)
returns table(kanun_short text, kanun_name text, madde_no text, baslik text, snippet text, score real)
language plpgsql
stable security definer set search_path = public as $$
-- ÜÇ ATIF, ÜÇ KURAL: ölçülerek seçildi. Kural sayısı 5'e, atıf sayısı 2, 4 ve
-- 5'e çıkarıldığında isabet DÜŞÜYOR (%67,6 / %67,6 / %64,7). Bir kural sekiz
-- maddeye atıf yapabiliyor ve hepsini başa koymak aramanın kendi isabetini
-- boğuyor.
declare kural_ust integer := least(3, greatest(1, match_count - 3));
begin
  return query
  with kural as (select r.id, r.score from public.search_legal_rules(q, 3) r),
  atif as (
    select a.kanun_short, a.madde_no,
           row_number() over (order by k.score desc, a.sira, a.kanun_short, a.madde_no) as sira
    from kural k join public.legal_rule_atif a on a.rule_id = k.id
  ),
  ust as (
    select m.id, m.kanun_short ks, m.kanun_name kn, m.madde_no mn, m.baslik bs, m.metin mt, a.sira
    from atif a
    join public.mevzuat_maddeleri m
      on m.kanun_short = a.kanun_short
     and split_part(btrim(m.madde_no), '/', 1) = a.madde_no
    where a.sira <= kural_ust
  ),
  alt as (
    select s.*, row_number() over () as sira from public.search_mevzuat_fts(q, match_count) s
  ),
  hepsi as (
    select u.ks, u.kn, u.mn, u.bs, left(u.mt, 600) sn, (1000 - u.sira)::real sc, 0 tier, u.sira ic
    from ust u
    union all
    select a.kanun_short, a.kanun_name, a.madde_no, a.baslik, a.snippet, a.score, 1, a.sira
    from alt a
    where not exists (select 1 from ust u where u.ks = a.kanun_short and u.mn = a.madde_no)
  )
  select h.ks, h.kn, h.mn, h.bs, h.sn, h.sc
  from hepsi h order by h.tier, h.ic limit match_count;
end;
$$;

grant execute on function public.search_mevzuat_kural(text, integer) to authenticated, anon, service_role;
grant execute on function public.kural_atiflarini_tazele() to service_role;
