/**
 * BASE64 ÇEVRİMİNİN SAF PARÇASI — react-native çekmeyen modül.
 *
 * NEDEN AYRI DOSYA. Bu iki işlev src/lib/girdi.ts içinde yazılmıştı ve orada
 * sınanamıyordu: girdi.ts, Platform ve expo-file-system üzerinden react-native
 * çekiyor, test koşucusu (vitest) react-native'in Flow sözdizimini
 * ayrıştıramıyor. Aynı ders bu depoda daha önce iki kez alındı —
 * src/utils/csvMetni.ts ve src/config/planlar.ts tam olarak bu yüzden ayrıldı.
 *
 * SINANMASI ÖNEMLİ, ÇÜNKÜ İKİ SESSİZ TUZAK BURADA:
 *  • Yayma işleçli base64 (`btoa(String.fromCharCode(...baytlar))`) küçük
 *    dosyada çalışır, birkaç megabaytlık dosyada çağrı yığınını taşırır.
 *  • Tarayıcı base64'ü "data:...;base64," ön ekiyle verir, natif vermez.
 *
 * İkisi de ancak gerçek kullanıcının gerçek dosyasında görülürdü.
 */

/**
 * Baytları base64'e çevirir — parça parça, yığın taşırmadan.
 *
 * 32 KB'lık parçalar hem güvenli hem hızlı: daha küçük parça gereksiz döngü,
 * daha büyüğü bazı tarayıcılarda yine argüman sınırına dayanır.
 */
export function baytlariBase64(baytlar: Uint8Array): string {
  const PARCA = 0x8000; // 32 KB
  let ikili = '';
  for (let i = 0; i < baytlar.length; i += PARCA) {
    ikili += String.fromCharCode(...baytlar.subarray(i, i + PARCA));
  }
  return btoa(ikili);
}

/** `data:...;base64,` ön ekini kırpar; ön ek yoksa metni olduğu gibi verir. */
export function base64OnEkiniKirp(metin: string): string {
  const virgul = metin.indexOf(',');
  return metin.startsWith('data:') && virgul > -1 ? metin.slice(virgul + 1) : metin;
}
