import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Baslik, BaslikDugmesi, BilgiKutusu, Dugme, Ekran } from '@/bilesenler/temel';
import { vinDogrula } from '@/cekirdek/vin';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { useTarama } from '@/veri/tarama';

/**
 * Şasi barkodu okuma.
 *
 * Okunan her barkod VIN doğrulamasından geçirilir; 17 haneye ve alfabeye
 * uymayan bir okuma KABUL EDİLMEZ. Gerekçe: araç üzerinde birden çok barkod
 * vardır (parça etiketi, sevk etiketi) ve yanlış olanı okumak, denetimi
 * baştan yanlış araca yazmak demektir.
 */
export default function BarkodEkrani() {
  const router = useRouter();
  const { renkler } = useTema();
  const s = useMemo(() => stiller(renkler), [renkler]);
  const [izin, izinIste] = useCameraPermissions();
  const vinYaz = useTarama((d) => d.vinYaz);
  const okundu = useRef(false);

  const barkod = useCallback((sonuc: { data: string }) => {
    if (okundu.current) return;
    const aday = vinDogrula(sonuc.data);
    if (!aday.gecerli) return;
    okundu.current = true;
    vinYaz(aday.vin);
    router.back();
  }, [router, vinYaz]);

  return (
    <Ekran kenarlar={['top']}>
      <Baslik
        baslik="Şasi barkodu"
        altBaslik="Barkodu çerçeveye alın"
        sol={<BaslikDugmesi metin="‹" erisimEtiketi="Geri" onPress={() => router.back()} />}
      />
      <View style={s.govde}>
        {!izin ? null : !izin.granted ? (
          <>
            <BilgiKutusu
              tur="uyari"
              metin="Barkod okumak için kamera izni gerekiyor. İzin vermezseniz şasi numarasını elle yazabilirsiniz."
            />
            <Dugme metin="Kamera iznini ver" tur="birincil" onPress={() => { izinIste(); }} />
          </>
        ) : (
          <>
            <View style={s.kamera}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['code128', 'code39', 'qr', 'datamatrix', 'pdf417', 'itf14'],
                }}
                onBarcodeScanned={barkod}
              />
              <View style={s.cerceve} pointerEvents="none" />
            </View>
            <Text style={s.not}>
              Okunan metin 17 hane ve VIN alfabesine uygun değilse kabul edilmez —
              araç üzerindeki başka bir etiketi yanlışlıkla okumayasınız diye.
            </Text>
          </>
        )}
      </View>
    </Ekran>
  );
}

const stiller = (r: Renkler) => StyleSheet.create({
  govde: { flex: 1, padding: bosluk.md, gap: bosluk.sm },
  kamera: {
    flex: 1, borderRadius: kose.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: '#000000',
  },
  cerceve: {
    position: 'absolute', left: '8%', right: '8%', top: '35%', height: '30%',
    borderWidth: 2, borderColor: r.birincil, borderRadius: kose.md,
  },
  not: { ...tipografi.caption, color: r.metinSolgun },
});
