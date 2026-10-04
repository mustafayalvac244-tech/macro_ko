import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSesleYaz } from '@/hooks/useSesleYaz';
import { dikteEkle } from '@/utils/dikte';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

type Durum = ReturnType<typeof useSesleYaz>;

/**
 * SESLE YAZMA DÜĞMESİ — gerekçe ve sınırlar: src/hooks/useSesleYaz.ts.
 * Tarayıcı desteklemiyorsa hiçbir şey çizmez.
 *
 * TELEFONDA İPUCU (04.10.2026). Avukatlar "yazarken mikrofon" istedi ve
 * uygulamayı çoğunlukla iPhone'da kullanıyor; düğme yalnız web'de olduğu için
 * telefonda istek karşılanmamıştı. Uygulama içi mikrofon yeni bir yerel modül
 * ister (derleme + App Store incelemesi). O karar verilene kadar telefonda
 * klavyenin kendi dikte tuşu GÖSTERİLİR — çoğu kişi orada olduğunu bilmiyor.
 */

/**
 * Bir metin alanına dikte bağlar. Aynı sonuç olayında birden çok parça
 * kesinleşebilir; her biri bir öncekinin ÜSTÜNE eklensin diye güncel metin
 * bir ref'te tutulur (yalnız `metin` kullanılsaydı ikinci parça birinciyi
 * ezerdi — ikisi de aynı eski metinden hesaplanırdı).
 */
export function useDikte(metin: string, onChange: (yeni: string) => void): Durum {
  const son = useRef(metin);
  son.current = metin;
  return useSesleYaz((parca) => {
    const yeni = dikteEkle(son.current, parca);
    son.current = yeni;
    onChange(yeni);
  });
}

/** Yalnız simge — sohbet giriş çubuğu gibi dar yerler için. */
export function SesleYazDugmesi({ ses, disabled }: { ses: Durum; disabled?: boolean }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();
  if (!ses.destek) return null;
  return (
    <Pressable
      onPress={ses.dinliyor ? ses.durdur : ses.baslat}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.yuvarlak, ses.dinliyor && styles.yuvarlakAcik, disabled && styles.kapali, pressed && styles.basili]}
      accessibilityRole="button"
      accessibilityLabel={ses.dinliyor ? t('ses.dinliyor') : t('ses.yaz')}
    >
      <Ionicons name={ses.dinliyor ? 'stop' : 'mic-outline'} size={20} color={ses.dinliyor ? __t.colors.textInverse : __t.colors.primary} />
    </Pressable>
  );
}

/** Dinlerken ara metin, gizlilik notu ve hata satırı. */
export function SesleYazDurumu({ ses }: { ses: Durum }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();
  if (!ses.destek || (!ses.dinliyor && !ses.hata)) return null;
  return (
    <View style={styles.durum}>
      {ses.dinliyor && (
        <>
          <Text style={styles.dinliyor}>{ses.ara ? `${t('ses.dinliyor')} ${ses.ara}` : t('ses.dinliyor')}</Text>
          <Text style={styles.not}>{t('ses.not')}</Text>
        </>
      )}
      {!!ses.hata && <Text style={styles.hata}>{t(`ses.hata.${ses.hata}` as const)}</Text>}
    </View>
  );
}

/** Form ekranları için: metin kutusunun altına "Sesle yaz" satırı. */
export function SesleYaz({ metin, onChange, disabled }: { metin: string; onChange: (yeni: string) => void; disabled?: boolean }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();
  const ses = useDikte(metin, onChange);
  if (!ses.destek) {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
    return (
      <View style={styles.ipucu}>
        <Ionicons name="mic-outline" size={15} color={__t.colors.textSecondary} />
        <Text style={styles.ipucuMetin}>{t(Platform.OS === 'ios' ? 'ses.klavyeIos' : 'ses.klavyeAndroid')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.satirSarmal}>
      <Pressable
        onPress={ses.dinliyor ? ses.durdur : ses.baslat}
        disabled={disabled}
        hitSlop={6}
        style={({ pressed }) => [styles.satir, ses.dinliyor && styles.satirAcik, disabled && styles.kapali, pressed && styles.basili]}
        accessibilityRole="button"
        accessibilityLabel={ses.dinliyor ? t('ses.dinliyor') : t('ses.yaz')}
      >
        <Ionicons name={ses.dinliyor ? 'stop' : 'mic-outline'} size={17} color={ses.dinliyor ? __t.colors.textInverse : __t.colors.primary} />
        <Text style={[styles.satirMetin, ses.dinliyor && styles.satirMetinAcik]}>{ses.dinliyor ? t('ses.durdur') : t('ses.yaz')}</Text>
      </Pressable>
      <SesleYazDurumu ses={ses} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    yuvarlak: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    yuvarlakAcik: { backgroundColor: colors.danger, borderColor: colors.danger },
    satirSarmal: { gap: spacing.xs, marginTop: spacing.xs },
    ipucu: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.xs },
    ipucuMetin: { ...typography.small, color: colors.textSecondary, flex: 1 },
    satir: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      minHeight: 36,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    satirAcik: { backgroundColor: colors.danger, borderColor: colors.danger },
    satirMetin: { ...typography.caption, color: colors.primary, fontWeight: '700' },
    satirMetinAcik: { color: colors.textInverse },
    durum: { gap: 2 },
    dinliyor: { ...typography.caption, color: colors.textPrimary },
    not: { ...typography.small, color: colors.textMuted },
    hata: { ...typography.caption, color: colors.danger },
    kapali: { opacity: 0.5 },
    basili: { opacity: 0.85 },
  });
}
