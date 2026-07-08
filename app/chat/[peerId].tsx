import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useMarkThreadRead, usePeerProfile, useSendMessage, useThread } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatTime } from '@/utils/format';

export default function ChatThreadScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const me = useAuthStore((s) => s.session?.user.id);
  const scrollRef = useRef<ScrollView>(null);

  const peer = usePeerProfile(peerId);
  const thread = useThread(peerId);
  const sendMessage = useSendMessage();
  const markRead = useMarkThreadRead();
  const [input, setInput] = useState('');

  // Mark incoming messages read whenever the thread refreshes while open.
  const unreadCount = (thread.data ?? []).filter((m) => m.recipient_id === me && !m.read_at).length;
  useEffect(() => {
    if (peerId && unreadCount > 0) markRead.mutate(peerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId, unreadCount]);

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

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={peer.data?.full_name ?? '...'}
        subtitle={[peer.data?.firm_name, peer.data?.bar_number].filter(Boolean).join(' · ') || undefined}
        showBack
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {(thread.data ?? []).map((m) => {
            const mine = m.sender_id === me;
            return (
              <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]} selectable>
                  {m.body}
                </Text>
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                  {formatTime(m.created_at)}
                  {mine && m.read_at ? ' ✓✓' : mine ? ' ✓' : ''}
                </Text>
              </View>
            );
          })}
          {thread.data?.length === 0 && <Text style={styles.emptyNote}>{t('chat.threadEmpty')}</Text>}
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 6,
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
  emptyNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
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
