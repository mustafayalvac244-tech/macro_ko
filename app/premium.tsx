import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const isConfigured = !!STRIPE_KEY && !STRIPE_KEY.includes('your-publishable-key');

export default function PremiumScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const session = useAuthStore((s) => s.session);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isPaying, setIsPaying] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    // Server ledger is the source of truth (survives reinstall / new phone);
    // AsyncStorage is only an offline cache.
    AsyncStorage.getItem('vekil-premium').then((v) => {
      if (v === '1') setIsPremium(true);
    });
    const userId = session?.user.id;
    if (!userId) return;
    supabase
      .from('purchases')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setIsPremium(true);
          AsyncStorage.setItem('vekil-premium', '1').catch(() => {});
        }
      });
  }, [session?.user.id]);

  // Launch offer: until real in-app purchases (StoreKit/Play Billing via
  // RevenueCat) are wired up, Premium is granted free with one tap — no fake
  // card sheet, nothing that could mislead a user or an app-store reviewer.
  const handleActivateFree = async () => {
    setIsPaying(true);
    setIsPremium(true);
    await AsyncStorage.setItem('vekil-premium', '1').catch(() => {});
    if (session?.user.id) {
      await supabase
        .from('purchases')
        .insert({ user_id: session.user.id, product: 'premium', platform: 'demo', amount: 0, currency: 'TRY' })
        .then(({ error }) => {
          if (error) console.warn('purchase ledger insert failed:', error.message);
        });
      // Flag the profile so the gold avatar ring shows everywhere.
      await supabase.from('profiles').update({ is_premium: true }).eq('id', session.user.id).then(() => {});
      await refreshProfile().catch(() => {});
    }
    setIsPaying(false);
    Alert.alert(t('premium.title'), t('premium.launchActivated'));
  };

  const handlePay = async () => {
    if (!isConfigured) {
      // No real payment provider configured yet → free launch activation.
      await handleActivateFree();
      return;
    }

    setIsPaying(true);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      const response = await fetch(`${supabaseUrl}/functions/v1/payment-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${session?.access_token ?? anonKey}`,
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { clientSecret?: string; error?: string };
      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: payload.clientSecret,
        merchantDisplayName: 'Vekil',
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        // "Canceled" means the user closed the sheet — not an error worth alerting.
        if (presentError.code !== 'Canceled') throw new Error(presentError.message);
        return;
      }

      Alert.alert(t('premium.title'), t('premium.success'));
    } catch (err) {
      Alert.alert(t('premium.failed'), err instanceof Error ? err.message : t('upload.tryAgain'));
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('premium.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="diamond-outline" size={30} color={colors.gold} />
          </View>
          <Text style={styles.heroTitle}>{t('premium.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('premium.subtitle')}</Text>

          <View style={styles.priceRow}>
            {isConfigured ? (
              <>
                <Text style={styles.price}>{t('premium.price')}</Text>
                <Text style={styles.priceNote}>{t('premium.priceNote')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.priceStrike}>{t('premium.price')}</Text>
                <Text style={styles.priceFree}>{t('premium.launchFree')}</Text>
              </>
            )}
          </View>

          <Text style={styles.description}>{t('premium.desc')}</Text>

          {isPremium ? (
            <View style={styles.activeRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.activeText}>{t('premium.activeBadge')}</Text>
            </View>
          ) : (
            <Button
              label={isConfigured ? t('premium.pay') : t('premium.launchCta')}
              icon={isConfigured ? 'lock-closed-outline' : 'diamond-outline'}
              onPress={handlePay}
              loading={isPaying}
              fullWidth
              size="lg"
              style={styles.payButton}
            />
          )}

          <View style={styles.secureRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.secureNote}>{isConfigured ? t('premium.secureNote') : t('premium.launchNote')}</Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  heroSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  price: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  priceNote: {
    ...typography.caption,
    color: colors.textMuted,
  },
  priceStrike: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  priceFree: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.success,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  payButton: {
    marginTop: spacing.xl,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  secureNote: {
    ...typography.small,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  warnCard: {
    marginTop: spacing.md,
    borderColor: 'rgba(185, 126, 20, 0.4)',
  },
  warnText: {
    ...typography.caption,
    color: colors.warning,
    lineHeight: 19,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  activeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  testBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  testBadgeText: {
    ...typography.small,
    color: colors.warning,
    fontWeight: '800',
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sheetAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardCol: {
    flex: 1,
  },
  sheetNote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 15,
  },
});
