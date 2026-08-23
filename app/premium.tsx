import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { useTrialStatus, MONTHLY_PRICE_TRY } from '@/hooks/useTrialStatus';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { fonts, radius, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * Üyelik ekranı — TEK plan: 7 gün ücretsiz deneme → aylık abonelik (399 ₺).
 *
 * IAP (App Store / Google Play) henüz bağlı değil. "Aboneliğe Geç" seçimi
 * kaydeder ve "çok yakında" bilgisi verir — sahte ödeme YOK, ücretsiz premium
 * da VERİLMEZ. IAP bağlanınca bu buton gerçek satın almaya döner.
 *
 * Deneme durumu useTrialStatus'tan gelir (hesap açılış tarihine göre). Şu an
 * "yumuşak" mod: deneme bitince uygulama kilitlenmez, sadece bu ekrana yönlendiren
 * hatırlatma gösterilir.
 */
export default function PremiumScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const session = useAuthStore((s) => s.session);
  const trial = useTrialStatus();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
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
        if (!error && data && data.length > 0) setIsPremium(true);
      });
  }, [session?.user.id]);

  const subscribed = isPremium || trial.subscribed;

  const onSubscribe = () => {
    AsyncStorage.setItem('vekil-plan-intent', 'vekilpro').catch(() => {});
    Alert.alert(t('premium.soonTitle'), t('premium.soonBody', { plan: t('premium.oneName') }));
  };

  const features = [
    t('premium.f.allCases'),
    t('premium.f.remindersFull'),
    t('premium.f.financeFull'),
    t('premium.f.docsFull'),
    t('premium.f.backupFull'),
    t('premium.f.aiSoon'),
  ];

  // Deneme durum satırı (abone değilse).
  const trialLine = subscribed
    ? null
    : trial.ended
      ? t('premium.trialEnded')
      : trial.daysLeft <= 1
        ? t('premium.trialLastDay')
        : t('premium.trialActive', { n: trial.daysLeft });

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('premium.plansTitle')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t('premium.oneSub')}</Text>

        {subscribed ? (
          <View style={styles.activeChip}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.activeChipText}>{t('premium.activeBadge')}</Text>
          </View>
        ) : (
          !!trialLine && (
            <View style={[styles.statusChip, trial.ended && styles.statusChipEnded]}>
              <Ionicons
                name={trial.ended ? 'time-outline' : 'gift-outline'}
                size={15}
                color={trial.ended ? colors.danger : colors.primary}
              />
              <Text style={[styles.statusChipText, trial.ended && { color: colors.danger }]}>{trialLine}</Text>
            </View>
          )
        )}

        <View style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name="star" size={11} color={onGold(colors.gold)} />
            <Text style={[styles.badgeText, { color: onGold(colors.gold) }]}>{t('premium.trialBadge')}</Text>
          </View>

          <Text style={styles.tierName}>{t('premium.oneName')}</Text>
          <Text style={styles.tierTag}>{t('premium.oneTag')}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₺{MONTHLY_PRICE_TRY}</Text>
            <Text style={styles.per}>{t('premium.perMonth')}</Text>
          </View>

          <View style={styles.features}>
            {features.map((f) => (
              <View key={f} style={styles.featRow}>
                <Ionicons name="checkmark" size={16} color={colors.success} style={styles.featCheck} />
                <Text style={styles.featText}>{f}</Text>
              </View>
            ))}
          </View>

          {!subscribed && (
            <Pressable
              onPress={onSubscribe}
              style={({ pressed }) => [styles.cta, styles.ctaHi, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.ctaText, { color: onGold(colors.gold) }]}>{t('premium.subscribeCta')}</Text>
            </Pressable>
          )}

          {!subscribed && (
            <Text style={styles.finePrint}>{t('premium.trialFinePrint', { price: String(MONTHLY_PRICE_TRY) })}</Text>
          )}
        </View>

        <View style={styles.noteRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
          <Text style={styles.noteText}>{t('premium.storeNote')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Altın zemin üzerindeki yazı: parlak altında koyu, koyu altında beyaz. */
function onGold(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#14213D' : '#FFFFFF';
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeChipText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.success,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusChipEnded: {
    backgroundColor: colors.dangerSoft,
  },
  statusChipText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.primary,
  },
  card: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.gold,
    ...shadow.card,
  },
  badge: {
    position: 'absolute',
    top: -11,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tierName: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  tierTag: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: spacing.md,
  },
  price: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 34,
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  per: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  features: {
    gap: 10,
    marginTop: spacing.lg,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featCheck: {
    marginTop: 1,
  },
  featText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    flex: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  ctaHi: {
    backgroundColor: colors.gold,
  },
  ctaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  finePrint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  noteText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    flexShrink: 1,
  },
});
