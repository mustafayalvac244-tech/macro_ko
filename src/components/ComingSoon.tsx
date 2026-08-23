import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * Ortak "Çok Yakında" ekranı — AI özellikleri (AI_ENABLED=false) kapalıyken
 * gösterilir. Başlığı ve açıklaması geçilebilir; geçilmezse Vekil AI metni.
 * Tek yerden yönetilir ki bütün AI ekranları aynı görünsün.
 */
export function ComingSoon({
  headerTitle,
  title,
  desc,
  icon = 'sparkles',
}: {
  headerTitle: string;
  title?: string;
  desc?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={headerTitle} showBack />
      <View style={styles.wrap}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={34} color={colors.gold} />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('ai.comingSoonBadge')}</Text>
        </View>
        <Text style={styles.title}>{title ?? t('ai.comingSoon')}</Text>
        <Text style={styles.desc}>{desc ?? t('ai.comingSoonDesc')}</Text>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    iconBox: {
      width: 84,
      height: 84,
      borderRadius: 26,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    badge: {
      backgroundColor: colors.gold,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: spacing.sm,
    },
    badgeText: {
      ...typography.small,
      color: colors.textInverse,
      fontWeight: '800',
      letterSpacing: 1,
      fontSize: 11,
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    desc: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 22,
    },
  });
