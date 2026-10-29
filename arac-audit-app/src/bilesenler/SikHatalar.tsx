// SIK HATALAR ŞERİDİ (27.10.2026) — denetim ekranının başında. Çipe dokun →
// (isterse sınıf) → demerit seç → Ekle. Demerit seçmeden kayıt yok kararı
// (ürün sahibi) burada da geçerli. 29.10.2026'ya kadar demerit dokunuşu
// doğrudan kaydediyordu; ürün sahibi "tamam ekle diye bişi çıkması lazım"
// dedi, parça ekranıyla birlikte burada da kayıt "Ekle" düğmesine geçti.
// Sıralama ve "en az iki kez" kuralı cekirdek/sikHatalar.ts'de.

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
  const [derece, setDerece] = useState<DereceKodu | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [uyari, setUyari] = useState(false);

  const ad = (o: SikHata) => `${parcaCiftiAdi(o, dil)} — ${hataTipiAdi(o.hataTipiId, dil)}`;
  const sifirla = () => { setSinif(VARSAYILAN_SINIF); setDerece(null); setUyari(false); };
  const kaydet = async () => {
    if (!secili || kaydediliyor) return;
    if (derece === null) { setUyari(true); return; }
    setKaydediliyor(true);
    const tamam = await onKaydet(secili, derece, sinif).catch(() => false);
    setKaydediliyor(false);
    if (tamam) { setSecili(null); sifirla(); }
  };

  return (
    <View style={s.kok} testID="sik-hatalar">
      <BolumBasligi
        metin={t('Sık hatalar — bu modelde', 'Frequent defects — this model')}
        simge={S.sik}
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
              accessibilityLabel={t(`${ad(o)}, ${o.sayi} kez kaydedildi. Seç, sonra demerit ve Ekle.`, `${ad(o)}, saved ${o.sayi} times. Select, then pick a demerit and Add.`)}
              onPress={() => { setSecili(acik ? null : o); sifirla(); }}
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
          {/* Sıra parça ekranıyla aynı (28.10.2026): önce sınıf, sonra demerit;
              kayıt "Ekle" ile (29.10.2026). */}
          <Text style={s.ipucu}>{t('Sınıf', 'Class')}</Text>
          <SinifSecici sinif={sinif} onSec={setSinif} />
          <Text style={[s.ipucu, uyari && { color: renkler.uyari }]} accessibilityLiveRegion="polite">
            {uyari ? t('Demerit seçin (0–3)', 'Pick a demerit (0–3)') : t('Demerit — 0 skora girmez', 'Demerit — 0 not scored')}
          </Text>
          <DereceSecici derece={derece} onSec={(d) => { setDerece(d); setUyari(false); }} kucuk />
          <View style={s.eylemler}>
            <Dugme metin={t('Vazgeç', 'Cancel')} tur="sessiz" kucuk simge={S.kapat} onPress={() => { setSecili(null); sifirla(); }} />
            <Dugme
              metin={t('Ekle', 'Add')}
              simge={S.ekle}
              tur={derece !== null ? 'birincil' : 'ikincil'}
              yukleniyor={kaydediliyor}
              onPress={kaydet}
              erisimEtiketi={derece !== null
                ? t(`Ekle: ${ad(secili)}, demerit ${derece}, ${sinif}`, `Add: ${ad(secili)}, demerit ${derece}, ${sinif}`)
                : t('Ekle — önce demerit seçin', 'Add — pick a demerit first')}
              style={{ minWidth: 128 }}
            />
          </View>
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
  // Açık çip uygulamanın seçili dilinde (temel.tsx Secenek): yumuşak ton + 2 px kenar.
  cipAcik: { borderColor: r.birincil, borderWidth: 2 },
  cipParca: { ...tipografi.captionOrta, color: r.birincil },
  cipTip: { ...tipografi.caption, color: r.metinIkincil },
  cipMetinAcik: {},
  basili: { opacity: 0.7 },
  panel: { gap: bosluk.xs, padding: bosluk.sm, borderRadius: kose.md, backgroundColor: r.yuzeyAlt },
  panelBaslik: { ...tipografi.bodyOrta, color: r.metin },
  ipucu: { ...tipografi.caption, color: r.metinSolgun },
  eylemler: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: bosluk.sm },
});
