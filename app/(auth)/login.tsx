import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
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
            <View style={styles.logoMark}>
              <Ionicons name="scale-outline" size={28} color={colors.gold} />
            </View>
            <Text style={styles.brandName}>{t('app.name')}</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandTagline}>{t('app.tagline')}</Text>
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
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brandName: {
    ...typography.h1,
    color: colors.textPrimary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  brandDivider: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gold,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  brandTagline: {
    ...typography.caption,
    color: colors.textSecondary,
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
