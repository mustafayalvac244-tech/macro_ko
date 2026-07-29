import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AI_ENABLED } from '@/config/features';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAiChat, type AiMessage, type AiConversation } from '@/hooks/useAiChat';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function AiChatScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const { messages, sending, error, errorText, tier, send, newChat, conversations, activeId, openConversation, deleteConversation } =
    useAiChat();
  const showUpsell = error === 'daily_quota' || error === 'quota_exceeded';
  const [draft, setDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
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
        rightIcon={!AI_ENABLED ? undefined : 'time-outline'}
        onRightPress={!AI_ENABLED ? undefined : () => setHistoryOpen(true)}
      />
      {!AI_ENABLED ? (
        <ComingSoon />
      ) : (
      <>
      <HistoryPanel
        visible={historyOpen}
        conversations={conversations}
        activeId={activeId}
        onClose={() => setHistoryOpen(false)}
        onNew={() => {
          newChat();
          setHistoryOpen(false);
        }}
        onOpen={(id) => {
          openConversation(id);
          setHistoryOpen(false);
        }}
        onDelete={deleteConversation}
      />
      {tier === 'plus' && (
        <View style={styles.tierPlus}>
          <Ionicons name="diamond" size={13} color={colors.gold} />
          <Text style={styles.tierPlusText}>{t('ai.plusActive')}</Text>
        </View>
      )}
      {tier === 'basic' && (
        <Pressable onPress={() => router.push('/premium' as Parameters<typeof router.push>[0])} style={styles.tierUpsell}>
          <Ionicons name="sparkles" size={13} color={colors.primary} />
          <Text style={styles.tierUpsellText}>{t('ai.plusUpsell')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      )}
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
              <View style={styles.errorRow}>
                <Ionicons
                  name={showUpsell ? 'time-outline' : 'alert-circle-outline'}
                  size={18}
                  color={showUpsell ? colors.gold : colors.danger}
                />
                <Text style={[styles.errorText, showUpsell && styles.errorTextInfo]}>{errorText}</Text>
              </View>
              {showUpsell && (
                <Pressable
                  onPress={() => router.push('/premium' as Parameters<typeof router.push>[0])}
                  style={({ pressed }) => [styles.upsellBtn, pressed && styles.samplePressed]}
                >
                  <Ionicons name="diamond-outline" size={15} color={colors.textInverse} />
                  <Text style={styles.upsellBtnText}>{t('ai.plusUpsellBtn')}</Text>
                </Pressable>
              )}
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
      </>
      )}
    </Screen>
  );
}

function ComingSoon() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  return (
    <View style={styles.soonWrap}>
      <View style={styles.soonIcon}>
        <Ionicons name="sparkles" size={34} color={colors.gold} />
      </View>
      <View style={styles.soonBadge}>
        <Text style={styles.soonBadgeText}>{t('ai.comingSoonBadge')}</Text>
      </View>
      <Text style={styles.soonTitle}>{t('ai.comingSoon')}</Text>
      <Text style={styles.soonDesc}>{t('ai.comingSoonDesc')}</Text>
    </View>
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
        {/* selectable: metne basılı tutunca OS'in "Kopyala" menüsü açılır
            (alıcı geri bildirimi: "AI'dan yazı kopyalanmıyor"). */}
        <Text selectable style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.text}</Text>
      </View>
    </View>
  );
}

/** "az önce / 5 dk / 3 sa / 2 gün" gibi kısa göreli zaman. */
function relativeTime(ts: number, t: ReturnType<typeof useT>): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('ai.justNow');
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const day = Math.floor(hr / 24);
  return `${day} gün`;
}

function HistoryPanel({
  visible,
  conversations,
  activeId,
  onClose,
  onNew,
  onOpen,
  onDelete,
}: {
  visible: boolean;
  conversations: AiConversation[];
  activeId: string;
  onClose: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const confirmDelete = (id: string) => {
    Alert.alert(t('ai.deleteChat'), t('ai.deleteChatConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ai.deleteChat'), style: 'destructive', onPress: () => onDelete(id) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.historyBackdrop}>
        <Pressable style={styles.historyDismiss} onPress={onClose} />
        <View style={styles.historySheet}>
          <View style={styles.historyHandle} />
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>{t('ai.history')}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.historyClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Pressable onPress={onNew} style={({ pressed }) => [styles.newChatBtn, pressed && styles.samplePressed]}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.newChatText}>{t('ai.newChat')}</Text>
          </Pressable>

          {conversations.length === 0 ? (
            <View style={styles.historyEmptyWrap}>
              <Ionicons name="chatbubbles-outline" size={30} color={colors.textMuted} />
              <Text style={styles.historyEmptyText}>{t('ai.historyEmpty')}</Text>
            </View>
          ) : (
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onOpen(c.id)}
                    style={({ pressed }) => [styles.historyItem, isActive && styles.historyItemActive, pressed && styles.samplePressed]}
                  >
                    <Ionicons
                      name={isActive ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                      size={18}
                      color={isActive ? colors.primary : colors.textSecondary}
                    />
                    <View style={styles.historyItemBody}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={styles.historyItemTime}>{relativeTime(c.updatedAt, t)}</Text>
                    </View>
                    <Pressable onPress={() => confirmDelete(c.id)} hitSlop={10} style={styles.historyDelete}>
                      <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  // Çok Yakında
  soonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  soonIcon: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  soonBadge: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  soonBadgeText: {
    ...typography.small,
    color: colors.textInverse,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 11,
  },
  soonTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  soonDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  tierPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.goldSoft,
    borderRadius: 10,
  },
  tierPlusText: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '700',
    flexShrink: 1,
  },
  tierUpsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
  },
  tierUpsellText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
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
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    flex: 1,
  },
  errorTextInfo: {
    color: colors.textSecondary,
  },
  upsellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  upsellBtnText: {
    ...typography.small,
    color: colors.textInverse,
    fontWeight: '700',
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
  // Sohbet geçmişi paneli
  historyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  historyDismiss: {
    flex: 1,
  },
  historySheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '78%',
  },
  historyHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  historyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  historyClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  newChatText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  historyList: {
    marginTop: spacing.xs,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  historyItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  historyItemBody: {
    flex: 1,
  },
  historyItemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  historyItemTime: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyDelete: {
    padding: 4,
  },
  historyEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  historyEmptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 21,
  },
});
