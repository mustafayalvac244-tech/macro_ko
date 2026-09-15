-- HASAT TERİM AÇLIĞI + KULLANILMAYAN İNDEKS — 15.09.2026
-- ===========================================================================
--
-- ── 1) TERİM AÇLIĞI (ölçülmüş arıza) ───────────────────────────────────────
--
-- harvest-tick sıradaki terimi PostgREST'te şöyle seçiyordu:
--     .order('oncelik', {ascending:false}).order('last_run', {ascending:true})
--
-- `oncelik` AĞIRLIK olsun diye eklenmişti ama pratikte MUTLAK KAPI gibi
-- davranıyor: en yüksek öncelikli terim bitene kadar hiçbir alt terim sıra
-- alamıyor. O terimler de hiç bitmiyor (aşağıdaki 2. bölüm).
--
-- CANLIDA ÖLÇÜLDÜ (15.09.2026, emsal yolundaki 324 terim):
--   • oncelik = 113 olan terim sayısı ......................... 2
--   • bu 2 terim en son çalışma .................. bugün 08:20 / 08:23
--   • kalan 322 terimin en yeni çalışması ............... 12.09, 3 gün önce
--   • hiç çalışmamış (last_run is null) terimler var ..... "zina nedeniyle
--     boşanma", "terk nedeniyle boşanma" gibi
--   • 187 terim hâlâ 1. sayfada
--   • 970 terimin BİTMİŞ olanı ................................ 0
--
-- Sonuç yalnız yavaşlık değil, KAPSAM ÇARPIKLIĞI: havuz iki terimin konusuyla
-- (işçilik alacakları) doluyor, aile/kira/tüketici hukuku hiç taranmıyor.
-- Hukuk ürününde bu, "arama yaptım hiçbir şey çıkmadı" demektir.
--
-- ÇÖZÜM: seçim mantığı SQL'e taşınıyor. PostgREST'in `.order()` zinciri
-- hesaplanmış bir ifadeyle sıralayamıyor; açlık kuralı ise tam olarak öyle
-- bir ifade ("2 günden uzun süredir dokunulmamış mı").
--
-- ── 2) SAYFA TAVANI koddadır, burada DEĞİL ─────────────────────────────────
-- Terimlerin hiç bitmemesinin ayrı bir sebebi var: kaynak popüler bir terim
-- için 539.776 sonuç bildiriyor ve sayfa yalnız EKSİK döndüğünde bitmiş
-- sayılıyor. Tavan `_shared/hasatSayfa.ts` içine eklendi (sınanabilir olsun
-- diye); burada tekrarlanmıyor ki iki yerde ayrışmasın.
--
-- ── 3) KULLANILMAYAN İNDEKS ────────────────────────────────────────────────
-- `ictihat_katalog_daire_atif_idx` = 171 MB, pg_stat_user_indexes'e göre
-- 30.06.2026'dan beri **0 tarama**. 2,4 milyon satırlık katalogda her ekleme
-- bu indeksi de güncelliyor. Veritabanının önbelleği 224 MB (ölçüldü:
-- shared_buffers 28672 × 8 kB) ve veritabanı 2.425 MB — yani bu tek indeks,
-- önbelleğin tamamından daha büyük bir yükü boşuna taşıyor.
--
-- NEDEN GÜVENLİ: aynı sütunların öneki olan `ictihat_katalog_atif_idx`
-- (esas_yil, esas_sira) DURUYOR ve kullanılıyor (4 tarama). Atıf eşleme
-- sorgusu (0124'teki `katalog_atif_bul`) daire'ye göre süzmüyor.
-- GERİ ALINABİLİR: en alttaki yorumda yeniden oluşturma komutu var.

-- ── Terim seçici ───────────────────────────────────────────────────────────

create or replace function public.hasat_sonraki_terim(p_onek text default null)
returns table (terim text, next_page int)
language sql
stable
security definer
set search_path = public
as $$
  select s.terim, s.next_page
  from public.ictihat_harvest_state s
  where case
          when p_onek is null or p_onek = '' then s.terim not like '%:%'
          else s.terim like p_onek || '%'
        end
  order by
    -- 1) AÇLIK ÖNCE. Hiç çalışmamış ya da 2 günden uzun süredir dokunulmamış
    --    terim öne geçer. Bu satır olmadan `oncelik` mutlak kapıya dönüşüyor.
    (s.last_run is null or s.last_run < now() - interval '2 days') desc,
    -- 2) Aynı açlık kümesi içinde öncelik AĞIRLIK olarak çalışır — yani
    --    önceliğin işlevi korunuyor, yalnız başkasını aç bırakamıyor.
    s.oncelik desc nulls last,
    -- 3) Eşitlikte en eski çalışan.
    s.last_run asc nulls first
  limit 1;
$$;

comment on function public.hasat_sonraki_terim(text) is
  'Sıradaki hasat terimi. Açlık > öncelik > eskilik. 15.09.2026: öncelik '
  'mutlak kapı gibi davranıp 324 terimin 322''sini 3+ gün aç bırakıyordu.';

revoke all on function public.hasat_sonraki_terim(text) from public, anon, authenticated;
grant execute on function public.hasat_sonraki_terim(text) to service_role;

-- ── Kullanılmayan indeks ───────────────────────────────────────────────────
-- concurrently KULLANILMIYOR: göç uygulayıcısı ifadeleri bir işlem içinde
-- çalıştırıyor, `drop index concurrently` işlem içinde çalışamaz. Drop zaten
-- kısa sürer (katalog yazımını birkaç saniye bekletebilir).
drop index if exists public.ictihat_katalog_daire_atif_idx;

-- GERİ ALMAK İÇİN:
--   create index ictihat_katalog_daire_atif_idx
--     on public.ictihat_katalog (daire, esas_yil, esas_sira);

-- ── Uygulandığını doğrula (tek satır çıktı) ────────────────────────────────
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'hasat_sonraki_terim')      as terim_secici_var,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'ictihat_katalog_daire_atif_idx') as eski_indeks_kaldi,
  (select terim from public.hasat_sonraki_terim(null))                    as sirada_hangi_terim;
