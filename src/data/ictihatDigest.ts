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
