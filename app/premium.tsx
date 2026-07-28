import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import { fonts, radius, spacing, shadow } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

type TierId = 'baslangic' | 'pro' | 'elit';

interface Tier {
  id: TierId;
  name: string;
  price: string;
  tagline: string;
  includesPrev?: string;
  features: string[];
  highlight?: boolean;
}

export default function PremiumScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const session = useAuthStore((s) => s.session);
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

  // IAP (App Store / Google Play) henüz bağlı değil. Bu ekran paketleri gösterir;
  // "Seç" seçimi kaydeder ve "çok yakında" bilgisi verir — sahte ödeme YOK,
  // ücretsiz premium da VERİLMEZ. IAP bağlanınca bu işleyiş satın almaya döner.
  const onSelect = (tier: Tier) => {
    AsyncStorage.setItem('vekil-plan-intent', tier.id).catch(() => {});
    Alert.alert(t('premium.soonTitle'), t('premium.soonBody', { plan: tier.name }));
  };

  const tiers: Tier[] = [
    {
      id: 'baslangic',
      name: t('premium.t.baslangic'),
      price: '₺500',
      tagline: t('premium.tag.baslangic'),
      features: [
        t('premium.f.unlimited'),
        t('premium.f.aiFree'),
        t('premium.f.grounded'),
        t('premium.f.reminders'),
        t('premium.f.finance'),
      ],
    },
    {
      id: 'pro',
      name: t('premium.t.pro'),
      price: '₺1.500',
      tagline: t('premium.tag.pro'),
      includesPrev: t('premium.includes', { plan: t('premium.t.baslangic') }),
      features: [t('premium.f.aiStrong'), t('premium.f.semantic'), t('premium.f.highLimit'), t('premium.f.priority')],
      highlight: true,
    },
    {
      id: 'elit',
      name: t('premium.t.elit'),
      price: '₺2.500',
      tagline: t('premium.tag.elit'),
      includesPrev: t('premium.includes', { plan: t('premium.t.pro') }),
      features: [t('premium.f.aiMax'), t('premium.f.unlimitedAi'), t('premium.f.team'), t('premium.f.support')],
    },
  ];

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('premium.plansTitle')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>{t('premium.plansSub')}</Text>

        {isPremium && (
          <View style={styles.activeChip}>
            <Ionicons name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.activeChipText}>{t('premium.activeBadge')}</Text>
          </View>
        )}

        {tiers.map((tier) => (
          <View key={tier.id} style={[styles.card, tier.highlight && styles.cardHi]}>
            {tier.highlight && (
              <View style={styles.badge}>
                <Ionicons name="star" size={11} color={onGold(colors.gold)} />
                <Text style={[styles.badgeText, { color: onGold(colors.gold) }]}>{t('premium.popular')}</Text>
              </View>
            )}

            <Text style={styles.tierName}>{tier.name}</Text>
            <Text style={styles.tierTag}>{tier.tagline}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>{tier.price}</Text>
              <Text style={styles.per}>{t('premium.perMonth')}</Text>
            </View>

            {tier.includesPrev && (
              <View style={styles.includesRow}>
                <Ionicons name="add-circle-outline" size={14} color={colors.gold} />
                <Text style={styles.includesText}>{tier.includesPrev}</Text>
              </View>
            )}

            <View style={styles.features}>
              {tier.features.map((f) => (
                <View key={f} style={styles.featRow}>
                  <Ionicons name="checkmark" size={16} color={colors.success} style={styles.featCheck} />
                  <Text style={styles.featText}>{f}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => onSelect(tier)}
              style={({ pressed }) => [
                styles.cta,
                tier.highlight ? styles.ctaHi : styles.ctaGhost,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.ctaText, { color: tier.highlight ? onGold(colors.gold) : colors.gold }]}>
                {t('premium.choose', { plan: tier.name })}
              </Text>
            </Pressable>
          </View>
        ))}

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
  card: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardHi: {
    borderWidth: 1.5,
    borderColor: colors.gold,
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
    fontSize: 20,
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
    fontSize: 32,
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  per: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  includesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  includesText: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.gold,
    flexShrink: 1,
  },
  features: {
    gap: 10,
    marginTop: spacing.md,
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
  ctaGhost: {
    backgroundColor: colors.goldSoft,
  },
  ctaText: {
    fontFamily: fonts.extrabold,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
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
