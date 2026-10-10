import { useRef } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { girisHedefi } from '@/lib/girisYonlendirme';
import { useTheme } from '@/theme/useTheme';

export default function AuthLayout() {
  const __t = useTheme();
  const colors = __t.colors;

  const session = useAuthStore((s) => s.session);
  // Oturumsuz derin bağlantıdan gelindiyse girişten sonra O EKRANA dönülür
  // (bkz. girisYonlendirme.ts). Hedef oturum ilk göründüğü anda dondurulur:
  // sonraki yeniden çizimlerde href değişip ikinci bir yönlendirme tetiklenmesin.
  const hedef = useRef<string | null>(null);
  if (!session) hedef.current = null;
  else if (hedef.current === null) hedef.current = girisHedefi();
  if (session) return <Redirect href={hedef.current as Parameters<typeof Redirect>[0]['href']} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
