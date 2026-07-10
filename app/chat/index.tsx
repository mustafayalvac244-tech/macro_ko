import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { isMissingNetworkTables, useConversations, useDmRealtime, useLawyerDirectory, useMyFriendCode } from '@/hooks/useChat';
import {
  useAddOfficeMember,
  useCreateOffice,
  useMyOffice,
  useOfficeMembers,
  useRemoveOfficeMember,
} from '@/hooks/useOffice';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatTime } from '@/utils/format';
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
  const [tab, setTab] = useState<'dm' | 'office'>('dm');
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const conversations = useConversations();
  const directory = useLawyerDirectory(search);
  const myCode = useMyFriendCode();
  useDmRealtime();

  const shareMyCode = () => {
    if (!myCode.data) return;
    Share.share({ message: t('chat.codeShareMsg', { code: myCode.data }) }).catch(() => {});
  };

  const needsSetup = !!conversations.error && isMissingNetworkTables(conversations.error);

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={t('chat.title')}
        showBack
        rightIcon={tab === 'dm' ? (searchVisible ? 'close' : 'person-add-outline') : undefined}
        onRightPress={
          tab === 'dm'
            ? () => {
                setSearchVisible((v) => !v);
                setSearch('');
              }
            : undefined
        }
      />

      <View style={styles.tabsWrap}>
        <SegmentedControl
          scrollable={false}
          options={[
            { value: 'dm', label: t('chat.tabGeneral') },
            { value: 'office', label: t('chat.tabOffice') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {needsSetup && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{t('network.setupRequired')}</Text>
        </View>
      )}

      {tab === 'office' ? (
        <OfficeTab />
      ) : (
        <>
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
              {search.trim().length < 2 && myCode.data && (
                <View style={styles.codeCard}>
                  <View style={styles.codeLeft}>
                    <Text style={styles.codeLabel}>{t('chat.myCode')}</Text>
                    <Text style={styles.codeValue} selectable>
                      {myCode.data}
                    </Text>
                    <Text style={styles.codeDesc}>{t('chat.myCodeDesc')}</Text>
                  </View>
                  <Pressable style={styles.codeShareBtn} onPress={shareMyCode} hitSlop={6}>
                    <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.codeShareText}>{t('chat.shareCode')}</Text>
                  </Pressable>
                </View>
              )}
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
        </>
      )}
    </Screen>
  );
}

/** Discord-style office: create one, invite colleagues, chat in the room. */
function OfficeTab() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const me = useAuthStore((s) => s.session?.user.id);
  const myOffice = useMyOffice();
  const createOffice = useCreateOffice();
  const addMember = useAddOfficeMember();
  const removeMember = useRemoveOfficeMember();

  const [officeName, setOfficeName] = useState('');
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const inviteResults = useLawyerDirectory(inviteSearch);

  const office = myOffice.data?.office ?? null;
  const isAdmin = myOffice.data?.role === 'admin';
  const members = useOfficeMembers(office?.id);
  const memberIds = new Set((members.data ?? []).map((m) => m.user_id));

  if (myOffice.isLoading) return null;

  if (!office) {
    return (
      <ScrollView contentContainerStyle={styles.officeContent} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.officeHero}>
            <Ionicons name="business" size={30} color={colors.primary} />
          </View>
          <Text style={styles.officeTitle}>{t('office.createTitle')}</Text>
          <Text style={styles.officeDesc}>{t('office.createDesc')}</Text>
          <Input
            label={t('office.nameLabel')}
            placeholder={t('office.namePlaceholder')}
            value={officeName}
            onChangeText={setOfficeName}
          />
          <Button
            label={t('office.createButton')}
            onPress={() =>
              createOffice
                .mutateAsync(officeName)
                .then(() => setOfficeName(''))
                .catch(() => Alert.alert(t('office.createTitle'), t('network.setupRequired')))
            }
            loading={createOffice.isPending}
            disabled={officeName.trim().length < 2}
            fullWidth
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.officeContent} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={styles.officeHeader}>
          <View style={styles.officeHero}>
            <Ionicons name="business" size={26} color={colors.primary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.officeName}>{office.name}</Text>
            <Text style={styles.rowMeta}>
              {t('office.memberCount', { n: members.data?.length ?? 1 })} ·{' '}
              {isAdmin ? t('office.roleAdmin') : t('office.roleMember')}
            </Text>
          </View>
        </View>

        <Button
          label={t('office.openChat')}
          icon="chatbubbles-outline"
          onPress={() => router.push('/chat/office' as Parameters<typeof router.push>[0])}
          fullWidth
          style={styles.officeChatButton}
        />

        {isAdmin && (
          <Button
            label={inviteVisible ? t('common.cancel') : t('office.invite')}
            icon={inviteVisible ? 'close-outline' : 'person-add-outline'}
            variant="secondary"
            onPress={() => {
              setInviteVisible((v) => !v);
              setInviteSearch('');
            }}
            fullWidth
            style={styles.inviteButton}
          />
        )}

        {inviteVisible && (
          <View style={styles.inviteWrap}>
            <Input
              placeholder={t('chat.searchPlaceholder')}
              value={inviteSearch}
              onChangeText={setInviteSearch}
              icon="search-outline"
              autoFocus
              autoCorrect={false}
            />
            {inviteSearch.trim().length >= 2 &&
              (inviteResults.data ?? [])
                .filter((p) => !memberIds.has(p.id))
                .map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.directoryRow}
                    onPress={() =>
                      addMember
                        .mutateAsync({ officeId: office.id, userId: p.id })
                        .then(() => setInviteSearch(''))
                        .catch(() => Alert.alert(t('office.invite'), t('jobForm.failed')))
                    }
                  >
                    <Avatar name={p.full_name} size={38} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName}>{p.full_name}</Text>
                      {p.firm_name && (
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {p.firm_name}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="add-circle" size={22} color={colors.success} />
                  </Pressable>
                ))}
          </View>
        )}
      </Card>

      <Text style={styles.sectionLabel}>{t('office.members')}</Text>
      <Card padded={false}>
        {(members.data ?? []).map((m, i) => (
          <View key={m.user_id} style={[styles.memberRow, i > 0 && styles.memberDivider]}>
            <Avatar name={m.profile?.full_name ?? '?'} size={38} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{m.profile?.full_name ?? '?'}</Text>
              <Text style={styles.rowMeta}>
                {m.role === 'admin' ? `👑 ${t('office.roleAdmin')}` : t('office.roleMember')}
              </Text>
            </View>
            {((isAdmin && m.user_id !== me) || (!isAdmin && m.user_id === me)) && (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert(
                    m.user_id === me ? t('office.leave') : t('office.remove'),
                    m.profile?.full_name ?? '',
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: m.user_id === me ? t('office.leave') : t('office.remove'),
                        style: 'destructive',
                        onPress: () => removeMember.mutate({ officeId: office.id, userId: m.user_id }),
                      },
                    ]
                  )
                }
              >
                <Ionicons
                  name={m.user_id === me ? 'exit-outline' : 'remove-circle-outline'}
                  size={20}
                  color={colors.danger}
                />
              </Pressable>
            )}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  tabsWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
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
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  codeLeft: {
    flex: 1,
  },
  codeLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    marginTop: 2,
  },
  codeDesc: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  codeShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  codeShareText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  officeContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  officeHero: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  officeTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  officeDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  officeName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  officeChatButton: {
    marginBottom: spacing.xs,
  },
  inviteButton: {
    marginTop: 0,
  },
  inviteWrap: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  memberDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
