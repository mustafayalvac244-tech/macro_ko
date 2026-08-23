import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ComingSoon } from '@/components/ComingSoon';
import { AI_ENABLED } from '@/config/features';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { fonts, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * DİLEKÇE ÜRET — olay anlatımından mahkemeye hazır resmî dilekçe taslağı.
 * Avukat türü seçer (dava/cevap/istinaf/temyiz/itiraz/ihtarname…) ve olayı
 * serbest dille yazar; sunucu gerçek mevzuat/içtihatla besleyip HMK yapısında
 * tam bir taslak üretir (uydurma yasağı korunur). Hazır şablonlardan (templates)
 * farkı: metin olaya özel yazılır, sabit boşluk doldurma değildir.
 */
type DilekceType = { key: string; label: string };

const TYPES: DilekceType[] = [
  { key: 'dava', label: 'Dava Dilekçesi' },
  { key: 'cevap', label: 'Cevap Dilekçesi' },
  { key: 'replik', label: 'Cevaba Cevap (Replik)' },
  { key: 'duplik', label: 'İkinci Cevap (Düplik)' },
  { key: 'istinaf', label: 'İstinaf Dilekçesi' },
  { key: 'temyiz', label: 'Temyiz Dilekçesi' },
  { key: 'itiraz', label: 'İtiraz Dilekçesi' },
  { key: 'ihtarname', label: 'İhtarname' },
  { key: 'bilirkisi', label: 'Bilirkişiye İtiraz' },
  { key: 'islah', label: 'Islah Dilekçesi' },
];

export default function DilekceUretScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const [type, setType] = useState<string>('dava');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!AI_ENABLED) {
    return <ComingSoon headerTitle={t('dlk.title')} title={t('soon.dilekce')} desc={t('soon.desc')} icon="document-text" />;
  }

  const run = async () => {
    const question = q.trim();
    if (question.length < 20 || busy) return;
    setBusy(true);
    setError(null);
    setText('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-chat', {
        body: { mode: 'dilekce', dilekceType: type, question },
      });
      if (fnErr) {
        let code = '';
        try {
          const ctx = (fnErr as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') code = (await ctx.json())?.error ?? '';
        } catch {
          // gövde okunamadı
        }
        setError(
          code === 'daily_quota'
            ? t('ai.errDailyQuota')
            : code === 'quota_exceeded'
              ? t('ai.errQuota')
              : code === 'rate_limit'
                ? t('ai.errRateLimit')
                : t('ai.errGeneric')
        );
        return;
      }
      const payload = data as { text?: string } | null;
      if (!payload?.text) {
        setError(t('ai.errGeneric'));
        return;
      }
      setText(payload.text);
    } catch {
      setError(t('ai.errGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const tooShort = q.trim().length < 20;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('dlk.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.lead}>{t('dlk.lead')}</Text>

          <Text style={styles.label}>{t('dlk.typeLabel')}</Text>
          <View style={styles.chips}>
            {TYPES.map((it) => {
              const on = type === it.key;
              return (
                <Pressable
                  key={it.key}
                  onPress={() => setType(it.key)}
                  style={[styles.chip, on && styles.chipOn]}
                  disabled={busy}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{it.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t('dlk.factsLabel')}</Text>
          <TextInput
            style={styles.area}
            value={q}
            onChangeText={setQ}
            placeholder={t('dlk.placeholder')}
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
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="document-text" size={17} color="#FFFFFF" />}
            <Text style={styles.ctaText}>{busy ? t('dlk.working') : t('dlk.run')}</Text>
          </Pressable>
          {busy && <Text style={styles.hint}>{t('dlk.workingHint')}</Text>}

          {!!error && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.errText}>{error}</Text>
              {error === t('ai.errQuota') && (
                <Pressable onPress={() => router.push('/premium' as Parameters<typeof router.push>[0])} hitSlop={8}>
                  <Text style={styles.errLink}>{t('ai.plusUpsellBtn')}</Text>
                </Pressable>
              )}
            </View>
          )}

          {!!text && (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{t('dlk.resultTitle')}</Text>
                <Pressable onPress={() => Share.share({ message: text }).catch(() => {})} hitSlop={8}>
                  <Ionicons name="share-outline" size={19} color={colors.primary} />
                </Pressable>
              </View>
              <Text selectable style={styles.body}>{text}</Text>
              <Text style={styles.disclaimer}>{t('dlk.disclaimer')}</Text>
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
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.lg,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  chipTextOn: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    color: colors.primary,
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
  errLink: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 12.5,
    color: colors.primary,
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
