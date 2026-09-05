import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { AI_ENABLED } from '@/config/features';
import { supabase } from '@/lib/supabase';
import { aiHataGovdesi, aiHataMetni } from '@/lib/aiHata';
import { useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * MÜTALAA — Pro/Elit'e özel, çok adımlı derin hukuki inceleme.
 * Sunucu olayı hukuki sorunlara böler, her sorun için mevzuat/kural/içtihat
 * toplar ve resmi bir mütalaa sentezler. Normal AI sohbetinden farkı: tek
 * cevap değil, araştırma dosyası üzerine kurulu bütünsel görüş.
 */
export default function MutalaaScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  // OLAYDA GEÇMEYEN TARİHLER. Mütalaada bu tarihler SİLİNMEZ: "fesih
  // 14.04.2026, bir aylık süre 14.05.2026'da doluyor" cümlesi mütalaanın ta
  // kendisidir ve silmek özelliğin değerini silmek olurdu. Ama sessizce doğru
  // kabul ettirmek de olmaz — hesaplandığı açıkça yazılır.
  const [hesaplanan, setHesaplanan] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsPro, setNeedsPro] = useState(false);

  if (!AI_ENABLED) {
    return <ComingSoon headerTitle={t('mut.title')} title={t('soon.mutalaa')} desc={t('soon.desc')} icon="library" />;
  }

  const run = async () => {
    const question = q.trim();
    if (question.length < 20 || busy) return;
    setBusy(true);
    setError(null);
    setNeedsPro(false);
    setText('');
    setIssues([]);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-chat', {
        body: { mode: 'mutalaa', question },
      });
      if (fnErr) {
        // Hata çevirisi ORTAK: aynı mantık üç ekranda ayrı yazılınca biri
        // güncellenip diğerleri geride kalıyordu (bkz. src/lib/aiHata.ts).
        const govde = await aiHataGovdesi(fnErr);
        const code = govde.error ?? '';
        if (code === 'tier_required') {
          setNeedsPro(true);
        } else {
          setError(aiHataMetni(govde, t));
        }
        return;
      }
      const payload = data as { text?: string; issues?: string[]; hesaplananTarih?: string[] } | null;
      if (!payload?.text) {
        setError(t('ai.errGeneric'));
        return;
      }
      setText(payload.text);
      setIssues(payload.issues ?? []);
      setHesaplanan(payload.hesaplananTarih ?? []);
    } catch {
      setError(t('ai.errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const tooShort = q.trim().length < 20;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('mut.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.proRow}>
            <Ionicons name="diamond" size={12} color={colors.primary} />
            <Text style={styles.proText}>{t('mut.proOnly')}</Text>
          </View>
          <Text style={styles.lead}>{t('mut.lead')}</Text>

          <TextInput
            style={styles.area}
            value={q}
            onChangeText={setQ}
            placeholder={t('mut.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            editable={!busy}
          />

          <Pressable
            onPress={run}
            disabled={tooShort || busy}
            style={({ pressed }) => [styles.cta, (tooShort || busy) && styles.ctaOff, pressed && { opacity: 0.85 }]}
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="library" size={17} color="#FFFFFF" />}
            <Text style={styles.ctaText}>{busy ? t('mut.working') : t('mut.run')}</Text>
          </Pressable>
          {busy && <Text style={styles.hint}>{t('mut.workingHint')}</Text>}

          {needsPro && (
            <View style={styles.upsell}>
              <Ionicons name="diamond-outline" size={20} color={colors.primary} />
              <Text style={styles.upsellText}>{t('mut.needPro')}</Text>
              <Pressable
                onPress={() => router.push('/premium' as Parameters<typeof router.push>[0])}
                style={({ pressed }) => [styles.upsellBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.upsellBtnText}>{t('ai.plusUpsellBtn')}</Text>
              </Pressable>
            </View>
          )}

          {!!error && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.errText}>{error}</Text>
            </View>
          )}

          {issues.length > 0 && (
            <View style={styles.issuesCard}>
              <Text style={styles.issuesTitle}>{t('mut.researched')}</Text>
              {issues.map((it) => (
                <View key={it} style={styles.issueRow}>
                  <Ionicons name="search" size={13} color={colors.primary} />
                  <Text style={styles.issueText}>{it}</Text>
                </View>
              ))}
            </View>
          )}

          {!!text && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{t('mut.resultTitle')}</Text>
                <Pressable onPress={() => Share.share({ message: text }).catch(() => {})} hitSlop={8}>
                  <Ionicons name="share-outline" size={19} color={colors.primary} />
                </Pressable>
              </View>
              <Text selectable style={styles.body}>{text}</Text>
              {hesaplanan.length > 0 && (
                <Text style={styles.dateWarn}>
                  {t('mut.calcDates', { tarihler: hesaplanan.join(', ') })}
                </Text>
              )}
              <Text style={styles.disclaimer}>{t('mut.disclaimer')}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  proText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  area: {
    minHeight: 150,
    maxHeight: 280,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  ctaOff: { opacity: 0.45 },
  ctaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 15,
    color: '#FFFFFF',
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  upsell: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  upsellText: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  upsellBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
  },
  upsellBtnText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 14,
    color: '#FFFFFF',
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.danger,
    flex: 1,
    lineHeight: 18,
  },
  dateWarn: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.warning,
    marginTop: spacing.sm,
  },
  issuesCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: 8,
  },
  issuesTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  issueText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
