import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/i18n';
import { colors } from '@/theme/theme';

const TAB_COLORS = {
  dashboard: '#1E4B9E',
  cases: '#0E7490',
  calendar: '#7C3AED',
  vault: '#A87F2E',
  clients: '#1B9E63',
} as const;

function TabIcon({
  focused,
  color,
  outline,
  filled,
}: {
  focused: boolean;
  color: string;
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: `${color}1A` }]}>
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? color : colors.textMuted} />
    </View>
  );
}

export default function AppLayout() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.borderSubtle,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.dashboard'),
          tabBarActiveTintColor: TAB_COLORS.dashboard,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} color={TAB_COLORS.dashboard} outline="grid-outline" filled="grid" />
          ),
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: t('tab.cases'),
          tabBarActiveTintColor: TAB_COLORS.cases,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} color={TAB_COLORS.cases} outline="briefcase-outline" filled="briefcase" />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tab.calendar'),
          tabBarActiveTintColor: TAB_COLORS.calendar,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} color={TAB_COLORS.calendar} outline="calendar-outline" filled="calendar" />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: t('tab.vault'),
          tabBarActiveTintColor: TAB_COLORS.vault,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} color={TAB_COLORS.vault} outline="folder-outline" filled="folder" />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t('tab.clients'),
          tabBarActiveTintColor: TAB_COLORS.clients,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} color={TAB_COLORS.clients} outline="people-outline" filled="people" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 46,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
