import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface SearchResults {
  cases: Array<{ id: string; title: string; case_number: string | null; court_name: string | null }>;
  clients: Array<{ id: string; full_name: string; company: string | null; phone: string | null }>;
  documents: Array<{ id: string; name: string; file_path: string; mime_type: string | null }>;
}

function useGlobalSearch(search: string) {
  const me = useAuthStore((s) => s.session?.user.id);
  const q = search.trim().replace(/[,()]/g, '');

  return useQuery({
    queryKey: ['global-search', q],
    enabled: !!me && q.length >= 2,
    queryFn: async (): Promise<SearchResults> => {
      const [cases, clients, documents] = await Promise.all([
        supabase
          .from('cases')
          .select('id, title, case_number, court_name')
          .eq('owner_id', me!)
          .or(`title.ilike.%${q}%,case_number.ilike.%${q}%,court_name.ilike.%${q}%`)
          .limit(10),
        supabase
          .from('clients')
          .select('id, full_name, company, phone')
          .eq('owner_id', me!)
          .or(`full_name.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(10),
        supabase
          .from('documents')
          .select('id, name, file_path, mime_type')
          .eq('owner_id', me!)
          .ilike('name', `%${q}%`)
          .limit(10),
      ]);
      return {
        cases: (cases.data ?? []) as SearchResults['cases'],
        clients: (clients.data ?? []) as SearchResults['clients'],
        documents: (documents.data ?? []) as SearchResults['documents'],
      };
    },
  });
}

export default function GlobalSearchScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [search, setSearch] = useState('');
  const results = useGlobalSearch(search);

  const hasQuery = search.trim().length >= 2;
  const total = results.data
    ? results.data.cases.length + results.data.clients.length + results.data.documents.length
    : 0;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('search.title')} showBack />
      <View style={styles.searchWrap}>
        <Input
          placeholder={t('search.placeholder')}
          value={search}
          onChangeText={setSearch}
          icon="search-outline"
          autoFocus
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!hasQuery && (
          <View style={styles.idle}>
            <Ionicons name="search-outline" size={40} color={colors.textMuted} />
            <Text style={styles.idleText}>{t('search.hint')}</Text>
          </View>
        )}

        {hasQuery && results.data && total === 0 && !results.isFetching && (
          <View style={styles.idle}>
            <Ionicons name="file-tray-outline" size={40} color={colors.textMuted} />
            <Text style={styles.idleText}>{t('search.noResults')}</Text>
          </View>
        )}

        {hasQuery && results.data && results.data.cases.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('cases.title')}</Text>
            {results.data.cases.map((c) => (
              <Pressable
                key={c.id}
                style={styles.row}
                onPress={() => router.push(`/(app)/cases/${c.id}` as Parameters<typeof router.push>[0])}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="briefcase-outline" size={17} color={colors.primary} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.title}
                  </Text>
                  {(c.case_number || c.court_name) && (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[c.case_number, c.court_name].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        )}

        {hasQuery && results.data && results.data.clients.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('clients.title')}</Text>
            {results.data.clients.map((c) => (
              <Pressable
                key={c.id}
                style={styles.row}
                onPress={() => router.push(`/(app)/clients/${c.id}` as Parameters<typeof router.push>[0])}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name="person-outline" size={17} color={colors.success} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.full_name}
                  </Text>
                  {(c.company || c.phone) && (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[c.company, c.phone].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        )}

        {hasQuery && results.data && results.data.documents.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('docs.title')}</Text>
            {results.data.documents.map((d) => (
              <Pressable
                key={d.id}
                style={styles.row}
                onPress={() =>
                  router.push(
                    `/document-viewer?path=${encodeURIComponent(d.file_path)}&name=${encodeURIComponent(d.name)}&mime=${encodeURIComponent(d.mime_type ?? '')}` as Parameters<typeof router.push>[0]
                  )
                }
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.goldSoft }]}>
                  <Ionicons name="document-outline" size={17} color={colors.gold} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {d.name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  searchWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  idle: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  idleText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  rowMeta: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
