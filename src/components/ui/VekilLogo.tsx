import React from 'react';
import Svg, { Defs, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';

const LACIVERT = '#173C7E';
const LACIVERT_KOYU = '#0B1F45';
const ALTIN = '#E7C871';

interface VekilLogoProps {
  size?: number;
  /**
   * KULLANILMIYOR — eski terazi amblemindeki halka içlerini zemine boyamak
   * içindi. Yeni amblemde halka yok. Çağıranları kırmamak için kabul
   * ediliyor; yeni kullanımlarda geçirmeyin.
   * @deprecated
   */
  nodeFill?: string;
  /** Yuvarlak köşeli lacivert kutu çizilsin mi (varsayılan: evet). */
  kutu?: boolean;
}

/**
 * VEKİL PRO AMBLEMİ.
 *
 * ÖNCEKİ AMBLEM NEDEN DEĞİŞTİ. Burada ince çizgili bir "teknolojik terazi"
 * vardı: 13 birim kalınlığında ~20 çizgi ve 8 daire. İki sorunu vardı ve
 * ikisi de ölçülebilirdi:
 *   • KÜÇÜLMÜYORDU. 34px'lik başlık ambleminde çizgiler birbirine giriyor,
 *     faviconda tanınmaz hâle geliyordu. Tanıtım sayfasının bu amblemi
 *     kullanmayıp düz bir "V" kutusu koymasının sebebi buydu — yani marka
 *     web'de ve uygulamada FARKLI görünüyordu.
 *   • KOYU TEMADA KAYBOLUYORDU. Çizgi rengi lacivert sabitti; koyu zeminde
 *     zeminle aynı renge düşüyordu.
 *
 * YENİ AMBLEM — "V + onay". Dört aday çizilip 20/24/34/48/96 px'te, açık ve
 * koyu temada gerçek tarayıcıda karşılaştırıldı.
 *   • "V", Vekil'in baş harfi.
 *   • Sağ kol sol koldan YÜKSEK bitiyor; şekil aynı anda bir onay
 *     işaretidir. Ürünün tek iddiası ("verdiğimiz her künye denetlenir")
 *     ile amblem aynı şeyi söylüyor.
 *   • Altındaki kısa kiriş terazi tabanını andırır ve şekli yere basar.
 * Üç çizgi: 20px'te bile okunur; tek renk olduğu için favicon, baskı ve tek
 * renkli Android ikonunda da çalışır.
 *
 * TEK KAYNAK: scripts/amblem.mjs. Oradaki koordinatlarla BİREBİR aynı
 * olmalı — web, favicon ve mağaza ikonları oradan üretiliyor. Birini
 * değiştirirken diğerini de değiştirin, yoksa marka yine ikiye ayrılır.
 */
export function VekilLogo({ size = 120, kutu = true }: VekilLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {kutu && (
        <>
          <Defs>
            <LinearGradient id="vekilKutu" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={LACIVERT} />
              <Stop offset="1" stopColor={LACIVERT_KOYU} />
            </LinearGradient>
          </Defs>
          <Rect width={64} height={64} rx={15} fill="url(#vekilKutu)" />
        </>
      )}
      <Path
        d="M17 17 L29 42 L47 13"
        fill="none"
        stroke={ALTIN}
        strokeWidth={5.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={21} y1={51} x2={43} y2={51} stroke={ALTIN} strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}
