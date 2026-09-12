import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { uyar } from '@/lib/uyari';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { trError } from '@/lib/authErrors';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function ChangePasswordScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const session = useAuthStore((s) => s.session);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    // DÜĞME DOĞRULAMA YÜZÜNDEN KAPANMAZ. Eskiden
    // disabled={!currentPassword || newPassword.length < 8 || !confirmPassword}
    // vardı; kapalı düğme basışı sessizce yutuyor ve "yeni şifre en az 8
    // karakter" kuralı ekranın hiçbir yerinde yazmıyordu. Kullanıcı basıyor,
    // hiçbir şey olmuyor, sebebini göremiyordu.
    if (!currentPassword) {
      setError(t('changePw.currentRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('changePw.mismatch'));
      return;
    }

    setIsSubmitting(true);

    // Re-authenticate with the current password before allowing a change.
    const email = session?.user.email ?? '';
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      setIsSubmitting(false);
      setError(t('changePw.wrongCurrent'));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (updateError) {
      setError(trError(updateError.message));
      return;
    }

    uyar(t('settings.changePassword'), t('changePw.success'));
    router.back();
  };

  return (
    <Screen genislik="form" edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('settings.changePassword')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Input
            label={t('changePw.current')}
            icon="lock-closed-outline"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Input
            label={t('changePw.new')}
            icon="key-outline"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t('auth.passwordHint')}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Input
            label={t('changePw.confirm')}
            icon="key-outline"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={t('forgot.submit')}
            onPress={handleSubmit}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.submit}
          />
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
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.xs,
  },
});
