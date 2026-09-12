// KVKK AYDINLATMA METNİ (6698 sayılı Kanun m.10).
// ---------------------------------------------------------------------------
// NEDEN AYRI BİR SAYFA. Gizlilik metni "verileriniz güvende" anlatır; aydınlatma
// metni BAŞKA BİR ŞEYDİR ve biçimi kanunla belirlidir: veri sorumlusunun
// kimliği, işlenen veriler, işleme amaçları, HUKUKİ SEBEP, aktarılan taraflar
// ve ülkeler, saklama süresi, m.11 hakları, başvuru yolu. İkisini tek sayfada
// karıştırmak, kanunun istediği bilgiyi pazarlama diline gömmek olur.
//
// DÜRÜSTLÜK KURALI BURADA DA GEÇERLİ: metin, kodun gerçekte yaptığını yazar.
// Veri gönderilen tüm sağlayıcılar src/config/kvkk.ts'te KODDAN OKUNARAK
// listelendi; oradan tek kaynak olarak geliyor. Bir sağlayıcı eklenirse
// aydınlatma metni kendiliğinden güncellenir.
//
// ⚠️ VERİ SORUMLUSU KİMLİĞİ HENÜZ BOŞ. Uydurulamaz. Boş olduğu sürece sayfa
// bunu kullanıcıdan GİZLEMEZ — eksik olduğunu açıkça yazar. Bu, yanlış kimlik
// bildirmekten iyidir ve alan doldurulunca uyarı kendiliğinden kaybolur.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { useLangStore } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { ALICILAR, AI_KAPSAM_DISI, KVKK_SURUM, VERI_SORUMLUSU, kimlikTamMi } from '@/config/kvkk';

interface Bolum {
  icon: string;
  title: string;
  body: string;
}

function sorumluMetni(tr: boolean): string {
  const v = VERI_SORUMLUSU;
  if (!kimlikTamMi(v)) {
    return tr
      ? 'Bu alan HENÜZ DOLDURULMAMIŞTIR. Vekil Pro’yu işleten gerçek/tüzel kişinin unvanı, açık adresi ve başvuru e-postası yayımlanmadan bu aydınlatma metni Kanun’un m.10 biçim şartını tam karşılamaz. Eksiklik burada saklanmamakta, açıkça bildirilmektedir.'
      : 'This field has NOT YET been completed. Until the operator’s legal name, address and contact e-mail are published, this notice does not fully meet the formal requirements of Article 10. The gap is disclosed here rather than hidden.';
  }
  const satir = [
    `${tr ? 'Unvan' : 'Name'}: ${v.unvan}`,
    `${tr ? 'Adres' : 'Address'}: ${v.adres}`,
    `${tr ? 'Başvuru e-postası' : 'Contact e-mail'}: ${v.eposta}`,
  ];
  if (v.kep) satir.push(`KEP: ${v.kep}`);
  if (v.mersis) satir.push(`MERSİS: ${v.mersis}`);
  satir.push(v.verbis ? `VERBİS: ${v.verbis}` : (tr ? 'VERBİS: kayıt yükümlülüğü değerlendirilmektedir' : 'VERBİS: registration obligation under assessment'));
  return satir.join('\n');
}

function aliciMetni(tr: boolean): string {
  return ALICILAR.map((a) => `• ${a.ad}\n   ${tr ? 'Ülke' : 'Country'}: ${a.ulke}\n   ${tr ? 'Amaç' : 'Purpose'}: ${a.amac}`).join('\n\n');
}

function bolumler(tr: boolean): Bolum[] {
  if (!tr) {
    return [
      { icon: 'business-outline', title: '1. Data Controller', body: sorumluMetni(false) },
      {
        icon: 'document-text-outline',
        title: '2. Personal Data Processed',
        body: '• Identity and contact: name, e-mail, phone (optional), firm name\n• Transaction: your case, client, hearing, task, document and finance records\n• Technical: app version, error logs, session records\n• Text you submit to AI features\n\nIMPORTANT: your case and client records may contain personal data of THIRD PARTIES (your clients, opposing parties, witnesses). For that data you are the controller and we act as processor.',
      },
      {
        icon: 'flag-outline',
        title: '3. Purposes',
        body: 'Creating and securing your account; providing case, calendar, document and finance management; producing AI drafts and analyses on request; managing subscriptions; detecting abuse; meeting legal obligations.',
      },
      {
        icon: 'scale-outline',
        title: '4. Legal Grounds (Art. 5)',
        body: '• Necessary for performance of the contract — account, case, document and subscription functions\n• Legitimate interest — security, abuse prevention, error logs\n• Legal obligation — tax and record-keeping duties\n• EXPLICIT CONSENT — transfer abroad to AI providers (see section 5). AI features do not run without your explicit consent; every other feature works regardless.',
      },
      { icon: 'globe-outline', title: '5. Recipients and Transfers Abroad (Art. 9)', body: aliciMetni(false) },
      { icon: 'shield-half-outline', title: '6. Not Sent to AI', body: AI_KAPSAM_DISI.map((x) => `• ${x}`).join('\n') },
      {
        icon: 'time-outline',
        title: '7. Retention',
        body: 'Your records are kept while your account is active. On deletion they are erased from the live database and from our nightly (21-day) and monthly (12-month) backups. Our cloud provider’s own infrastructure snapshot cannot be filtered per user; it expires within 7 days at most and is accessible only for disaster recovery during that period.',
      },
      {
        icon: 'hand-right-outline',
        title: '8. Your Rights (Art. 11)',
        body: 'You may learn whether your data is processed, request information, learn the purpose, know the recipients, request correction or erasure, request notification of these to third parties, object to results of automated analysis, and claim damages for unlawful processing.',
      },
      {
        icon: 'mail-outline',
        title: '9. How to Apply (Art. 13)',
        body: kimlikTamMi()
          ? `Apply in writing to the address above or by e-mail to ${VERI_SORUMLUSU.eposta}. We respond within 30 days at the latest. You may also use Settings > Feedback in the app.`
          : 'A dedicated application channel has not yet been published. Until then you may use Settings > Feedback in the app; this is disclosed as a known gap.',
      },
    ];
  }
  return [
    { icon: 'business-outline', title: '1. Veri Sorumlusu', body: sorumluMetni(true) },
    {
      icon: 'document-text-outline',
      title: '2. İşlenen Kişisel Veriler',
      body: '• Kimlik ve iletişim: ad soyad, e-posta, telefon (isteğe bağlı), büro adı\n• İşlem verisi: dava, müvekkil, duruşma, görev, belge ve finans kayıtlarınız\n• Teknik veri: uygulama sürümü, hata kayıtları, oturum kayıtları\n• Yapay zekâ özelliklerine kendi elinizle girdiğiniz metinler\n\nÖNEMLİ: dava ve müvekkil kayıtlarınız ÜÇÜNCÜ KİŞİLERİN (müvekkilleriniz, karşı taraf, tanıklar) kişisel verilerini içerebilir. O veriler bakımından VERİ SORUMLUSU SİZSİNİZ; Vekil Pro yalnızca veri işleyen sıfatıyla hareket eder. Müvekkillerinize karşı aydınlatma ve rıza yükümlülüğü size aittir.',
    },
    {
      icon: 'flag-outline',
      title: '3. İşleme Amaçları',
      body: 'Hesabınızın oluşturulması ve güvenliğinin sağlanması; dava, ajanda, belge ve finans yönetimi hizmetinin sunulması; talebiniz üzerine yapay zekâ ile taslak ve çözümleme üretilmesi; abonelik süreçlerinin yürütülmesi; kötüye kullanımın tespiti; mevzuattan doğan yükümlülüklerin yerine getirilmesi.',
    },
    {
      icon: 'scale-outline',
      title: '4. Hukuki Sebepler (m.5)',
      body: '• Sözleşmenin kurulması ve ifası için zorunlu olması — hesap, dava, belge ve abonelik işlevleri\n• Meşru menfaat — güvenlik, kötüye kullanımın önlenmesi, hata kayıtları\n• Hukuki yükümlülük — vergi ve saklama ödevleri\n• AÇIK RIZA — yapay zekâ sağlayıcılarına yurt dışı aktarım (bkz. 5. başlık). Açık rızanız olmadan yapay zekâ özellikleri ÇALIŞMAZ; diğer tüm özellikler rızadan bağımsız çalışır ve rızanızı geri almanız hizmetin kalanını etkilemez.',
    },
    { icon: 'globe-outline', title: '5. Aktarılan Taraflar ve Yurt Dışına Aktarım (m.9)', body: aliciMetni(true) },
    { icon: 'shield-half-outline', title: '6. Yapay Zekâya GÖNDERİLMEYENLER', body: AI_KAPSAM_DISI.map((x) => `• ${x}`).join('\n') },
    {
      icon: 'time-outline',
      title: '7. Saklama Süresi ve İmha',
      body: 'Kayıtlarınız hesabınız etkin olduğu sürece saklanır. Hesabınızı sildiğinizde canlı veritabanından ve her gece alınan (21 gün saklanan) ile her ay alınan (12 ay saklanan) yedeklerimizden silinir. Bulut sağlayıcımızın kendi altyapı anlık görüntüsü tek kullanıcı için ayıklanamaz; en geç 7 gün içinde süresi dolarak düşer ve bu süre boyunca yalnızca felaket kurtarma amacıyla erişilebilir.',
    },
    {
      icon: 'hand-right-outline',
      title: '8. Haklarınız (m.11)',
      body: 'Kişisel verinizin işlenip işlenmediğini öğrenme; işlenmişse bilgi talep etme; işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme; yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; silinmesini veya yok edilmesini isteme; bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle çözümleme sonucu aleyhinize bir sonuç doğmasına itiraz etme; kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.',
    },
    {
      icon: 'mail-outline',
      title: '9. Başvuru Yolu (m.13)',
      body: kimlikTamMi()
        ? `Başvurunuzu yukarıdaki adrese yazılı olarak ya da ${VERI_SORUMLUSU.eposta} adresine e-posta ile iletebilirsiniz. En geç 30 gün içinde yanıtlanır. Uygulama içinden Ayarlar > Öneri & Şikayet kanalını da kullanabilirsiniz.`
        : 'Kanunun aradığı ayrı bir başvuru kanalı HENÜZ YAYIMLANMAMIŞTIR. O güne kadar uygulama içinden Ayarlar > Öneri & Şikayet kanalını kullanabilirsiniz; bu eksiklik gizlenmemekte, burada bildirilmektedir.',
    },
  ];
}

export default function KvkkScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const lang = useLangStore((s) => s.lang);
  const tr = lang === 'tr';
  const eksik = !kimlikTamMi();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={tr ? 'KVKK Aydınlatma Metni' : 'KVKK Privacy Notice'} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
          </View>
          <Text style={styles.heroText}>
            {tr
              ? '6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca hazırlanmıştır. Bu metin, kodun gerçekte ne yaptığını anlatır.'
              : 'Prepared under Article 10 of Turkish Law No. 6698. This notice describes what the code actually does.'}
          </Text>
        </View>

        {eksik && (
          <Card style={styles.uyari}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning-outline" size={18} color={colors.warning ?? colors.primary} />
              <Text style={styles.sectionTitle}>{tr ? 'Eksik bildirim' : 'Incomplete notice'}</Text>
            </View>
            <Text style={styles.sectionBody}>
              {tr
                ? 'Veri sorumlusunun kimlik ve başvuru bilgileri henüz yayımlanmamıştır. Bu metin, o alanlar doldurulana kadar Kanun’un biçim şartını tam karşılamaz. Bunu size gizlemek yerine bildiriyoruz.'
                : 'The controller’s identity and application details have not yet been published. Until those fields are completed this notice does not fully satisfy the statutory form. We disclose this rather than hide it.'}
            </Text>
          </Card>
        )}

        {bolumler(tr).map((s) => (
          <Card key={s.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </Card>
        ))}

        <Text style={styles.updated}>{tr ? `Metin sürümü: ${KVKK_SURUM}` : `Notice version: ${KVKK_SURUM}`}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
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
  uyari: { marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  section: { marginBottom: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, flexShrink: 1 },
  sectionBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  updated: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
