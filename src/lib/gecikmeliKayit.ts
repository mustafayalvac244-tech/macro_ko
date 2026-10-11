/**
 * GECİKMELİ KAYIT — yazarken her tuşta değil, durunca bir kez yaz; ekran
 * kapanırken bekleyeni HEMEN yaz (09.10.2026).
 *
 * Neden: Duruşma Planı'ndaki notlar yalnız ekran durumundaydı ve "Kaydet"e
 * basılmadan sekme değişince kayboluyordu (bkz. components/case/WarPlanTab).
 * Her değişikliği anında yazmak her tuşta cihaz deposuna bir JSON yazmak
 * demek; bu denetleyici değişiklikleri biriktirip bekleme dolunca SON hâli
 * bir kez yazar. `bosalt` sekme kapanırken / uygulama arka plana geçerken
 * çağrılır: bekleme dolmadan çıkan kullanıcının son notu da yazılır.
 *
 * Saf mantık (zamanlayıcı dışında yan etkisi yok); tests/planOtomatikKayit.
 */
export interface GecikmeliKayit<T> {
  /** Yeni değer geldi: beklemeyi baştan başlat. */
  degisti(deger: T): void;
  /** Bekleyen değer varsa ŞİMDİ yaz. */
  bosalt(): void;
  /** Bekleyeni yazmadan düşür (aynı içerik başka yoldan yazıldıysa). */
  vazgec(): void;
}

export function gecikmeliKayit<T>(yaz: (deger: T) => void, beklemeMs: number): GecikmeliKayit<T> {
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  let bekleyen: { deger: T } | null = null;

  const durdur = () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    zamanlayici = null;
  };

  const bosalt = () => {
    durdur();
    if (!bekleyen) return;
    const { deger } = bekleyen;
    bekleyen = null;
    yaz(deger);
  };

  return {
    degisti(deger) {
      bekleyen = { deger };
      durdur();
      zamanlayici = setTimeout(bosalt, beklemeMs);
    },
    bosalt,
    vazgec() {
      durdur();
      bekleyen = null;
    },
  };
}
