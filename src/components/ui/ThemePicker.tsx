import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeStore } from '@/theme/themeStore';
import { themeMetas } from '@/theme/palettes';
import { useTheme } from '@/theme/useTheme';
import { useLangStore } from '@/i18n';
import { spacing, radius, typography } from '@/theme/tokens';
import { sutunSayisi } from '@/theme/duzen';

/** Visual theme picker: a card per theme showing its actual bg/primary/gold swatch. */
export function ThemePicker() {
  const { colors } = useTheme();
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const lang = useLangStore((s) => s.lang);
  // KART GENİŞLİĞİ EKRANA GÖRE — sabit '%47' DEĞİL.
  // Telefon için yazılan iki sütun, 1440 px'lik tarayıcıda her karta ~545 px
  // veriyordu: içinde 54 px'lik minik bir renk şeridi olan yarım metre genişliğinde
  // kutular (15.09.2026, Ayarlar ekran görüntüsünde görüldü). Altıncı tema
  // eklenince üç satır boyunca sürüyor. Geniş ekranda üç sütun, dar ekranda
  // eski iki sütunlu düzen aynen kalıyor.
  const { width } = useWindowDimensions();
  const sutun = sutunSayisi(width, 240, 3);
  // '%47' yerine sütun sayısından türetilen esneme tabanı: iki sütunda
  // bugünkü görünümün aynısı, üç sütunda üçe bölünür.
  const taban = `${Math.floor(100 / Math.max(2, sutun)) - 3}%` as const satisfies `${number}%`;

  return (
    <View style={styles.grid}>
      {themeMetas.map((meta) => {
        const active = meta.id === themeId;
        const [bg, primary, gold] = meta.swatch;
        return (
          <Pressable
            key={meta.id}
            onPress={() => setTheme(meta.id)}
            style={[
              styles.card,
              { flexBasis: taban },
              { borderColor: active ? colors.primary : colors.borderSubtle, backgroundColor: colors.surface },
              active && styles.cardActive,
            ]}
          >
            <View style={[styles.preview, { backgroundColor: bg }]}>
              <View style={[styles.dot, { backgroundColor: primary }]} />
              <View style={[styles.dot, styles.dotSmall, { backgroundColor: gold }]} />
              {active && (
                <View style={[styles.check, { backgroundColor: colors.primary }]}>
                  <Ionicons name="checkmark" size={12} color={colors.textInverse} />
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: active ? colors.primary : colors.textSecondary }]}>
              {lang === 'tr' ? meta.name : meta.nameEn}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    flexGrow: 1,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.xs,
    alignItems: 'center',
  },
  cardActive: {
    // subtle emphasis handled by border color
  },
  preview: {
    width: '100%',
    height: 54,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  dotSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
  },
});
