import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { fonts } from '@/theme/theme';

// Marka renkleri — giriş perdesi temadan bağımsız, her zaman lacivert/altın.
const NAVY_TOP = '#0B1830';
const NAVY_BOTTOM = '#16294A';
const GOLD = '#C9A24B';
const CREAM = '#F4EFE6';
// Native splash'in zemin rengi — perde bu renkten başlayıp laciverte akar ki
// splash → giriş geçişinde renk sıçraması olmasın.
const SPLASH_BG = '#EFEBE3';

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

  const iconScale = useRef(new Animated.Value(0.6)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordRise = useRef(new Animated.Value(14)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(1)).current;
  const gradientIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    hasPlayed = true;
    Animated.sequence([
      // Krem (native splash rengi) → lacivert: yumuşak renk geçişi
      Animated.timing(gradientIn, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
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
  }, [visible, iconOpacity, iconScale, wordOpacity, wordRise, sloganOpacity, lineScale, curtain, gradientIn]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, { opacity: curtain }]} pointerEvents="auto">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradientIn }]}>
        <LinearGradient colors={[NAVY_TOP, NAVY_BOTTOM]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.center}>
        <Animated.View style={{ opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
          <View style={styles.iconRing}>
            <MaterialCommunityIcons name="scale-balance" size={64} color={GOLD} />
          </View>
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
  iconRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    borderColor: 'rgba(201,162,75,0.45)',
    backgroundColor: 'rgba(201,162,75,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
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
