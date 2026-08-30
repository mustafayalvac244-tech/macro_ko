import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme/useTheme';

export default function AuthLayout() {
  const __t = useTheme();
  const colors = __t.colors;

  const session = useAuthStore((s) => s.session);
  if (session) return <Redirect href="/(app)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
