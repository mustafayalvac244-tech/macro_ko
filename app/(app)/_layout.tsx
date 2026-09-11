import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/Sidebar';
import { useSidebarStore } from '@/store/sidebarStore';
import { kaliciMenuMu } from '@/theme/duzen';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

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
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: `${color}1A` }]}>
      <Ionicons name={focused ? filled : outline} size={22} color={focused ? color : colors.textMuted} />
    </View>
  );
}

export default function AppLayout() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);

  const t = useT();
  const { width } = useWindowDimensions();
  // Masaüstü genişliğinde menü hamburgerin arkasından çıkıp ekranın solunda
  // sürekli durur (bkz. src/theme/duzen.ts → kaliciMenuMu). Telefonda ve dar
  // tarayıcıda false döner, çekmece davranışı aynen korunur.
  const kaliciMenu = kaliciMenuMu(width);
  // ScreenHeader hamburgeri bu bayrağa bakarak gizler (bkz. sidebarStore).
  const setKalici = useSidebarStore((s) => s.setKalici);
  useEffect(() => {
    setKalici(kaliciMenu);
    // (app) düzeninden çıkıldığında kök ekranlarda hamburger geri gelmeli.
    return () => setKalici(false);
  }, [kaliciMenu, setKalici]);
  const session = useAuthStore((s) => s.session);
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <View style={[styles.kok, kaliciMenu && styles.kokSatir]}>
      {kaliciMenu && <Sidebar kalici />}
      <View style={styles.icerik}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarInactiveTintColor: colors.textMuted,
        // Bottom tab bar removed by request — navigation happens through the
        // left panel (hamburger) which is available on every screen.
        tabBarStyle: { display: 'none' },
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
      </View>
      {/* Kalıcı menü açıkken çekmece sürümü çizilmez: ikisi aynı anda
          görünürse aynı menü ekranda iki kez olurdu. */}
      {!kaliciMenu && <Sidebar />}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  kok: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  kokSatir: {
    flexDirection: 'row',
  },
  icerik: {
    flex: 1,
  },
  iconWrap: {
    width: 46,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
