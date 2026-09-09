import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { MONTHLY_PRICE_TRY, AI_PRICE_TRY, AI_SORU_HAKKI, AI_MUTALAA_HAKKI, DENEME_SORU_HAKKI } from '@/hooks/useTrialStatus';
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
    body: 'Vekil Pro yalnızca avukatlar ve hukuk büroları için tasarlanmıştır. Kayıt sırasında verdiğiniz baro ve sicil bilgilerinin doğru olduğunu beyan edersiniz. Hesabınızı başkasıyla paylaşamaz, devredemezsiniz.',
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
      ? `Yapay Zekâ paketi aylık ${AI_SORU_HAKKI} soru ve ${AI_MUTALAA_HAKKI} hukuki mütalaa hakkı içerir. Haklar her fatura döneminde yenilenir, kullanılmayan haklar sonraki aya devretmez. Ücretsiz hesaplara ${DENEME_SORU_HAKKI} adet deneme sorusu tanımlanır.`
      : `Yapay Zekâ paketi aylık ${AI_SORU_HAKKI} soru hakkı içerir. Haklar her fatura döneminde yenilenir, kullanılmayan haklar sonraki aya devretmez. Ücretsiz hesaplara ${DENEME_SORU_HAKKI} adet deneme sorusu tanımlanır. Bazı yapay zekâ özellikleri kademeli olarak açılmaktadır; satın alma ekranında yalnızca o an kullanılabilir olan özellikler listelenir.`,
  },
  {
    icon: 'warning-outline',
    title: '6. Yapay Zekâ Çıktısı Hukuki Tavsiye Değildir',
    body: 'Uygulamanın ürettiği dilekçe, mütalaa, özet ve analizler TASLAKTIR. Yapay zekâ hata yapabilir; madde numarası, süre, görevli mahkeme ve içtihat bilgisi yanlış olabilir. Her çıktıyı yayımlamadan, mahkemeye sunmadan veya müvekkile iletmeden önce kendiniz denetlemek zorundasınız. Mesleki sorumluluk münhasıran size aittir; Vekil Pro bir hukuki danışmanlık hizmeti değildir ve avukat-müvekkil ilişkisi kurmaz.',
  },
  {
    icon: 'lock-closed-outline',
    title: '7. Müvekkil Verisi ve Sır Saklama',
    body: 'Uygulamaya girdiğiniz müvekkil verilerinin hukuka uygun şekilde işlendiğinden ve gerekli aydınlatma/rıza yükümlülüklerinin yerine getirildiğinden siz sorumlusunuz. Verileriniz yurt dışındaki (İrlanda / AB) sunucularda barındırılır; KVKK kapsamında yurt dışına aktarım değerlendirmesini kendi büronuz için yapmanız gerekir. Ayrıntı için Gizlilik ve KVKK metnine bakınız.',
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
    body: 'Hesabınızı istediğiniz zaman Ayarlar > Hesabı Sil adımıyla kalıcı olarak silebilirsiniz. Silme işlemi geri alınamaz ve belgeler dahil tüm kayıtlarınızı kapsar. Hesabın silinmesi, mağaza üzerinden alınmış aboneliği otomatik olarak iptal ETMEZ; aboneliği ayrıca App Store / Google Play üzerinden kapatmanız gerekir.',
  },
  {
    icon: 'document-text-outline',
    title: '11. Değişiklikler ve İletişim',
    body: 'Bu koşullar güncellenebilir; önemli değişikliklerde uygulama içinde bilgilendirme yapılır. Soru ve talepleriniz için Ayarlar > Öneri & Şikayet kanalını kullanabilirsiniz.',
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
      ? `The AI plan includes ${AI_SORU_HAKKI} questions and ${AI_MUTALAA_HAKKI} legal opinions per month. Allowances reset each billing period and do not roll over. Free accounts get ${DENEME_SORU_HAKKI} trial questions.`
      : `The AI plan includes ${AI_SORU_HAKKI} questions per month. Allowances reset each billing period and do not roll over. Free accounts get ${DENEME_SORU_HAKKI} trial questions. Some AI features are being rolled out gradually; the purchase screen lists only what is currently available.`,
  },
  {
    icon: 'warning-outline',
    title: '6. AI Output Is Not Legal Advice',
    body: 'Petitions, opinions, summaries and analyses produced by the app are DRAFTS. AI can be wrong about article numbers, deadlines, competent courts and case law. You must review every output before filing or sending it. Professional responsibility remains solely yours; Vekil Pro does not provide legal advice and creates no attorney-client relationship.',
  },
  {
    icon: 'lock-closed-outline',
    title: '7. Client Data and Confidentiality',
    body: 'You are responsible for processing client data lawfully and for meeting your own disclosure and consent obligations. Data is hosted on servers in Ireland (EU). See the Privacy and KVKK notice for details.',
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
    body: 'You can permanently delete your account from Settings > Delete Account. Deletion cannot be undone and covers all records including documents. Deleting the account does NOT automatically cancel a store subscription — cancel it separately in App Store / Google Play.',
  },
  {
    icon: 'document-text-outline',
    title: '11. Changes and Contact',
    body: 'These terms may be updated; significant changes will be announced in the app. For questions, use Settings > Feedback.',
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
    <Screen edges={['top', 'left', 'right', 'bottom']}>
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
