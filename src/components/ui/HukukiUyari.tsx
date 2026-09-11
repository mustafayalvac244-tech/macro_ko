import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * HUKUKİ SORUMLULUK UYARISI — üretilen her metnin yanında.
 *
 * NEDEN TEK BİLEŞEN: uyarı sekiz ayrı ekranda, sekiz ayrı cümleyle ve
 * bazılarında HİÇ yazılmamıştı (ölçüm 2026-09-11: dosya-aktar, contract,
 * daily-question ve vekalet ekranlarında tek kelime uyarı yoktu). Dağınık
 * metin hem kullanıcıyı hem de bir uyuşmazlıkta bizi zor durumda bırakır:
 * "uyardık" demek için uyarının NEREDE, NE ZAMAN ve NE YAZDIĞI belli olmalı.
 *
 * İKİ TÜR, ÇÜNKÜ İKİSİ AYNI ŞEY DEĞİL:
 *   'yapayZeka' → metni bir dil modeli üretti. Uydurma madde/karar riski var.
 *   'sablon'    → metin sabit bir şablondan üretildi. Model uydurmaz ama
 *                 metin somut olaya uymayabilir; yine hukuki tavsiye değildir.
 *   'degerlendirme' → yapay zekâ yok, şablon da yok: kullanıcının girdiği
 *                 bilgilerden otomatik bir sonuç çıkarılıyor (ör. vekâletnamede
 *                 özel yetki var mı). Girdi yanlışsa sonuç da yanlıştır.
 * AI olmayan bir çıktıya "AI uyarısı" koymak YANLIŞ BİLGİ olurdu; bu yüzden
 * üçe ayrıldı. (Ölçüm sırasında daily-question'a da uyarı koymayı düşündüm,
 * sonra baktım: orada metni kullanıcı kendi yazıyor, uyarı yanlış olurdu.)
 *
 * KAPATILAMAZ olması bilinçli: kapatılabilen bir uyarı, "gösterildi mi"
 * sorusunu tartışmalı hâle getirir.
 */
export type UyariTuru = 'yapayZeka' | 'sablon' | 'degerlendirme';

interface Props {
  tur: UyariTuru;
  /** Daha sıkışık yerleşim (kart içi, liste altı). */
  kucuk?: boolean;
}

export function HukukiUyari({ tur, kucuk = false }: Props) {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors, kucuk);
  const t = useT();

  const ikon =
    tur === 'yapayZeka' ? 'sparkles-outline'
    : tur === 'sablon' ? 'document-text-outline'
    : 'analytics-outline';
  const anahtar =
    tur === 'yapayZeka' ? 'uyari.yapayZeka'
    : tur === 'sablon' ? 'uyari.sablon'
    : 'uyari.degerlendirme';

  return (
    <View style={styles.kutu} accessibilityRole="alert">
      <Ionicons name={ikon} size={kucuk ? 12 : 14} color={colors.textMuted} />
      <Text style={styles.metin}>{t(anahtar as 'uyari.yapayZeka')}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, kucuk: boolean) => StyleSheet.create({
  kutu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.sm,
    paddingVertical: kucuk ? 6 : spacing.sm,
    paddingHorizontal: kucuk ? 8 : spacing.sm,
    marginTop: spacing.sm,
  },
  metin: {
    ...typography.small,
    color: colors.textMuted,
    flex: 1,
    lineHeight: kucuk ? 15 : 16,
    fontSize: kucuk ? 10 : 11,
  },
});
