-- ÖDEME EMRİNE İTİRAZ — borçlunun yolu. Havuzda YOKTU ve model savruldu.
--
-- ÖLÇÜLEN ARIZA (dilekçe ölçümü). Senaryo: "genel haciz yoluyla takip, ödeme
-- emri tebliğ edildi, borç yok, imza da müvekkile ait değil." Üretilen taslak:
--
--   • İCRA HUKUK MAHKEMESİ'ne hitap etti — oysa genel haciz yolunda itiraz
--     İCRA DAİRESİNE yapılır (İİK m.62).
--   • Dayanak olarak İİK m.170'i gösterdi — o, KAMBİYO takibinde imzaya itiraz
--     hükmüdür, bambaşka bir yol.
--   • İİK m.68'i borçlunun hakkı gibi yazdı — m.68 ALACAKLININ yoludur.
--
-- Yanlış mercie verilen itirazda yedi günlük süre işlemeye devam eder, takip
-- KESİNLEŞİR ve borçlu bir daha itiraz edemez. Bu, dilekçe biçimindeki bir
-- eksiklik değil, doğrudan hak kaybıdır.
--
-- KÖK SEBEP VERİ EKSİĞİ: havuzdaki itirazin_iptali_kaldirilmasi kuralı
-- ALACAKLININ itirazdan sonraki yolunu anlatıyor; BORÇLUNUN nasıl itiraz
-- edeceğini anlatan kural hiç yoktu. Model, boş bıraktığımız yeri komşu
-- hükümlerle doldurdu.
--
-- Metin hafızadan değil, mevzuat havuzumuzdaki İİK m.62, m.66, m.168, m.169 ve
-- m.170 okunarak yazıldı. Doğrulanan lafızlar:
--   m.62  "...tebliği tarihinden itibaren yedi gün içinde dilekçe ile veya
--          sözlü olarak icra dairesine bildirmeye mecburdur."
--   m.62  "...imzayı reddediyorsa, bunu itirazında ayrıca ve açıkça beyan
--          etmelidir. Aksi takdirde ... imzayı kabul etmiş sayılır."
--   m.66  "Müddeti içinde yapılan itiraz takibi durdurur."
--   m.168 "...beş gün içinde ... icra mahkemesine bir dilekçe ile bildirerek"
--   m.169 "Bu itiraz satıştan başka icra takip muamelelerini durdurmaz."

insert into public.legal_rules (id, triggers, body) values (
  'odeme_emrine_itiraz',
  'ödeme emrine itiraz odeme emrine itiraz ödeme emri geldi icra takibi başlatılmış '
  || 'borca itiraz imzaya itiraz imza itirazı yetki itirazı takibe itiraz '
  || 'genel haciz yolu ilamsız takip kambiyo takibi bonoya itiraz çeke itiraz '
  || 'takip durdurma icra dairesine itiraz yedi gün beş gün',
  'ÖDEME EMRİNE İTİRAZ — ÖNCE HANGİ TAKİP YOLU OLDUĞUNU BELİRLE; merci ve süre '
  || 'buna göre DEĞİŞİR ve karıştırmak hak kaybettirir.

(1) GENEL HACİZ YOLU / İLAMSIZ TAKİP (İİK m.62): İtiraz, ödeme emrinin TEBLİĞİNDEN '
  || 'itibaren YEDİ GÜN içinde, dilekçeyle veya SÖZLÜ olarak İCRA DAİRESİNE yapılır. '
  || 'İcra mahkemesine yapılmaz. Süresinde yapılan itiraz TAKİBİ DURDURUR (İİK m.66).

(2) KAMBİYO SENEDİNE ÖZGÜ TAKİP (bono/poliçe/çek — İİK m.168 vd.): Süre BEŞ GÜNDÜR '
  || 've itiraz İCRA MAHKEMESİNE yapılır. Borca itiraz İİK m.169, imzaya itiraz '
  || 'İİK m.170''e göredir. Bu itiraz, satış dışındaki takip işlemlerini DURDURMAZ '
  || '(İİK m.169). İmzayı haksız yere inkâr edene takip konusu alacağın %10''u '
  || 'oranında para cezası verilir.

(3) İMZA İTİRAZI AYRICA VE AÇIKÇA YAPILMALIDIR (İİK m.62/son): Borçlu senet '
  || 'altındaki imzayı reddediyorsa bunu itirazında AYRICA ve AÇIKÇA beyan etmek '
  || 'zorundadır; aksi hâlde icra takibi yönünden İMZAYI KABUL ETMİŞ SAYILIR. '
  || '"Borcum yoktur" demek imzaya itiraz yerine geçmez.

(4) İtirazın SEBEPLERİ (borca, imzaya, yetkiye) itiraz dilekçesinde ayrı ayrı '
  || 'gösterilmelidir.

KARIŞTIRMA: İİK m.67 (itirazın iptali davası) ve m.68 (itirazın kaldırılması) '
  || 'ALACAKLININ itirazdan SONRAKİ yollarıdır; borçlunun itiraz dilekçesine dayanak '
  || 'yapılmaz.'
) on conflict (id) do update set triggers = excluded.triggers, body = excluded.body;

-- EK SIKILAŞTIRMA (kural yazıldıktan sonraki denemede görüldü). Taslak merci
-- ve süreyi düzeltti ama imza itirazına hâlâ İİK m.170'i dayanak gösterdi ve
-- parantez içinde kendi kendini düzeltmeye çalıştı: "icra mahkemesine (bu
-- durumda icra dairesine)". Yarım doğru bir dayanak, dilekçede tam yanlış
-- kadar zararlıdır; hangi maddenin hangi yola ait olduğu açıkça yazılıyor.
update public.legal_rules set body = body || '

DAYANAK SEÇİMİ (yanlış madde göstermek, dilekçeyi çürütür):
• Genel haciz yolunda İMZA İTİRAZININ dayanağı İİK m.62/son''dur — m.170 DEĞİLDİR.
  m.170 yalnızca kambiyo senedine özgü takipte, icra mahkemesine yapılan imza
  itirazını düzenler; genel haciz yolundaki itiraz dilekçesinde ona atıf yapma.
• Genel haciz yolunda itiraz bir DAVA DEĞİLDİR: icra dairesine verilen itirazla
  takip kendiliğinden durur (İİK m.66). "Mahkemeden karar verilmesini talep
  ederiz" biçiminde yazma; talep, itirazın kayda geçirilmesi ve takibin
  durmasıdır.'
where id = 'odeme_emrine_itiraz';
