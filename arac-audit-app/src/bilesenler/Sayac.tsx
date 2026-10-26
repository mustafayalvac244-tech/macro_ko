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
import { useDil } from '@/veri/dilDeposu';

type Olcu = 'skor' | 'arac' | 'demerit';

const OLCULER: readonly { id: Olcu; ad: string; en: string; deger: (x: Sayi) => string }[] = [
  { id: 'skor', ad: 'Skor', en: 'Score', deger: (x) => { const v = skor(x); return v === null ? '—' : String(v); } },
  { id: 'arac', ad: 'Araç', en: 'Vehicles', deger: (x) => String(x.arac) },
  { id: 'demerit', ad: 'Demerit', en: 'Demerit', deger: (x) => String(x.demerit) },
];

const okunus = (x: Sayi, t: (tr: string, en: string) => string) => {
  const v = skor(x);
  return t(
    `${x.arac} araç, demerit ${x.demerit}, skor ${v === null ? 'yok' : v}`,
    `${x.arac} ${x.arac === 1 ? 'vehicle' : 'vehicles'}, demerit ${x.demerit}, score ${v === null ? 'none' : v}`,
  );
};

export function Sayac({ sonuc }: { sonuc: SayacSonucu }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [olcu, setOlcu] = useState<Olcu>('skor');
  const { dil, t } = useDil();
  // Sayılan dönemlerde hiç AUDIT denetimi yoksa boş tablo göstermenin anlamı yok.
  if (!sonuc.araclar.length) return null;
  const secili = OLCULER.find((o) => o.id === olcu)!;

  const satir = (kod: string, okunanAd: string, sayilar: DonemSayilari, toplam = false) => (
    <View
      key={kod}
      style={[s.satir, toplam && s.toplamSatir]}
      accessible
      accessibilityLabel={`${okunanAd}: ${DONEMLER.map((d) => `${(dil === 'en' ? d.enUzun : d.uzun).toLocaleLowerCase(dil)} ${okunus(sayilar[d.id], t)}`).join('; ')}`}
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
      <BolumBasligi
        metin={t('Audit skoru', 'Audit score')}
        simge={S.skor}
        bilgi={t(
          "Yalnız AUDIT kaynaklı ve bitmiş denetimler. Skor = 100 × demerit ÷ araç (Excel'deki tanım).",
          'Finished AUDIT-source audits only. Score = 100 × demerit ÷ vehicles (as defined in the Excel).',
        )}
      />
      <View style={s.olcuSatir} accessibilityRole="radiogroup" accessibilityLabel={t('Gösterilen ölçü', 'Metric shown')}>
        {OLCULER.map((o) => (
          <Secenek
            key={o.id}
            kucuk
            metin={dil === 'en' ? o.en : o.ad}
            secili={olcu === o.id}
            onPress={() => setOlcu(o.id)}
            erisimEtiketi={t(`Ölçü: ${o.ad}`, `Metric: ${o.en}`)}
            style={{ flex: 1, justifyContent: 'center' }}
          />
        ))}
      </View>
      {/* Yön (26.10.2026, ikinci dış değerlendirme): skorun düşüğünün iyi
          olduğu ekranda yazmıyordu; ilk kez bakan "yüksek = iyi" sanıyor. */}
      {olcu === 'skor' ? (
        <Text style={s.not}>{t('Düşük skor iyidir: 0 = demerit yok.', 'Lower is better: 0 = no demerits.')}</Text>
      ) : null}
      <View style={s.satir} importantForAccessibility="no-hide-descendants" aria-hidden>
        <View style={s.adBos} />
        {DONEMLER.map((d) => <Text key={d.id} style={s.baslik} numberOfLines={2}>{dil === 'en' ? d.en : d.ad}</Text>)}
      </View>
      {sonuc.araclar.map((a) => {
        const arac = ARAC_INDEKS[a.aracId];
        return satir(arac?.kod ?? a.aracId, aracEtiketi(arac, a.aracId), a.sayilar);
      })}
      {/* Tek araç varsa bu satır aynı sayıları tekrar ederdi. Adı "Toplam" değil
          "Tümü": skor sütununda bu satır skorların toplamı DEĞİL, bütün araçların
          birlikte skoru (100 × toplam demerit ÷ toplam araç). */}
      {sonuc.araclar.length > 1 ? satir(t('Tümü', 'All'), t('Tüm modeller', 'All models'), sonuc.toplam, true) : null}
    </Kart>
  );
}

const AD_GENISLIK = 60;

const stiller = (r: Renkler) => StyleSheet.create({
  not: { ...tipografi.caption, color: r.metinSolgun },
  olcuSatir: { flexDirection: 'row', gap: bosluk.xs },
  // Sütunlar sağa yaslı ve arası 8 px (26.10.2026 dış değerlendirme: ortalı
  // "1200 1200" birbirine yapışıyordu). Sayılar sabit genişlikli.
  satir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xs, paddingVertical: 3 },
  toplamSatir: { borderTopWidth: 1, borderTopColor: r.cizgiSolgun, paddingTop: bosluk.xs },
  adBos: { width: AD_GENISLIK },
  ad: { ...tipografi.captionOrta, color: r.metin, width: AD_GENISLIK },
  toplamAd: { color: r.metinIkincil },
  baslik: { ...tipografi.etiket, fontSize: 11, lineHeight: 14, color: r.metinSolgun, flex: 1, textAlign: 'right' },
  deger: { ...tipografi.sayiBuyuk, fontSize: 16, lineHeight: 22, color: r.metin, flex: 1, textAlign: 'right', minWidth: 0 },
  sifir: { color: r.metinSolgun },
});
