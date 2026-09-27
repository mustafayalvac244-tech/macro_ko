import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AracIkonu } from '@/bilesenler/AracIkonu';
import { S } from '@/bilesenler/simgeler';
import {
  AltCubuk, Baslik, BilgiKutusu, BolumBasligi, Dugme, GeriDugmesi, Girdi, Kart, Rozet, Secenek, useDuzen,
} from '@/bilesenler/temel';
import { ARACLAR } from '@/cekirdek/model3d';
import { plakaDogrula, VIN_UZUNLUK, vinDogrula } from '@/cekirdek/vin';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { ayarOku, ayarYaz, denetimOlustur } from '@/veri/depo';
import { useTarama } from '@/veri/tarama';

// İlk seçenek varsayılandır. "HMC Audit" ekibin gerçek tablosundaki Source
// değeri (26.09.2026 ekran görüntüsü); diğerleri ilk sürümden kalan tahminler.
const DENETIM_TIPLERI = ['HMC Audit', 'Seri denetim', 'Ara denetim', 'Final audit', 'Yol testi', 'Müşteri şikâyeti', 'Yeniden kontrol'];
const VARDIYALAR = ['A', 'B', 'C'];

/** Denetçi/hat/vardiya/faz/ekip her araçta aynı kalır — bir kez yazılsın, hatırlansın. */
interface Varsayilanlar {
  denetci: string; hat: string; vardiya: string; denetimTipi: string; faz: string; ekip: string;
}

export default function YeniDenetim() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();

  const [aracId, setAracId] = useState(ARACLAR[0]!.id);
  const [vinHam, setVinHam] = useState('');
  const [plakaHam, setPlakaHam] = useState('');
  const [raporNo, setRaporNo] = useState('');
  const [v, setV] = useState<Varsayilanlar>({
    denetci: '', hat: '', vardiya: '', denetimTipi: DENETIM_TIPLERI[0]!, faz: '', ekip: '',
  });
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [denendi, setDenendi] = useState(false);

  // Barkod ekranı okuduğu şasiyi burada bırakır; geri döndüğümüzde alıp
  // temizliyoruz ki aynı numara ikinci bir denetime sızmasın.
  const okunanVin = useTarama((d) => d.okunanVin);
  const taramayiTemizle = useTarama((d) => d.temizle);
  useEffect(() => {
    if (okunanVin) { setVinHam(okunanVin); taramayiTemizle(); }
  }, [okunanVin, taramayiTemizle]);

  useEffect(() => {
    ayarOku<Varsayilanlar | null>('varsayilanlar', null)
      .then((k) => { if (k) setV((o) => ({ ...o, ...k })); })
      .catch(() => { /* ilk açılış */ });
  }, []);

  const vin = useMemo(() => vinDogrula(vinHam), [vinHam]);
  const plaka = useMemo(() => plakaDogrula(plakaHam), [plakaHam]);
  const arac = ARACLAR.find((a) => a.id === aracId)!;

  const basla = useCallback(async () => {
    setDenendi(true);
    if (!vin.gecerli) return;
    setGonderiliyor(true);
    try {
      await ayarYaz('varsayilanlar', v);
      const d = await denetimOlustur({
        aracId, vin: vin.vin, plaka: plaka.bicimli, raporNo: raporNo.trim(),
        denetci: v.denetci.trim(), hat: v.hat.trim(), vardiya: v.vardiya,
        denetimTipi: v.denetimTipi, faz: v.faz.trim(), ekip: v.ekip.trim(),
        baslangic: new Date().toISOString(),
      });
      router.replace({ pathname: '/denetim/[id]', params: { id: d.id } });
    } finally {
      setGonderiliyor(false);
    }
  }, [aracId, plaka.bicimli, raporNo, router, v, vin.gecerli, vin.vin]);

  // VIN durumu: boşken yol göster, doluyken ne bulduğunu söyle.
  const vinDurumu = !vinHam
    ? { tur: 'bilgi' as const, metin: `Barkodu okutun ya da ${VIN_UZUNLUK} haneyi yazın.` }
    : vin.gecerli && !vin.uyarilar.length
      ? { tur: 'basari' as const, metin: `Geçerli · ${vin.bilgi.uretici ?? vin.bilgi.wmi} · model yılı ${vin.bilgi.modelYili ?? '?'}` }
      : { tur: 'uyari' as const, metin: [...vin.hatalar, ...vin.uyarilar].join(' ') };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: renkler.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Baslik baslik="Yeni denetim" altBaslik="Araç, şasi ve denetim bilgisi" sol={<GeriDugmesi />} />

      <ScrollView
        contentContainerStyle={[s.govde, tablet && s.govdeTablet]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.sutun, tablet && s.sutunTablet]}>
          <Kart>
            <BolumBasligi metin="ARAÇ" simge={S.arac} />
            <View style={s.aracIzgara}>
              {ARACLAR.map((a) => {
                const secili = a.id === aracId;
                return (
                  <Pressable
                    key={a.id}
                    accessibilityRole="radio"
                    aria-checked={secili}
                    accessibilityLabel={`${a.tam} seç`}
                    onPress={() => setAracId(a.id)}
                    style={({ pressed }) => [s.aracKart, secili && s.aracKartSecili, pressed && s.basili]}
                  >
                    <View style={s.aracKartUst}>
                      {/* Silüetler aynı ölçekte çizildiği için sola hizalı: kısa
                          araç ortalanırsa boy farkı kaybolur. */}
                      <AracIkonu arac={a} boy={34} />
                      {secili ? (
                        <View style={s.secimIsaret}>
                          <S.tik size={14} color={renkler.metinTers} strokeWidth={3} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[s.aracAd, secili && { color: renkler.birincil }]}>{a.ad}</Text>
                    <Text style={s.aracOlcu}>
                      {a.tip === 'ev' ? 'Elektrikli' : 'İçten yanmalı'}
                      {'\n'}{a.uzunluk}×{a.genislik}×{a.yukseklik} mm
                    </Text>
                    {!a.olcuDogrulandi ? (
                      <Rozet metin="ÖLÇÜ DOĞRULANMADI" renk={renkler.uyari} zemin={renkler.uyariYumusak} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {!arac.olcuDogrulandi ? <BilgiKutusu tur="uyari" metin={arac.not} /> : null}
          </Kart>

          <Kart>
            <BolumBasligi metin="ŞASİ NUMARASI (VIN)" simge={S.barkod} />
            <Girdi
              mono
              value={vin.vin}
              onChangeText={setVinHam}
              placeholder="17 HANE"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              maxLength={40}
              accessibilityLabel="Şasi numarası"
              hata={denendi && !vin.gecerli ? vin.hatalar.join(' ') : undefined}
            />
            <BilgiKutusu tur={vinDurumu.tur} metin={vinDurumu.metin} />
            <View style={s.satir}>
              <Dugme metin="Barkod okut" simge={S.barkod} kucuk onPress={() => router.push('/barkod')} style={{ flex: 1 }} />
              <Dugme metin="Temizle" simge={S.kapat} kucuk tur="sessiz" onPress={() => setVinHam('')} />
            </View>
            <Girdi
              etiket="PLAKA (VARSA)"
              value={plakaHam}
              onChangeText={setPlakaHam}
              placeholder="41 ABC 12"
              autoCapitalize="characters"
              accessibilityLabel="Plaka"
              ipucu={plakaHam && plaka.uyarilar.length ? plaka.uyarilar[0] : undefined}
            />
          </Kart>
        </View>

        <View style={[s.sutun, tablet && s.sutunTablet]}>
          <Kart>
            <BolumBasligi metin="DENETİM BİLGİLERİ" simge={S.rapor} />
            <View style={s.satir}>
              <View style={{ flex: 1 }}>
                <Girdi etiket="FAZ" value={v.faz} onChangeText={(t) => setV({ ...v, faz: t })} placeholder="LP2" autoCapitalize="characters" />
              </View>
              <View style={{ flex: 2 }}>
                <Girdi etiket="EKİP" value={v.ekip} onChangeText={(t) => setV({ ...v, ekip: t })} placeholder="QE Team 2" />
              </View>
            </View>
            <Girdi etiket="RAPOR NO" value={raporNo} onChangeText={setRaporNo} placeholder="QA-2026-0412" />
            <Girdi etiket="DENETÇİ" value={v.denetci} onChangeText={(t) => setV({ ...v, denetci: t })} placeholder="Ad Soyad" />
            <Girdi etiket="ÜRETİM HATTI" value={v.hat} onChangeText={(t) => setV({ ...v, hat: t })} placeholder="Montaj 2" />

            <Text style={s.alanEtiketi}>VARDİYA</Text>
            <View style={s.secimSatiri}>
              {VARDIYALAR.map((x) => (
                <Secenek
                  key={x}
                  metin={x}
                  secili={v.vardiya === x}
                  onPress={() => setV({ ...v, vardiya: v.vardiya === x ? '' : x })}
                  style={{ minWidth: 72 }}
                />
              ))}
            </View>

            <Text style={s.alanEtiketi}>KAYNAK (RAPORDA "SOURCE")</Text>
            <View style={s.secimSatiri}>
              {DENETIM_TIPLERI.map((x) => (
                <Secenek key={x} metin={x} secili={v.denetimTipi === x} onPress={() => setV({ ...v, denetimTipi: x })} />
              ))}
            </View>
          </Kart>
        </View>
      </ScrollView>

      <AltCubuk style={tablet ? { justifyContent: 'flex-end' } : undefined}>
        <Dugme
          metin="Denetime başla"
          tur="birincil"
          simge={S.basla}
          simgeSonda
          yukleniyor={gonderiliyor}
          onPress={basla}
          style={tablet ? { minWidth: 280 } : { flex: 1 }}
        />
      </AltCubuk>
    </KeyboardAvoidingView>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  basili: { opacity: 0.72 },
  govde: { padding: bosluk.md, gap: bosluk.md, paddingBottom: bosluk.xxxl },
  govdeTablet: {
    flexDirection: 'row', alignItems: 'flex-start',
    width: '100%', maxWidth: 1100, alignSelf: 'center',
  },
  sutun: { gap: bosluk.md },
  sutunTablet: { flex: 1, minWidth: 0 },
  alanEtiketi: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.xxs },

  aracIzgara: { flexDirection: 'row', gap: bosluk.xs, flexWrap: 'wrap' },
  aracKart: {
    flexGrow: 1, flexBasis: 150, gap: 4,
    backgroundColor: r.yuzey, borderRadius: kose.md,
    borderWidth: 1.5, borderColor: r.cizgi, padding: bosluk.sm,
  },
  aracKartSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  aracKartUst: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: bosluk.xs },
  secimIsaret: {
    width: 22, height: 22, borderRadius: kose.pill, backgroundColor: r.birincil,
    alignItems: 'center', justifyContent: 'center',
  },
  aracAd: { ...tipografi.h3, color: r.metin },
  aracOlcu: { ...tipografi.caption, color: r.metinSolgun },

  satir: { flexDirection: 'row', gap: bosluk.xs },
  secimSatiri: { flexDirection: 'row', gap: bosluk.xs, flexWrap: 'wrap' },
});
