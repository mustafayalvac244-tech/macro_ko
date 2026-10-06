import { useEffect, useRef, useState, type ReactNode } from 'react';
import { perdeyiBekle } from '@/lib/acilisPerdesi';
import { AccessibilityInfo, Animated, Easing, Platform, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/**
 * BENTO GİRİŞİ (06.10.2026, ürün sahibi: "Instagram'da bento dashboard
 * animasyonu gördüm, benzerini ekleyelim").
 *
 * Ana ekran kartları sırayla, hafif yükselerek belirir. Kurallar:
 *  - Uygulama açılışında YALNIZ BİR KEZ oynar (`oynadi`); ekrana her dönüşte,
 *    yenilemede, veri gelince tekrar oynamaz — avukat her seferinde beklemesin.
 *  - Sistemde "hareketi azalt" açıksa hiç oynamaz, kart doğrudan görünür.
 *  - Açılış perdesi kalkmadan başlamaz; yoksa perdenin altında görünmeden
 *    biterdi (src/lib/acilisPerdesi.ts).
 *  - Web'de yerel sürücü yok (`useNativeDriver` yalnız natifte).
 * Süreler: kart başı 60 ms gecikme, 380 ms süre — tasarım seçimi, ölçüm değil.
 */
let oynadi = false;
const ADIM_MS = 60;
const SURE_MS = 380;
const YEREL = Platform.OS !== 'web';

function useHareketAzalt(): boolean | null {
  const [azalt, setAzalt] = useState<boolean | null>(null);
  useEffect(() => {
    let canli = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => canli && setAzalt(v))
      .catch(() => canli && setAzalt(false));
    return () => {
      canli = false;
    };
  }, []);
  return azalt;
}

export function Belir({ sira, style, children }: { sira: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [oynat] = useState(() => !oynadi);
  const azalt = useHareketAzalt();
  const deger = useRef(new Animated.Value(oynat ? 0 : 1)).current;

  useEffect(() => {
    if (!oynat || azalt === null) return;
    if (azalt) {
      deger.setValue(1);
      return;
    }
    const anim = Animated.timing(deger, {
      toValue: 1,
      duration: SURE_MS,
      delay: sira * ADIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: YEREL,
    });
    const iptal = perdeyiBekle(() =>
      anim.start(() => {
        oynadi = true;
      }),
    );
    return () => {
      iptal();
      anim.stop();
      // Animasyon yarıda kesildiyse (ekrandan çıkış) kart yarı saydam kalmasın.
      deger.setValue(1);
    };
  }, [oynat, azalt, sira, deger]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: deger,
          transform: [
            { translateY: deger.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: deger.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Sayı sıfırdan hedefe sayarak dolar (bento panolardaki sayaç). Değer
 * sonradan değişirse (veri yenilendi) eskisinden yenisine kısa bir geçiş
 * yapar. Hareketi azalt açıksa doğrudan hedefi yazar. 700 ms tasarım seçimi.
 */
export function SayanSayi({ deger, style }: { deger: number; style?: StyleProp<TextStyle> }) {
  const azalt = useHareketAzalt();
  // Kartlar gibi: yalnız açılışta sıfırdan sayar; sonra ekrana dönüşte değil.
  const [ilk] = useState(() => !oynadi);
  const [gosterilen, setGosterilen] = useState(ilk ? 0 : deger);
  const onceki = useRef(ilk ? 0 : deger);

  useEffect(() => {
    if (azalt === null) return;
    const bas = onceki.current;
    onceki.current = deger;
    if (azalt || bas === deger) {
      setGosterilen(deger);
      return;
    }
    const sure = 700;
    let kare: ReturnType<typeof requestAnimationFrame> | undefined;
    const iptal = perdeyiBekle(() => {
      const t0 = Date.now();
      const adim = () => {
        const p = Math.min(1, (Date.now() - t0) / sure);
        const e = 1 - Math.pow(1 - p, 3);
        setGosterilen(Math.round(bas + (deger - bas) * e));
        if (p < 1) kare = requestAnimationFrame(adim);
      };
      kare = requestAnimationFrame(adim);
    });
    return () => {
      iptal();
      if (kare !== undefined) cancelAnimationFrame(kare);
      setGosterilen(deger);
    };
  }, [deger, azalt]);

  return (
    <Text allowFontScaling={false} style={style}>
      {gosterilen}
    </Text>
  );
}
