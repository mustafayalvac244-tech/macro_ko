-- KESİN KURALLAR — aramanın kaçırdığı beş alan.
--
-- NEDEN KURAL, NEDEN ARAMA DEĞİL: 31 soruluk arama ölçümünde kaçan maddelerin
-- ortak özelliği, sorunun OLAYI anlatıp kanun terimini hiç kullanmamasıydı
-- ("komşum ağaçlarıma zarar verdi" → TBK m.49; "mahkemenin kendiliğinden
-- araştırdığı hususlar" → HMK m.114). Ortak kelime olmayınca kelime araması
-- bulamaz, gömme modeli de Türkçe hukuk metninde yeterince ayırt edemiyor.
-- Kural tabanının tetikleyicileri ELLE yazıldığı için bu boşluğu atlar.
--
-- SEÇİM ÖLÇÜTÜ: yalnızca mevcut 30 kuralda KARŞILIĞI OLMAYAN konular. Geçen
-- turda karşılığı olan bir konuya ikinci kural yazmıştım; mükerrer kural,
-- beslemeye giren 3 kurallık yeri doldurup başka kuralı dışarıda bırakıyor.
--
-- HER KURAL, veritabanındaki gerçek madde metni okunarak yazılmıştır.

insert into public.legal_rules (id, triggers, body) values

('ihtiyati_tedbir',
 'ihtiyati tedbir tedbir kararı tedbir talebi tedbir koydurmak malına tedbir teminat tedbire itiraz tedbirin uygulanması tedbir kalkar',
 'İHTİYATİ TEDBİR (HMK m.389-397) — ŞARTLAR: mevcut durumdaki bir değişme nedeniyle hakkın elde edilmesinin önemli ölçüde zorlaşacağı ya da imkânsızlaşacağı, yahut gecikme sebebiyle bir sakınca veya ciddi zarar doğacağı endişesi bulunmalıdır (m.389). TALEP MERCİİ: dava açılmadan önce esas hakkında görevli ve yetkili mahkemeden; dava açıldıktan sonra ancak asıl davanın görüldüğü mahkemeden istenir (m.390/1). Talep eden, tedbir sebebini ve TÜRÜNÜ açıkça belirtmek ve davanın esası yönünden haklılığını YAKLAŞIK OLARAK İSPAT etmek zorundadır (m.390/3); karşı taraf dinlenmeden de karar verilebilir. HAK DÜŞÜREN İKİ SÜRE — EN SIK KAÇIRILAN NOKTA: (1) Tedbir kararının UYGULANMASI, kararın tedbir isteyene tefhim veya tebliğinden itibaren BİR HAFTA içinde talep edilmek zorundadır; aksi hâlde kanuni sürede dava açılmış olsa bile tedbir KENDİLİĞİNDEN KALKAR (m.393/1). Uygulama, kararı veren mahkemenin yargı çevresindeki veya malın bulunduğu yer İCRA DAİRESİNDEN istenir (m.393/2). (2) Tedbir dava açılmadan ÖNCE verilmişse, talep eden, uygulamayı talep ettiği tarihten itibaren İKİ HAFTA içinde esas hakkındaki davayı açmak ve dava açtığına dair evrakı dosyaya koydurtmak zorundadır; aksi hâlde tedbir KENDİLİĞİNDEN KALKAR (m.397/1). İTİRAZ: karşı taraf dinlenmeden verilen tedbire itiraz edilebilir; süre, uygulama sırasında hazır bulunuyorsa uygulamadan, bulunmuyorsa tutanağın tebliğinden itibaren BİR HAFTADIR ve itiraz kararı veren mahkemeye yapılır (m.394). İtiraz, aksi kararlaştırılmadıkça icrayı durdurmaz.'),

('bosanma_sebepleri_genel',
 'boşanma sebebi şiddetli geçimsizlik geçimsizlik evlilik birliğinin sarsılması anlaşmalı boşanma boşanmak istiyorum eşimle anlaşamıyoruz temelinden sarsılma',
 'BOŞANMA — EVLİLİK BİRLİĞİNİN TEMELİNDEN SARSILMASI (TMK m.166): Halk arasında "şiddetli geçimsizlik" denilen sebebin kanundaki karşılığı budur. Evlilik birliği, ortak hayatı sürdürmeleri kendilerinden beklenmeyecek derecede TEMELİNDEN SARSILMIŞSA, eşlerden her biri boşanma davası açabilir (m.166/1). KUSUR İTİRAZI: davacının kusuru daha ağırsa davalının davaya itiraz hakkı vardır; ancak bu itiraz hakkın kötüye kullanılması niteliğindeyse ve evlilik birliğinin devamında davalı ile çocuklar bakımından korunmaya değer bir yarar kalmamışsa yine boşanmaya karar verilebilir (m.166/2). ANLAŞMALI BOŞANMA: evlilik EN AZ BİR YIL sürmüşse, eşlerin birlikte başvurması ya da bir eşin diğerinin davasını kabul etmesi hâlinde evlilik birliği temelinden sarsılmış sayılır; hâkim tarafları bizzat dinler ve malî sonuçlar ile çocukların durumuna ilişkin düzenlemeyi uygun bulmak zorundadır. Bir yıllık süre dolmadan anlaşmalı boşanma yolu kullanılamaz.'),

('dava_dilekcesi_icerigi',
 'dava dilekçesi içeriği dilekçede neler bulunur dava dilekçesi nasıl yazılır dilekçe unsurları talep sonucu vakıalar delil hukuki sebepler',
 'DAVA DİLEKÇESİNİN ZORUNLU İÇERİĞİ (HMK m.119/1): (a) mahkemenin adı; (b) davacı ile davalının adı, soyadı ve adresleri; (c) davacının T.C. kimlik numarası; (ç) varsa kanuni temsilcilerin ve davacı vekilinin adı, soyadı ve adresleri; (d) davanın konusu ve malvarlığı haklarına ilişkin davalarda dava konusunun DEĞERİ; (e) davacının iddiasının dayanağı olan BÜTÜN VAKIALARIN sıra numarası altında açık özetleri; (f) iddia edilen HER BİR VAKIANIN hangi delillerle ispat edileceği; (g) dayanılan HUKUKİ SEBEPLER; (ğ) açık şekilde TALEP SONUCU; (h) davacının, varsa kanuni temsilcisinin veya vekilinin imzası. DİKKAT: vakıaların ayrı ayrı numaralandırılması ve her vakıanın hangi delille ispat edileceğinin gösterilmesi (e ve f bentleri) uygulamada en çok atlanan unsurlardır; eksiklik hâlinde hâkim kesin süre verip tamamlatır.'),

('dava_sartlari',
 'dava şartı dava şartları usulden ret esasa girmeden mahkeme kendiliğinden araştırır resen dikkate alınan hususlar gider avansı derdestlik kesin hüküm hukuki yarar',
 'DAVA ŞARTLARI (HMK m.114): Mahkemenin işin esasına girebilmesi için bulunması gereken şartlardır ve hâkim bunları YARGILAMANIN HER AŞAMASINDA KENDİLİĞİNDEN (resen) gözetir. Şunlardır: Türk mahkemelerinin yargı hakkının bulunması; yargı yolunun caiz olması; mahkemenin GÖREVLİ olması; yetkinin kesin olduğu hâllerde YETKİLİ olması; tarafların taraf ve dava ehliyetine sahip olması (kanuni temsilde temsilcinin gerekli niteliği taşıması); dava takip yetkisi; vekille takipte vekilin davaya vekâlet ehliyeti ve usulüne uygun VEKÂLETNAME bulunması; davacının GİDER AVANSINI yatırmış olması; gereken hâllerde teminat gösterilmesi; ayrıca davacının hukuki yararının bulunması, aynı davanın daha önce açılıp derdest olmaması ve kesin hüküm bulunmaması. SONUÇ: dava şartı yoksa dava ESASTAN değil USULDEN reddedilir; bu ret, aynı davanın şart tamamlanarak yeniden açılmasına engel değildir.'),

('haksiz_fiil_sorumluluk',
 'haksız fiil zarar verdi tazminat kusurlu davranış zarar gördüm maddi manevi tazminat haksız fiil zamanaşımı iki yıl on yıl komşu zarar',
 'HAKSIZ FİİL SORUMLULUĞU (TBK m.49) VE ZAMANAŞIMI (TBK m.72): SORUMLULUK: kusurlu ve hukuka aykırı bir fiille başkasına zarar veren, bu zararı gidermekle yükümlüdür (m.49/1). Fiili yasaklayan bir hukuk kuralı bulunmasa bile, AHLAKA AYKIRI bir fiille başkasına KASTEN zarar veren de zararı gidermekle yükümlüdür (m.49/2). Unsurlar: hukuka aykırı fiil, kusur, zarar ve illiyet bağı. ZAMANAŞIMI (m.72): tazminat istemi, zarar görenin ZARARI VE TAZMİNAT YÜKÜMLÜSÜNÜ ÖĞRENDİĞİ tarihten başlayarak İKİ YILIN ve HER HÂLDE fiilin işlendiği tarihten başlayarak ON YILIN geçmesiyle zamanaşımına uğrar. İKİ SÜRE BİRLİKTE işler: hangisi önce dolarsa istem zamanaşımına uğrar. İSTİSNA: tazminat, ceza kanunlarının DAHA UZUN zamanaşımı öngördüğü cezayı gerektiren bir fiilden doğmuşsa, o daha uzun ceza zamanaşımı uygulanır — bu, iki yıllık sürenin kaçırıldığı dosyalarda çoğu zaman gözden kaçan kurtarıcı hükümdür. Ayrıca zarar gören, istemi zamanaşımına uğramış olsa bile, haksız fiil dolayısıyla kendisine doğmuş bir borcu ifadan her zaman kaçınabilir.')

on conflict (id) do update set triggers = excluded.triggers, body = excluded.body;
