import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AracIkonu } from '@/bilesenler/AracIkonu';
import { EklenebilirSecim, useSecimListesi } from '@/bilesenler/EklenebilirSecim';
import { S } from '@/bilesenler/simgeler';
import {
  AltCubuk, Baslik, BilgiKutusu, BolumBasligi, Dugme, GeriDugmesi, Girdi, Kart, Secenek, useDuzen,
} from '@/bilesenler/temel';
import { KM_HANE, kmAyikla, kmSadelestir, SPECLER } from '@/cekirdek/aracBilgisi';
import { HAZIR_DENETCILER, HAZIR_FAZLAR, LISTE_ANAHTARI, listedeyse } from '@/cekirdek/listeler';
import { ARACLAR } from '@/cekirdek/model3d';
import { plakaDogrula, VIN_UZUNLUK, vinDogrula } from '@/cekirdek/vin';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { ayarOku, ayarYaz, denetimOlustur } from '@/veri/depo';
import { useTarama } from '@/veri/tarama';

/**
 * Raporun "Source" sütunu. Ekibin tablosundaki değer (26.09.2026 ekran
 * görüntüsü). Formdaki kaynak seçimi, üretim hattı ve vardiya ürün sahibinin
 * isteğiyle kaldırıldı (28.09.2026): "Üretim hattını kaldır. Vardiya kaldır.
 * Aşağıya da üretim seri üretim şeylerini kaldır." Seçeneklerin HMC Audit
 * dışındakiler zaten ilk sürümden kalan tahminlerdi.
 */
const KAYNAK = 'HMC Audit';

/**
 * Denetçi/faz/ekip her araçta aynı kalır — bir kez seçilsin, hatırlansın.
 * Eski kayıtta hat/vardiya/denetimTipi de var; bilerek OKUNMUYOR: form artık
 * onları göstermiyor, görünmeyen bir değer rapora sessizce yazılmamalı.
 */
interface Varsayilanlar { denetci: string; faz: string; ekip: string }

export default function YeniDenetim() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const { tablet } = useDuzen();

  const [aracId, setAracId] = useState(ARACLAR[0]!.id);
  const [vinHam, setVinHam] = useState('');
  const [plakaHam, setPlakaHam] = useState('');
  // Spec ve km ARACA özgü (şasi, plaka gibi): hatırlanmaz, her araçta girilir.
  const [spec, setSpec] = useState('');
  const [kmHam, setKmHam] = useState('');
  const [raporNo, setRaporNo] = useState('');
  const [v, setV] = useState<Varsayilanlar>({ denetci: '', faz: '', ekip: '' });
  const denetciler = useSecimListesi(LISTE_ANAHTARI.denetci, HAZIR_DENETCILER);
  const fazlar = useSecimListesi(LISTE_ANAHTARI.faz, HAZIR_FAZLAR);
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
    ayarOku<Partial<Varsayilanlar> | null>('varsayilanlar', null)
      .then((k) => {
        if (k) setV({ denetci: k.denetci ?? '', faz: k.faz ?? '', ekip: k.ekip ?? '' });
      })
      .catch(() => { /* ilk açılış */ });
  }, []);

  const vin = useMemo(() => vinDogrula(vinHam), [vinHam]);
  const plaka = useMemo(() => plakaDogrula(plakaHam), [plakaHam]);

  const basla = useCallback(async () => {
    setDenendi(true);
    if (!vin.gecerli) return;
    setGonderiliyor(true);
    try {
      // Yalnız ekranda SEÇİLİ görünen değer yazılır: listeden kaldırılmış bir
      // ad hatırlanmış olsa bile formda görünmüyorsa rapora da gitmez.
      const denetci = listedeyse(denetciler.liste, v.denetci);
      const faz = listedeyse(fazlar.liste, v.faz);
      await ayarYaz('varsayilanlar', { denetci, faz, ekip: v.ekip });
      const d = await denetimOlustur({
        aracId, vin: vin.vin, plaka: plaka.bicimli, raporNo: raporNo.trim(),
        denetci, hat: '', vardiya: '', denetimTipi: KAYNAK, faz, ekip: v.ekip.trim(),
        spec, km: kmAyikla(kmHam),
        baslangic: new Date().toISOString(),
      });
      router.replace({ pathname: '/denetim/[id]', params: { id: d.id } });
    } finally {
      setGonderiliyor(false);
    }
  }, [aracId, denetciler.liste, fazlar.liste, kmHam, plaka.bicimli, raporNo, router, spec, v, vin.gecerli, vin.vin]);

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
                    {/* Ölçüler, "ölçü doğrulanmadı" etiketi ve ölçü uyarısı
                        kaldırıldı (ürün sahibi, 28.09.2026: "çok kalabalık
                        olmasın"). Ölçüler yalnız 3B model içindi; model akıştan
                        çıktı. Doğrulanmamış oldukları model3d.ts'te yazılı. */}
                    <Text style={s.aracTip}>{a.tip === 'ev' ? 'Elektrikli' : 'İçten yanmalı'}</Text>
                  </Pressable>
                );
              })}
            </View>
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
            <View style={s.specKmSatir}>
              <View style={{ gap: bosluk.xxs }}>
                <Text style={s.alanEtiketi}>SPEC</Text>
                <View style={s.satir}>
                  {SPECLER.map((x) => (
                    <Secenek
                      key={x}
                      metin={x}
                      erisimEtiketi={`Spec ${x}`}
                      secili={spec === x}
                      onPress={() => setSpec(spec === x ? '' : x)}
                      style={{ minWidth: 72 }}
                    />
                  ))}
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 140 }}>
                <Girdi
                  etiket="KM"
                  value={kmHam}
                  onChangeText={(t) => setKmHam(kmSadelestir(t))}
                  placeholder="Göstergedeki değer"
                  keyboardType="number-pad"
                  maxLength={KM_HANE}
                  accessibilityLabel="Kilometre"
                />
              </View>
            </View>
          </Kart>
        </View>

        <View style={[s.sutun, tablet && s.sutunTablet]}>
          <Kart>
            <BolumBasligi metin="DENETİM BİLGİLERİ" simge={S.rapor} />
            <EklenebilirSecim
              baslik="DENETÇİ"
              ad="Denetçi"
              liste={denetciler}
              deger={listedeyse(denetciler.liste, v.denetci)}
              degistir={(d) => setV({ ...v, denetci: d })}
              yerTutucu="Ad Soyad"
            />
            <EklenebilirSecim
              baslik="FAZ"
              ad="Faz"
              liste={fazlar}
              deger={listedeyse(fazlar.liste, v.faz)}
              degistir={(d) => setV({ ...v, faz: d })}
              yerTutucu="Ör. P1"
              buyukHarf
            />
            <Girdi etiket="EKİP" value={v.ekip} onChangeText={(t) => setV({ ...v, ekip: t })} placeholder="QE Team 2" />
            <Girdi etiket="RAPOR NO" value={raporNo} onChangeText={setRaporNo} placeholder="İsteğe bağlı" />
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
  aracTip: { ...tipografi.caption, color: r.metinSolgun },

  satir: { flexDirection: 'row', gap: bosluk.xs },
  specKmSatir: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: bosluk.sm },
  alanEtiketi: { ...tipografi.etiket, color: r.metinSolgun },
});
