// Yerleşik İçtihat Özetleri — anahtarsız (runtime AI yok) çözüm.
//
// Bu özetler, aşağıda künyesi verilen GERÇEK Yargıtay kararlarının tam metni
// okunarak elle çıkarılmış sadık özetlerdir. Uygulama içinde "Kararın tam
// metnini aç" ile Bedesten (Adalet Bakanlığı) üzerinden orijinal metne
// ulaşılır; böylece özet + doğrulama bir arada sunulur.
//
// Not: Özetler bilgilendirme amaçlıdır; güncel mevzuat ve kararın bütünü
// teyit edilmelidir. Zamanla yeni kararlarla genişletilecektir.

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
  /** Kararın operatif sonucu. */
  outcome: string;
  /** Tek-iki cümlelik yerleşik ilke (özün özü). */
  ilke: string;
  /** Kararın sadık özeti. */
  ozet: string;
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
    ilke: 'Kesinleşmiş tahliye kararı varken, tahliye davası sürerken açılan kira tespiti/artırım davası yeni bir kira ilişkisi doğurmaz.',
    ozet:
      'Kiracı, tahliye davası devam ederken kira bedelinin artırılması/tespiti için dava açmasının kira sözleşmesini yenilediğini ve kiracılığının sürdüğünü ileri sürmüştür. Yargıtay, tahliye davası sürerken kira artırımının istenmesinin sözleşmenin yenilendiğini göstermeyeceğini belirtmiştir. Kesinleşmiş tahliye kararı karşısında kiracılığın tespiti davasının reddi gerekirken kabulü usul ve yasaya aykırı bulunarak karar bozulmuştur.',
  },
  {
    id: '159286600',
    slug: 'isyeri-ihtiyac-tahliye',
    title: 'İşyeri ihtiyacına dayalı tahliyede aranan koşullar',
    category: 'Kira',
    daire: 'Yargıtay 6. Hukuk Dairesi',
    esas: '2015/2565',
    karar: '2016/25',
    tarih: '17.01.2016',
    outcome: 'Bozma',
    ilke: 'İhtiyaç gerçek, samimi ve zorunlu olmalı; dava tarihinde var olup yargılama boyunca sürmelidir. Geçici ya da henüz doğmamış ihtiyaç tahliye sebebi olamaz.',
    ozet:
      'İşyeri ihtiyacına dayalı tahliyede (TBK m. 350/1 ve 351) ihtiyaçlı kirada ise, ihtiyacın kabulü için ya tahliye tehdidi altında bulunması ya da kiralananın yapılacak iş için en az eşdeğer/üstün nitelikte olması gerekir; eşdeğerlikte mülkiyet hakkına üstünlük tanınır. Tahliye tehdidi davacı ileri sürmedikçe resen dikkate alınmaz; ancak üstünlük/eşdeğerlik keşif ve uzman bilirkişi ile araştırılmalıdır. İhtiyacın gerçek, samimi ve zorunlu olduğu kanıtlanmalı, dava tarihinde var olup yargılama boyunca devam etmelidir. Deliller toplanmadan verilen kabul kararı bozulmuştur.',
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
    ilke: 'Kıdem, işçinin fiilen işe başladığı tarih ile fesih arasındaki tüm hizmet süresi üzerinden gün gün hesaplanır; kısmi ay ve günler ihmal edilemez.',
    ozet:
      'Kıdem tazminatına esas süre, iş sözleşmesinin imza tarihi değil, işçinin fiilen çalışmaya başladığı tarihten iş sözleşmesinin feshine kadar geçen tüm hizmet süresidir. En az bir yıllık çalışma koşulu nispi emredici olup işçi lehine azaltılabilir; çıraklıkta geçen süre sayılmaz, deneme süresi kıdeme eklenir. Somut olayda hizmet süresi 11 yıl 2 ay 20 gün tespit edildiği hâlde hesapta yalnız 11 yılın esas alınıp 2 ay 20 günün dışlanması hatalı bulunarak karar bozulmuştur.',
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
    ilke: 'İşe iade sonrası işçi işe başlatılmazsa, işe başlatmama tarihi fesih tarihidir; ihbar tazminatı bu tarihe göre hesaplanır.',
    ozet:
      'İşe iade davası sonucu feshin geçersizliği kesinleşip işçi işe başlatılmazsa, işe başlatmama tarihi fesih tarihi sayılır ve ihbar tazminatı bu tarihe göre ödenir; geçersiz feshte tanınan önceki ihbar önelinin bir değeri kalmaz. Geçersiz fesih nedeniyle peşin ödenen ihbar öneli ücreti, İş Kanunu m. 21/4 uyarınca işe başlatmama tazminatı ve boşta geçen süre ücretinden mahsup edilir. Ayrıca yargılamayı gerektiren, likit olmayan alacakta icra inkâr tazminatına hükmedilemeyeceği belirtilerek karar bozulmuştur.',
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
    ilke: 'Zinada (TMK m. 161) altı aylık hak düşürücü süre öğrenmeden işler; zina vakıası ıslahla da ileri sürülebilir ve süresindeyse esası incelenmelidir.',
    ozet:
      'Kadın, evlilik birliğinin sarsılması nedenine dayalı davasını ıslah ederek zina (TMK m. 161) sebebini de eklemiştir. Yargıtay, zinada altı aylık hak düşürücü sürenin öğrenmeden itibaren işlediğini; olayda suç tarihi ile dava tarihi arasında sürenin dolmadığını ve HMK m. 177/1 uyarınca ıslahın tahkikat sonuna kadar yapılabileceğini belirtmiştir. Bölge adliye mahkemesinin, süresinde açılan zina davasının esasını incelemeden karar vermesi doğru bulunmayarak hüküm bozulmuştur.',
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
    ilke: 'Tazminat, yalnızca dava konusu kazaya bağlı sürekli iş göremezlik oranı üzerinden hesaplanır; önceki maluliyetin etkisi ayrıştırılmalıdır.',
    ozet:
      'Davacının daha önce geçirdiği iş kazası nedeniyle sürekli iş göremezliği bulunduğundan, trafik kazasına bağlı iş göremezlik oranı belirlenirken önceki maluliyetin etkisi konusunda kuşku doğmuştur. Yargıtay, davacının üniversite hastanesine sevkiyle, dava konusu trafik kazasına bağlı sürekli iş göremezlik oranının önceki olaydan ayrıştırılarak saptanması gerektiğini belirtmiştir. Eksik inceleme ve araştırmayla kurulan tazminat hükmü bozulmuştur.',
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
    ilke: 'Borçlu yalnız imzaya itiraz etmişse, ileri sürülmeyen teminat/borç itirazı mahkemece resen incelenemez; İİK m. 170/a resen inceleme senedin kambiyo vasfı ve takip hakkıyla sınırlıdır.',
    ozet:
      'İcra mahkemesi, İİK m. 170/a uyarınca yalnızca takip dayanağı belgenin kambiyo senedi vasfı taşımadığını veya alacaklının kambiyo yoluyla takip hakkı bulunmadığını resen dikkate alabilir. Borçlular yalnız imzaya itiraz etmişken, taraflarca ileri sürülmeyen "teminat senedi" iddiasına dayanılarak takibin iptali doğru değildir. İmzaya itiraz konusunda gerekirse yeniden bilirkişi raporu alınarak inceleme yapılıp karar verilmesi gerektiğinden hüküm bozulmuştur.',
  },
  {
    id: '1144156300',
    slug: 'tenkis-sakli-pay',
    title: 'Saklı payı zedeleyen ölüme bağlı tasarrufların tenkisi',
    category: 'Miras',
    daire: 'Yargıtay 7. Hukuk Dairesi',
    esas: '2024/2492',
    karar: '2025/1249',
    tarih: '03.03.2025',
    outcome: 'Bozma',
    ilke: 'Tasarruf nisabını aşan ölüme bağlı tasarruflar saklı payı zedelediği ölçüde tenkise tâbidir (TMK m. 560); saklı paylı mirasçının tenkiste hukuki yararı vardır.',
    ozet:
      'Miras bırakanın vasiyetnamesiyle saklı payı zedelenen mirasçılar, öncelikle vasiyetnamenin iptalini, olmazsa tenkisini istemiştir. Yargıtay, tasarruf nisabını aşan tüm ölüme bağlı tasarrufların tenkise tâbi olduğunu ve saklı paylı mirasçının tenkiste hukuki yararının bulunduğunu (TMK m. 560; HGK 13.12.2023, 2022/1177 E. ile paralel) vurgulamıştır. Terekede mal bulunmadığı gerekçesiyle araştırma yapılmadan tenkis talebinin reddi doğru görülmeyerek karar bozulmuştur.',
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
    ilke: 'Fazla çalışma tanık beyanıyla ispatlanıp uzun süre için hesaplanır ve yüksek çıkarsa hakkaniyet (takdiri) indirimi yapılır; yazılı belge/işveren kayıtlarına dayanıyorsa indirim yapılmaz.',
    ozet:
      'Fazla çalışma yaptığını ispat yükü işçide, ödendiğini ispat yükü işverendedir. Fazla çalışma ve hafta tatili ücreti uzun bir süre için hesaplanıp miktar yüksek çıktığında Yargıtay’ın istikrarlı uygulamasına göre hakkaniyet indirimi yapılır; ancak fazla çalışma tanık yerine yazılı belgelere ve işveren kayıtlarına dayanıyorsa bu indirim uygulanmaz. Tanık beyanıyla saptanan fazla mesaide, aynı beyanlardaki "ödendi" ifadelerinin göz ardı edilerek çelişki yaratılması da doğru bulunmamıştır.',
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
    ilke: 'Kira ilişkisi devam ederken (kiralananda otururken) verilen yazılı tahliye taahhüdü geçerlidir; taahhüt edilen tarihi izleyen bir aylık yasal süre içinde takip/dava açılmalıdır.',
    ozet:
      'Kiracı, kira sözleşmesinin kurulmasından sonra ve kiralananda otururken düzenlediği yazılı tahliye taahhüdüyle taşınmazı belirli tarihte boşaltmayı taahhüt etmiştir. Yargıtay, taahhüdün sözleşmeden sonra düzenlendiğini ve taahhüt edilen tarihi izleyen bir aylık yasal süre içinde icra takibi başlatıldığını saptayarak taahhüdü geçerli kabul etmiş, önceki bozma kararını kaldırıp yerel mahkemenin tahliye kararını onamıştır.',
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
    ilke: 'Bir kira yılında iki haklı ihtar gerekir; dava kira yılının bitiminden itibaren bir ay içinde açılmalıdır. Muacceliyet şartı varsa muaccel kiralar tek ihtarla istenmeli, bölünüp iki ihtara konu edilemez.',
    ozet:
      'İki haklı ihtar nedeniyle tahliyede, kiracının bir kira yılı içinde iki haklı ihtara sebebiyet vermesi ve davanın kira yılı bitiminden itibaren bir ay içinde açılması gerekir; ihtardan sonra yapılan ödeme iki haklı ihtarı engellemez. Sözleşmede muacceliyet şartı varsa muaccel hale gelen kiralar tek ihtarla istenmeli, bölünüp ayrı ihtarlarla iki haklı ihtara konu edilemez. Ayrıca iki haklı ihtar ile temerrüt nedeniyle tahliye ayrı davalar olup, talep aşılarak dayanılmayan sebeple tahliye kararı verilemez.',
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
    ilke: 'Ecrimisil haksız fiil niteliğinde, en az kira geliri karşılığı bir zarardır; hak sahibi olmadan taşınmazı işgal eden, malike/paydaşa payı oranında ecrimisil ödemekle yükümlüdür.',
    ozet:
      'Ecrimisil, kötüniyetli zilyedin ödemekle yükümlü olduğu, en azından kira geliri karşılığı zararı ifade eden özel bir tazminat türüdür ve haksız fiil niteliğindedir. Kayıttan ve mülkiyetten kaynaklanan bir hakkı olmadığı hâlde başkasının taşınmazını (taşkın yapı vb.) kullanan kişinin bu kullanımı haksız işgal sayılır. Bu durumda haksız işgalciden, davacıların payı oranında ecrimisile hükmedilmesi gerekirken istemin reddi bozmayı gerektirmiştir.',
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
    ilke: 'Nafaka artırımı, tarafların değişen sosyal-ekonomik durumu ve TÜİK ÜFE (TEFE) oranı esas alınarak, önceki nafaka takdirindeki dengeyi koruyacak biçimde belirlenir.',
    ozet:
      'İştirak ve yoksulluk nafakasının artırımı istenen davada Yargıtay, artırım miktarının tarafların gerçekleşen sosyal ve ekonomik durumları, nafakanın niteliği ve TÜİK’in yayımladığı ÜFE (TEFE) artış oranı gözetilerek, önceki takdirle oluşan dengeyi koruyucu oranda belirlenmesi gerektiğini vurgulamıştır. Bu ölçütler değerlendirilmeden yoksulluk nafakası artırım talebinin reddi doğru görülmeyerek karar bozulmuştur.',
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
    ozet:
      'Velayet ve kişisel ilişki düzenlenirken gözetilecek temel ilke, çocuğun üstün yararıdır; ana-babanın kusuru ve sosyal konumu bu yararı etkilemediği ölçüde dikkate alınır. İdrak çağındaki çocuğun beyanı alınır ve aksini gerektiren somut delil bulunmadıkça esas alınır. Somut olayda babasıyla yaşayan, düzeni oturmuş ve babasıyla kalmak istediğini beyan eden çocuğun velayetinin, beyanının aksine anneye verilmesi doğru görülmeyerek karar bozulmuştur.',
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
    ozet:
      'İcra inkâr tazminatı, borçlunun haksızlığına karar verilmesi ve alacaklının talebi hâlinde, ancak alacağın likit olması şartıyla hükmedilebilir. Likit alacak, miktarının belli/sabit olduğu ya da borçlunun bütün unsurları bilerek kendi borcunu tespit edebildiği alacaktır; hak tartışmalı ve yargılamayı gerektiriyorsa likitlikten söz edilemez. Kıdem tazminatına hak kazanılıp kazanılmadığı taraflar arasında ihtilaflı olan olayda alacak likit sayılmadığından, icra inkâr tazminatına hükmedilmesi bozmayı gerektirmiştir.',
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
    ilke: 'Ayıplı malda tüketici; ücretsiz onarım, ayıpsız misli ile değişim, bedel iadesi veya indirim seçimlik haklarından birini kullanabilir. Bu haklar üretici/ithalatçıya karşı da ileri sürülebilir; satıcı, üretici ve ithalatçı müteselsilen sorumludur.',
    ozet:
      'Tüketici, ayıplı malda seçimlik haklarından (ücretsiz onarım, ayıpsız misli ile değişim, bedel iadesi, ayıp oranında indirim) dilediğini kullanabilir ve satıcı bunu yerine getirmekle yükümlüdür; bu haklar üretici veya ithalatçıya karşı da kullanılabilir, üçü müteselsilen sorumludur. Satın alınan yeni araçta gizli ayıbın bilirkişi raporuyla saptandığı olayda, aracın ayıpsız misli ile değişimine ilişkin hüküm usul ve yasaya uygun bulunarak onanmıştır.',
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
    ilke: 'Miras bırakanın, mirasçılardan mal kaçırmak amacıyla gerçekte bağışladığı taşınmazı satış gibi göstererek yaptığı temlik muvazaalıdır; mirasçılar payları oranında tapu iptali ve tescil isteyebilir.',
    ozet:
      'Miras bırakanın, saklı paylı mirasçılardan mal kaçırma amacıyla, gerçekte bağış olan taşınmaz devrini satış gibi göstererek (gerektiğinde üçüncü kişiler aracı kılınarak) yaptığı temlikler muris muvazaası nedeniyle geçersizdir. Böyle bir durumda mirasçılar, miras payları oranında tapu iptali ve tescil isteyebilir. Muvazaanın kabulü ilke olarak doğru olmakla birlikte, iptal ve tescilin miras bırakanın taşınmazdaki gerçek payı (7/8) esas alınarak yapılması gerektiğinden karar bozulmuştur.',
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
    ilke: 'Bonoda (kambiyo senedi) zamanaşımı vade tarihinden itibaren üç yıldır; zamanaşımına uğramış bonoyla genel haciz yoluyla takip yapılması dahi bu süreyi bertaraf etmez.',
    ozet:
      'Takip dayanağı bono kambiyo senedi niteliğinde olup, vade tarihinden itibaren üç yıllık zamanaşımına tâbidir. Süre dolduktan sonra alacaklının bonoya dayanarak genel haciz yoluyla takip yapması, bonolarda da uygulanan üç yıllık zamanaşımını ortadan kaldırmaz. Borçlu icra dairesine yaptığı itirazda zamanaşımını ileri sürdüğünden, itirazın kaldırılması isteminin reddi gerekirken kabulü bozmayı gerektirmiştir. (Karar mülga 6762 s. TTK dönemine ait olup, süre 6102 s. TTK m. 749’da da üç yıldır.)',
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
    ilke: 'Manevi tazminat; tarafların sosyal-ekonomik durumu, kusur, elem ve ızdırabın derecesi, olayın vehameti gözetilerek TMK m. 4 hak ve nesafet ilkesiyle takdir edilir; manevi tatmine yetecek kadar olmalı, ne zenginleşme aracı ne de çok az olmalıdır.',
    ozet:
      '22.06.1966 tarihli 7/7 sayılı İçtihadı Birleştirme Kararı ve TMK m. 4 uyarınca hâkim, manevi tazminat miktarını belirlerken tarafların sosyal ve ekonomik durumlarını, kusuru, olayın vehametini, mağdurdaki elem ve ızdırabın derecesini gözetir. Takdir edilecek manevi tazminat, zarar görende manevi tatmin sağlamaya yetecek kadar olmalı; malvarlığı zararının giderilmesi amaçlanmadığından zenginleşme aracına dönüşmemelidir. Somut olayda hükmedilen tazminatın az olduğu belirtilerek karar bozulmuştur.',
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
    ilke: 'İşçinin geniş anlamda ücretinin (fazla çalışma, hafta tatili, ikramiye dâhil) ödenmemesi İş K. m. 24/II-e uyarınca haklı fesih sebebidir; işçi bu hâlde kıdem tazminatına hak kazanır.',
    ozet:
      'İş hukuku uygulamasında "istifa", işçinin sözleşmeyi haklı sebep olmaksızın feshi anlamına gelir; ancak gerçekte ödenmeyen ücret nedeniyle yapılan fesih haklı fesihtir. İş Kanunu m. 24/II-e uyarınca ücretin kanuna/sözleşmeye uygun hesaplanmaması veya ödenmemesi haklı fesih sebebidir ve buradaki ücret, fazla çalışma-hafta tatili-ikramiye gibi tüm alacakları kapsayan geniş anlamda ücrettir. Fazla çalışma ücretinin ödenmediği sabit olan olayda işçinin feshi haklı sayılıp kıdem tazminatına hükmedilmesi gerektiğinden karar bozulmuştur.',
  },
];

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
