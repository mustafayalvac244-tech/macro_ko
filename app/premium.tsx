import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
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
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isPaying, setIsPaying] = useState(false);

  const handlePay = async () => {
    if (!isConfigured) {
      Alert.alert(t('premium.title'), t('premium.notConfigured'));
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
            <Text style={styles.price}>{t('premium.price')}</Text>
            <Text style={styles.priceNote}>{t('premium.priceNote')}</Text>
          </View>

          <Text style={styles.description}>{t('premium.desc')}</Text>

          <Button
            label={t('premium.pay')}
            icon="lock-closed-outline"
            onPress={handlePay}
            loading={isPaying}
            fullWidth
            size="lg"
            style={styles.payButton}
          />

          <View style={styles.secureRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.secureNote}>{t('premium.secureNote')}</Text>
          </View>
        </Card>

        {!isConfigured && (
          <Card style={styles.warnCard}>
            <Text style={styles.warnText}>{t('premium.notConfigured')}</Text>
          </Card>
        )}
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
});
