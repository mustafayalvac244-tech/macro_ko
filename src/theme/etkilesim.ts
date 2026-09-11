/**
 * FARE/KLAVYE ETKİLEŞİM DURUMU (web).
 *
 * react-native-web'in Pressable'ı, stil geri çağrısına `pressed` yanında
 * `hovered` ve `focused` da veriyor
 * (node_modules/react-native-web/src/exports/Pressable/index.js → interactionState).
 * React Native'in TİPLERİNDE bu alanlar YOK, çünkü telefonda fare imleci yok.
 * Bu yüzden her çağrı yerinde `as` yazmak yerine tek bir tip burada duruyor.
 *
 * NEDEN ÖNEMLİ: ölçüldü (2026-09-11, Chromium) — uygulamadaki 522 Pressable'ın
 * HİÇBİRİNDE fareyle üzerine gelince bir değişiklik olmuyordu: arka plan,
 * gölge ve dönüşüm hover öncesi ve sonrası birebir aynıydı. Başarılı web
 * uygulamalarında imleç bir satırın üzerine geldiğinde satır yanıt verir;
 * yanıt vermeyen arayüz "tıklanmaz" hissi veriyor.
 */
export interface EtkilesimDurumu {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/** Pressable stil geri çağrısındaki durumu web alanlarıyla birlikte okur. */
export function etkilesim(durum: { pressed: boolean }): EtkilesimDurumu {
  return durum as EtkilesimDurumu;
}
