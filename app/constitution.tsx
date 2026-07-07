import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import anayasa from '@/data/anayasa.json';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface Article {
  no: string;
  title: string;
  text: string;
  section: string;
}

const ARTICLES = (anayasa as { articles: Article[] }).articles;

function norm(s: string): string {
  return s.toLocaleLowerCase('tr-TR');
}

export default function ConstitutionScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return ARTICLES;
    // pure number → jump to that article (plus geçici variant)
    if (/^\d+$/.test(q)) {
      return ARTICLES.filter((a) => a.no === q || a.no === `Geçici ${q}`);
    }
    const nq = norm(q);
    return ARTICLES.filter((a) => norm(a.title).includes(nq) || norm(a.text).includes(nq));
  }, [query]);

  // Highlight helper: split article text around the first match to show context
  const renderSnippet = (a: Article) => {
    const q = query.trim();
    if (!q || /^\d+$/.test(q)) return null;
    const nq = norm(q);
    const idx = norm(a.text).indexOf(nq);
    if (idx < 0) return null;
    const start = Math.max(0, idx - 60);
    const before = (start > 0 ? '…' : '') + a.text.slice(start, idx);
    const match = a.text.slice(idx, idx + q.length);
    const after = a.text.slice(idx + q.length, idx + q.length + 90) + '…';
    return (
      <Text style={styles.snippet} numberOfLines={3}>
        {before}
        <Text style={styles.snippetMatch}>{match}</Text>
        {after}
      </Text>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('const.title')} showBack />
      <View style={styles.searchWrap}>
        <Input
          placeholder={t('const.searchPlaceholder')}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setExpanded(null);
          }}
          icon="search-outline"
          autoCorrect={false}
          containerStyle={styles.searchInput}
        />
        <Text style={styles.resultCount}>
          {t('const.results', { n: results.length })} · {t('const.offline')}
        </Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(a) => a.no}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        ListEmptyComponent={
          <Card>
            <EmptyState icon="book-outline" title={t('const.empty')} description={t('const.emptyDesc')} />
          </Card>
        }
        ListFooterComponent={<Text style={styles.sourceNote}>{t('const.sourceNote')}</Text>}
        renderItem={({ item }) => {
          const isOpen = expanded === item.no;
          return (
            <Card style={styles.articleCard} padded={false}>
              <Pressable style={styles.articleHeader} onPress={() => setExpanded(isOpen ? null : item.no)}>
                <View style={[styles.noBadge, item.no.startsWith('Geçici') && { backgroundColor: colors.warningSoft }]}>
                  <Text style={[styles.noBadgeText, item.no.startsWith('Geçici') && { color: colors.warning }]}>
                    {item.no === 'Başlangıç' ? '★' : item.no.replace('Geçici ', 'G')}
                  </Text>
                </View>
                <Text style={styles.articleTitle} numberOfLines={isOpen ? undefined : 2}>
                  {item.title}
                </Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>
              {!isOpen && renderSnippet(item)}
              {isOpen && (
                <View style={styles.articleBody}>
                  <Text style={styles.articleText} selectable>
                    {item.text}
                  </Text>
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  searchWrap: {
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    marginBottom: spacing.xs,
  },
  resultCount: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  articleCard: {
    marginBottom: spacing.xs,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  noBadge: {
    minWidth: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  noBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  articleTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  snippet: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    lineHeight: 18,
  },
  snippetMatch: {
    backgroundColor: colors.warningSoft,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  articleBody: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    padding: spacing.sm,
  },
  articleText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  sourceNote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 15,
  },
});
