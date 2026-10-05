import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns/format';
import { tr as trLocale } from 'date-fns/locale/tr';
import { enUS } from 'date-fns/locale/en-US';
import { useResmiGazete } from '@/hooks/useResmiGazete';
import { onemliMaddeler } from '@/lib/resmiGazete';
import { useLangStore, useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

const GOSTERILEN = 3;

/**
 * ANA EKRAN — RESMÎ GAZETE KARTI (05.10.2026).
 *
 * En son günün öne çıkan en çok 3 maddesi (atama kararları ve üniversite iç
 * yönetmelikleri hariç; kural src/lib/resmiGazete.ts). Öne çıkan yoksa yalnız
 * madde sayısı yazar — kart boş başlık uydurmaz. Veri yoksa hiç çizilmez.
 * Kabı (kart çerçevesi, ızgara yeri) ana ekran verir: `cerceve` stili.
 */
export function ResmiGazeteKarti({ cerceve }: { cerceve?: StyleProp<ViewStyle> }) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const { data: gunler } = useResmiGazete();
  const gun = gunler?.[0];
  if (!gun) return null;

  const onemli = onemliMaddeler(gun.maddeler).slice(0, GOSTERILEN);
  const tarih = format(new Date(`${gun.tarih}T12:00:00`), 'd MMMM yyyy', { locale: lang === 'en' ? enUS : trLocale });
  const ac = () => router.push('/resmi-gazete' as Parameters<typeof router.push>[0]);

  return (
    <View style={cerceve}>
      <View style={styles.baslikSatir}>
        <View style={styles.baslikSol}>
          <View style={styles.ikon}>
            <Ionicons name="newspaper-outline" size={15} color={colors.primary} />
          </View>
          <Text allowFontScaling={false} style={styles.baslik}>{t('rg.title')}</Text>
        </View>
        <Pressable style={styles.baslikSag} onPress={ac} hitSlop={10} accessibilityRole="link">
          <Text allowFontScaling={false} style={styles.bag}>{t('rg.tumu')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <Text style={styles.alt}>
        {tarih}
        {gun.sayi ? ` · ${t('rg.sayi', { n: String(gun.sayi) })}` : ''}
        {` · ${t('rg.maddeSayisi', { n: String(gun.maddeler.length) })}`}
      </Text>

      {onemli.length === 0 ? (
        <Pressable onPress={ac} accessibilityRole="button">
          <Text style={styles.bos}>
            {gun.maddeler.length === 0 ? t('rg.yalnizIlan') : t('rg.oneCikanYok', { n: String(gun.maddeler.length) })}
          </Text>
        </Pressable>
      ) : (
        onemli.map((m, i) => (
          <Pressable key={`${m.url}-${i}`} onPress={ac} style={({ pressed }) => [styles.madde, pressed && styles.basili]} accessibilityRole="button">
            <Text style={styles.grup} numberOfLines={1}>{m.grup}</Text>
            <Text style={styles.maddeBaslik} numberOfLines={2}>{m.baslik}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    baslikSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    baslikSol: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    ikon: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    baslik: { ...typography.h3, color: colors.textPrimary },
    baslikSag: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
    bag: { ...typography.caption, color: colors.primary, fontWeight: '700' },
    alt: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs },
    bos: { ...typography.caption, color: colors.textSecondary },
    madde: { paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
    basili: { opacity: 0.8 },
    grup: { ...typography.small, color: colors.primary, fontWeight: '700' },
    maddeBaslik: { ...typography.caption, color: colors.textPrimary, marginTop: 2 },
  });
}
