import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns/format';
import { tr as trLocale } from 'date-fns/locale/tr';
import { enUS } from 'date-fns/locale/en-US';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResmiGazete } from '@/hooks/useResmiGazete';
import { grupla, type GazeteMaddesi } from '@/lib/resmiGazete';
import { useLangStore, useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * RESMÎ GAZETE — günlük fihrist (05.10.2026, ürün sahibi: "Resmî Gazete
 * özetini ekle"). Başlıklar Gazete'nin kendi fihristinden aynen gelir;
 * dokunulan madde resmî PDF/sayfada açılır. Gerekçe: src/lib/resmiGazete.ts.
 */
export default function ResmiGazeteScreen() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const locale = lang === 'en' ? enUS : trLocale;
  const { data: gunler = [], isLoading, isError, refetch } = useResmiGazete();
  const [secili, setSecili] = useState<string | null>(null);

  const gun = gunler.find((g) => g.tarih === secili) ?? gunler[0];
  const gruplar = useMemo(() => (gun ? grupla(gun.maddeler) : []), [gun]);
  const tarihYaz = (iso: string, kalip: string) => format(new Date(`${iso}T12:00:00`), kalip, { locale });
  const ac = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('rg.title')} subtitle={t('rg.subtitle')} showBack />
      {isLoading ? (
        <ActivityIndicator style={styles.yukleniyor} color={colors.primary} />
      ) : isError ? (
        <EmptyState icon="cloud-offline-outline" title={t('rg.errTitle')} description={t('rg.errBody')} actionLabel={t('rg.retry')} onAction={() => refetch()} />
      ) : !gun ? (
        <EmptyState icon="newspaper-outline" title={t('rg.emptyTitle')} description={t('rg.emptyBody')} />
      ) : (
        <ScrollView contentContainerStyle={styles.icerik}>
          {gunler.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gunler}>
              {gunler.map((g) => {
                const aktif = g.tarih === gun.tarih;
                return (
                  <Pressable
                    key={g.tarih}
                    onPress={() => setSecili(g.tarih)}
                    style={[styles.gunCip, aktif && styles.gunCipAktif]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: aktif }}
                    accessibilityLabel={tarihYaz(g.tarih, 'd MMMM yyyy')}
                  >
                    <Text style={[styles.gunCipMetin, aktif && styles.gunCipMetinAktif]}>{tarihYaz(g.tarih, 'd MMM')}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.basKart}>
            <Text style={styles.basTarih}>{tarihYaz(gun.tarih, 'd MMMM yyyy, EEEE')}</Text>
            <Text style={styles.basAlt}>
              {gun.sayi ? t('rg.sayi', { n: String(gun.sayi) }) : ''}
              {gun.sayi ? ' · ' : ''}
              {t('rg.maddeSayisi', { n: String(gun.maddeler.length) })}
              {gun.mukerrer > 0 ? ` · ${t('rg.mukerrerVar')}` : ''}
            </Text>
          </View>

          {gun.maddeler.length === 0 ? (
            <Text style={styles.not}>{t('rg.yalnizIlan')}</Text>
          ) : (
            gruplar.map(({ grup, maddeler }) => (
              <View key={grup} style={styles.grup}>
                <Text style={styles.grupBaslik}>
                  {grup} <Text style={styles.grupAdet}>({maddeler.length})</Text>
                </Text>
                {maddeler.map((m: GazeteMaddesi, i: number) => (
                  <Pressable
                    key={`${m.url}-${i}`}
                    onPress={() => ac(m.url)}
                    style={({ pressed }) => [styles.madde, pressed && styles.basili]}
                    accessibilityRole="link"
                    accessibilityLabel={m.baslik}
                  >
                    <View style={styles.maddeMetin}>
                      <Text style={styles.maddeBaslik}>{m.baslik}</Text>
                      {m.mukerrer && <Text style={styles.mukerrer}>{t('rg.mukerrer')}</Text>}
                    </View>
                    <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ))
          )}

          <Pressable onPress={() => ac(fihristAdresi(gun.tarih))} style={styles.kaynakSatir} accessibilityRole="link">
            <Ionicons name="globe-outline" size={15} color={colors.primary} />
            <Text style={styles.kaynakMetin}>{t('rg.kaynakAc')}</Text>
          </Pressable>
          <Text style={styles.not}>{t('rg.not')}</Text>
        </ScrollView>
      )}
    </Screen>
  );
}

/** Sunucudaki fihristUrl ile aynı (supabase/functions/_shared/resmiGazete.ts). */
function fihristAdresi(tarih: string): string {
  const [y, a, g] = tarih.split('-');
  return `https://www.resmigazete.gov.tr/eskiler/${y}/${a}/${y}${a}${g}.htm`;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    yukleniyor: { marginTop: spacing.xxl },
    icerik: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
    gunler: { gap: spacing.xs, paddingVertical: spacing.xxs },
    gunCip: {
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    gunCipAktif: { backgroundColor: colors.primary, borderColor: colors.primary },
    gunCipMetin: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
    gunCipMetinAktif: { color: colors.textInverse },
    basKart: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surface,
    },
    basTarih: { ...typography.h3, color: colors.textPrimary },
    basAlt: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
    grup: { gap: spacing.xs },
    grupBaslik: { ...typography.caption, color: colors.primary, fontWeight: '800', letterSpacing: 0.3 },
    grupAdet: { color: colors.textMuted, fontWeight: '600' },
    madde: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      padding: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surface,
    },
    basili: { opacity: 0.8 },
    maddeMetin: { flex: 1, gap: 2 },
    maddeBaslik: { ...typography.body, color: colors.textPrimary },
    mukerrer: { ...typography.small, color: colors.warning, fontWeight: '700' },
    kaynakSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44 },
    kaynakMetin: { ...typography.caption, color: colors.primary, fontWeight: '700' },
    not: { ...typography.small, color: colors.textMuted },
  });
}
