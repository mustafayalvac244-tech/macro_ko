import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * YENİ CİHAZ UYARI BANDI.
 *
 * Hesaba daha önce görülmemiş bir cihazdan girildiğinde ekranın üstünde
 * belirir. Uyarı YALNIZ ikinci ve sonraki cihazlarda çıkar; ilk kurulumda
 * "yeni cihazdan giriş yapıldı" demek anlamsız ve gereksiz korkutucu olurdu.
 *
 * NEDEN ENGELLEYİCİ (modal) DEĞİL: bu bir kimlik doğrulama adımı değil, bir
 * bildirimdir. Meşru kullanıcı yeni telefonundan girdiğinde çalışmasının
 * önüne geçmek yanlış olur; şüpheli durumda ise tek dokunuşla Ayarlar'daki
 * cihaz listesine ve "diğer oturumları kapat"a gidiyor.
 */
export function YeniCihazUyarisi({ onKapat }: { onKapat: () => void }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  return (
    <View style={styles.sarmal} pointerEvents="box-none">
      <View style={styles.band}>
        <Ionicons name="shield-half-outline" size={20} color={colors.warning} />
        <View style={styles.govde}>
          <Text style={styles.baslik}>{t('cihaz.yeniBaslik')}</Text>
          <Text style={styles.metin}>{t('cihaz.yeniGovde')}</Text>
          <Pressable
            onPress={() => {
              onKapat();
              router.push('/settings');
            }}
            hitSlop={8}
          >
            <Text style={styles.baglanti}>{t('cihaz.incele')}</Text>
          </Pressable>
        </View>
        <Pressable onPress={onKapat} hitSlop={10} accessibilityLabel={t('common.ok')}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  sarmal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    // Kalıcı yan menünün ve içeriğin üstünde dursun.
    zIndex: 50,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
  },
  govde: { flex: 1, gap: 3 },
  baslik: { ...typography.body, fontWeight: '800', color: colors.textPrimary },
  metin: { ...typography.small, color: colors.textSecondary, lineHeight: 17 },
  baglanti: { ...typography.small, fontWeight: '800', color: colors.primary, marginTop: 2 },
});
