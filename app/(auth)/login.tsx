import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { WebKart } from '@/components/ui/WebKart';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { dogrulanmamisMi } from '@/lib/authErrors';
import { TEKRAR_GONDERIM_SN } from '@/lib/authBekleme';
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
  const { signIn, isSubmitting, error, clearError, resendVerification } = useAuthStore();
  // Ortak depodaki eski hata ekranlar arasında taşınıyordu: kayıtta "bu
  // e-postayla hesap var" görüp girişe geçen, hiçbir şey denemeden aynı
  // kırmızı hatayı görüyordu (08.10.2026). Açılışta temizlenir.
  useEffect(() => {
    clearError();
  }, [clearError]);

  const [localError, setLocalError] = useState<string | null>(null);
  const [hataliAlan, setHataliAlan] = useState<'email' | 'password' | null>(null);
  // "E-posta doğrulanmamış" hatasında tekrar gönderme düğmesi (04.10.2026;
  // gerekçe app/(auth)/signup.tsx > tekrarGonder).
  //
  // HATA YEŞİL YAZILIYORDU, GERİ SAYIM YOKTU (09.10.2026). Sunucu hatası
  // (ör. "güvenlik nedeniyle bekleyin") başarı mesajıyla aynı durumda ve aynı
  // yeşil stilde gösteriliyordu; düğme her an basılabildiği için ikinci basış
  // hep bu hatayı üretiyordu. Artık hata kırmızı ve ayrı; gönderimden sonra
  // kayıt ekranındakiyle aynı geri sayım var, sunucu süre söylerse o kullanılır.
  const [tekrarBilgi, setTekrarBilgi] = useState<string | null>(null);
  const [tekrarHata, setTekrarHata] = useState<string | null>(null);
  const [tekrarBekleme, setTekrarBekleme] = useState(0);
  const [tekrarGonderiliyor, setTekrarGonderiliyor] = useState(false);
  useEffect(() => {
    if (tekrarBekleme <= 0) return;
    const z = setTimeout(() => setTekrarBekleme((n) => n - 1), 1000);
    return () => clearTimeout(z);
  }, [tekrarBekleme]);
  // Metin arayüz diline göre değiştiği için Türkçe sabitle değil, iki dili de
  // tanıyan yardımcıyla karşılaştırılır (İngilizcede düğme kayboluyordu).
  const dogrulanmamis = dogrulanmamisMi(error);
  const tekrarGonder = async () => {
    setTekrarBilgi(null);
    setTekrarHata(null);
    setTekrarGonderiliyor(true);
    const sonuc = await resendVerification(email, captchaToken ?? undefined);
    setTekrarGonderiliyor(false);
    if (sonuc.hata) {
      setTekrarHata(sonuc.hata);
      if (sonuc.bekle > 0) setTekrarBekleme(sonuc.bekle);
      return;
    }
    setTekrarBilgi(t('auth.resendVerifyDone'));
    setTekrarBekleme(TEKRAR_GONDERIM_SN);
  };

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
            <VekilLogo size={132} nodeFill={colors.bg} />
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

          {/* ANDROID'DE KESİLİYORDU (16.09 ve 26.09, ürün sahibi telefonda gördü:
              "şifremi unuttum yazmıyor, şifremi yazıyor"). expo-router Link
              native'de kendisi bir Text; içine Text koyunca iç içe Text oluşuyor
              ve Android son kelimeyi kesebiliyor. Pressable bir View'dır: içinde
              TEK Text kalır. (Sebep Android'de ölçülmedi — emülatör yok.) */}
          <Pressable
            onPress={() => router.push('/forgot-password' as Parameters<typeof router.push>[0])}
            style={styles.forgotLink}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.forgotText}>{t('auth.forgot')}</Text>
          </Pressable>

          {/* Görünmez captcha — anahtar yoksa hiç çizilmez. */}
          <Captcha onToken={setCaptchaToken} />

          {(hataliAlan ? error : localError ?? error) && (
            <Text style={styles.error}>{hataliAlan ? error : localError ?? error}</Text>
          )}
          {dogrulanmamis && (
            <Button
              label={tekrarBekleme > 0 ? t('auth.resendVerifyIn', { n: String(tekrarBekleme) }) : t('auth.resendVerify')}
              variant="ghost"
              disabled={tekrarBekleme > 0 || tekrarGonderiliyor}
              loading={tekrarGonderiliyor}
              onPress={tekrarGonder}
              fullWidth
            />
          )}
          {dogrulanmamis && !!tekrarBilgi && <Text style={styles.bilgi}>{tekrarBilgi}</Text>}
          {dogrulanmamis && !!tekrarHata && <Text style={styles.error}>{tekrarHata}</Text>}

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
            <Pressable onPress={() => router.replace('/(auth)/signup')} hitSlop={8} accessibilityRole="link">
              <Text style={styles.footerLink}>{t('auth.createOne')}</Text>
            </Pressable>
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
  bilgi: {
    ...typography.caption,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  // DAR EKRANDA KESİLİYORDU — 16.09.2026, ürün sahibi telefonda gördü:
  // "şifremi unuttum yazmıyor, şifremi yazıyor."
  //
  // SEBEP: React Native, satır içindeki Text'i sığmadığında SARMAZ, KESER.
  // Web'de 412px'te zar zor sığıyor (ölçüldü: metin 788px'te bitiyor, kap
  // 824px) — 360dp'lik bir telefonda taşıyor ve ikinci kelime gidiyor.
  // Ölçüm web'de yapıldığı için sorun web'de GÖRÜNMÜYORDU; native'de bir
  // derleme olmadığı için de hiç yakalanmamıştı.
  //
  // flexShrink: 0 → kabı daraldığında metni kısaltma, olduğu gibi bırak.
  // maxWidth: '100%' → yine de kaptan taşıp ekran dışına çıkmasın.
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    flexShrink: 0,
    maxWidth: '100%',
  },
  forgotText: {
    ...typography.caption,
    color: colors.primary,
    flexShrink: 0,
  },
  submit: {
    marginTop: spacing.xs,
  },
  // AYNI ARIZA, İKİNCİ YER: "hesap oluştur yerine hesap yazıyor."
  // İki Text yan yana ve toplam genişlik kabı aşınca RN ikincisini kesiyor.
  // flexWrap: 'wrap' → sığmazsa ALT SATIRA insin; kesilmek yerine sarılsın.
  // gap → sarıldığında iki kelime birbirine yapışmasın.
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  footerLink: {
    ...typography.bodyMedium,
    color: colors.primary,
    flexShrink: 0,
  },
  copyright: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
