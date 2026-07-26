import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AIHM_KARARLAR, aihmKategoriler, searchAihm, type AihmKarar } from '@/data/aihmKararlar';
import { useT } from '@/i18n';
import { fonts, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * AİHM — Öncü Kararlar. Türkiye AİHS’e taraf olduğundan bu kararlar iç hukukta
 * dayanak/atıf değeri taşır. Ekran, gerçek dönüm noktası kararlarını Türkçe
 * özetler; arama ve kategori filtresiyle gezilir, detayda yapılandırılmış
 * bölümler (olay, değerlendirme, sonuç, önem) açılır.
 */
export default function AihmScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [open, setOpen] = useState<AihmKarar | null>(null);

  const kategoriler = useMemo(() => aihmKategoriler(), []);
  const list = useMemo(() => {
    let rows = searchAihm(draft);
    if (cat) rows = rows.filter((k) => k.kategori === cat);
    return rows;
  }, [draft, cat]);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('aihm.title')} showBack />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tanıtım */}
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="earth" size={16} color={colors.gold} />
          </View>
          <Text allowFontScaling={false} style={styles.introText}>
            {t('aihm.intro')}
          </Text>
        </View>

        {/* Arama */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('aihm.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            allowFontScaling={false}
            returnKeyType="search"
          />
          {draft.length > 0 && (
            <Pressable onPress={() => setDraft('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Kategori filtreleri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() => setCat(null)}
            style={[styles.chip, cat === null && styles.chipActive]}
          >
            <Text allowFontScaling={false} style={[styles.chipText, cat === null && styles.chipTextActive]}>
              {t('aihm.all')}
            </Text>
          </Pressable>
          {kategoriler.map((k) => (
            <Pressable
              key={k}
              onPress={() => setCat(cat === k ? null : k)}
              style={[styles.chip, cat === k && styles.chipActive]}
            >
              <Text allowFontScaling={false} style={[styles.chipText, cat === k && styles.chipTextActive]}>
                {k}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text allowFontScaling={false} style={styles.count}>
          {t('aihm.count', { n: list.length })}
        </Text>

        {/* Kart listesi */}
        {list.map((k) => (
          <Pressable
            key={k.id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => setOpen(k)}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.catBadge}>
                <Text allowFontScaling={false} style={styles.catBadgeText}>{k.kategori}</Text>
              </View>
              {k.buyukDaire && (
                <View style={styles.gcBadge}>
                  <Ionicons name="star" size={10} color={colors.gold} />
                  <Text allowFontScaling={false} style={styles.gcBadgeText}>{t('aihm.grandChamber')}</Text>
                </View>
              )}
            </View>
            <Text allowFontScaling={false} style={styles.cardTitle}>{k.basvuru}</Text>
            <Text allowFontScaling={false} style={styles.cardMeta} numberOfLines={1}>
              {[k.madde, k.tarih].filter(Boolean).join('  ·  ')}
            </Text>
            <Text allowFontScaling={false} style={styles.cardIlke} numberOfLines={3}>
              {k.ilke}
            </Text>
            <View style={styles.cardFooter}>
              <Text allowFontScaling={false} style={styles.cardFooterText}>{t('aihm.readMore')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.gold} />
            </View>
          </Pressable>
        ))}

        {list.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={22} color={colors.textMuted} />
            <Text allowFontScaling={false} style={styles.emptyText}>{t('aihm.none')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Detay modalı */}
      <Modal visible={!!open} animationType="slide" transparent onRequestClose={() => setOpen(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                {open?.kategori && (
                  <View style={styles.catBadge}>
                    <Text allowFontScaling={false} style={styles.catBadgeText}>{open.kategori}</Text>
                  </View>
                )}
                <Text allowFontScaling={false} style={styles.modalTitle}>{open?.basvuru}</Text>
              </View>
              <Pressable onPress={() => setOpen(null)} hitSlop={8} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              {/* Künye satırı */}
              <View style={styles.kunyeRow}>
                <KunyeItem label={t('aihm.article')} value={open?.madde ?? '—'} colors={colors} />
                <KunyeItem label={t('aihm.date')} value={open?.tarih ?? '—'} colors={colors} />
                {!!open?.basvuruNo && <KunyeItem label={t('aihm.appNo')} value={open.basvuruNo} colors={colors} />}
              </View>

              <Section title={t('aihm.principle')} body={open?.ilke} accent colors={colors} />
              <Section title={t('aihm.facts')} body={open?.olay} colors={colors} />
              <Section title={t('aihm.reasoning')} body={open?.degerlendirme} colors={colors} />
              <Section title={t('aihm.result')} body={open?.sonuc} colors={colors} />
              <Section title={t('aihm.relevance')} body={open?.onem} colors={colors} />

              <Text allowFontScaling={false} style={styles.disclaimer}>{t('aihm.disclaimer')}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function KunyeItem({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.kunyeItem}>
      <Text allowFontScaling={false} style={styles.kunyeLabel}>{label}</Text>
      <Text allowFontScaling={false} style={styles.kunyeValue}>{value}</Text>
    </View>
  );
}

function Section({
  title,
  body,
  accent,
  colors,
}: {
  title: string;
  body?: string;
  accent?: boolean;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  if (!body) return null;
  return (
    <View style={[styles.section, accent && styles.sectionAccent]}>
      <Text allowFontScaling={false} style={[styles.sectionTitle, accent && { color: colors.gold }]}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  intro: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  introIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    height: 46,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  chipRow: {
    gap: 7,
    paddingBottom: spacing.sm,
    paddingRight: 4,
  },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  catBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  gcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.goldSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gcBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.gold,
  },
  cardTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 16.5,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  cardMeta: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 3,
    marginBottom: 8,
  },
  cardIlke: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 10,
  },
  cardFooterText: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.gold,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  // Modal
  modalWrap: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '90%',
    paddingTop: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    lineHeight: 26,
    marginTop: 6,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  kunyeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kunyeItem: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: '30%',
  },
  kunyeLabel: {
    fontFamily: fonts.semibold,
    fontSize: 9.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kunyeValue: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionAccent: {
    backgroundColor: colors.goldSoft,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  sectionBody: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
