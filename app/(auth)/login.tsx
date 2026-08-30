import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function LoginScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

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
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <VekilLogo size={132} nodeFill={colors.bg} />
            <Text style={styles.brandName}>VEKİL</Text>
            <Text style={styles.brandSub}>AVUKAT YARDIMCI PROGRAMI</Text>
            <Text style={styles.brandSubGold}>AKILLI DAVA TAKİP SİSTEMİ</Text>
          </View>

          <Text style={styles.welcome}>{t('auth.welcomeLine')}</Text>

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

          <Text style={styles.copyright}>© 2026 VEKİL Yazılım</Text>
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
    paddingVertical: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandName: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 8,
    marginTop: spacing.sm,
  },
  brandSub: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 3,
    marginTop: spacing.xs,
  },
  brandSubGold: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gold,
    letterSpacing: 2,
    marginTop: 3,
  },
  welcome: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
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
  copyright: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
