// SAYAÇ — ana sayfada ekibin Excel'indeki "Scores" paneli (sayac.ts).
//
// Excel'de model başına üç satır var (Audit Aracı / Problem / Audit Skoru),
// sütunlar Bugün / Bu Hafta / G. Hafta / Bu Ay / Bu Yıl. Telefonda beş sütun
// × üç satır × model, ana sayfayı kaplardı (28.09.2026: "çok kalabalık
// olmasın"). Bu yüzden aynı üç ölçü bir seçiciyle tek tabloda: Skor, Araç,
// Demerit. Hücre tek sayı; ekran okuyucu her satırda üçünü birden okur.
// Satır adı Excel'deki model kodu (BJ, BC3, CUV…).

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import { BolumBasligi, Kart, Secenek } from '@/bilesenler/temel';
import { aracEtiketi, ARAC_INDEKS } from '@/cekirdek/model3d';
import { DONEMLER, DonemSayilari, Sayi, SayacSonucu, skor } from '@/cekirdek/sayac';
import { bosluk, Renkler, tipografi, useTema } from '@/tema';

type Olcu = 'skor' | 'arac' | 'demerit';

const OLCULER: readonly { id: Olcu; ad: string; deger: (x: Sayi) => string }[] = [
  { id: 'skor', ad: 'Skor', deger: (x) => { const v = skor(x); return v === null ? '—' : String(v); } },
  { id: 'arac', ad: 'Araç', deger: (x) => String(x.arac) },
  { id: 'demerit', ad: 'Demerit', deger: (x) => String(x.demerit) },
];

const okunus = (x: Sayi) => {
  const v = skor(x);
  return `${x.arac} araç, demerit ${x.demerit}, skor ${v === null ? 'yok' : v}`;
};

export function Sayac({ sonuc }: { sonuc: SayacSonucu }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [olcu, setOlcu] = useState<Olcu>('skor');
  // Sayılan dönemlerde hiç AUDIT denetimi yoksa boş tablo göstermenin anlamı yok.
  if (!sonuc.araclar.length) return null;
  const secili = OLCULER.find((o) => o.id === olcu)!;

  const satir = (kod: string, okunanAd: string, sayilar: DonemSayilari, toplam = false) => (
    <View
      key={kod}
      style={[s.satir, toplam && s.toplamSatir]}
      accessible
      accessibilityLabel={`${okunanAd}: ${DONEMLER.map((d) => `${d.uzun.toLocaleLowerCase('tr')} ${okunus(sayilar[d.id])}`).join('; ')}`}
    >
      <Text style={[s.ad, toplam && s.toplamAd]} numberOfLines={2}>{kod}</Text>
      {DONEMLER.map((d) => {
        const metin = secili.deger(sayilar[d.id]);
        return (
          <Text key={d.id} style={[s.deger, (metin === '0' || metin === '—') && s.sifir]} numberOfLines={1}>{metin}</Text>
        );
      })}
    </View>
  );

  return (
    <Kart>
      <BolumBasligi metin="Audit skoru" simge={S.tarih} />
      <Text style={s.not}>AUDIT kaynaklı araçlar · skor = 100 × demerit ÷ araç</Text>
      <View style={s.olcuSatir} accessibilityRole="radiogroup" accessibilityLabel="Gösterilen ölçü">
        {OLCULER.map((o) => (
          <Secenek
            key={o.id}
            kucuk
            metin={o.ad}
            secili={olcu === o.id}
            onPress={() => setOlcu(o.id)}
            erisimEtiketi={`Ölçü: ${o.ad}`}
            style={{ flex: 1, justifyContent: 'center' }}
          />
        ))}
      </View>
      <View style={s.satir} importantForAccessibility="no-hide-descendants" aria-hidden>
        <View style={s.adBos} />
        {DONEMLER.map((d) => <Text key={d.id} style={s.baslik} numberOfLines={2}>{d.ad}</Text>)}
      </View>
      {sonuc.araclar.map((a) => {
        const arac = ARAC_INDEKS[a.aracId];
        return satir(arac?.kod ?? a.aracId, aracEtiketi(arac, a.aracId), a.sayilar);
      })}
      {/* Tek araç varsa toplam satırı aynı sayıları tekrar ederdi. */}
      {sonuc.araclar.length > 1 ? satir('Toplam', 'Toplam', sonuc.toplam, true) : null}
    </Kart>
  );
}

const AD_GENISLIK = 60;

const stiller = (r: Renkler) => StyleSheet.create({
  not: { ...tipografi.caption, color: r.metinSolgun },
  olcuSatir: { flexDirection: 'row', gap: bosluk.xs },
  satir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xxs, paddingVertical: 3 },
  toplamSatir: { borderTopWidth: 1, borderTopColor: r.cizgiSolgun, paddingTop: bosluk.xs },
  adBos: { width: AD_GENISLIK },
  ad: { ...tipografi.captionOrta, color: r.metin, width: AD_GENISLIK },
  toplamAd: { color: r.metinIkincil },
  baslik: { ...tipografi.etiket, fontSize: 11, lineHeight: 14, color: r.metinSolgun, flex: 1, textAlign: 'center' },
  deger: { ...tipografi.sayiBuyuk, fontSize: 18, lineHeight: 24, color: r.metin, flex: 1, textAlign: 'center', minWidth: 0 },
  sifir: { color: r.metinSolgun },
});
