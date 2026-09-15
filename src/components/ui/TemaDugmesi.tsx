import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeStore } from '@/theme/themeStore';
import { useTheme } from '@/theme/useTheme';
import { digerTema, koyuTemaMi, temaEsi, type ThemeColors } from '@/theme/palettes';
import { useT } from '@/i18n';
import { spacing, kose } from '@/theme/theme';

/**
 * ÜST ÇUBUKTAKİ HIZLI TEMA DÜĞMESİ — koyu ↔ beyaz.
 *
 * NEDEN AYARLAR'DAKİ SEÇİCİ YETMİYOR. Beş temalı seçici zaten var ama
 * Ayarlar > Görünüm yolunun arkasında. Tema, gün içinde değişen bir
 * tercihtir: sabah aydınlık odada beyaz, akşam duruşma dönüşü koyu. Üç
 * dokunuş uzaktaki bir ayar, günde iki kez kullanılmaz — kullanıcı ya hep
 * rahatsız olduğu temada kalır ya da hiç denemez.
 *
 * İKİ YÖNLÜ, BEŞ YÖNLÜ DEĞİL. Üst çubukta beş seçenek göstermek, sık
 * kullanılan bir düğmeyi bir menüye çevirirdi. Kural basit: koyu
 * temadaysan beyaza, açık temadaysan koyuya geç (bkz. palettes.ts →
 * digerTema). Parşömen/Zümrüt/Obsidyen seçmiş kullanıcıda da anlamlı
 * çalışır; tam seçim yine Ayarlar'da.
 *
 * NEDEN YALNIZ WEB. Telefonda üst çubuk dar: geri oku, başlık, ana sayfa
 * ve ekrana özel eylem zaten sığmakta zorlanıyor; altıncı bir düğme
 * başlığı kırpardı. Telefonda tema değişimi Ayarlar'daki seçicide kalıyor.
 * Bu bir eksiklik değil, yer kararı — ve `Platform.OS` kontrolüyle
 * bilerek yapılıyor, "web'de deneriz sonra bakarız" diye değil.
 */
export function TemaDugmesi() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  if (Platform.OS !== 'web') return null;

  const koyu = koyuTemaMi(themeId);
  /**
   * DÜĞME ARTIK SABİT TEMAYA GİTMİYOR, TEMANIN EŞİNE GİDİYOR.
   *
   * ÜRÜN SAHİBİ BİLDİRDİ (15.09.2026): "terminal gece gündüze tıklayınca
   * gidiyor, başka moda yazı moduna geçiyor." Buradaki iki `onPress`
   * `setTheme('light')` ve `setTheme('dark')` diye SABİT yazılmıştı: Terminal
   * temasındayken güneşe basan kullanıcı Klasik'e düşüyor, mono yazı da gidiyordu.
   * Düğme temayı değiştirmiyor, TEMAYI TERK ETTİRİYORDU.
   *
   * `temaEsi` her temanın kendi aydınlık/karanlık karşılığını veriyor
   * (Terminal ↔ Terminal Açık, Klasik ↔ Gece). Eşi tanımlı olmayan temalarda
   * eski davranış sürüyor.
   */
  const esi = temaEsi(themeId);

  return (
    <View style={styles.kap}>
      {/* İKİ AYRI DÜĞME, TEK "DEĞİŞTİR" DÜĞMESİ DEĞİL.
          Tek düğmede hangi durumda olduğunuzu ikon tersinden anlatır
          ("güneş görüyorsam koyudayım demek") ve her seferinde bir an
          düşündürür. İki düğmede hangisinin SEÇİLİ olduğu doğrudan
          görünür; basınca ne olacağı da tahmin gerektirmez. */}
      <Pressable
        onPress={() => koyu && setTheme(esi)}
        style={({ pressed }) => [styles.dugme, !koyu && styles.secili, pressed && styles.basili]}
        accessibilityRole="button"
        accessibilityState={{ selected: !koyu }}
        accessibilityLabel={t('tema.acik')}
      >
        <Ionicons name="sunny-outline" size={16} color={!koyu ? colors.primary : colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => !koyu && setTheme(esi)}
        style={({ pressed }) => [styles.dugme, koyu && styles.secili, pressed && styles.basili]}
        accessibilityRole="button"
        accessibilityState={{ selected: koyu }}
        accessibilityLabel={t('tema.koyu')}
      >
        <Ionicons name="moon-outline" size={16} color={koyu ? colors.primary : colors.textMuted} />
      </Pressable>
    </View>
  );
}

/**
 * Tek düğmelik dar sürüm — yerin çok kısıtlı olduğu üst çubuklar için.
 * Basınca `digerTema` ne diyorsa ona geçer.
 */
export function TemaDugmesiTek() {
  const __t = useTheme();
  const colors = __t.colors;
  const styles = makeStyles(colors);
  const t = useT();
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  if (Platform.OS !== 'web') return null;

  const koyu = koyuTemaMi(themeId);
  return (
    <Pressable
      onPress={() => setTheme(digerTema(themeId))}
      style={({ pressed }) => [styles.tek, pressed && styles.basili]}
      accessibilityRole="button"
      accessibilityLabel={koyu ? t('tema.acik') : t('tema.koyu')}
    >
      <Ionicons name={koyu ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textPrimary} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  kap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    borderRadius: kose(12),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  dugme: {
    width: 30,
    height: 28,
    borderRadius: kose(9),
    alignItems: 'center',
    justifyContent: 'center',
  },
  secili: {
    backgroundColor: colors.primarySoft,
  },
  basili: {
    opacity: 0.7,
  },
  tek: {
    width: 36,
    height: 36,
    borderRadius: kose(10),
    marginRight: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
