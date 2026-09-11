-- HASAT ÖNCELİĞİ: 0093'ÜN İKİ SİNYALİ ÖLÇÜLDÜ, İKİSİ DE ÇALIŞMIYORDU.
-- ---------------------------------------------------------------------------
-- KUSURU BEN YAZDIM, ÖNCE ONU SÖYLÜYORUM. Migration 0093'te üç sinyalli bir
-- öncelik puanlaması kurdum ve o dosyada "kurul ağırlığı" sinyalini ürünün
-- ayırt edici özelliği gibi anlattım. ÖLÇMEMİŞTİM.
--
-- ÖLÇÜMÜN KAPSAMI — SONRADAN DÜZELTİLDİ (yorum satırı, SQL değişmedi):
-- Aşağıda "134 terim — canlıdaki terim sayısıyla aynı" yazmıştım. İkinci kısım
-- YANLIŞTI. Canlıda ÖLÇÜLDÜ (hasat_saglik, 2026-09-11): terim_sayisi = 404.
-- Yani ölçümüm listenin yalnız ÜÇTE BİRİNİ kapsıyor. "134 terimden 1'i eşleşti"
-- cümlesi depodaki liste için doğru, CANLI liste için ölçülmemiş bir tahmindir.
-- Kaldırdığım iki kuralın canlı 404 terimde de ölü olup olmadığını
-- scripts/hasat-kalite-olcum.sql (5. sorgu) ölçüyor; sonuç gelmeden "canlıda da
-- ölüydü" diyemem. (Kuralları kaldırma kararı yine de savunulabilir: gerekçe
-- sayı değil, terimlerin KONU sorgusu olması — kurul bilgisi arama metninde
-- değil, sonucun daire alanında.)
--
-- ÖLÇÜM (2026-09-11, yerel PostgreSQL 16; girdi: scripts/ictihat-terms.txt'in
-- yorumsuz ve tekrarsız hâli = 134 terim):
--
--   +40 "yüksek yargı sinyali"  →  134 terimden 1'i eşleşti:
--        « şirket genel kurul kararının iptali »
--        Bu bir TİCARET HUKUKU terimidir; şirketin genel kurul kararının
--        iptali davasıdır. Yargıtay Hukuk Genel Kurulu ile hiçbir ilgisi yok.
--        Yani kural 0 doğru, 1 YANLIŞ eşleşme üretiyor: işe yaramamakla
--        kalmıyor, kotayı yanlış terime kaydırıyor.
--
--   -30 "alt derece sinyali"    →  134 terimden 0'ı eşleşti. Ölü kod.
--
-- SEBEBİ, ŞİMDİ BAKINCA AÇIK: terimler KONU sorgularıdır ("kira tespit
-- davası"), mahkeme adı değil. Kararın hangi kuruldan geldiği aramanın DEĞİL
-- sonucun bir özelliğidir — harvest-tick zaten kurulOf(daire) ile hesaplayıp
-- ictihat_kararlar.kurul'a yazıyor. Kurul ağırlığını terim metninden çıkarmaya
-- çalışmak, baştan yanlış yerde arama yapmaktı.
--
-- BU DOSYA NE YAPIYOR:
--   1) İki ölü sinyali KALDIRIYOR. Çalışmayan kuralı kodda bırakmak, sonraki
--      okuyucuya "kurul ağırlığı var" diye yalan söylemek olurdu.
--   2) Geriye kalan TEK gerçek sinyali — kullanıcılarımızın dava karışımı —
--      sağlamlaştırıyor (Türkçe büyük/küçük harf tuzağı + joker karakter
--      sızıntısı; ikisi de aşağıda).
--   3) Kurul ağırlığının doğru yerini SÖYLÜYOR ama oraya DOKUNMUYOR: bu bir
--      kaynak zamanlaması (cron) kararıdır ve havuzun mevcut kurul dağılımı
--      ÖLÇÜLMEDEN verilemez. public.hasat_saglik() artık o dağılımı
--      raporluyor; karar ondan sonra verilecek.
--
-- NE İDDİA ETMİYORUM: kalan +60 sinyalinin canlıda kaç terime dokunduğunu
-- ÖLÇMEDİM — cases.case_type değerlerini görmüyorum. hasat_saglik() çıktısındaki
-- 'oncelik_dagilimi' satırı bunu gösterecek: hepsi 100'de duruyorsa bu sinyal
-- de fiilen çalışmıyor demektir.

-- ── Türkçe güvenli küçültme ─────────────────────────────────────────────────
/**
 * NEDEN lower() YETMİYOR. Türkçede 'İ' (U+0130) ve 'I' ayrı harflerdir:
 * doğru karşılıkları 'i' ve 'ı'dır. PostgreSQL'in lower()'ı veritabanı
 * yerelinde çalışır ve Supabase'de yerel Türkçe DEĞİL; 'I' → 'i' olur, 'İ' ise
 * yerele göre tek/çift kod birimine düşebilir. Sonuç: "İş Kazası" ile
 * "iş kazası" eşleşmeyebilir — yani sinyal sessizce kaybolur.
 *
 * Bu yüzden Türkçe harfleri ÖNCE elle eşliyoruz, sonra lower() ile ASCII'yi
 * hallediyoruz. Sıra önemli: 'I' → 'ı' dönüşümü lower()'dan ÖNCE olmalı,
 * yoksa lower() onu 'i' yapar ve bilgi kaybolur.
 */
create or replace function public.tr_kucult(t text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select lower(translate(t, 'İIŞĞÜÖÇÂÎÛ', 'iışğüöçaiu'))
$$;

comment on function public.tr_kucult(text) is
  'Türkçe güvenli küçük harfe çevirme. İ→i, I→ı. Karşılaştırmalarda lower() yerine bunu kullanın.';

-- ── Öncelik tazeleme: iki ölü sinyal kaldırıldı ─────────────────────────────
/**
 * Taban 100. Tek üstünlük kaynağı: kullanıcılarımızın GERÇEK dava karışımı
 * (en çok +60). Bu, rakiplerin kopyalayamayacağı tek sinyaldir — onlarda
 * dosya yok, bizde var.
 *
 * İKİ DÜZELTME (ikisi de 0093'te sessiz hataydı):
 *
 *  a) JOKER KARAKTER SIZINTISI. 0093 eşleşmeyi
 *         h.terim like '%' || d.konu || '%'
 *     ile yapıyordu. `d.konu` KULLANICININ yazdığı serbest metindir; içinde
 *     '%' ya da '_' geçen bir dava türü ("%50 hisse") deseni bozar ve
 *     olmayacak eşleşmeler üretir. Artık position() kullanılıyor: joker yok,
 *     kaçış yok, sürpriz yok.
 *
 *  b) TÜRKÇE KÜÇÜLTME. lower() yerine public.tr_kucult().
 *
 *  c) least() NULL'I YUTUYORDU — ÖNCELİĞİN TAMAMINI SESSİZCE ÖLDÜREN HATA.
 *     0093'teki ifade şuydu:
 *         coalesce((select least(60, round(60 * sum(adet) / toplam)) ... ), 0)
 *     Hiçbir dava türü eşleşmediğinde sum() NULL döner, round() NULL olur ve
 *     PostgreSQL'de least(60, NULL) = 60'tır — least() NULL argümanları
 *     ATLAR, NULL DÖNDÜRMEZ. Yani EŞLEŞMEYEN her terim de +60 alıyordu.
 *     Dıştaki coalesce hiçbir işe yaramıyordu: alt sorgu zaten 60 döndürüyordu.
 *
 *     ÖLÇÜM (yerel PostgreSQL 16, 134 gerçek terim, 8 davalık bir karışım):
 *     134 terimin 128'i 160 puan aldı; yalnız gerçekten eşleşen 6 terim
 *     (123 / 115 / 108) farklı puandaydı. Yani puanlama neredeyse SABİTTİ —
 *     "öncelik" diye bir şey fiilen yoktu ve üstelik kendini gizliyordu:
 *     tabloya bakan biri 160'ları görüp "puanlanmış" sanırdı.
 *
 *     Düzeltme: tavan en DIŞTA. least(60, coalesce(<toplam>, 0)) — eşleşme
 *     yoksa 0, varsa payı kadar.
 *
 * Ayrıca çok kısa/çok genel dava türleri elenir: "dava", "dosya", "diğer",
 * "genel" gibi bir değer neredeyse HER terimle eşleşip puanı düzleştirirdi —
 * yani sinyali gürültüye çevirirdi.
 */
create or replace function public.hasat_onceligini_tazele()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  guncellenen integer;
begin
  with dava_konulari as (
    select public.tr_kucult(trim(case_type)) as konu, count(*)::numeric as adet
    from public.cases
    where case_type is not null
      and length(trim(case_type)) >= 4
      and public.tr_kucult(trim(case_type)) not in ('dava','dosya','diğer','diger','genel','hukuk','ceza dosyası')
    group by 1
  ),
  toplam as (select greatest(sum(adet), 1) as t from dava_konulari),
  puanlar as (
    select
      h.terim,
      -- TAVANI EN DIŞTA UYGULA — bkz. yukarıdaki (c) maddesi. least() içeride
      -- olursa eşleşme yokken NULL'ı yutar ve 60 döndürür.
      100 + least(60, coalesce((
        select round(60 * sum(d.adet) / (select t from toplam))::integer
        from dava_konulari d
        where position(d.konu in public.tr_kucult(h.terim)) > 0
           or position(public.tr_kucult(h.terim) in d.konu) > 0
      ), 0)) as yeni_oncelik
    from public.ictihat_harvest_state h
  )
  update public.ictihat_harvest_state h
  set oncelik = greatest(1, p.yeni_oncelik)
  from puanlar p
  where h.terim = p.terim and h.oncelik is distinct from greatest(1, p.yeni_oncelik);

  get diagnostics guncellenen = row_count;
  return guncellenen;
end;
$$;

revoke all on function public.hasat_onceligini_tazele() from public, anon, authenticated;
grant execute on function public.hasat_onceligini_tazele() to service_role;

-- Düzeltilmiş puanlamayı hemen uygula: eski (yanlış) +40 puanı da böylece
-- temizlenmiş olur.
do $$
declare n integer;
begin
  if to_regclass('public.ictihat_harvest_state') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='ictihat_harvest_state'
                   and column_name='oncelik') then
    select public.hasat_onceligini_tazele() into n;
    raise notice 'Öncelik yeniden hesaplandı: % terim güncellendi.', n;
  else
    raise notice 'ictihat_harvest_state.oncelik yok — önce 0093 uygulanmalı.';
  end if;
end $$;
