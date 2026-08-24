-- ============================================================
-- EN AKTİF KULLANICI + GELİR-GİDER TABLOSU
--
-- Nasıl çalıştırılır: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- Dört sorgu sırayla çalışır:
--   1) En aktif kullanıcılar (kayıt sayısına göre ilk 5)
--   2) En aktif kullanıcının kategori bazında gelir-gider dökümü
--   3) Genel özet (toplam gelir / gider / net)
--   4) Son 12 ayın aylık dökümü
--
-- Dava tahsilatları (payments) da gelire dahil edilir; böylece sonuç
-- uygulamadaki Finans ekranının toplamlarıyla birebir uyuşur.
-- Yerel PostgreSQL 16'da aynı şema kurulup test edildi (sonuçlar doğrulandı).
-- ============================================================

-- 1) EN AKTİF KULLANICI (kayıt sayısına göre sıralı ilk 5)
with aktivite as (
  select p.id, p.full_name, p.firm_name,
         (select count(*) from cases            c where c.owner_id = p.id) as dava,
         (select count(*) from clients          k where k.owner_id = p.id) as muvekkil,
         (select count(*) from hearings         h where h.owner_id = p.id) as durusma,
         (select count(*) from finance_entries  f where f.owner_id = p.id) as finans_kaydi,
         (select count(*) from payments         o where o.owner_id = p.id) as tahsilat
  from profiles p
)
select *,
       (dava + muvekkil + durusma + finans_kaydi + tahsilat) as toplam_kayit
from aktivite
order by toplam_kayit desc
limit 5;


-- 2) O KULLANICININ GELİR-GİDER TABLOSU (kategori bazında)
--    :uid yerine 1. sorgudan çıkan id yazılır.
with hedef as (
  select p.id
  from profiles p
  order by (
      (select count(*) from cases           c where c.owner_id = p.id) +
      (select count(*) from clients         k where k.owner_id = p.id) +
      (select count(*) from hearings        h where h.owner_id = p.id) +
      (select count(*) from finance_entries f where f.owner_id = p.id) +
      (select count(*) from payments        o where o.owner_id = p.id)
    ) desc
  limit 1
),
kalemler as (
  -- finans kayıtları
  select f.kind, f.category, f.amount, f.entry_date::date as tarih
  from finance_entries f, hedef where f.owner_id = hedef.id
  union all
  -- dava tahsilatları (her zaman gelir)
  select 'income', 'davaTahsilat', o.amount, o.paid_at::date
  from payments o, hedef where o.owner_id = hedef.id
)
select
  case kind when 'income' then 'GELİR' else 'GİDER' end as tur,
  category                                   as kategori,
  count(*)                                   as adet,
  round(sum(amount)::numeric, 2)             as toplam_tl,
  min(tarih)                                 as ilk_kayit,
  max(tarih)                                 as son_kayit
from kalemler
group by kind, category
order by kind desc, toplam_tl desc;


-- 3) GENEL ÖZET (gelir / gider / net)
with hedef as (
  select p.id from profiles p
  order by (
      (select count(*) from cases           c where c.owner_id = p.id) +
      (select count(*) from clients         k where k.owner_id = p.id) +
      (select count(*) from hearings        h where h.owner_id = p.id) +
      (select count(*) from finance_entries f where f.owner_id = p.id) +
      (select count(*) from payments        o where o.owner_id = p.id)
    ) desc limit 1
),
kalemler as (
  select f.kind, f.amount from finance_entries f, hedef where f.owner_id = hedef.id
  union all
  select 'income', o.amount from payments o, hedef where o.owner_id = hedef.id
)
select
  round(sum(amount) filter (where kind='income')::numeric, 2)  as toplam_gelir,
  round(sum(amount) filter (where kind='expense')::numeric, 2) as toplam_gider,
  round((coalesce(sum(amount) filter (where kind='income'),0)
       - coalesce(sum(amount) filter (where kind='expense'),0))::numeric, 2) as net
from kalemler;


-- 4) AYLIK DÖKÜM (son 12 ay)
with hedef as (
  select p.id from profiles p
  order by (
      (select count(*) from cases           c where c.owner_id = p.id) +
      (select count(*) from clients         k where k.owner_id = p.id) +
      (select count(*) from hearings        h where h.owner_id = p.id) +
      (select count(*) from finance_entries f where f.owner_id = p.id) +
      (select count(*) from payments        o where o.owner_id = p.id)
    ) desc limit 1
),
kalemler as (
  select f.kind, f.amount, f.entry_date::date as tarih
  from finance_entries f, hedef where f.owner_id = hedef.id
  union all
  select 'income', o.amount, o.paid_at::date
  from payments o, hedef where o.owner_id = hedef.id
)
select
  to_char(date_trunc('month', tarih), 'YYYY-MM') as ay,
  round(coalesce(sum(amount) filter (where kind='income'),0)::numeric,2)  as gelir,
  round(coalesce(sum(amount) filter (where kind='expense'),0)::numeric,2) as gider,
  round((coalesce(sum(amount) filter (where kind='income'),0)
       - coalesce(sum(amount) filter (where kind='expense'),0))::numeric,2) as net
from kalemler
group by 1
order by 1 desc
limit 12;
