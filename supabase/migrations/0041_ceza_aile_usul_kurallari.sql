-- KESİN KURALLAR — 43 soruluk arama ölçümünde kaçan altı alan.
--
-- Bu alanlarda soru OLAYI anlatıyor, kanun terimini kullanmıyor; kelime araması
-- eşleşecek ortak kelime bulamıyor, gömme modeli de Türkçe hukuk metninde
-- yeterince ayırt edemiyor. Kural tetikleyicileri elle yazıldığı için bu boşluğu
-- atlar. Mevcut 35 kural tek tek kontrol edildi; hiçbirinin karşılığı yok.
--
-- İki maddenin (CMK m.253, TCK m.66) veride BAŞLIĞI BOŞ; başlık ağırlıklı
-- sıralamada hiç 'A' sinyali taşımadıkları için aramaya düşmeleri özellikle zor.
-- Kural, tam da bu tür maddeler için doğru araç.
--
-- Metinler veritabanından okunarak yazıldı.

insert into public.legal_rules (id, triggers, body) values

('tutuklama_sartlari',
 'tutuklama tutuklandı tutukluluk tutuklama nedeni kuvvetli suç şüphesi kaçma şüphesi delil karartma adli kontrol tutuklamaya itiraz',
 'TUTUKLAMA ŞARTLARI (CMK m.100): Tutuklama kararı için İKİ ŞART BİRLİKTE aranır: (1) kuvvetli suç şüphesinin varlığını gösteren SOMUT DELİLLER; (2) bir TUTUKLAMA NEDENİ. Ayrıca ÖLÇÜLÜLÜK: işin önemi, verilmesi beklenen ceza veya güvenlik tedbiriyle ölçülü değilse tutuklama kararı VERİLEMEZ. Tutuklama nedeni sayılabilecek hâller: şüpheli/sanığın kaçması, saklanması veya kaçacağı şüphesini uyandıran somut olgular; davranışlarının delilleri yok etme, gizleme veya değiştirme yahut tanık/mağdur/başkaları üzerinde baskı girişiminde bulunma hususlarında kuvvetli şüphe oluşturması. Maddede ayrıca, işlendiği hususunda somut delillere dayanan kuvvetli şüphe bulunması hâlinde tutuklama nedeninin var SAYILABİLECEĞİ suçlar (katalog suçlar) sayılmıştır. DİKKAT: katalog suç olması tutuklamayı zorunlu kılmaz; ölçülülük ve somut delil şartı her hâlde aranır.'),

('uzlastirma_kapsam',
 'uzlaştırma uzlaşma uzlaştırmacı uzlaşma teklifi hangi suçlarda uzlaşma şikayete bağlı suç uzlaştırma kapsamı',
 'UZLAŞTIRMA KAPSAMI (CMK m.253): Uzlaştırma girişiminde bulunulacak suçlar: (a) soruşturulması ve kovuşturulması ŞİKÂYETE BAĞLI suçlar; (b) şikâyete bağlı olup olmadığına bakılmaksızın TCK''da sayılan belirli suçlar — bunlar arasında tehdit (m.106/1), iş ve çalışma hürriyetinin ihlali (m.117/1; m.119/1-c), hırsızlık (m.141), güveni kötüye kullanma (üçüncü fıkra hariç, m.155), dolandırıcılık (m.157), suç eşyasının satın alınması veya kabul edilmesi (m.165), ticari/bankacılık/müşteri sırrı niteliğindeki bilgi veya belgelerin açıklanması (dördüncü fıkra hariç, m.239) sayılmıştır; (c) mağdur veya suçtan zarar görenin gerçek ya da özel hukuk tüzel kişisi olması koşuluyla, SUÇA SÜRÜKLENEN ÇOCUKLAR bakımından ayrıca üst sınırı ÜÇ YILI geçmeyen hapis veya adli para cezasını gerektiren suçlar. UZLAŞTIRMA YOLUNA GİDİLEMEYEN HÂLLER — şikâyete bağlı OLSA BİLE: cinsel dokunulmazlığa karşı suçlar, ısrarlı takip (m.123/A) ve HAKARET (m.125). Hakaret şikâyete bağlı olduğu için uzlaştırma kapsamında sanılabilir; DEĞİLDİR. Diğer kanunlardaki suçlarda (şikâyete bağlı olanlar hariç) uzlaştırma ancak kanunda AÇIK HÜKÜM varsa mümkündür. Uzlaştırma kapsamındaki bir suçta bu yola başvurulmadan dava açılması usule aykırılıktır. NOT: (b) bendindeki sayım burada eksiksiz değildir; somut suç için maddenin güncel metni kontrol edilmelidir.'),

('dava_zamanasimi_ceza',
 'dava zamanaşımı ceza zamanaşımı kamu davası düşer suç zamanaşımı kaç yıl ceza davası zamanaşımı yaş indirimi zamanaşımı',
 'CEZADA DAVA ZAMANAŞIMI (TCK m.66): Kanunda başka türlü yazılmadıkça kamu davası şu sürelerin geçmesiyle DÜŞER: ağırlaştırılmış müebbet hapsi gerektiren suçlarda OTUZ YIL; müebbet hapsi gerektirenlerde YİRMİ BEŞ YIL; yirmi yıldan aşağı olmamak üzere hapis gerektirenlerde YİRMİ YIL; beş yıldan fazla ve yirmi yıldan az hapis gerektirenlerde ON BEŞ YIL; beş yılı geçmeyen hapis veya adli para cezası gerektirenlerde SEKİZ YIL. YAŞ İNDİRİMİ: fiil sırasında 12 yaşını doldurup 15 yaşını doldurmamış olanlarda bu sürelerin YARISI, 15 yaşını doldurup 18 yaşını doldurmamış olanlarda ÜÇTE İKİSİ geçmekle dava düşer. SÜRE BELİRLENİRKEN: suçun kanundaki cezasının YUKARI SINIRI esas alınır; dosyadaki delillere göre suçun daha ağır cezayı gerektiren NİTELİKLİ HÂLLERİ de göz önünde bulundurulur. Dava zamanaşımı ile ceza zamanaşımı (TCK m.68) farklı kavramlardır; karıştırılmamalıdır.'),

('velayet',
 'velayet velâyet çocuğun velayeti velayet kimde kalır boşanmada velayet velayet değişikliği kişisel ilişki çocukla görüşme',
 'VELAYET (TMK m.335-337, m.182): KURAL: ergin olmayan çocuk ana ve babanın velayeti altındadır; yasal sebep olmadıkça velayet ana babadan ALINAMAZ (m.335). EVLİLİK SÜRERKEN ana ve baba velayeti BİRLİKTE kullanır; ortak hayata son verilmiş veya ayrılık hâli gerçekleşmişse hâkim velayeti eşlerden BİRİNE verebilir (m.336). ÖLÜM hâlinde velayet SAĞ KALANA, BOŞANMADA ise çocuk KENDİSİNE BIRAKILAN TARAFA aittir (m.336). ANA BABA EVLİ DEĞİLSE velayet ANAYA aittir; ana küçük, kısıtlı, ölmüş ya da velayet kendisinden alınmışsa hâkim çocuğun menfaatine göre vasi atar veya velayeti babaya verir (m.337). BOŞANMADA: mahkeme, olanak bulundukça ana babayı dinledikten sonra hakları ve çocukla kişisel ilişkiyi düzenler; kişisel ilişki düzenlenirken çocuğun özellikle SAĞLIK, EĞİTİM VE AHLÂK bakımından yararları esas alınır. Velayet kendisine verilmeyen eş, çocuğun bakım ve eğitim giderlerine GÜCÜ ORANINDA katılmak zorundadır. Mahkeme kararında, kişisel ilişki düzenlemesinin gereklerinin yerine getirilmemesi hâlinde — çocuğun menfaatine aykırı olmamak kaydıyla — velayetin DEĞİŞTİRİLEBİLECEĞİNİ ihtar eder (m.182).'),

('adli_yardim',
 'adli yardım adli yardim harç muafiyeti dava masrafı ödeyemiyorum yargılama gideri avukat ücreti karşılayamıyorum gider avansı muafiyet',
 'ADLİ YARDIM (HMK m.334): Kendisinin ve ailesinin geçimini ÖNEMLİ ÖLÇÜDE ZOR DURUMA DÜŞÜRMEKSİZİN gereken yargılama veya takip giderlerini kısmen ya da tamamen ödeme gücünden yoksun olanlar adli yardımdan yararlanabilir. Kapsam yalnız dava değildir: İDDİA VE SAVUNMA, GEÇİCİ HUKUKİ KORUNMA talepleri (ihtiyati tedbir/haciz) ve İCRA TAKİBİ de kapsamdadır. ŞART: talebin açıkça dayanaktan yoksun OLMAMASI. YABANCILAR için ayrıca KARŞILIKLILIK şartı aranır. Adli yardım kararı, giderlerden geçici muafiyet sağlar; davanın esasını etkilemez.'),

('borca_aykirilik_tazminat',
 'borç ifa edilmedi borcunu yerine getirmedi ifa etmedi gereği gibi ifa etmeme sözleşmeye aykırılık zarar tazminat kusursuzluk ispatı',
 'BORCA AYKIRILIKTAN DOĞAN TAZMİNAT (TBK m.112): Borç HİÇ veya GEREĞİ GİBİ ifa edilmezse borçlu, alacaklının bundan doğan zararını gidermekle yükümlüdür. İSPAT YÜKÜ TERSİNE DÖNMÜŞTÜR: borçlu ancak kendisine HİÇBİR KUSURUN YÜKLENEMEYECEĞİNİ İSPAT ederse sorumluluktan kurtulur — yani kusur karinesi borçlu aleyhinedir. Bu, haksız fiilden (TBK m.49) farkıdır: haksız fiilde kusuru zarar gören ispatlar, sözleşmeye aykırılıkta kusursuzluğu borçlu ispatlar. Zamanaşımı da farklıdır: sözleşmeden doğan alacak kural olarak on yıllık (TBK m.146) veya TBK m.147''deki beş yıllık sürelere tabidir; haksız fiilde ise TBK m.72 (öğrenmeden iki, her hâlde on yıl) uygulanır.')

on conflict (id) do update set triggers = excluded.triggers, body = excluded.body;
