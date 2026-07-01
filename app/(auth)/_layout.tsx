import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/theme';

export default function AuthLayout() {
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
