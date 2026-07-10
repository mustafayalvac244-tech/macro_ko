import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function SignupScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signUp, isSubmitting, error, clearError } = useAuthStore();

  const handleSubmit = async () => {
    clearError();
    const success = await signUp({ email: email.trim(), password, fullName: fullName.trim(), firmName: firmName.trim() });
    if (success) router.replace('/(app)');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <VekilLogo size={84} nodeFill={colors.bg} />
            <Text style={styles.brandName}>{t('app.name')}</Text>
          </View>

          <Text style={styles.heading}>{t('auth.createHeading')}</Text>
          <Text style={styles.subheading}>{t('auth.signupSubtitle')}</Text>

          <Input label={t('auth.fullName')} icon="person-outline" placeholder={t('auth.fullNamePlaceholder')} value={fullName} onChangeText={setFullName} />
          <Input label={t('auth.firmName')} icon="business-outline" placeholder={t('auth.firmNamePlaceholder')} value={firmName} onChangeText={setFirmName} />
          <Input
            label={t('auth.email')}
            icon="mail-outline"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label={t('auth.password')}
            icon="lock-closed-outline"
            secureTextEntry
            placeholder={t('auth.passwordHint')}
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={t('auth.createAccountBtn')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!email || !password || !fullName}
            fullWidth
            size="lg"
            style={styles.submit}
          />

          <View style={styles.trustRow}>
            <Pressable style={styles.trustItem} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
              <Ionicons name="lock-closed" size={15} color={colors.success} />
              <Text style={styles.trustText}>{t('auth.trustEncrypted')}</Text>
            </Pressable>
            <Pressable style={styles.trustItem} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
              <Ionicons name="shield-checkmark" size={15} color={colors.success} />
              <Text style={styles.trustText}>{t('auth.trustKvkk')}</Text>
            </Pressable>
            <Pressable style={styles.trustItem} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
              <Ionicons name="cloud-done" size={15} color={colors.success} />
              <Text style={styles.trustText}>{t('auth.trustCloud')}</Text>
            </Pressable>
          </View>
          <Text style={styles.privacyHint} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
            {t('auth.privacyLink')}
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
            <Link href="/(auth)/login" replace>
              <Text style={styles.footerLink}>{t('auth.signInLink')}</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  heading: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  subheading: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.xs,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },
  privacyHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footerLink: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
