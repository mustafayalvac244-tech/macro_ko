import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { MONTHLY_PRICE_TRY, AI_PRICE_TRY, AI_SORU_HAKKI, AI_ASIL_MODEL_HAKKI, AI_MUTALAA_HAKKI, DENEME_SORU_HAKKI } from '@/hooks/useTrialStatus';
import { AI_MUTALAA_ENABLED } from '@/config/features';
import { UCRETSIZ_LIMIT } from '@/config/planlar';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * KULLANIM KOŞULLARI (EULA).
 *
 * NEDEN EKLENDİ. Apple, otomatik yenilenen abonelik satan uygulamalarda hem
 * Gizlilik Politikası'na hem KULLANIM KOŞULLARI'na uygulama içinde erişim
 * ister (App Store Review 3.1.2 ve Schedule 2). Uygulamada gizlilik metni
 * vardı, kullanım koşulları HİÇ YOKTU — bu tek başına ret sebebidir.
 *
 * Ayrıca burası, bir hukuk uygulamasında atlanmaması gereken iki şeyi açıkça
 * yazdığımız yer: (1) yapay zekâ çıktısı hukuki tavsiye değildir ve avukatın
 * kendi denetimi olmadan kullanılamaz, (2) mesleki sorumluluk kullanıcıdadır.
 * Bunu yazmamak, bir madde numarası hatasının faturasını bize çıkarır.
 *
 * DÜRÜSTLÜK NOTU: bu metin bir hukukçu tarafından denetlenmedi. Ticari
 * yayına çıkmadan önce bir avukata okutulması gerekir; burada üretilen şey
 * "mağaza incelemesini geçecek ve kullanıcıyı yanıltmayan" bir taslaktır,
 * hukuki mütalaa değildir.
 */

interface Section {
  icon: string;
  title: string;
  body: string;
}

const sectionsTr = (): Section[] => [
  {
    icon: 'person-circle-outline',
    title: '1. Kimler Kullanabilir',
    body: 'Vekil Pro yalnızca avukatlar ve hukuk büroları için tasarlanmıştır; MESLEKİ ve TİCARİ amaçla, bir hukuk bürosunun faaliyeti kapsamında kullanılır. Kişisel/ev içi tüketim amaçlı bir hizmet değildir. Kayıt sırasında verdiğiniz baro ve sicil bilgilerinin doğru olduğunu beyan edersiniz. Hesabınızı başkasıyla paylaşamaz, devredemezsiniz; hesabınızdan yapılan işlemlerden siz sorumlusunuz.',
  },
  {
    icon: 'mail-open-outline',
    title: '2. E-posta Doğrulaması ve Hesap Güvenliği',
    body: 'Hesabınızı kullanabilmeniz için kayıt sırasında verdiğiniz e-posta adresini doğrulamanız gerekir; kutunuza gönderilen bağlantıya tıklamadan giriş yapılamaz. Bu adım hem başkasının e-postanızla hesap açmasını engeller hem de şifrenizi unuttuğunuzda hesabınızı kurtarabilmenizi güvence altına alır. Bu nedenle gerçek ve erişebildiğiniz bir adres vermeniz zorunludur. Kayıt, giriş ve şifre sıfırlama adımlarında otomatik/toplu isteklere karşı bir güvenlik doğrulaması (captcha) çalışabilir; bu doğrulama normal kullanımda sizden herhangi bir işlem istemez.',
  },
  {
    icon: 'card-outline',
    title: '3. Abonelikler ve Ücretlendirme',
    body:
      `• Ücretsiz: 0 ₺. İçtihat araması (Yargıtay, Danıştay, istinaf, yerel) SINIRSIZ ve süresizdir; mevzuat, hesaplayıcılar, dilekçe şablonları, duruşma/görev/ajanda ve hatırlatmalar da sınırsızdır. ${UCRETSIZ_LIMIT.dava} dava, ${UCRETSIZ_LIMIT.muvekkil} müvekkil ve ${UCRETSIZ_LIMIT.belge} belge kaydedilebilir.\n` +
      `• Vekil Pro (temel): aylık ${MONTHLY_PRICE_TRY} ₺. Sınırsız dava, müvekkil ve belge; finans modülü ve raporlar. Deneme süresi yoktur; ücretsiz plan süresizdir.\n` +
      `• Vekil Pro + Yapay Zekâ: aylık ${AI_PRICE_TRY.toLocaleString('tr-TR')} ₺. Temel paketteki her şeyi içerir.\n\n` +
      'İçtihat aramasının ücretsiz olması bir kampanya değil, ürünün kalıcı kuralıdır; ileride ücretli hâle getirilmeyecektir. Ücretli plana geçmezseniz mevcut kayıtlarınız silinmez ve erişilebilir kalır; yalnız yeni kayıt ekleme sınıra tabidir.\n\n' +
      'Abonelikler otomatik olarak yenilenir. Yenilemeyi durdurmak için dönem bitiminden en az 24 saat önce cihazınızın App Store / Google Play hesap ayarlarından aboneliği kapatmanız gerekir. Ücret, dönem bitiminden önceki 24 saat içinde tahsil edilir.',
  },
  {
    icon: 'wallet-outline',
    title: '4. Ödeme ve İptal',
    body: 'Ödemeler Apple App Store veya Google Play üzerinden alınır; kart bilgileriniz bize hiçbir zaman ulaşmaz. Abonelik iptali ve iade talepleri, satın almayı yaptığınız mağazanın kuralları ve süreleri kapsamında ilgili mağaza üzerinden yürütülür. Aboneliği iptal ettiğinizde ücretli dönem sonuna kadar erişiminiz sürer; dönem bitince hesabınız ücretsiz plana döner ve kayıtlarınız silinmez.',
  },
  {
    icon: 'sparkles-outline',
    title: '5. Yapay Zekâ Kullanım Hakları',
    body: AI_MUTALAA_ENABLED
      ? `Yapay Zekâ paketi aylık ${AI_SORU_HAKKI} soru ve ${AI_MUTALAA_HAKKI} hukuki mütalaa hakkı içerir. Aylık hakkın ilk ${AI_ASIL_MODEL_HAKKI} isteği en yetenekli modelle karşılanır; aynı ay içindeki sonraki istekler daha hızlı ve daha hafif bir modele yönlendirilir — istek reddedilmez, yalnız çıktıyı üreten model değişir. Haklar her fatura döneminde yenilenir, kullanılmayan haklar sonraki aya devretmez. Ücretsiz hesaplara ${DENEME_SORU_HAKKI} adet deneme sorusu tanımlanır.`
      : `Yapay Zekâ paketi aylık ${AI_SORU_HAKKI} soru hakkı içerir. Aylık hakkın ilk ${AI_ASIL_MODEL_HAKKI} isteği en yetenekli modelle karşılanır; aynı ay içindeki sonraki istekler daha hızlı ve daha hafif bir modele yönlendirilir — istek reddedilmez, yalnız çıktıyı üreten model değişir. Haklar her fatura döneminde yenilenir, kullanılmayan haklar sonraki aya devretmez. Ücretsiz hesaplara ${DENEME_SORU_HAKKI} adet deneme sorusu tanımlanır. Bazı yapay zekâ özellikleri kademeli olarak açılmaktadır; satın alma ekranında yalnızca o an kullanılabilir olan özellikler listelenir.`,
  },
  {
    icon: 'warning-outline',
    title: '6. Yapay Zekâ Çıktısı Hukuki Tavsiye Değildir',
    body: 'Uygulamanın ürettiği dilekçe, mütalaa, özet ve analizler TASLAKTIR. Yapay zekâ hata yapabilir; madde numarası, süre, görevli mahkeme ve içtihat bilgisi yanlış olabilir. Her çıktıyı yayımlamadan, mahkemeye sunmadan veya müvekkile iletmeden önce kendiniz denetlemek zorundasınız. Mesleki sorumluluk münhasıran size aittir; Vekil Pro bir hukuki danışmanlık hizmeti değildir ve avukat-müvekkil ilişkisi kurmaz.',
  },
  {
    icon: 'lock-closed-outline',
    title: '7. Müvekkil Verisi ve Sır Saklama',
    body: 'Uygulamaya girdiğiniz müvekkil verilerinin hukuka uygun şekilde işlendiğinden ve gerekli aydınlatma/rıza yükümlülüklerinin yerine getirildiğinden siz sorumlusunuz. Kayıtlarınız yurt dışındaki (İrlanda / AB — ölçüldü: Supabase bölgesi eu-west-1) sunucularda barındırılır. AYRICA yapay zekâ özelliklerini kullandığınızda o isteğe kendi elinizle girdiğiniz metin, ABD merkezli yapay zekâ sağlayıcılarına aktarılır; bu aktarım açık rızanıza bağlıdır. KVKK kapsamında yurt dışına aktarım değerlendirmesini kendi büronuz için ve müvekkilleriniz bakımından yapmanız gerekir. Ayrıntı için Gizlilik ve KVKK metnine bakınız.',
  },
  {
    icon: 'ban-outline',
    title: '8. Yasak Kullanımlar',
    body: 'Uygulamayı tersine mühendislik yapmak, otomatik araçlarla toplu veri çekmek, başka kullanıcıların bilgilerini toplamak, hizmeti aşırı yükleyecek istek göndermek ve hukuka aykırı içerik üretmek için kullanamazsınız. Bu kuralların ihlali hesabın askıya alınması veya kapatılması sonucunu doğurabilir.',
  },
  {
    icon: 'construct-outline',
    title: '9. Hizmetin Sürekliliği',
    body: 'Hizmet "olduğu gibi" sunulur. Bakım, sağlayıcı arızası veya güncelleme nedeniyle geçici kesintiler olabilir. Özellikler zaman içinde eklenebilir, değiştirilebilir veya kaldırılabilir; ücretli bir özelliği kaldırmamız hâlinde bu durum abonelik ekranında açıkça belirtilir.',
  },
  {
    icon: 'person-remove-outline',
    title: '10. Hesabın Kapatılması',
    body: 'Hesabınızı istediğiniz zaman Ayarlar > Hesabı Sil adımıyla kalıcı olarak silebilirsiniz. Silme işlemi geri alınamaz ve belgeler dahil tüm kayıtlarınızı kapsar; yedeklerdeki kopyaların ne olduğu 13. maddede ayrıca açıklanmıştır. Hesabın silinmesi, mağaza üzerinden alınmış aboneliği otomatik olarak iptal ETMEZ; aboneliği ayrıca App Store / Google Play üzerinden kapatmanız gerekir.',
  },
  {
    icon: 'document-text-outline',
    title: '11. Değişiklikler ve İletişim',
    body: 'Bu koşullar güncellenebilir; önemli değişikliklerde uygulama içinde bilgilendirme yapılır. Soru ve talepleriniz için Ayarlar > Öneri & Şikayet kanalını kullanabilirsiniz.',
  },
  {
    icon: 'alarm-outline',
    title: '12. Süre ve Duruşma Hatırlatmaları Garanti Değildir',
    body: 'Uygulamanın verdiği süre hesapları ve gönderdiği duruşma/süre hatırlatmaları YARDIMCI araçtır; sürenin takibi HER HÂLÜKÂRDA avukata aittir. Bildirimler cihaz kapalıyken, bildirim izni verilmediğinde, uygulama kaldırıldığında, telefon değiştirildiğinde, işletim sisteminin pil/arka plan kısıtları devredeyken veya mağaza/işletim sistemi tarafındaki bir arıza hâlinde ULAŞMAYABİLİR. Ayrıca iOS, bir uygulamanın bekleyen yerel bildirim sayısını 64 ile sınırlar; çok sayıda duruşma girildiğinde bu sınır nedeniyle bir kısım hatırlatma planlanamayabilir — uygulama en yakın tarihli olanlara öncelik verir. Süre hesapları adli tatil, resmî tatil ve hafta sonu kurallarını uygular ancak dinî bayram tarihleri ve mahkeme uygulamalarındaki istisnalar hesaba KATILMAZ. Bu nedenle hiçbir hatırlatma, süreyi kaçırmadığınızın güvencesi olarak kabul edilemez ve kaçırılan süreden doğan zararlardan Vekil Pro sorumlu tutulamaz.',
  },
  {
    icon: 'cloud-download-outline',
    title: '13. Yedekleme ve Veri Kaybı',
    body: 'Verileriniz sağlayıcının altyapısında tutulur; bununla birlikte hesabınıza ait verilerin YEDEĞİNİ ALMAK sizin sorumluluğunuzdadır. Uygulama, dışa aktarma (CSV/metin) imkânı sunar. Kullanıcı hatası, hesabın silinmesi, sağlayıcı arızası, siber saldırı veya mücbir sebep hâlinde oluşabilecek veri kaybından; verinin yeniden oluşturulmasının maliyetinden ve bu kayıptan doğan dolaylı zararlardan Vekil Pro sorumlu değildir.\n\nYEDEKLERİN KAPSAMI VE SÜRESİ (açıkça bildirilir): Veri kaybına karşı iki katman tutulur — (a) her gece alınan ve YİRMİ BİR (21) GÜN saklanan veritabanı kopyası, (b) her ayın başında alınan ve ON İKİ (12) AY saklanan aylık kopya. Bu kopyalar yalnızca hatalı silme, bozulma ya da arıza hâlinde kurtarma amacıyla tutulur; talep üzerine size tek tek kayıt geri yükleme hizmeti sunulacağı anlamına GELMEZ. Ayrıca bulut sağlayıcımız (Supabase) kendi altyapısında günlük yedek alır ve bunu YEDİ (7) GÜN saklar.\n\nHESABI SİLDİĞİNİZDE: Silme işlemi geri alınamaz. Silme anında kayıtlarınız yukarıdaki (a) ve (b) kopyalarından da silinir. Bulut sağlayıcısının kendi altyapı yedeği ise teknik olarak tek bir kullanıcı için ayıklanamaz; bu yedekteki kopya, en geç YEDİ (7) GÜN içinde saklama süresi dolarak kendiliğinden düşer. Bu süre içinde kaydınızın hiçbir amaçla kullanılmayacağını, yalnızca felaket kurtarma amacıyla erişilebilir kalacağını taahhüt ederiz.',
  },
  {
    icon: 'shield-outline',
    title: '14. Sorumluluğun Sınırı',
    body: 'Hizmet "olduğu gibi" ve "mevcut hâliyle" sunulur; belirli bir amaca uygunluk, kesintisizlik ve hatasızlık dâhil açık ya da örtülü hiçbir garanti verilmez. Vekil Pro; kâr kaybı, iş kaybı, müvekkil kaybı, itibar zararı, hak düşürücü süre veya zamanaşımının kaçırılması, yanlış ya da eksik çıktı kullanımı gibi DOLAYLI ve SONUÇ olarak doğan zararlardan sorumlu değildir. Her hâlükârda toplam sorumluluğumuz, zararın doğduğu olaydan önceki oniki (12) ay içinde bize fiilen ödediğiniz abonelik bedeli ile sınırlıdır; ücretsiz kullanımda bu tutar sıfırdır. Bu sınırlama, Türk Borçlar Kanunu m.115 uyarınca KASIT ve AĞIR KUSUR hâllerinde ve emredici hükümlerle sorumluluğun sınırlanamadığı diğer hâllerde UYGULANMAZ.',
  },
  {
    icon: 'people-circle-outline',
    title: '15. Tazmin (Rücu)',
    body: 'Uygulamayı bu koşullara, mevzuata veya Avukatlık Kanunu ile meslek kurallarına aykırı kullanmanız; uygulamaya hukuka aykırı biçimde veri girmeniz ya da ürettiğiniz bir çıktıyı denetlemeden kullanmanız nedeniyle üçüncü kişiler (müvekkiliniz dâhil) tarafından Vekil Pro aleyhine bir talep ileri sürülürse, bu talepten ve makul savunma giderlerinden doğan zararı tazmin etmeyi kabul edersiniz.',
  },
  {
    icon: 'business-outline',
    title: '16. Uygulanacak Hukuk ve Uyuşmazlık',
    body: 'Bu koşullara Türk hukuku uygulanır. Taraflar öncelikle uyuşmazlığı iyi niyetle çözmeye çalışır; talebinizi Ayarlar > Öneri & Şikayet kanalından iletebilirsiniz. Çözülemeyen uyuşmazlıklarda İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri yetkilidir. Bu yetki kaydı, tüketici sıfatıyla korunan kişilerin kanundan doğan yetkili mahkeme ve tüketici hakem heyetine başvuru haklarını ORTADAN KALDIRMAZ.',
  },
  {
    icon: 'hammer-outline',
    title: '17. Bu Uygulama Bir ARAÇTIR, Danışman Değildir',
    body: 'Vekil Pro bir hukuk bürosu yazılımıdır: kayıt tutar, süre hesabı ÖNERİR, mevzuat ve içtihat ARAR, dilekçe TASLAĞI çıkarır. Yaptığı iş bulmak, derlemek ve taslak yazmaktır — değerlendirmek, yorumlamak ve karar vermek değildir. Uygulama sizin adınıza hiçbir hukuki işlem yapmaz, hiçbir belgeyi mahkemeye ya da müvekkile göndermez, hiçbir süreyi sizin yerinize takip etmez ve hiçbir çıktısı hukuki mütalaa sayılamaz. Avukatlık Kanunu anlamında avukatlık faaliyeti yürütmez ve sizinle ya da müvekkilinizle avukat-müvekkil ilişkisi kurmaz. Uygulamanın ürettiği her metin TASLAKTIR; kullanılabilir hâle gelmesi sizin denetiminizle olur. Uygulamayı kullanmanız, dosyanızdaki mesleki sorumluluğunuzu ne azaltır ne de paylaştırır.',
  },
];

const sectionsEn = (): Section[] => [
  {
    icon: 'person-circle-outline',
    title: '1. Who May Use This App',
    body: 'Vekil Pro is built for lawyers and law firms. By registering you confirm that the bar and registration details you provide are accurate. You may not share or transfer your account.',
  },
  {
    icon: 'mail-open-outline',
    title: '2. Email Verification and Account Security',
    body: 'You must verify the email address you register with before you can use your account; sign-in is not possible until you click the link sent to your inbox. This prevents someone else from registering with your address and makes sure you can recover your account if you forget your password. A security check (captcha) may run during sign-up, sign-in and password reset to block automated abuse; in normal use it requires nothing from you.',
  },
  {
    icon: 'card-outline',
    title: '3. Subscriptions and Pricing',
    body:
      `• Free: 0 TRY. Case law search (Cassation, Council of State, appellate, local) is UNLIMITED and permanent; legislation, calculators, petition templates, hearings, tasks, calendar and reminders are unlimited too. You may store ${UCRETSIZ_LIMIT.dava} cases, ${UCRETSIZ_LIMIT.muvekkil} clients and ${UCRETSIZ_LIMIT.belge} documents.\n` +
      `• Vekil Pro (base): ${MONTHLY_PRICE_TRY} TRY per month. Unlimited cases, clients and documents; finance module and reports. There is no trial period; the free plan does not expire.\n` +
      `• Vekil Pro + AI: ${AI_PRICE_TRY.toLocaleString('en-US')} TRY per month, including everything in the base plan.\n\n` +
      'Free case law search is a permanent rule of the product, not a promotion; it will not become paid later. If you do not subscribe, your existing records are never deleted and stay accessible; only adding new records is subject to the limit.\n\n' +
      'Subscriptions renew automatically. To stop renewal, turn the subscription off in your App Store / Google Play account settings at least 24 hours before the period ends. Payment is charged within the 24 hours before renewal.',
  },
  {
    icon: 'wallet-outline',
    title: '4. Payment and Cancellation',
    body: 'Payments are processed by Apple App Store or Google Play; your card details never reach us. Cancellations and refunds follow the rules and time limits of the store where you purchased. When you cancel, your access continues until the end of the paid period; after that your account returns to the free plan and your records are not deleted.',
  },
  {
    icon: 'sparkles-outline',
    title: '5. AI Usage Allowances',
    body: AI_MUTALAA_ENABLED
      ? `The AI plan includes ${AI_SORU_HAKKI} questions and ${AI_MUTALAA_HAKKI} legal opinions per month. The first ${AI_ASIL_MODEL_HAKKI} requests each month are served by the most capable model; later requests in the same month are routed to a faster, lighter model — requests are not refused, only the model producing the output changes. Allowances reset each billing period and do not roll over. Free accounts get ${DENEME_SORU_HAKKI} trial questions.`
      : `The AI plan includes ${AI_SORU_HAKKI} questions per month. The first ${AI_ASIL_MODEL_HAKKI} requests each month are served by the most capable model; later requests in the same month are routed to a faster, lighter model — requests are not refused, only the model producing the output changes. Allowances reset each billing period and do not roll over. Free accounts get ${DENEME_SORU_HAKKI} trial questions. Some AI features are being rolled out gradually; the purchase screen lists only what is currently available.`,
  },
  {
    icon: 'warning-outline',
    title: '6. AI Output Is Not Legal Advice',
    body: 'Petitions, opinions, summaries and analyses produced by the app are DRAFTS. AI can be wrong about article numbers, deadlines, competent courts and case law. You must review every output before filing or sending it. Professional responsibility remains solely yours; Vekil Pro does not provide legal advice and creates no attorney-client relationship.',
  },
  {
    icon: 'lock-closed-outline',
    title: '7. Client Data and Confidentiality',
    body: 'You are responsible for processing client data lawfully and for meeting your own disclosure and consent obligations. Your records are hosted on servers in Ireland (EU — measured: Supabase region eu-west-1). IN ADDITION, when you use the AI features, the text you yourself enter in that request is transferred to AI providers based in the United States; that transfer depends on your explicit consent. You must carry out your own cross-border transfer assessment under KVKK, for your firm and for your clients. See the Privacy and KVKK notice for details.',
  },
  {
    icon: 'ban-outline',
    title: '8. Prohibited Use',
    body: 'You may not reverse engineer the app, scrape data in bulk, harvest other users\' information, overload the service, or generate unlawful content. Violations may lead to suspension or termination.',
  },
  {
    icon: 'construct-outline',
    title: '9. Availability',
    body: 'The service is provided "as is". Temporary interruptions may occur due to maintenance, provider outages or updates. Features may be added, changed or removed over time.',
  },
  {
    icon: 'person-remove-outline',
    title: '10. Closing Your Account',
    body: 'You can permanently delete your account from Settings > Delete Account. Deletion cannot be undone and covers all records including documents; what happens to backup copies is set out separately in section 13. Deleting the account does NOT automatically cancel a store subscription — cancel it separately in App Store / Google Play.',
  },
  {
    icon: 'document-text-outline',
    title: '11. Changes and Contact',
    body: 'These terms may be updated; significant changes will be announced in the app. For questions, use Settings > Feedback.',
  },
  {
    icon: 'alarm-outline',
    title: '12. Deadline and Hearing Reminders Are Not Guaranteed',
    body: 'Deadline calculations and hearing/deadline reminders are AIDS only; tracking deadlines remains the lawyer\u2019s responsibility in all cases. Notifications may NOT arrive when the device is off, notification permission was not granted, the app was removed, the phone was changed, battery/background restrictions are active, or the store/operating system fails. iOS also caps pending local notifications at 64 per app; with many hearings some reminders may not be scheduled because of that cap \u2014 the app prioritises the nearest dates. Deadline calculations apply judicial recess, public holidays and weekend rules, but do NOT account for religious holiday dates or court-specific practice. No reminder may therefore be treated as assurance that a deadline was not missed, and Vekil Pro is not liable for losses arising from a missed deadline.',
  },
  {
    icon: 'cloud-download-outline',
    title: '13. Backups and Data Loss',
    body: 'Your data is held on the provider\u2019s infrastructure; nevertheless, keeping a BACKUP of your data is your responsibility. The app offers export (CSV/text). Vekil Pro is not liable for data loss caused by user error, account deletion, provider failure, cyber attack or force majeure, nor for the cost of recreating data or any indirect loss arising from it.\n\nWHAT BACKUPS EXIST AND FOR HOW LONG (disclosed expressly): two layers are kept against data loss \u2014 (a) a nightly database copy retained for TWENTY-ONE (21) DAYS, and (b) a monthly copy taken at the start of each month and retained for TWELVE (12) MONTHS. These copies exist solely to recover from erroneous deletion, corruption or failure; they do NOT mean that per-record restoration will be provided to you on request. In addition, our cloud provider (Supabase) takes its own daily infrastructure backup and retains it for SEVEN (7) DAYS.\n\nWHEN YOU DELETE YOUR ACCOUNT: deletion cannot be undone. At the moment of deletion your records are also removed from copies (a) and (b) above. The cloud provider\u2019s own infrastructure backup cannot technically be filtered for a single user; that copy expires on its own within at most SEVEN (7) DAYS. During that window we undertake that your records will not be used for any purpose and will remain accessible solely for disaster recovery.',
  },
  {
    icon: 'shield-outline',
    title: '14. Limitation of Liability',
    body: 'The service is provided "as is" and "as available", with no warranty of any kind, express or implied, including fitness for a particular purpose, uninterrupted operation or freedom from error. Vekil Pro is not liable for INDIRECT or CONSEQUENTIAL loss such as lost profit, lost business, lost clients, reputational harm, missed limitation or preclusion periods, or use of incorrect or incomplete output. In any event our total liability is limited to the subscription fees actually paid to us in the twelve (12) months preceding the event; for free use that amount is zero. This limitation does NOT apply in cases of intent or gross negligence under Article 115 of the Turkish Code of Obligations, or wherever mandatory law does not permit liability to be limited.',
  },
  {
    icon: 'people-circle-outline',
    title: '15. Indemnity',
    body: 'If a third party (including your own client) brings a claim against Vekil Pro because you used the app contrary to these terms, the law or the Attorneys\u2019 Act and professional rules; entered data unlawfully; or used generated output without reviewing it, you agree to indemnify us for that claim and reasonable defence costs.',
  },
  {
    icon: 'business-outline',
    title: '16. Governing Law and Disputes',
    body: 'These terms are governed by Turkish law. The parties will first try to resolve any dispute in good faith; you can reach us via Settings > Feedback. Unresolved disputes are subject to the Istanbul (\u00c7a\u011flayan) Courts and Enforcement Offices. This clause does NOT remove the statutory venue rights or consumer arbitration committee rights of persons protected as consumers.',
  },
  {
    icon: 'hammer-outline',
    title: '17. This App Is a TOOL, Not an Adviser',
    body: 'Vekil Pro is law-office software: it keeps records, PROPOSES deadline calculations, SEARCHES legislation and case law, and produces petition DRAFTS. What it does is find, compile and draft — not assess, interpret or decide. The app performs no legal act on your behalf, sends no document to a court or client, tracks no deadline in your place, and none of its output may be treated as a legal opinion. It does not practise law within the meaning of the Attorneys\u2019 Act and forms no attorney-client relationship with you or your client. Every text it produces is a DRAFT; it becomes usable only through your review. Using the app neither reduces nor shares your professional responsibility in your file.',
  },
];

export default function TermsScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const sections = lang === 'tr' ? sectionsTr() : sectionsEn();

  return (
    <Screen genislik="dar" edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('legal.termsTitle')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="document-text" size={26} color={colors.primary} />
          </View>
          <Text style={styles.heroText}>{t('legal.termsIntro')}</Text>
        </View>

        {sections.map((s) => (
          <Card key={s.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </Card>
        ))}

        <Text style={styles.updated}>{t('legal.termsUpdated')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 21,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  sectionBody: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  updated: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
