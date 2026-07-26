// Yerleşik İçtihat Özetleri — anahtarsız (runtime AI yok) çözüm.
//
// Bu özetler, künyesi verilen GERÇEK Yargıtay kararlarının tam metni okunarak
// bir avukat titizliğiyle elle çıkarılmıştır. Her özet dört bölümden oluşur:
// UYUŞMAZLIK (olay + talep), DEĞERLENDİRME (Yargıtay'ın gerekçesi/ratio),
// SONUÇ (bozma/onama + neden) ve DAYANAK (ilgili mevzuat). "İlke" ise kararın
// yerleşik kuralının özüdür. Uygulama içinde "Kararın tam metnini aç" ile
// Bedesten (Adalet Bakanlığı) üzerinden orijinal metin doğrulanabilir.
//
// Not: Özetler bilgilendirme amaçlıdır; güncel mevzuat ve kararın bütünü
// teyit edilmelidir. Bazı kararlar mülga kanun dönemine ait olup, güncel
// karşılıkları dayanak bölümünde belirtilmiştir.

export interface IctihatDigest {
  /** Bedesten documentId — tam metni açmak için. */
  id: string;
  slug: string;
  /** Konu başlığı. */
  title: string;
  /** Kategori (Kira, İş, İcra, Miras…). */
  category: string;
  daire: string;
  esas: string;
  karar: string;
  tarih: string;
  /** Kararın operatif sonucu (Bozma/Onama…). */
  outcome: string;
  /** Tek-iki cümlelik yerleşik ilke (özün özü). */
  ilke: string;
  /** Uyuşmazlık: olay + talep + hukuki mesele. */
  uyusmazlik: string;
  /** Değerlendirme: Yargıtay'ın gerekçesi (ratio decidendi). */
  degerlendirme: string;
  /** Sonuç: bozma/onama ve nedeni. */
  sonuc: string;
  /** Dayanak: ilgili mevzuat maddeleri (isteğe bağlı). */
  dayanak?: string;
}

export const ICTIHAT_DIGESTS: IctihatDigest[] = [
  {
    id: '746004800',
    slug: 'kira-tespit-yenilenme',
    title: 'Tahliye davası sürerken kira artırımı sözleşmeyi yenilemez',
    category: 'Kira',
    daire: 'Yargıtay 13. Hukuk Dairesi',
    esas: '2011/16301',
    karar: '2012/356',
    tarih: '16.01.2012',
    outcome: 'Bozma',
    ilke: 'Kesinleşmiş tahliye kararı bulunan bir kira ilişkisinde, tahliye davası sürerken açılan kira tespiti/artırım davası tek başına yeni bir kira ilişkisi doğurmaz; kiracılığın tespiti istenemez.',
    uyusmazlik:
      'Kiracı, hakkında temerrüt nedeniyle verilip kesinleşen tahliye kararına rağmen, tahliye süreci devam ederken kiraya verenin kira bedelinin tespiti/artırımı davası açmasının kira sözleşmesini yenilediğini ileri sürerek kiracılığının tespitini istemiştir. Uyuşmazlık, tahliye davası sürerken açılan kira tespiti davasının yeni bir kira ilişkisi kurup kurmadığı noktasındadır.',
    degerlendirme:
      'Yargıtay, tahliye davası sürerken kira artırımının istenmesinin sözleşmenin yenilendiğini göstermeyeceğini belirtmiştir. Kesinleşmiş bir tahliye kararı varken, kira tespiti davası açılmış olması taraflar arasında eskisinden bağımsız yeni bir kira ilişkisi kurulduğu sonucunu doğurmaz.',
    sonuc:
      'Kesinleşmiş tahliye kararı karşısında kiracılığın tespiti davasının reddi gerekirken kabulü usul ve yasaya aykırı bulunarak karar bozulmuştur.',
    dayanak: 'Yerleşik içtihat',
  },
  {
    id: '159286600',
    slug: 'isyeri-ihtiyac-tahliye',
    title: 'İşyeri ihtiyacına dayalı tahliyenin koşulları',
    category: 'Kira',
    daire: 'Yargıtay 6. Hukuk Dairesi',
    esas: '2015/2565',
    karar: '2016/25',
    tarih: '17.01.2016',
    outcome: 'Bozma',
    ilke: 'İhtiyaç gerçek, samimi ve zorunlu olmalı; dava tarihinde var olup yargılama boyunca sürmelidir. İhtiyaçlı kirada ise ya tahliye tehdidi altında olmalı ya da kiralanan, yapılacak iş için en az eşdeğer/üstün nitelikte bulunmalıdır.',
    uyusmazlik:
      'Kiraya veren, işyeri ihtiyacı ile yeniden inşa ve imar nedeniyle kiralananın tahliyesini istemiş; mahkeme davayı kabul etmiştir. Uyuşmazlık, TBK m. 350-351 kapsamında ihtiyaç koşullarının gerçekleşip gerçekleşmediği ve gerekli araştırmanın yapılıp yapılmadığıdır.',
    degerlendirme:
      'İşyeri ihtiyacına dayalı tahliyede, ihtiyaçlının kirada olması hâlinde ya tahliye tehdidi altında bulunması ya da kiralananın yapılacak iş için en az eşdeğer/üstün nitelikte olması gerekir; eşdeğerlikte mülkiyet hakkına üstünlük tanınır. Tahliye tehdidi ileri sürülmedikçe resen dikkate alınmaz; ancak üstünlük/eşdeğerlik keşif ve uzman bilirkişi ile araştırılmalıdır. İhtiyaç gerçek, samimi ve zorunlu olmalı, dava tarihinde var olup yargılama boyunca devam etmelidir. Somut olayda yapılan işin basit tadilat olduğu, esaslı imar niteliği taşımadığı belirlenmiştir.',
    sonuc:
      'Yeniden inşa/imar koşulu gerçekleşmediği hâlde davanın kabulü ve ihtiyaca ilişkin delillerin toplanmaması bozmayı gerektirmiştir.',
    dayanak: 'TBK m. 350/1, m. 351',
  },
  {
    id: '213487700',
    slug: 'kidem-tazminati-sure',
    title: 'Kıdem tazminatına esas sürenin hesabı',
    category: 'İş Hukuku',
    daire: 'Yargıtay 7. Hukuk Dairesi',
    esas: '2015/38005',
    karar: '2016/3033',
    tarih: '14.02.2016',
    outcome: 'Bozma',
    ilke: 'Kıdem, işçinin fiilen işe başladığı tarih ile iş sözleşmesinin feshi arasındaki tüm hizmet süresi üzerinden gün gün hesaplanır; kısmi ay ve günler ihmal edilemez.',
    uyusmazlik:
      'İşçilik alacakları davasında, kıdem tazminatına esas alınacak hizmet süresi taraflar arasında uyuşmazlık konusudur. Somut olayda işçinin hizmet süresi 11 yıl 2 ay 20 gün tespit edilmiştir.',
    degerlendirme:
      'Kıdem tazminatına esas süre, iş sözleşmesinin imza tarihi değil işçinin fiilen çalışmaya başladığı tarihten feshe kadar geçen tüm hizmet süresidir. En az bir yıllık çalışma koşulu nispi emredici olup işçi lehine azaltılabilir; çıraklık süresi sayılmaz, deneme süresi kıdeme eklenir. Fesihte kıdem tazminatına hak kazanıldığında işyeri/işyerlerinde geçen tüm süreler üzerinden hesap yapılıp, avans niteliğindeki ödemeler yasal faiziyle mahsup edilir.',
    sonuc:
      'Hizmet süresi 11 yıl 2 ay 20 gün olduğu hâlde hesapta yalnız 11 yılın esas alınıp 2 ay 20 günün dışlanması hatalı bulunarak karar bozulmuştur.',
    dayanak: '1475 s. İş K. m. 14; 4857 s. İş K. m. 120',
  },
  {
    id: '648402900',
    slug: 'ise-iade-ihbar-tazminat',
    title: 'İşe başlatmama hâlinde fesih tarihi ve ihbar tazminatı',
    category: 'İş Hukuku',
    daire: 'Yargıtay 22. Hukuk Dairesi',
    esas: '2017/29301',
    karar: '2020/7401',
    tarih: '21.06.2020',
    outcome: 'Bozma',
    ilke: 'İşe iade davası sonucu işçi işe başlatılmazsa, işe başlatmama tarihi fesih tarihidir; ihbar tazminatı bu tarihe göre hesaplanır. Geçersiz sayılan fesihte peşin ödenen ihbar öneli ücreti, işe başlatmama tazminatı ve boşta geçen süre ücretinden mahsup edilir.',
    uyusmazlik:
      'İşe iade sürecinin ardından açılan itirazın iptali davasında, işçinin ihbar tazminatına hak kazanıp kazanmadığı ve alacağın likit olup olmadığı uyuşmazlık konusudur.',
    degerlendirme:
      'İşe iade davasıyla feshin geçersizliği tespit edilip işçi işe başlatılmadığında, işe başlatmama tarihi fesih tarihi sayılır ve ihbar tazminatı bu tarihe göre hesaplanır; geçersiz feshte tanınan önceki ihbar önelinin değeri kalmaz. Geçersiz fesih nedeniyle peşin ödenen ihbar öneli ücreti, İş K. m. 21/4 uyarınca işe başlatmama tazminatı ve boşta geçen süre ücretinden mahsup edilir. Ayrıca yargılamayı gerektiren, likit olmayan alacakta icra inkâr tazminatına hükmedilemez.',
    sonuc:
      'Boşta geçen süre ücretinin likit kabul edilerek icra inkâr tazminatına hükmedilmesi hatalı bulunarak karar bozulmuştur.',
    dayanak: '4857 s. İş K. m. 21',
  },
  {
    id: '799570600',
    slug: 'zina-sure-islah',
    title: 'Zinaya dayalı boşanmada hak düşürücü süre ve ıslah',
    category: 'Aile Hukuku',
    daire: 'Yargıtay 2. Hukuk Dairesi',
    esas: '2022/3225',
    karar: '2022/6752',
    tarih: '04.07.2022',
    outcome: 'Bozma',
    ilke: 'Zinada (TMK m. 161) altı aylık hak düşürücü süre, davanın açıldığı tarihe göre değerlendirilir; zina vakıası ıslahla da ileri sürülebilir (HMK m. 177/1) ve süresindeyse esası incelenmelidir.',
    uyusmazlik:
      'Kadın, evlilik birliğinin sarsılması nedenine dayalı davasını ıslah ederek zina (TMK m. 161) sebebini de eklemiş; bölge adliye mahkemesi zina davasını hak düşürücü sürenin geçtiği gerekçesiyle esasını incelemeden reddetmiştir. Uyuşmazlık, altı aylık sürenin dolup dolmadığı ve ıslahla getirilen zina iddiasının incelenip incelenemeyeceğidir.',
    degerlendirme:
      'Zinada altı aylık hak düşürücü süre öğrenmeden itibaren işler ve davanın açıldığı tarihe göre değerlendirilir. Somut olayda suç tarihi (21.06.2016) ile dava tarihi (05.10.2019) arasında sürenin dolmadığı; ayrıca HMK m. 177/1 uyarınca ıslahın tahkikatın sonuna kadar yapılabileceği belirtilmiştir.',
    sonuc:
      'Bölge adliye mahkemesinin, süresinde açılan zina davasının esasını incelemeden karar vermesi doğru görülmeyerek hüküm bozulmuştur.',
    dayanak: 'TMK m. 161; HMK m. 177/1',
  },
  {
    id: '1012393300',
    slug: 'trafik-is-goremezlik',
    title: 'Trafik kazası tazminatında iş göremezlik oranının saptanması',
    category: 'Tazminat',
    daire: 'Yargıtay 4. Hukuk Dairesi',
    esas: '2009/7822',
    karar: '2010/3974',
    tarih: '05.04.2010',
    outcome: 'Bozma',
    ilke: 'Tazminat, yalnızca dava konusu kazaya bağlı sürekli iş göremezlik oranı üzerinden hesaplanır; davacının önceki maluliyetinin etkisi ayrıştırılarak Adli Tıp/üniversite hastanesi raporuyla belirlenmelidir.',
    uyusmazlik:
      'Davacı, trafik kazasında yaralanması nedeniyle maddi-manevi tazminat istemiş; mahkeme %15,2 sürekli iş göremezlik ve sürücünün %75 kusuru üzerinden tazminata hükmetmiştir. Ancak davacının 1980 yılında geçirdiği iş kazasına bağlı %43 oranında önceki maluliyeti bulunmaktadır.',
    degerlendirme:
      'Davacının önceden geçirdiği iş kazasına bağlı sürekli iş göremezliği bulunduğundan, trafik kazasına bağlı iş göremezlik oranı belirlenirken önceki maluliyetin etkisi konusunda kuşku doğmuştur. Bu nedenle davacı üniversite hastanesine sevk edilerek, tazminata esas iş göremezlik oranının yalnızca dava konusu kazaya bağlı kısmının ayrıştırılıp saptanması gerekir.',
    sonuc:
      'Eksik inceleme ve araştırmayla kurulan tazminat hükmü bozulmuştur.',
    dayanak: 'Haksız fiil sorumluluğu (genel hükümler)',
  },
  {
    id: '449442900',
    slug: 'kambiyo-imzaya-itiraz',
    title: 'Kambiyo takibinde imzaya itiraz ve resen inceleme sınırı',
    category: 'İcra-İflas',
    daire: 'Yargıtay 12. Hukuk Dairesi',
    esas: '2018/11595',
    karar: '2018/7747',
    tarih: '10.09.2018',
    outcome: 'Bozma',
    ilke: 'Borçlu yalnız imzaya itiraz etmişse, ileri sürülmeyen teminat/borç itirazı mahkemece resen incelenemez. İİK m. 170/a resen inceleme, senedin kambiyo vasfı taşımaması veya takip hakkının bulunmaması ile sınırlıdır.',
    uyusmazlik:
      'Bonoya dayalı kambiyo takibinde borçlular imzaya itiraz etmiş; mahkeme, bilirkişi raporunda senette teminat ibaresi ve tahrifat bulunduğu belirtildiğinden İİK m. 170/a uyarınca takibi iptal etmiştir. Uyuşmazlık, imzaya itirazla sınırlı takipte teminat iddiasının resen incelenip incelenemeyeceğidir.',
    degerlendirme:
      'İmzaya itiraz dışındaki tüm itirazlar (ödeme, teminat senedi, tahrifat vb.) borca itiraz niteliğindedir. İcra mahkemesi İİK m. 170/a uyarınca yalnızca senedin kambiyo vasfı taşımadığını veya alacaklının kambiyo yoluyla takip hakkı bulunmadığını resen dikkate alabilir. Borçlular yalnız imzaya itiraz etmişken, taraflarca ileri sürülmeyen teminat iddiasına dayanılarak takibin iptali doğru değildir; imzaya itiraz konusunda gerekirse yeniden rapor alınarak inceleme yapılmalıdır.',
    sonuc:
      'İmzaya itiraz incelenmeden, resen teminat iddiasına dayanılarak takibin iptali isabetsiz bulunarak karar bozulmuştur.',
    dayanak: 'İİK m. 170/a',
  },
  {
    id: '1144156300',
    slug: 'tenkis-olume-bagli-saglararasi',
    title: 'Tenkiste ölüme bağlı ve sağlararası tasarruf ayrımı',
    category: 'Miras',
    daire: 'Yargıtay 7. Hukuk Dairesi',
    esas: '2024/2492',
    karar: '2025/1249',
    tarih: '03.03.2025',
    outcome: 'Bozma',
    ilke: 'Mirasbırakanın tasarruf nisabını aşan tüm ölüme bağlı tasarrufları tenkise tâbidir; sağlararası tasarruflar ise ancak TMK m. 565’te sayılan hâllerde tenkis edilebilir. Satış (sağlararası) yoluyla devredilen taşınmaz, dava edilen vasiyetnamenin (ölüme bağlı tasarrufun) konusu değildir.',
    uyusmazlik:
      'Saklı paylı mirasçılar, miras bırakanın vasiyetnamesinin iptalini, olmazsa tenkisini istemiştir. Mahkeme, tenkise konu ettiği taşınmazlar üzerinden davacılar lehine tenkis bedeline hükmetmiştir. Uyuşmazlık, bu taşınmazların dava edilen ölüme bağlı tasarrufa (vasiyetnameye) konu olup olmadığıdır.',
    degerlendirme:
      'Tenkis davasının konusunu mirasbırakanın saklı payları ihlal eden tasarrufları oluşturur. Tasarruf nisabını aşan tüm ölüme bağlı tasarruflar tenkise tâbi iken, sağlararası tasarruflar yalnızca TMK m. 565’te sayılan gruplardan birine girdiğinde tenkis edilebilir. Somut olayda tenkise konu edilen taşınmazlar, muris tarafından ölümünden önce satış (sağlararası tasarruf) yoluyla devredilmiş olup dava edilen vasiyetnameye konu değildir.',
    sonuc:
      'Sağlararası devredilen ve vasiyetnameye konu olmayan taşınmazlar yönünden davanın reddi gerekirken kabulü doğru görülmeyerek karar bozulmuştur.',
    dayanak: 'TMK m. 560, m. 565',
  },
  {
    id: '149307600',
    slug: 'fazla-mesai-hakkaniyet',
    title: 'Fazla mesai alacağında ispat ve hakkaniyet indirimi',
    category: 'İş Hukuku',
    daire: 'Yargıtay 7. Hukuk Dairesi',
    esas: '2014/15810',
    karar: '2015/1321',
    tarih: '10.02.2015',
    outcome: 'Bozma',
    ilke: 'Fazla çalışmanın ispat yükü işçide, ödendiğinin ispatı işverendedir. Fazla çalışma tanık beyanıyla ispatlanıp uzun süre için hesaplanır ve yüksek çıkarsa hakkaniyet (takdiri) indirimi yapılır; yazılı belge/işveren kayıtlarına dayanıyorsa indirim yapılmaz.',
    uyusmazlik:
      'İşçilik alacakları davasında hem hizmet süresi hem de fazla mesai alacağı tartışmalıdır. Fazla mesai tanık beyanlarına dayandırılmış, mahkeme bilirkişi hesabından %50 hakkaniyet indirimi yapmıştır.',
    degerlendirme:
      'Fazla çalışma yapıldığının ispat yükü işçide, ödendiğinin ispat yükü işverendedir. Fazla çalışma ve hafta tatili ücreti uzun süre için hesaplanıp yüksek çıktığında Yargıtay’ın istikrarlı uygulamasına göre hakkaniyet indirimi yapılır; ancak kayıt/yazılı belgeye dayanıyorsa indirim uygulanmaz. Tanık beyanıyla saptanan fazla mesaide, aynı beyanlardaki "ödendi" ifadelerinin göz ardı edilerek çelişki yaratılması da doğru değildir. Ayrıca kime ait olduğu belirlenemeyen dönemin hizmet süresinden dışlanması yerine SGK ve ticaret sicil kayıtlarından araştırılması gerekir.',
    sonuc:
      'Hizmet süresinin eksik araştırılması ve fazla mesai değerlendirmesindeki çelişki nedeniyle karar bozulmuştur.',
    dayanak: 'İş K.; yerleşik içtihat',
  },
  {
    id: '648055700',
    slug: 'tahliye-taahhudu',
    title: 'Yazılı tahliye taahhüdünün geçerliliği ve süresi',
    category: 'Kira',
    daire: 'Yargıtay 8. Hukuk Dairesi',
    esas: '2019/6129',
    karar: '2019/11471',
    tarih: '17.12.2019',
    outcome: 'Onama',
    ilke: 'Kira ilişkisi kurulduktan sonra (kiralananda otururken) verilen yazılı tahliye taahhüdü geçerlidir; taahhüt edilen tarihi izleyen bir aylık yasal süre içinde icra takibi/dava açılmalıdır.',
    uyusmazlik:
      'Kiraya veren, kiracının noterde düzenlediği yazılı tahliye taahhüdüne dayanarak icra takibi başlatmış; kiracı taahhüdün tedbir amaçlı ve baskı altında verildiğini savunmuştur. Uyuşmazlık, taahhüdün geçerliliği ve takibin süresinde başlatılıp başlatılmadığıdır.',
    degerlendirme:
      'Yargıtay, tahliye taahhüdünün kira sözleşmesinin kurulmasından sonra (kiralananda otururken) düzenlendiğini ve taahhüt edilen tarihi izleyen bir aylık yasal süre içinde takip başlatıldığını saptamıştır. Bu koşullar gerçekleştiğinden taahhüt geçerli kabul edilmiştir.',
    sonuc:
      'Önceki bozma kararı kaldırılarak yerel mahkemenin tahliye kararının onanmasına karar verilmiştir.',
    dayanak: 'TBK m. 352/1',
  },
  {
    id: '1063752400',
    slug: 'iki-hakli-ihtar',
    title: 'İki haklı ihtar nedeniyle tahliyenin koşulları',
    category: 'Kira',
    daire: 'Yargıtay 6. Hukuk Dairesi',
    esas: '2010/7552',
    karar: '2010/11793',
    tarih: '27.10.2010',
    outcome: 'Bozma',
    ilke: 'Kiracı bir kira yılında iki haklı ihtara sebebiyet vermeli ve dava kira yılının bitiminden itibaren bir ay içinde açılmalıdır. Muacceliyet şartı varsa muaccel kiralar tek ihtarla istenmeli; bölünüp iki ayrı ihtara konu edilerek iki haklı ihtar yaratılamaz.',
    uyusmazlik:
      'Kiraya veren iki haklı ihtar nedeniyle tahliye istemiş; sözleşmede bir ay kiranın ödenmemesi hâlinde tüm kiraların muaccel olacağı kararlaştırılmıştır. Kiraya veren, ilk ihtarla tüm muaccel kiraları isteyebilecekken kiraları bölerek ikinci ihtara konu etmiştir.',
    degerlendirme:
      'İki haklı ihtar nedeniyle tahliye için kiracının bir kira yılı içinde iki haklı ihtara sebebiyet vermesi ve davanın kira yılı bitiminden itibaren bir ay içinde açılması gerekir; ihtardan sonra yapılan ödeme iki haklı ihtarı engellemez. Muacceliyet şartı bulunduğunda muaccel hâle gelen kiralar tek ihtarla istenmeli, bölünüp ayrı ihtarlarla iki haklı ihtara konu edilemez. Ayrıca iki haklı ihtar ile temerrüt nedeniyle tahliye ayrı davalardır; talep aşılarak dayanılmayan sebeple tahliyeye karar verilemez.',
    sonuc:
      'İki haklı ihtar koşulları oluşmadığı hâlde, üstelik talep aşılarak temerrüt nedeniyle tahliyeye hükmedilmesi doğru görülmeyerek karar bozulmuştur.',
    dayanak: '6570 s. Kanun m. 7/e (bkz. TBK m. 352/2)',
  },
  {
    id: '139514100',
    slug: 'ecrimisil-haksiz-isgal',
    title: 'Ecrimisil (haksız işgal tazminatı) esasları',
    category: 'Eşya Hukuku',
    daire: 'Yargıtay 1. Hukuk Dairesi',
    esas: '2014/21540',
    karar: '2015/5032',
    tarih: '07.04.2015',
    outcome: 'Bozma',
    ilke: 'Ecrimisil haksız fiil niteliğinde, en az kira geliri karşılığı bir zarardır; kayıttan ve mülkiyetten kaynaklanan hakkı olmadan taşınmazı işgal eden, malike/paydaşa payı oranında ecrimisil ödemekle yükümlüdür.',
    uyusmazlik:
      'Davacılar, komşu parsellere yapılan taşkın yapılar nedeniyle elatmanın önlenmesi, yıkım ve ecrimisil istemiştir. Yargılama sırasında taşkın yapılar yıkıldığından, uyuşmazlık ecrimisil (haksız işgal tazminatı) talebinde toplanmıştır.',
    degerlendirme:
      'Ecrimisil, haksız işgal nedeniyle nitelendirilen özel bir zarar giderim biçimi olup en az kira geliri karşılığı zarardır ve haksız fiil niteliğindedir (YHGK 25.02.2004). Kayıttan ve mülkiyetten kaynaklanan hakkı olmadan başkasının taşınmazına taşkın yapı yaparak kullanan kişinin bu kullanımı haksız işgaldir; haksız işgalci, malike ecrimisil ödemekle yükümlüdür.',
    sonuc:
      'Haksız işgalcinin, davacıların payı oranında ecrimisil ödemesine hükmedilmesi gerekirken istemin reddi bozmayı gerektirmiştir.',
    dayanak: 'Haksız fiil; TMK zilyetlik hükümleri',
  },
  {
    id: '350416900',
    slug: 'nafaka-artirim',
    title: 'Nafaka artırımında ölçü: değişen durum ve ÜFE',
    category: 'Aile Hukuku',
    daire: 'Yargıtay 3. Hukuk Dairesi',
    esas: '2016/22622',
    karar: '2017/9770',
    tarih: '11.06.2017',
    outcome: 'Bozma',
    ilke: 'Nafaka artırımı, tarafların değişen sosyal-ekonomik durumu ve TÜİK ÜFE (TEFE) oranı esas alınarak, önceki nafaka takdirindeki dengeyi koruyacak biçimde belirlenir; olağanüstü değişiklik şart değildir.',
    uyusmazlik:
      'Boşanma sonrası kendisi için yoksulluk, çocuklar için iştirak nafakasına hükmedilen davacı, aradan geçen süre ve değişen ekonomik koşullar nedeniyle nafakaların artırılmasını istemiş; mahkeme yoksulluk nafakası artırımını reddetmiştir.',
    degerlendirme:
      'Nafaka artırımında, tarafların gerçekleşen sosyal ve ekonomik durumları, nafakanın niteliği ve TÜİK’in yayımladığı ÜFE (TEFE) artış oranı gözetilerek, önceki takdirle oluşan dengeyi koruyucu oranda artış yapılmalıdır. Olağanüstü bir değişiklik aranmaz; tarafların gelir durumundaki değişim ve ekonomik göstergeler dikkate alınır.',
    sonuc:
      'Bu ölçütler değerlendirilmeden yoksulluk nafakası artırım talebinin reddi doğru görülmeyerek karar bozulmuştur.',
    dayanak: 'TMK m. 176/4 (yoksulluk), m. 331 (iştirak)',
  },
  {
    id: '689138600',
    slug: 'velayet-ustun-yarar',
    title: 'Velayette çocuğun üstün yararı ve idrak çağındaki görüşü',
    category: 'Aile Hukuku',
    daire: 'Yargıtay 2. Hukuk Dairesi',
    esas: '2021/4855',
    karar: '2021/6032',
    tarih: '13.09.2021',
    outcome: 'Bozma',
    ilke: 'Velayet düzenlemesinde temel ilke çocuğun üstün yararıdır; idrak çağındaki çocuğun görüşü alınır ve aksini gerektiren somut bir delil yoksa bu görüşe uyulur. Velayet kamu düzenine ilişkin olup resen araştırılır.',
    uyusmazlik:
      'İlk derece mahkemesi, idrak çağındaki çocuğun beyanını esas alarak velayeti babaya vermiş; bölge adliye mahkemesi sosyal inceleme raporuna dayanarak velayeti anneye bırakmıştır. Uyuşmazlık, çocuğun beyanının aksine karar verilip verilemeyeceğidir.',
    degerlendirme:
      'Velayet düzenlenirken temel ilke çocuğun üstün yararıdır; ana-babanın kusuru ve konumu bu yararı etkilemediği ölçüde dikkate alınır. İdrak çağındaki çocuğun görüşü alınır ve aksini gerektiren somut delil bulunmadıkça esas alınır. Somut olayda her iki ebeveynin de olumsuz davranışı bulunmadığı, çocuğun babasıyla yaşadığı, düzeninin oturduğu ve babasıyla kalmak istediğini beyan ettiği saptanmıştır.',
    sonuc:
      'Çocuğun beyanının aksine velayetin anneye verilmesi doğru görülmeyerek karar bozulmuştur.',
    dayanak: 'TMK m. 182, m. 336; BM Çocuk Hakları Sözleşmesi m. 12',
  },
  {
    id: '295586500',
    slug: 'icra-inkar-likit',
    title: 'İcra inkâr tazminatı için alacağın likit olması şartı',
    category: 'İcra-İflas',
    daire: 'Yargıtay 22. Hukuk Dairesi',
    esas: '2015/15308',
    karar: '2017/21',
    tarih: '15.01.2017',
    outcome: 'Bozma',
    ilke: 'İtirazın iptali davasında icra inkâr tazminatına hükmedilebilmesi için alacağın likit (belirli/belirlenebilir) olması gerekir; alacak tartışmalı ve yargılamayı gerektiriyorsa likit sayılmaz.',
    uyusmazlik:
      'Kıdem tazminatı alacağı için başlatılan takibe itiraz üzerine açılan itirazın iptali davasında, mahkeme alacağı likit sayarak %20 icra inkâr tazminatına hükmetmiştir. Uyuşmazlık, alacağın likit olup olmadığıdır.',
    degerlendirme:
      'İcra inkâr tazminatına hükmedilebilmesi için, borçlunun haksızlığına karar verilmesi ve alacaklının talebi yanında alacağın likit olması gerekir. Likit alacak, miktarı belli/sabit olan ya da borçlunun bütün unsurları bilerek kendi borcunu tespit edebildiği alacaktır; hak tartışmalı ve yargılamayı gerektiriyorsa likitlikten söz edilemez. İşlemiş faiz yönünden ise icra inkâr tazminatına hükmedilemez.',
    sonuc:
      'Kıdem tazminatına hak kazanılıp kazanılmadığı ihtilaflı, alacak likit olmadığından icra inkâr tazminatına hükmedilmesi hatalı bulunarak karar bozulmuştur.',
    dayanak: 'İİK m. 67',
  },
  {
    id: '978820000',
    slug: 'ayipli-mal-secimlik',
    title: 'Ayıplı malda tüketicinin seçimlik hakları ve müteselsil sorumluluk',
    category: 'Tüketici',
    daire: 'Yargıtay 3. Hukuk Dairesi',
    esas: '2023/825',
    karar: '2023/2637',
    tarih: '10.10.2023',
    outcome: 'Onama',
    ilke: 'Ayıplı malda tüketici; ücretsiz onarım, ayıpsız misli ile değişim, bedel iadesi veya ayıp oranında indirim seçimlik haklarından birini kullanabilir. Bu haklar üretici/ithalatçıya karşı da ileri sürülebilir; satıcı, üretici ve ithalatçı müteselsilen sorumludur.',
    uyusmazlik:
      'Tüketici, satın aldığı sıfır aracın ilk gün arızalandığını ve yazılım güncellemesine rağmen giderilmediğini ileri sürerek ayıpsız misli ile değişim ve manevi tazminat istemiştir. Uyuşmazlık, gizli ayıp bulunup bulunmadığı ve değişim hakkının koşullarıdır.',
    degerlendirme:
      'Tüketici, ayıplı malda ücretsiz onarım, ayıpsız misli ile değişim, bedel iadesi veya indirim seçimlik haklarından dilediğini kullanabilir; satıcı bu talebi yerine getirmekle yükümlüdür. Ücretsiz onarım ve misli ile değişim hakları üretici/ithalatçıya karşı da kullanılabilir ve satıcı-üretici-ithalatçı müteselsilen sorumludur. Bilirkişi raporuyla ayıpların gizli olduğu ve raporun hükme elverişli bulunduğu saptanmıştır.',
    sonuc:
      'Gizli ayıp bilirkişiyle saptanan araçta, ayıpsız misli ile değişime ilişkin karar usul ve yasaya uygun bulunarak onanmıştır.',
    dayanak: '6502 s. TKHK m. 11',
  },
  {
    id: '78324800',
    slug: 'muris-muvazaasi',
    title: 'Muris muvazaası: mirastan mal kaçırma amaçlı temlik',
    category: 'Miras',
    daire: 'Yargıtay 1. Hukuk Dairesi',
    esas: '2008/335',
    karar: '2008/3208',
    tarih: '12.03.2008',
    outcome: 'Bozma',
    ilke: 'Mirasbırakanın, mirasçılardan mal kaçırmak amacıyla gerçekte bağışladığı taşınmazı satış gibi göstererek yaptığı temlik muvazaalıdır; mirasçılar payları oranında tapu iptali ve tescil isteyebilir.',
    uyusmazlik:
      'Davacılar, miras bırakanın saklı paylarını bertaraf etmek ve mal kaçırmak amacıyla taşınmazlarını (üçüncü kişiler aracı kılınarak) davalıya devrettiğini ileri sürerek tapu iptali ve tescil, olmazsa tenkis istemiştir. Uyuşmazlık, temliklerin muris muvazaası nedeniyle geçersiz olup olmadığıdır.',
    degerlendirme:
      'Mirasbırakanın, saklı paylı mirasçılardan mal kaçırma amacıyla gerçekte bağış olan taşınmaz devrini satış gibi göstererek (gerektiğinde üçüncü kişiler aracı kılınarak) yaptığı temlikler muris muvazaası nedeniyle geçersizdir. Bu durumda mirasçılar, miras payları oranında tapu iptali ve tescil isteyebilir. Muvazaanın kabulü ilke olarak doğrudur; ancak iptal ve tescil, miras bırakanın taşınmazdaki gerçek payı (7/8) esas alınarak yapılmalıdır.',
    sonuc:
      'Taşınmazın tamamı murise aitmiş gibi hüküm kurulması doğru görülmeyerek karar bozulmuştur.',
    dayanak: 'TBK m. 19; 01.04.1974 t. 1/2 İçtihadı Birleştirme Kararı',
  },
  {
    id: '16793300',
    slug: 'bono-zamanasimi',
    title: 'Bonoda üç yıllık zamanaşımı',
    category: 'İcra-İflas',
    daire: 'Yargıtay 12. Hukuk Dairesi',
    esas: '2008/25557',
    karar: '2009/5658',
    tarih: '16.03.2009',
    outcome: 'Bozma',
    ilke: 'Bonoda (kambiyo senedi) zamanaşımı vade tarihinden itibaren üç yıldır; zamanaşımına uğramış bonoyla genel haciz yoluyla takip yapılması dahi bu üç yıllık süreyi bertaraf etmez.',
    uyusmazlik:
      'Vade tarihi 31.12.2004 olan bonoya dayalı takip 22.05.2008’de başlatılmış; borçlu icra dairesine zamanaşımı itirazında bulunmuştur. Uyuşmazlık, genel haciz yoluyla takipte bono için üç yıllık kambiyo zamanaşımının uygulanıp uygulanmayacağıdır.',
    degerlendirme:
      'Takip dayanağı bono kambiyo senedi niteliğinde olup vade tarihinden itibaren üç yıllık zamanaşımına tâbidir. Alacaklının bonoya dayanarak genel haciz yoluyla takip yapması, bonolarda da uygulanan üç yıllık zamanaşımını ortadan kaldırmaz. Borçlu itirazında zamanaşımını ileri sürdüğünden, itirazın kaldırılması reddedilmelidir.',
    sonuc:
      'Üç yıllık zamanaşımı dolduktan sonra başlatılan takipte itirazın kaldırılmasına karar verilmesi isabetsiz bulunarak karar bozulmuştur.',
    dayanak: 'Mülga 6762 s. TTK m. 661, 688, 690 (bkz. 6102 s. TTK m. 749)',
  },
  {
    id: '184196200',
    slug: 'manevi-tazminat-takdiri',
    title: 'Manevi tazminatın takdirinde ölçütler',
    category: 'Tazminat',
    daire: 'Yargıtay 13. Hukuk Dairesi',
    esas: '2014/12913',
    karar: '2015/8804',
    tarih: '18.03.2015',
    outcome: 'Bozma',
    ilke: 'Manevi tazminat; tarafların sosyal-ekonomik durumu, kusur, elem ve ızdırabın derecesi ile olayın vehameti gözetilerek hak ve nesafet (TMK m. 4) ilkesiyle takdir edilir; manevi tatmine yetecek kadar olmalı, ne zenginleşme aracı ne de yok denecek kadar az olmalıdır.',
    uyusmazlik:
      'Davacı, satın aldığı araçta kaza sırasında hava yastıklarının açılmaması nedeniyle yüzünde sabit iz kalacak şekilde yaralandığını ileri sürerek manevi tazminat istemiş; mahkeme 7.500 TL’ye hükmetmiştir. Uyuşmazlık, takdir edilen manevi tazminatın yeterli olup olmadığıdır.',
    degerlendirme:
      '22.06.1966 tarihli 7/7 sayılı İçtihadı Birleştirme Kararı ve TMK m. 4 uyarınca hâkim, manevi tazminatı belirlerken tarafların sosyal-ekonomik durumunu, kusuru, olayın vehametini ve mağdurdaki elem-ızdırabın derecesini gözetir. Takdir edilecek tazminat, zarar görende manevi tatmin sağlamaya yetecek kadar olmalı; malvarlığı zararının giderilmesi amaçlanmadığından zenginleşme aracına dönüşmemeli, ancak yok denecek kadar da az olmamalıdır.',
    sonuc:
      'Somut olayda hükmedilen manevi tazminatın az olduğu belirtilerek, davacı yararına karar bozulmuştur.',
    dayanak: 'TMK m. 4; 22.06.1966 t. 7/7 İçtihadı Birleştirme Kararı',
  },
  {
    id: '645163700',
    slug: 'isci-ucret-hakli-fesih',
    title: 'Ücretin ödenmemesi işçiye haklı fesih hakkı verir',
    category: 'İş Hukuku',
    daire: 'Yargıtay 9. Hukuk Dairesi',
    esas: '2021/1432',
    karar: '2021/5322',
    tarih: '01.03.2021',
    outcome: 'Bozma',
    ilke: 'İşçinin geniş anlamda ücretinin (fazla çalışma, hafta tatili, ikramiye dâhil) ödenmemesi İş K. m. 24/II-e uyarınca haklı fesih sebebidir; işçi bu hâlde kıdem tazminatına hak kazanır. Baskıyla imzalatılan "istifa" dilekçesi haklı feshi ortadan kaldırmaz.',
    uyusmazlik:
      'İşçi, ücretlerinin ve fazla çalışma alacağının ödenmemesi nedeniyle iş sözleşmesini feshettiğini belirterek kıdem tazminatı istemiş; işveren istifa suretiyle ayrıldığını savunmuştur. Uyuşmazlık, feshin haklı nedenle yapılıp yapılmadığıdır.',
    degerlendirme:
      'İş hukuku uygulamasında "istifa", işçinin sözleşmeyi haklı sebep olmaksızın feshi anlamına gelir; ancak gerçekte ödenmeyen ücret nedeniyle yapılan fesih haklı fesihtir. İş Kanunu m. 24/II-e uyarınca ücretin kanuna/sözleşmeye uygun hesaplanmaması veya ödenmemesi haklı fesih sebebidir; buradaki ücret, fazla çalışma-hafta tatili-ikramiye gibi tüm alacakları kapsayan geniş anlamda ücrettir. Somut olayda fazla çalışma ücretinin ödenmediği sabittir.',
    sonuc:
      'İşçinin feshi haklı sayılıp kıdem tazminatına hükmedilmesi gerekirken talebin reddi doğru görülmeyerek karar bozulmuştur.',
    dayanak: '4857 s. İş K. m. 24/II-e',
  },
];

function foldTr(s: string): string {
  return s.toLocaleLowerCase('tr').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
}

// Çok geçen, ayırt edici olmayan kelimeler — eşleşmede sayılmaz.
const STOP = new Set([
  'dava', 'davası', 'karar', 'kararı', 'mahkeme', 'mahkemesi', 'hüküm', 'hukuk', 'hukuku',
  'temyiz', 'madde', 'yargıtay', 'dairesi', 'kanun', 'kanunu', 'sayılı', 'taraf', 'taraflar',
  'nedeniyle', 'ilişkin', 'için', 'olan', 'gereken', 'sözleşme', 'sözleşmesi',
]);

/**
 * Arama sorgusuyla eşleşen konu özetlerini bulur — sonuçların EN ÜSTÜNDE
 * "özetli" olarak gösterilir. Başlık + kategori + ilke + uyuşmazlık +
 * değerlendirme metninde, sorgunun 3+ harfli (stop-word olmayan) kelimelerini
 * arar; en çok eşleşen önce gelir, en fazla 3 özet döner.
 */
/** Tam Türkçe sadeleştirme: ç/ş/ğ/ı/ö/ü dâhil ASCII'ye indir (token ayırmak için). */
function foldFull(s: string): string {
  return foldTr(s)
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

const STOP_F = new Set([...STOP].map(foldFull));

/** Metni tam-sadeleştirip harf/rakam dışına göre KELİMELERE böler. */
function tokenizeTr(s: string): string[] {
  return foldFull(s).split(/[^a-z0-9]+/).filter(Boolean);
}

export function matchDigests(query: string): IctihatDigest[] {
  const qFull = foldFull(query).trim();
  if (qFull.length < 3) return [];
  const qWords = qFull.split(/\s+/).filter((w) => w.length >= 3 && !STOP_F.has(w));
  if (qWords.length === 0) return [];

  const scored = ICTIHAT_DIGESTS.map((d) => {
    // Başlık + kategori GÜÇLÜ sinyal; ilke/uyuşmazlık/değerlendirme zayıf sinyal.
    const strong = new Set(tokenizeTr(`${d.title} ${d.category}`));
    const all = new Set([...strong, ...tokenizeTr(`${d.ilke} ${d.uyusmazlik} ${d.degerlendirme}`)]);

    // Bir sorgu kelimesi, ancak TAM token olarak ya da EK almış hâliyle (önek,
    // gövde ≥ 4 harf) eşleşir. Böylece "arsa" ile "çıkarsa" gibi kelime ORTASI
    // rastlantısal eşleşmeler elenir (Burak geri bildirimi).
    const wordHit = (w: string): number => {
      if (all.has(w)) return strong.has(w) ? 2 : 1;
      if (w.length >= 4) {
        for (const tk of all) {
          if (tk.length >= 4 && (tk.startsWith(w) || w.startsWith(tk))) {
            return strong.has(tk) ? 2 : 1;
          }
        }
      }
      return 0;
    };

    let score = 0;
    let hits = 0;
    for (const w of qWords) {
      const s = wordHit(w);
      if (s > 0) {
        score += s;
        hits += 1;
      }
    }
    // Tam ifade (2+ kelimelik sorgu) bire bir geçiyorsa güçlü bonus.
    if (qWords.length >= 2 && foldFull(`${d.title} ${d.category} ${d.ilke} ${d.uyusmazlik} ${d.degerlendirme}`).includes(qFull)) {
      score += 4;
    }
    return { d, score, coverage: hits / qWords.length };
  });

  // ALAKA EŞİĞİ: alakasızsa HİÇ gösterme. Anlamlı bir eşleşme (score ≥ 2) VE
  // ya sorgu kelimelerinin en az yarısı tutmuş (coverage ≥ 0.5) ya da tam ifade
  // yakalanmış olmalı. Tek kelimelik sorguda kelime güçlü (başlık/kategori)
  // eşleşmeli. Böylece "yazık, uzaktan yakından ilgisi yok" özetler çıkmaz.
  const relevant = scored.filter((x) => x.score >= 2 && (x.coverage >= 0.5 || x.score >= 4));
  relevant.sort((a, b) => b.score - a.score || b.coverage - a.coverage);
  return relevant.slice(0, 3).map((x) => x.d);
}

/** Kategorilere göre grupla (görüntüleme için). */
export function digestsByCategory(): Array<{ category: string; items: IctihatDigest[] }> {
  const map = new Map<string, IctihatDigest[]>();
  for (const d of ICTIHAT_DIGESTS) {
    const arr = map.get(d.category) ?? [];
    arr.push(d);
    map.set(d.category, arr);
  }
  return Array.from(map, ([category, items]) => ({ category, items }));
}
