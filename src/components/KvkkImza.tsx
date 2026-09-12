// KVKK İMZA PENCERESİ — "girerken okuyup imzalayacak".
// ---------------------------------------------------------------------------
// NE YAPAR. Aydınlatma metnini tam gövdesiyle açar, avukatın metnin SONUNA
// kadar ilerlemesini bekler ve ancak ondan sonra açık rıza beyanını
// imzalatır. İmzayla birlikte, imzanın hangi koşulda atıldığına dair ölçülmüş
// bir kanıt üretir (kaç saniye açık kaldı, sona gelindi mi).
//
// DÜRÜSTLÜK SINIRI — bu bir OKUMA ÖLÇÜMÜ DEĞİLDİR. Kaydırma çubuğunun sona
// gelmesi, metnin okunduğunu KANITLAMAZ; insan kaydırıp geçebilir. Ölçtüğümüz
// şey "metnin tamamı ekrandan geçirildi" ve "pencere N saniye açık kaldı"
// olgularıdır. Arayüz de tam olarak bunu söyler: imza, kullanıcının OKUDUĞUNA
// DAİR BEYANIDIR — bizim okuduğuna dair tespitimiz değil. Bu ayrımı gizlemek,
// elde olmayan bir delili varmış gibi göstermek olurdu.
//
// NEDEN KİLİTLİ DÜĞME YOK. Bu projede daha önce üç ekranda `disabled` düğme
// yüzünden "basıyorum hiçbir şey olmuyor" hatası yaşandı. Burada düğme her
// zaman basılabilir; şartı karşılamıyorsa SEBEBİ SÖYLER ve metinde ilerletir.
import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/ui/Button';
import { KvkkGovde } from '@/components/KvkkMetin';
import { KVKK_SURUM, RIZA_ZORUNLU } from '@/config/kvkk';
import { okumaOrani, sonaGelindiMi } from '@/utils/kvkkOkuma';
import { radius, spacing, typography } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';
import type { ThemeColors } from '@/theme/palettes';

/** İmzanın hangi koşulda atıldığına dair ÖLÇÜLMÜŞ olgular. Rıza kaydına yazılır. */
export interface KvkkKanit {
  /** Pencere kaç saniye açık kaldı. */
  saniye: number;
  /** Metnin tamamı ekrandan geçirildi mi. Okuma kanıtı DEĞİL, görüntüleme kanıtı. */
  sona_gelindi: boolean;
  /** İmzanın alındığı yer — ileride başka yerden de alınabilir. */
  yontem: string;
  /** İmzalanan metin sürümü. */
  surum: string;
}

interface Props {
  visible: boolean;
  tr: boolean;
  /** Rıza verilmeden kapatıldı. Çağıran taraf hiçbir şeyi değiştirmemeli. */
  onVazgec: () => void;
  /** İmzalandı. */
  onImza: (kanit: KvkkKanit) => void;
}

export function KvkkImza({ visible, tr, onVazgec, onImza }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const kaydirici = useRef<ScrollView>(null);
  const acilis = useRef<number>(0);
  const [ilerleme, setIlerleme] = useState(0);
  const [sonaGeldi, setSonaGeldi] = useState(false);
  const [uyari, setUyari] = useState<string | null>(null);
  /** Son ölçülen görünür yükseklik — "bir ekran ilerle" için gerekli. */
  const ekranYuksekligi = useRef(0);
  const icerikYuksekligi = useRef(0);
  const sonKonum = useRef(0);

  // Pencere her AÇILDIĞINDA sayaç sıfırlanır. Bir önceki açılışın süresi
  // sonrakine eklenirse kanıt şişer; şişmiş kanıt, kanıt değildir.
  const acildi = useCallback(() => {
    acilis.current = Date.now();
    setIlerleme(0);
    setSonaGeldi(false);
    setUyari(null);
    sonKonum.current = 0;
    // Pencere kapanıp açıldığında kaydırıcı konumunu KORUR. Sıfırlanmazsa
    // ikinci açılışta metin ortasından başlar ve "sona geldi" ölçümü ilk
    // kaydırmada hemen doğru çıkardı — yani kapı kendiliğinden açılırdı.
    kaydirici.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const kaydirildi = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    ekranYuksekligi.current = layoutMeasurement.height;
    sonKonum.current = contentOffset.y;
    icerikYuksekligi.current = contentSize.height;

    const olcu = {
      offsetY: contentOffset.y,
      layoutHeight: layoutMeasurement.height,
      contentHeight: contentSize.height,
    };
    setIlerleme(okumaOrani(olcu));
    if (sonaGelindiMi(olcu)) {
      // Bir kez sona gelindiyse geri kaydırmak bunu geri ALMAZ: metin baştan
      // sona görüntülenmiş olur.
      setSonaGeldi(true);
      setUyari(null);
    }
  };

  // Metin ekrandan kısaysa hiç kaydırma olayı gelmez ve şart sonsuza kadar
  // sağlanmaz. Yerleşim ölçüldüğünde bunu ayrıca kontrol ediyoruz.
  const icerikOlculdu = (_g: number, y: number) => {
    icerikYuksekligi.current = y;
    const olcu = { offsetY: sonKonum.current, layoutHeight: ekranYuksekligi.current, contentHeight: y };
    if (sonaGelindiMi(olcu)) setSonaGeldi(true);
    setIlerleme(okumaOrani(olcu));
  };

  // ScrollView'in ilk ölçümü onLayout ile gelir; onContentSizeChange ondan
  // ÖNCE tetiklenebiliyor ve o an ekran yüksekliği hâlâ 0 olurdu.
  const ekranOlculdu = (h: number) => {
    ekranYuksekligi.current = h;
    const olcu = { offsetY: sonKonum.current, layoutHeight: h, contentHeight: icerikYuksekligi.current };
    if (sonaGelindiMi(olcu)) setSonaGeldi(true);
    setIlerleme(okumaOrani(olcu));
  };

  const imzala = () => {
    if (!sonaGeldi) {
      setUyari(
        tr
          ? 'İmzadan önce metnin tamamını görmeniz gerekiyor. Kaldığınız yerden aşağı indirildiniz.'
          : 'You need to view the whole notice before signing. We have moved you further down.'
      );
      // Sonuna ATLATMIYORUZ — atlatmak şartı biz sağlamış oluruz. Bir ekran
      // ilerletiyoruz; metnin içinden geçmek kullanıcının kendi eylemi kalıyor.
      const adim = Math.max(ekranYuksekligi.current * 0.9, 240);
      kaydirici.current?.scrollTo({ y: sonKonum.current + adim, animated: true });
      return;
    }
    onImza({
      saniye: Math.max(0, Math.round((Date.now() - acilis.current) / 1000)),
      sona_gelindi: true,
      yontem: 'kayit-imza-penceresi',
      surum: KVKK_SURUM,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onShow={acildi} onRequestClose={onVazgec}>
      <View style={styles.root}>
        {/* Başlık + ilerleme. Avukat ne kadar kaldığını GÖRMELİ; görünmeyen bir
            şarta takılmak, sessiz ölü düğmenin bir başka biçimidir. */}
        <View style={styles.baslikAlani}>
          <Pressable onPress={onVazgec} hitSlop={10} style={styles.kapat} accessibilityRole="button">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.baslikMetni}>
            <Text style={styles.baslik} numberOfLines={1}>
              {tr ? 'KVKK Aydınlatma Metni' : 'KVKK Privacy Notice'}
            </Text>
            <Text style={styles.altBaslik}>
              {sonaGeldi
                ? (tr ? 'Metnin tamamı görüntülendi' : 'Whole notice viewed')
                : (tr ? `Okuma ilerlemesi %${Math.round(ilerleme * 100)}` : `Progress ${Math.round(ilerleme * 100)}%`)}
            </Text>
          </View>
          {sonaGeldi && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
        </View>
        <View style={styles.cubukZemin}>
          <View style={[styles.cubuk, { width: `${Math.round(ilerleme * 100)}%` }]} />
        </View>

        <ScrollView
          ref={kaydirici}
          contentContainerStyle={styles.icerik}
          onScroll={kaydirildi}
          onContentSizeChange={icerikOlculdu}
          onLayout={(e) => ekranOlculdu(e.nativeEvent.layout.height)}
          scrollEventThrottle={32}
        >
          <KvkkGovde tr={tr} />
        </ScrollView>

        {/* İMZA ALANI. Beyanın kendisi burada YAZILI duruyor: imzalanan cümleyi
            görmeden imza atılmaz. Uzun metnin 13. başlığındaki beyanla aynı
            cümledir. */}
        <View style={styles.imzaAlani}>
          <View style={styles.beyanKutusu}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.beyan}>
              {tr
                ? '“Yapay zekâ özelliklerini kullanabilmem için, bu özelliklere kendi elimle girdiğim metin ve belgelerin yurt dışındaki yapay zekâ hizmet sağlayıcılarına aktarılmasına, 6698 sayılı Kanun’un 5/1 ve 9. maddeleri kapsamında açık rıza veriyorum. Aydınlatma metnini okudum.”'
                : '“I give my explicit consent under Articles 5/1 and 9 of Law No. 6698 for the text and documents I personally enter into the AI features to be transferred to AI service providers located abroad. I have read the privacy notice.”'}
            </Text>
          </View>

          {uyari && <Text style={styles.uyari}>{uyari}</Text>}

          <Button
            label={tr ? 'Okudum, açık rıza veriyorum' : 'I have read it and consent'}
            onPress={imzala}
            fullWidth
            size="lg"
            icon={sonaGeldi ? 'checkmark' : 'arrow-down'}
          />
          <Pressable onPress={onVazgec} hitSlop={8}>
            <Text style={styles.vazgec}>
              {tr ? 'Rıza vermeden kapat' : 'Close without consenting'}
            </Text>
          </Pressable>
          {/* Bu not, RIZA_ZORUNLU bayrağıyla birlikte değişir: kayıt rızasız
              tamamlanamıyorken "şart değildir" demek yanlış beyan olurdu. */}
          <Text style={styles.not}>
            {RIZA_ZORUNLU
              ? (tr
                  ? 'Açık bildirim: kayıt şu an bu rıza olmadan tamamlanamıyor. Bunun Kanun’un aradığı özgür irade ölçütüyle tam bağdaşmadığı, metnin 5. başlığında yazılıdır. Rızayı verdikten sonra Ayarlar’dan geri alabilirsiniz; hesabınız kapanmaz, yalnız yapay zekâ özellikleri durur. İmzanız, metin sürümü ve tarihiyle kaydedilir.'
                  : 'Disclosed plainly: registration currently cannot be completed without this consent — section 5 explains why that is contestable. Once given, you can withdraw it in Settings; your account stays open and only the AI features stop. Your signature is recorded with the notice version and date.')
              : (tr
                  ? 'Rıza, hizmetin şartı değildir: vermezseniz yalnız yapay zekâ özellikleri kapalı kalır, uygulamanın geri kalanını kullanabilirsiniz. İmzanız, metin sürümü ve tarihiyle birlikte kaydedilir.'
                  : 'Consent is not a condition of service: without it only the AI features stay off and the rest of the app works. Your signature is recorded with the notice version and date.')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  baslikAlani: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  kapat: { padding: 2 },
  baslikMetni: { flex: 1 },
  baslik: { ...typography.h3, color: colors.textPrimary },
  altBaslik: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  cubukZemin: { height: 3, backgroundColor: colors.borderSubtle },
  cubuk: { height: 3, backgroundColor: colors.primary },
  icerik: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  imzaAlani: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  beyanKutusu: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  beyan: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 17 },
  uyari: { ...typography.small, color: colors.warning, lineHeight: 16 },
  vazgec: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  not: { ...typography.small, color: colors.textMuted, lineHeight: 16 },
});
