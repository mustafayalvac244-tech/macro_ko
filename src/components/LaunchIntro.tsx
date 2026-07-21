import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '@/i18n';
import { fonts } from '@/theme/theme';

// Gömülü splash karesiyle AYNI görsel — geçişte renk/kalite farkı sırıtmasın.
const LOGO = require('../../assets/splash-icon.png');
// Gömülü karede logo 240dp; intro yuvasında 108dp → 108/240
const LOGO_SETTLE_SCALE = 108 / 240;

// OTA güncellemesi uygulanırken uygulama kendini yeniden başlatır; bu bayrak
// o yeniden başlatmada intronun İKİNCİ kez oynamasını engeller (çift açılış).
const SKIP_ONCE_KEY = 'VEKIL_SKIP_INTRO_ONCE';

// Marka renkleri — giriş perdesi temadan bağımsız, her zaman lacivert/altın.
const NAVY_TOP = '#0B1830';
const NAVY_BOTTOM = '#16294A';
const CREAM = '#F4EFE6';

// Soğuk başlangıçta yalnızca bir kez gösterilir (OTA reload dahil değil).
let hasPlayed = false;

/**
 * Açılış perdesi: native splash kapandıktan hemen sonra kısa, zarif bir marka
 * girişi oynatır — altın terazi belirir, "Vekil Pro" imza yazısıyla yükselir,
 * slogan süzülür, ardından perde açılıp uygulamayı gösterir. Metin canlı fontla
 * çizildiği için her ekran yoğunluğunda vektörel netliktedir.
 */
export function LaunchIntro() {
  const t = useT();
  const [visible, setVisible] = useState(!hasPlayed);
  // Bayrak okunana kadar animasyon başlamaz; bayrak varsa perde hiç oynamadan iner.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(SKIP_ONCE_KEY)
      .then((flag) => {
        if (flag) {
          AsyncStorage.removeItem(SKIP_ONCE_KEY).catch(() => {});
          hasPlayed = true;
          setVisible(false);
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [visible]);

  // Gömülü splash karesi logoyu ekran ortasında 240dp gösterir; intro aynı
  // logoyu AYNI boyutta ve GÖRÜNÜR devralır, küçültüp yuvasına oturtur —
  // kare → animasyon tek parça geçiş gibi akar.
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconShift = useRef(new Animated.Value(64)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordRise = useRef(new Animated.Value(14)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || !checked) return;
    hasPlayed = true;
    // Eski krem geçiş fazı kaldırıldı — perde doğrudan lacivert başlar; böylece
    // açılışta "önceki tasarım" izlenimi veren ikinci bir sahne oynamaz.
    Animated.sequence([
      // Logo, gömülü karedeki boyut ve konumdan yuvasına süzülür (kısa bekleme
      // statik karenin "devralındığı" hissini verir).
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(iconScale, { toValue: LOGO_SETTLE_SCALE, friction: 8, tension: 46, useNativeDriver: true }),
        Animated.timing(iconShift, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(wordRise, { toValue: 0, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(lineScale, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sloganOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
      Animated.delay(620),
      Animated.timing(curtain, { toValue: 0, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [visible, checked, iconScale, iconShift, wordOpacity, wordRise, sloganOpacity, lineScale, curtain]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, { opacity: curtain }]} pointerEvents="auto">
      <LinearGradient colors={[NAVY_TOP, NAVY_BOTTOM]} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Animated.View style={[styles.iconSlot, { transform: [{ translateY: iconShift }] }]}>
          <Animated.Image source={LOGO} style={[styles.iconImg, { transform: [{ scale: iconScale }] }]} />
        </Animated.View>

        <Animated.Text
          allowFontScaling={false}
          style={[styles.wordmark, { opacity: wordOpacity, transform: [{ translateY: wordRise }] }]}
        >
          Vekil Pro
        </Animated.Text>

        <Animated.View style={[styles.rule, { transform: [{ scaleX: lineScale }] }]} />

        <Animated.Text allowFontScaling={false} style={[styles.slogan, { opacity: sloganOpacity }]}>
          {t('app.slogan')}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 1000,
    elevation: 1000,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  iconSlot: {
    width: 108,
    height: 108,
    marginBottom: 6,
  },
  iconImg: {
    // Görsel gömülü karedeki gibi 240dp başlar; scale ile 108'e oturur.
    position: 'absolute',
    width: 240,
    height: 240,
    left: (108 - 240) / 2,
    top: (108 - 240) / 2,
  },
  wordmark: {
    fontFamily: fonts.script,
    fontSize: 58,
    color: CREAM,
    letterSpacing: 1,
  },
  rule: {
    width: 132,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(201,162,75,0.65)',
  },
  slogan: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    color: 'rgba(244,239,230,0.75)',
  },
});
