import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { isMissingNetworkTables, useConversations, useLawyerDirectory } from '@/hooks/useChat';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatTime, isOverdue } from '@/utils/format';
import { format, isToday } from 'date-fns';

function lastSeenLabel(iso: string): string {
  const d = new Date(iso);
  return isToday(d) ? formatTime(iso) : format(d, 'd.MM.yyyy');
}

export default function ChatListScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const conversations = useConversations();
  const directory = useLawyerDirectory(search);

  const needsSetup = !!conversations.error && isMissingNetworkTables(conversations.error);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={t('chat.title')}
        showBack
        rightIcon={searchVisible ? 'close' : 'person-add-outline'}
        onRightPress={() => {
          setSearchVisible((v) => !v);
          setSearch('');
        }}
      />

      {needsSetup && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{t('network.setupRequired')}</Text>
        </View>
      )}

      {searchVisible && (
        <View style={styles.searchWrap}>
          <Input
            placeholder={t('chat.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            icon="search-outline"
            autoFocus
            autoCorrect={false}
          />
          {search.trim().length >= 2 &&
            (directory.data ?? []).map((p) => (
              <Pressable
                key={p.id}
                style={styles.directoryRow}
                onPress={() => router.push(`/chat/${p.id}` as Parameters<typeof router.push>[0])}
              >
                <Avatar name={p.full_name} size={40} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{p.full_name}</Text>
                  {(p.firm_name || p.bar_number) && (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[p.firm_name, p.bar_number].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              </Pressable>
            ))}
          {search.trim().length >= 2 && directory.data?.length === 0 && (
            <Text style={styles.noResult}>{t('chat.noLawyer')}</Text>
          )}
        </View>
      )}

      <FlatList
        data={conversations.data ?? []}
        keyExtractor={(c) => c.peer.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !needsSetup ? (
            <Card>
              <EmptyState icon="chatbubbles-outline" title={t('chat.empty')} description={t('chat.emptyDesc')} />
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.convRow}
            onPress={() => router.push(`/chat/${item.peer.id}` as Parameters<typeof router.push>[0])}
          >
            <Avatar name={item.peer.full_name} size={48} />
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, item.unread > 0 && styles.rowNameUnread]}>{item.peer.full_name}</Text>
              <Text style={[styles.rowMeta, item.unread > 0 && styles.rowMetaUnread]} numberOfLines={1}>
                {item.lastMessage.body}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowTime}>{lastSeenLabel(item.lastMessage.created_at)}</Text>
              {item.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  errorBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
    lineHeight: 18,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  directoryRow: {
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
  noResult: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  convRow: {
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
  rowBody: {
    flex: 1,
  },
  rowName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  rowNameUnread: {
    fontWeight: '800',
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  rowMetaUnread: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowTime: {
    ...typography.small,
    color: colors.textMuted,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
