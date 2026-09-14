import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * TEVKİL PANOSUNUN NATIVE KARŞILIĞI — bilerek işlevsiz.
 *
 * NEDEN VAR. Pano ve yazışma 14.09.2026'da ürün sahibi kararıyla YALNIZ WEB
 * sürümüne açıldı. Android uygulamasında kapalı olmasının sebebi teknik değil,
 * beyan: Play içerik anketi "kullanıcılar uygulama içinde birbirini görebilir
 * / iletişim kurabilir mi" diye soruyor ve kişisel geliştirici hesabında bu
 * soruya "evet" demek ek inceleme demek. Uygulamada özellik gerçekten yoksa
 * "hayır" cevabı doğrudur (bkz. PLAY.md 4.3).
 *
 * NEDEN SADECE MENÜDEN GİZLEMEK YETMEZ. Bu tam olarak daha önce yapılan ve
 * denetimde yakalanan hataydı: ekranlar menüde yoktu ama expo-router'da
 * dosya = rota olduğu için DERİN BAĞLANTIYLA hâlâ açılabiliyorlardı. Yani
 * özellik "yok" değil, "gizli"ydi — ve gizli bir özellik ankette "hayır"
 * demeyi haklı çıkarmaz.
 *
 * ÇÖZÜM: Metro'nun platform uzantısı. Gerçek ekranlar `*.web.tsx`, bu dosya
 * da platformsuz sürüm. Android paketine pano ve yazışma kodu HİÇ GİRMİYOR;
 * derin bağlantı çalışır ama karşısına bu not çıkar. (Expo Router dokümanı,
 * `app/` içinde platform uzantısının ancak platformsuz sürüm de varsa
 * çalıştığını söylüyor — bu yüzden bölme `app/` DIŞINDA yapılıyor ve rota
 * dosyaları evrensel kalıyor.)
 */
export function YalnizWeb({ baslik }: { baslik?: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={baslik ?? t('jobs.title')} showBack />
      <View style={styles.wrap}>
        <Card>
          <View style={styles.icon}>
            <Ionicons name="desktop-outline" size={28} color={__t.colors.primary} />
          </View>
          <Text style={styles.baslik}>{t('tevkil.webOnly')}</Text>
          <Text style={styles.govde}>{t('tevkil.webOnlyDesc')}</Text>
          <Text style={styles.adres}>vekilpro.app</Text>
        </Card>
      </View>
    </Screen>
  );
}

export default YalnizWeb;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    icon: {
      width: 60,
      height: 60,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    baslik: {
      ...typography.h3,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    govde: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: spacing.xs,
    },
    adres: {
      ...typography.bodyMedium,
      color: colors.primary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
