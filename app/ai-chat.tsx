import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAiChat, type AiMessage } from '@/hooks/useAiChat';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function AiChatScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const { messages, sending, errorText, send, reset } = useAiChat();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Yeni mesaj/yanıt geldikçe en alta kaydır.
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages, sending]);

  const onSend = (text: string) => {
    setDraft('');
    send(text);
  };

  const empty = messages.length === 0;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={t('ai.title')}
        showBack
        rightIcon={empty ? undefined : 'create-outline'}
        onRightPress={empty ? undefined : reset}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {empty ? (
            <Welcome onPick={onSend} />
          ) : (
            messages.map((m) => <Bubble key={m.id} message={m} />)
          )}

          {sending && (
            <View style={[styles.bubbleRow, styles.rowStart]}>
              <View style={[styles.bubble, styles.bubbleModel, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.thinkingText}>{t('ai.thinking')}</Text>
              </View>
            </View>
          )}

          {errorText && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.disclaimerBar}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
          <Text style={styles.disclaimerText}>{t('ai.disclaimer')}</Text>
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('ai.inputPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!sending}
          />
          <Pressable
            onPress={() => onSend(draft)}
            disabled={sending || draft.trim().length === 0}
            style={[styles.sendBtn, (sending || draft.trim().length === 0) && styles.sendBtnDisabled]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.textInverse} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Welcome({ onPick }: { onPick: (text: string) => void }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const samples = [t('ai.sample1'), t('ai.sample2'), t('ai.sample3')];

  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeIcon}>
        <Ionicons name="sparkles" size={30} color={colors.gold} />
      </View>
      <Text style={styles.welcomeTitle}>{t('ai.welcome')}</Text>
      <Text style={styles.welcomeDesc}>{t('ai.welcomeDesc')}</Text>

      <View style={styles.samples}>
        {samples.map((s) => (
          <Pressable key={s} onPress={() => onPick(s)} style={({ pressed }) => [styles.sample, pressed && styles.samplePressed]}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            <Text style={styles.sampleText}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Bubble({ message }: { message: AiMessage }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.rowEnd : styles.rowStart]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.text}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  // Karşılama
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  welcomeDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  samples: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  samplePressed: {
    backgroundColor: colors.surfaceHover,
  },
  sampleText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  // Balonlar
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  rowStart: {
    justifyContent: 'flex-start',
  },
  rowEnd: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleModel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: colors.textInverse,
  },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thinkingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
  },
  // Alt bar
  disclaimerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
  },
  disclaimerText: {
    ...typography.small,
    color: colors.textMuted,
    fontSize: 11,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
