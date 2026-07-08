import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  askVekilAI,
  checkServerAi,
  clearGeminiKey,
  getEffectiveGeminiKey,
  hasBuiltInKey,
  setGeminiKey,
  type ChatMessage,
} from '@/lib/gemini';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function AiChatScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const scrollRef = useRef<ScrollView>(null);
  // 'server' = membership-based AI via edge function (no key anywhere on the
  // device); 'local' = embedded/stored key fallback; 'setup' = nothing found.
  const [mode, setMode] = useState<'loading' | 'server' | 'local' | 'setup'>('loading');
  const [keyInput, setKeyInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    (async () => {
      if (await checkServerAi()) {
        setMode('server');
        return;
      }
      const k = await getEffectiveGeminiKey();
      setMode(k ? 'local' : 'setup');
    })();
  }, []);

  const saveKey = async () => {
    const k = keyInput.trim();
    if (!k) return;
    await setGeminiKey(k);
    setMode('local');
  };

  const resetKey = () => {
    Alert.alert(t('ai.keyReset'), t('ai.keyResetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ai.keyReset'),
        style: 'destructive',
        onPress: async () => {
          await clearGeminiKey();
          setMode('setup');
          setKeyInput('');
        },
      },
    ]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    const next: ChatMessage[] = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setInput('');
    setIsSending(true);
    try {
      const reply = await askVekilAI(next);
      setMessages([...next, { role: 'model', text: reply }]);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      const msg =
        code === 'INVALID_KEY' ? t('ai.errInvalidKey') : code === 'RATE_LIMIT' ? t('ai.errRateLimit') : t('ai.errGeneric');
      setMessages([...next, { role: 'model', text: `⚠️ ${msg}` }]);
    } finally {
      setIsSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  if (mode === 'loading') {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View />
      </Screen>
    );
  }

  if (mode === 'setup') {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('ai.title')} showBack />
        <ScrollView contentContainerStyle={styles.setupContent} keyboardShouldPersistTaps="handled">
          <Card style={styles.setupCard}>
            <View style={styles.setupIconWrap}>
              <Ionicons name="sparkles" size={30} color={colors.gold} />
            </View>
            <Text style={styles.setupTitle}>{t('ai.setupTitle')}</Text>
            <Text style={styles.setupDesc}>{t('ai.setupDesc')}</Text>
            <View style={styles.stepList}>
              <Text style={styles.step}>{t('ai.step1')}</Text>
              <Text style={styles.step}>{t('ai.step2')}</Text>
              <Text style={styles.step}>{t('ai.step3')}</Text>
            </View>
            <Button
              label="aistudio.google.com/apikey"
              variant="secondary"
              icon="open-outline"
              onPress={() => Linking.openURL('https://aistudio.google.com/apikey').catch(() => {})}
              fullWidth
            />
            <View style={styles.spacer} />
            <Input
              label={t('ai.keyLabel')}
              placeholder="AIza..."
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              icon="key-outline"
            />
            <Button label={t('ai.keySave')} onPress={saveKey} disabled={!keyInput.trim()} fullWidth />
            <Text style={styles.privacyNote}>{t('ai.keyPrivacy')}</Text>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('ai.title')} showBack />
      {mode === 'local' && !hasBuiltInKey && (
        <Pressable style={styles.keyRow} onPress={resetKey}>
          <Ionicons name="key-outline" size={13} color={colors.textMuted} />
          <Text style={styles.keyRowText}>{t('ai.keyChange')}</Text>
        </Pressable>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={styles.welcome}>
              <Ionicons name="sparkles" size={26} color={colors.gold} />
              <Text style={styles.welcomeTitle}>{t('ai.welcome')}</Text>
              <Text style={styles.welcomeDesc}>{t('ai.welcomeDesc')}</Text>
              {[t('ai.sample1'), t('ai.sample2'), t('ai.sample3')].map((s) => (
                <Pressable key={s} style={styles.sampleChip} onPress={() => setInput(s)}>
                  <Text style={styles.sampleChipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleModel]}>
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]} selectable>
                {m.text}
              </Text>
            </View>
          ))}
          {isSending && (
            <View style={[styles.bubble, styles.bubbleModel, styles.typingBubble]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>{t('ai.thinking')}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder={t('ai.inputPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || isSending}
            style={[styles.sendButton, (!input.trim() || isSending) && { opacity: 0.4 }]}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>{t('ai.disclaimer')}</Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  setupContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  setupCard: {
    alignItems: 'stretch',
  },
  setupIconWrap: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  setupTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  setupDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  stepList: {
    gap: 6,
    marginBottom: spacing.md,
  },
  step: {
    ...typography.caption,
    color: colors.textPrimary,
    lineHeight: 19,
  },
  spacer: {
    height: spacing.md,
  },
  privacyNote: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 15,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  keyRowText: {
    ...typography.small,
    color: colors.textMuted,
  },
  chatContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  welcome: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  welcomeTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  welcomeDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sampleChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  sampleChipText: {
    ...typography.caption,
    color: colors.primary,
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleModel: {
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
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
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
  disclaimer: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
  },
});
