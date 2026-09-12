// KVKK AYDINLATMA METNİ — TEK GÖVDE, İKİ YERDE.
// ---------------------------------------------------------------------------
// NEDEN AYRI DOSYA. Bu metin iki yerde gösteriliyor: (1) `/kvkk` sayfası, (2)
// kayıt ekranındaki İMZA penceresi. Metni iki yere kopyalamak, birini
// güncelleyip diğerini unutmanın garantili yoludur — ve imzalanan metinle
// yayımlanan metin ayrışırsa RIZA SAKATLANIR: avukat, imzaladığından farklı
// bir metne rıza vermiş görünür. Bu yüzden gövde tek yerde duruyor.
//
// METİN KODUN GERÇEKTE NE YAPTIĞINI YAZAR. Aktarılan taraflar
// src/config/kvkk.ts'te koddan okunarak listelendi; bir sağlayıcı eklenirse
// metin kendiliğinden güncellenir. Elle yazılıp unutulan bir liste, yanlış
// beyandır — nitekim bir önceki sürümde "hiçbir veri paylaşılmaz" yazıyordu
// ve yapay zekâ özellikleri kullanıcının metnini ABD'ye gönderiyordu.
//
// ⚠️ VERİ SORUMLUSU KİMLİĞİ HENÜZ BOŞ ve uydurulamaz. Boş olduğu sürece metin
// bunu kullanıcıdan GİZLEMEZ; eksik olduğunu açıkça yazar ve alan dolunca
// uyarı kendiliğinden kalkar.
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '@/components/ui/Card';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { ALICILAR, AI_KAPSAM_DISI, KVKK_SURUM, RIZA_ZORUNLU, VERI_SORUMLUSU, kimlikTamMi } from '@/config/kvkk';

// RIZA ZORUNLU TUTULUYORSA METİN BUNU SÖYLER. Kayıt ekranı rıza olmadan hesap
// açtırmıyorken metne "rıza hizmetin şartı değildir" yazmak, bu dosyanın
// düzeltmek için var olduğu hatanın aynısı olurdu (önceki sürümde gizlilik
// metni "hiçbir veri paylaşılmaz" derken metinler ABD'ye gidiyordu). Durum
// gizlenmiyor; olduğu gibi yazılıyor ve düzeltilmesi gerektiği söyleniyor.
const RIZA_KOSUL_TR = RIZA_ZORUNLU
  ? 'ŞU ANKİ UYGULAMA — AÇIKÇA BİLDİRİLİR: kayıt ekranında bu rıza şu an ZORUNLU tutulmaktadır; rıza verilmeden hesap açılamamaktadır. Kanun’un rızanın “özgür iradeyle” verilmiş olmasını araması karşısında, rızayı hizmete erişimin şartı hâline getiren bu uygulama tartışmalıdır ve düzeltilmesi gündemdedir. Durum size gizlenmemekte, burada bildirilmektedir.\n\nRızanızı verdikten sonra dilediğiniz zaman Ayarlar > KVKK Aydınlatma Metni ekranından geri alabilirsiniz; geri aldığınızda hesabınız kapanmaz, yalnız yapay zekâ özellikleri durur.'
  : 'AÇIK RIZA HİZMETİN ŞARTI DEĞİLDİR. Rıza vermezseniz yapay zekâ özellikleri çalışmaz; uygulamanın diğer tüm işlevleri normal şekilde kullanılmaya devam eder. Rızanızı dilediğiniz zaman Ayarlar > KVKK Aydınlatma Metni ekranından geri alabilirsiniz; geri alma ileriye etkilidir ve diğer hizmetleri etkilemez.';

const RIZA_KOSUL_EN = RIZA_ZORUNLU
  ? 'CURRENT PRACTICE — DISCLOSED PLAINLY: the sign-up screen currently REQUIRES this consent; an account cannot be created without it. Because the Law expects consent to be given freely, making it a condition of access is contestable and is slated to be changed. We disclose this rather than hide it.\n\nOnce given, you may withdraw consent at any time from Settings > KVKK Privacy Notice. Withdrawal does not close your account; it only stops the AI features.'
  : 'Consent is not a condition of service. Without it the AI features do not run; everything else works normally. You may withdraw it at any time from Settings > KVKK Privacy Notice.';

export interface Bolum {
  icon: string;
  title: string;
  body: string;
}

function sorumluMetni(tr: boolean): string {
  const v = VERI_SORUMLUSU;
  if (!kimlikTamMi(v)) {
    return tr
      ? 'BU ALAN HENÜZ DOLDURULMAMIŞTIR.\n\nVekil Pro’yu işleten gerçek veya tüzel kişinin unvanı, açık adresi ve başvuru adresi yayımlanmadan bu metin, Kanun’un 10. maddesindeki biçim şartını tam olarak karşılamaz. Eksiklik burada saklanmamakta, size bildirilmektedir.'
      : 'THIS FIELD HAS NOT YET BEEN COMPLETED.\n\nUntil the operator’s legal name, registered address and application address are published, this notice does not fully meet the formal requirements of Article 10. The gap is disclosed rather than hidden.';
  }
  const s = [
    `${tr ? 'Unvan' : 'Legal name'}: ${v.unvan}`,
    `${tr ? 'Adres' : 'Address'}: ${v.adres}`,
    `${tr ? 'Başvuru adresi' : 'Contact'}: ${v.eposta}`,
  ];
  if (v.kep) s.push(`KEP: ${v.kep}`);
  if (v.mersis) s.push(`MERSİS: ${v.mersis}`);
  s.push(v.verbis ? `VERBİS: ${v.verbis}` : (tr ? 'VERBİS: kayıt yükümlülüğü değerlendirilmektedir' : 'VERBİS: registration obligation under assessment'));
  return s.join('\n');
}

function aliciMetni(tr: boolean): string {
  return ALICILAR.map(
    (a) => `• ${a.ad}\n   ${tr ? 'Bulunduğu ülke' : 'Country'}: ${a.ulke}\n   ${tr ? 'Aktarım amacı' : 'Purpose'}: ${a.amac}`
  ).join('\n\n');
}

const TR: Bolum[] = [
  {
    icon: 'business-outline',
    title: '1. Veri Sorumlusu',
    body: `6698 sayılı Kişisel Verilerin Korunması Kanunu (“Kanun”) uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla aşağıda kimliği belirtilen tarafından işlenmektedir.\n\n${sorumluMetni(true)}`,
  },
  {
    icon: 'layers-outline',
    title: '2. İşlenen Kişisel Veri Kategorileri',
    body:
      '• Kimlik: ad, soyad\n' +
      '• İletişim: e-posta adresi, telefon numarası (isteğe bağlı)\n' +
      '• Mesleki bilgi: büro adı, bağlı olunan baro, sicil numarası (isteğe bağlı)\n' +
      '• Müşteri işlem: dava, müvekkil, duruşma, görev, süre ve belge kayıtlarınız\n' +
      '• Finans: tahsilat, gider ve vekâlet ücreti kayıtlarınız\n' +
      '• İşlem güvenliği: oturum kayıtları, cihaz ve uygulama sürümü, hata kayıtları, IP bilgisi\n' +
      '• Yapay zekâ istekleri: bu özelliklere kendi elinizle girdiğiniz ya da yüklediğiniz metin ve belgeler',
  },
  {
    icon: 'alert-circle-outline',
    title: '3. Üçüncü Kişilerin Verileri ve Sıfatlarımız — dikkatle okuyunuz',
    body:
      'Uygulamaya girdiğiniz dava ve müvekkil kayıtları, ÜÇÜNCÜ KİŞİLERİN (müvekkilleriniz, karşı taraf, tanıklar, üçüncü şahıslar) kişisel verilerini içerebilir. Bu veriler bakımından:\n\n' +
      '• VERİ SORUMLUSU SİZSİNİZ. Bu verilerin hukuka uygun işlenmesinden, ilgili kişilere karşı aydınlatma yükümlülüğünün yerine getirilmesinden ve gereken hâllerde açık rıza alınmasından siz sorumlusunuz.\n' +
      '• VEKİL PRO VERİ İŞLEYENDİR. Verileri yalnızca hizmetin sunulması amacıyla, sizin talimatınız doğrultusunda işler; kendi amaçları için kullanmaz, üçüncü kişilere satmaz.\n\n' +
      'Ayrıca dava dosyalarınız, Kanun’un 6. maddesi anlamında ÖZEL NİTELİKLİ kişisel veri (özellikle ceza mahkûmiyeti ve güvenlik tedbirlerine ilişkin veriler ile sağlık verileri) içerebilir. Bu tür verilerin işlenmesi daha ağır koşullara tabidir ve bu değerlendirmeyi kendi büronuz için yapmanız gerekir.\n\n' +
      'Avukatlık Kanunu’nun 36. maddesindeki sır saklama yükümlülüğünüz saklıdır; bu metin o yükümlülüğü ortadan kaldırmaz veya hafifletmez.',
  },
  {
    icon: 'flag-outline',
    title: '4. İşleme Amaçları',
    body:
      '• Üyelik kaydının oluşturulması, kimlik doğrulaması ve hesap güvenliğinin sağlanması\n' +
      '• Dava, müvekkil, ajanda, süre, belge ve finans yönetimi hizmetinin sunulması\n' +
      '• Talebiniz üzerine yapay zekâ ile taslak dilekçe, mütalaa, özet ve çözümleme üretilmesi\n' +
      '• Abonelik süreçlerinin yürütülmesi, satın almaların doğrulanması\n' +
      '• Hizmetin kötüye kullanımının tespiti ve önlenmesi, sistem güvenliğinin sağlanması\n' +
      '• Talep ve şikâyetlerin karşılanması\n' +
      '• Mevzuattan doğan saklama, bilgi verme ve raporlama yükümlülüklerinin yerine getirilmesi',
  },
  {
    icon: 'scale-outline',
    title: '5. Hukuki Sebepler',
    body:
      'Kişisel verileriniz Kanun’un 5. maddesinde sayılan şu hukuki sebeplere dayanılarak işlenmektedir:\n\n' +
      '• m.5/2-(c) — Sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması: hesap, dava, belge, ajanda ve abonelik işlevleri.\n' +
      '• m.5/2-(ç) — Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi: vergi ve saklama ödevleri.\n' +
      '• m.5/2-(e) — Bir hakkın tesisi, kullanılması veya korunması: uyuşmazlık hâlinde kayıtların ispatı.\n' +
      '• m.5/2-(f) — Meşru menfaat: güvenlik, kötüye kullanımın önlenmesi, hata kayıtları.\n' +
      '• m.5/1 — AÇIK RIZA: yalnızca yapay zekâ özelliklerinin kullanılması ve bu kapsamdaki yurt dışına aktarım için (bkz. 6. ve 13. başlıklar).\n\n' +
      RIZA_KOSUL_TR,
  },
  {
    icon: 'globe-outline',
    title: '6. Aktarılan Taraflar ve Yurt Dışına Aktarım',
    body:
      `Kişisel verileriniz, hizmetin sunulabilmesi için aşağıdaki hizmet sağlayıcılara aktarılmaktadır. Liste, uygulamanın kaynak kodundan okunarak hazırlanmıştır:\n\n${aliciMetni(true)}\n\n` +
      'YURT DIŞINA AKTARIM (m.9). Yukarıdaki sağlayıcıların bir kısmı yurt dışında bulunmaktadır. Yapay zekâ sağlayıcılarına yapılan aktarım AÇIK RIZANIZA dayanmaktadır. Rıza vermemeniz hâlinde yapay zekâ özellikleri kullanılamaz; kayıtlarınız bu sağlayıcılara gönderilmez.\n\n' +
      'YAPAY ZEKÂYA NE GÖNDERİLDİĞİ. Yalnızca o istekte sizin girdiğiniz ya da eklediğiniz metin gönderilir. Veritabanınız kendiliğinden taranmaz, dava ve müvekkil kayıtlarınız topluca aktarılmaz.',
  },
  {
    icon: 'shield-half-outline',
    title: '7. Yapay Zekâya Gönderilmeyenler',
    body: AI_KAPSAM_DISI.map((x) => `• ${x}`).join('\n'),
  },
  {
    icon: 'download-outline',
    title: '8. Toplama Yöntemi',
    body:
      'Kişisel verileriniz; uygulamaya kendiniz girdiğiniz bilgiler, yüklediğiniz belgeler ve uygulamayı kullanmanız sırasında otomatik olarak üretilen teknik kayıtlar yoluyla, elektronik ortamda ve kısmen otomatik yollarla toplanmaktadır.',
  },
  {
    icon: 'time-outline',
    title: '9. Saklama Süresi ve İmha',
    body:
      'Kayıtlarınız, hesabınız etkin olduğu sürece ve ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca saklanır.\n\n' +
      'Hesabınızı sildiğinizde kayıtlarınız canlı veritabanından silinir. Ayrıca her gece alınan ve 21 gün saklanan yedek ile her ayın başında alınan ve 12 ay saklanan yedekten de silinir.\n\n' +
      'Bulut altyapı sağlayıcımızın kendi anlık görüntüsü tek bir kullanıcı için ayıklanamaz; bu kopya en geç 7 gün içinde saklama süresi dolarak kendiliğinden düşer ve bu süre boyunca yalnızca felaket kurtarma amacıyla erişilebilir kalır. Bu husus açıkça bildirilmektedir.',
  },
  {
    icon: 'lock-closed-outline',
    title: '10. Veri Güvenliği',
    body:
      'Kanun’un 12. maddesi kapsamında alınan teknik ve idari tedbirler:\n\n' +
      '• Aktarımda TLS, depolamada AES-256 şifreleme\n' +
      '• Veritabanında satır düzeyi güvenlik (RLS): her kullanıcı yalnızca kendi kayıtlarına erişebilir\n' +
      '• Yönetimsel uçlarda yalnızca servis yetkisiyle erişim\n' +
      '• Oturum bilgilerinin cihazda şifreli alanda saklanması; isteğe bağlı biyometrik kilit\n' +
      '• Düzenli yedekleme ve geri yükleme denetimi',
  },
  {
    icon: 'hand-right-outline',
    title: '11. İlgili Kişi Olarak Haklarınız (m.11)',
    body:
      'Kanun’un 11. maddesi uyarınca:\n\n' +
      '• Kişisel verinizin işlenip işlenmediğini öğrenme\n' +
      '• İşlenmişse buna ilişkin bilgi talep etme\n' +
      '• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme\n' +
      '• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme\n' +
      '• Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme\n' +
      '• Kanun’un 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme\n' +
      '• Düzeltme, silme ve yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme\n' +
      '• Münhasıran otomatik sistemlerle çözümlenmesi suretiyle aleyhinize bir sonuç ortaya çıkmasına itiraz etme\n' +
      '• Kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme\n\n' +
      'haklarına sahipsiniz. Silme hakkınızı uygulama içinden Ayarlar > Hesabı Sil adımıyla doğrudan kullanabilirsiniz.',
  },
  {
    icon: 'mail-outline',
    title: '12. Başvuru Usulü (m.13)',
    body: kimlikTamMi()
      ? `Taleplerinizi Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun olarak yukarıdaki adrese yazılı olarak veya ${VERI_SORUMLUSU.eposta} adresine iletebilirsiniz. Başvurunuz en geç otuz gün içinde sonuçlandırılır.\n\nBaşvurunuzun reddedilmesi, verilen cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâlinde, cevabı öğrendiğiniz tarihten itibaren otuz ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kurulu’na şikâyette bulunabilirsiniz (m.14).`
      : 'Kanun’un aradığı ayrı bir başvuru kanalı HENÜZ YAYIMLANMAMIŞTIR. O güne kadar uygulama içinden Ayarlar > Öneri & Şikâyet kanalını kullanabilirsiniz. Bu eksiklik gizlenmemekte, burada bildirilmektedir.\n\nHer hâlükârda Kişisel Verileri Koruma Kurulu’na şikâyet hakkınız saklıdır (m.14).',
  },
  {
    icon: 'create-outline',
    title: '13. Açık Rıza Beyanı',
    body:
      'Kayıt sırasında imzaladığınız beyanın metni:\n\n' +
      '“Yapay zekâ özelliklerini kullanabilmem için, bu özelliklere kendi elimle girdiğim metin ve belgelerin, yukarıda 6. başlıkta sayılan ve yurt dışında bulunan yapay zekâ hizmet sağlayıcılarına aktarılmasına, 6698 sayılı Kanun’un 5/1 ve 9. maddeleri kapsamında ÖZGÜR İRADEMLE VE BİLGİLENDİRİLMİŞ OLARAK açık rıza veriyorum.”\n\n' +
      'Bu rıza:\n' +
      (RIZA_ZORUNLU
        ? '• ŞU AN kayıt olabilmenin şartı hâline gelmiş durumdadır. Bunun Kanun’un aradığı özgür irade ölçütüyle tam olarak bağdaşmadığı, 5. başlıkta açıkça bildirilmiştir.\n'
        : '• Hizmetin sunulmasının şartı değildir.\n') +
      '• Başka onaylarla birlikte paketlenmemiştir; ayrı olarak alınır.\n' +
      '• Dilediğiniz zaman geri alınabilir. Geri aldığınızda yapay zekâ özellikleri kapanır, diğer tüm işlevler çalışmaya devam eder.\n' +
      '• Verildiği tarih ve metin sürümüyle birlikte kaydedilir; kayıt üzerine yazılmaz, geri alma ayrı bir kayıt olarak tutulur.',
  },
];

const EN: Bolum[] = [
  { icon: 'business-outline', title: '1. Data Controller', body: sorumluMetni(false) },
  {
    icon: 'layers-outline',
    title: '2. Categories of Personal Data',
    body: '• Identity: name, surname\n• Contact: e-mail, phone (optional)\n• Professional: firm name, bar association, registration number (optional)\n• Client transactions: your case, client, hearing, task, deadline and document records\n• Finance: collection, expense and fee records\n• Security: session logs, device and app version, error logs, IP\n• AI requests: text and documents you personally enter or upload into those features',
  },
  {
    icon: 'alert-circle-outline',
    title: '3. Third-Party Data — read carefully',
    body:
      'Your case and client records may contain personal data of THIRD PARTIES (your clients, opposing parties, witnesses). For that data YOU are the controller and Vekil Pro acts as a processor, handling it only on your instructions and never for its own purposes.\n\n' +
      'Case files may also contain SPECIAL CATEGORY data under Article 6 (notably criminal convictions and security measures, and health data). Processing these is subject to stricter conditions and that assessment is yours to make for your own practice.\n\n' +
      'Your professional secrecy obligation under Article 36 of the Turkish Attorneyship Law is unaffected by this notice.',
  },
  {
    icon: 'flag-outline',
    title: '4. Purposes',
    body: 'Creating and securing your account; providing case, calendar, deadline, document and finance management; producing AI drafts and analyses on your request; managing subscriptions; detecting abuse; answering requests and complaints; meeting statutory retention and reporting duties.',
  },
  {
    icon: 'scale-outline',
    title: '5. Legal Grounds',
    body:
      '• Art. 5/2(c) — necessary for the performance of the contract\n• Art. 5/2(ç) — legal obligation of the controller\n• Art. 5/2(e) — establishment, exercise or protection of a right\n• Art. 5/2(f) — legitimate interest (security, abuse prevention, error logs)\n• Art. 5/1 — EXPLICIT CONSENT, only for AI features and the related transfer abroad\n\n' +
      RIZA_KOSUL_EN,
  },
  { icon: 'globe-outline', title: '6. Recipients and Transfers Abroad', body: aliciMetni(false) },
  { icon: 'shield-half-outline', title: '7. Not Sent to AI', body: AI_KAPSAM_DISI.map((x) => `• ${x}`).join('\n') },
  {
    icon: 'download-outline',
    title: '8. Method of Collection',
    body: 'Electronically and by partly automated means: information you enter, documents you upload, and technical records generated while you use the app.',
  },
  {
    icon: 'time-outline',
    title: '9. Retention and Erasure',
    body: 'Records are kept while your account is active and for applicable limitation periods. On deletion they are erased from the live database and from our nightly (21-day) and monthly (12-month) backups. Our cloud provider’s own snapshot cannot be filtered per user; it expires within 7 days at most and is accessible only for disaster recovery in that period.',
  },
  {
    icon: 'lock-closed-outline',
    title: '10. Security',
    body: '• TLS in transit, AES-256 at rest\n• Row-level security: each user reaches only their own records\n• Maintenance endpoints restricted to service credentials\n• Encrypted session storage on device; optional biometric lock\n• Regular backups with restore checks',
  },
  {
    icon: 'hand-right-outline',
    title: '11. Your Rights (Art. 11)',
    body: 'To learn whether your data is processed; request information; learn the purpose; know domestic and foreign recipients; request correction; request erasure under Article 7; request notification of these to third parties; object to adverse results of solely automated analysis; and claim compensation for unlawful processing. Erasure is available directly in Settings > Delete Account.',
  },
  {
    icon: 'mail-outline',
    title: '12. How to Apply (Art. 13)',
    body: kimlikTamMi()
      ? `Apply in writing to the address above or by e-mail to ${VERI_SORUMLUSU.eposta}. We respond within thirty days. If refused, found insufficient or unanswered in time, you may complain to the Personal Data Protection Board within thirty days of learning the response and in any case sixty days of the application (Art. 14).`
      : 'A dedicated application channel has not yet been published. Until then use Settings > Feedback in the app. Your right to complain to the Board remains (Art. 14).',
  },
  {
    icon: 'create-outline',
    title: '13. Statement of Explicit Consent',
    body:
      '“I give my explicit consent, freely and on an informed basis under Articles 5/1 and 9 of Law No. 6698, for the text and documents I personally enter into the AI features to be transferred to the AI service providers listed in section 6, which are located abroad.”\n\n' +
      (RIZA_ZORUNLU
        ? 'This consent is CURRENTLY required in order to register — a practice disclosed and questioned in section 5. '
        : 'This consent is not a condition of service. ') +
      'It is not bundled with other approvals and may be withdrawn at any time. It is recorded with its date and notice version; the record is never overwritten and withdrawal is stored as a separate entry.',
  },
];

/** Metnin bölümleri — imza penceresi ilerlemeyi hesaplamak için sayıyı bilmeli. */
export function kvkkBolumleri(tr: boolean): Bolum[] {
  return tr ? TR : EN;
}

/**
 * Aydınlatma metninin gövdesi. Kendi kaydırıcısı YOKTUR: çağıran taraf onu bir
 * ScrollView içine koyar. İmza penceresinin okuma ilerlemesini ölçebilmesi
 * ancak böyle mümkün — içeride ikinci bir kaydırıcı olsaydı dıştaki hiç
 * kımıldamaz, "sona gelindi" ölçümü daima doğru çıkardı (yani yalan söylerdi).
 */
export function KvkkGovde({ tr }: { tr: boolean }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const eksik = !kimlikTamMi();

  return (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
        </View>
        <Text style={styles.heroText}>
          {tr
            ? '6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca hazırlanmıştır. Bu metin, uygulamanın gerçekte ne yaptığını anlatır.'
            : 'Prepared under Article 10 of Turkish Law No. 6698. This notice describes what the application actually does.'}
        </Text>
      </View>

      {eksik && (
        <Card style={styles.uyari}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={styles.sectionTitle}>{tr ? 'Eksik bildirim' : 'Incomplete notice'}</Text>
          </View>
          <Text style={styles.sectionBody}>
            {tr
              ? 'Veri sorumlusunun kimlik ve başvuru bilgileri henüz yayımlanmamıştır. Bu metin, o alanlar doldurulana kadar Kanun’un biçim şartını tam karşılamaz. Size gizlemek yerine bildiriyoruz.'
              : 'The controller’s identity and application details have not yet been published. Until those fields are completed this notice does not fully satisfy the statutory form. We disclose this rather than hide it.'}
          </Text>
        </Card>
      )}

      {kvkkBolumleri(tr).map((s) => (
        <Card key={s.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>{s.title}</Text>
          </View>
          <Text style={styles.sectionBody}>{s.body}</Text>
        </Card>
      ))}

      <Text style={styles.updated}>{tr ? `Metin sürümü: ${KVKK_SURUM}` : `Notice version: ${KVKK_SURUM}`}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: spacing.md },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
  uyari: { marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.warning },
  section: { marginBottom: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, flexShrink: 1 },
  sectionBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 21 },
  updated: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
