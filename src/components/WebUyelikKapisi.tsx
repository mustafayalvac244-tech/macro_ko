// WEB SÜRÜMÜ YALNIZ ÜYELERE — arayüz kapısı.
// ---------------------------------------------------------------------------
// ÜRÜN KARARI (2026-09-11): tarayıcı sürümü Vekil Pro üyelerine özeldir.
// Mobil uygulama ücretsiz katmanla kullanılabilmeye devam eder; web, üyeliğin
// görünür bir karşılığı olur ve uygulamada bu şekilde tanıtılır.
//
// BU BİR GÜVENLİK SINIRI DEĞİLDİR. Verinin gerçek koruması sunucudaki RLS
// politikalarıdır; burası yalnız arayüzü kapatır. Bunu karıştırmak tehlikeli
// olurdu: "web kapalı" diye sunucu tarafında gevşeklik yapılamaz.
//
// ÜÇ DAVRANIŞ, BİLEREK BU SIRADA:
//   1. Natifte hiçbir şey yapmaz — telefon/tablet sürümü herkese açık.
//   2. Oturum yoksa hiçbir şey yapmaz — kullanıcının GİRİŞ YAPABİLMESİ
//      gerekir, yoksa üye olan da içeri giremez.
//   3. Profil HENÜZ OKUNMADIYSA da hiçbir şey yapmaz. Profil asenkron
//      geliyor; burada beklemeden kapatsaydık ödeme yapmış avukat her
//      açılışta önce "üyelere özel" ekranını görürdü.
//
// KASITLI OLARAK AÇIK TARAFA DÜŞER: profil okunamazsa (ağ hatası) kapı
// kapanmaz. Ödemiş bir avukatı geçici bir arızayla dışarıda bırakmak,
// ödememiş birinin arayüzü görmesinden pahalıdır.
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/store/authStore';
import { WEB_YALNIZ_UYELERE } from '@/config/web';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import { radius, spacing, typography } from '@/theme/theme';
import type { ThemeColors } from '@/theme/palettes';

export function WebUyelikKapisi({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const kapali =
    WEB_YALNIZ_UYELERE &&
    Platform.OS === 'web' &&
    !!session &&
    !!profile && // profil okunmadan ASLA kapatma (bkz. başlık)
    !profile.is_premium;

  if (!kapali) return <>{children}</>;
  return <UyelereOzel />;
}

function UyelereOzel() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);

  return (
    <View style={styles.kok}>
      <View style={styles.kart}>
        <View style={styles.rozet}>
          <Ionicons name="desktop-outline" size={18} color={__t.colors.gold} />
          <Text style={styles.rozetYazi}>{t('web.gateBadge')}</Text>
        </View>

        <Text style={styles.baslik}>{t('web.gateTitle')}</Text>
        <Text style={styles.metin}>{t('web.gateBody')}</Text>

        {/* SATIN ALMA WEB'DE YAPILAMAZ ve bunu saklamıyoruz: abonelik
            mağaza üzerinden (App Store / Google Play) satılıyor, tarayıcıda
            böyle bir akış YOK. "Abone ol" düğmesi koyup hiçbir şey
            yapmamasındansa, nereden alınacağını yazmak dürüst olan. */}
        <View style={styles.adimlar}>
          <Adim n="1" yazi={t('web.gateStep1')} styles={styles} />
          <Adim n="2" yazi={t('web.gateStep2')} styles={styles} />
          <Adim n="3" yazi={t('web.gateStep3')} styles={styles} />
        </View>

        {!!profile?.email && (
          <Text style={styles.hesap}>{t('web.gateAccount', { eposta: profile.email })}</Text>
        )}

        <View style={styles.dugmeler}>
          {/* "Siteye git" gibi bir düğme YOK — kullanıcı zaten sitede.
              Tek gerçek eylem, başka (üye olan) bir hesapla girebilmek. */}
          <Pressable style={styles.cikis} onPress={() => { void signOut(); }}>
            <Text style={styles.cikisYazi}>{t('web.gateSignOut')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Adim({ n, yazi, styles }: { n: string; yazi: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.adim}>
      <View style={styles.adimNo}>
        <Text style={styles.adimNoYazi}>{n}</Text>
      </View>
      <Text style={styles.adimYazi}>{yazi}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    kok: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    kart: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.md,
    },
    rozet: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: `${colors.gold}1A`,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
    },
    rozetYazi: { ...typography.small, color: colors.gold, letterSpacing: 0.4 },
    baslik: { ...typography.h2, color: colors.textPrimary },
    metin: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
    adimlar: { gap: spacing.sm, marginTop: spacing.xs },
    adim: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    adimNo: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adimNoYazi: { ...typography.small, color: '#FFFFFF' },
    adimYazi: { ...typography.body, color: colors.textSecondary, flex: 1, lineHeight: 21 },
    hesap: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    dugmeler: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
    cikis: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cikisYazi: { ...typography.bodyMedium, color: colors.textSecondary },
  });
