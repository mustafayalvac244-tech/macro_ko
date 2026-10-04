import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { belgeSecVeOku, type BelgeEki, type EkHatasi } from '@/lib/belgeEki';
import { EK_EN_COK, PDF_SAYFA_TAVANI, ekOkumaPlani } from '@/lib/belgeEkiKurallari';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

interface Props {
  ekler: BelgeEki[];
  onChange: (ekler: BelgeEki[]) => void;
  disabled?: boolean;
  /** En çok kaç ek (belge incelemede 1). */
  enCok?: number;
}

/**
 * YAPAY ZEKÂYA EKLENEN BELGELER — liste + "Dosya ekle" (04.10.2026).
 *
 * Her ekin altında NASIL okunacağı yazar: sayfa görüntüleriyle mi, yalnız
 * metniyle mi. Sebep: avukat taranmış bir sayfanın okunup okunmadığını
 * göndermeden önce bilmeli; "yapay zekâ belgeyi okudu" sanıp okunmamış bir
 * sayfaya dayanmak, eksik okunan belgenin en tehlikeli hâlidir.
 * Kurallar: src/lib/belgeEkiKurallari.ts (sunucuyla aynı, test denetler).
 */
export function BelgeEkleri({ ekler, onChange, disabled = false, enCok = EK_EN_COK }: Props) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const [okunuyor, setOkunuyor] = useState(false);
  const [hata, setHata] = useState<EkHatasi | null>(null);
  const plan = ekOkumaPlani(ekler);

  const ekle = async () => {
    if (okunuyor || disabled) return;
    setHata(null);
    setOkunuyor(true);
    try {
      const sonuc = await belgeSecVeOku();
      if (!sonuc) return;
      if ('hata' in sonuc) {
        setHata(sonuc.hata);
        return;
      }
      onChange([...ekler, sonuc.ek].slice(0, enCok));
    } finally {
      setOkunuyor(false);
    }
  };

  const aciklama = (e: BelgeEki, i: number): string => {
    const sayfa = e.sayfa ?? 0;
    const taranmis = e.taranmis ?? 0;
    if (plan[i] === 'gorsel') {
      return taranmis > 0 ? t('ek.gorselTaranmis', { n: sayfa, t: taranmis }) : t('ek.gorsel', { n: sayfa });
    }
    if (e.pdf) {
      return taranmis > 0
        ? t('ek.metinPdfTaranmis', { n: sayfa, tavan: PDF_SAYFA_TAVANI, t: taranmis })
        : t('ek.metinPdf', { n: sayfa, tavan: PDF_SAYFA_TAVANI });
    }
    return t('ek.metin');
  };

  return (
    <View style={styles.sarmal}>
      {ekler.map((e, i) => (
        <View key={`${e.ad}-${i}`} style={styles.ek}>
          <Ionicons name={e.pdf ? 'document-text-outline' : 'document-outline'} size={18} color={colors.primary} />
          <View style={styles.ekMetin}>
            <Text style={styles.ekAd} numberOfLines={1}>
              {e.ad}
            </Text>
            <Text style={[styles.ekNot, plan[i] !== 'gorsel' && (e.taranmis ?? 0) > 0 && styles.ekNotUyari]}>
              {aciklama(e, i)}
            </Text>
          </View>
          <Pressable
            onPress={() => onChange(ekler.filter((_, j) => j !== i))}
            disabled={disabled}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`${t('ek.kaldir')}: ${e.ad}`}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      {ekler.length < enCok && (
        <Pressable
          onPress={ekle}
          disabled={disabled || okunuyor}
          style={({ pressed }) => [styles.ekleDugme, (disabled || okunuyor) && styles.kapali, pressed && styles.basili]}
          accessibilityRole="button"
          accessibilityLabel={t('ek.ekle')}
        >
          {okunuyor ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="attach-outline" size={18} color={colors.primary} />
          )}
          <View style={styles.ekMetin}>
            <Text style={styles.ekleMetin}>{okunuyor ? t('ek.okunuyor') : t('ek.ekle')}</Text>
            {!okunuyor && <Text style={styles.ekNot}>{t('ek.turler', { n: enCok })}</Text>}
          </View>
        </Pressable>
      )}

      {!!hata && <Text style={styles.hata}>{t(`ek.hata.${hata}` as const, { tavan: PDF_SAYFA_TAVANI })}</Text>}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sarmal: { gap: spacing.xs },
    ek: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ekMetin: { flex: 1, minWidth: 0 },
    ekAd: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
    ekNot: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
    ekNotUyari: { color: colors.warning },
    ekleDugme: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
    },
    ekleMetin: { ...typography.caption, color: colors.primary, fontWeight: '700' },
    kapali: { opacity: 0.6 },
    basili: { opacity: 0.85 },
    hata: { ...typography.caption, color: colors.danger },
  });
}
