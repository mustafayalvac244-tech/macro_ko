-- İKİ HAKLI İHTAR NEDENİYLE TAHLİYE — havuzda YOKTU.
--
-- ÖLÇÜLEN ARIZA (mütalaa ölçümü). Senaryo: "Kiracı son bir yılda iki kez kira
-- ödemesini geciktirdi, ikisi için de noterden ihtar çektik. Sözleşme 5 yıldır
-- sürüyor. Kiracıyı çıkarmak istiyor." Üretilen mütalaada ne "iki haklı ihtar"
-- geçti ne de bir aylık dava süresi.
--
-- Sebep modelde değil havuzdaydı: tahliye başlığı altında üç kural vardı
-- (temerrüt, on yıllık uzama, tahliye taahhüdü) ama TBK m.352/2 hiç yoktu.
-- Aramada gelenler on_yil_uzama_tahliye (0.148) ve kira_temerrut_tahliye
-- (0.116) — ikisi de olayın anlattığı yol DEĞİL.
--
-- SÜRE HAK DÜŞÜRÜCÜDÜR ve başlangıcı sezgiye aykırıdır: bir ay, ikinci ihtardan
-- değil, İHTARLARIN YAPILDIĞI KİRA YILININ BİTİMİNDEN işler. Bu ayrımı bilmeyen
-- avukat davayı erken açıp reddettirir ya da geç açıp hakkı düşürür.
--
-- Metin havuzdaki TBK m.352 okunarak yazıldı. Doğrulanan lafız (m.352/2):
--   "Kiracı, bir yıldan kısa süreli kira sözleşmelerinde kira süresi içinde;
--    bir yıl ve daha uzun süreli kira sözleşmelerinde ise bir kira yılı veya
--    bir kira yılını aşan süre içinde kira bedelini ödemediği için kendisine
--    yazılı olarak iki haklı ihtarda bulunulmasına sebep olmuşsa kiraya veren,
--    kira süresinin ve bir yıldan uzun süreli kiralarda ihtarların yapıldığı
--    kira yılının bitiminden başlayarak bir ay içinde, dava yoluyla kira
--    sözleşmesini sona erdirebilir."

insert into public.legal_rules (id, triggers, body) values (
  'iki_hakli_ihtar_tahliye',
  'iki haklı ihtar iki hakli ihtar 2 haklı ihtar iki kez ihtar çektik '
  || 'iki kere ihtar iki defa ihtar kira geciktirdi kirayı geç ödüyor '
  || 'kirayi gec oduyor sürekli geç ödüyor surekli gec oduyor '
  || 'kiracıyı çıkarmak kiraciyi cikarmak tahliye davası tahliye davasi '
  || 'noterden ihtar çektik noterden ihtarname kira yılı kira yili',
  'İKİ HAKLI İHTAR NEDENİYLE TAHLİYE (TBK m.352/2) — kira bedelini ZAMANINDA '
  || 'ödemeyen kiracıya karşı, temerrüt yolundan AYRI bir tahliye sebebi.

(1) ŞART: Kiracı, bir kira yılı içinde (bir yıldan kısa sözleşmelerde kira süresi '
  || 'içinde) kira bedelini ÖDEMEDİĞİ için kendisine YAZILI olarak İKİ HAKLI İHTARDA '
  || 'bulunulmasına sebep olmalıdır. İhtarların yazılı olması şarttır; sözlü uyarı '
  || 'sayılmaz. "Haklı" olmaları, ihtar anında gerçekten muaccel bir kira borcunun '
  || 'bulunmasını gerektirir.

(2) SÜRE — EN ÇOK YANILINAN NOKTA: Dava, ikinci ihtardan itibaren değil, İHTARLARIN '
  || 'YAPILDIĞI KİRA YILININ BİTİMİNDEN başlayarak BİR AY içinde açılır (bir yıldan '
  || 'kısa sözleşmelerde kira süresinin bitiminden). Erken açılan dava reddedilir, '
  || 'geç açılanda hak düşer. Kira yılının hangi tarihte bittiğini sözleşmeden TEYİT ET.

(3) BU YOL, TEMERRÜT YOLUNDAN (TBK m.315) FARKLIDIR: temerrütte kiracıya süre '
  || 'verilip ödemezse fesih; burada ödeme sonradan yapılmış olsa BİLE, iki haklı '
  || 'ihtara sebep olmuş olmak tahliye için yeterlidir. İki yol birbirinin alternatifidir; '
  || 'olaydaki ihtarların hangi amaçla çekildiğine bak.

(4) Tahliye davası SULH HUKUK mahkemesinde açılır ve kira ilişkisinden doğan davalarda '
  || 'arabuluculuk DAVA ŞARTIDIR (İşMK/HUAK kapsamındaki kiralanan taşınmazların '
  || 'tahliyesine ilişkin uyuşmazlıklar); dava açmadan önce arabulucuya başvurulmalıdır.'
) on conflict (id) do update set triggers = excluded.triggers, body = excluded.body;
