import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import {
  useDeleteConversation,
  useDmRealtime,
  useMarkThreadRead,
  usePeerProfile,
  useSendMessage,
  useThread,
} from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { useLangStore, useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import type { DmMessage } from '@/types/database';
import { formatTime } from '@/utils/format';

type Row = { kind: 'sep'; id: string; label: string } | { kind: 'msg'; id: string; msg: DmMessage };

export default function ChatThreadScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const locale = lang === 'tr' ? trLocale : enUS;
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const me = useAuthStore((s) => s.session?.user.id);
  const scrollRef = useRef<ScrollView>(null);

  useDmRealtime();
  const peer = usePeerProfile(peerId);
  const thread = useThread(peerId);
  const sendMessage = useSendMessage();
  const markRead = useMarkThreadRead();
  const deleteConversation = useDeleteConversation();
  const [input, setInput] = useState('');

  const unreadCount = (thread.data ?? []).filter((m) => m.recipient_id === me && !m.read_at).length;
  useEffect(() => {
    if (peerId && unreadCount > 0) markRead.mutate(peerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId, unreadCount]);

  // Group messages by day, inserting a date separator before each new day.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    for (const m of thread.data ?? []) {
      const d = new Date(m.created_at);
      const dayKey = isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
      if (dayKey && dayKey !== lastDay) {
        lastDay = dayKey;
        const label = isToday(d)
          ? t('chat.today')
          : isYesterday(d)
            ? t('chat.yesterday')
            : format(d, 'd MMMM yyyy', { locale });
        out.push({ kind: 'sep', id: `sep-${dayKey}`, label });
      }
      out.push({ kind: 'msg', id: m.id, msg: m });
    }
    return out;
  }, [thread.data, t, locale]);

  const send = async () => {
    const body = input.trim();
    if (!body || !peerId || sendMessage.isPending) return;
    setInput('');
    try {
      await sendMessage.mutateAsync({ recipientId: peerId, body });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setInput(body);
    }
  };

  const confirmDelete = () => {
    if (!peerId) return;
    Alert.alert(t('chat.deleteTitle'), t('chat.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          deleteConversation
            .mutateAsync(peerId)
            .then(() => router.back())
            .catch(() => Alert.alert(t('chat.deleteTitle'), t('upload.tryAgain'))),
      },
    ]);
  };

  const subtitle = [peer.data?.firm_name, peer.data?.bar_number].filter(Boolean).join(' · ');

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      {/* Rich header: avatar + name + firm, with a delete action */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Avatar name={peer.data?.full_name ?? '?'} size={40} premium={peer.data?.is_premium} />
        <View style={styles.headerBody}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peer.data?.full_name ?? '...'}
          </Text>
          {!!subtitle && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <Pressable onPress={confirmDelete} hitSlop={10} style={styles.headerAction}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {rows.map((row) =>
            row.kind === 'sep' ? (
              <View key={row.id} style={styles.sepRow}>
                <View style={styles.sepLine} />
                <Text style={styles.sepText}>{row.label}</Text>
                <View style={styles.sepLine} />
              </View>
            ) : (
              (() => {
                const m = row.msg;
                const mine = m.sender_id === me;
                return (
                  <View key={row.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]} selectable>
                      {m.body}
                    </Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {formatTime(m.created_at)}
                      {mine && m.read_at ? ' ✓✓' : mine ? ' ✓' : ''}
                    </Text>
                  </View>
                );
              })()
            )
          )}
          {thread.data?.length === 0 && (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyNote}>{t('chat.threadEmpty')}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder={t('chat.inputPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || sendMessage.isPending}
            style={[styles.sendButton, (!input.trim() || sendMessage.isPending) && { opacity: 0.4 }]}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerBack: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
    marginLeft: 4,
  },
  headerName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 6,
  },
  sepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  sepText: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  bubbleTime: {
    fontSize: 10,
    color: colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.75)',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  chatInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 110,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
