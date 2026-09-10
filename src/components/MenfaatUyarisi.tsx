import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ciddiMi, type Bulgu } from '@/utils/menfaatCatismasi';
import { useT } from '@/i18n';
import { fonts, spacing } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * ÇIKAR ÇATIŞMASI UYARISI — bütün bulgularla.
 *
 * ESKİ DAVRANIŞ: her iki formda da `.find(...)` ile İLK eşleşme bulunuyor ve
 * tek satırlık bir uyarı gösteriliyordu. Aynı kişi üç ayrı dosyada karşı
 * taraf olsa bile avukat yalnız birini görüyordu — oysa çatışmanın ağırlığı
 * tam olarak kaç dosyaya dokunduğudur.
 *
 * TON İKİYE AYRILDI. "Birebir/güçlü" eşleşmeler kırmızı ve öndedir; yalnız
 * soyadı tutan "zayıf" eşleşmeler ayrı ve sönük bir kutuda durur. Sebebi
 * pratiktir: her benzer soyadı kırmızı uyarı olsaydı avukat kutuyu okumayı
 * bırakırdı ve gerçek çatışma da o yığının içinde kaybolurdu.
 *
 * UYARI ENGELLEMEZ. Çatışma kararı hukukidir ve avukata aittir; uygulamanın
 * işi hatırlatmaktır, karar vermek değil.
 */
const GOSTERILECEK_AZAMI = 5;

export function MenfaatUyarisi({ bulgular }: { bulgular: Bulgu[] }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const t = useT();

  if (bulgular.length === 0) return null;

  const ciddiler = bulgular.filter((b) => b.guc !== 'zayif');
  const zayiflar = bulgular.filter((b) => b.guc === 'zayif');
  const ciddi = ciddiMi(bulgular);

  const satir = (b: Bulgu) =>
    t(`conflict.row.${b.tur}` as 'conflict.row.karsi-taraf', { ad: b.eslesenAd, kayit: b.kayitAdi });

  const kutu = (liste: Bulgu[], agir: boolean) => {
    if (liste.length === 0) return null;
    const gosterilen = liste.slice(0, GOSTERILECEK_AZAMI);
    const kalan = liste.length - gosterilen.length;
    return (
      <View
        style={[
          styles.box,
          agir
            ? { backgroundColor: colors.dangerSoft ?? colors.warningSoft, borderColor: colors.danger }
            : { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.head}>
          <Ionicons
            name={agir ? 'alert-circle' : 'information-circle-outline'}
            size={18}
            color={agir ? colors.danger : colors.textMuted}
          />
          <Text style={[styles.title, { color: agir ? colors.danger : colors.textMuted }]}>
            {t(agir ? 'conflict.title' : 'conflict.titleWeak')}
          </Text>
        </View>
        <Text style={styles.lead}>{t(agir ? 'conflict.lead' : 'conflict.leadWeak')}</Text>
        {gosterilen.map((b) => (
          <View key={`${b.tur}-${b.kayitId}`} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.rowText}>
              {satir(b)}
              <Text style={styles.guc}> ({t(`conflict.guc.${b.guc}` as 'conflict.guc.kesin')})</Text>
            </Text>
          </View>
        ))}
        {kalan > 0 && <Text style={styles.more}>{t('conflict.more', { n: String(kalan) })}</Text>}
      </View>
    );
  };

  return (
    <View>
      {kutu(ciddiler, ciddi)}
      {kutu(zayiflar, false)}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    box: {
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      gap: 6,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontFamily: fonts.bold, fontWeight: '700', fontSize: 13 },
    lead: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted },
    row: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
    bullet: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    rowText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
    guc: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
    more: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  });
