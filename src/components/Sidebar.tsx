import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

const PANEL_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);
const ANIM_MS = 220;

interface NavItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  path: string;
  color?: string;
}

/**
 * Left navigation panel (drawer). The profile block is pinned at the top;
 * tapping it expands an accordion with profile actions, tapping again
 * collapses it. Everything else is a flat shortcut list.
 */
export function Sidebar() {
  const visible = useSidebarStore((s) => s.isOpen);
  const onClose = useSidebarStore((s) => s.close);
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);

  const t = useT();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const avatarUrl = useAvatarUrl();

  const [profileOpen, setProfileOpen] = useState(false);
  const translate = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translate, { toValue: 0, duration: ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      ]).start();
    } else {
      translate.setValue(-PANEL_WIDTH);
      backdrop.setValue(0);
    }
  }, [visible, translate, backdrop]);

  const close = useCallback(
    (after?: () => void) => {
      Animated.parallel([
        Animated.timing(translate, { toValue: -PANEL_WIDTH, duration: ANIM_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
      ]).start(() => {
        onClose();
        after?.();
      });
    },
    [translate, backdrop, onClose]
  );

  const toggleProfile = () => {
    const next = !profileOpen;
    setProfileOpen(next);
    Animated.timing(chevron, { toValue: next ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  };

  const go = (path: string) => {
    close(() => router.push(path as Parameters<typeof router.push>[0]));
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: () => {
          close(async () => {
            await signOut();
            router.replace('/(auth)/login');
          });
        },
      },
    ]);
  };

  const mainItems: NavItem[] = [
    { icon: 'home-outline', label: t('tab.dashboard'), path: '/(app)' },
    { icon: 'briefcase-outline', label: t('cases.title'), path: '/(app)/cases' },
    { icon: 'people-outline', label: t('clients.title'), path: '/(app)/clients' },
    { icon: 'calendar-outline', label: t('cal.title'), path: '/(app)/calendar' },
    { icon: 'folder-open-outline', label: t('docs.title'), path: '/(app)/documents' },
    { icon: 'wallet-outline', label: t('ofinance.title'), path: '/finance' },
    { icon: 'hourglass-outline', label: t('wizard.title'), path: '/deadline-wizard' },
    { icon: 'calculator-outline', label: t('calc.title'), path: '/calculators' },
    { icon: 'sparkles-outline', label: t('ai.title'), path: '/ai-chat' },
    { icon: 'book-outline', label: t('const.title'), path: '/constitution' },
    { icon: 'stats-chart-outline', label: t('reports.title'), path: '/reports' },
    { icon: 'notifications-outline', label: t('reminders.title'), path: '/reminders' },
    { icon: 'chatbubble-ellipses-outline', label: t('settings.feedback'), path: '/feedback' },
    { icon: 'settings-outline', label: t('settings.title'), path: '/settings' },
  ];

  const chevronRotation = chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            { width: PANEL_WIDTH, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md, transform: [{ translateX: translate }] },
          ]}
        >
          {/* Profile block — pinned on top, accordion below it */}
          <Pressable style={styles.profileRow} onPress={toggleProfile}>
            <Avatar name={profile?.full_name || t('dash.counselor')} size={48} uri={avatarUrl} />
            <View style={styles.profileBody}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.full_name || t('dash.counselor')}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {session?.user.email}
              </Text>
            </View>
            <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Animated.View>
          </Pressable>

          {profileOpen && (
            <View style={styles.accordion}>
              <SidebarItem icon="create-outline" label={t('profile.editTitle')} onPress={() => go('/profile-form')} indented />
              <SidebarItem icon="key-outline" label={t('settings.changePassword')} onPress={() => go('/change-password')} indented />
              <SidebarItem icon="diamond-outline" label={t('settings.premium')} onPress={() => go('/premium')} indented color={colors.gold} />
              <SidebarItem icon="log-out-outline" label={t('settings.signOut')} onPress={handleSignOut} indented color={colors.danger} />
            </View>
          )}

          <View style={styles.divider} />

          <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
            {mainItems.map((item) => (
              <SidebarItem key={item.path} icon={item.icon} label={item.label} onPress={() => go(item.path)} />
            ))}
          </ScrollView>

          <Text style={styles.version}>Vekil v{Constants.expoConfig?.version ?? ''}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SidebarItem({
  icon,
  label,
  onPress,
  indented,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  indented?: boolean;
  color?: string;
}) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, indented && styles.itemIndented, pressed && styles.itemPressed]}
    >
      <Ionicons name={icon} size={19} color={color ?? colors.textSecondary} />
      <Text style={[styles.itemLabel, color ? { color } : undefined]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: 'rgba(10, 15, 30, 0.45)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  profileBody: {
    flex: 1,
  },
  profileName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  profileEmail: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  accordion: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: spacing.xs,
    marginTop: 2,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginVertical: spacing.sm,
  },
  navScroll: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  itemIndented: {
    paddingLeft: spacing.lg,
    paddingVertical: 9,
  },
  itemPressed: {
    backgroundColor: colors.surfaceHover,
  },
  itemLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  version: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
