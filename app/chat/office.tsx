import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useMyOffice, useOfficeMessages, useSendOfficeMessage } from '@/hooks/useOffice';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { formatTime } from '@/utils/format';

export default function OfficeChatScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const me = useAuthStore((s) => s.session?.user.id);
  const scrollRef = useRef<ScrollView>(null);

  const myOffice = useMyOffice();
  const office = myOffice.data?.office ?? null;
  const messages = useOfficeMessages(office?.id);
  const sendMessage = useSendOfficeMessage();
  const [input, setInput] = useState('');

  const send = async () => {
    const body = input.trim();
    if (!body || !office || sendMessage.isPending) return;
    setInput('');
    try {
      await sendMessage.mutateAsync({ officeId: office.id, body });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setInput(body);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={office?.name ?? t('chat.tabOffice')} subtitle={t('office.roomSubtitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {(messages.data ?? []).map((m) => {
            const mine = m.sender_id === me;
            return (
              <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!mine && (
                  <Text style={styles.senderName}>{m.sender?.full_name ?? '?'}</Text>
                )}
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]} selectable>
                  {m.body}
                </Text>
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{formatTime(m.created_at)}</Text>
              </View>
            );
          })}
          {messages.data?.length === 0 && <Text style={styles.emptyNote}>{t('office.roomEmpty')}</Text>}
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
  senderName: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '800',
    marginBottom: 2,
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
