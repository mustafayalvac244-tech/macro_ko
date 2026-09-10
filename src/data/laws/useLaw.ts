import { useEffect, useState } from 'react';
import { ensureLaw, loadLaw, type LawFile } from './loader';

/**
 * Bir kanunun metnini ekrana getirir.
 *
 * NATİF: metin pakette gömülü, ilk render'da HAZIR gelir — `yukleniyor` hiç
 * true olmaz, davranış eskisiyle birebir aynıdır.
 * WEB: metin ağdan indirilir (bkz. loader.web.ts); indirme bitene kadar
 * `yukleniyor` true, hata olursa `hata` dolar.
 */
export function useLaw(slug: string): { law: LawFile | null; yukleniyor: boolean; hata: boolean } {
  const [law, setLaw] = useState<LawFile | null>(() => loadLaw(slug));
  const [yukleniyor, setYukleniyor] = useState(() => loadLaw(slug) === null);
  const [hata, setHata] = useState(false);

  useEffect(() => {
    let iptal = false;
    const hazir = loadLaw(slug);
    if (hazir) {
      setLaw(hazir);
      setYukleniyor(false);
      setHata(false);
      return;
    }
    setLaw(null);
    setHata(false);
    setYukleniyor(true);
    ensureLaw(slug)
      .then(() => {
        if (iptal) return;
        setLaw(loadLaw(slug));
        setYukleniyor(false);
      })
      .catch(() => {
        if (iptal) return;
        setHata(true);
        setYukleniyor(false);
      });
    return () => {
      iptal = true;
    };
  }, [slug]);

  return { law, yukleniyor, hata };
}
