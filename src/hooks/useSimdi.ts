import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * EKRANIN "ŞİMDİ"Sİ — dakikada bir ve uygulama öne geldiğinde yenilenir.
 *
 * NEDEN VAR (09.10.2026 denetimi). Ana ekran "bugün", "sıradaki duruşma" ve
 * "kalan gün" hesaplarında saati useMemo içinde okuyordu; memo yalnız veri
 * değişince yeniden hesaplandığı için uygulama açık kalınca (masaüstü sekmesi,
 * arka plandan dönen telefon) gece yarısından sonra dünün işleri "BUGÜN" diye
 * kalıyordu. Aşağı çekip yenilemek de kurtarmıyordu: veri aynıysa react-query
 * aynı referansı döndürür, memo yine hesaplanmaz.
 *
 * Kullanım: `const simdi = useSimdi();` ve zamana bağlı her memo'nun
 * bağımlılığına `simdi` girer. Saati okuyan tek yer burası olmalı
 * (bekçi: tests/panoHesap.test.ts).
 */
export function useSimdi(aralikMs = 60_000): Date {
  const [simdi, setSimdi] = useState(() => new Date());
  useEffect(() => {
    const yenile = () => setSimdi(new Date());
    const zamanlayici = setInterval(yenile, aralikMs);
    // Arka planda zamanlayıcı durur ya da seyrekleşir (telefon, gizli sekme);
    // öne gelince beklemeden güncellenir.
    const abone = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') yenile();
    });
    return () => {
      clearInterval(zamanlayici);
      abone.remove();
    };
  }, [aralikMs]);
  return simdi;
}
