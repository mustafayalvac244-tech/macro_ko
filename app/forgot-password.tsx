import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { trError } from '@/lib/authErrors';
import { beklemeSaniyesi } from '@/lib/authBekleme';
import { Captcha } from '@/components/Captcha';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * ŞİFRE SIFIRLAMA — kullanıcı bildirimi üzerine baştan ele alındı (12.09.2026).
 *
 * BİLDİRİLEN: "kodu ve yeni şifreyi giriyorsun, hata da vermiyor bir şey de
 * vermiyor, öylece kalıyor, şifre değişmiyor. Sonra tekrar tıklayınca güvenlik
 * nedeniyle bekle diyor."
 *
 * ÜÇ AYRI KUSUR VARDI, ÜÇÜ DE BU EKRANDA:
 *
 * 1) SESSİZ ÖLÜ DÜĞME. Gönder düğmesi `disabled={kod<6 || şifre<8}` ile
 *    kapatılıyordu. Button bileşeni disabled iken onPress'i sessizce yutuyor:
 *    kullanıcı basıyor, HİÇBİR ŞEY olmuyor, hiçbir yerde de "şifre en az 8
 *    karakter" yazmıyor. "Hata da vermiyor bir şey de vermiyor" tam olarak bu.
 *    Artık düğme hiçbir zaman doğrulama yüzünden kapanmıyor; basıldığında eksik
 *    NE İSE onu söylüyor.
 *
 * 2) BAŞARI EKRANI YOKTU. Başarıda doğrudan /(app)'e atlıyordu; kullanıcı
 *    şifresinin değişip değişmediğini hiçbir yerden göremiyordu. i18n'de
 *    'forgot.success' tanımlıydı ve HİÇ KULLANILMIYORDU. Artık açık bir onay
 *    adımı var.
 *
 * 3) BEKLEME SÜRESİ GÖRÜNMÜYORDU. "Kodu tekrar gönder" her an basılabiliyordu;
 *    sunucuda aynı adrese gönderim aralığı 20 saniye olduğu için ikinci basış
 *    "güvenlik nedeniyle bekleyin" ile dönüyordu. Artık geri sayım ekranda
 *    yazıyor ve süre dolmadan düğme basılmıyor.
 *
 * AYRICA: kod verifyOtp ile bir kez harcanır. Doğrulama geçip şifre güncelleme
 * başarısız olursa o kod ARTIK ÖLÜDÜR; eskiden ekran bunu söylemiyordu ve
 * kullanıcı aynı kodu tekrar tekrar deniyordu. Bu durum ayrıca ele alınıyor.
 */

/** Sunucudaki gönderim aralığı 20 sn (smtp_max_frequency); saat farkı ve
 *  ağ gecikmesi için birkaç saniye pay bırakıyoruz. */
const VARSAYILAN_BEKLEME = 25;

/** Şifre alt sınırı Supabase tarafında da zorunlu; burada aynı sayı. */
const SIFRE_ASGARI = 8;

export default function ForgotPasswordScreen() {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [step, setStep] = useState<'email' | 'code' | 'bitti'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Kalan bekleme (saniye). 0 ise tekrar gönderilebilir.
  const [bekleme, setBekleme] = useState(0);
  // Kod harcandı mı: doğrulama geçtiyse o kod bir daha kullanılamaz.
  const kodHarcandi = useRef(false);

  useEffect(() => {
    if (bekleme <= 0) return;
    const s = setTimeout(() => setBekleme((n) => n - 1), 1000);
    return () => clearTimeout(s);
  }, [bekleme]);

  const gonder = useCallback(
    async (tekrar: boolean) => {
      const adres = email.trim();
      if (!adres) {
        setError(t('forgot.needEmail'));
        return;
      }
      setIsSubmitting(true);
      setError(null);
      setBilgi(null);
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(
        adres,
        captchaToken ? { captchaToken } : undefined
      );
      setIsSubmitting(false);
      if (sendError) {
        // Sunucu "şu kadar saniye sonra" diyorsa o süreyi geri sayıma koyuyoruz;
        // kullanıcı ne kadar bekleyeceğini tahmin etmek zorunda kalmasın.
        const kalan = beklemeSaniyesi(sendError.message);
        if (kalan) setBekleme(kalan);
        setError(trError(sendError.message));
        return;
      }
      kodHarcandi.current = false;
      setBekleme(VARSAYILAN_BEKLEME);
      setStep('code');
      if (tekrar) {
        setCode('');
        setBilgi(t('forgot.resent'));
      }
    },
    [email, captchaToken, t]
  );

  const handleUpdatePassword = async () => {
    // DOĞRULAMA DÜĞMEYİ KAPATMAZ, KONUŞUR. Eksik ne ise söylüyoruz.
    if (!code.trim()) {
      setError(t('forgot.needCode'));
      return;
    }
    if (newPassword.length < SIFRE_ASGARI) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (kodHarcandi.current) {
      setError(t('forgot.codeUsed'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setBilgi(null);

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

    // Buradan sonra kod TÜKENDİ. Şifre güncelleme başarısız olsa bile aynı kod
    // bir daha çalışmaz; kullanıcıya aynı kodu tekrar denetmek, onu "hiçbir şey
    // olmuyor" döngüsünde tutar.
    kodHarcandi.current = true;

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (updateError) {
      setError(`${trError(updateError.message)} ${t('forgot.codeUsed')}`);
      return;
    }

    setStep('bitti');
  };

  return (
    <Screen genislik="form" edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('forgot.title')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'email' && (
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
              {/* Şifre sıfırlama, captcha'nın en çok işe yaradığı uçtur:
                  otomatik istekler e-posta kotasını tüketir. */}
              <Captcha onToken={setCaptchaToken} />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t('forgot.sendCode')}
                onPress={() => gonder(false)}
                loading={isSubmitting}
                fullWidth
                size="lg"
                style={styles.submit}
              />
            </>
          )}

          {step === 'code' && (
            <>
              <Text style={styles.description}>{t('forgot.codeStep')}</Text>
              {/* Hangi adrese gittiğini yazıyoruz: yanlış adrese gönderip
                  gelmeyen postayı beklemek en sık kaybedilen dakikadır. */}
              <Text style={styles.adres}>{email.trim()}</Text>
              {/* UZUNLUK VARSAYILMAZ. maxLength=6'ydı ve sunucu 8 haneli kod
                  gönderdiğinde kullanıcı kodu YAZAMIYORDU bile. Sunucu ayarı
                  değişirse ekran yine çalışsın diye tavan gevşek. */}
              <Input
                label={t('forgot.code')}
                icon="key-outline"
                keyboardType="number-pad"
                placeholder={t('forgot.codePlaceholder')}
                value={code}
                onChangeText={setCode}
                maxLength={10}
              />
              <Input
                label={t('forgot.newPassword')}
                icon="lock-closed-outline"
                secureTextEntry
                placeholder={t('auth.passwordHint')}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              {bilgi && <Text style={styles.bilgi}>{bilgi}</Text>}
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t('forgot.submit')}
                onPress={handleUpdatePassword}
                loading={isSubmitting}
                fullWidth
                size="lg"
                style={styles.submit}
              />
              <Button
                label={bekleme > 0 ? t('forgot.resendIn').replace('{n}', String(bekleme)) : t('forgot.resend')}
                variant="ghost"
                disabled={bekleme > 0 || isSubmitting}
                onPress={() => gonder(true)}
                style={styles.resend}
              />
              {/* Posta gelmediğinde ilk bakılacak yer. Kullanıcı "mail gelmiyor"
                  dediğinde çoğu kez spam/tanıtımlar klasöründe duruyor. */}
              <Text style={styles.ipucu}>{t('forgot.spamHint')}</Text>
            </>
          )}

          {step === 'bitti' && (
            <View style={styles.bittiKutu}>
              <Ionicons name="checkmark-circle" size={56} color={__t.colors.success} />
              <Text style={styles.bittiBaslik}>{t('forgot.success')}</Text>
              <Button
                label={t('forgot.continue')}
                onPress={() => router.replace('/(app)')}
                fullWidth
                size="lg"
                style={styles.submit}
              />
            </View>
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
  adres: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  bilgi: {
    ...typography.caption,
    color: colors.success,
    marginBottom: spacing.md,
  },
  ipucu: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  submit: {
    marginTop: spacing.xs,
  },
  resend: {
    marginTop: spacing.sm,
  },
  bittiKutu: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  bittiBaslik: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
