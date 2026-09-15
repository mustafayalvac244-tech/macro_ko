import { create } from 'zustand';

import { ozelHataTipleriniAyarla } from '@/cekirdek/katalog';
import { HataGrubuId, HataTipi, SiddetKodu } from '@/cekirdek/tipler';
import {
  ozelHataTipiEkle, ozelHataTipiGeriAl, ozelHataTipiKaldir, ozelHataTipleriOku,
} from '@/veri/depo';

/**
 * Ekibin kendi eklediği hata tiplerini bellekte tutar ve kataloğa bağlar.
 *
 * NEDEN AYRI BİR KATMAN: `cekirdek/` saf alan mantığıdır, veritabanı bilmez —
 * testlerde ve rapor üretiminde SQLite açmak zorunda kalmayalım diye. Depodan
 * okuma burada olur, sonuç `ozelHataTipleriniAyarla` ile çekirdeğe verilir.
 *
 * Her değişiklikten sonra kataloğu YENİDEN BAĞLAMAK şart: rapor ve puanlama
 * hata adını katalog indeksinden çözüyor, bağlamazsak yeni tip Excel'de ham
 * kimlik olarak çıkar.
 */
interface KatalogDurumu {
  ozelTipler: HataTipi[];
  yuklendi: boolean;
  hata: string | null;
  yukle: () => Promise<void>;
  ekle: (girdi: {
    grup: HataGrubuId; ad: string; en: string; siddet: SiddetKodu; ekleyen: string;
  }) => Promise<HataTipi>;
  kaldir: (id: string) => Promise<void>;
  geriAl: (id: string) => Promise<void>;
}

export const useKatalog = create<KatalogDurumu>((ayarla) => {
  const bagla = (liste: HataTipi[]) => {
    ozelHataTipleriniAyarla(liste);
    ayarla({ ozelTipler: liste });
  };

  return {
    ozelTipler: [],
    yuklendi: false,
    hata: null,

    yukle: async () => {
      try {
        bagla(await ozelHataTipleriOku());
        ayarla({ yuklendi: true, hata: null });
      } catch (h) {
        // Yükleme başarısızsa uygulama yerleşik katalogla çalışmaya devam
        // eder; denetim durmaz, sadece özel tipler görünmez.
        ayarla({ yuklendi: true, hata: h instanceof Error ? h.message : String(h) });
      }
    },

    ekle: async (girdi) => {
      const tip = await ozelHataTipiEkle(girdi);
      bagla(await ozelHataTipleriOku());
      return tip;
    },

    kaldir: async (id) => {
      await ozelHataTipiKaldir(id);
      bagla(await ozelHataTipleriOku());
    },

    geriAl: async (id) => {
      await ozelHataTipiGeriAl(id);
      bagla(await ozelHataTipleriOku());
    },
  };
});
