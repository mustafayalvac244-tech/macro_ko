// Barkod ekranından geri dönen şasi numarasını taşıyan minik durum.
//
// Neden ayrı bir durum: rota parametresiyle geri veri taşımak expo-router'da
// "geri git + parametre yaz" gerektiriyor ve tarayıcı ekranı kapanırken
// parametre kaybolabiliyor. Tek alanlık bir durum bunu sadeleştiriyor.

import { create } from 'zustand';

interface TaramaDurumu {
  okunanVin: string | null;
  vinYaz: (v: string) => void;
  temizle: () => void;
}

export const useTarama = create<TaramaDurumu>((set) => ({
  okunanVin: null,
  vinYaz: (v) => set({ okunanVin: v }),
  temizle: () => set({ okunanVin: null }),
}));
