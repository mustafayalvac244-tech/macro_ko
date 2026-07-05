import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemePicker } from '@/components/ui/ThemePicker';
import { useAuthStore } from '@/store/authStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { useLangStore, useT, type Lang } from '@/i18n';
import { spacing, typography } from '@/theme/theme';
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
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setNotificationsEnabled(status === 'granted'));
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await registerForNotificationsAsync();
      setNotificationsEnabled(granted);
      if (!granted) {
        Alert.alert(t('settings.permTitle'), t('settings.permMsg'));
      }
    } else {
      Alert.alert(t('settings.sysTitle'), t('settings.sysMsg'));
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountWarn'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAccountContinue'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('settings.deleteAccountConfirmTitle'), t('settings.deleteAccountConfirmMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.deleteAccountConfirmBtn'),
              style: 'destructive',
              onPress: async () => {
                setIsDeleting(true);
                try {
                  await deleteAccount();
                  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
                  router.replace('/(auth)/login');
                } catch {
                  Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountError'));
                } finally {
                  setIsDeleting(false);
                }
              },
            },
          ]);
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
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
          <View style={styles.profileRow}>
            <Avatar name={profile?.full_name || t('dash.counselor')} size={56} />
            <View style={styles.profileBody}>
              <Text style={styles.name}>{profile?.full_name || t('dash.counselor')}</Text>
              <Text style={styles.email}>{session?.user.email}</Text>
              {profile?.firm_name && <Text style={styles.firm}>{profile.firm_name}</Text>}
            </View>
          </View>
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
        </Card>

        <Card style={styles.section}>
          <InfoRow label={t('settings.version')} value={Constants.expoConfig?.version ?? '1.2.0'} />
          <InfoRow label={t('settings.dataStorage')} value={t('settings.dataStorageValue')} />
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
            loading={isDeleting}
            onPress={handleDeleteAccount}
            fullWidth
            style={styles.dangerButton}
          />
        </Card>
      </ScrollView>
    </Screen>
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
  langControl: {
    alignSelf: 'flex-start',
  },
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
