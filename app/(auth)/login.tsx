import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BrandEmblem } from '@/components/ui/BrandEmblem';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';

export default function LoginScreen() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isSubmitting, error, clearError } = useAuthStore();

  const handleSubmit = async () => {
    clearError();
    const success = await signIn(email.trim(), password);
    if (success) router.replace('/(app)');
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <BrandEmblem size={96} />
            <Text style={styles.brandName}>{t('app.name')}</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandTagline}>{t('app.slogan')}</Text>
          </View>

          <Text style={styles.heading}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.subheading}>{t('auth.signInSubtitle')}</Text>

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
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
          />

          <Link href={'/forgot-password' as Parameters<typeof router.push>[0]} style={styles.forgotLink}>
            <Text style={styles.forgotText}>{t('auth.forgot')}</Text>
          </Link>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={t('auth.signIn')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!email || !password}
            fullWidth
            size="lg"
            style={styles.submit}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
            <Link href="/(auth)/signup" replace>
              <Text style={styles.footerLink}>{t('auth.createOne')}</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  brandName: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
  },
  brandDivider: {
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  brandTagline: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    letterSpacing: 0.3,
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  forgotText: {
    ...typography.caption,
    color: colors.primary,
  },
  submit: {
    marginTop: spacing.xs,
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
