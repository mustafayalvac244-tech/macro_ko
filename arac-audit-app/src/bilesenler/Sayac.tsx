// SAYAÇ — ana sayfada araç başına denetlenen araç ve hata sayısı (sayac.ts).
//
// Şirketteki Excel formunun sağ paneli örnek alındı (ürün sahibi, 24.10.2026):
// satırlar araç, sütunlar bugün / bu hafta / bu ay / bu yıl. Hücrede büyük sayı
// denetlenen araç, altında hata ve DPU (araç başına düzeltilecek hata;
// kabul edilebilirler sayılmaz — Excel raporundaki DPU ile aynı). Ana sayfa
// 28.09.2026'da "çok kalabalık olmasın" diye sadeleştirilmişti; bu yüzden
// tek, kutusuz bir tablo. Tablonun altındaki açıklama cümlesi 25.10.2026'da
// kaldırıldı (kalabalık); DPU'nun tanımı Analiz ekranında.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { S } from '@/bilesenler/simgeler';
import { BolumBasligi, Dugme, Kart } from '@/bilesenler/temel';
import { ARAC_INDEKS } from '@/cekirdek/model3d';
import { DONEMLER, DonemSayilari, dpu, SayacSonucu } from '@/cekirdek/sayac';
import { bosluk, Renkler, tipografi, useTema } from '@/tema';

export function Sayac({ sonuc, onAnaliz }: { sonuc: SayacSonucu; onAnaliz?: () => void }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  // Bu yıl hiç denetim yoksa boş tablo göstermenin anlamı yok.
  if (!sonuc.araclar.length) return null;

  const satir = (ad: string, sayilar: DonemSayilari, toplam = false) => (
    <View
      key={ad}
      style={[s.satir, toplam && s.toplamSatir]}
      accessible
      accessibilityLabel={`${ad}: ${DONEMLER.map((d) => `${d.ad.toLocaleLowerCase('tr')} ${sayilar[d.id].arac} araç, ${sayilar[d.id].hata} hata, DPU ${dpuMetni(sayilar[d.id])}`).join('; ')}`}
    >
      <Text style={[s.ad, toplam && s.toplamAd]} numberOfLines={1}>{ad}</Text>
      {DONEMLER.map((d) => (
        <View key={d.id} style={s.hucre}>
          <Text style={[s.arac, !sayilar[d.id].arac && s.sifir]}>{sayilar[d.id].arac}</Text>
          <Text style={s.hata} numberOfLines={1}>{`${sayilar[d.id].hata} hata`}</Text>
          <Text style={s.dpu} numberOfLines={1}>{`DPU ${dpuMetni(sayilar[d.id])}`}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Kart>
      <BolumBasligi
        metin="Denetlenen araç"
        simge={S.tarih}
        sag={onAnaliz ? <Dugme metin="Analiz" kucuk simge={S.rapor} onPress={onAnaliz} erisimEtiketi="Analiz ekranını aç" /> : undefined}
      />
      <View style={s.satir} importantForAccessibility="no-hide-descendants" aria-hidden>
        <View style={s.adBos} />
        {DONEMLER.map((d) => <Text key={d.id} style={s.baslik} numberOfLines={1}>{d.ad}</Text>)}
      </View>
      {sonuc.araclar.map((a) => satir(ARAC_INDEKS[a.aracId]?.ad ?? a.aracId, a.sayilar))}
      {/* Tek araç varsa toplam satırı aynı sayıları tekrar ederdi. */}
      {sonuc.araclar.length > 1 ? satir('Toplam', sonuc.toplam, true) : null}
    </Kart>
  );
}

const AD_GENISLIK = 76;

/** Türkçe ondalık: 0,50. Araç yoksa "—". */
const dpuMetni = (x: Parameters<typeof dpu>[0]) => {
  const v = dpu(x);
  return v === null ? '—' : v.toFixed(2).replace('.', ',');
};

const stiller = (r: Renkler) => StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: bosluk.xxs, paddingVertical: 2 },
  toplamSatir: { borderTopWidth: 1, borderTopColor: r.cizgiSolgun, paddingTop: bosluk.xs },
  adBos: { width: AD_GENISLIK },
  ad: { ...tipografi.captionOrta, color: r.metin, width: AD_GENISLIK },
  toplamAd: { color: r.metinIkincil },
  baslik: { ...tipografi.etiket, color: r.metinSolgun, flex: 1, textAlign: 'center' },
  hucre: { flex: 1, alignItems: 'center', minWidth: 0 },
  arac: { ...tipografi.sayiBuyuk, fontSize: 20, lineHeight: 24, color: r.metin },
  sifir: { color: r.metinSolgun },
  hata: { ...tipografi.caption, fontSize: 12, lineHeight: 16, color: r.metinIkincil, fontVariant: ['tabular-nums'] },
  dpu: { ...tipografi.caption, fontSize: 11, lineHeight: 14, color: r.metinSolgun, fontVariant: ['tabular-nums'] },
});
