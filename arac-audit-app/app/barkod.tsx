import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { S } from '@/bilesenler/simgeler';
import { Baslik, BosDurum, Dugme, Ekran, GeriDugmesi } from '@/bilesenler/temel';
import { vinDogrula } from '@/cekirdek/vin';
import { bosluk, kose, Renkler, tipografi, useTema } from '@/tema';
import { useDil } from '@/veri/dilDeposu';
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
  const { t } = useDil();
  const [izin, izinIste] = useCameraPermissions();
  const vinYaz = useTarama((d) => d.vinYaz);
  const okundu = useRef(false);
  const kenar = useSafeAreaInsets();

  const barkod = useCallback((sonuc: { data: string }) => {
    if (okundu.current) return;
    // İletiler burada gösterilmiyor; yalnız geçerlilik bakılıyor, dil gerekmez.
    const aday = vinDogrula(sonuc.data);
    if (!aday.gecerli) return;
    okundu.current = true;
    vinYaz(aday.vin);
    router.back();
  }, [router, vinYaz]);

  return (
    <Ekran>
      <Baslik
        baslik={t('Şasi barkodu', 'VIN barcode')}
        altBaslik={t('Barkodu çerçeveye alın', 'Fit the barcode in the frame')}
        sol={<GeriDugmesi />}
      />
      <View style={[s.govde, { paddingBottom: bosluk.md + kenar.bottom }]}>
        {!izin ? null : !izin.granted ? (
          <BosDurum
            simge={S.kamera}
            baslik={t('Kamera izni gerekiyor', 'Camera permission needed')}
            aciklama={t(
              'Barkod okumak için kamera izni gerekiyor. İzin vermezseniz şasi numarasını elle yazabilirsiniz.',
              'Scanning a barcode needs camera permission. Without it, you can type the VIN by hand.',
            )}
            eylem={(
              <Dugme
                metin={t('Kamera iznini ver', 'Allow camera')}
                tur="birincil"
                simge={S.kamera}
                onPress={() => { izinIste(); }}
              />
            )}
          />
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
              {/* Köşe çizgileri: tam çerçeve kamerayı böler, köşeler yalnız hedefi gösterir. */}
              <View style={s.cerceve} pointerEvents="none">
                <View style={[s.kose, s.koseSolUst]} />
                <View style={[s.kose, s.koseSagUst]} />
                <View style={[s.kose, s.koseSolAlt]} />
                <View style={[s.kose, s.koseSagAlt]} />
              </View>
            </View>
            <View style={s.notSatir}>
              <S.bilgi size={16} color={renkler.metinSolgun} strokeWidth={2} />
              <Text style={s.not}>
                {t(
                  'Okunan metin 17 hane ve VIN alfabesine uygun değilse kabul edilmez — araç üzerindeki başka bir etiketi yanlışlıkla okumayasınız diye.',
                  "A scan is accepted only if it has 17 characters and fits the VIN alphabet — so you don't read another label on the vehicle by mistake.",
                )}
              </Text>
            </View>
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
    borderWidth: 1, borderColor: r.cizgi, backgroundColor: r.ters,
  },
  cerceve: { position: 'absolute', left: '8%', right: '8%', top: '35%', height: '30%' },
  kose: { position: 'absolute', width: 30, height: 30, borderColor: r.tersVurgu },
  koseSolUst: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: kose.md },
  koseSagUst: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: kose.md },
  koseSolAlt: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: kose.md },
  koseSagAlt: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: kose.md },
  notSatir: { flexDirection: 'row', alignItems: 'flex-start', gap: bosluk.xs },
  not: { ...tipografi.caption, color: r.metinSolgun, flex: 1 },
});
