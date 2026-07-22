import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadLaw, type LawArticle } from '@/data/laws/loader';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

function norm(s: string): string {
  return s.toLocaleLowerCase('tr-TR');
}

export default function LawBrowserScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();

  const { slug } = useLocalSearchParams<{ slug: string }>();
  const law = useMemo(() => loadLaw(slug ?? ''), [slug]);

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const articles = law?.articles ?? [];

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return articles;
    if (/^\d+$/.test(q)) {
      // exact article number, plus its "12/A" style variants
      return articles.filter((a) => a.no === q || a.no.startsWith(`${q}/`));
    }
    const nq = norm(q);
    // Başlık + gövde + madde no üzerinde ara. Başlıkta geçenler öne alınır —
    // "aşırı ifa güçlüğü" araması, gövdede atıf yapan 344 yerine başlığı bu olan
    // 138'i en üstte getirir.
    const matched = articles.filter(
      (a) => (a.title && norm(a.title).includes(nq)) || norm(a.text).includes(nq) || a.no.includes(q)
    );
    return matched
      .map((a) => ({ a, titleHit: !!(a.title && norm(a.title).includes(nq)) }))
      .sort((x, y) => (x.titleHit === y.titleHit ? 0 : x.titleHit ? -1 : 1))
      .map((x) => x.a);
  }, [query, articles]);

  const renderSnippet = (a: LawArticle) => {
    const q = query.trim();
    if (!q || /^\d+$/.test(q)) return null;
    const nq = norm(q);
    const idx = norm(a.text).indexOf(nq);
    if (idx < 0) return null;
    const start = Math.max(0, idx - 55);
    const before = (start > 0 ? '…' : '') + a.text.slice(start, idx);
    const match = a.text.slice(idx, idx + q.length);
    const after = a.text.slice(idx + q.length, idx + q.length + 85) + '…';
    return (
      <Text style={styles.snippet} numberOfLines={3}>
        {before}
        <Text style={styles.snippetMatch}>{match}</Text>
        {after}
      </Text>
    );
  };

  if (!law) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('laws.title')} showBack />
        <Card>
          <EmptyState icon="book-outline" title={t('laws.notFound')} />
        </Card>
      </Screen>
    );
  }

  const special = (no: string) => no.startsWith('Geçici') || no.startsWith('Ek');

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={law.short} subtitle={law.name} showBack />
      <View style={styles.searchWrap}>
        <Input
          placeholder={t('laws.searchPlaceholder')}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setExpanded(null);
          }}
          icon="search-outline"
          keyboardType={/^\d*$/.test(query) ? 'default' : 'default'}
          autoCorrect={false}
          containerStyle={styles.searchInput}
        />
        <Text style={styles.resultCount}>
          {t('laws.results', { n: results.length })} · {t('laws.offlineShort')}
        </Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(a) => a.no}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={7}
        ListEmptyComponent={
          <Card>
            <EmptyState icon="search-outline" title={t('laws.empty')} description={t('laws.emptyDesc')} />
          </Card>
        }
        ListFooterComponent={<Text style={styles.sourceNote}>{t('laws.disclaimer')}</Text>}
        renderItem={({ item }) => {
          const isOpen = expanded === item.no;
          return (
            <Card style={styles.articleCard} padded={false}>
              <Pressable style={styles.articleHeader} onPress={() => setExpanded(isOpen ? null : item.no)}>
                <View style={[styles.noBadge, special(item.no) && { backgroundColor: colors.warningSoft }]}>
                  <Text style={[styles.noBadgeText, special(item.no) && { color: colors.warning }]}>
                    {item.no.replace('Geçici ', 'G').replace('Ek ', 'E')}
                  </Text>
                </View>
                <View style={styles.titleWrap}>
                  <Text style={styles.articleTitle} numberOfLines={isOpen ? undefined : 2}>
                    {item.title || t('laws.articleN', { no: item.no })}
                  </Text>
                  {!!item.title && <Text style={styles.articleNo}>{t('laws.articleN', { no: item.no })}</Text>}
                </View>
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
    minWidth: 44,
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
  titleWrap: {
    flex: 1,
  },
  articleTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  articleNo: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 1,
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
