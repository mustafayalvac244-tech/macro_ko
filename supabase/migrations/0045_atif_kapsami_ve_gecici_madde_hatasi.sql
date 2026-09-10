-- ATIF ÇIKARIMI: kapsam genişletmesi + ölçülmüş bir HATA düzeltmesi.
--
-- 0044 atıf haritasını kurdu ama iki eksikle:
--
-- HATA 1 — GEÇİCİ/EK MADDE, NORMAL MADDE SANILIYOR (canlı veride 128 satır).
--   "HMK'nın Geçici 3. maddesi" desene takılıyor ve HMK m.3 olarak yazılıyordu.
--   Geçici madde 3 ile 3. madde AYNI ŞEY DEĞİLDİR; avukata "m.3'ü uygulayan
--   karar" diye tamamen başka bir konuyu gösteriyorduk. Aynı hata numaralı
--   atıflarda daha da büyük: 4.506 eşleşmenin 276'sı geçici/ek maddeydi.
--   Artık kanun adı ile madde numarası arasındaki metin "geçici" ya da tek
--   başına "ek" kelimesini içeriyorsa atıf sayılmaz.
--
-- HATA 2 — YALNIZ KISALTMALI ATIF YAKALANIYORDU. 0044 bunu sınır olarak
--   dürüstçe yazmıştı; ölçüldü, sınır sanılandan pahalıymış:
--
--     İş Kanunu   : 123 maddenin 0'ında karar vardı — çünkü kararlar "İşK"
--                   yazmıyor, "4857 sayılı İş Kanunu'nun 17. maddesi" yazıyor.
--     Anayasa     : 199 maddenin 0'ında karar vardı — "AY m.10" diye yazan yok,
--                   "Anayasa'nın 10. maddesi" diye yazan 370 karar var.
--     İYUK        : kısaltmayla 2 atıf, "2577 sayılı ..." yazımıyla 535 atıf.
--
--   Yani iki koca alan (iş hukuku ve idari yargı) haritada YOKTU; veri
--   eksikliğinden değil, tek bir yazım biçimine bakıyor olmamızdan.
--
-- ÜÇ YAZIM BİÇİMİ DE OKUNUR:
--   A) kısaltma      : "HMK'nın 119. maddesi"
--   B) kanun numarası: "6100 sayılı ... 119. maddesi"
--   C) kanun adı     : "Hukuk Muhakemeleri Kanunu'nun 119. maddesi"
--
-- DOĞRULUK ÖRNEKLEMEYLE KONTROL EDİLDİ: B ve C desenlerinden çekilen 30
-- eşleşme tek tek okundu, hepsi gerçek madde atfıydı. Kapsam yine %100 değil
-- ("Madde 59" gibi numarayı sonra yazan biçim okunmuyor) ve öyle olduğu iddia
-- edilmiyor.
--
-- MÜLGA KANUNLAR AYRI KALIR (0044'teki kural sürüyor): 1086→HUMK, 818→BK,
-- 743→MK olarak saklanır, yürürlükteki HMK/TBK/TMK'ya EŞLENMEZ. Bu yüzden C
-- deseninde "Hukuk Usulü Muhakemeleri Kanunu" (mülga 1086) ile "Hukuk
-- Muhakemeleri Kanunu" (6100) birbirine karışmaz: aradaki "Usulü" kelimesi
-- iki adı ayırır ve desen yalnız ikincisini tanır.

/**
 * Bir metinden madde atıflarını çıkarır. Tek doğruluk kaynağı: hem tetikleyici
 * hem toplu doldurma bunu kullanır, böylece iki yol birbirinden ayrışamaz
 * (0043'te tam bu ayrışma 411 kaydı bozmuştu).
 */
create or replace function public.atif_ayikla(p_metin text)
returns table(kanun text, madde_no integer)
language sql immutable set search_path = public as $$
  with ham as (
    -- A) Kısaltmalı: "HMK'nın 119. maddesi", "TCK.nun 86. maddesi"
    select m[1] etiket, m[2] bosluk, m[3] no from (
      select regexp_matches(p_metin,
        '(TBK|HMK|TCK|CMK|TMK|TTK|İİK|IIK|HUMK|İYUK|IYUK|MK|BK)([^0-9]{0,18})([0-9]{1,4})[^0-9]{0,4}madde',
        'gi') m
    ) a
    union all
    -- B) Kanun numarasıyla: "2577 sayılı İdari Yargılama Usulü Kanunu'nun 49. maddesi"
    --    "sayılı" kelimesi şart: yalnız başına bir sayı, kanun numarası değil
    --    dosya/tarih/tutar olabilir.
    select m[1], m[2], m[3] from (
      select regexp_matches(p_metin,
        '(6100|6098|5237|5271|4721|6102|2004|4857|2577|1086|818|743|2709)\s*sayılı([^0-9]{0,80}?)([0-9]{1,4})[^0-9]{0,6}madde',
        'gi') m
    ) b
    union all
    -- C) Kanun adıyla: "Anayasa'nın 10. maddesi", "İş Kanunu'nun 22. maddesi"
    select m[1], m[2], m[3] from (
      select regexp_matches(p_metin,
        '(Anayasa|İş Kanunu|İş Yasası|Türk Ticaret Kanunu|Türk Medeni Kanunu|Türk Borçlar Kanunu|Hukuk Muhakemeleri Kanunu|İdari Yargılama Usulü Kanunu|İcra ve İflas Kanunu|Türk Ceza Kanunu|Ceza Muhakemesi Kanunu)([^0-9]{0,20})([0-9]{1,4})[^0-9]{0,6}madde',
        'gi') m
    ) c
  )
  -- Yazımı tek biçime indir. lower()/upper() Türkçe'de GÜVENİLMEZ: lower('İ')
  -- 'i' + birleşen nokta (U+0307) üretir, bu yüzden 'i̇flas' ile 'iflas'
  -- eşleşmez. (Bu tam olarak ölçümde yakalanan hataydı: "İcra ve İflas
  -- Kanunu" hiçbir dala düşmeyip ham hâliyle kaydediliyordu.) Önce ASCII'ye
  -- çeviriyoruz, sonra karşılaştırıyoruz.
  , duz as (
    select upper(translate(etiket, 'İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'IIiSsGgUuOoCcAaIiUu')) n,
           bosluk, no
    from ham
  )
  select distinct
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
    no::integer
  from duz
  -- 0 veya absürt büyük numara atıf değil, tarih/tutar olabilir.
  where no::integer between 1 and 1600
    -- Geçici/ek madde, normal maddeyle aynı numarayı taşır ama başka hükümdür.
    and bosluk !~* '(geçici|\mek\M)';
$$;

grant execute on function public.atif_ayikla(text) to service_role;

create or replace function public.ictihat_atif_cikar(p_karar_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  eklenen integer := 0;
begin
  insert into public.ictihat_atif (karar_id, kanun, madde_no)
  select k.id, x.kanun, x.madde_no
  from public.ictihat_kararlar k
  cross join lateral public.atif_ayikla(k.full_text) x
  where k.id = p_karar_id
  on conflict do nothing;

  get diagnostics eklenen = row_count;
  return eklenen;
end;
$$;

/**
 * HATA 3 — SORGU YOLUNDA AYNI TÜRKÇE TUZAĞI. 0044'teki kararlar_madde_ile()
 * kanunu `a.kanun = upper(p_kanun)` diye arıyordu. upper('İşK') Postgres'te
 * 'İŞK' verir; tabloda yazan 'İşK' ile eşleşmez. Sonuç: İş Kanunu maddeleri
 * haritaya girse bile sorgu HİÇBİR karar döndürmezdi — yani hata 2'yi
 * düzeltmek tek başına yetmezdi, sessizce boş sonuç almaya devam ederdik.
 *
 * Çözüm: gelen kısaltma önce tablodaki KANONİK yazıma çözülür (13 farklı
 * değer), sonra düz eşitlikle aranır — böylece (kanun, madde_no) indeksi
 * kullanılmaya devam eder.
 */
create or replace function public.kararlar_madde_ile(
  p_kanun text,
  p_madde integer,
  p_limit integer default 5
)
returns table(
  id text, kurul text, daire text, esas_no text, karar_no text,
  karar_tarihi text, snippet text
)
language sql stable security definer set search_path = public as $$
  with hedef as (
    select d.kanun
    from (select distinct kanun from public.ictihat_atif) d
    where upper(translate(d.kanun,  'İIıŞşĞğÜüÖöÇç', 'IIiSsGgUuOoCc'))
        = upper(translate(p_kanun, 'İIıŞşĞğÜüÖöÇç', 'IIiSsGgUuOoCc'))
  )
  select k.id, k.kurul, k.daire, k.esas_no, k.karar_no, k.karar_tarihi,
         left(k.full_text, 320)
  from public.ictihat_atif a
  join hedef h on h.kanun = a.kanun
  join public.ictihat_kararlar k on k.id = a.karar_id
  where a.madde_no = p_madde
  order by case k.kurul when 'Yargıtay' then 0 when 'Danıştay' then 1
                        when 'BAM' then 2 when 'BİM' then 3 else 4 end,
           k.id
  limit greatest(1, least(20, p_limit));
$$;

grant execute on function public.kararlar_madde_ile(text, integer, integer) to authenticated, anon;

-- Mevcut satırlar eski (hatalı) desenle üretildi; düzeltme ancak baştan
-- kurmakla olur. Tablo yalnız türetilmiş veri tutuyor, kaynağı kararların
-- kendisi — kaybedilecek bir şey yok.
delete from public.ictihat_atif;

insert into public.ictihat_atif (karar_id, kanun, madde_no)
select k.id, x.kanun, x.madde_no
from public.ictihat_kararlar k
cross join lateral public.atif_ayikla(k.full_text) x
on conflict do nothing;
