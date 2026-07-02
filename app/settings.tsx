import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuthStore } from '@/store/authStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { useLangStore, useT, type Lang } from '@/i18n';
import { colors, spacing, typography } from '@/theme/theme';

export default function SettingsScreen() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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
          <InfoRow label={t('settings.version')} value="1.0.0" />
          <InfoRow label={t('settings.backend')} value="Supabase" />
        </Card>

        <Button label={t('settings.signOut')} variant="danger" onPress={handleSignOut} style={styles.signOutButton} />
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
