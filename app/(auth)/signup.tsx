import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { WebKart } from '@/components/ui/WebKart';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useAuthStore } from '@/store/authStore';
import { isValidTCKN } from '@/utils/tckn';
import { BAROLAR } from '@/constants/barolar';
import { Captcha } from '@/components/Captcha';
import { CAPTCHA_ENABLED } from '@/config/captcha';
import { DENEME_SORU_HAKKI } from '@/hooks/useTrialStatus';
import { UCRETSIZ_LIMIT } from '@/config/planlar';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function SignupScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [fullName, setFullName] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [baro, setBaro] = useState('');
  const [firmName, setFirmName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  // HANGİ ALAN eksik. Mesajın kendisi düğmenin yanında çıkıyordu; eksik kutu
  // yedi alan yukarıdaysa kullanıcı mesajı görse bile nereye bakacağını
  // bilmiyordu. Input zaten kırmızı çerçeve + alt yazı çizebiliyor, ama bu
  // ekranların hiçbirinde kullanılmamıştı.
  const [hataliAlan, setHataliAlan] = useState<string | null>(null);
  const [baroPickerOpen, setBaroPickerOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaHatasi, setCaptchaHatasi] = useState(false);
  const [dogrulamaBekliyor, setDogrulamaBekliyor] = useState(false);
  const { signUp, isSubmitting, error, clearError } = useAuthStore();

  // Clears any stale error the moment the user edits a field, so an old
  // message (e.g. a transient network failure) never lingers on screen.
  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    if (localError) setLocalError(null);
    if (hataliAlan) setHataliAlan(null);
    if (error) clearError();
    setter(v);
  };

  /** Hem üstteki özet mesajı hem de kutunun kendi işaretini kurar. */
  const eksik = (alan: string, mesaj: string) => {
    setHataliAlan(alan);
    setLocalError(mesaj);
  };

  const handleSubmit = async () => {
    clearError();
    setLocalError(null);
    setHataliAlan(null);

    // Field-by-field validation with specific messages — the button is always
    // tappable so the user is told exactly what is missing.
    if (!fullName.trim()) {
      eksik('fullName', t('auth.fullNameRequired'));
      return;
    }
    if (!tcNo.trim()) {
      eksik('tcNo', t('auth.tcRequired'));
      return;
    }
    if (!isValidTCKN(tcNo.trim())) {
      eksik('tcNo', t('auth.tcInvalid'));
      return;
    }
    if (baro === '') {
      eksik('baro', t('auth.baroRequired'));
      return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      eksik('email', t('auth.emailRequired'));
      return;
    }
    if (password.length < 8) {
      eksik('password', t('auth.passwordShort'));
      return;
    }

    // Captcha açıksa jeton hazır olana kadar beklenir. Turnstile görünmez
    // çalıştığı için jeton, kullanıcı formu doldururken çoktan gelmiş olur;
    // bu bekleme pratikte görünmez. Jeton hiç gelmediyse (ağ/servis arızası)
    // kullanıcıyı kapıda bırakmamak için istek yine de gönderilir — Supabase
    // captcha'yı zorunlu kılıyorsa reddi zaten anlaşılır bir hata olarak döner.
    if (CAPTCHA_ENABLED && !captchaToken && !captchaHatasi) {
      setLocalError(t('auth.captchaWait'));
      return;
    }

    const sonuc = await signUp({
      // Giriş ekranıyla aynı sebep: klavye ilk harfi büyütürse kullanıcı
      // kaydolduğu adresle giriş yapamaz hâle gelir.
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      firmName: firmName.trim(),
      tcNo: tcNo.trim(),
      baro,
      captchaToken: captchaToken ?? undefined,
    });

    if (sonuc === 'girildi') {
      router.replace('/(app)');
    } else if (sonuc === 'dogrulama-gerekli') {
      // E-posta doğrulaması AÇIK: oturum yok, uygulamaya yönlendirilemez.
      // Eskiden burada koşulsuz router.replace vardı ve doğrulama açıldığı an
      // kullanıcı oturumsuz bir ekrana düşerdi.
      setDogrulamaBekliyor(true);
    }
    // 'hata' durumunda mesaj zaten store'dan gelir ve ekranda gösterilir.
  };

  // E-POSTA DOĞRULAMA EKRANI. Hesap açıldı ama oturum yok; kullanıcıya ne
  // yapması gerektiğini söylemeden uygulamaya sokamayız.
  if (dogrulamaBekliyor) {
    return (
      <Screen genislik="form">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <WebKart>
          <View style={styles.brand}>
            <VekilLogo size={72} />
            <Text style={styles.brandName}>{t('app.name')}</Text>
          </View>
          <View style={styles.verifyIconWrap}>
            <Ionicons name="mail-unread-outline" size={34} color={colors.primary} />
          </View>
          <Text style={styles.heading}>{t('auth.verifyTitle')}</Text>
          <Text style={styles.verifyBody}>{t('auth.verifyBody', { email: email.trim() })}</Text>
          <Text style={styles.verifyHint}>{t('auth.verifyHint')}</Text>
          <Button
            label={t('auth.verifyGoLogin')}
            onPress={() => router.replace('/(auth)/login')}
            fullWidth
            size="lg"
            style={styles.submit}
          />
          </WebKart>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen genislik="form">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <WebKart>
          <View style={styles.brand}>
            <VekilLogo size={72} />
            <Text style={styles.brandName}>{t('app.name')}</Text>
          </View>

          <View style={styles.lawyerBadge}>
            <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
            <Text style={styles.lawyerBadgeText}>{t('auth.lawyersOnly')}</Text>
          </View>

          <Text style={styles.heading}>{t('auth.createHeading')}</Text>
          <Text style={styles.subheading}>{t('auth.signupSubtitle')}</Text>

          {/* Kaydolmadan ÖNCE fiyatlama beklentisi netleşsin — sonradan
              "AI paralı mıymış" sürprizi kullanıcıyı üründen soğutur. */}
          <View style={styles.pricingCard}>
            <View style={styles.pricingIconWrap}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            </View>
            <View style={styles.pricingTextWrap}>
              <Text style={styles.pricingTitle}>{t('auth.pricingInfoTitle')}</Text>
              <Text style={styles.pricingBody}>{t('auth.pricingInfoBody', {
                n: DENEME_SORU_HAKKI,
                dava: UCRETSIZ_LIMIT.dava,
                muvekkil: UCRETSIZ_LIMIT.muvekkil,
                belge: UCRETSIZ_LIMIT.belge,
              })}</Text>
            </View>
          </View>

          <Input error={hataliAlan === 'fullName' ? localError : null} label={t('auth.fullName')} icon="person-outline" autoComplete="name" textContentType="name" placeholder={t('auth.fullNamePlaceholder')} value={fullName} onChangeText={touch(setFullName)} />

          <Input
            error={hataliAlan === 'tcNo' ? localError : null}
            label={t('auth.tcNo')}
            icon="card-outline"
            keyboardType="number-pad"
            maxLength={11}
            placeholder={t('auth.tcPlaceholder')}
            value={tcNo}
            onChangeText={touch((v: string) => setTcNo(v.replace(/[^0-9]/g, '')))}
          />

          {/* Baro seçici */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('auth.baro')}</Text>
            <Pressable
              style={[styles.selectBox, hataliAlan === 'baro' && styles.selectBoxError]}
              onPress={() => setBaroPickerOpen(true)}
            >
              <Ionicons name="business-outline" size={18} color={colors.textMuted} style={styles.selectIcon} />
              <Text style={[styles.selectText, !baro && styles.selectPlaceholder]}>
                {baro ? `${baro} Barosu` : t('auth.baroPlaceholder')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Input label={t('auth.firmName')} icon="briefcase-outline" placeholder={t('auth.firmNamePlaceholder')} value={firmName} onChangeText={touch(setFirmName)} />

          {/* autoComplete/textContentType olmadan parola yöneticileri ve
              tarayıcı otomatik doldurması hiç devreye girmiyor; "new-password"
              ayrıca tarayıcıya güçlü şifre önerdiriyor. */}
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
            onChangeText={touch(setEmail)}
          />
          <Input
            error={hataliAlan === 'password' ? localError : null}
            label={t('auth.password')}
            icon="lock-closed-outline"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            placeholder={t('auth.passwordHint')}
            value={password}
            onChangeText={touch(setPassword)}
          />

          {/* Görünmez captcha. Anahtar tanımlı değilse hiç çizilmez; tanımlıysa
              da kullanıcı normalde hiçbir şey görmez — yalnız Turnstile insan
              onayı isterse burada bir kutu belirir. */}
          <Captcha onToken={setCaptchaToken} onError={() => setCaptchaHatasi(true)} />

          {(localError || error) && <Text style={styles.error}>{localError ?? error}</Text>}

          <Button
            label={t('auth.createAccountBtn')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={false}
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
          {/* Kayıt olan kullanıcı, koşulları kabul ettiğini görmeli ve metne
              buradan ulaşabilmeli — hem mağaza incelemesi hem tüketici
              mevzuatı açısından. Önceden yalnız gizlilik bağlantısı vardı. */}
          <Text style={styles.termsHint}>
            {t('auth.termsAccept')}{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/terms' as Parameters<typeof router.push>[0])}>
              {t('legal.termsTitle')}
            </Text>
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
            <Link href="/(auth)/login" replace>
              <Text style={styles.footerLink}>{t('auth.signInLink')}</Text>
            </Link>
          </View>
          </WebKart>
        </ScrollView>
      </KeyboardAvoidingView>

      <BaroPicker
        visible={baroPickerOpen}
        onClose={() => setBaroPickerOpen(false)}
        onSelect={(b) => {
          setBaro(b);
          if (hataliAlan === 'baro') {
            setHataliAlan(null);
            setLocalError(null);
          }
          setBaroPickerOpen(false);
        }}
      />
    </Screen>
  );
}

function BaroPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (baro: string) => void;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);
  const t = useT();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    // Mükerrer baro gösterilmesin (defansif — liste zaten tekil).
    const unique = Array.from(new Set(BAROLAR));
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return unique;
    return unique.filter((b) => b.toLocaleLowerCase('tr').includes(q));
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('auth.baroPickTitle')}</Text>
          <View style={styles.modalSearch}>
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder={t('auth.baroSearch')}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(b) => b}
            keyboardShouldPersistTaps="handled"
            style={styles.modalList}
            renderItem={({ item }) => (
              <Pressable style={styles.modalRow} onPress={() => onSelect(item)}>
                <Ionicons name="business-outline" size={17} color={colors.primary} />
                <Text style={styles.modalRowText}>{item} Barosu</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.modalEmpty}>{t('auth.baroNone')}</Text>}
          />
        </View>
      </View>
    </Modal>
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
    marginBottom: spacing.md,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  lawyerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.lg,
  },
  lawyerBadgeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '800',
  },
  heading: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  subheading: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  pricingCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  pricingIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingTextWrap: {
    flex: 1,
  },
  pricingTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  pricingBody: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  selectIcon: {
    marginRight: spacing.xs,
  },
  selectText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  selectBoxError: {
    borderColor: colors.danger,
  },
  selectPlaceholder: {
    color: colors.textMuted,
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
  verifyIconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  verifyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  verifyHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  termsHint: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  termsLink: {
    color: colors.primary,
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
  // Baro picker modal
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: 11,
    fontSize: 15,
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalRowText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  modalEmpty: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
