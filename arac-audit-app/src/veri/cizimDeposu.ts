// ARAÇ ÇİZİMİNİN STİLİ — teknik (açık gri, ince kontur) ya da renkli (aracın
// görsellerinden ölçülmüş renkler).
//
// İki ürün sahibi isteği çelişiyor, ikisi de kayıtlı: önce renksiz çizim için
// "rengi mengi yok, müdüre göstereceğim" (renkli çizim yapıldı), sonra dört dış
// değerlendirmeden sonra "Temiz teknik çizim" seçildi (26.10.2026). Estetik
// değerlendirici gradyanlı çizimi "clip-art, iki dilin ortasında" buldu;
// teknik çizimde gövde tek açık gri, rengi yalnız hatalar taşır. Varsayılan
// teknik; renkli Ayarlar'dan seçilebilir.
//
// Tercih cihazda (`ayarlar` tablosu, 'cizim'), dil tercihiyle aynı yol.

import { create } from 'zustand';

import { ayarOku, ayarYaz } from '@/veri/depo';

export type CizimStili = 'teknik' | 'renkli';

interface CizimDurumu {
  stil: CizimStili;
  yuklendi: boolean;
  yukle: () => Promise<void>;
  ayarla: (stil: CizimStili) => void;
}

export const useCizimDeposu = create<CizimDurumu>((set, get) => ({
  stil: 'teknik',
  yuklendi: false,
  yukle: async () => {
    if (get().yuklendi) return;
    try {
      const s = await ayarOku<string>('cizim', 'teknik');
      set({ stil: s === 'renkli' ? 'renkli' : 'teknik', yuklendi: true });
    } catch {
      set({ yuklendi: true });
    }
  },
  ayarla: (stil) => {
    set({ stil, yuklendi: true });
    ayarYaz('cizim', stil).catch(() => { /* bu oturumda geçerli, kalıcı olmaz */ });
  },
}));
