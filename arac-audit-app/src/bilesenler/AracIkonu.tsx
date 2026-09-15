import React, { useMemo } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { ARACLAR } from '@/cekirdek/model3d';
import { Arac, HatNoktasi } from '@/cekirdek/tipler';
import { useTema } from '@/tema';

/**
 * Araç kartındaki yan silüet ikonu.
 *
 * ÇİZİM AYRI BİR VARLIK DEĞİL: şekil doğrudan `model3d.ts`teki `ustHat`ten
 * türetilir. Elle çizilmiş bir SVG koysaydık ölçü düzeltmesi geldiğinde 3B
 * model güncellenir, ikon eski şekliyle kalırdı — ve hangisinin doğru olduğu
 * belli olmazdı. Tek kaynak: ARACLAR.
 *
 * ÜÇ ARAÇ AYNI ÖLÇEKTE çizilir. Her biri kendi kutusuna sığdırılsaydı 4040 mm
 * i20 ile 4155 mm IONIQ 3 kartta aynı boyda görünürdü; denetçiye yanlış bilgi.
 */

const EN_UZUN = Math.max(...ARACLAR.map((a) => a.uzunluk));
const EN_YUKSEK = Math.max(...ARACLAR.map((a) => a.yukseklik));
const PAY = 70;
const VB_EN = EN_UZUN + PAY * 2;
const VB_BOY = EN_YUKSEK + PAY;

/** Model koordinatı (x ileri, y yukarı) → SVG koordinatı (y aşağı). */
const px = (x: number) => x + VB_EN / 2;
const py = (y: number) => EN_YUKSEK - y + PAY / 2;

const cizgiyeCevir = (noktalar: { x: number; y: number }[]) =>
  noktalar.map((n, i) => `${i === 0 ? 'M' : 'L'}${px(n.x).toFixed(0)} ${py(n.y).toFixed(0)}`).join(' ');

/**
 * Gövde dış hattı: silüetin tepesi, sonra eşik hizasında geri dönen taban.
 *
 * Taban düz geçilirse tekerlekler sacın altından çıkan iki topuza benzer.
 * Onun yerine tabana iki davlumbaz yayı oyulur; tekerlek gerçekten içine
 * oturur. Yay ARKADAN ÖNE gidilirken çizildiği için sweep=1 yukarı kabarır.
 */
function govdeYolu(arac: Arac): string {
  const h = arac.ustHat;
  const on = h[0]!;
  const arka = h[h.length - 1]!;
  const yaricap = arac.tekerR + 35;
  const esik = py(arac.esikY).toFixed(0);
  const yay = (merkez: number) => {
    const bas = Math.max(arka.x, merkez - yaricap);
    const son = Math.min(on.x, merkez + yaricap);
    return `L${px(bas).toFixed(0)} ${esik} A${yaricap} ${yaricap} 0 0 1 ${px(son).toFixed(0)} ${esik}`;
  };
  return `${cizgiyeCevir(h)} L${px(arka.x).toFixed(0)} ${esik}`
    + ` ${yay(-arac.dingil / 2)} ${yay(arac.dingil / 2)}`
    + ` L${px(on.x).toFixed(0)} ${esik} Z`;
}

/**
 * Cam alanı: son kaput noktasından ilk bagaj noktasına kadar olan tepe dilimi,
 * bel hattına kapatılır. Ön/arka direğin eğimi böylece silüetten gelir.
 */
function camYolu(arac: Arac): string | null {
  const h = arac.ustHat;
  const camBas = h.findIndex((p: HatNoktasi) => p.parca === 'on_cam');
  const bagaj = h.findIndex((p: HatNoktasi) => p.parca === 'bagaj_kapagi');
  if (camBas < 1 || bagaj < 0) return null;
  const dilim = h.slice(camBas - 1, bagaj + 1);
  const ilk = dilim[0]!;
  const son = dilim[dilim.length - 1]!;
  return `${cizgiyeCevir(dilim)} L${px(son.x).toFixed(0)} ${py(arac.belY).toFixed(0)}`
    + ` L${px(ilk.x).toFixed(0)} ${py(arac.belY).toFixed(0)} Z`;
}

export function AracIkonu({ arac, boy = 32 }: { arac: Arac; boy?: number }) {
  const { renkler } = useTema();
  const { govde, cam } = useMemo(
    () => ({ govde: govdeYolu(arac), cam: camYolu(arac) }),
    [arac],
  );
  const govdeRenk = arac.ikonRenk ?? arac.renk;
  const tekerX = arac.dingil / 2;

  return (
    <Svg
      width={boy * (VB_EN / VB_BOY)}
      height={boy}
      viewBox={`0 0 ${VB_EN} ${VB_BOY}`}
      accessibilityLabel={`${arac.tam} yandan görünüş`}
    >
      {/* Tekerlekler gövdenin ALTINDA çizilir: üst yarıları sac panelin
          arkasında kalsın, davlumbaz kesmeye gerek kalmasın. */}
      <G>
        {[tekerX, -tekerX].map((x) => (
          <Circle
            key={x}
            cx={px(x)}
            cy={py(arac.tekerR)}
            r={arac.tekerR}
            fill={renkler.cizgiGuclu}
          />
        ))}
      </G>
      <Path d={govde} fill={govdeRenk} />
      {cam ? <Path d={cam} fill="#101820" fillOpacity={0.55} /> : null}
    </Svg>
  );
}
