import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PETITION_TEMPLATES, TEMPLATE_CATEGORIES, type PetitionTemplate } from '@/constants/petitionTemplates';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function TemplatesScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [category, setCategory] = useState<string>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const templates = useMemo(
    () => (category === 'all' ? PETITION_TEMPLATES : PETITION_TEMPLATES.filter((p) => p.category === category)),
    [category]
  );

  const shareTemplate = (tpl: PetitionTemplate) => {
    Share.share({ message: tpl.body, title: tpl.title }).catch(() => {});
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('tpl.title')} subtitle={t('tpl.subtitle')} showBack />
      <View style={styles.tabsWrap}>
        <SegmentedControl
          options={TEMPLATE_CATEGORIES.map((c) => ({ value: c.key, label: t(c.labelKey as Parameters<typeof t>[0]) }))}
          value={category}
          onChange={setCategory}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.info} />
          <Text style={styles.hintText}>{t('tpl.hint')}</Text>
        </View>

        {templates.map((tpl) => {
          const open = openKey === tpl.key;
          return (
            <Card key={tpl.key} style={styles.card}>
              <Pressable style={styles.cardHeader} onPress={() => setOpenKey(open ? null : tpl.key)}>
                <View style={styles.cardIcon}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{tpl.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={open ? undefined : 1}>
                    {tpl.description}
                  </Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Pressable>

              {open && (
                <>
                  <View style={styles.bodyBox}>
                    <Text style={styles.bodyText} selectable>
                      {tpl.body}
                    </Text>
                  </View>
                  <Pressable style={styles.shareBtn} onPress={() => shareTemplate(tpl)}>
                    <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.shareBtnText}>{t('tpl.share')}</Text>
                  </Pressable>
                </>
              )}
            </Card>
          );
        })}

        <Text style={styles.disclaimer}>{t('tpl.disclaimer')}</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  tabsWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
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
    lineHeight: 15,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  cardDesc: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  bodyBox: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  bodyText: {
    ...typography.caption,
    color: colors.textPrimary,
    lineHeight: 19,
    fontFamily: undefined,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: spacing.sm,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
