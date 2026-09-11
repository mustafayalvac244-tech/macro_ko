import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useUyariStore, type UyariDugmesi } from '@/store/uyariStore';
import { radius, spacing, typography } from '@/theme/theme';
import { etkilesim } from '@/theme/etkilesim';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/**
 * WEB'DEKİ UYARI/ONAY PENCERESİ (uygulama içi).
 *
 * Kök düzende bir kez çizilir. Natifte HİÇBİR ŞEY çizmez — orada yerli
 * Alert kullanılıyor (bkz. src/lib/uyari.ts). Web'de ise react-native-web'in
 * Alert'i boş bir fonksiyon olduğu için silme/çıkış onayları hiç açılmıyordu.
 *
 * Görsel karar: masaüstü uygulamalarının onay penceresi — ortada kart, üstte
 * başlık, altta sağa yaslı düğmeler; yıkıcı eylem kırmızı, vazgeç sade.
 * Tarayıcının kendi confirm penceresi kullanılmadı: uygulamaya benzemiyor
 * ve ikiden fazla düğmeyi desteklemiyor.
 */
export function UyariKatmani() {
  const aktif = useUyariStore((s) => s.aktif);
  const kapat = useUyariStore((s) => s.kapat);
  const __t = useTheme();
  const styles = makeStyles(__t.colors);

  if (Platform.OS !== 'web' || !aktif) return null;

  const bas = (d: UyariDugmesi) => {
    kapat();
    // Kapanış çizimi ile eylem çakışmasın: eylem bir sonraki tik'te.
    setTimeout(() => d.onPress?.(), 0);
  };

  // "Vazgeç" düğmesi varsa dışarı tıklama onunla aynı anlama gelir; yoksa
  // pencere yanlışlıkla kapatılıp eylem yapılmamış sayılmasın diye kapanmaz.
  const vazgec = aktif.dugmeler.find((d) => d.style === 'cancel');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => (vazgec ? bas(vazgec) : undefined)}>
      <View style={styles.zemin}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => (vazgec ? bas(vazgec) : undefined)}
          accessibilityLabel={vazgec?.text}
        />
        <View style={styles.kart}>
          <Text style={styles.baslik}>{aktif.baslik}</Text>
          {!!aktif.mesaj && <Text style={styles.mesaj}>{aktif.mesaj}</Text>}

          <View style={[styles.dugmeler, aktif.dugmeler.length > 2 && styles.dugmelerDikey]}>
            {aktif.dugmeler.map((d, i) => (
              <Pressable
                key={`${d.text}-${i}`}
                onPress={() => bas(d)}
                style={(durum) => {
                  const { hovered, pressed } = etkilesim(durum);
                  return [
                    styles.dugme,
                    d.style === 'destructive' && styles.dugmeYikici,
                    d.style === 'cancel' && styles.dugmeVazgec,
                    (hovered || pressed) && styles.dugmeVurgu,
                    aktif.dugmeler.length > 2 && styles.dugmeGenis,
                  ];
                }}
              >
                <Text
                  style={[
                    styles.dugmeMetni,
                    d.style === 'destructive' && styles.dugmeMetniYikici,
                    d.style === 'cancel' && styles.dugmeMetniVazgec,
                  ]}
                >
                  {d.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  zemin: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 14, 28, 0.45)',
    padding: spacing.lg,
  },
  kart: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
    // Gölge: pencere zeminden ayrılsın.
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  baslik: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  mesaj: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  dugmeler: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dugmelerDikey: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
  },
  dugme: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  dugmeGenis: {
    alignItems: 'center',
  },
  dugmeYikici: {
    backgroundColor: colors.danger,
  },
  dugmeVazgec: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  dugmeVurgu: {
    opacity: 0.86,
  },
  dugmeMetni: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textInverse,
  },
  dugmeMetniYikici: {
    color: colors.textInverse,
  },
  dugmeMetniVazgec: {
    color: colors.textSecondary,
  },
});
