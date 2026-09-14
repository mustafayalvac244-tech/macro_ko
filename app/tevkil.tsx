/**
 * ROTA — TEVKİL PANOSU.
 *
 * Bu dosya bilerek neredeyse boş. Ekranın gövdesi `src/components/tevkil/`
 * altında ve Metro'nun platform uzantısıyla ikiye ayrılıyor:
 *   Pano.web.tsx → gerçek pano (yalnız web paketine girer)
 *   Pano.tsx     → "yalnız web sürümünde" notu (native paketine girer)
 *
 * NEDEN BÖLME BURADA DEĞİL. Expo Router dokümanı (SDK 57), `app/` içinde
 * platform uzantısının ancak PLATFORMSUZ sürüm de varsa çalıştığını söylüyor —
 * rotalar derin bağlantı için evrensel kalmak zorunda. Yani `app/tevkil.web.tsx`
 * tek başına rotayı native'de gizlemezdi. Bölmeyi `app/` dışında yapınca hem
 * rota evrensel kalıyor hem de pano kodu native pakete hiç girmiyor.
 */
export { default } from '@/components/tevkil/Pano';
