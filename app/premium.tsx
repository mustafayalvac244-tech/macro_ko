import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
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
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isPaying, setIsPaying] = useState(false);
  const [showTestSheet, setShowTestSheet] = useState(false);
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

  const handleTestSuccess = async () => {
    setShowTestSheet(false);
    setIsPremium(true);
    await AsyncStorage.setItem('vekil-premium', '1').catch(() => {});
    // Record the purchase server-side so it's auditable and device-independent.
    // Best effort: the demo flow still succeeds if the table isn't set up yet.
    if (session?.user.id) {
      await supabase
        .from('purchases')
        .insert({ user_id: session.user.id, product: 'premium', platform: 'demo', amount: 199, currency: 'TRY' })
        .then(({ error }) => {
          if (error) console.warn('purchase ledger insert failed:', error.message);
        });
    }
    Alert.alert(t('premium.title'), t('tpay.success'));
  };

  const handlePay = async () => {
    if (!isConfigured) {
      // No Stripe key baked into this build → run the built-in demo payment
      // flow so the experience is testable end to end without a backend.
      setShowTestSheet(true);
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

          {isPremium && (
            <View style={styles.activeRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.activeText}>{t('tpay.active')}</Text>
            </View>
          )}

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
            <Text style={styles.warnText}>{t('tpay.modeNote')}</Text>
          </Card>
        )}
      </ScrollView>

      <TestPaymentSheet visible={showTestSheet} onClose={() => setShowTestSheet(false)} onSuccess={handleTestSuccess} />
    </Screen>
  );
}

/**
 * Built-in demo payment sheet used when no Stripe key is configured. Clearly
 * labeled test mode; no real charge happens anywhere.
 */
function TestPaymentSheet({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(__t.colors);

  const t = useT();
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('12/29');
  const [cvc, setCvc] = useState('123');
  const [isProcessing, setIsProcessing] = useState(false);

  const cardOk = cardNumber.replace(/\D/g, '').length === 16;
  const expOk = /^\d{2}\/\d{2}$/.test(expiry.trim());
  const cvcOk = /^\d{3,4}$/.test(cvc.trim());

  const pay = () => {
    if (!cardOk || !expOk || !cvcOk) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess();
    }, 1600);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.testBadge}>
              <Ionicons name="flask-outline" size={13} color={colors.warning} />
              <Text style={styles.testBadgeText}>{t('tpay.badge')}</Text>
            </View>
            <Text style={styles.sheetTitle}>{t('premium.title')}</Text>
            <Text style={styles.sheetAmount}>{t('premium.price')}</Text>

            <Input
              label={t('tpay.cardNumber')}
              value={cardNumber}
              onChangeText={setCardNumber}
              keyboardType="number-pad"
              icon="card-outline"
              maxLength={19}
            />
            <View style={styles.cardRow}>
              <Input label={t('tpay.expiry')} value={expiry} onChangeText={setExpiry} keyboardType="numbers-and-punctuation" containerStyle={styles.cardCol} maxLength={5} />
              <Input label={t('tpay.cvc')} value={cvc} onChangeText={setCvc} keyboardType="number-pad" containerStyle={styles.cardCol} maxLength={4} secureTextEntry />
            </View>

            <Button
              label={isProcessing ? t('tpay.processing') : t('tpay.pay')}
              icon="lock-closed-outline"
              onPress={pay}
              loading={isProcessing}
              disabled={!cardOk || !expOk || !cvcOk}
              fullWidth
              size="lg"
            />
            <Text style={styles.sheetNote}>{t('tpay.note')}</Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
