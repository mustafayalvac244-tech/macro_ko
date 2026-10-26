// ARAÇ HARİTASI — şematik üstten görünüş; bölgeye dokununca o bölgenin
// parçalarına gidilir.
//
// NEDEN (24.10.2026, benzer uygulamaların incelenmesi): ATS Inspect kusuru
// aracın 3B CAD görüntüsüne dokunarak aldırıyor; hasar belgeleme
// uygulamaları (AP Inspector, PurInspect, Dealers Online kılavuzu) "şemada
// panele dokun → hasar tipini seç" akışını kullanıyor. Bizim 3B model
// kaldırılmıştı (gerçek model yok); bu, onun ucuz ve güvenilir karşılığı:
// beş dış bölge, SVG dikdörtgenleri. Alt (şase altı) üstten görünmez, listede.
//
// ERİŞİLEBİLİRLİK: SVG yalnız görsel; dokunma alanları üstüne bindirilmiş
// Pressable'lar — ekran okuyucu ve uçtan uca sınav etiketleri oradan okur.

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

import { kisaBolgeAdi } from '@/cekirdek/sistemler';
import { Bolge } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema, yazi } from '@/tema';
import { useDil } from '@/veri/dilDeposu';

const EN = 320;
// 172: gövde hattı 154'te biter; altındaki "ÖN ◀" / "FRONT ◀" yazısı için
// pay. 160 iken yazı çizgiye biniyordu (İngilizce ekran görüntüsü, 26.10.2026).
const BOY = 172;

/** Araç sola bakar: ön solda. Sola bakan aracın SOL yanı çizimin altındadır. */
const BOLGE_KUTULARI: Record<string, { x: number; y: number; w: number; h: number }> = {
  dis_on: { x: 8, y: 36, w: 62, h: 88 },
  dis_ust: { x: 74, y: 44, w: 172, h: 72 },
  dis_arka: { x: 250, y: 36, w: 62, h: 88 },
  dis_sag: { x: 74, y: 8, w: 172, h: 32 },
  dis_sol: { x: 74, y: 120, w: 172, h: 32 },
};

export function AracHaritasi({
  bolgeler, sayilar, onSec,
}: {
  /** Yalnız dış bölgeler; haritada kutusu olmayan bölge çizilmez. */
  bolgeler: readonly Bolge[];
  /** Bölge kimliği → kayıt sayısı. */
  sayilar: ReadonlyMap<string, number>;
  onSec: (bolgeId: string) => void;
}) {
  const { renkler } = useTema();
  const { t } = useDil();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const cizilecek = bolgeler.filter((b) => BOLGE_KUTULARI[b.id]);
  if (!cizilecek.length) return null;

  return (
    <View style={s.kap} accessibilityLabel={t('Araç haritası', 'Vehicle map')}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${EN} ${BOY}`} aria-hidden>
        {/* Gövde dış hattı ve tekerler — yalnız tanınsın diye. */}
        <Path
          d={`M 30 6 H 290 Q 318 6 318 34 V 126 Q 318 154 290 154 H 30 Q 2 154 2 126 V 34 Q 2 6 30 6 Z`}
          fill="none" stroke={renkler.cizgiGuclu} strokeWidth={1.5}
        />
        {[[86, 2], [206, 2], [86, 150], [206, 150]].map(([x, y]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width={30} height={8} rx={3} fill={renkler.cizgiGuclu} />
        ))}
        {cizilecek.map((b) => {
          const k = BOLGE_KUTULARI[b.id]!;
          const n = sayilar.get(b.id) ?? 0;
          return (
            <React.Fragment key={b.id}>
              <Rect
                x={k.x} y={k.y} width={k.w} height={k.h} rx={6}
                fill={n ? renkler.birincilYumusak : renkler.yuzeyAlt}
                stroke={n ? renkler.birincil : renkler.cizgi} strokeWidth={1}
              />
              <SvgText
                x={k.x + k.w / 2} y={k.y + k.h / 2 + 4}
                fontFamily={yazi.yariKalin} fontSize={12} fill={renkler.metin} textAnchor="middle"
              >
                {kisaBolgeAdi(t(b.ad, b.en))}{n ? ` · ${n}` : ''}
              </SvgText>
            </React.Fragment>
          );
        })}
        <SvgText x={12} y={BOY - 3} fontFamily={yazi.normal} fontSize={9} fill={renkler.metinSolgun}>{t('ÖN ◀', 'FRONT ◀')}</SvgText>
      </Svg>
      {/* Dokunma alanları: SVG koordinatlarının yüzdesi. */}
      {cizilecek.map((b) => {
        const k = BOLGE_KUTULARI[b.id]!;
        const n = sayilar.get(b.id) ?? 0;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityLabel={t(
              `Harita: ${kisaBolgeAdi(b.ad)}${n ? `, ${n} kayıt` : ''}`,
              `Map: ${kisaBolgeAdi(b.en)}${n ? `, ${n} ${n === 1 ? 'record' : 'records'}` : ''}`,
            )}
            onPress={() => onSec(b.id)}
            style={({ pressed }) => [{
              position: 'absolute',
              left: `${(k.x / EN) * 100}%`, top: `${(k.y / BOY) * 100}%`,
              width: `${(k.w / EN) * 100}%`, height: `${(k.h / BOY) * 100}%`,
              borderRadius: kose.sm,
            }, pressed && s.basili]}
          />
        );
      })}
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  kap: { width: '100%', aspectRatio: EN / BOY, position: 'relative' },
  basili: { backgroundColor: r.perde, opacity: 0.25 },
});
