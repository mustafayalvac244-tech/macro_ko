import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { WebKart } from '@/components/ui/WebKart';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { Captcha } from '@/components/Captcha';
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const { signIn, isSubmitting, error, clearError } = useAuthStore();

  const [localError, setLocalError] = useState<string | null>(null);
  const [hataliAlan, setHataliAlan] = useState<'email' | 'password' | null>(null);

  const handleSubmit = async () => {
    clearError();
    setLocalError(null);
    setHataliAlan(null);
    // DÜĞME DOĞRULAMA YÜZÜNDEN KAPANMAZ, KONUŞUR. Eskiden
    // disabled={!email || !password} vardı: Button kapalıyken onPress'i
    // sessizce yutuyor, kullanıcı basıyor ve HİÇBİR ŞEY olmuyordu — şifre
    // sıfırlama ekranında aynı kusur yüzünden akış tamamen tıkanmıştı.
    if (!email.trim()) {
      setHataliAlan('email');
      setLocalError(t('forgot.needEmail'));
      return;
    }
    if (!password) {
      setHataliAlan('password');
      setLocalError(t('auth.passwordRequired'));
      return;
    }
    // E-POSTA KÜÇÜK HARFE. Android klavyesi ilk harfi büyütebiliyor ve
    // "Ali@..." ile yapılan giriş "E-posta veya şifre hatalı" dönüyor;
    // kullanıcı şifresini yanlış hatırladığını sanıp sıfırlamaya gidiyor.
    const success = await signIn(email.trim().toLowerCase(), password, captchaToken ?? undefined);
    if (success) router.replace('/(app)');
  };

  return (
    <Screen genislik="form" edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Masaüstünde form bir kart üstünde durur; telefonda WebKart hiçbir
              şey yapmaz ve düzen aynen kalır (bkz. components/ui/WebKart). */}
          <WebKart>
          <View style={styles.brand}>
            <VekilLogo size={132} />
            <Text style={styles.brandName}>VEKİL</Text>
            <Text style={styles.brandSub}>AVUKAT YARDIMCI PROGRAMI</Text>
            <Text style={styles.brandSubGold}>AKILLI DAVA TAKİP SİSTEMİ</Text>
          </View>

          <Text style={styles.welcome}>{t('auth.welcomeLine')}</Text>

          {/* autoComplete/textContentType: PAROLA YÖNETİCİSİ VE TARAYICI
              OTOMATİK DOLDURMASI bunlar olmadan hiç çalışmaz. Chrome "şifreyi
              kaydedeyim mi" diye sormaz, iOS Anahtar Zinciri kutuyu tanımaz.
              Her uygulamada var; bizde yoktu. */}
          <Input
            error={hataliAlan === 'email' ? localError : null}
            label={t('auth.email')}
            icon="mail-outline"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={(v) => {
              if (localError) setLocalError(null);
              if (hataliAlan) setHataliAlan(null);
              setEmail(v);
            }}
          />
          <Input
            error={hataliAlan === 'password' ? localError : null}
            label={t('auth.password')}
            icon="lock-closed-outline"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            // ENTER İLE GİRİŞ. Web sürümünde şifreyi yazıp Enter'a basmak
            // hiçbir şey yapmıyordu; klavyeden fareye geçmek zorunda kalınıyordu.
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={(v) => {
              if (localError) setLocalError(null);
              if (hataliAlan) setHataliAlan(null);
              setPassword(v);
            }}
          />

          <Link href={'/forgot-password' as Parameters<typeof router.push>[0]} style={styles.forgotLink}>
            <Text style={styles.forgotText}>{t('auth.forgot')}</Text>
          </Link>

          {/* Görünmez captcha — anahtar yoksa hiç çizilmez. */}
          <Captcha onToken={setCaptchaToken} />

          {(hataliAlan ? error : localError ?? error) && (
            <Text style={styles.error}>{hataliAlan ? error : localError ?? error}</Text>
          )}

          <Button
            label={t('auth.signIn')}
            onPress={handleSubmit}
            loading={isSubmitting}
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
          </WebKart>
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
