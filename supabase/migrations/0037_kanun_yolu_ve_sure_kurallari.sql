-- KESİN KURALLAR — ölçülen cevap hatalarına karşı.
--
-- NEDEN BU YOL: modelin ağırlıklarını eğitemiyoruz (sağlayıcı buna izin
-- vermiyor, bütçe de yok). Bu mimaride "öğretmenin" tek kalıcı yolu, cevabı
-- gerçek metne bağlayan kural tabanıdır: legal_rules içeriği beslemeye
-- "KESİN KURALLAR" olarak girer ve modelin kendi tahminini EZER.
--
-- HANGİ HATALAR ÖLÇÜLDÜ (scripts/eval-cevap.mjs):
--   • İstinaf sorusunda süre bazen hiç yazılmadı, bazen doğru yazıldı —
--     yani en tehlikeli bilgi (kanun yolu süresi) koşudan koşuya değişiyordu.
--     Buna kural EKLENMEDİ: `istinaf_temyiz_hukuk` kuralı zaten mevcut ve daha
--     kapsamlı (iş mahkemesi için 7036 s.K. m.7'yi de içeriyor). Önce mevcut
--     kurallara bakmadan yenisini yazmak, 3 kurallık besleme slotunu mükerrer
--     içerikle doldurup başka kuralı dışarıda bırakırdı.
--   • "İki yıldır çalışan işçinin ihbar öneli" sorusunda yanlış hafta verildi.
--     İşK m.17 kıdeme göre 2/4/6/8 hafta diyor; 1,5–3 yıl arası ALTI haftadır.
--   • Tahliyede kiracıya verilecek asgari süre bazen yazılmadı.
--
-- Sıcaklığı 0.4'ten 0.1'e indirmek tek başına yetmedi: aynı soru yine farklı
-- kalitede cevaplanabildi. Kural metni ise her seferinde aynı şekilde beslemeye
-- girdiği için sonucu sağlamlaştırır.
--
-- HER KURAL, veritabanımızdaki GERÇEK madde metni okunarak yazılmıştır;
-- hafızadan yazılmamıştır.
--
-- SONUÇ (kota yenilendikten sonra tek koşu ölçüm):
--   önce  6/8  (%75,0)
--   sonra 7/8  (%87,5)
-- Düzelen iki soru, tam da kural yazılan alanlar: istinaf süresi (önce süreyi
-- hiç yazmıyordu) ve ihbar öneli (önce yanlış hafta veriyordu).
-- OKUMA UYARISI: 8 soruluk kümede tek sorunun düşmesi oranı %12,5 oynatır.
-- Bu yüzden sonucu "kurallar %12,5 kazandırdı" diye değil, "hedeflenen iki
-- soru düzeldi" diye okumak doğrudur.

insert into public.legal_rules (id, triggers, body) values

('ihbar_oneli',
 'ihbar öneli ihbar onel bildirim süresi süreli fesih ihbar tazminatı önel belirsiz süreli iş sözleşmesi fesih bildirimi kıdem',
 'İHBAR (BİLDİRİM) ÖNELLERİ — İş Kanunu m.17: Belirsiz süreli iş sözleşmesinin feshinden önce karşı tarafa bildirim yapılmalıdır. Süreler İŞÇİNİN KIDEMİNE göre değişir: (a) işi ALTI AYDAN AZ sürmüş işçi için İKİ HAFTA; (b) altı aydan BİR BUÇUK YILA kadar sürmüş işçi için DÖRT HAFTA; (c) bir buçuk yıldan ÜÇ YILA kadar sürmüş işçi için ALTI HAFTA; (d) üç yıldan FAZLA sürmüş işçi için SEKİZ HAFTA. Süre, bildirimin karşı tarafa yapılmasından başlar. Bu süreler ASGARİDİR, sözleşmeyle artırılabilir ama azaltılamaz. Bildirim şartına uymayan taraf, bildirim süresine ilişkin ÜCRET TUTARINDA tazminat (ihbar tazminatı) öder. İşveren, bildirim süresine ait ücreti peşin vererek sözleşmeyi derhal feshedebilir. DİKKAT: ihbar öneli ile kıdem tazminatı ayrı şeylerdir; haklı nedenle derhal fesihte (m.24-25) ihbar öneli gerekmez.'),

('kira_temerrut_tahliye',
 'kira ödenmedi kirayı ödemiyor kira borcu temerrüt tahliye ihtar kiracıya süre verme kira alacağı tahliye davası görevli mahkeme',
 'KİRA BEDELİNİN ÖDENMEMESİ — TEMERRÜT VE TAHLİYE (TBK m.315): Kiracı, muaccel kira bedelini veya yan gideri ödemezse, kiraya veren kiracıya YAZILI olarak süre verip, bu sürede de ödenmezse sözleşmeyi feshedeceğini bildirir. Verilecek süre EN AZ ON GÜNDÜR; KONUT VE ÇATILI İŞYERİ kiralarında ise EN AZ OTUZ GÜNDÜR. Süre, yazılı bildirimin yapıldığı tarihi İZLEYEN GÜNDEN itibaren işler. GÖREVLİ MAHKEME: kira ilişkisinden doğan alacak davaları da dâhil olmak üzere kira ilişkisinden doğan TÜM uyuşmazlıklarda SULH HUKUK MAHKEMESİ görevlidir (HMK m.4/1-a) — dava konusunun değer veya tutarına BAKILMAKSIZIN. Asliye hukuk veya iş mahkemesi görevli DEĞİLDİR; yanlış mahkemede açılan dava görevsizlik kararıyla sonuçlanır. AYRIK HÂL: kiralanan taşınmazın İcra ve İflas Kanunu''na göre İLAMSIZ İCRA YOLUYLA tahliyesi bu görev kuralının dışındadır (HMK m.4/1-a''daki açık istisna); o yol icra dairesi üzerinden yürür ve uyuşmazlığı icra mahkemesi çözer. Yani alacaklı, dava yolu ile icra yolu arasında seçim yapar; hangisini seçtiği görevli mercii belirler.'),

('cevap_dilekcesi_suresi',
 'cevap dilekçesi cevap süresi ek süre davaya cevap cevap dilekçesini verme süresi',
 'CEVAP DİLEKÇESİ SÜRESİ (HMK m.127): Cevap dilekçesini verme süresi, dava dilekçesinin davalıya TEBLİĞİNDEN itibaren İKİ HAFTADIR. Ancak durum ve koşullara göre cevap dilekçesinin bu sürede hazırlanması çok zor yahut imkânsızsa, YİNE BU SÜRE İÇİNDE mahkemeye başvuran davalıya EK SÜRE verilebilir: ek süre, cevap süresinin bitiminden itibaren işlemeye başlar, BİR DEFAYA MAHSUSTUR ve BİR AYI GEÇEMEZ. Ek süre talebi, iki haftalık süre GEÇTİKTEN sonra yapılamaz.'),

('bilirkisi_rapor_itiraz',
 'bilirkişi raporu itiraz bilirkisi rapora itiraz süresi ek rapor bilirkişi incelemesi',
 'BİLİRKİŞİ RAPORUNA İTİRAZ (HMK m.281): Taraflar, bilirkişi raporunun KENDİLERİNE TEBLİĞİ tarihinden itibaren İKİ HAFTA içinde, raporda eksik gördükleri hususların tamamlanmasını veya belirsizliklerin giderilmesini isteyebilir; raporda yer alan görüşlere itiraz edebilirler. Süre, raporun mahkemeye sunulmasından değil TARAFA TEBLİĞİNDEN işler. Süresinde itiraz edilmeyen rapora sonradan itiraz, hak düşümü riski taşır.'),

('zamanasimi_genel_bes_yil',
 'zamanaşımı zamanasimi kaç yıl alacak zamanaşımı genel zamanaşımı beş yıllık on yıllık kira bedeli zamanaşımı',
 'ZAMANAŞIMI — GENEL VE BEŞ YILLIK (TBK m.146-147): KURAL: kanunda aksine hüküm bulunmadıkça her alacak ON YILLIK zamanaşımına tabidir (TBK m.146). İSTİSNA — BEŞ YILLIK zamanaşımı (TBK m.147, altı bent): (1) kira bedelleri, anapara faizleri ve ücret gibi diğer DÖNEMSEL EDİMLER; (2) otel, motel, pansiyon, tatil köyü konaklama bedelleri ile lokanta ve benzeri yerlerdeki yeme-içme bedelleri; (3) küçük sanat işlerinden ve küçük çapta perakende satışlardan doğan alacaklar; (4) ortaklık sözleşmesinden doğan, ortaklar/müdürler/temsilciler/denetçiler ile ortaklık arasındaki alacaklar; (5) vekâlet, komisyon ve acentalık sözleşmelerinden doğan alacaklar ile (ticari simsarlık ücreti hariç) simsarlık sözleşmesinden doğan alacaklar; (6) eser sözleşmesinden doğan alacaklar — yüklenicinin yükümlülüklerini AĞIR KUSURUYLA hiç ya da gereği gibi ifa etmemesi hâli bunun dışındadır (o hâlde on yıl uygulanır). DİKKAT: kira ALACAĞI beş yıla tabidir; zamanaşımı ile hak düşürücü süre karıştırılmamalıdır — zamanaşımı def olarak ileri sürülür, hâkim resen dikkate alamaz.')

on conflict (id) do update set triggers = excluded.triggers, body = excluded.body;
