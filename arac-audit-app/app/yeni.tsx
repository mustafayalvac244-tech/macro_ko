import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AracIkonu } from '@/bilesenler/AracIkonu';
import {
  Baslik, BaslikDugmesi, BilgiKutusu, Dugme, Girdi, Rozet,
} from '@/bilesenler/temel';
import { ARACLAR } from '@/cekirdek/model3d';
import { plakaDogrula, VIN_UZUNLUK, vinDogrula } from '@/cekirdek/vin';
import { bosluk, DOKUNMA, kose, Renkler, tipografi, useTema } from '@/tema';
import { ayarOku, ayarYaz, denetimOlustur } from '@/veri/depo';
import { useTarama } from '@/veri/tarama';

const DENETIM_TIPLERI = ['Seri denetim', 'Ara denetim', 'Final audit', 'Yol testi', 'Müşteri şikâyeti', 'Yeniden kontrol'];
const VARDIYALAR = ['A', 'B', 'C'];

/** Denetçi/hat/vardiya her araçta aynı kalır — bir kez yazılsın, hatırlansın. */
interface Varsayilanlar { denetci: string; hat: string; vardiya: string; denetimTipi: string }

export default function YeniDenetim() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);

  const [aracId, setAracId] = useState(ARACLAR[0]!.id);
  const [vinHam, setVinHam] = useState('');
  const [plakaHam, setPlakaHam] = useState('');
  const [raporNo, setRaporNo] = useState('');
  const [v, setV] = useState<Varsayilanlar>({ denetci: '', hat: '', vardiya: '', denetimTipi: DENETIM_TIPLERI[0]! });
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
        denetimTipi: v.denetimTipi, baslangic: new Date().toISOString(),
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
      ? { tur: 'bilgi' as const, metin: `✓ Geçerli · ${vin.bilgi.uretici ?? vin.bilgi.wmi} · model yılı ${vin.bilgi.modelYili ?? '?'}` }
      : { tur: 'uyari' as const, metin: [...vin.hatalar, ...vin.uyarilar].join(' ') };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: renkler.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Baslik
        baslik="Yeni Denetim"
        altBaslik="Araç ve şasi bilgisi"
        sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />}
      />

      <ScrollView
        contentContainerStyle={s.govde}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.bolum}>
          <Text style={s.bolumBaslik}>ARAÇ</Text>
          <View style={s.aracIzgara}>
            {ARACLAR.map((a) => {
              const secili = a.id === aracId;
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: secili }}
                  accessibilityLabel={`${a.tam} seç`}
                  onPress={() => setAracId(a.id)}
                  style={[s.aracKart, secili && s.aracKartSecili]}
                >
                  <View style={s.aracIkon}>
                    <AracIkonu arac={a} boy={34} />
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
        </View>

        <View style={s.bolum}>
          <Text style={s.bolumBaslik}>ŞASİ NUMARASI (VIN)</Text>
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
            <Dugme metin="📷 Barkod okut" kucuk onPress={() => router.push('/barkod')} style={{ flex: 1 }} />
            <Dugme metin="Temizle" kucuk tur="sessiz" onPress={() => setVinHam('')} />
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
        </View>

        <View style={s.bolum}>
          <Text style={s.bolumBaslik}>DENETİM BİLGİLERİ</Text>
          <Girdi etiket="RAPOR NO" value={raporNo} onChangeText={setRaporNo} placeholder="QA-2026-0412" />
          <Girdi etiket="DENETÇİ" value={v.denetci} onChangeText={(t) => setV({ ...v, denetci: t })} placeholder="Ad Soyad" />
          <Girdi etiket="ÜRETİM HATTI" value={v.hat} onChangeText={(t) => setV({ ...v, hat: t })} placeholder="Montaj 2" />

          <Text style={s.alanEtiketi}>VARDİYA</Text>
          <View style={s.secimSatiri}>
            {VARDIYALAR.map((x) => (
              <Secim key={x} metin={x} secili={v.vardiya === x} onPress={() => setV({ ...v, vardiya: v.vardiya === x ? '' : x })} />
            ))}
          </View>

          <Text style={s.alanEtiketi}>DENETİM TİPİ</Text>
          <View style={s.secimSatiri}>
            {DENETIM_TIPLERI.map((x) => (
              <Secim key={x} metin={x} secili={v.denetimTipi === x} onPress={() => setV({ ...v, denetimTipi: x })} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={s.altCubuk}>
        <Dugme
          metin="Denetime Başla →"
          tur="birincil"
          yukleniyor={gonderiliyor}
          onPress={basla}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Secim({ metin, secili, onPress }: { metin: string; secili: boolean; onPress: () => void }) {
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: secili }}
      accessibilityLabel={metin}
      onPress={onPress}
      style={[s.secim, secili && s.secimSecili]}
    >
      <Text style={[s.secimMetin, secili && { color: renkler.birincil }]}>{metin}</Text>
    </Pressable>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { padding: bosluk.md, gap: bosluk.lg, paddingBottom: bosluk.xxxl },
  bolum: { gap: bosluk.sm },
  bolumBaslik: { ...tipografi.etiket, color: r.metinSolgun },
  alanEtiketi: { ...tipografi.etiket, color: r.metinSolgun, marginTop: bosluk.xxs },

  aracIzgara: { flexDirection: 'row', gap: bosluk.xs, flexWrap: 'wrap' },
  aracKart: {
    flexGrow: 1, flexBasis: 150, gap: 4,
    backgroundColor: r.yuzey, borderRadius: kose.md,
    borderWidth: 2, borderColor: r.cizgiSolgun, padding: bosluk.sm,
  },
  aracKartSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  // Silüetler aynı ölçekte çizildiği için ikonlar sola hizalanır: kısa araç
  // ortalanırsa boy farkı kaybolur.
  aracIkon: { alignItems: 'flex-start' },
  aracAd: { ...tipografi.h3, color: r.metin },
  aracOlcu: { ...tipografi.caption, color: r.metinSolgun },

  satir: { flexDirection: 'row', gap: bosluk.xs },

  secimSatiri: { flexDirection: 'row', gap: bosluk.xs, flexWrap: 'wrap' },
  secim: {
    minHeight: DOKUNMA, justifyContent: 'center',
    paddingHorizontal: bosluk.sm, borderRadius: kose.md,
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.yuzey,
  },
  secimSecili: { borderColor: r.birincil, backgroundColor: r.birincilYumusak },
  secimMetin: { ...tipografi.bodyOrta, color: r.metin },

  altCubuk: {
    padding: bosluk.md, gap: bosluk.xs,
    backgroundColor: r.bgYukseltilmis, borderTopWidth: 1, borderTopColor: r.cizgiSolgun,
  },
});
