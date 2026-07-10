import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface Section {
  icon: string;
  title: string;
  body: string;
}

const SECTIONS_TR: Section[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Verileriniz Kime Ait?',
    body: 'Vekil Pro\'ya girdiğiniz tüm veriler (dava, müvekkil, belge, ajanda kayıtları) yalnızca size aittir. Veriler hesabınıza özeldir; diğer kullanıcılar, yalnızca sizin açıkça paylaştığınız bilgileri (ör. mesajlaşma, Tevkil ilanları) görebilir.',
  },
  {
    icon: 'server-outline',
    title: 'Veriler Nerede Saklanır?',
    body: 'Verileriniz, sektör standardı şifreleme (aktarımda TLS, depolamada AES-256) kullanan Supabase bulut altyapısında saklanır. Veritabanı satır düzeyi güvenlik (RLS) ile korunur: her kullanıcı yalnızca kendi kayıtlarına erişebilir.',
  },
  {
    icon: 'document-text-outline',
    title: 'Hangi Veriler İşlenir?',
    body: '• Hesap bilgileri: ad soyad, e-posta, telefon (isteğe bağlı), büro adı, baro sicil no (isteğe bağlı)\n• Uygulama verileri: dava, müvekkil, duruşma, görev, belge ve finans kayıtlarınız\n• Teknik veriler: uygulama sürümü ve hata kayıtları (kişisel içerik olmadan)',
  },
  {
    icon: 'eye-off-outline',
    title: 'Verileriniz Satılmaz ve Paylaşılmaz',
    body: 'Verileriniz hiçbir üçüncü tarafa satılmaz, kiralanmaz veya reklam amacıyla paylaşılmaz. Yasal zorunluluk (mahkeme kararı vb.) dışında hiçbir veri kimseyle paylaşılmaz.',
  },
  {
    icon: 'finger-print-outline',
    title: 'Uygulama Güvenliği',
    body: 'Dilerseniz Ayarlar\'dan biyometrik kilit (parmak izi / Face ID) açabilirsiniz. Oturum bilgileriniz cihazınızda şifreli alanda (SecureStore) tutulur.',
  },
  {
    icon: 'person-remove-outline',
    title: 'Silme Hakkınız (KVKK m.7 ve m.11)',
    body: 'KVKK kapsamında verilerinize erişme, düzeltme ve silme hakkına sahipsiniz. Ayarlar > Hesabı Sil adımıyla hesabınızı ve TÜM verilerinizi kalıcı olarak silebilirsiniz. Silme işlemi geri alınamaz ve sunucudaki tüm kayıtlarınızı (belgeler dahil) kapsar.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'İletişim',
    body: 'Gizlilikle ilgili soru ve talepleriniz için Ayarlar > Öneri & Şikayet kanalını kullanabilirsiniz.',
  },
];

const SECTIONS_EN: Section[] = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Who Owns Your Data?',
    body: 'Everything you enter into Vekil Pro (cases, clients, documents, calendar) belongs to you alone. Other users can only see what you explicitly share (e.g. messages, job board posts).',
  },
  {
    icon: 'server-outline',
    title: 'Where Is It Stored?',
    body: 'Your data is stored on Supabase cloud infrastructure with industry-standard encryption (TLS in transit, AES-256 at rest). Row-level security ensures each user can only access their own records.',
  },
  {
    icon: 'document-text-outline',
    title: 'What Is Processed?',
    body: '• Account: name, email, phone (optional), firm name, bar number (optional)\n• App data: your case, client, hearing, task, document and finance records\n• Technical: app version and crash logs (without personal content)',
  },
  {
    icon: 'eye-off-outline',
    title: 'Never Sold or Shared',
    body: 'Your data is never sold, rented, or shared for advertising. Nothing is disclosed to anyone except where legally required (court order etc.).',
  },
  {
    icon: 'finger-print-outline',
    title: 'App Security',
    body: 'You can enable a biometric lock (fingerprint / Face ID) from Settings. Session credentials are kept in your device\'s encrypted storage (SecureStore).',
  },
  {
    icon: 'person-remove-outline',
    title: 'Your Right to Erasure',
    body: 'You have the right to access, correct and delete your data. Settings > Delete Account permanently removes your account and ALL data (documents included). This cannot be undone.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Contact',
    body: 'For privacy questions and requests, use Settings > Feedback.',
  },
];

export default function PrivacyScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const sections = lang === 'tr' ? SECTIONS_TR : SECTIONS_EN;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('privacy.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="lock-closed" size={26} color={colors.primary} />
          </View>
          <Text style={styles.heroText}>{t('privacy.intro')}</Text>
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

        <Text style={styles.updated}>{t('privacy.updated')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
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
  section: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flexShrink: 1,
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
    marginTop: spacing.sm,
  },
});
