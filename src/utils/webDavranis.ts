/**
 * WEB'E ÖZGÜ DAVRANIŞLAR — saf (react-native'siz), birim testli
 * (tests/webDavranis.test.ts). AJAN 28, 10.10.2026.
 */

/**
 * WhatsApp adresi. Tarayıcıda `whatsapp://` şeması işlenmez ama
 * `Linking.openURL` HATA DA FIRLATMAZ: eski kod web'de sessizce "WhatsApp
 * açıldı" sayıp SMS yedeğine hiç düşmüyordu. wa.me https bağlantısıdır;
 * masaüstünde WhatsApp Web'i / uygulamayı, telefonda uygulamayı açar.
 */
export function whatsappAdresi(os: string, numara: string, mesaj: string): string {
  const metin = encodeURIComponent(mesaj);
  return os === 'web'
    ? `https://wa.me/${numara}?text=${metin}`
    : `whatsapp://send?phone=${numara}&text=${metin}`;
}

/**
 * "Telefon takvimine ekle" yalnız natifte anlamlı: expo-calendar'ın web
 * uygulaması yok; web'de soru çıkıyor, "Evet" denince "uygulamanın yeni
 * sürümü gerekiyor" yazıyordu.
 */
export function telefonTakvimiSunulurMu(os: string): boolean {
  return os !== 'web';
}

/** Formda kullanıcının yazdığı bir şey var mı (kaydedilmemiş veri uyarısı için). */
export function doluAlanVar(degerler: readonly (string | null | undefined)[]): boolean {
  return degerler.some((d) => !!d && d.trim().length > 0);
}

interface BeforeUnloadOlayi {
  preventDefault: () => void;
  returnValue?: string;
}
export interface OlayHedefi {
  addEventListener: (tur: 'beforeunload', f: (e: BeforeUnloadOlayi) => void) => void;
  removeEventListener: (tur: 'beforeunload', f: (e: BeforeUnloadOlayi) => void) => void;
}

/**
 * Sekme kapatılırken / sayfa yenilenirken tarayıcının KENDİ "ayrılmak
 * istiyor musunuz" uyarısını açar. Metin tarayıcıya aittir, özelleştirilemez.
 * `kirli` false ise dinleyici KURULMAZ. Dönen işlev dinleyiciyi kaldırır.
 *
 * Uygulama İÇİ geri/ekran değişimini yakalamaz (SPA'da beforeunload
 * tetiklenmez) — kapsam bilerek yalnız sekme kapatma/yenileme.
 */
export function cikisUyarisiniKur(hedef: OlayHedefi, kirli: boolean): () => void {
  if (!kirli) return () => {};
  const dinleyici = (e: BeforeUnloadOlayi) => {
    e.preventDefault();
    e.returnValue = '';
  };
  hedef.addEventListener('beforeunload', dinleyici);
  return () => hedef.removeEventListener('beforeunload', dinleyici);
}
