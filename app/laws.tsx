import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { LAW_INDEX } from '@/data/laws/loader';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

// Constitution keeps its own richer screen; the codes go through the shared browser.
const CODE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: (c: ThemeColors) => string }> = {
  TCK: { icon: 'shield-outline', tint: (c) => c.danger },
  CMK: { icon: 'shield-half-outline', tint: (c) => c.danger },
  TMK: { icon: 'people-outline', tint: (c) => c.primary },
  TBK: { icon: 'document-text-outline', tint: (c) => c.primary },
  HMK: { icon: 'hammer-outline', tint: (c) => c.info },
  TTK: { icon: 'business-outline', tint: (c) => c.gold },
  'İşK': { icon: 'briefcase-outline', tint: (c) => c.success },
};

export default function LawsScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('laws.title')} subtitle={t('laws.subtitle')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hintRow}>
          <Ionicons name="cloud-offline-outline" size={15} color={colors.success} />
          <Text style={styles.hintText}>{t('laws.offline')}</Text>
        </View>

        {/* Anayasa — own detailed screen */}
        <Pressable style={styles.row} onPress={() => router.push('/constitution' as Parameters<typeof router.push>[0])}>
          <View style={[styles.rowIcon, { backgroundColor: colors.goldSoft }]}>
            <Ionicons name="ribbon-outline" size={20} color={colors.gold} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowShort}>Anayasa</Text>
            <Text style={styles.rowName} numberOfLines={1}>
              {t('const.title')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {LAW_INDEX.map((law) => {
          const meta = CODE_META[law.short] ?? { icon: 'book-outline' as const, tint: (c: ThemeColors) => c.primary };
          const tint = meta.tint(colors);
          return (
            <Pressable
              key={law.slug}
              style={styles.row}
              onPress={() => router.push(`/law/${law.slug}` as Parameters<typeof router.push>[0])}
            >
              <View style={[styles.rowIcon, { backgroundColor: `${tint}20` }]}>
                <Ionicons name={meta.icon} size={20} color={tint} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowShort}>{law.short}</Text>
                <Text style={styles.rowName} numberOfLines={1}>
                  {law.name}
                </Text>
              </View>
              <Text style={styles.rowCount}>{t('laws.count', { n: law.count })}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        })}

        <Text style={styles.disclaimer}>{t('laws.disclaimer')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  hintText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowShort: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  rowName: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  rowCount: {
    ...typography.small,
    color: colors.textMuted,
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
