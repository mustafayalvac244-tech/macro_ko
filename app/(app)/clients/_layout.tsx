import { Stack } from 'expo-router';
import { useTheme } from '@/theme/useTheme';

export default function ClientsLayout() {
  const __t = useTheme();
  const colors = __t.colors;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
