-- İÇTİHAT KATALOĞU — korpusun TAMAMI üstveri olarak, metin ayrı.
-- ===========================================================================
-- NEDEN. Bugüne kadar hasat tek bir şey yapıyordu: bir karar bul, TAM METNİNİ
-- indir, sakla. Ölçümler bu yaklaşımın tavanını gösterdi (hepsi bugün, gerçek
-- isteklerle alındı; tekrar koşulursa aynı çıkar):
--
--   · Bedesten'de TOPLU belge indirme YOK. documentIdList / documentIds /
--     idList denendi → ADALET_RUNTIME_EXCEPTION. Arama yanıtına metin
--     iliştirme de yok (includeContent / withContent / returnFields kabul
--     ediliyor ama YOK SAYILIYOR). Yani karar başına 1 HTTP isteği kırılmaz
--     bir tabandır.
--   · Belge indirme ölçülen hız: eşzamanlılık 4'te 4,24 belge/sn.
--   · Karar başına diskte 32,7 KB (metin bunun yalnız 4,4 KB'ı; gerisi iki
--     tsvector sütunu ve indeksleri — tablonun %68,6'sı).
--   · Erişilebilir korpus: Yargıtay 9.982.845 + Danıştay 415.248 ≈ 10,4 milyon.
--     Tam metinle: ~340 GB. Bu, ürünün ömrü boyunca bitmez.
--
-- AMA ARAMA YANITI ÜSTVERİYİ BEDAVA VERİYOR:
--   documentId, birimAdi, esasNoYil/Sira, kararNoYil/Sira, kararTarihi
--   — istek başına 100 kayıt, 1,08 saniyede.
--   Ölçülen katalog hızı: 271 satır/sn (eşzamanlılık 4, 12 istek, 0 hata).
--   → 10,4 milyon kararın ÜSTVERİSİ ~11 saat · ~172 bayt/karar ≈ 2,6 GB.
--
-- Yani korpusun TAMAMINI katalog olarak almak, bugünkü yöntemle 16 bin kararın
-- metnini almaktan daha ucuz.
--
-- BU NE İŞE YARAR — asıl kazanç burada. Avukatın sorduğu ilk soru "bu kararın
-- tam metni nedir" değil, "böyle bir karar VAR MI"dır. Yapay zekânın bilinen
-- en tehlikeli hatası uydurma atıftır ve _shared/kararAtif.ts bugün bunu
-- TAHMİN ediyor (daireye ve numara aralığına bakarak "olamaz" diyor; bu yüzden
-- gerçek kararları da yanlışlıkla işaretleyebiliyor). Katalog tamamlandığında
-- aynı soru TAHMİN değil ARAMA olur: "Yargıtay 12. HD 2023/12077 E." katalogda
-- var mı, yok mu — kesin cevap.
--
-- İKİ KATMAN:
--   1. KATALOG (bu tablo): her kararın üstverisi. Hedef: tamamı.
--   2. METİN (ictihat_kararlar): yalnız gerçekten gereken kararlar. Hangileri
--      olduğuna artık RASTLANTI değil biz karar veriyoruz — katalogdan seçilir.
--
-- HİÇBİR MEVCUT VERİ SİLİNMEZ; ictihat_kararlar olduğu gibi kalır.

-- ── Katalog ────────────────────────────────────────────────────────────────
create table if not exists public.ictihat_katalog (
  id            text primary key,           -- Bedesten documentId
  tur           text not null,              -- YARGITAYKARARI | DANISTAYKARAR
  daire         text,                       -- "Yargıtay 12. Hukuk Dairesi"
  esas_yil      smallint,
  esas_sira     integer,
  karar_yil     smallint,
  karar_sira    integer,
  karar_tarihi  date,
  -- Tam metni indirildi mi? Metin hasadının kuyruğu bu sütun.
  metin_var     boolean not null default false,
  -- Metin en son ne zaman DENENDİ. Sırf metin_var'a bakmak yetmiyor: indirmesi
  -- başarısız olan bir karar (kısa/boş belge, anlık hata) her turda yeniden
  -- en başa gelir ve kuyruk o kararda kilitlenirdi. Sıralama önce hiç
  -- denenmemişlere, sonra en eski denemeye bakıyor — başarısızlar sıraya
  -- giriyor, kuyruğu tıkamıyor.
  son_deneme    timestamptz,
  eklendi       timestamptz not null default now()
);

-- ATIF DOĞRULAMANIN İNDEKSİ. "Şu daire, şu esas numarası" sorgusu bu indekse
-- düşer; katalog 10 milyon satıra çıksa bile tek satır okumasıdır.
create index if not exists ictihat_katalog_atif_idx
  on public.ictihat_katalog (esas_yil, esas_sira);
create index if not exists ictihat_katalog_daire_atif_idx
  on public.ictihat_katalog (daire, esas_yil, esas_sira);
create index if not exists ictihat_katalog_karar_no_idx
  on public.ictihat_katalog (karar_yil, karar_sira);

-- METİN KUYRUĞU. Kısmi indeks: yalnız metni olmayanlar. Katalog büyüdükçe bu
-- indeks büyümez, tersine küçülür.
create index if not exists ictihat_katalog_metinsiz_idx
  on public.ictihat_katalog (son_deneme nulls first, karar_tarihi desc)
  where not metin_var;

-- Yalnız arka plan işleri okur/yazar; uygulamadan doğrudan erişim yok.
-- (Kullanıcıya açılacaksa ayrı bir okuma fonksiyonu yazılır — tabloyu
--  doğrudan açmak, ileride sütun eklendiğinde sessizce veri sızdırır.)
alter table public.ictihat_katalog enable row level security;
revoke all on table public.ictihat_katalog from public, anon, authenticated;
grant select, insert, update on table public.ictihat_katalog to service_role;

-- ── Sayım penceresi ────────────────────────────────────────────────────────
-- Korpus GÜN GÜN sayılıyor. Ölçüldü: kararTarihiStart/End süzgeci gerçekten
-- çalışıyor ve phrase="mahkeme" o penceredeki her kararla eşleşiyor
-- ("karar" ve "dava" da aynı toplamı veriyor; "kamulastirma" 0 veriyor, yani
-- süzgeç gerçek). Sayfalama tam kapanıyor: 1.632 kayıtlı bir günde sayfa 17
-- 32 kayıt, sayfa 18 sıfır döndü.
create table if not exists public.ictihat_katalog_pencere (
  tur            text not null,
  gun            date not null,
  sonraki_sayfa  integer not null default 1,
  bitti          boolean not null default false,
  toplam         integer,
  son_calisma    timestamptz,
  primary key (tur, gun)
);

create index if not exists ictihat_katalog_pencere_sira_idx
  on public.ictihat_katalog_pencere (tur, son_calisma nulls first, gun desc)
  where not bitti;

alter table public.ictihat_katalog_pencere enable row level security;
revoke all on table public.ictihat_katalog_pencere from public, anon, authenticated;
grant select, insert, update on table public.ictihat_katalog_pencere to service_role;

-- ── Pencereleri doldur ─────────────────────────────────────────────────────
-- NEDEN 2005'TEN BERİ. Daha eskiye gitmek mümkün ama ölçüm şunu gösterdi:
-- 2019'da 524.649, 2015'te 905.143 karar var; hacim eskiye doğru artıyor ve
-- avukat için değeri azalıyor. Pencereler EN YENİDEN ESKİYE işlenecek, yani
-- 2005 sınırı bir tavan değil başlangıç kapsamı; genişletmek tek satırlık ek.
insert into public.ictihat_katalog_pencere (tur, gun)
select t.tur, g::date
from (values ('YARGITAYKARARI'), ('DANISTAYKARAR')) as t(tur),
     generate_series(date '2005-01-01', current_date, interval '1 day') as g
on conflict (tur, gun) do nothing;

-- ── Atıf doğrulama: TAHMİN değil ARAMA ─────────────────────────────────────
-- kararAtif.ts'in bugün tahminle yaptığı işi katalogdan cevaplar.
-- Katalog o yıl için HENÜZ DOLMADIYSA "bilinmiyor" döner — "yok" DEMEZ.
-- Bu ayrım kritik: eksik katalogdan "yok" demek, gerçek kararları uydurma
-- diye işaretlemek olurdu ki bugünkü yanlış pozitiflerin sebebi tam da bu.
create or replace function public.atif_var_mi(
  p_daire text,
  p_esas_yil smallint,
  p_esas_sira integer
)
returns table(durum text, daire text, karar_no text, karar_tarihi date)
language sql
stable
security definer
set search_path to 'public'
as $$
  with kapsam as (
    -- O yıla ait en az bir pencere tamamlandıysa katalog o yıl için
    -- "konuşabilir" sayılır.
    select exists (
      select 1 from public.ictihat_katalog_pencere p
      where p.bitti and extract(year from p.gun) = p_esas_yil
    ) as hazir
  ),
  bulunan as (
    select k.daire, k.karar_yil, k.karar_sira, k.karar_tarihi
    from public.ictihat_katalog k
    where k.esas_yil = p_esas_yil
      and k.esas_sira = p_esas_sira
      and (p_daire is null or k.daire ilike '%' || p_daire || '%')
    limit 1
  )
  select
    case when exists (select 1 from bulunan) then 'var'
         when (select hazir from kapsam) then 'yok'
         else 'bilinmiyor' end,
    b.daire,
    case when b.karar_yil is not null then b.karar_yil || '/' || b.karar_sira end,
    b.karar_tarihi
  from (select 1) z left join bulunan b on true;
$$;

revoke all on function public.atif_var_mi(text, smallint, integer) from public, anon;
grant execute on function public.atif_var_mi(text, smallint, integer) to service_role;

-- Doğrulama: pencere sayısı ve ilk sıradaki gün.
select
  (select count(*) from public.ictihat_katalog_pencere) as pencere_sayisi,
  (select count(*) from public.ictihat_katalog_pencere where bitti) as biten,
  (select max(gun) from public.ictihat_katalog_pencere) as en_yeni_gun,
  (select count(*) from public.ictihat_katalog) as katalog_satiri;
