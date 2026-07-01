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
import { useAuthStore } from '@/store/authStore';
import { registerForNotificationsAsync } from '@/lib/notifications';
import { colors, spacing, typography } from '@/theme/theme';

export default function SettingsScreen() {
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
        Alert.alert('Permission needed', 'Enable notifications in your device settings to receive hearing and deadline reminders.');
      }
    } else {
      Alert.alert(
        'Manage in system settings',
        'To fully disable notifications, turn them off for Macro Ko in your device settings.'
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
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
      <ScreenHeader title="Settings" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Avatar name={profile?.full_name || 'Attorney'} size={56} />
            <View style={styles.profileBody}>
              <Text style={styles.name}>{profile?.full_name || 'Attorney'}</Text>
              <Text style={styles.email}>{session?.user.email}</Text>
              {profile?.firm_name && <Text style={styles.firm}>{profile.firm_name}</Text>}
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={18} color={colors.textMuted} />
              <Text style={styles.rowLabel}>Hearing &amp; deadline reminders</Text>
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
          <InfoRow label="App version" value="1.0.0" />
          <InfoRow label="Backend" value="Supabase" />
        </Card>

        <Button label="Sign Out" variant="danger" onPress={handleSignOut} style={styles.signOutButton} />
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
