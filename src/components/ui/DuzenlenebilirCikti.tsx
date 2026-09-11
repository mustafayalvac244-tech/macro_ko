import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CiktiEylemleri } from '@/components/ui/CiktiEylemleri';
import { useT } from '@/i18n';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * YAPAY ZEKÂ ÇIKTISI — OKUNUR VE DÜZENLENİR.
 *
 * NEDEN. Taslak bugüne kadar salt okunurdu: avukat metni kopyalayıp Word'e
 * alıyor, düzeltmeyi orada yapıyor, sonra UYAP'a oradan taşıyordu. Yani
 * ürettiğimiz UDF, avukatın GÖNDERECEĞİ metin değil, GÖNDERMEDEN ÖNCEKİ
 * hâliydi — UDF düğmesi pratikte yalnız hiç düzeltme gerektirmeyen taslaklarda
 * işe yarıyordu ki öyle taslak yok.
 *
 * Rakip karşılaştırmalarında Apilex'in öne çıkarılan tek somut üstünlüğü
 * "uygulama içinde düzenleme imkânı"ydı. Kapatılan şey bu.
 *
 * ÜÇ ŞEY BİLEREK BÖYLE:
 *   • Dışa aktarma (kopyala/indir/UDF) DÜZENLENMİŞ metni alır. Aksi hâlde
 *     avukat düzeltir, indirir ve düzeltmesiz dosyayı mahkemeye verirdi —
 *     düzenleme özelliğinin kendisi tuzağa dönüşürdü.
 *   • Değişiklik yapıldığı AÇIKÇA yazılır ve "aslına dön" hep durur. Metnin
 *     hangi kısmının bize, hangisinin avukata ait olduğu kaybolmamalı.
 *   • Sunucudan YENİ metin gelirse düzenleme sıfırlanır: yeni taslak, eski
 *     taslağın üstüne yazılmış düzeltmelerle karışmaz.
 */
interface Props {
  /** Sunucudan gelen asıl metin. Değişirse düzenleme sıfırlanır. */
  metin: string;
  /** Dosya adında kullanılacak başlık. */
  baslik: string;
  /** UYAP (UDF) düğmesi gösterilsin mi? Yalnız mahkemeye verilecek metinde. */
  udf?: boolean;
  /** Başlık satırının soluna konacak etiket (ör. "Taslak"). */
  etiket?: string;
}

export function DuzenlenebilirCikti({ metin, baslik, udf = false, etiket }: Props) {
  const __t = useTheme();
  const styles = makeStyles(__t.colors);
  const t = useT();

  const [duzenlenen, setDuzenlenen] = useState(metin);
  const [acik, setAcik] = useState(false);
  const asil = useRef(metin);

  // YENİ TASLAK GELİNCE DÜZENLEME SIFIRLANIR. Kullanıcı "yeniden üret" dediğinde
  // ekranda eski metnin düzeltmeleri kalsaydı, hangi cümlenin yeni taslaktan
  // hangisinin eski düzeltmeden geldiği anlaşılmazdı.
  useEffect(() => {
    asil.current = metin;
    setDuzenlenen(metin);
    setAcik(false);
  }, [metin]);

  const degisti = duzenlenen !== asil.current;

  return (
    <View>
      <View style={styles.ustSatir}>
        {!!etiket && <Text style={styles.etiket}>{etiket}</Text>}
        <View style={styles.ustSag}>
          <Pressable
            onPress={() => setAcik((v) => !v)}
            hitSlop={8}
            style={styles.duzenleDugme}
            accessibilityRole="button"
            accessibilityLabel={acik ? t('cikti.duzenlemeyiBitir') : t('cikti.duzenle')}
          >
            <Ionicons
              name={acik ? 'checkmark-outline' : 'create-outline'}
              size={16}
              color={__t.colors.primary}
            />
            <Text style={styles.duzenleMetin}>{acik ? t('cikti.duzenlemeyiBitir') : t('cikti.duzenle')}</Text>
          </Pressable>
          {/* Dışa aktarma DÜZENLENMİŞ metni alır — bkz. dosya başındaki not. */}
          <CiktiEylemleri metin={duzenlenen} baslik={baslik} udf={udf} />
        </View>
      </View>

      {acik ? (
        <TextInput
          value={duzenlenen}
          onChangeText={setDuzenlenen}
          multiline
          style={styles.girdi}
          textAlignVertical="top"
          // Web'de uzun metinde otomatik büyüme yok; sabit yükseklik + kaydırma
          // daha öngörülebilir davranıyor.
          scrollEnabled
        />
      ) : (
        <Text selectable style={styles.govde}>
          {duzenlenen}
        </Text>
      )}

      {degisti && (
        <View style={styles.degistiSatir}>
          <Text style={styles.degistiMetin}>{t('cikti.duzenlendi')}</Text>
          <Pressable onPress={() => setDuzenlenen(asil.current)} hitSlop={8}>
            <Text style={styles.geriDon}>{t('cikti.aslinaDon')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ustSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    etiket: { ...typography.caption, color: colors.textSecondary },
    ustSag: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
    duzenleDugme: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    duzenleMetin: { ...typography.caption, color: colors.primary, fontWeight: '600' },
    govde: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
    girdi: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 22,
      minHeight: 260,
      maxHeight: Platform.OS === 'web' ? 620 : undefined,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      backgroundColor: colors.surfaceAlt,
    },
    degistiSatir: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    degistiMetin: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
    geriDon: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  });
}
