import { useCallback, useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { VekilLogo } from '@/components/ui/VekilLogo';
import { useLockStore } from '@/store/lockStore';
import { useT } from '@/i18n';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Full-screen biometric lock overlay. Rendered above the navigator; locks on
 * cold start (when enabled) and whenever the app goes to the background.
 */
export function AppLock() {
  const { colors } = useTheme();
  const t = useT();
  const enabled = useLockStore((s) => s.enabled);
  const locked = useLockStore((s) => s.locked);
  const lock = useLockStore((s) => s.lock);
  const unlock = useLockStore((s) => s.unlock);
  const isPrompting = useRef(false);

  const authenticate = useCallback(async () => {
    if (isPrompting.current) return;
    isPrompting.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('lock.prompt'),
        cancelLabel: t('common.cancel'),
      });
      if (result.success) unlock();
    } catch {
      // stay locked; the user can retry with the button
    } finally {
      isPrompting.current = false;
    }
  }, [t, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') lock();
    });
    return () => sub.remove();
  }, [lock]);

  useEffect(() => {
    if (locked) authenticate();
  }, [locked, authenticate]);

  if (!enabled || !locked) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: colors.bg }]}>
      <VekilLogo size={110} nodeFill={colors.primary} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('lock.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('lock.subtitle')}</Text>
      <Pressable
        onPress={authenticate}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="finger-print" size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>{t('lock.unlock')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 999,
  },
  title: {
    ...typography.h1,
    marginTop: spacing.lg,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 14,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    marginTop: spacing.xl,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
