-- MADDENİN UYGULAMA DİLİ — kanun metni ile avukatın dili arasındaki köprü.
--
-- ÖLÇÜLEN SORUN. Avukat "işe iade davasında işçi ne kadar sürede başvurur"
-- diye arıyor; doğru cevap İş Kanunu m.21'de. Arama şunları döndürüyordu:
--
--     HMK 230 (Yeminin iade olunamayacağı hâller)
--     TTK 763 (İade davası)
--     CMK 174 (İddianamenin iadesi)
--
-- Tek ortak nokta "iade" kelimesi. Tek bir soru değil, bütün bir sınıf:
--
--     "boşta geçen süre ücreti"    → İşK 32, 69, 49   (doğrusu İşK 21)
--     "işe başlatmama tazminatı"   → İşK 112, CMK 142 (doğrusu İşK 21)
--     "ihtiyati haciz kararı"      → TTK 1353, 1364   (deniz ticareti maddeleri)
--     "ecrimisil"                  → HİÇBİR SONUÇ
--
-- KÖK SEBEP, ARAMA MOTORU DEĞİL. Kanun koyucu ile avukat aynı olayı FARKLI
-- kelimelerle anlatır. İşK m.21'in başlığı "Geçersiz sebeple yapılan feshin
-- sonuçları"dır; metninde "işe iade" ifadesi HİÇ GEÇMEZ. "Ecrimisil" kelimesi
-- hiçbir kanun maddesinde yazmaz — bir içtihat terimidir. Yani hiçbir ağırlık
-- ayarı, hiçbir kök bulma düzeltmesi bu boşluğu kapatamaz: aranan kelime
-- belgede yoktur.
--
-- KÖPRÜ ZATEN ELİMİZDE. Bir maddeyi uygulayan kararlar, o maddeyi avukatın
-- diliyle anlatır. İşK m.21'e atıf yapan kararların atıf çevresinde şunlar
-- geçiyor: "işe başlatmama tazminatı", "boşta geçen süre ücreti", "işe iade
-- davası", "on iş günü içinde işverene başvuru". 0044/0045'te kurulan atıf
-- haritası hangi kararın hangi maddeyi uyguladığını zaten biliyor; geriye
-- atıfın ÇEVRESİNDEKİ metni toplayıp maddeye iliştirmek kalıyor.
--
-- Yeni veri kaynağı, AI çağrısı ve para gerekmiyor: bilgi havuzda duruyordu.
--
-- YAN FAYDA — DOĞRU KURAL DA GELİYOR. Bu ölçümü başlatan uçtan uca denemede
-- asistan "işçi 7 gün içinde başvurur" dedi; doğrusu ON İŞ GÜNÜ'dür (İşK
-- m.21/5) ve madde havuzumuzda vardı, arama bulamadığı için modele hiç
-- gösterilmemişti. Toplanan çevre metinlerinde doğru süre birebir yazıyor.
--
-- KAPSAM SINIRI AÇIKÇA: yalnız atıf alan maddeler bu dili kazanır. Havuzda
-- kararı olmayan madde eskisi gibi aranır — bu bir gerileme değil, kazancın
-- nereye düştüğünün dürüst tarifi. 4.674 maddenin 736'sı bu dili kazandı.
--
-- ÖLÇÜLEN SONUÇ (scripts/eval-arama.mjs, 43 soru / 44 beklenen madde, ilk 7):
--     yalnız FTS : %54,5 → %63,6
--     hibrit     : %65,9 → %72,7
-- Ölçüm soruları bu sorun sınıfı için seçilmiş DEĞİLDİ; kazanç yan üründür.
-- Somut örnek: "ecrimisil" artık TMK 995'i buluyor (önce hiçbir sonuç yoktu).
--
-- DENENDİ VE GERİ ALINDI: bağlam metni fts_simple'a da eklenmişti (IDF yolu).
-- Ölçüm kötüledi (%63,6 → %61,4; hibrit %72,7 → %70,5). Sebep tasarımda
-- yazılıydı: o yol bir terim 300'den fazla maddede geçiyorsa terimi tamamen
-- eliyor; çevre metni yaygın kelimeleri bu eşiğin üstüne itip FAYDALI terimleri
-- elettiriyor. Bu yüzden bağlam yalnız fts_w'de.
--
-- BU DÜZELTMENİN ULAŞAMADIĞI AYRI BİR HATA — TÜRKÇE KÖK BULUCU KISA KELİMELERİ
-- ÖĞÜTÜYOR. "işe iade" sorgusu 'ia' | 'iş' lexeme'lerine dönüşüyor: "iade"
-- kelimesi İKİ HARFE ("ia") iniyor ve hiçbir ayırt edici gücü kalmıyor. Bu
-- yüzden "işe iade davası başvuru süresi" sorgusu, bağlam eklendikten SONRA da
-- İşK 21'i getirmiyor — eksik olan madde değil, sorgunun kendisi yok oluyor.
-- Ayrı bir iş; burada çözülmüş gibi gösterilmiyor.

-- ---------------------------------------------------------------------------
-- 1) Atıf çıkarımı artık atfın ÇEVRESİNİ de veriyor.
-- ---------------------------------------------------------------------------

/**
 * Ham atıflar: aynı karar bir maddeye birden çok kez atıf yapabilir, her biri
 * ayrı satır olarak döner ve yanında atıftan SONRAKİ 250 karakter gelir.
 *
 * NEDEN YALNIZ SONRASI: atıftan önceki metni de almak denendi, aynı eşleşmeleri
 * bulmasına rağmen 14 KAT yavaştı (200 kararda 20,8 sn / 1,5 sn) — açgözlü
 * baştaki desen tüm metni tarayıp geri izliyor. Hükmün özü zaten atıftan sonra
 * yazılır ("...21. maddesinin 5. fıkrasına göre, işçi ... on iş günü içinde").
 */
create or replace function public.atif_ayikla_ham(p_metin text)
returns table(kanun text, madde_no integer, baglam text)
language sql immutable set search_path = public as $$
  with ham as (
    select m[1] etiket, m[2] bosluk, m[3] no, m[4] sonrasi from (
      select regexp_matches(p_metin,
        '(TBK|HMK|TCK|CMK|TMK|TTK|İİK|IIK|HUMK|İYUK|IYUK|MK|BK)([^0-9]{0,18})([0-9]{1,4})[^0-9]{0,4}madde(.{0,250})',
        'gi') m
    ) a
    union all
    select m[1], m[2], m[3], m[4] from (
      select regexp_matches(p_metin,
        '(6100|6098|5237|5271|4721|6102|2004|4857|2577|1086|818|743|2709)\s*sayılı([^0-9]{0,80}?)([0-9]{1,4})[^0-9]{0,6}madde(.{0,250})',
        'gi') m
    ) b
    union all
    select m[1], m[2], m[3], m[4] from (
      select regexp_matches(p_metin,
        '(Anayasa|İş Kanunu|İş Yasası|Türk Ticaret Kanunu|Türk Medeni Kanunu|Türk Borçlar Kanunu|Hukuk Muhakemeleri Kanunu|İdari Yargılama Usulü Kanunu|İcra ve İflas Kanunu|Türk Ceza Kanunu|Ceza Muhakemesi Kanunu)([^0-9]{0,20})([0-9]{1,4})[^0-9]{0,6}madde(.{0,250})',
        'gi') m
    ) c
  )
  -- lower()/upper() Türkçe'de güvenilmez (lower('İ') birleşen nokta üretir);
  -- karşılaştırmadan önce ASCII'ye indiriyoruz. Ayrıntı: 0045.
  , duz as (
    select upper(translate(etiket, 'İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'IIiSsGgUuOoCcAaIiUu')) n,
           bosluk, no, sonrasi
    from ham
  )
  select
    case
      when n in ('HMK', '6100')                    then 'HMK'
      when n in ('TBK', '6098')                    then 'TBK'
      when n in ('TCK', '5237')                    then 'TCK'
      when n in ('CMK', '5271')                    then 'CMK'
      when n in ('TMK', '4721')                    then 'TMK'
      when n in ('TTK', '6102')                    then 'TTK'
      when n in ('IIK', '2004')                    then 'İİK'
      when n in ('IYUK', '2577')                   then 'İYUK'
      when n in ('HUMK', '1086')                   then 'HUMK'
      when n in ('BK', '818')                      then 'BK'
      when n in ('MK', '743')                      then 'MK'
      when n = '4857'      or n like 'IS %'        then 'İşK'
      when n = '2709'      or n like '%ANAYASA%'   then 'AY'
      when n = 'HUKUK MUHAKEMELERI KANUNU'         then 'HMK'
      when n = 'IDARI YARGILAMA USULU KANUNU'      then 'İYUK'
      when n = 'ICRA VE IFLAS KANUNU'              then 'İİK'
      when n = 'TURK TICARET KANUNU'               then 'TTK'
      when n = 'TURK MEDENI KANUNU'                then 'TMK'
      when n = 'TURK BORCLAR KANUNU'               then 'TBK'
      when n = 'TURK CEZA KANUNU'                  then 'TCK'
      when n = 'CEZA MUHAKEMESI KANUNU'            then 'CMK'
      else n
    end,
    no::integer,
    sonrasi
  from duz
  where no::integer between 1 and 1600
    and bosluk !~* '(geçici|\mek\M)';
$$;

-- atif_ayikla artık tek bir yerden besleniyor: ham çıkarımın tekilleştirilmişi.
-- Böylece desen iki kopyaya ayrışıp birbirinden uzaklaşamaz (0043'te tam bu
-- ayrışma 411 kaydı bozmuştu).
create or replace function public.atif_ayikla(p_metin text)
returns table(kanun text, madde_no integer)
language sql immutable set search_path = public as $$
  select distinct h.kanun, h.madde_no from public.atif_ayikla_ham(p_metin) h;
$$;

grant execute on function public.atif_ayikla_ham(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Atıf çevresi saklanır.
-- ---------------------------------------------------------------------------

alter table public.ictihat_atif add column if not exists baglam text;

create or replace function public.ictihat_atif_cikar(p_karar_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  eklenen integer := 0;
begin
  -- Bir karar aynı maddeye birden çok atıf yapabilir; anahtar tekil olduğu
  -- için EN UZUN çevre seçilir (en çok bilgi taşıyan).
  insert into public.ictihat_atif (karar_id, kanun, madde_no, baglam)
  select distinct on (x.kanun, x.madde_no) k.id, x.kanun, x.madde_no, x.baglam
  from public.ictihat_kararlar k
  cross join lateral public.atif_ayikla_ham(k.full_text) x
  where k.id = p_karar_id
  order by x.kanun, x.madde_no, length(x.baglam) desc
  on conflict (karar_id, kanun, madde_no) do update set baglam = excluded.baglam;

  get diagnostics eklenen = row_count;
  return eklenen;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Maddeye "uygulama dili" iliştirilir.
-- ---------------------------------------------------------------------------

alter table public.mevzuat_maddeleri add column if not exists baglam text;

/**
 * Maddenin uygulama dilini atıf haritasından yeniden kurar.
 *
 * Madde başına en çok 12 karar: yeterince kelime toplar ama tek bir maddenin
 * binlerce kararla indeksi şişirmesini engeller. Yargıtay/Danıştay önce gelir;
 * yerleşik içtihadın dili yerel mahkeme kararının dilinden daha temsilidir.
 */
create or replace function public.madde_baglam_tazele()
returns integer
language plpgsql
security definer set search_path = public as $$
declare
  guncellenen integer := 0;
begin
  with sirali as (
    select a.kanun, a.madde_no, a.baglam,
           row_number() over (
             partition by a.kanun, a.madde_no
             order by case k.kurul when 'Yargıtay' then 0 when 'Danıştay' then 1
                                   when 'BAM' then 2 when 'BİM' then 3 else 4 end,
                      a.karar_id
           ) sira
    from public.ictihat_atif a
    join public.ictihat_kararlar k on k.id = a.karar_id
    where coalesce(a.baglam, '') <> ''
  ),
  toplu as (
    select kanun, madde_no, string_agg(baglam, ' ' order by sira) metin
    from sirali where sira <= 12 group by kanun, madde_no
  )
  update public.mevzuat_maddeleri m
  set baglam = t.metin
  from toplu t
  where t.kanun = m.kanun_short
    and t.madde_no::text = m.madde_no
    and m.baglam is distinct from t.metin;

  get diagnostics guncellenen = row_count;
  return guncellenen;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Uygulama dili aramaya katılır — EN DÜŞÜK ağırlıkla.
-- ---------------------------------------------------------------------------
--
-- 'D' bilinçli seçim: kanunun kendi metniyle (yine 'D') eşit, başlıktan
-- ('A') düşük. Karar metinleri mahkeme kalıpları da taşır ("temyiz edilmiştir",
-- "davacı vekili"); bunların kanun metnini bastırmasına izin verilmez.
--
-- fts_simple'a KATILMIYOR. O sütun IDF yolunu besliyor ve bir terim 300'den
-- fazla maddede geçerse eleniyor; çevre metni eklemek yaygın kelimeleri bu
-- eşiğin üstüne iterek FAYDALI terimleri elettirebilirdi. Kazanç sıralama
-- yolunda aranıyor, oradaki dengeyi bozmadan.

drop index if exists mevzuat_fts_w_idx;
alter table public.mevzuat_maddeleri drop column if exists fts_w;
alter table public.mevzuat_maddeleri add column fts_w tsvector
  generated always as (
    setweight(to_tsvector('turkish', coalesce(kanun_short, '') || ' ' || coalesce(baslik, '')), 'A') ||
    setweight(to_tsvector('turkish', coalesce(madde_no, '') || ' ' || coalesce(metin, '')), 'D') ||
    setweight(to_tsvector('turkish', coalesce(baglam, '')), 'D')
  ) stored;
create index mevzuat_fts_w_idx on public.mevzuat_maddeleri using gin (fts_w);

-- ---------------------------------------------------------------------------
-- 5) Harita eskimesin.
-- ---------------------------------------------------------------------------
--
-- Hasat sürekli çalışıyor; yeni kararların atıf çevresi ictihat_atif'e
-- tetikleyiciyle giriyor ama maddeye iliştirilmiş özet ancak toplu tazelemeyle
-- güncellenir. Elle yapılacak iş bırakmıyoruz: aynı unutkanlık vektörlemede
-- bir kez yaşandı ve havuzun üçte biri aylarca aranamaz kaldı.
select cron.schedule('vekil_madde_baglam', '40 4 * * *',
                     $$select public.madde_baglam_tazele()$$);
