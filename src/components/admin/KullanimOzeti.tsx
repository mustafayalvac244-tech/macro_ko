import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAdminKullanimOzet, type AdminKullanimSatiri } from '@/hooks/useAdmin';
import { useT } from '@/i18n';
import { spacing, typography, kose } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

type Aralik = '1' | '7' | '30';

/**
 * KULLANIM ÖZETİ — 03.10.2026, satış planı (bkz. 0165_kullanim_sayac).
 *
 * "Kayıt geliyor, satış yok — nerede bırakıyorlar?" sorusunun cevabı. Önce
 * olaylar (kayıt, satın alma adımları), sonra ekranlar. Sayı = o aralıkta
 * kaç uygulama açılışında o ekrana girildiği; kişi sayısı DEĞİL (aynı kişi
 * iki gün açarsa iki sayılır). Kişi bilgisi tutulmuyor, gösterilmiyor.
 */
export function KullanimOzeti() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const [aralik, setAralik] = useState<Aralik>('7');
  const ozet = useAdminKullanimOzet(Number(aralik));

  const satirlar = ozet.data ?? [];
  const olaylar = satirlar.filter((s) => s.olay.startsWith('olay:'));
  const ekranlar = satirlar.filter((s) => s.olay.startsWith('ekran:'));

  const satir = (s: AdminKullanimSatiri) => {
    const dagilim = [
      s.ios ? `iOS ${s.ios}` : null,
      s.android ? `Android ${s.android}` : null,
      s.web ? `Web ${s.web}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <View key={s.olay} style={styles.satir}>
        <Text style={styles.ad} numberOfLines={1}>
          {s.olay.replace(/^(olay|ekran):/, '')}
        </Text>
        <Text style={styles.dagilim}>{dagilim}</Text>
        <Text style={styles.adet}>{s.adet}</Text>
      </View>
    );
  };

  return (
    <View style={styles.kutu}>
      <View style={styles.baslikSatiri}>
        <Ionicons name="stats-chart" size={15} color={colors.primary} />
        <Text style={styles.kutuBaslik}>{t('admin.usageTitle')}</Text>
      </View>
      <Text style={styles.not}>{t('admin.usageHint')}</Text>
      <SegmentedControl<Aralik>
        options={[
          { label: t('admin.usageDay1'), value: '1' },
          { label: t('admin.usageDay7'), value: '7' },
          { label: t('admin.usageDay30'), value: '30' },
        ]}
        value={aralik}
        onChange={setAralik}
      />
      {ozet.isError && <Text style={styles.hata}>{(ozet.error as Error).message}</Text>}
      {ozet.data && satirlar.length === 0 && <Text style={styles.not}>{t('admin.usageEmpty')}</Text>}
      {olaylar.length > 0 && <Text style={styles.grup}>{t('admin.usageEvents')}</Text>}
      {olaylar.map(satir)}
      {ekranlar.length > 0 && <Text style={styles.grup}>{t('admin.usageScreens')}</Text>}
      {ekranlar.map(satir)}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    kutu: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: kose(12),
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.xs,
    },
    baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    kutuBaslik: { ...typography.caption, color: colors.textPrimary },
    not: { ...typography.caption, color: colors.textSecondary },
    hata: { ...typography.caption, color: colors.danger },
    grup: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    satir: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    ad: { ...typography.caption, color: colors.textPrimary, flex: 1 },
    dagilim: { ...typography.small, color: colors.textMuted },
    adet: { ...typography.caption, color: colors.textPrimary, minWidth: 32, textAlign: 'right', fontVariant: ['tabular-nums'] },
  });
