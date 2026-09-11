import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * KARAR ATFI DENETİMİ — sunucunun döndüğü özetin ekrandaki karşılığı.
 *
 * Bu bileşenin tek işi ÜÇ DURUMU AYRI GÖSTERMEK. Hepsini tek bir kırmızı
 * uyarıya indirseydik iki yönde de yanlış olurdu:
 *
 *   • DOĞRULANDI  — atıf havuzumuzda bulundu. Bunu söylemek, uyarıların
 *     güvenilirliğini kuran şeydir: avukat "bu program her şeye şüpheyle
 *     bakıyor" değil, "bu programda hangi atıf teyit edildi belli" der.
 *   • HAVUZDA YOK  — bizde ~11 bin karar var, Yargıtay milyonlarca karar
 *     verdi. Bulamamak BİZİM eksiğimizdir. "Uydurma" demek, gerçek bir kararı
 *     yanlış diye işaretlemektir; o yüzden burada yazan şey "teyit ediniz".
 *   • OLANAKSIZ    — korpustan bağımsız olarak olamaz (karar yılı esas
 *     yılından önce, gelecek yıl, hiç var olmamış daire). Kesin konuşabildiğimiz
 *     tek yer; o yüzden tek kırmızı da burası.
 *
 * Rakiplerde bu denetimin karşılığı yok: karar sayısı ilan ediliyor, çıktıdaki
 * atfın doğrulanıp doğrulanmadığı ilan edilmiyor.
 */
export interface KararDenetimiVerisi {
  toplam: number;
  dogrulanan: string[];
  havuzdaYok: string[];
  olanaksiz: Array<{ atif: string; sebep: string }>;
}

export function AtifDenetimi({ veri }: { veri: KararDenetimiVerisi | null | undefined }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();

  if (!veri || veri.toplam <= 0) return null;

  const sebepMetni = (s: string) => {
    switch (s) {
      case 'gelecek_yil':
        return t('atif.sebepGelecekYil');
      case 'karar_esastan_once':
        return t('atif.sebepKararEsastanOnce');
      case 'daire_yok':
        return t('atif.sebepDaireYok');
      case 'cok_eski':
        return t('atif.sebepCokEski');
      default:
        return '';
    }
  };

  return (
    <View style={styles.kutu}>
      <View style={styles.baslikSatiri}>
        <Ionicons name="shield-checkmark-outline" size={16} color={__t.colors.textSecondary} />
        <Text style={styles.baslik}>{t('atif.baslik', { n: String(veri.toplam) })}</Text>
      </View>

      {veri.olanaksiz.length > 0 && (
        <View style={[styles.satir, styles.kirmizi]}>
          <Text style={styles.kirmiziMetin}>{t('atif.olanaksizBaslik')}</Text>
          {veri.olanaksiz.map((o) => (
            <Text key={o.atif} style={styles.kirmiziMetin} selectable>
              • {o.atif} — {sebepMetni(o.sebep)}
            </Text>
          ))}
        </View>
      )}

      {veri.havuzdaYok.length > 0 && (
        <View style={[styles.satir, styles.sari]}>
          <Text style={styles.sariMetin}>{t('atif.havuzdaYokBaslik')}</Text>
          <Text style={styles.sariMetin} selectable>
            {veri.havuzdaYok.join(' · ')}
          </Text>
          <Text style={styles.kucukNot}>{t('atif.havuzdaYokNot')}</Text>
        </View>
      )}

      {veri.dogrulanan.length > 0 && (
        <View style={[styles.satir, styles.yesil]}>
          <Text style={styles.yesilMetin}>
            {t('atif.dogrulandiBaslik', { n: String(veri.dogrulanan.length) })}
          </Text>
          <Text style={styles.yesilMetin} selectable>
            {veri.dogrulanan.join(' · ')}
          </Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    kutu: {
      marginTop: spacing.sm,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    baslik: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
    satir: { borderRadius: radius.sm, padding: spacing.sm, gap: 2 },
    kirmizi: { backgroundColor: colors.dangerSoft },
    sari: { backgroundColor: colors.warningSoft },
    yesil: { backgroundColor: colors.successSoft },
    kirmiziMetin: { ...typography.caption, color: colors.danger, fontWeight: '600' },
    sariMetin: { ...typography.caption, color: colors.warning },
    yesilMetin: { ...typography.caption, color: colors.success },
    kucukNot: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  });
}
