import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { uyar } from '@/lib/uyari';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * HESAP SİLME — ŞİFRE İLE YENİDEN KİMLİK DOĞRULAMA.
 *
 * BULUNAN EKSİK. Hesap silme yalnız iki onay penceresinden geçiyordu; ŞİFRE
 * SORULMUYORDU. Şifre değiştirme ekranı (app/change-password.tsx:40) doğru
 * davranıp signInWithPassword ile yeniden doğrulama yapıyor, ama HESABIN
 * TAMAMINI SİLMEK için bu yapılmıyordu — yani daha az zararlı işlem daha
 * korunaklıydı.
 *
 * SÖMÜRÜ SENARYOSU: masada açık kalan bir telefon ya da ortak bilgisayardaki
 * açık oturum. Saldırganın şifreyi bilmesine gerek yok; iki kez "onayla"
 * demesi yeterliydi. Silme GERİ ALINAMAZ: sunucudaki delete_account tüm
 * dosyaları, müvekkilleri ve belgeleri kalıcı siler.
 *
 * ÜÇ KATMAN: (1) şifre, (2) onay sözcüğünü elle yazma, (3) son onay penceresi.
 * Onay sözcüğü kasten mekanik bir engeldir — "Evet"e refleksle basmayı
 * zorlaştırır.
 */
export default function HesapSilScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();

  const session = useAuthStore((s) => s.session);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const [sifre, setSifre] = useState('');
  const [onaySozcugu, setOnaySozcugu] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const beklenen = t('delAcc.confirmWord');
  const sozcukTamam = onaySozcugu.trim().toLocaleLowerCase('tr') === beklenen.toLocaleLowerCase('tr');

  const sil = async () => {
    setHata(null);
    setCalisiyor(true);

    // 1) ŞİFREYLE YENİDEN DOĞRULAMA. Oturum açık olsa bile şifre bilinmeden
    //    hesap silinemez. (change-password.tsx ile aynı yöntem.)
    const email = session?.user.email ?? '';
    const { error: dogrulamaHatasi } = await supabase.auth.signInWithPassword({ email, password: sifre });
    if (dogrulamaHatasi) {
      setCalisiyor(false);
      setHata(t('delAcc.wrongPassword'));
      return;
    }

    // 2) SON ONAY. Şifre doğru olsa bile bir adım daha.
    uyar(t('settings.deleteAccountConfirmTitle'), t('settings.deleteAccountConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => setCalisiyor(false) },
      {
        text: t('settings.deleteAccountConfirmBtn'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
            router.replace('/(auth)/login');
          } catch {
            setCalisiyor(false);
            uyar(t('settings.deleteAccount'), t('settings.deleteAccountError'));
          }
        },
      },
    ]);
  };

  return (
    <Screen genislik="form" edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('settings.deleteAccount')} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.uyariKutu}>
            <Ionicons name="warning" size={20} color={colors.danger} />
            <Text style={styles.uyariMetin}>{t('settings.deleteAccountWarn')}</Text>
          </View>

          <Text style={styles.aciklama}>{t('delAcc.lead')}</Text>

          <Input
            label={t('delAcc.password')}
            icon="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
            placeholder={t('auth.passwordPlaceholder')}
            value={sifre}
            onChangeText={setSifre}
          />

          <Input
            label={t('delAcc.typeWord', { word: beklenen })}
            icon="create-outline"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={beklenen}
            value={onaySozcugu}
            onChangeText={setOnaySozcugu}
          />

          {!!hata && <Text style={styles.hata}>{hata}</Text>}

          <Button
            label={t('settings.deleteAccount')}
            variant="danger"
            loading={calisiyor}
            disabled={!sifre || !sozcukTamam}
            onPress={sil}
            fullWidth
            style={styles.buton}
          />
          <Text style={styles.not}>{t('delAcc.note')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  uyariKutu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: spacing.md,
  },
  uyariMetin: { ...typography.small, color: colors.danger, flex: 1, lineHeight: 18 },
  aciklama: { ...typography.body, color: colors.textSecondary, lineHeight: 21 },
  hata: { ...typography.small, color: colors.danger },
  buton: { marginTop: spacing.xs },
  not: { ...typography.small, color: colors.textMuted, lineHeight: 16 },
});
