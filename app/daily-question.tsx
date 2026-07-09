import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getTodayQuestion } from '@/constants/dailyQuestions';
import { useMyAnswerToday, useSubmitAnswer } from '@/hooks/useDailyQuestion';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function DailyQuestionScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const question = getTodayQuestion();
  const existing = useMyAnswerToday();
  const submit = useSubmitAnswer();
  const [body, setBody] = useState('');

  const handleSubmit = async () => {
    if (body.trim().length < 10) return;
    try {
      await submit.mutateAsync(body);
      Alert.alert(t('daily.submittedTitle'), t('daily.submittedMsg'), [
        { text: t('common.done'), onPress: () => router.back() },
      ]);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      const msg = err.code === '23505' ? t('daily.alreadyAnswered') : t('daily.failed');
      Alert.alert(t('daily.title'), msg);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('daily.title')} subtitle={t('daily.subtitle')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.questionCard}>
            <View style={styles.quoteMark}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.gold} />
            </View>
            <Text style={styles.questionText}>{question.body}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={13} color={colors.gold} />
              <Text style={styles.metaText}>{t('daily.reward')}</Text>
            </View>
          </View>

          {existing.data ? (
            <View style={styles.doneCard}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.doneTitle}>{t('daily.doneTitle')}</Text>
              <Text style={styles.doneAnswer}>{existing.data.body}</Text>
              <Text style={styles.doneMeta}>+{existing.data.points} P</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>{t('daily.yourAnswer')}</Text>
              <Input
                placeholder={t('daily.placeholder')}
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={8}
                style={styles.textArea}
                maxLength={4000}
              />
              <Text style={styles.counter}>{body.length}/4000</Text>
              <Button
                label={t('daily.submit')}
                onPress={handleSubmit}
                loading={submit.isPending}
                disabled={body.trim().length < 10}
                fullWidth
                size="lg"
                style={styles.submit}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  questionCard: {
    backgroundColor: '#0F1F3D',
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  quoteMark: {
    marginBottom: spacing.xs,
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  metaText: {
    ...typography.small,
    color: colors.gold,
    fontWeight: '700',
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textArea: {
    height: 200,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  counter: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: -8,
    marginBottom: spacing.sm,
  },
  submit: {
    marginTop: spacing.md,
  },
  doneCard: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 16,
    padding: spacing.lg,
  },
  doneTitle: {
    ...typography.h2,
    color: colors.success,
    marginTop: spacing.xs,
  },
  doneAnswer: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  doneMeta: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gold,
    marginTop: spacing.sm,
  },
});
