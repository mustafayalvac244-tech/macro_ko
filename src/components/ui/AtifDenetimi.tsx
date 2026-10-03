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
 *   • ÇIKARILDI    — mantıken olamayan (karar yılı esas yılından önce, gelecek
 *     yıl, olmayan daire) ya da ne havuzda ne canlı UYAP'ta bulunan künye.
 *     03.10.2026'dan beri bunlar sunucuda METİNDEN ÇIKARILIR ve burada
 *     LİSTELENMEZ (ürün sahibi: "kullanıcıya yazılamaz"); yalnız sayısı yazar.
 *
 * Rakiplerde bu denetimin karşılığı yok: karar sayısı ilan ediliyor, çıktıdaki
 * atfın doğrulanıp doğrulanmadığı ilan edilmiyor.
 */
export interface KararDenetimiVerisi {
  toplam: number;
  dogrulanan: Array<{ atif: string; daire?: string; tarih?: string; id?: string; kaynak?: 'havuz' | 'uyap' }>;
  havuzdaYok: string[];
  /** Havuzda yok VE canlı UYAP aramasında da yok (03.10.2026). Eski sunucuda alan gelmez. */
  canlidaYok?: string[];
  /** Çıkarılan künyenin cümlesi için havuzda/UYAP'ta bulunan GERÇEK karar adayları. */
  oneriler?: Array<{ icin: string; kararlar: Array<{ atif: string; daire?: string; tarih?: string; id?: string; ozet?: string }> }>;
  olanaksiz: Array<{ atif: string; sebep: string }>;
}

export function AtifDenetimi({ veri }: { veri: KararDenetimiVerisi | null | undefined }) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();

  if (!veri || veri.toplam <= 0) return null;
  const cikarilan = veri.olanaksiz.length + (veri.canlidaYok?.length ?? 0);

  return (
    <View style={styles.kutu}>
      <View style={styles.baslikSatiri}>
        <Ionicons name="shield-checkmark-outline" size={16} color={__t.colors.textSecondary} />
        <Text style={styles.baslik}>{t('atif.baslik', { n: String(veri.toplam) })}</Text>
      </View>

      {/* ÇIKARILAN KÜNYELER — 03.10.2026, ürün sahibi: "kullanıcıya yazılamaz".
          Ne havuzda ne canlı UYAP'ta bulunan ya da mantıken olamayan künye
          sunucuda metinden çıkarılır; burada künye LİSTELENMEZ, yalnız sayı. */}
      {cikarilan > 0 && (
        <View style={[styles.satir, styles.kirmizi]}>
          <Text style={styles.kirmiziMetin}>{t('atif.cikarildiBaslik', { n: String(cikarilan) })}</Text>
          <Text style={styles.kucukNot}>{t('atif.cikarildiNot')}</Text>
        </View>
      )}

      {/* ÇIKARILAN KÜNYE YERİNE GERÇEK ADAYLAR — metne sokulmaz, avukat seçer. */}
      {(veri.oneriler?.length ?? 0) > 0 && (
        <View style={[styles.satir, styles.mavi]}>
          <Text style={styles.maviMetin}>{t('atif.oneriBaslik')}</Text>
          {veri.oneriler!.map((o, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={styles.kucukNot} numberOfLines={2}>“{o.icin}”</Text>
              {o.kararlar.map((k) => (
                <Text key={k.atif + (k.id ?? '')} style={styles.maviMetin} selectable>
                  • {k.atif}{k.tarih ? ` (${k.tarih})` : ''}{k.ozet ? ` — ${k.ozet}` : ''}
                </Text>
              ))}
            </View>
          ))}
          <Text style={styles.kucukNot}>{t('atif.oneriNot')}</Text>
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
          {/* Künye de yazılır: çıplak "doğrulandı" damgası kanıt değildir,
              avukat hangi daireye ve tarihe baktığımızı görmeli. */}
          {veri.dogrulanan.map((d) => (
            <Text key={d.atif} style={styles.yesilMetin} selectable>
              • {d.atif}
              {d.daire ? ` — ${d.daire}` : ''}
              {d.tarih ? ` (${d.tarih})` : ''}
              {d.kaynak === 'uyap' ? ` · ${t('atif.kaynakUyap')}` : ''}
            </Text>
          ))}
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
    mavi: { backgroundColor: colors.infoSoft },
    maviMetin: { ...typography.caption, color: colors.info },
    kirmiziMetin: { ...typography.caption, color: colors.danger, fontWeight: '600' },
    sariMetin: { ...typography.caption, color: colors.warning },
    yesilMetin: { ...typography.caption, color: colors.success },
    kucukNot: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  });
}
