import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { uyar } from '@/lib/uyari';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemePicker } from '@/components/ui/ThemePicker';
import { useAuthStore } from '@/store/authStore';
import { WEB_ADRESI_KISA } from '@/config/web';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { useCihazlarim, useTumOturumlariKapat, type OturumCihazi } from '@/hooks/useCihazlar';
import { cihazAnahtari } from '@/lib/cihazKimligi';
import { useLockStore } from '@/store/lockStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { useLangStore, useT, type Lang } from '@/i18n';
import { format } from 'date-fns/format';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

export default function SettingsScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const profile = useAuthStore((s) => s.profile);
  const avatarUrl = useAvatarUrl();
  const cihazlar = useCihazlarim();
  const oturumlariKapat = useTumOturumlariKapat();
  const [buAnahtar, setBuAnahtar] = useState<string | null>(null);
  useEffect(() => {
    void cihazAnahtari().then(setBuAnahtar);
  }, []);

  const handleOturumlariKapat = () => {
    uyar(t('cihaz.hepsiniKapatOnayBaslik'), t('cihaz.hepsiniKapatOnayGovde'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cihaz.hepsiniKapat'),
        style: 'destructive',
        onPress: () => {
          oturumlariKapat.mutate(undefined, {
            onSuccess: () => uyar(t('cihaz.baslik'), t('cihaz.kapatildi')),
            onError: () => uyar(t('cihaz.baslik'), t('cihaz.kapatilamadi')),
          });
        },
      },
    ]);
  };
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const lockEnabled = useLockStore((s) => s.enabled);
  const setLockEnabled = useLockStore((s) => s.setEnabled);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotificationsEnabled(status === 'granted'));
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([hw, enrolled]) => setBiometricsAvailable(hw && enrolled))
      .catch(() => setBiometricsAvailable(false));
  }, []);

  const handleToggleLock = async (value: boolean) => {
    if (!value) {
      await setLockEnabled(false);
      return;
    }
    // Prove biometrics work before trusting the lock with app access.
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('lock.prompt') }).catch(() => null);
    if (!result?.success) {
      uyar(t('lock.title'), t('lock.enableFailed'));
      return;
    }
    // TERCİH KAYDEDİLEMEZSE KULLANICI BUNU BİLMELİ. Yazma hatası eskiden
    // yutuluyordu: anahtar açık görünüyor ama uygulama yeniden başlatılınca
    // kilit yok. Kullanıcı kilidin kurulu olduğunu sanarak telefonunu bırakır.
    const kaydedildi = await setLockEnabled(true);
    if (!kaydedildi) uyar(t('lock.title'), t('lock.saveFailed'));
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await registerForNotificationsAsync();
      setNotificationsEnabled(granted);
      if (!granted) {
        uyar(t('settings.permTitle'), t('settings.permMsg'));
      }
    } else {
      uyar(t('settings.sysTitle'), t('settings.sysMsg'));
    }
  };

  // HESAP SİLME ARTIK ŞİFRE İSTİYOR. Önceden yalnız iki onay penceresi vardı;
  // masada açık kalan bir telefonda saldırganın şifreyi bilmesine gerek yoktu,
  // iki kez "onayla" demesi yeterliydi. Şifre değiştirme ekranı zaten yeniden
  // doğrulama yapıyordu — daha az zararlı işlem daha korunaklıydı.
  const handleDeleteAccount = () => {
    router.push('/hesap-sil' as Parameters<typeof router.push>[0]);
  };

  const handleCheckUpdates = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      if (__DEV__ || !Updates.isEnabled) {
        uyar(t('settings.updates'), t('settings.updatesUnavailable'));
        return;
      }
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        uyar(t('settings.updates'), t('settings.updateReady'), [
          { text: t('settings.updateLater'), style: 'cancel' },
          { text: t('settings.updateNow'), onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        uyar(t('settings.updates'), t('settings.updateNone'));
      }
    } catch {
      uyar(t('settings.updates'), t('settings.updateFailed'));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSignOut = () => {
    uyar(t('settings.signOut'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profileCard}>
          <Pressable
            style={styles.profileRow}
            onPress={() => router.push('/profile-form' as Parameters<typeof router.push>[0])}
          >
            <Avatar name={profile?.full_name || t('dash.counselor')} size={56} uri={avatarUrl} premium={profile?.is_premium} />
            <View style={styles.profileBody}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile?.full_name || t('dash.counselor')}</Text>
                {profile?.is_admin && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
                    <Text style={styles.adminBadgeText}>{t('settings.adminBadge')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.email}>{session?.user.email}</Text>
              {profile?.firm_name && <Text style={styles.firm}>{profile.firm_name}</Text>}
              <Text style={styles.editLink}>{t('profile.editLink')}</Text>
            </View>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </Pressable>
        </Card>

        <Card style={styles.section}>
          <View style={styles.rowColumn}>
            <View style={styles.rowLeft}>
              <Ionicons name="language-outline" size={18} color={colors.textMuted} />
              <Text style={styles.rowLabel}>{t('settings.language')}</Text>
            </View>
            <View style={styles.langControl}>
              <SegmentedControl
                scrollable={false}
                options={[
                  { label: 'Türkçe', value: 'tr' },
                  { label: 'English', value: 'en' },
                ]}
                value={lang}
                onChange={(value) => setLang(value as Lang)}
              />
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.rowLeft}>
            <Ionicons name="color-palette-outline" size={18} color={colors.textMuted} />
            <Text style={styles.rowLabel}>{t('settings.theme')}</Text>
          </View>
          <View style={styles.themeWrap}>
            <ThemePicker />
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={18} color={colors.textMuted} />
              <Text style={styles.rowLabel}>{t('settings.reminders')}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {biometricsAvailable && (
          <Card style={styles.section}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="finger-print-outline" size={18} color={colors.textMuted} />
                <Text style={styles.rowLabel}>{t('lock.setting')}</Text>
              </View>
              <Switch
                value={lockEnabled}
                onValueChange={handleToggleLock}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Text style={styles.lockHint}>{t('lock.settingHint')}</Text>
          </Card>
        )}

        <Card style={styles.section}>
          <Pressable style={styles.row} onPress={() => router.push('/change-password' as Parameters<typeof router.push>[0])}>
            <View style={styles.rowLeft}>
              <Ionicons name="key-outline" size={18} color={colors.textMuted} />
              <Text style={styles.rowLabel}>{t('settings.changePassword')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.row} onPress={() => router.push('/feedback' as Parameters<typeof router.push>[0])}>
            <View style={styles.rowLeft}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.info} />
              <Text style={styles.rowLabel}>{t('settings.feedback')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.row} onPress={() => router.push('/premium' as Parameters<typeof router.push>[0])}>
            <View style={styles.rowLeft}>
              <Ionicons name="diamond-outline" size={18} color={colors.gold} />
              <Text style={styles.rowLabel}>{t('settings.premium')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.row} onPress={() => router.push('/privacy' as Parameters<typeof router.push>[0])}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
              <Text style={styles.rowLabel}>{t('settings.privacy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.rowDivider} />
          {/* Kullanım Koşulları (EULA) — abonelik satan uygulamada mağaza
              incelemesi uygulama içinden erişilebilir olmasını zorunlu tutar. */}
          <Pressable style={styles.row} onPress={() => router.push('/terms' as Parameters<typeof router.push>[0])}>
            <View style={styles.rowLeft}>
              <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>{t('legal.termsTitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* WEB SÜRÜMÜ TANITIMI — yalnız NATİFTE.
            Tarayıcıda zaten web sürümü açık; orada "bilgisayardan da kullanın"
            demek anlamsız olurdu. Üye olmayana da gösterilir ama vaat
            karıştırılmadan: metin üyeliğe özel olduğunu söyler, düğme üyelik
            ekranına götürür.

            KOPYALA DÜĞMESİ YOK, adres SEÇİLEBİLİR metin. İki sebep: (1) natif
            pano için yeni bir paket gerekirdi ve yeni natif paket OTA ile
            inmez, mağaza derlemesi ister — bu değişikliğin havadan gitmesini
            engellerdi; (2) mevcut yardımcı (lib/cikti.ts > metniKopyala)
            yalnız tarayıcıda çalışıyor, telefonda 'desteklenmiyor' döner.
            Basılı tutup kopyalamak işletim sisteminin kendi yolu. */}
        {Platform.OS !== 'web' && (
          <Card style={styles.section}>
            <View style={styles.rowLeft}>
              <Ionicons name="desktop-outline" size={18} color={colors.gold} />
              <Text style={styles.rowLabel}>{t('web.promoTitle')}</Text>
            </View>
            <Text style={styles.webPromoBody}>
              {profile?.is_premium ? t('web.promoBody') : t('web.promoBodyLocked')}
            </Text>
            <Text style={styles.webAdres} selectable>
              {WEB_ADRESI_KISA}
            </Text>
            {!profile?.is_premium && (
              <Button
                label={t('web.promoCta')}
                onPress={() => router.push('/premium' as Parameters<typeof router.push>[0])}
              />
            )}
          </Card>
        )}

        <Card style={styles.section}>
          <Pressable style={styles.row} onPress={handleCheckUpdates}>
            <View style={styles.rowLeft}>
              <Ionicons name="cloud-download-outline" size={18} color={colors.info} />
              <Text style={styles.rowLabel}>{isCheckingUpdate ? t('settings.updatesChecking') : t('settings.updates')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.rowDivider} />
          <InfoRow label={t('settings.version')} value={Constants.expoConfig?.version ?? '1.2.0'} />
          <InfoRow label={t('settings.dataStorage')} value={t('settings.dataStorageValue')} />
        </Card>

        {/* OTURUM GÜVENLİĞİ. Şifresi ele geçirilen bir avukatın bunu fark
            etmesinin başka yolu yoktu; uygulama sessizce çalışmaya devam
            ederdi. Liste bir kimlik KANITI değil, bir FARK ETME aracıdır —
            uyarı notu bunu açıkça yazıyor, abartmıyoruz. */}
        <Card style={styles.cihazKart}>
          <View style={styles.cihazBaslikSatir}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
            <Text style={styles.cihazBaslik}>{t('cihaz.baslik')}</Text>
          </View>
          <Text style={styles.cihazAciklama}>{t('cihaz.aciklama')}</Text>

          {(cihazlar.data ?? []).length === 0 ? (
            <Text style={styles.cihazBos}>{t('cihaz.yok')}</Text>
          ) : (
            (cihazlar.data ?? []).map((c) => (
              <CihazSatiri key={c.id} cihaz={c} buCihazMi={c.cihaz_anahtari === buAnahtar} />
            ))
          )}

          <Text style={styles.cihazNot}>{t('cihaz.uyariNotu')}</Text>
          <Button
            label={t('cihaz.hepsiniKapat')}
            variant="secondary"
            loading={oturumlariKapat.isPending}
            onPress={handleOturumlariKapat}
            fullWidth
            style={styles.cihazButon}
          />
        </Card>

        <Button label={t('settings.signOut')} variant="secondary" onPress={handleSignOut} style={styles.signOutButton} />

        <Card style={styles.dangerCard}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.dangerTitle}>{t('settings.deleteAccount')}</Text>
          </View>
          <Text style={styles.dangerText}>{t('settings.deleteAccountWarn')}</Text>
          <Button
            label={t('settings.deleteAccount')}
            variant="danger"
            onPress={handleDeleteAccount}
            fullWidth
            style={styles.dangerButton}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function CihazSatiri({ cihaz, buCihazMi }: { cihaz: OturumCihazi; buCihazMi: boolean }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const bicim = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : format(d, 'dd.MM.yyyy HH:mm');
  };
  return (
    <View style={styles.cihazSatir}>
      <Ionicons
        name={cihaz.platform === 'web' ? 'globe-outline' : 'phone-portrait-outline'}
        size={16}
        color={buCihazMi ? colors.primary : colors.textMuted}
      />
      <View style={styles.cihazGovde}>
        <Text style={styles.cihazAd} numberOfLines={1}>
          {cihaz.ad || cihaz.platform || '—'}
          {buCihazMi ? ` · ${t('cihaz.buCihaz')}` : ''}
        </Text>
        <Text style={styles.cihazMeta} numberOfLines={1}>
          {t('cihaz.sonGorulme', { tarih: bicim(cihaz.son_gorulme) })}
          {' · '}
          {t('cihaz.ilkGorulme', { tarih: bicim(cihaz.ilk_gorulme) })}
          {cihaz.uygulama_surumu ? ` · v${cihaz.uygulama_surumu}` : ''}
        </Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  webPromoBody: { ...typography.body, color: colors.textSecondary, lineHeight: 21, marginTop: spacing.xs },
  webAdres: { ...typography.caption, color: colors.primary, marginTop: spacing.xs, marginBottom: spacing.sm },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    marginBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileBody: {
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  name: {
    ...typography.h2,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  email: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  firm: {
    ...typography.caption,
    color: colors.gold,
    marginTop: 2,
  },
  editLink: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowColumn: {
    gap: spacing.sm,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginVertical: spacing.sm,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  themeWrap: {
    marginTop: 12,
  },
  lockHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  langControl: {
    alignSelf: 'flex-start',
  },
  cihazKart: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  cihazBaslikSatir: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cihazBaslik: { ...typography.h3, color: colors.textPrimary },
  cihazAciklama: { ...typography.small, color: colors.textSecondary, lineHeight: 17 },
  cihazBos: { ...typography.small, color: colors.textMuted, paddingVertical: spacing.sm },
  cihazSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  cihazGovde: { flex: 1 },
  cihazAd: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  cihazMeta: { ...typography.small, color: colors.textMuted },
  cihazNot: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  cihazButon: { marginTop: spacing.sm, borderRadius: radius.md },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  signOutButton: {
    marginTop: spacing.lg,
  },
  dangerCard: {
    marginTop: spacing.lg,
    borderColor: 'rgba(210, 59, 66, 0.35)',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dangerTitle: {
    ...typography.h3,
    color: colors.danger,
  },
  dangerText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  dangerButton: {
    marginTop: 0,
  },
});
