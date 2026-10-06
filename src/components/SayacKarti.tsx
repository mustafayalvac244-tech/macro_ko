import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Belir } from '@/components/ui/Belir';
import { useSayacStore } from '@/store/sayacStore';
import { useT } from '@/i18n';
import { fonts, kose, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';
import { gecenSureMetni } from '@/utils/zamanKaydi';

/**
 * ANA EKRANDA ÇALIŞAN SAYAÇ (06.10.2026; tasarim/ilham/fernly-ozellikler.md
 * kare 03). Sayaç dosyanın "Zaman" sekmesinde başlatılıyordu ama yalnız orada
 * görünüyordu: avukat ana ekrana dönünce çalıştığını unutuyor, süre şişiyordu.
 * Kart yalnız sayaç ÇALIŞIRKEN çizilir. Durdurunca kayıt yine FORMLA yazılır
 * (tek yazma yolu — bkz. src/store/sayacStore.ts).
 * `yatay`: panoda tam genişlik şerit (süre solda, düğme sağda); telefonda dikey.
 */
export function SayacKarti({ cerceve, sira, yatay = false }: { cerceve?: StyleProp<ViewStyle>; sira: number; yatay?: boolean }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();
  const { startedAt, caseId, caseTitle, durdur } = useSayacStore();

  // Saniyede bir tazele — yalnız sayaç çalışırken.
  const [, tazele] = useState(0);
  useEffect(() => {
    if (startedAt == null) return;
    const it = setInterval(() => tazele((n) => n + 1), 1000);
    return () => clearInterval(it);
  }, [startedAt]);

  if (startedAt == null) return null;

  const durdurVeKaydet = () => {
    const dosya = { caseId, caseTitle };
    const dakika = durdur();
    router.push({
      pathname: '/time-entry-form',
      params: {
        ...(dosya.caseId ? { caseId: dosya.caseId } : {}),
        ...(dosya.caseTitle ? { caseTitle: dosya.caseTitle } : {}),
        minutes: String(dakika),
      },
    });
  };

  return (
    <Belir sira={sira} style={[cerceve, styles.kart, yatay && styles.yatay]}>
      <View style={yatay ? styles.yataySol : null}>
      <View style={styles.ust}>
        <View style={styles.nokta} />
        <Text allowFontScaling={false} style={styles.etiket}>{t('time.timerRunning')}</Text>
      </View>
      <Text allowFontScaling={false} style={styles.sure} accessibilityRole="timer">
        {gecenSureMetni(startedAt)}
      </Text>
      {caseTitle ? (
        <Pressable
          onPress={() => caseId && router.push(`/(app)/cases/${caseId}` as Parameters<typeof router.push>[0])}
          accessibilityRole="link"
          hitSlop={6}
        >
          <Text style={styles.dosya} numberOfLines={1}>{caseTitle}</Text>
        </Pressable>
      ) : null}
      </View>
      <Pressable
        onPress={durdurVeKaydet}
        style={({ pressed }) => [styles.dugme, yatay && styles.dugmeYatay, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Ionicons name="stop-circle-outline" size={18} color={colors.primary} />
        <Text allowFontScaling={false} style={styles.dugmeYazi}>{t('time.timerStop')}</Text>
      </Pressable>
    </Belir>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // Öne çıkan kart: vurgu zemini (videodaki koyu sayaç kartının karşılığı).
    kart: { backgroundColor: colors.primary },
    yatay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
    yataySol: { flexShrink: 1 },
    dugmeYatay: { marginTop: 0, paddingHorizontal: spacing.lg },
    ust: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    nokta: { width: 8, height: 8, borderRadius: kose(4), backgroundColor: colors.textInverse },
    etiket: { ...typography.caption, color: colors.textInverse, fontWeight: '700', opacity: 0.9 },
    sure: {
      fontFamily: fonts.extrabold,
      fontWeight: '800',
      fontSize: 40,
      lineHeight: 48,
      color: colors.textInverse,
      fontVariant: ['tabular-nums'],
      marginTop: spacing.xs,
    },
    dosya: { ...typography.caption, color: colors.textInverse, opacity: 0.9, textDecorationLine: 'underline' },
    dugme: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minHeight: 44,
      marginTop: spacing.md,
      borderRadius: 999,
      backgroundColor: colors.textInverse,
    },
    dugmeYazi: { ...typography.bodyMedium, color: colors.primary, fontWeight: '700' },
  });
}
