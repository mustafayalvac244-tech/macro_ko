// SIK HATALAR ŞERİDİ (27.10.2026) — denetim ekranının başında. Çipe dokun →
// (isterse sınıf) → demerit seç: kaydedildi. Demerit seçmeden kayıt yok kararı
// (ürün sahibi) burada da geçerli: kaydı demerit dokunuşu yapar. Sıralama ve
// "en az iki kez" kuralı cekirdek/sikHatalar.ts'de.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DereceSecici, SinifSecici } from '@/bilesenler/HataSayfasi';
import { S } from '@/bilesenler/simgeler';
import { BolumBasligi, Dugme, HataKutusu } from '@/bilesenler/temel';
import { hataTipiAdi, parcaCiftiAdi } from '@/cekirdek/katalog';
import { VARSAYILAN_SINIF } from '@/cekirdek/nas';
import { SikHata } from '@/cekirdek/sikHatalar';
import { DereceKodu, SinifKodu } from '@/cekirdek/tipler';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { useDil } from '@/veri/dilDeposu';

const anahtar = (o: SikHata) => `${o.parcaId}+${o.ikinciParcaId ?? ''}|${o.hataTipiId}`;

export function SikHatalar({ oneriler, onKaydet, hata }: {
  oneriler: SikHata[];
  /** true: kaydedildi. false: kaydedilemedi (neden `hata`da). */
  onKaydet: (o: SikHata, derece: DereceKodu, sinif: SinifKodu) => Promise<boolean>;
  hata: string | null;
}) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { dil, t } = useDil();
  const [secili, setSecili] = useState<SikHata | null>(null);
  const [sinif, setSinif] = useState<SinifKodu>(VARSAYILAN_SINIF);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ad = (o: SikHata) => `${parcaCiftiAdi(o, dil)} — ${hataTipiAdi(o.hataTipiId, dil)}`;
  const kaydet = async (d: DereceKodu) => {
    if (!secili || kaydediliyor) return;
    setKaydediliyor(true);
    const tamam = await onKaydet(secili, d, sinif).catch(() => false);
    setKaydediliyor(false);
    if (tamam) { setSecili(null); setSinif(VARSAYILAN_SINIF); }
  };

  return (
    <View style={s.kok} testID="sik-hatalar">
      <BolumBasligi
        metin={t('Sık hatalar — bu modelde', 'Frequent defects — this model')}
        simge={S.skor}
        bilgi={t(
          'Bu telefonda bu modelde en az iki kez kaydedilmiş parça + hata ikilileri, en sık olan önce. Çipe dokunun, demerit seçin: kaydedilir.',
          'Part + defect pairs saved at least twice for this model on this phone, most frequent first. Tap a chip, pick a demerit: it is saved.',
        )}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.satir} keyboardShouldPersistTaps="handled">
        {oneriler.map((o) => {
          const acik = !!secili && anahtar(secili) === anahtar(o);
          return (
            <Pressable
              key={anahtar(o)}
              accessibilityRole="button"
              accessibilityState={{ selected: acik }}
              accessibilityLabel={t(`${ad(o)}, ${o.sayi} kez kaydedildi. Seç, sonra demerit.`, `${ad(o)}, saved ${o.sayi} times. Select, then pick a demerit.`)}
              onPress={() => { setSecili(acik ? null : o); setSinif(VARSAYILAN_SINIF); }}
              style={({ pressed }) => [s.cip, acik && s.cipAcik, pressed && s.basili]}
            >
              <Text style={[s.cipParca, acik && s.cipMetinAcik]} numberOfLines={1}>{parcaCiftiAdi(o, dil)}</Text>
              <Text style={[s.cipTip, acik && s.cipMetinAcik]} numberOfLines={1}>
                {hataTipiAdi(o.hataTipiId, dil)} · ×{o.sayi}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {secili ? (
        <View style={s.panel} testID="sik-hata-panel">
          <Text style={s.panelBaslik} numberOfLines={2}>{ad(secili)}</Text>
          <SinifSecici sinif={sinif} onSec={setSinif} />
          <Text style={s.ipucu}>{t('Demerit seçince kaydedilir — 0 skora girmez', 'Saved when you pick a demerit — 0 not scored')}</Text>
          <DereceSecici derece={null} onSec={kaydet} etiketOnEki={t('Sık hata demerit', 'Frequent defect demerit')} kucuk />
          <Dugme metin={t('Vazgeç', 'Cancel')} tur="sessiz" kucuk simge={S.kapat} onPress={() => setSecili(null)} />
          {hata ? <HataKutusu metin={hata} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  kok: { gap: bosluk.xs },
  satir: { flexDirection: 'row', gap: bosluk.xs },
  cip: {
    minHeight: 48, maxWidth: 240, justifyContent: 'center', paddingHorizontal: bosluk.sm, paddingVertical: 6,
    borderRadius: kose.md, backgroundColor: r.birincilYumusak, borderWidth: 1.5, borderColor: 'transparent',
  },
  cipAcik: { backgroundColor: r.birincilDolgu, borderColor: r.birincilDolgu },
  cipParca: { ...tipografi.captionOrta, color: r.birincil },
  cipTip: { ...tipografi.caption, color: r.metinIkincil },
  cipMetinAcik: { color: r.birincilDolguMetin },
  basili: { opacity: 0.7 },
  panel: { gap: bosluk.xs, padding: bosluk.sm, borderRadius: kose.md, backgroundColor: r.yuzeyAlt },
  panelBaslik: { ...tipografi.bodyOrta, color: r.metin },
  ipucu: { ...tipografi.caption, color: r.metinSolgun },
});
