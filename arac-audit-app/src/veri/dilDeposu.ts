// DİL — arayüz Türkçe ya da İngilizce (ürün sahibi, 26.10.2026: "İng Türkçe
// seçenek de olsun").
//
// Metinler kullanıldıkları yerde ÇİFT olarak durur: t('Yeni denetim', 'New
// audit'). Ayrı bir anahtar dosyası yok: metni değiştiren kişi iki dili aynı
// satırda görür; unutulan çeviri o satırda göze batar. Katalog adları
// (parça, bölge, hata tipi, grup, sistem) zaten iki dilli, onlar `dil` ile
// seçilir (katalog.ts → hataTipiAdi, parcaTamAdi; sistemler.ts → sistemAdi).
//
// Tercih cihazda (`ayarlar` tablosu, 'dil'). Varsayılan Türkçe. Excel/CSV
// raporunun dili bundan BAĞIMSIZ: ekibin tablosu gibi İngilizce kalır
// (rapor.tsx → DOSYA_DILI).

import { useCallback } from 'react';
import { create } from 'zustand';

import { Dil } from '@/cekirdek/tipler';
import { ayarOku, ayarYaz } from '@/veri/depo';

interface DilDurumu {
  dil: Dil;
  /** Cihazdaki tercih okundu mu (okunamadıysa da true: Türkçe ile açılır). */
  yuklendi: boolean;
  yukle: () => Promise<void>;
  ayarla: (dil: Dil) => void;
}

export const useDilDeposu = create<DilDurumu>((set) => ({
  dil: 'tr',
  yuklendi: false,
  // Açılış bunu bekliyor (_layout.tsx). Okuma takılırsa uygulama açılmadan
  // beklemesin: 1,5 sn sonra Türkçe ile açılır.
  yukle: async () => {
    try {
      const zamanAsimi = new Promise<string>((coz) => { setTimeout(() => coz('tr'), 1500); });
      const d = await Promise.race([ayarOku<string>('dil', 'tr'), zamanAsimi]);
      set({ dil: d === 'en' ? 'en' : 'tr', yuklendi: true });
    } catch {
      set({ yuklendi: true });
    }
  },
  ayarla: (dil) => {
    set({ dil });
    ayarYaz('dil', dil).catch(() => { /* bu oturumda geçerli, kalıcı olmaz */ });
  },
}));

/** Bileşenin dışında (Alert, hesap) kullanılan seçici: t('…', '…'). */
export const ceviri = (dil: Dil) => (tr: string, en: string): string => (dil === 'en' ? en : tr);

/** Bileşenlerde: `const { dil, t } = useDil();` → t('Yeni denetim', 'New audit'). */
export function useDil(): { dil: Dil; t: (tr: string, en: string) => string } {
  const dil = useDilDeposu((d) => d.dil);
  const t = useCallback((tr: string, en: string) => (dil === 'en' ? en : tr), [dil]);
  return { dil, t };
}
