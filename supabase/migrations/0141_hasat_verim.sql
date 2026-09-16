-- HASAT VERİMLİLİĞİ — 15.09.2026 akşamı
-- ===========================================================================
--
-- 0140 bugün öğlen terim açlığını kısmen açtı. Akşam yapılan ölçüm iki
-- ARIZANIN DAHA durduğunu gösterdi. İkisi de "yavaş" değil, "boşa çalışıyor".
--
-- CANLI ÖLÇÜM (15.09.2026 19:16 UTC, salt okunur):
--
--   ictihat_kararlar ....... 57.617 satır · son 1 saat 553 · son 24 saat 12.783
--   ictihat_katalog ........ 2.471.550 satır · yalnız 33.289'unda metin var
--   veritabanı ............. 2.437 MB
--   terimler ............... 970
--     ├─ bitmiş ............ 0          ← 970'in SIFIRI
--     ├─ hiç koşmamış ...... 378 (%39)  ← hepsinin oncelik'i 100 (en düşük)
--     ├─ son 24 saatte ..... 215
--     └─ 3 günden eski ..... 377
--
-- ── ARIZA 1: BİTMİŞ TERİM SEÇİMDEN DÜŞMÜYORDU ──────────────────────────────
--
-- 0140'ın seçicisinde `done` süzgeci YOKTU. Bugüne kadar bu fark etmedi
-- çünkü bitmiş terim sayısı sıfırdı — yani arıza, kendisini gizleyen bir
-- ikinci arıza sayesinde görünmüyordu. Sayfa tavanı bugün akşam gerçekten
-- `bitti` işaretlemeye başlayınca (bkz. _shared/hasatSayfa.ts) bu süzgeç
-- ŞART oldu: olmasaydı bitmiş terimler sırayı yemeye devam ederdi.
--
-- ── ARIZA 2: HİÇ KOŞMAMIŞ TERİM `oncelik`'e YENİLİYORDU ────────────────────
--
-- 0140 açlığı tek bir ifadeyle ölçüyordu:
--     (last_run is null OR last_run < now() - '2 days') desc
-- Bu, "hiç koşmamış" ile "2 gündür koşmamış"ı AYNI KÜMEYE koyuyor. Küme
-- içindeki sıralama ise `oncelik desc`. Ölçüm hipotezi doğruladı:
--
--     hiç koşmamış 378 terimin 370'inin oncelik'i .......... 100 (en düşük)
--     tavanı zorlayan 4 terimin oncelik'i ................. 113 (en yüksek)
--
-- Yani hiç koşmamış terim, açlık kümesine girse bile öncelik sırasında
-- sona düşüyor ve sıra ona hiç gelmiyor. RPC'ye o an bakıldığında seçtiği
-- terimin last_run'ı 07.09 idi — 378 terim hâlâ kuyruğun arkasındaydı.
--
-- DÜZELTME: "hiç koşmamış" KENDİ BAŞINA ve EN ÜSTTE bir ölçüt oluyor.
-- Bir terimi ilk kez çalıştırmanın değeri, çalışmış bir terimi tazelemekten
-- her zaman yüksektir: ilkinde kapsam AÇILIR, ikincisinde tazelenir.
--
-- ── DİRİLTME: bitmiş terim 7 gün sonra geri gelir ──────────────────────────
--
-- `done` artık gerçekten işaretlendiği için bir diriltme yolu gerekiyor;
-- yoksa 970 terim birer birer bitip hasat KALICI olarak durur. Ayrı bir
-- cron işi yerine süzgecin kendisine yazıldı: tek yerde durur, ayrışamaz.
-- İmleç 1'de olduğu için dirilen terim EN YENİ kararlardan başlar.

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
    -- BİTMİŞ TERİM SIRA ALMAZ — ta ki 7 gün geçene kadar. Diriltme penceresi
    -- burada, çünkü ikinci bir yerde tutulsaydı bu süzgeçle ayrışabilirdi.
    and (
      not coalesce(s.done, false)
      or s.last_run is null
      or s.last_run < now() - interval '7 days'
    )
  order by
    -- 1) HİÇ KOŞMAMIŞ EN ÖNCE — kendi başına, `oncelik`'ten ÖNCE.
    --    0140'ta bu ölçüt açlıkla aynı kümedeydi ve 378 terim `oncelik`
    --    sıralamasında sona düşüp hiç sıra alamıyordu.
    (s.last_run is null) desc,
    -- 2) Sonra açlık: 2 günden uzun süredir dokunulmamış olan.
    --    coalesce: last_run null ise ifade de null olurdu; 1. ölçüt onu
    --    zaten ayırdı ama sıralamayı belirsizliğe bırakmıyoruz.
    coalesce(s.last_run < now() - interval '2 days', true) desc,
    -- 3) Aynı kümede öncelik AĞIRLIK olarak çalışır — kapı değil.
    s.oncelik desc nulls last,
    -- 4) Eşitlikte en eski çalışan.
    s.last_run asc nulls first
  limit 1;
$$;

comment on function public.hasat_sonraki_terim(text) is
  'Sıradaki hasat terimi. Sıra: hiç koşmamış > aç > öncelik > eskilik. '
  'Bitmiş terim 7 gün dinlenir, sonra imleç 1''den (en yeni kararlar) diriltilir. '
  '15.09.2026 akşam: done süzgeci yoktu ve hiç koşmamış 378 terim oncelik''e yeniliyordu.';

revoke all on function public.hasat_sonraki_terim(text) from public, anon, authenticated;
grant execute on function public.hasat_sonraki_terim(text) to service_role;

-- ── Tavanın çok ötesinde kalmış terimleri hizaya çek ───────────────────────
--
-- Dört terim tavanın (50) çok ötesinde: 535, 345, 332, 80. Kod düzeltmesi
-- bunları bir sonraki koşuda kendiliğinden toparlar, ama o koşuya kadar
-- her biri bir tur daha boşa harcar. Burada bir kez elle hizalanıyorlar.
--
-- next_page = 1: dirildiklerinde EN YENİ kararlardan başlasınlar.
-- done = true : 7 günlük dinlenme penceresine girsinler.
-- last_run'a DOKUNULMUYOR — onu değiştirmek diriltme saatini kaydırırdı.
update public.ictihat_harvest_state
   set next_page = 1,
       done      = true,
       updated_at = now()
 where next_page > 50;

-- ── SIRALAMA DÜZELTMESİ BUGÜN HİÇBİR ŞEYİ DEĞİŞTİRMİYOR — DÜRÜSTLÜK PAYI ───
--
-- Yukarıdaki "hiç koşmamış en önce" düzeltmesi DOĞRU ama BUGÜN ETKİSİZ.
-- Sebebini göçü uyguladıktan SONRA ölçtüm; önce yazsaydım kendimi de
-- kandırmış olurdum. Havuz dağılımı (16.09.2026 06:0x UTC):
--
--   havuz              toplam   hiç koşmamış   son 6 saatte koşan
--   (öneksiz/emsal)      324          0                18
--   yargitay:            323        189                 0
--   danistay:            323        189                 0
--
-- İlk bakışta "iki havuz durmuş" gibi görünüyor. DEĞİL — cron kayıtları
-- tersini söylüyor: `vekil_hasat_yargitay` ve `vekil_hasat_danistay` son 6
-- saatte 120'ŞER KEZ BAŞARIYLA koşmuş. Komutlarına bakınca anlaşılıyor:
--
--   vekil_hasat_yargitay : hasat_tetikle('yargitay', 15, 'katalog')
--   vekil_hasat_danistay : hasat_tetikle('danistay', 15, 'katalog')
--   vekil_hasat_emsal    : hasat_tetikle('emsal', 10)          ← p_mod='terim'
--
-- Yargıtay ve Danıştay işleri KATALOG kipinde koşuyor: karar numarası
-- uzayını tarıyorlar, terim aramıyorlar. Terim yolunu kullanan TEK iş
-- emsal ve o da yalnız öneksiz havuza bakıyor (`terim not like '%:%'`).
--
-- SONUÇ: `yargitay:` ve `danistay:` önekli 378 satıra HİÇBİR İŞ HİÇ
-- DOKUNMUYOR. Onlar "aç" değil, ULAŞILAMAZ. Öneksiz havuzda ise hiç
-- koşmamış terim SIFIR — yani yeni sıralama ölçütünün bugün seçeceği bir
-- terim yok.
--
-- Düzeltme yine de duruyor, çünkü doğru ve ileride ucuz: öneksiz havuza yeni
-- terim eklendiği gün ya da önekli havuzlar için terim kipinde bir cron işi
-- açıldığı gün, açlık kuralı hazır olacak.
--
-- ÜRÜN SAHİBİNE AÇIK SORU (ben karar vermiyorum):
--   378 önekli terim ya (a) terim kipinde bir cron işiyle CANLANDIRILMALI —
--   Yargıtay/Danıştay'da terim bazlı kapsam açar, ama katalog yoluyla aynı
--   bütçeyi paylaşır — ya da (b) SİLİNMELİ, çünkü tabloda durup her ölçümde
--   "378 terim aç" diye yanlış bir alarm üretiyorlar.
--   Ölçmeden karar verilmemeli: katalog yolu şu an daha mı verimli, yoksa
--   terim yolu mu? İkisinin karar/saat değerleri ayrı ayrı ölçülmeli.

-- ── Uygulandığını doğrula (tek satır) ──────────────────────────────────────
select
  (select count(*) from public.ictihat_harvest_state where next_page > 50) as tavan_asan_kaldi,
  (select count(*) from public.ictihat_harvest_state where done)           as bitmis_terim,
  (select count(*) from public.ictihat_harvest_state where last_run is null) as hic_kosmamis,
  (select terim from public.hasat_sonraki_terim(null))                     as sirada_hangi_terim;
