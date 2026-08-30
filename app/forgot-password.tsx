import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { trError } from '@/lib/authErrors';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function ForgotPasswordScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async () => {
    setIsSubmitting(true);
    setError(null);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setIsSubmitting(false);
    if (sendError) {
      setError(trError(sendError.message));
      return;
    }
    setStep('code');
  };

  const handleUpdatePassword = async () => {
    setIsSubmitting(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyError) {
      setIsSubmitting(false);
      setError(trError(verifyError.message));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (updateError) {
      setError(trError(updateError.message));
      return;
    }

    router.replace('/(app)');
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('forgot.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'email' ? (
            <>
              <Text style={styles.description}>{t('forgot.emailStep')}</Text>
              <Input
                label={t('auth.email')}
                icon="mail-outline"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t('forgot.sendCode')}
                onPress={handleSendCode}
                loading={isSubmitting}
                disabled={!email.trim()}
                fullWidth
                size="lg"
                style={styles.submit}
              />
            </>
          ) : (
            <>
              <Text style={styles.description}>{t('forgot.codeStep')}</Text>
              <Input
                label={t('forgot.code')}
                icon="key-outline"
                keyboardType="number-pad"
                placeholder={t('forgot.codePlaceholder')}
                value={code}
                onChangeText={setCode}
                maxLength={6}
              />
              <Input
                label={t('forgot.newPassword')}
                icon="lock-closed-outline"
                secureTextEntry
                placeholder={t('auth.passwordHint')}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t('forgot.submit')}
                onPress={handleUpdatePassword}
                loading={isSubmitting}
                disabled={code.trim().length < 6 || newPassword.length < 8}
                fullWidth
                size="lg"
                style={styles.submit}
              />
              <Button label={t('forgot.resend')} variant="ghost" onPress={handleSendCode} style={styles.resend} />
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.xs,
  },
  resend: {
    marginTop: spacing.sm,
  },
});
