// TEMA SAĞLAYICI.
//
// Kullanım — HER stil dosyasında kalıp aynı:
//   const { renkler } = useTema();
//   const stiller = useMemo(() => stilleriUret(renkler), [renkler]);
// Sabit `StyleSheet.create` tema değişince DONAR; o yüzden stiller renkten
// türetilir. Çıplak hex yazmak iki temanın birinde sessizce okunmaz üretir.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { PALETLER, Renkler, TemaAdi } from './paletler';

/** Kullanıcının seçimi: sistemi izle, ya da birini zorla. */
export type TemaTercihi = 'sistem' | TemaAdi;

const ANAHTAR = 'arac-audit:tema';

interface TemaBaglami {
  renkler: Renkler;
  temaAdi: TemaAdi;
  tercih: TemaTercihi;
  tercihiAyarla: (t: TemaTercihi) => void;
}

const Baglam = createContext<TemaBaglami | null>(null);

export function TemaSaglayici({ children }: { children: React.ReactNode }) {
  const sistem = useColorScheme();
  const [tercih, setTercih] = useState<TemaTercihi>('sistem');

  useEffect(() => {
    AsyncStorage.getItem(ANAHTAR)
      .then((v) => {
        if (v === 'sistem' || v === 'acik' || v === 'koyu') setTercih(v);
      })
      .catch(() => {
        // İlk açılış ya da depo erişilemiyor: sistem tercihiyle devam.
      });
  }, []);

  const tercihiAyarla = useCallback((t: TemaTercihi) => {
    setTercih(t);
    AsyncStorage.setItem(ANAHTAR, t).catch(() => {
      // Kaydedilemedi: bu oturumda çalışır, kalıcı olmaz. Kullanıcıyı
      // bununla rahatsız etmiyoruz; tema kritik bir veri değil.
    });
  }, []);

  const temaAdi: TemaAdi = tercih === 'sistem' ? (sistem === 'dark' ? 'koyu' : 'acik') : tercih;

  const deger = useMemo<TemaBaglami>(
    () => ({ renkler: PALETLER[temaAdi], temaAdi, tercih, tercihiAyarla }),
    [temaAdi, tercih, tercihiAyarla],
  );

  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}

export function useTema(): TemaBaglami {
  const b = useContext(Baglam);
  if (!b) throw new Error('useTema, TemaSaglayici dışında çağrıldı.');
  return b;
}

export { PALETLER, siddetRenkleri } from './paletler';
export type { Renkler, TemaAdi } from './paletler';
export * from './olculer';
