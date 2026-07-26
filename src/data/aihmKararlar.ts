// AİHM (Avrupa İnsan Hakları Mahkemesi) — Öncü Kararlar, Türkçe özetler.
//
// Türkiye, Avrupa İnsan Hakları Sözleşmesi'ne (AİHS) taraftır ve AİHM kararları
// iç hukukta doğrudan dayanak/atıf değeri taşır (AY m. 90/5; yeniden yargılanma
// yolu AİHM ihlal kararlarıyla açılabilir). Bu koleksiyon, ifade özgürlüğünden
// adil yargılanmaya, yaşam hakkından mülkiyete kadar AİHM içtihadının DÖNÜM
// NOKTASI kararlarını bir avukat gözüyle Türkçeye özetler.
//
// Her özet gerçek kararlardan çıkarılmıştır. İçerik bilgilendirme amaçlıdır;
// kararın tam metni ve güncel içtihat teyit edilmelidir. Başvuru numarası ancak
// kesin bilindiğinde verilmiştir; verilmeyen kararlar başvurucu/devlet ve yıl
// ile künyelenir.

export interface AihmKarar {
  id: string;
  slug: string;
  /** "Handyside / Birleşik Krallık" biçiminde taraf künyesi. */
  basvuru: string;
  /** Başvuru numarası (kesin bilinen hallerde). */
  basvuruNo?: string;
  /** Karar tarihi. */
  tarih: string;
  /** Büyük Daire kararı mı? */
  buyukDaire?: boolean;
  /** İlgili AİHS maddesi/maddeleri (kısa). */
  madde: string;
  /** Konu kategorisi (İfade Özgürlüğü, Adil Yargılanma…). */
  kategori: string;
  /** Kararın yerleşik ilkesi (özün özü). */
  ilke: string;
  /** Olay: başvurunun maddi vakıaları. */
  olay: string;
  /** Değerlendirme: Mahkeme'nin gerekçesi. */
  degerlendirme: string;
  /** Sonuç: ihlal var/yok ve hangi madde. */
  sonuc: string;
  /** Türkiye/uygulama açısından neden önemli. */
  onem: string;
}

export const AIHM_KARARLAR: AihmKarar[] = [
  {
    id: 'handyside-1976',
    slug: 'handyside-birlesik-krallik',
    basvuru: 'Handyside / Birleşik Krallık',
    basvuruNo: '5493/72',
    tarih: '07.12.1976',
    madde: 'AİHS m. 10 (İfade özgürlüğü)',
    kategori: 'İfade Özgürlüğü',
    ilke: 'İfade özgürlüğü yalnızca lehte veya zararsız görülen bilgiler için değil; devleti veya toplumun bir kesimini “rahatsız eden, şoke eden ya da endişelendiren” düşünceler için de geçerlidir. Bunlar çoğulculuğun, hoşgörünün ve açık fikirliliğin gereğidir.',
    olay:
      'Yayıncı Handyside, gençlere yönelik “The Little Red Schoolbook” adlı kitabı yayımlamış; kitap İngiltere’nin müstehcen yayın mevzuatı uyarınca toplatılıp imha edilmiş, yayıncı cezalandırılmıştır. Handyside bunun ifade özgürlüğünü ihlal ettiğini ileri sürmüştür.',
    degerlendirme:
      'Mahkeme, “ahlakın korunması”nı meşru amaç saymış; ulusal makamların toplumsal ihtiyacı değerlendirmede uluslararası yargıçtan daha iyi konumda olduğunu belirterek devletlere bir “takdir marjı” (margin of appreciation) tanımıştır. Ancak bu marj Mahkeme’nin denetimine tabidir; müdahalenin “demokratik toplumda gerekli” ve güdülen amaçla orantılı olması aranır.',
    sonuc: 'm. 10 ihlali bulunmadı — müdahale gerekli ve orantılı kabul edildi.',
    onem:
      'İfade özgürlüğü içtihadının temel taşıdır. “Takdir marjı” ve “demokratik toplumda gereklilik” testleri, AİHM’in ve Türk Anayasa Mahkemesi’nin ifade özgürlüğü değerlendirmelerinde bugün de belirleyicidir.',
  },
  {
    id: 'golder-1975',
    slug: 'golder-birlesik-krallik',
    basvuru: 'Golder / Birleşik Krallık',
    basvuruNo: '4451/70',
    tarih: '21.02.1975',
    madde: 'AİHS m. 6/1, m. 8',
    kategori: 'Adil Yargılanma',
    ilke: 'Adil yargılanma hakkı, “mahkemeye erişim hakkını” da içerir. Dava açabilme imkânı tanınmadan yargılama güvencelerinden söz edilemez.',
    olay:
      'Cezaevindeki başvurucu, bir gardiyanın kendisine yönelik iddialarına karşı hakaret davası açmak üzere avukatla görüşmek istemiş; idare bu izni vermemiştir.',
    degerlendirme:
      'Mahkeme, m. 6/1 açıkça “mahkemeye erişim” demese de hükmün amacının bunu içerdiğini; erişim hakkı olmadan usuli güvencelerin anlamsız kalacağını belirtmiştir. Avukatla görüşmenin engellenmesi hem erişim hakkını hem de haberleşmeye saygıyı zedelemiştir.',
    sonuc: 'm. 6/1 ve m. 8 ihlali.',
    onem:
      'Mahkemeye erişim hakkının anayasal-sözleşmesel temelini kuran karardır. Türkiye’de dava şartları, harç ve erişim engellerinin ölçülülüğü tartışmalarında dayanak oluşturur.',
  },
  {
    id: 'airey-1979',
    slug: 'airey-irlanda',
    basvuru: 'Airey / İrlanda',
    basvuruNo: '6289/73',
    tarih: '09.10.1979',
    madde: 'AİHS m. 6/1, m. 8',
    kategori: 'Adil Yargılanma',
    ilke: 'Sözleşme, hakları “teorik ve yanılsamalı değil, pratik ve etkili” biçimde güvence altına alır. Bazı hâllerde mahkemeye etkili erişim, devletin adli yardım sağlama gibi pozitif edimlerini gerektirir.',
    olay:
      'Maddi imkânı kısıtlı başvurucu, eşinden ayrılık (judicial separation) kararı almak istemiş; ancak dava yalnızca üst derece mahkemesinde ve fiilen avukatla yürütülebildiğinden, adli yardım da bulunmadığından davasını açamamıştır.',
    degerlendirme:
      'Mahkeme, hakkın kâğıt üzerinde tanınmasının yetmediğini; davanın karmaşıklığı ve duygusal yükü karşısında avukatsız etkili erişimin gerçekçi olmadığını belirtmiştir. Devletin sözleşmesel yükümlülüğü, gerektiğinde erişimi fiilen mümkün kılacak tedbirleri de kapsar.',
    sonuc: 'm. 6/1 ihlali (ve özel/aile yaşamı yönünden m. 8 ihlali).',
    onem:
      '“Pratik ve etkili koruma” ilkesinin ve adli yardımın sözleşmesel temelinin kaynağıdır. Adli yardım/erişim davalarında yerleşik atıf noktasıdır.',
  },
  {
    id: 'soering-1989',
    slug: 'soering-birlesik-krallik',
    basvuru: 'Soering / Birleşik Krallık',
    basvuruNo: '14038/88',
    tarih: '07.07.1989',
    madde: 'AİHS m. 3 (İşkence ve kötü muamele yasağı)',
    kategori: 'İşkence Yasağı',
    ilke: 'Bir kişiyi, gideceği ülkede m. 3’e aykırı muameleye maruz kalacağına dair gerçek bir risk (real risk) varsa iade/sınırdışı eden devlet sorumlu olur. Bu koruma, Sözleşme’ye taraf olmayan ülkelere iadede de geçerlidir.',
    olay:
      'Almanya uyruklu başvurucu, ABD’nin Virginia eyaletine iade edildiğinde idam cezası ve infaz öncesi yıllarca süren “ölüm koridoru sendromu” (death row phenomenon) ile karşılaşacaktı.',
    degerlendirme:
      'Mahkeme, m. 3’ün mutlak niteliğinden hareketle, iade sonrası öngörülebilir muamelenin insanlık dışı olması hâlinde sorumluluğun iade eden devlete de doğacağını belirtmiştir. Ölüm koridorundaki bekleyiş koşulları, yaş ve ruh hâli birlikte değerlendirilmiştir.',
    sonuc: 'İade gerçekleşseydi m. 3 ihlali oluşacaktı (iade engellendi).',
    onem:
      'Sınırdışı/iade ve geri gönderme (non-refoulement) hukukunun temel kararıdır. Türkiye’deki geri gönderme, iade ve uluslararası koruma uyuşmazlıklarında doğrudan dayanaktır.',
  },
  {
    id: 'osman-1998',
    slug: 'osman-birlesik-krallik',
    basvuru: 'Osman / Birleşik Krallık',
    basvuruNo: '23452/94',
    tarih: '28.10.1998',
    buyukDaire: true,
    madde: 'AİHS m. 2 (Yaşam hakkı), m. 6',
    kategori: 'Yaşam Hakkı',
    ilke: '“Osman testi”: Devletin yaşam hakkını koruma pozitif yükümlülüğü, yetkililerin belirli bir kişiye yönelik gerçek ve yakın (real and immediate) yaşam riskini bildiği ya da bilmesi gerektiği ve makul tedbirleri almadığı hâllerde doğar.',
    olay:
      'Bir öğretmenin öğrencisine yönelik saplantılı davranışları giderek tehdide dönüşmüş; nihayetinde öğrencinin babası öldürülmüş, kendisi yaralanmıştır. Aile, polisin uyarılara rağmen önlem almadığını ileri sürmüştür.',
    degerlendirme:
      'Mahkeme, pozitif yükümlülüğü kabul etmekle birlikte bunun makullük eşiğiyle sınırlı olduğunu; somut olayda yetkililerin belirleyici anda gerçek ve yakın riski bilmesi gerektiğinin kanıtlanamadığını belirtmiştir. Ayrıca polise mutlak dokunulmazlık tanınması mahkemeye erişimi zedelemiştir.',
    sonuc: 'm. 2 ihlali bulunmadı; ancak m. 6/1 (mahkemeye erişim) ihlali.',
    onem:
      'Devletin bireyi üçüncü kişilere karşı koruma yükümlülüğünün ölçütünü (Osman testi) kuran karardır. Kadına yönelik şiddet, tehdit ve koruma tedbiri davalarında yaygın dayanaktır.',
  },
  {
    id: 'klass-1978',
    slug: 'klass-almanya',
    basvuru: 'Klass ve Diğerleri / Almanya',
    basvuruNo: '5029/71',
    tarih: '06.09.1978',
    madde: 'AİHS m. 8 (Özel hayat), m. 13',
    kategori: 'Özel Hayat',
    ilke: 'Gizli gözetim/iletişimin denetlenmesi özel hayata ve haberleşmeye müdahaledir. Ancak keyfiliğe karşı yeterli ve etkili güvenceler (bağımsız denetim) bulunuyorsa demokratik toplumda gerekli sayılabilir.',
    olay:
      'Alman mevzuatı, milli güvenlik gerekçesiyle kişiye bildirim yapılmaksızın haberleşmenin gizlice izlenmesine imkân tanıyordu. Başvurucular bu düzenlemenin özel hayatı ihlal ettiğini ileri sürdüler.',
    degerlendirme:
      'Mahkeme, casusluk ve terörle mücadelede gizli izleme tedbirlerinin gerekli olabileceğini kabul etmiş; fakat “demokrasiyi savunma adına onu tahrip etme” tehlikesine karşı yeterli güvence ve denetim mekanizması aramıştır. Somut mevzuattaki güvenceler yeterli görülmüştür.',
    sonuc: 'm. 8 ve m. 13 ihlali bulunmadı — fakat gizli gözetimin denetim standardı kuruldu.',
    onem:
      'Kitlesel/gizli gözetim, dinleme ve veri toplama denetiminin çerçeve kararıdır. İletişimin denetlenmesi ve kişisel veri uyuşmazlıklarında ölçüt sunar.',
  },
  {
    id: 'kudla-2000',
    slug: 'kudla-polonya',
    basvuru: 'Kudła / Polonya',
    basvuruNo: '30210/96',
    tarih: '26.10.2000',
    buyukDaire: true,
    madde: 'AİHS m. 6/1, m. 13',
    kategori: 'Adil Yargılanma',
    ilke: 'Makul sürede yargılanma hakkının ihlaline karşı, iç hukukta bu ihlali önleyen veya gideren etkili bir başvuru yolu (m. 13) bulunmak zorundadır.',
    olay:
      'Başvurucu, ceza yargılamasının aşırı uzun sürdüğünü; üstelik iç hukukta bu gecikmeye karşı başvurabileceği etkili bir yol bulunmadığını ileri sürmüştür.',
    degerlendirme:
      'Mahkeme, m. 13’ün makul süre şikâyetleri bakımından da ayrı ve bağımsız bir güvence oluşturduğunu; devletlerin uzun yargılamalara karşı ulusal düzeyde etkili (tazminat ve/veya hızlandırıcı) bir yol kurmakla yükümlü olduğunu belirtmiştir.',
    sonuc: 'm. 13 ihlali (ve makul süre yönünden m. 6/1 ihlali).',
    onem:
      'Türkiye’de uzun yargılama ve gecikmelere karşı Tazminat Komisyonu ve Anayasa Mahkemesi bireysel başvuru yolunun etkinliği tartışmalarının doğrudan kaynağıdır.',
  },
  {
    id: 'selmouni-1999',
    slug: 'selmouni-fransa',
    basvuru: 'Selmouni / Fransa',
    basvuruNo: '25803/94',
    tarih: '28.07.1999',
    buyukDaire: true,
    madde: 'AİHS m. 3 (İşkence yasağı)',
    kategori: 'İşkence Yasağı',
    ilke: 'Sözleşme “yaşayan bir belge”dir; artan insan hakları standartları karşısında, geçmişte “insanlık dışı muamele” sayılan fiiller bugün “işkence” olarak nitelenebilir.',
    olay:
      'Başvurucu, gözaltındayken kolluk görevlilerince tekrarlanan ağır fiziksel şiddete ve aşağılayıcı muameleye maruz kaldığını, bunun sağlık raporlarıyla da sabit olduğunu ileri sürmüştür.',
    degerlendirme:
      'Mahkeme, gözaltındaki bir kişinin yaralanmalarının makul biçimde açıklanması yükünün devlete ait olduğunu vurgulamış; muamelenin ağırlığı ve kasıt unsuru karşısında bunu “işkence” olarak nitelemiş, koruma standardının zamanla yükseldiğini belirtmiştir.',
    sonuc: 'm. 3 (işkence) ihlali.',
    onem:
      'Gözaltında kötü muamelede ispat yükü ve “işkence” nitelemesinin evrilen ölçütü bakımından temel karardır. Türkiye’ye karşı kötü muamele davalarında yaygın atıftır.',
  },
  {
    id: 'loizidou-1996',
    slug: 'loizidou-turkiye',
    basvuru: 'Loizidou / Türkiye (Esas)',
    basvuruNo: '15318/89',
    tarih: '18.12.1996',
    buyukDaire: true,
    madde: 'AİHS m. 1; 1 No’lu Protokol m. 1 (Mülkiyet)',
    kategori: 'Mülkiyet / Yetki',
    ilke: 'Devletin “yetki” (jurisdiction) alanı, kendi sınırlarıyla sınırlı değildir; bir bölgede fiilî ve etkin genel kontrol (effective overall control) uygulayan devlet, orada Sözleşme’den sorumlu olur.',
    olay:
      'Kıbrıslı Rum başvurucu, Kıbrıs’ın kuzeyindeki taşınmazlarına erişiminin sürekli olarak engellendiğini; bunun mülkiyet hakkını ihlal ettiğini ileri sürmüştür.',
    degerlendirme:
      'Mahkeme, bölgedeki asker mevcudiyeti nedeniyle Türkiye’nin etkin genel kontrol uyguladığını; başvurucunun taşınmazına erişiminin sürekli engellenmesinin mülkiyetin kullanımından yoksun bırakma niteliğinde, süregelen (continuing) bir ihlal oluşturduğunu belirtmiştir.',
    sonuc: '1 No’lu Protokol m. 1 ihlali.',
    onem:
      '“Etkin kontrol” ve devletin sınır ötesi sorumluluğu (extraterritorial jurisdiction) doktrininin öncü kararıdır. Uluslararası sorumluluk ve mülkiyet uyuşmazlıklarında dönüm noktasıdır.',
  },
  {
    id: 'ocalan-2005',
    slug: 'ocalan-turkiye',
    basvuru: 'Öcalan / Türkiye',
    basvuruNo: '46221/99',
    tarih: '12.05.2005',
    buyukDaire: true,
    madde: 'AİHS m. 3, m. 5, m. 6',
    kategori: 'Adil Yargılanma',
    ilke: 'Bünyesinde askerî hâkim bulunan Devlet Güvenlik Mahkemesi, bağımsız ve tarafsız mahkeme güvencesini karşılamaz. Adil olmayan bir yargılama sonucu verilen ölüm cezası, m. 3 bakımından da ağır sonuç doğurur.',
    olay:
      'Başvurucu, yakalanıp Türkiye’ye getirilmiş ve o dönem yapısında askerî hâkim bulunan Devlet Güvenlik Mahkemesi’nde yargılanarak ölüm cezasına mahkûm edilmiştir (ceza sonradan müebbede çevrilmiştir).',
    degerlendirme:
      'Mahkeme, DGM’nin bağımsızlık/tarafsızlık kuşkusu doğurduğunu ve savunma haklarının kısıtlandığını (dosyaya/müdafiye erişim) tespit etmiş; gözaltının hâkim önüne çıkarılmasındaki gecikmeyi m. 5’e aykırı bulmuştur. Adil olmayan yargılama sonucu ölüm cezası verilmesinin m. 3 yönünden ağırlığına işaret edilmiştir.',
    sonuc: 'm. 5 ve m. 6 ihlalleri; yeniden yargılanma en uygun giderim olarak gösterildi.',
    onem:
      'Türkiye’de Devlet Güvenlik Mahkemeleri’nin kaldırılmasında ve AİHM ihlaline dayalı yeniden yargılanma yolunun işletilmesinde belirleyici olmuştur.',
  },
  {
    id: 'dink-2010',
    slug: 'dink-turkiye',
    basvuru: 'Dink / Türkiye',
    basvuruNo: '2668/07 vd.',
    tarih: '14.09.2010',
    madde: 'AİHS m. 2, m. 10, m. 13',
    kategori: 'İfade Özgürlüğü',
    ilke: 'Devletin yaşamı koruma pozitif yükümlülüğü, bilinen gerçek ve yakın tehdide karşı önlem almayı gerektirir. Bir gazetecinin öldürülmesi ve ifadeleri nedeniyle mahkûmiyeti, ifade özgürlüğü üzerinde caydırıcı (chilling) etki yaratır.',
    olay:
      'Gazeteci-yazar Hrant Dink, yazıları nedeniyle “Türklüğü aşağılama”dan mahkûm edilmiş; ardından güvenlik birimlerinin somut suikast tehdidini bilmesine rağmen koruma sağlanmaması sonucu öldürülmüştür.',
    degerlendirme:
      'Mahkeme, yetkililerin gerçek ve yakın yaşam tehdidini bildiğini/bilmesi gerektiğini ve makul önlemleri almadığını tespit ederek m. 2’nin hem esas hem usul (etkili soruşturma) yönünden ihlal edildiğini; mahkûmiyet ve korumasızlığın ifade özgürlüğünü zedelediğini belirtmiştir.',
    sonuc: 'm. 2 (esas ve usul), m. 13 ve m. 10 ihlali.',
    onem:
      'Yaşam hakkının korunması ile ifade özgürlüğünün kesiştiği, Türkiye açısından simgesel ve emsal bir karardır. Gazetecilerin/muhaliflerin korunması ve ifade özgürlüğü davalarında güçlü dayanaktır.',
  },
  {
    id: 'broniowski-2004',
    slug: 'broniowski-polonya',
    basvuru: 'Broniowski / Polonya',
    basvuruNo: '31443/96',
    tarih: '22.06.2004',
    buyukDaire: true,
    madde: '1 No’lu Protokol m. 1 (Mülkiyet)',
    kategori: 'Mülkiyet / Yetki',
    ilke: 'Aynı yapısal (sistemik) sorundan kaynaklanan çok sayıda başvuru bulunduğunda AİHM “pilot karar” verir; devlete, benzer mağduriyetleri iç hukukta topluca giderecek genel tedbirleri alma yükümlülüğü doğar.',
    olay:
      'İkinci Dünya Savaşı sonrası sınır değişiklikleriyle terk edilen mülkler için öngörülen tazmin hakkı, devletçe fiilen işletilmemiş; aynı durumdaki on binlerce kişi mağdur olmuştur.',
    degerlendirme:
      'Mahkeme, sorunun bireysel değil sistemik olduğunu tespit ederek pilot karar usulünü uygulamış; ihlalin kaynağındaki mevzuat/uygulama boşluğunun giderilmesini ve benzer başvuruculara etkili giderim sağlanmasını istemiştir.',
    sonuc: '1 No’lu Protokol m. 1 ihlali; pilot karar usulü uygulandı.',
    onem:
      'Sistemik ihlallerde “pilot karar” usulünün doğduğu karardır. Türkiye’ye karşı yapısal sorunlarda (örn. uzun yargılama, mülkiyet) bu usulün uygulanma zeminini anlamak için temeldir.',
  },
];

/** Kategori listesi (filtre çipleri için) — koleksiyondan türetilir. */
export function aihmKategoriler(): string[] {
  return Array.from(new Set(AIHM_KARARLAR.map((k) => k.kategori)));
}

/** Basit arama: taraf, konu, ilke, kategori ve madde üzerinde eşleşme. */
export function searchAihm(query: string): AihmKarar[] {
  const q = query.trim().toLocaleLowerCase('tr');
  if (!q) return AIHM_KARARLAR;
  return AIHM_KARARLAR.filter((k) =>
    [k.basvuru, k.kategori, k.madde, k.ilke, k.olay, k.degerlendirme, k.onem]
      .join(' ')
      .toLocaleLowerCase('tr')
      .includes(q)
  );
}
